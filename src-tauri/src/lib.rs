#[cfg(target_os = "android")]
mod android_updater;
mod database;

use database::{DatabaseState, database_execute, database_ready};
use tauri::Manager;

#[tauri::command]
async fn native_update(app: tauri::AppHandle, install: bool) -> Result<Option<String>, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_updater::UpdaterExt;
        if !app.config().plugins.0.contains_key("updater") {
            return Err("Native updates are not configured for this build".into());
        }
        let update = app
            .updater()
            .map_err(|e| e.to_string())?
            .check()
            .await
            .map_err(|e| e.to_string())?;
        if let Some(update) = update {
            let version = update.version.clone();
            if install {
                let bytes = update
                    .download(|_, _| {}, || {})
                    .await
                    .map_err(|e| e.to_string())?;

                #[cfg(windows)]
                {
                    // Windows installation cleans up WebViews and exits the process.
                    // Perform that cleanup on their owning event-loop thread.
                    let (sender, receiver) = std::sync::mpsc::channel();
                    app.run_on_main_thread(move || {
                        let result = update.install(bytes).map_err(|e| e.to_string());
                        let _ = sender.send(result);
                    })
                    .map_err(|e| e.to_string())?;
                    tauri::async_runtime::spawn_blocking(move || {
                        receiver.recv().map_err(|e| e.to_string())?
                    })
                    .await
                    .map_err(|e| e.to_string())??;
                }

                #[cfg(not(windows))]
                {
                    update.install(bytes).map_err(|e| e.to_string())?;
                    app.restart();
                }
            }
            return Ok(Some(version));
        }
        Ok(None)
    }
    #[cfg(target_os = "android")]
    {
        let result = android_updater::update(app, install).await?;
        if result.status.as_deref() == Some("permission") {
            return Err("android-install-permission".into());
        }
        Ok(result.version)
    }
    #[cfg(target_os = "ios")]
    {
        let _ = (app, install);
        Err("Native updater is unavailable on mobile".into())
    }
}

#[tauri::command]
async fn open_licenses(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("licenses") {
        #[cfg(desktop)]
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
        .setup(|_app| {
            #[cfg(target_os = "android")]
            _app.handle().plugin(android_updater::init())?;
            #[cfg(desktop)]
            if _app.config().plugins.0.contains_key("updater") {
                _app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
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
