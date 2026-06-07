use std::{collections::HashMap, sync::Arc, time::Duration};

use chrono::{DateTime, Utc};
use russh::{client, Disconnect};
use russh_sftp::{
    client::{fs::DirEntry, SftpSession},
    protocol::{FileAttributes, FileType},
};
use tauri::{AppHandle, Emitter};
use tokio::{
    fs,
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
    sync::Mutex,
};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{RemoteFileEntry, SftpSessionInfo, SftpStatusEvent, SftpTransferInfo, SshProfile},
    ssh_client::{connect_profile, ClientHandler},
};

#[derive(Default)]
pub struct SftpManager {
    sessions: Arc<Mutex<HashMap<String, ManagedSftpSession>>>,
}

struct ManagedSftpSession {
    handle: client::Handle<ClientHandler>,
    sftp: Arc<SftpSession>,
}

impl SftpManager {
    pub async fn connect(
        &self,
        app: AppHandle,
        session_id: String,
        profile: SshProfile,
        password: Option<String>,
    ) -> AppResult<SftpSessionInfo> {
        let credential_id = profile.credential_id.clone();

        emit_status(
            &app,
            &session_id,
            "connecting",
            Some("Connecting to SFTP host"),
        );

        let handle = connect_profile(&profile, password.as_deref()).await?;
        let channel = handle.channel_open_session().await?;
        channel.request_subsystem(true, "sftp").await?;
        let sftp = Arc::new(SftpSession::new(channel.into_stream()).await?);
        let home_path = sftp
            .canonicalize(".")
            .await
            .unwrap_or_else(|_| ".".to_string());

        self.sessions
            .lock()
            .await
            .insert(session_id.clone(), ManagedSftpSession { handle, sftp });

        emit_status(&app, &session_id, "connected", None);

        Ok(SftpSessionInfo {
            session_id,
            profile_id: profile.id,
            credential_id,
            home_path,
        })
    }

    pub async fn disconnect(&self, session_id: &str) -> AppResult<()> {
        let session = self.sessions.lock().await.remove(session_id);
        if let Some(session) = session {
            session.sftp.close().await?;
            session
                .handle
                .disconnect(Disconnect::ByApplication, "", "English")
                .await?;
        }
        Ok(())
    }

    pub async fn read_dir(
        &self,
        session_id: &str,
        path: String,
    ) -> AppResult<Vec<RemoteFileEntry>> {
        let sftp = self.get_sftp(session_id).await?;
        let mut entries = sftp
            .read_dir(if path.trim().is_empty() {
                "."
            } else {
                path.trim()
            })
            .await?
            .map(remote_entry_from_dir_entry)
            .collect::<Vec<_>>();

        entries.sort_by(|a, b| {
            b.kind
                .eq("directory")
                .cmp(&a.kind.eq("directory"))
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });

        Ok(entries)
    }

    pub async fn stat(&self, session_id: &str, path: String) -> AppResult<RemoteFileEntry> {
        let sftp = self.get_sftp(session_id).await?;
        let normalized_path = if path.trim().is_empty() {
            "."
        } else {
            path.trim()
        };
        let metadata = sftp.metadata(normalized_path).await?;
        Ok(remote_entry_from_metadata(normalized_path, metadata))
    }

    pub async fn create_dir(&self, session_id: &str, path: String) -> AppResult<()> {
        let sftp = self.get_sftp(session_id).await?;
        sftp.create_dir(path).await?;
        Ok(())
    }

    pub async fn rename(
        &self,
        session_id: &str,
        old_path: String,
        new_path: String,
    ) -> AppResult<()> {
        let sftp = self.get_sftp(session_id).await?;
        sftp.rename(old_path, new_path).await?;
        Ok(())
    }

    pub async fn delete_file(&self, session_id: &str, path: String) -> AppResult<()> {
        let sftp = self.get_sftp(session_id).await?;
        sftp.remove_file(path).await?;
        Ok(())
    }

    pub async fn delete_dir(&self, session_id: &str, path: String) -> AppResult<()> {
        let sftp = self.get_sftp(session_id).await?;
        sftp.remove_dir(path).await?;
        Ok(())
    }

    pub async fn upload_file(
        &self,
        app: AppHandle,
        session_id: &str,
        local_path: String,
        remote_path: String,
    ) -> AppResult<SftpTransferInfo> {
        let sftp = self.get_sftp(session_id).await?;
        let bytes_total = fs::metadata(&local_path)
            .await
            .ok()
            .map(|metadata| metadata.len());
        let transfer = new_transfer_info(
            session_id,
            "upload",
            local_path.clone(),
            remote_path.clone(),
            bytes_total,
        );
        emit_transfer(&app, &transfer);

        let result = async {
            let local_file = fs::File::open(&local_path).await?;
            let remote_file = sftp.create(remote_path).await?;
            copy_with_progress(local_file, remote_file, &app, transfer.clone()).await
        }
        .await;

        finish_transfer(&app, result, transfer)
    }

