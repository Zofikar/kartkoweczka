use std::{fs, path::PathBuf, sync::Mutex};

use rusqlite::{Connection, params_from_iter, types::Value as SqlValue};
use serde::{Deserialize, Serialize};
use serde_json::{Number, Value as JsonValue};
use tauri::{AppHandle, Manager, State};

const DATABASE_FILENAME: &str = "kartkoweczka.sqlite3";
const MIGRATION_NAME: &str = "0000_demonic_harry_osborn.sql";
const MIGRATION_SQL: &str = include_str!("../../src/db/drizzle/0000_demonic_harry_osborn.sql");

#[derive(Default)]
pub struct DatabaseState {
    connection: Mutex<Option<Connection>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseMethod {
    Run,
    All,
    Values,
    Get,
}

#[derive(Debug, Serialize)]
pub struct DatabaseResult {
    rows: JsonValue,
}

#[tauri::command]
pub fn database_ready(app: AppHandle, state: State<'_, DatabaseState>) -> Result<(), String> {
    with_connection(&app, &state, |_| Ok(()))
}

#[tauri::command]
pub fn database_execute(
    app: AppHandle,
    state: State<'_, DatabaseState>,
    sql: String,
    params: Vec<JsonValue>,
    method: DatabaseMethod,
) -> Result<DatabaseResult, String> {
    with_connection(&app, &state, |connection| {
        execute_statement(connection, &sql, params, method)
    })
}

fn with_connection<T>(
    app: &AppHandle,
    state: &State<'_, DatabaseState>,
    operation: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let mut connection = state
        .connection
        .lock()
        .map_err(|_| "database connection lock is poisoned".to_string())?;

    if connection.is_none() {
        *connection = Some(open_database(app)?);
    }

    operation(
        connection
            .as_ref()
            .expect("database connection was initialized"),
    )
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    let connection = Connection::open(&path)
        .map_err(|error| format!("failed to open database at {}: {error}", path.display()))?;

    connection
        .execute_batch("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
        .map_err(|error| format!("failed to configure database: {error}"))?;
    apply_migrations(&connection)?;

    Ok(connection)
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data directory: {error}"))?;

    fs::create_dir_all(&directory).map_err(|error| {
        format!(
            "failed to create app data directory {}: {error}",
            directory.display()
        )
    })?;

    Ok(directory.join(DATABASE_FILENAME))
}

fn apply_migrations(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS __drizzle_migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );",
        )
        .map_err(|error| format!("failed to create migration table: {error}"))?;

