use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    XChaCha20Poly1305, XNonce,
};

use crate::{
    error::{AppError, AppResult},
    models::{ExportFile, ExportPayload},
};

const EXPORT_VERSION: u8 = 1;
const SALT_LEN: usize = 16;

pub fn encrypt_export_payload(payload: &ExportPayload, password: &str) -> AppResult<ExportFile> {
    let salt = XChaCha20Poly1305::generate_nonce(&mut OsRng);
    let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
    let key = derive_key(password, &salt[..SALT_LEN])?;
    let cipher = XChaCha20Poly1305::new_from_slice(&key).map_err(|_| AppError::Encryption)?;
    let plaintext = serde_json::to_vec(payload)?;
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_ref())
        .map_err(|_| AppError::Encryption)?;

    Ok(ExportFile {
        version: EXPORT_VERSION,
        kdf: "argon2id".to_string(),
        cipher: "xchacha20poly1305".to_string(),
        salt: STANDARD.encode(&salt[..SALT_LEN]),
        nonce: STANDARD.encode(nonce),
        ciphertext: STANDARD.encode(ciphertext),
    })
}

pub fn decrypt_export_payload(file: &ExportFile, password: &str) -> AppResult<ExportPayload> {
    if file.version != EXPORT_VERSION
        || file.kdf != "argon2id"
        || file.cipher != "xchacha20poly1305"
    {
        return Err(AppError::InvalidInput(
            "unsupported export file format".to_string(),
        ));
    }

    let salt = STANDARD.decode(&file.salt)?;
    let nonce = STANDARD.decode(&file.nonce)?;
    let ciphertext = STANDARD.decode(&file.ciphertext)?;

    if nonce.len() != 24 {
        return Err(AppError::Decryption);
    }

    let key = derive_key(password, &salt)?;
    let cipher = XChaCha20Poly1305::new_from_slice(&key).map_err(|_| AppError::Decryption)?;
    let plaintext = cipher
        .decrypt(XNonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| AppError::Decryption)?;

    Ok(serde_json::from_slice(&plaintext)?)
}

fn derive_key(password: &str, salt: &[u8]) -> AppResult<[u8; 32]> {
    let params = Params::new(19 * 1024, 2, 1, Some(32))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; 32];
    argon2.hash_password_into(password.as_bytes(), salt, &mut key)?;
    Ok(key)
}
