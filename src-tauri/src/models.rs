use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Vault {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Credential {
    pub id: String,
    pub vault_id: String,
    pub label: String,
    pub username: String,
    pub has_password: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostGroup {
    pub id: String,
    pub vault_id: String,
    pub label: String,
    pub color_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshProfile {
    pub id: String,
    pub vault_id: String,
    pub credential_id: Option<String>,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub group_id: Option<String>,
    pub group: Option<String>,
    pub group_color_id: Option<String>,
    pub ssh_key_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalTheme {
    pub id: String,
    pub name: String,
    pub colors_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVaultInput {
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateVaultInput {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCredentialInput {
    pub vault_id: String,
    pub label: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCredentialInput {
    pub id: String,
    pub label: String,
    pub username: String,
    pub password: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProfileInput {
    pub vault_id: String,
    pub credential_id: Option<String>,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub group: Option<String>,
    pub ssh_key_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileInput {
    pub id: String,
    pub credential_id: Option<String>,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub group: Option<String>,
    pub ssh_key_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateHostGroupInput {
    pub id: String,
    pub label: String,
    pub color_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportVaultInput {
    pub vault_id: String,
    pub path: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportVaultInput {
    pub path: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTerminalThemeInput {
    pub name: String,
    pub colors_json: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetActiveTerminalThemeInput {
    pub id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportVaultResult {
    pub vault: Vault,
    pub credentials_imported: usize,
    pub profiles_imported: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectSshInput {
    pub session_id: String,
    pub profile_id: String,
    pub cols: u32,
    pub rows: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshWriteInput {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshResizeInput {
    pub session_id: String,
    pub cols: u32,
    pub rows: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshSessionInput {
    pub session_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshSessionInfo {
    pub session_id: String,
    pub profile_id: String,
    pub credential_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectSftpInput {
    pub session_id: String,
    pub profile_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpSessionInput {
    pub session_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpPathInput {
    pub session_id: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpRenameInput {
    pub session_id: String,
    pub old_path: String,
    pub new_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpTransferInput {
    pub session_id: String,
    pub local_path: String,
    pub remote_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalPathInput {
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRenameInput {
    pub old_path: String,
    pub new_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SftpSessionInfo {
    pub session_id: String,
    pub profile_id: String,
    pub credential_id: Option<String>,
    pub home_path: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RemoteFileEntry {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub size: Option<u64>,
    pub permissions: Option<u32>,
    pub modified_at: Option<String>,
    pub accessed_at: Option<String>,
    pub user: Option<String>,
    pub group: Option<String>,
    pub uid: Option<u32>,
    pub gid: Option<u32>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SftpStatusEvent {
    pub session_id: String,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SftpTransferInfo {
    pub transfer_id: String,
    pub session_id: String,
    pub direction: String,
    pub source_path: String,
    pub destination_path: String,
    pub bytes_transferred: u64,
    pub bytes_total: Option<u64>,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SshOutputEvent {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SshStatusEvent {
    pub session_id: String,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportFile {
    pub version: u8,
    pub kdf: String,
    pub cipher: String,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPayload {
    pub version: u8,
    pub exported_at: String,
    pub vault: ExportVault,
    pub credentials: Vec<ExportCredential>,
    #[serde(default)]
    pub host_groups: Vec<ExportHostGroup>,
    pub profiles: Vec<ExportProfile>,
    #[serde(default)]
    pub terminal_themes: Vec<ExportTerminalTheme>,
    #[serde(default)]
    pub active_terminal_theme_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportVault {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCredential {
    pub id: String,
    pub label: String,
    pub username: String,
    pub password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportHostGroup {
    pub id: String,
    pub label: String,
    pub color_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProfile {
    pub id: String,
    pub credential_id: Option<String>,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(default)]
    pub group_id: Option<String>,
    #[serde(default)]
    pub group: Option<String>,
    #[serde(default)]
    pub ssh_key_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTerminalTheme {
    pub id: String,
    pub name: String,
    pub colors_json: String,
}
