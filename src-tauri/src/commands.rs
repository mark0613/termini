use tauri::State;

use crate::{
    error::command_result,
    models::{
        ConnectSshInput, CreateCredentialInput, CreateProfileInput, CreateTerminalThemeInput,
        CreateVaultInput, Credential, ExportVaultInput, HostGroup, ImportVaultInput,
        ImportVaultResult, LocalPathInput, LocalRenameInput, RemoteFileEntry,
        SetActiveTerminalThemeInput, SftpPathInput, SftpRenameInput, SftpSessionInfo,
        SftpSessionInput, SftpTransferInfo, SftpTransferInput, SshProfile, SshResizeInput,
        SshSessionInfo, SshSessionInput, SshWriteInput, TerminalTheme, UpdateCredentialInput,
        UpdateHostGroupInput, UpdateProfileInput, UpdateVaultInput, Vault,
    },
    state::AppState,
};

#[tauri::command]
pub fn list_vaults(state: State<'_, AppState>) -> Result<Vec<Vault>, String> {
    command_result(state.storage.list_vaults())
}

#[tauri::command]
pub fn create_vault(state: State<'_, AppState>, input: CreateVaultInput) -> Result<Vault, String> {
    command_result(state.storage.create_vault(input.name))
}

#[tauri::command]
pub fn update_vault(state: State<'_, AppState>, input: UpdateVaultInput) -> Result<Vault, String> {
    command_result(state.storage.update_vault(input.id, input.name))
}

#[tauri::command]
pub fn delete_vault(state: State<'_, AppState>, id: String) -> Result<(), String> {
    command_result(state.storage.delete_vault(id))
}

#[tauri::command]
pub fn list_credentials(
    state: State<'_, AppState>,
    vault_id: String,
) -> Result<Vec<Credential>, String> {
    command_result(state.storage.list_credentials(&vault_id))
}

#[tauri::command]
pub fn create_credential(
    state: State<'_, AppState>,
    input: CreateCredentialInput,
) -> Result<Credential, String> {
    command_result(state.storage.create_credential(
        input.vault_id,
        input.label,
        input.username,
        input.password,
    ))
}

#[tauri::command]
pub fn update_credential(
    state: State<'_, AppState>,
    input: UpdateCredentialInput,
) -> Result<Credential, String> {
    command_result(state.storage.update_credential(
        input.id,
        input.label,
        input.username,
        input.password,
    ))
}

#[tauri::command]
pub fn delete_credential(state: State<'_, AppState>, id: String) -> Result<(), String> {
    command_result(state.storage.delete_credential(id))
}

#[tauri::command]
pub fn reveal_credential_password(
    state: State<'_, AppState>,
    id: String,
) -> Result<String, String> {
    command_result(state.storage.get_password(&id))
}

#[tauri::command]
pub fn list_profiles(
    state: State<'_, AppState>,
    vault_id: String,
) -> Result<Vec<SshProfile>, String> {
    command_result(state.storage.list_profiles(&vault_id))
}

#[tauri::command]
pub fn list_host_groups(
    state: State<'_, AppState>,
    vault_id: String,
) -> Result<Vec<HostGroup>, String> {
    command_result(state.storage.list_host_groups(&vault_id))
}

#[tauri::command]
pub fn update_host_group(
    state: State<'_, AppState>,
    input: UpdateHostGroupInput,
) -> Result<HostGroup, String> {
    command_result(
        state
            .storage
            .update_host_group(input.id, input.label, input.color_id),
    )
}

#[tauri::command]
pub fn create_profile(
    state: State<'_, AppState>,
    input: CreateProfileInput,
) -> Result<SshProfile, String> {
    command_result(state.storage.create_profile(
        input.vault_id,
        input.credential_id,
        input.name,
        input.host,
        input.port,
        input.username,
        input.group,
        input.ssh_key_path,
    ))
}

#[tauri::command]
pub fn update_profile(
    state: State<'_, AppState>,
    input: UpdateProfileInput,
) -> Result<SshProfile, String> {
    command_result(state.storage.update_profile(
        input.id,
        input.credential_id,
        input.name,
        input.host,
        input.port,
        input.username,
        input.group,
        input.ssh_key_path,
    ))
}

#[tauri::command]
pub fn delete_profile(state: State<'_, AppState>, id: String) -> Result<(), String> {
    command_result(state.storage.delete_profile(id))
}

#[tauri::command]
pub fn export_vault(state: State<'_, AppState>, input: ExportVaultInput) -> Result<(), String> {
    command_result(
        state
            .storage
            .export_vault(input.vault_id, input.path, input.password),
    )
}

#[tauri::command]
pub fn import_vault(
    state: State<'_, AppState>,
    input: ImportVaultInput,
) -> Result<ImportVaultResult, String> {
    command_result(state.storage.import_vault(input.path, input.password))
}

#[tauri::command]
pub fn list_terminal_themes(state: State<'_, AppState>) -> Result<Vec<TerminalTheme>, String> {
    command_result(state.storage.list_terminal_themes())
}

#[tauri::command]
pub fn create_terminal_theme(
    state: State<'_, AppState>,
    input: CreateTerminalThemeInput,
) -> Result<TerminalTheme, String> {
    command_result(
        state
            .storage
            .create_terminal_theme(input.name, input.colors_json),
    )
}

#[tauri::command]
pub fn active_terminal_theme_id(state: State<'_, AppState>) -> Result<Option<String>, String> {
    command_result(state.storage.active_terminal_theme_id())
}

#[tauri::command]
pub fn set_active_terminal_theme_id(
    state: State<'_, AppState>,
    input: SetActiveTerminalThemeInput,
) -> Result<(), String> {
    command_result(state.storage.set_active_terminal_theme_id(input.id))
}

