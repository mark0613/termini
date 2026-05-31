use std::path::PathBuf;

use crate::{error::AppResult, ssh::SshManager, storage::Storage};

pub struct AppState {
    pub storage: Storage,
    pub ssh: SshManager,
}

impl AppState {
    pub fn new(app_data_dir: PathBuf, legacy_app_data_dir: Option<PathBuf>) -> AppResult<Self> {
        Ok(Self {
            storage: Storage::new(app_data_dir, legacy_app_data_dir)?,
            ssh: SshManager::default(),
        })
    }
}
