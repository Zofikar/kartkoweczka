mod database;

use database::{DatabaseState, database_execute, database_ready};
use tauri::Manager;

#[tauri::command]
async fn native_update(app: tauri::AppHandle, install: bool) -> Result<Option<String>, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_updater::UpdaterExt;
        let update = app
            .updater()
            .map_err(|e| e.to_string())?
            .check()
            .await
            .map_err(|e| e.to_string())?;
        if let Some(update) = update {
            let version = update.version.clone();
            if install {
                update
                    .download_and_install(|_, _| {}, || {})
                    .await
                    .map_err(|e| e.to_string())?;
                app.restart();
            }
            return Ok(Some(version));
        }
        Ok(None)
    }
    #[cfg(mobile)]
    {
        let _ = (app, install);
        Err("Native updater is unavailable on mobile".into())
    }
}

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
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .manage(DatabaseState::default())
        .invoke_handler(tauri::generate_handler![
            database_ready,
            database_execute,
            open_licenses,
            native_update
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Kartkóweczka");
}