#[tauri::command]
pub fn delete_terminal_theme(state: State<'_, AppState>, id: String) -> Result<(), String> {
    command_result(state.storage.delete_terminal_theme(id))
}

#[tauri::command]
pub async fn connect_ssh(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: ConnectSshInput,
) -> Result<SshSessionInfo, String> {
    let result = async {
        let profile = state.storage.get_profile(&input.profile_id)?;
        let password = match &profile.credential_id {
            Some(credential_id) => Some(state.storage.get_password(credential_id)?),
            None => None,
        };
        state
            .ssh
            .connect(
                app,
                input.session_id,
                profile,
                password,
                input.cols,
                input.rows,
            )
            .await
    }
    .await;

    command_result(result)
}

#[tauri::command]
pub async fn write_ssh(state: State<'_, AppState>, input: SshWriteInput) -> Result<(), String> {
    command_result(state.ssh.write(&input.session_id, input.data).await)
}

#[tauri::command]
pub async fn resize_ssh(state: State<'_, AppState>, input: SshResizeInput) -> Result<(), String> {
    command_result(
        state
            .ssh
            .resize(&input.session_id, input.cols, input.rows)
            .await,
    )
}

#[tauri::command]
pub async fn disconnect_ssh(
    state: State<'_, AppState>,
    input: SshSessionInput,
) -> Result<(), String> {
    command_result(state.ssh.disconnect(&input.session_id).await)
}

#[tauri::command]
pub async fn send_profile_password(
    state: State<'_, AppState>,
    input: SshSessionInput,
) -> Result<(), String> {
    let result = async {
        let credential_id = state.ssh.credential_id(&input.session_id).await?;
        let credential_id = credential_id.ok_or_else(|| {
            crate::error::AppError::InvalidInput(
                "this SSH session does not have a saved password".to_string(),
            )
        })?;
        let password = state.storage.get_password(&credential_id)?;
        state
            .ssh
            .write(&input.session_id, format!("{password}\n"))
            .await
    }
    .await;

    command_result(result)
}

#[tauri::command]
pub async fn connect_sftp(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: crate::models::ConnectSftpInput,
) -> Result<SftpSessionInfo, String> {
    let result = async {
        let profile = state.storage.get_profile(&input.profile_id)?;
        let password = match &profile.credential_id {
            Some(credential_id) => Some(state.storage.get_password(credential_id)?),
            None => None,
        };
        state
            .sftp
            .connect(app, input.session_id, profile, password)
            .await
    }
    .await;

    command_result(result)
}

#[tauri::command]
pub async fn disconnect_sftp(
    state: State<'_, AppState>,
    input: SftpSessionInput,
) -> Result<(), String> {
    command_result(state.sftp.disconnect(&input.session_id).await)
}

#[tauri::command]
pub async fn sftp_read_dir(
    state: State<'_, AppState>,
    input: SftpPathInput,
) -> Result<Vec<RemoteFileEntry>, String> {
    command_result(state.sftp.read_dir(&input.session_id, input.path).await)
}

#[tauri::command]
pub async fn sftp_stat(
    state: State<'_, AppState>,
    input: SftpPathInput,
) -> Result<RemoteFileEntry, String> {
    command_result(state.sftp.stat(&input.session_id, input.path).await)
}

#[tauri::command]
pub async fn sftp_create_dir(
    state: State<'_, AppState>,
    input: SftpPathInput,
) -> Result<(), String> {
    command_result(state.sftp.create_dir(&input.session_id, input.path).await)
}

#[tauri::command]
pub async fn sftp_rename(state: State<'_, AppState>, input: SftpRenameInput) -> Result<(), String> {
    command_result(
        state
            .sftp
            .rename(&input.session_id, input.old_path, input.new_path)
            .await,
    )
}

#[tauri::command]
pub async fn sftp_delete_file(
    state: State<'_, AppState>,
    input: SftpPathInput,
) -> Result<(), String> {
    command_result(state.sftp.delete_file(&input.session_id, input.path).await)
}

#[tauri::command]
pub async fn sftp_delete_dir(
    state: State<'_, AppState>,
    input: SftpPathInput,
) -> Result<(), String> {
    command_result(state.sftp.delete_dir(&input.session_id, input.path).await)
}

#[tauri::command]
pub async fn sftp_upload_file(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: SftpTransferInput,
) -> Result<SftpTransferInfo, String> {
    command_result(
        state
            .sftp
            .upload_file(app, &input.session_id, input.local_path, input.remote_path)
            .await,
    )
}

#[tauri::command]
pub async fn sftp_download_file(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: SftpTransferInput,
) -> Result<SftpTransferInfo, String> {
    command_result(
        state
            .sftp
            .download_file(app, &input.session_id, input.remote_path, input.local_path)
            .await,
    )
}

#[tauri::command]
pub async fn local_read_dir(input: LocalPathInput) -> Result<Vec<RemoteFileEntry>, String> {
    command_result(crate::local_fs::read_dir(input.path).await)
}

#[tauri::command]
pub async fn local_create_dir(input: LocalPathInput) -> Result<(), String> {
    command_result(crate::local_fs::create_dir(input.path).await)
}

#[tauri::command]
pub async fn local_rename(input: LocalRenameInput) -> Result<(), String> {
    command_result(crate::local_fs::rename(input.old_path, input.new_path).await)
}

#[tauri::command]
pub async fn local_delete_file(input: LocalPathInput) -> Result<(), String> {
    command_result(crate::local_fs::delete_file(input.path).await)
}

#[tauri::command]
pub async fn local_delete_dir(input: LocalPathInput) -> Result<(), String> {
    command_result(crate::local_fs::delete_dir(input.path).await)
}
