use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("keychain error: {0}")]
    Keychain(#[from] keyring::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("base64 error: {0}")]
    Base64(#[from] base64::DecodeError),
    #[error("encryption error")]
    Encryption,
    #[error("invalid export password or corrupted export file")]
    Decryption,
    #[error("argon2 error: {0}")]
    Argon2(String),
    #[error("vault not found")]
    VaultNotFound,
    #[error("credential not found")]
    CredentialNotFound,
    #[error("{0}")]
    InvalidInput(String),
}

pub fn command_result<T>(result: AppResult<T>) -> Result<T, String> {
    result.map_err(|error| error.to_string())
}

impl From<argon2::Error> for AppError {
    fn from(error: argon2::Error) -> Self {
        Self::Argon2(error.to_string())
    }
}
