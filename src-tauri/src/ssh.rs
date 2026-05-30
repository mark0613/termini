use std::{collections::HashMap, sync::Arc, time::Duration};

use russh::{client, ChannelMsg, ChannelWriteHalf, Disconnect};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{SshOutputEvent, SshProfile, SshSessionInfo, SshStatusEvent},
};

#[derive(Default)]
pub struct SshManager {
    sessions: Arc<Mutex<HashMap<String, ManagedSshSession>>>,
}

struct ManagedSshSession {
    credential_id: String,
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
        profile: SshProfile,
        password: String,
        cols: u32,
        rows: u32,
    ) -> AppResult<SshSessionInfo> {
        let credential_id = profile.credential_id.clone().ok_or_else(|| {
            AppError::InvalidInput("profile does not have a credential".to_string())
        })?;
        let session_id = Uuid::new_v4().to_string();

        emit_status(
            &app,
            &session_id,
            "connecting",
            Some("Connecting to SSH host"),
        );

        let config = client::Config {
            inactivity_timeout: Some(Duration::from_secs(30)),
            keepalive_interval: Some(Duration::from_secs(30)),
            ..<_>::default()
        };
        let mut handle = client::connect(
            Arc::new(config),
            (profile.host.clone(), profile.port),
            ClientHandler,
        )
        .await?;

        let auth = handle
            .authenticate_password(profile.username.clone(), password)
            .await?;
        if !auth.success() {
            return Err(AppError::Ssh("password authentication failed".to_string()));
        }

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

    pub async fn credential_id(&self, session_id: &str) -> AppResult<String> {
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

fn emit_status(app: &AppHandle, session_id: &str, status: &str, message: Option<&str>) {
    let payload = SshStatusEvent {
        session_id: session_id.to_string(),
        status: status.to_string(),
        message: message.map(str::to_string),
    };
    let _ = app.emit("ssh-status", payload);
}
