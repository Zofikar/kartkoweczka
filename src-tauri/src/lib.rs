mod database;

use database::{DatabaseState, database_execute, database_ready};
use tauri::Manager;

#[tauri::command]
async fn open_licenses(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("licenses") {
        window.unminimize().map_err(|error| error.to_string())?;
        return window.set_focus().map_err(|error| error.to_string());
    }

    tauri::WebviewWindowBuilder::new(
        &app,
        "licenses",
        tauri::WebviewUrl::App("licenses.html".into()),
    )
    .title("Kartkóweczka — Licenses")
    .inner_size(900.0, 700.0)
    .build()
    .map_err(|error| error.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DatabaseState::default())
        .invoke_handler(tauri::generate_handler![
            database_ready,
            database_execute,
            open_licenses
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Kartkóweczka");
}
