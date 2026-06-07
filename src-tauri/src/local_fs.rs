use std::{
    env,
    path::{Path, PathBuf},
    time::SystemTime,
};

use chrono::{DateTime, Utc};
use tokio::fs;

use crate::{
    error::{AppError, AppResult},
    models::RemoteFileEntry,
};

pub async fn read_dir(path: String) -> AppResult<Vec<RemoteFileEntry>> {
    let path = normalize_local_path(path)?;
    let mut reader = fs::read_dir(&path).await?;
    let mut entries = Vec::new();

    while let Some(entry) = reader.next_entry().await? {
        let metadata = entry.metadata().await?;
        let file_type = entry.file_type().await?;
        entries.push(local_entry_from_metadata(entry.path(), metadata, file_type));
    }

    entries.sort_by(|a, b| {
        b.kind
            .eq("directory")
            .cmp(&a.kind.eq("directory"))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

pub async fn create_dir(path: String) -> AppResult<()> {
    fs::create_dir(normalize_local_path(path)?).await?;
    Ok(())
}

pub async fn rename(old_path: String, new_path: String) -> AppResult<()> {
    fs::rename(normalize_local_path(old_path)?, normalize_local_path(new_path)?).await?;
    Ok(())
}

pub async fn delete_file(path: String) -> AppResult<()> {
    fs::remove_file(normalize_local_path(path)?).await?;
    Ok(())
}

pub async fn delete_dir(path: String) -> AppResult<()> {
    fs::remove_dir(normalize_local_path(path)?).await?;
    Ok(())
}

fn normalize_local_path(path: String) -> AppResult<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput("local path is required".to_string()));
    }

    if trimmed == "~" || trimmed.starts_with("~/") || trimmed.starts_with("~\\") {
        let home = home_dir().ok_or_else(|| {
            AppError::InvalidInput("could not resolve home directory".to_string())
        })?;
        let relative = trimmed
            .trim_start_matches('~')
            .trim_start_matches(|ch| ch == '/' || ch == '\\');
        return Ok(if relative.is_empty() {
            home
        } else {
            home.join(relative)
        });
    }

    Ok(PathBuf::from(trimmed))
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(PathBuf::from))
        .or_else(|| {
            let drive = env::var_os("HOMEDRIVE")?;
            let path = env::var_os("HOMEPATH")?;
            let mut home = PathBuf::from(drive);
            home.push(path);
            Some(home)
        })
}

fn local_entry_from_metadata(
    path: PathBuf,
    metadata: std::fs::Metadata,
    file_type: std::fs::FileType,
) -> RemoteFileEntry {
    RemoteFileEntry {
        name: local_name(&path),
        path: path.to_string_lossy().to_string(),
        kind: local_file_kind(file_type),
        size: if metadata.is_dir() {
            None
        } else {
            Some(metadata.len())
        },
        permissions: local_permissions(&metadata),
        modified_at: metadata.modified().ok().and_then(system_time_to_rfc3339),
        accessed_at: metadata.accessed().ok().and_then(system_time_to_rfc3339),
        user: None,
        group: None,
        uid: None,
        gid: None,
    }
}

fn local_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string())
}

fn local_file_kind(file_type: std::fs::FileType) -> String {
    if file_type.is_dir() {
        "directory"
    } else if file_type.is_file() {
        "file"
    } else if file_type.is_symlink() {
        "symlink"
    } else {
        "other"
    }
    .to_string()
}

#[cfg(unix)]
fn local_permissions(metadata: &std::fs::Metadata) -> Option<u32> {
    use std::os::unix::fs::PermissionsExt;

    Some(metadata.permissions().mode() & 0o777)
}

#[cfg(not(unix))]
fn local_permissions(_metadata: &std::fs::Metadata) -> Option<u32> {
    None
}

fn system_time_to_rfc3339(value: SystemTime) -> Option<String> {
    value
        .duration_since(SystemTime::UNIX_EPOCH)
        .ok()
        .map(|duration| DateTime::<Utc>::from(SystemTime::UNIX_EPOCH + duration).to_rfc3339())
}
