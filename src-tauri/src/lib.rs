mod commands;
mod crypto;
mod error;
mod models;
mod secrets;
mod ssh;
mod state;
mod storage;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let state = AppState::new(app_data_dir)?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_vaults,
            commands::create_vault,
            commands::update_vault,
            commands::delete_vault,
            commands::list_credentials,
            commands::create_credential,
            commands::update_credential,
            commands::delete_credential,
            commands::list_profiles,
            commands::create_profile,
            commands::update_profile,
            commands::delete_profile,
            commands::export_vault,
            commands::import_vault,
            commands::connect_ssh,
            commands::write_ssh,
            commands::resize_ssh,
            commands::disconnect_ssh,
            commands::send_profile_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
