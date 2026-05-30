use keyring::Entry;

use crate::error::AppResult;

const SERVICE: &str = "com.user.termini";

fn entry(credential_id: &str) -> AppResult<Entry> {
    Ok(Entry::new(SERVICE, credential_id)?)
}

pub fn set_password(credential_id: &str, password: &str) -> AppResult<()> {
    entry(credential_id)?.set_password(password)?;
    Ok(())
}

pub fn get_password(credential_id: &str) -> AppResult<String> {
    Ok(entry(credential_id)?.get_password()?)
}

pub fn delete_password(credential_id: &str) -> AppResult<()> {
    match entry(credential_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.into()),
    }
}
