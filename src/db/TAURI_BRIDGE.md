# Tauri database bridge

## Shared database architecture

Repositories in `src/db/repositories` use Drizzle's SQLite proxy through a shared bridge.
The browser backend runs SQLite WASM in a worker and persists `/app.db` in OPFS.
Web Locks and BroadcastChannel coordinate ownership across tabs; data belongs to the
current origin. The native backend uses Rust/rusqlite. Neither backend uses PGlite.

Tauri builds must set `DATABASE_BACKEND=tauri` before running Vite. The value is replaced at
compile time, allowing the browser OPFS worker and SQLite WASM dependency graph to be removed from
the Tauri bundle.

The native implementation lives in `src-tauri/src/database.rs` and exposes two Tauri v2 commands.

## `database_ready`

- Arguments: none
- Result: `()` / JavaScript `undefined`
- Opens `kartkoweczka.sqlite3` in Tauri's application data directory.
- Enables foreign keys and a five-second SQLite busy timeout.
- Applies pending embedded Drizzle migrations, recording each applied migration.
  Current migrations are `0000_demonic_harry_osborn.sql` and `0001_condensed_true_false.sql`;
  keep native embedded migrations aligned with browser migrations.

## `database_execute`

Arguments are passed as one object:

```ts
{
	sql: string
	params: unknown[]
	method: 'run' | 'all' | 'values' | 'get'
}
```

The result must be:

```ts
{
	rows: unknown[] | null
}
```

Result semantics must match `drizzle-orm/sqlite-proxy`:

- `run`: `rows` is `[]`.
- `all` and `values`: `rows` is an array of positional row arrays.
- `get`: `rows` is one positional row array, or `null` when no row exists.
  An empty array is not the missing-row sentinel: Drizzle treats non-null results as rows.

The native backend serializes command execution through a mutex-protected SQLite connection.
Drizzle transactions are sent as separate `BEGIN`, statement, and `COMMIT`/`ROLLBACK` calls.

## Commands

```bash
yarn tauri:dev
yarn tauri:build
```

Both commands run Vite with `DATABASE_BACKEND=tauri`. Browser-only OPFS, SQLite WASM, Comlink, and
database worker code are therefore removed from the desktop frontend bundle.
