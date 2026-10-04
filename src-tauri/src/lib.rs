mod database;

use database::{DatabaseState, database_execute, database_ready};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DatabaseState::default())
        .invoke_handler(tauri::generate_handler![database_ready, database_execute])
        .run(tauri::generate_context!())
        .expect("failed to run Kartkóweczka");
}
