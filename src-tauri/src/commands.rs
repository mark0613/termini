use tauri::State;

use crate::{
    error::command_result,
    models::{
        ConnectSshInput, CreateCredentialInput, CreateProfileInput, CreateVaultInput, Credential,
        ExportVaultInput, ImportVaultInput, ImportVaultResult, SshProfile, SshResizeInput,
        SshSessionInfo, SshSessionInput, SshWriteInput, UpdateCredentialInput, UpdateProfileInput,
        UpdateVaultInput, Vault,
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
pub fn list_profiles(
    state: State<'_, AppState>,
    vault_id: String,
) -> Result<Vec<SshProfile>, String> {
    command_result(state.storage.list_profiles(&vault_id))
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
pub async fn connect_ssh(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: ConnectSshInput,
) -> Result<SshSessionInfo, String> {
    let result = async {
        let profile = state.storage.get_profile(&input.profile_id)?;
        let credential_id = profile.credential_id.clone().ok_or_else(|| {
            crate::error::AppError::InvalidInput("profile does not have a credential".to_string())
        })?;
        let password = state.storage.get_password(&credential_id)?;
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
        let password = state.storage.get_password(&credential_id)?;
        state
            .ssh
            .write(&input.session_id, format!("{password}\n"))
            .await
    }
    .await;

    command_result(result)
}
