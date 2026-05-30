use std::path::PathBuf;

use crate::{error::AppResult, storage::Storage};

pub struct AppState {
    pub storage: Storage,
}

impl AppState {
    pub fn new(app_data_dir: PathBuf) -> AppResult<Self> {
        Ok(Self {
            storage: Storage::new(app_data_dir)?,
        })
    }
}
