# Tauri database bridge

Tauri builds must set `DATABASE_BACKEND=tauri` before running Vite. The value is replaced at
compile time, allowing the browser OPFS worker and SQLite WASM dependency graph to be removed from
the Tauri bundle.

The native implementation lives in `src-tauri/src/database.rs` and exposes two Tauri v2 commands.

## `database_ready`

- Arguments: none
- Result: `()` / JavaScript `undefined`
- Opens `kartkoweczka.sqlite3` in Tauri's application data directory.
- Enables foreign keys and a five-second SQLite busy timeout.
- Applies the embedded Drizzle migration exactly once.

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
	rows: unknown[]
}
```

Result semantics must match `drizzle-orm/sqlite-proxy`:

- `run`: `rows` is `[]`.
- `all` and `values`: `rows` is an array of positional row arrays.
- `get`: `rows` is one positional row array, or `[]` when no row exists.

The native backend serializes command execution through a mutex-protected SQLite connection.
Drizzle transactions are sent as separate `BEGIN`, statement, and `COMMIT`/`ROLLBACK` calls.

## Commands

```bash
yarn tauri:dev
yarn tauri:build
```

Both commands run Vite with `DATABASE_BACKEND=tauri`. Browser-only OPFS, SQLite WASM, Comlink, and
database worker code are therefore removed from the desktop frontend bundle.
