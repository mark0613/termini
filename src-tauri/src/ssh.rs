use std::{
    collections::HashMap,
    env,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use russh::{
    client,
    keys::{load_secret_key, PrivateKeyWithHashAlg},
    ChannelMsg, ChannelWriteHalf, Disconnect,
};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

use crate::{
    error::{AppError, AppResult},
    models::{SshOutputEvent, SshProfile, SshSessionInfo, SshStatusEvent},
};

#[derive(Default)]
pub struct SshManager {
    sessions: Arc<Mutex<HashMap<String, ManagedSshSession>>>,
}

struct ManagedSshSession {
    credential_id: Option<String>,
    writer: Arc<ChannelWriteHalf<client::Msg>>,
    handle: client::Handle<ClientHandler>,
}

struct ClientHandler;

impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

impl SshManager {
    pub async fn connect(
        &self,
        app: AppHandle,
        session_id: String,
        profile: SshProfile,
        password: Option<String>,
        cols: u32,
        rows: u32,
    ) -> AppResult<SshSessionInfo> {
        let credential_id = profile.credential_id.clone();

        emit_status(
            &app,
            &session_id,
            "connecting",
            Some("Connecting to SSH host"),
        );

        let config = client::Config {
            keepalive_interval: Some(Duration::from_secs(30)),
            ..<_>::default()
        };
        let mut handle = client::connect(
            Arc::new(config),
            (profile.host.clone(), profile.port),
            ClientHandler,
        )
        .await?;

        authenticate_profile(&mut handle, &profile, password.as_deref()).await?;

        let channel = handle.channel_open_session().await?;
        channel
            .request_pty(false, "xterm-256color", cols.max(1), rows.max(1), 0, 0, &[])
            .await?;
        channel.request_shell(true).await?;

        let (mut reader, writer) = channel.split();
        let writer = Arc::new(writer);

        self.sessions.lock().await.insert(
            session_id.clone(),
            ManagedSshSession {
                credential_id: credential_id.clone(),
                writer: Arc::clone(&writer),
                handle,
            },
        );

        let sessions = Arc::clone(&self.sessions);
        let reader_app = app.clone();
        let reader_session_id = session_id.clone();
        tauri::async_runtime::spawn(async move {
            emit_status(&reader_app, &reader_session_id, "connected", None);

            while let Some(message) = reader.wait().await {
                match message {
                    ChannelMsg::Data { data } | ChannelMsg::ExtendedData { data, .. } => {
                        let payload = SshOutputEvent {
                            session_id: reader_session_id.clone(),
                            data: String::from_utf8_lossy(&data).to_string(),
                        };
                        let _ = reader_app.emit("ssh-output", payload);
                    }
                    ChannelMsg::ExitStatus { exit_status } => {
                        emit_status(
                            &reader_app,
                            &reader_session_id,
                            "exited",
                            Some(&format!("Remote shell exited with status {exit_status}")),
                        );
                    }
                    ChannelMsg::Eof | ChannelMsg::Close => {
                        emit_status(&reader_app, &reader_session_id, "disconnected", None);
                        break;
                    }
                    _ => {}
                }
            }

            sessions.lock().await.remove(&reader_session_id);
            emit_status(&reader_app, &reader_session_id, "disconnected", None);
        });

        Ok(SshSessionInfo {
            session_id,
            profile_id: profile.id,
            credential_id,
        })
    }

    pub async fn write(&self, session_id: &str, data: String) -> AppResult<()> {
        let writer = self.get_writer(session_id).await?;
        writer.data_bytes(data.into_bytes()).await?;
        Ok(())
    }

    pub async fn resize(&self, session_id: &str, cols: u32, rows: u32) -> AppResult<()> {
        let writer = self.get_writer(session_id).await?;
        writer.window_change(cols.max(1), rows.max(1), 0, 0).await?;
        Ok(())
    }

    pub async fn disconnect(&self, session_id: &str) -> AppResult<()> {
        let session = self.sessions.lock().await.remove(session_id);
        if let Some(session) = session {
            session
                .handle
                .disconnect(Disconnect::ByApplication, "", "English")
                .await?;
        }
        Ok(())
    }

    pub async fn credential_id(&self, session_id: &str) -> AppResult<Option<String>> {
        self.sessions
            .lock()
            .await
            .get(session_id)
            .map(|session| session.credential_id.clone())
            .ok_or_else(|| AppError::InvalidInput("ssh session not found".to_string()))
    }

    async fn get_writer(&self, session_id: &str) -> AppResult<Arc<ChannelWriteHalf<client::Msg>>> {
        self.sessions
            .lock()
            .await
            .get(session_id)
            .map(|session| Arc::clone(&session.writer))
            .ok_or_else(|| AppError::InvalidInput("ssh session not found".to_string()))
    }
}

async fn authenticate_profile(
    handle: &mut client::Handle<ClientHandler>,
    profile: &SshProfile,
    password: Option<&str>,
) -> AppResult<()> {
    if let Some(key_path) = profile.ssh_key_path.as_deref() {
        match authenticate_key_path(handle, &profile.username, Path::new(key_path)).await {
            Ok(true) => return Ok(()),
            Ok(false) if password.is_some() => {}
            Ok(false) => {
                return Err(AppError::Ssh(format!(
                    "public key authentication failed for {}",
                    key_path
                )));
            }
            Err(error) if password.is_some() => {
                let _ = error;
            }
            Err(error) => return Err(error),
        }

        return authenticate_password(handle, &profile.username, password.unwrap()).await;
    }

    if let Some(password) = password {
        return authenticate_password(handle, &profile.username, password).await;
    }

    authenticate_default_keys(handle, &profile.username).await
}

async fn authenticate_password(
    handle: &mut client::Handle<ClientHandler>,
    username: &str,
    password: &str,
) -> AppResult<()> {
    let auth = handle
        .authenticate_password(username.to_string(), password.to_string())
        .await?;
    if auth.success() {
        return Ok(());
    }

    Err(AppError::Ssh("password authentication failed".to_string()))
}

async fn authenticate_default_keys(
    handle: &mut client::Handle<ClientHandler>,
    username: &str,
) -> AppResult<()> {
    let mut attempted = false;
    let mut last_error = None;

    for key_path in default_ssh_key_paths() {
        if !key_path.is_file() {
            continue;
        }

        attempted = true;
        match authenticate_key_path(handle, username, &key_path).await {
            Ok(true) => return Ok(()),
            Ok(false) => {
                last_error = Some(format!(
                    "public key authentication failed for {}",
                    key_path.display()
                ));
            }
            Err(error) => {
                last_error = Some(error.to_string());
            }
        }
    }

    if attempted {
        return Err(AppError::Ssh(last_error.unwrap_or_else(|| {
            "default SSH key authentication failed".to_string()
        })));
    }

    Err(AppError::InvalidInput(
        "profile does not have a saved password or usable SSH key".to_string(),
    ))
}

async fn authenticate_key_path(
    handle: &mut client::Handle<ClientHandler>,
    username: &str,
    key_path: &Path,
) -> AppResult<bool> {
    let key = load_secret_key(key_path, None).map_err(|error| {
        AppError::Ssh(format!(
            "failed to load SSH key {}: {error}",
            key_path.display()
        ))
    })?;
    let auth = handle
        .authenticate_publickey(
            username.to_string(),
            PrivateKeyWithHashAlg::new(
                Arc::new(key),
                handle.best_supported_rsa_hash().await?.flatten(),
            ),
        )
        .await?;

    Ok(auth.success())
}

fn default_ssh_key_paths() -> Vec<PathBuf> {
    let Some(home_dir) = home_dir() else {
        return Vec::new();
    };

    ["id_ed25519", "id_ecdsa", "id_rsa", "id_dsa"]
        .into_iter()
        .map(|name| home_dir.join(".ssh").join(name))
        .collect()
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn emit_status(app: &AppHandle, session_id: &str, status: &str, message: Option<&str>) {
    let payload = SshStatusEvent {
        session_id: session_id.to_string(),
        status: status.to_string(),
        message: message.map(str::to_string),
    };
    let _ = app.emit("ssh-status", payload);
}