    pub async fn download_file(
        &self,
        app: AppHandle,
        session_id: &str,
        remote_path: String,
        local_path: String,
    ) -> AppResult<SftpTransferInfo> {
        let sftp = self.get_sftp(session_id).await?;
        let bytes_total = sftp
            .metadata(&remote_path)
            .await
            .ok()
            .and_then(|metadata| metadata.size);
        let transfer = new_transfer_info(
            session_id,
            "download",
            remote_path.clone(),
            local_path.clone(),
            bytes_total,
        );
        emit_transfer(&app, &transfer);

        let result = async {
            let remote_file = sftp.open(remote_path).await?;
            let local_file = fs::File::create(&local_path).await?;
            copy_with_progress(remote_file, local_file, &app, transfer.clone()).await
        }
        .await;

        finish_transfer(&app, result, transfer)
    }

    async fn get_sftp(&self, session_id: &str) -> AppResult<Arc<SftpSession>> {
        self.sessions
            .lock()
            .await
            .get(session_id)
            .map(|session| Arc::clone(&session.sftp))
            .ok_or_else(|| AppError::InvalidInput("sftp session not found".to_string()))
    }
}

async fn copy_with_progress<R, W>(
    mut reader: R,
    mut writer: W,
    app: &AppHandle,
    transfer: SftpTransferInfo,
) -> AppResult<u64>
where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
{
    let mut buffer = vec![0; 64 * 1024];
    let mut bytes_transferred = 0;

    loop {
        let bytes_read = reader.read(&mut buffer).await?;
        if bytes_read == 0 {
            break;
        }

        writer.write_all(&buffer[..bytes_read]).await?;
        bytes_transferred += bytes_read as u64;
        emit_transfer(
            app,
            &SftpTransferInfo {
                bytes_transferred,
                status: "running".to_string(),
                ..transfer.clone()
            },
        );
    }

    writer.flush().await?;
    writer.shutdown().await?;

    Ok(bytes_transferred)
}

fn finish_transfer(
    app: &AppHandle,
    result: AppResult<u64>,
    transfer: SftpTransferInfo,
) -> AppResult<SftpTransferInfo> {
    match result {
        Ok(bytes_transferred) => {
            let completed = SftpTransferInfo {
                bytes_transferred,
                status: "completed".to_string(),
                ..transfer
            };
            emit_transfer(app, &completed);
            Ok(completed)
        }
        Err(error) => {
            let failed = SftpTransferInfo {
                status: "error".to_string(),
                message: Some(error.to_string()),
                ..transfer
            };
            emit_transfer(app, &failed);
            Err(error)
        }
    }
}

fn new_transfer_info(
    session_id: &str,
    direction: &str,
    source_path: String,
    destination_path: String,
    bytes_total: Option<u64>,
) -> SftpTransferInfo {
    SftpTransferInfo {
        transfer_id: Uuid::new_v4().to_string(),
        session_id: session_id.to_string(),
        direction: direction.to_string(),
        source_path,
        destination_path,
        bytes_transferred: 0,
        bytes_total,
        status: "running".to_string(),
        message: None,
    }
}

fn remote_entry_from_dir_entry(entry: DirEntry) -> RemoteFileEntry {
    let metadata = entry.metadata();
    RemoteFileEntry {
        name: entry.file_name(),
        path: entry.path(),
        kind: file_kind(metadata.file_type()),
        size: metadata.size,
        permissions: metadata.permissions,
        modified_at: unix_timestamp_to_rfc3339(metadata.mtime),
        accessed_at: unix_timestamp_to_rfc3339(metadata.atime),
        user: metadata.user,
        group: metadata.group,
        uid: metadata.uid,
        gid: metadata.gid,
    }
}

fn remote_entry_from_metadata(path: &str, metadata: FileAttributes) -> RemoteFileEntry {
    RemoteFileEntry {
        name: remote_name(path),
        path: path.to_string(),
        kind: file_kind(metadata.file_type()),
        size: metadata.size,
        permissions: metadata.permissions,
        modified_at: unix_timestamp_to_rfc3339(metadata.mtime),
        accessed_at: unix_timestamp_to_rfc3339(metadata.atime),
        user: metadata.user,
        group: metadata.group,
        uid: metadata.uid,
        gid: metadata.gid,
    }
}

fn file_kind(file_type: FileType) -> String {
    match file_type {
        FileType::Dir => "directory",
        FileType::File => "file",
        FileType::Symlink => "symlink",
        FileType::Other => "other",
    }
    .to_string()
}

fn remote_name(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    if trimmed.is_empty() {
        return "/".to_string();
    }

    trimmed
        .rsplit('/')
        .next()
        .filter(|name| !name.is_empty())
        .unwrap_or(trimmed)
        .to_string()
}

fn unix_timestamp_to_rfc3339(timestamp: Option<u32>) -> Option<String> {
    timestamp.map(|seconds| {
        let datetime =
            DateTime::<Utc>::from(std::time::UNIX_EPOCH + Duration::from_secs(seconds as u64));
        datetime.to_rfc3339()
    })
}

fn emit_status(app: &AppHandle, session_id: &str, status: &str, message: Option<&str>) {
    let payload = SftpStatusEvent {
        session_id: session_id.to_string(),
        status: status.to_string(),
        message: message.map(str::to_string),
    };
    let _ = app.emit("sftp-status", payload);
}

fn emit_transfer(app: &AppHandle, payload: &SftpTransferInfo) {
    let _ = app.emit("sftp-transfer", payload.clone());
}
