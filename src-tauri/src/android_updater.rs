use serde::{Deserialize, Serialize};
use tauri::{
    Manager,
    plugin::{Builder, PluginHandle, TauriPlugin},
};

#[derive(Serialize)]
struct UpdateArgs {
    install: bool,
}

#[derive(Deserialize)]
pub struct UpdateResult {
    pub version: Option<String>,
    pub status: Option<String>,
}

pub fn init() -> TauriPlugin<tauri::Wry> {
    Builder::new("android-updater")
        .setup(|app, api| {
            let handle =
                api.register_android_plugin("pl.chwalczyk.kartkoweczka", "AndroidUpdaterPlugin")?;
            app.manage(handle);
            Ok(())
        })
        .build()
}

pub async fn update(app: tauri::AppHandle, install: bool) -> Result<UpdateResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<PluginHandle<tauri::Wry>>()
            .run_mobile_plugin("update", UpdateArgs { install })
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}