    let is_applied = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM __drizzle_migrations WHERE name = ?1)",
            [MIGRATION_NAME],
            |row| row.get::<_, bool>(0),
        )
        .map_err(|error| format!("failed to inspect migrations: {error}"))?;

    if is_applied {
        return Ok(());
    }

    connection
        .execute_batch("BEGIN IMMEDIATE")
        .map_err(|error| format!("failed to start migration: {error}"))?;

    let result = apply_initial_migration(connection);
    match result {
        Ok(()) => connection
            .execute_batch("COMMIT")
            .map_err(|error| format!("failed to commit migration: {error}")),
        Err(error) => {
            let _ = connection.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

fn apply_initial_migration(connection: &Connection) -> Result<(), String> {
    for statement in MIGRATION_SQL.split("--> statement-breakpoint") {
        let statement = statement.trim();
        if !statement.is_empty() {
            connection
                .execute_batch(statement)
                .map_err(|error| format!("failed to apply {MIGRATION_NAME}: {error}"))?;
        }
    }

    connection
        .execute(
            "INSERT INTO __drizzle_migrations (name) VALUES (?1)",
            [MIGRATION_NAME],
        )
        .map_err(|error| format!("failed to record {MIGRATION_NAME}: {error}"))?;

    Ok(())
}

fn execute_statement(
    connection: &Connection,
    sql: &str,
    params: Vec<JsonValue>,
    method: DatabaseMethod,
) -> Result<DatabaseResult, String> {
    let params = params
        .into_iter()
        .map(json_to_sql_value)
        .collect::<Result<Vec<_>, _>>()?;
    let mut statement = connection
        .prepare(sql)
        .map_err(|error| format!("failed to prepare SQL statement: {error}"))?;

    if matches!(method, DatabaseMethod::Run) {
        statement
            .execute(params_from_iter(params.iter()))
            .map_err(|error| format!("failed to execute SQL statement: {error}"))?;
        return Ok(DatabaseResult {
            rows: JsonValue::Array(Vec::new()),
        });
    }

    let column_count = statement.column_count();
    let mut query = statement
        .query(params_from_iter(params.iter()))
        .map_err(|error| format!("failed to query database: {error}"))?;
    let mut rows = Vec::new();

    while let Some(row) = query
        .next()
        .map_err(|error| format!("failed to read database row: {error}"))?
    {
        let values = (0..column_count)
            .map(|index| row.get::<_, SqlValue>(index).map(sql_to_json_value))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("failed to decode database row: {error}"))?;
        rows.push(JsonValue::Array(values));
    }

    let rows = if matches!(method, DatabaseMethod::Get) {
        rows.into_iter()
            .next()
            .unwrap_or_else(|| JsonValue::Array(Vec::new()))
    } else {
        JsonValue::Array(rows)
    };

    Ok(DatabaseResult { rows })
}

fn json_to_sql_value(value: JsonValue) -> Result<SqlValue, String> {
    match value {
        JsonValue::Null => Ok(SqlValue::Null),
        JsonValue::Bool(value) => Ok(SqlValue::Integer(i64::from(value))),
        JsonValue::Number(value) => number_to_sql_value(value),
        JsonValue::String(value) => Ok(SqlValue::Text(value)),
        JsonValue::Array(_) | JsonValue::Object(_) => {
            Err("structured values cannot be bound directly to SQLite".to_string())
        }
    }
}

fn number_to_sql_value(value: Number) -> Result<SqlValue, String> {
    if let Some(value) = value.as_i64() {
        return Ok(SqlValue::Integer(value));
    }
    if let Some(value) = value.as_u64() {
        return i64::try_from(value)
            .map(SqlValue::Integer)
            .map_err(|_| "SQLite integer parameter exceeds i64".to_string());
    }
    value
        .as_f64()
        .map(SqlValue::Real)
        .ok_or_else(|| "invalid numeric SQLite parameter".to_string())
}

fn sql_to_json_value(value: SqlValue) -> JsonValue {
    match value {
        SqlValue::Null => JsonValue::Null,
        SqlValue::Integer(value) => JsonValue::Number(value.into()),
        SqlValue::Real(value) => Number::from_f64(value)
            .map(JsonValue::Number)
            .unwrap_or(JsonValue::Null),
        SqlValue::Text(value) => JsonValue::String(value),
        SqlValue::Blob(value) => JsonValue::Array(
            value
                .into_iter()
                .map(|byte| JsonValue::Number(byte.into()))
                .collect(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn migrated_database() -> Connection {
        let connection = Connection::open_in_memory().expect("in-memory database should open");
        connection
            .execute_batch("PRAGMA foreign_keys = ON")
            .expect("foreign keys should be enabled");
        apply_migrations(&connection).expect("migrations should succeed");
        connection
    }

    #[test]
    fn migration_is_idempotent() {
        let connection = migrated_database();

        apply_migrations(&connection).expect("second migration run should succeed");

        let migration_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM __drizzle_migrations", [], |row| {
                row.get(0)
            })
            .expect("migration count should be readable");
        assert_eq!(migration_count, 1);
    }

    #[test]
    fn execute_statement_returns_positional_rows() {
        let connection = migrated_database();
        execute_statement(
            &connection,
            "INSERT INTO tags (tag_name) VALUES (?)",
            vec![JsonValue::String("algebra".to_string())],
            DatabaseMethod::Run,
        )
        .expect("tag should be inserted");

        let result = execute_statement(
            &connection,
            "SELECT tag_name FROM tags WHERE tag_name = ?",
            vec![JsonValue::String("algebra".to_string())],
            DatabaseMethod::Get,
        )
        .expect("tag should be selected");

        assert_eq!(
            result.rows,
            JsonValue::Array(vec![JsonValue::String("algebra".to_string())])
        );
    }

    #[test]
    fn structured_parameters_are_rejected() {
        let connection = migrated_database();

        let error = execute_statement(
            &connection,
            "SELECT ?",
            vec![serde_json::json!({ "unsupported": true })],
            DatabaseMethod::Get,
        )
        .expect_err("object parameter should be rejected");

        assert!(error.contains("structured values"));
    }
}
