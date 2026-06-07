use std::{
    env,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use russh::{
    client,
    keys::{load_secret_key, PrivateKeyWithHashAlg},
};

use crate::{
    error::{AppError, AppResult},
    models::SshProfile,
};

pub struct ClientHandler;

impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh::keys::ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

pub async fn connect_profile(
    profile: &SshProfile,
    password: Option<&str>,
) -> AppResult<client::Handle<ClientHandler>> {
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

    authenticate_profile(&mut handle, profile, password).await?;

    Ok(handle)
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
