mod commands;
mod crypto;
mod error;
mod local_fs;
mod models;
mod secrets;
mod sftp;
mod ssh;
mod ssh_client;
mod state;
mod storage;

use state::AppState;
use tauri::Manager;
use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            WindowStateBuilder::new()
                .with_state_flags(
                    StateFlags::SIZE | StateFlags::MAXIMIZED | StateFlags::FULLSCREEN,
                )
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let path = app.path();
            let legacy_app_data_dir = path.app_data_dir()?;
            let app_data_dir = path.data_dir()?.join("Termini");
            let state = AppState::new(app_data_dir, Some(legacy_app_data_dir))?;
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
            commands::reveal_credential_password,
            commands::list_profiles,
            commands::create_profile,
            commands::update_profile,
            commands::delete_profile,
            commands::export_vault,
            commands::import_vault,
            commands::list_terminal_themes,
            commands::create_terminal_theme,
            commands::active_terminal_theme_id,
            commands::set_active_terminal_theme_id,
            commands::delete_terminal_theme,
            commands::connect_ssh,
            commands::write_ssh,
            commands::resize_ssh,
            commands::disconnect_ssh,
            commands::send_profile_password,
            commands::connect_sftp,
            commands::disconnect_sftp,
            commands::sftp_read_dir,
            commands::sftp_stat,
            commands::sftp_create_dir,
            commands::sftp_rename,
            commands::sftp_delete_file,
            commands::sftp_delete_dir,
            commands::sftp_upload_file,
            commands::sftp_download_file,
            commands::local_read_dir,
            commands::local_create_dir,
            commands::local_rename,
            commands::local_delete_file,
            commands::local_delete_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
