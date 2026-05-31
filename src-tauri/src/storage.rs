use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::{
    crypto::{decrypt_export_payload, encrypt_export_payload},
    error::{AppError, AppResult},
    models::{
        Credential, ExportCredential, ExportFile, ExportPayload, ExportProfile,
        ExportTerminalTheme, ExportVault, ImportVaultResult, SshProfile, TerminalTheme, Vault,
    },
    secrets,
};

const DEFAULT_TERMINAL_THEME_ID: &str = "termini-default";
const ACTIVE_TERMINAL_THEME_KEY: &str = "active_terminal_theme_id";

pub struct Storage {
    conn: Mutex<Connection>,
}

impl Storage {
    pub fn new(app_data_dir: PathBuf, legacy_app_data_dir: Option<PathBuf>) -> AppResult<Self> {
        fs::create_dir_all(&app_data_dir)?;
        let db_path = app_data_dir.join("termini.sqlite3");
        migrate_database_path(&db_path, legacy_app_data_dir.as_deref())?;
        let conn = Connection::open(db_path)?;
        let storage = Self {
            conn: Mutex::new(conn),
        };
        storage.migrate()?;
        storage.ensure_default_vault()?;
        Ok(storage)
    }

    pub fn list_vaults(&self) -> AppResult<Vec<Vault>> {
        let conn = self.conn.lock().expect("storage mutex poisoned");
        let mut stmt =
            conn.prepare("SELECT id, name, created_at, updated_at FROM vaults ORDER BY name")?;
        let rows = stmt.query_map([], map_vault)?;
        collect_rows(rows)
    }

    pub fn create_vault(&self, name: String) -> AppResult<Vault> {
        let name = clean_required(name, "vault name")?;
        let id = Uuid::new_v4().to_string();
        let now = now();
        let conn = self.conn.lock().expect("storage mutex poisoned");

        conn.execute(
            "INSERT INTO vaults (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, name, now, now],
        )?;

        self.get_vault_locked(&conn, &id)
    }

    pub fn update_vault(&self, id: String, name: String) -> AppResult<Vault> {
        let name = clean_required(name, "vault name")?;
        let updated_at = now();
        let conn = self.conn.lock().expect("storage mutex poisoned");

        conn.execute(
            "UPDATE vaults SET name = ?1, updated_at = ?2 WHERE id = ?3",
            params![name, updated_at, id],
        )?;

        self.get_vault_locked(&conn, &id)
    }

    pub fn delete_vault(&self, id: String) -> AppResult<()> {
        let credentials = self.list_credentials(&id)?;
        for credential in credentials {
            secrets::delete_password(&credential.id)?;
        }

        let conn = self.conn.lock().expect("storage mutex poisoned");
        conn.execute("DELETE FROM vaults WHERE id = ?1", params![id])?;
        drop(conn);
        self.ensure_default_vault()?;
        Ok(())
    }

    pub fn list_credentials(&self, vault_id: &str) -> AppResult<Vec<Credential>> {
        let conn = self.conn.lock().expect("storage mutex poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, vault_id, label, username, has_password, created_at, updated_at
             FROM credentials
             WHERE vault_id = ?1
             ORDER BY label",
        )?;
        let rows = stmt.query_map(params![vault_id], map_credential)?;
        collect_rows(rows)
    }

    pub fn create_credential(
        &self,
        vault_id: String,
        label: String,
        username: String,
        password: String,
    ) -> AppResult<Credential> {
        self.ensure_vault_exists(&vault_id)?;
        let label = clean_required(label, "credential label")?;
        let username = clean_required(username, "credential username")?;
        let password = clean_required(password, "credential password")?;
        let id = Uuid::new_v4().to_string();
        let now = now();
        let conn = self.conn.lock().expect("storage mutex poisoned");

        conn.execute(
            "INSERT INTO credentials
             (id, vault_id, label, username, has_password, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)",
            params![id, vault_id, label, username, now, now],
        )?;
        drop(conn);

        if let Err(error) = secrets::set_password(&id, &password) {
            let conn = self.conn.lock().expect("storage mutex poisoned");
            let _ = conn.execute("DELETE FROM credentials WHERE id = ?1", params![id]);
            return Err(error);
        }

        self.get_credential(&id)
    }

    pub fn update_credential(
        &self,
        id: String,
        label: String,
        username: String,
        password: Option<String>,
    ) -> AppResult<Credential> {
        let label = clean_required(label, "credential label")?;
        let username = clean_required(username, "credential username")?;
        let has_new_password = password.is_some();
        let updated_at = now();
        let conn = self.conn.lock().expect("storage mutex poisoned");

        conn.execute(
            "UPDATE credentials
             SET label = ?1, username = ?2, has_password = CASE WHEN ?3 = 1 THEN 1 ELSE has_password END, updated_at = ?4
             WHERE id = ?5",
            params![label, username, i64::from(has_new_password), updated_at, id],
        )?;
        drop(conn);

        if let Some(password) = password {
            let password = clean_required(password, "credential password")?;
            secrets::set_password(&id, &password)?;
        }

        self.get_credential(&id)
    }

    pub fn delete_credential(&self, id: String) -> AppResult<()> {
        secrets::delete_password(&id)?;
        let conn = self.conn.lock().expect("storage mutex poisoned");
        conn.execute(
            "UPDATE profiles SET credential_id = NULL WHERE credential_id = ?1",
            params![id],
        )?;
        conn.execute("DELETE FROM credentials WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_password(&self, credential_id: &str) -> AppResult<String> {
        self.get_credential(credential_id)?;
        secrets::get_password(credential_id)
    }

    pub fn list_profiles(&self, vault_id: &str) -> AppResult<Vec<SshProfile>> {
        let conn = self.conn.lock().expect("storage mutex poisoned");
        let mut stmt = conn.prepare(
            "SELECT id, vault_id, credential_id, name, host, port, username, created_at, updated_at
             FROM profiles
             WHERE vault_id = ?1
             ORDER BY name",
        )?;
        let rows = stmt.query_map(params![vault_id], map_profile)?;
        collect_rows(rows)
    }

    pub fn create_profile(
        &self,
        vault_id: String,
        credential_id: Option<String>,
        name: String,
        host: String,
        port: u16,
        username: String,
    ) -> AppResult<SshProfile> {
        self.ensure_vault_exists(&vault_id)?;
        self.ensure_credential_in_vault(credential_id.as_deref(), &vault_id)?;
        let name = clean_required(name, "profile name")?;
        let host = clean_required(host, "host")?;
        let username = clean_required(username, "username")?;
        let id = Uuid::new_v4().to_string();
        let now = now();
        let conn = self.conn.lock().expect("storage mutex poisoned");

        conn.execute(
            "INSERT INTO profiles
             (id, vault_id, credential_id, name, host, port, username, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                vault_id,
                credential_id,
                name,
                host,
                i64::from(port),
                username,
                now,
                now
            ],
        )?;

        self.get_profile_locked(&conn, &id)
    }

    pub fn update_profile(
        &self,
        id: String,
        credential_id: Option<String>,
        name: String,
        host: String,
        port: u16,
        username: String,
    ) -> AppResult<SshProfile> {
        let existing = self.get_profile(&id)?;
        self.ensure_credential_in_vault(credential_id.as_deref(), &existing.vault_id)?;
        let name = clean_required(name, "profile name")?;
        let host = clean_required(host, "host")?;
        let username = clean_required(username, "username")?;
        let updated_at = now();
        let conn = self.conn.lock().expect("storage mutex poisoned");

        conn.execute(
            "UPDATE profiles
             SET credential_id = ?1, name = ?2, host = ?3, port = ?4, username = ?5, updated_at = ?6
             WHERE id = ?7",
            params![
                credential_id,
                name,
                host,
                i64::from(port),
                username,
                updated_at,
                id
            ],
        )?;

        self.get_profile_locked(&conn, &id)
    }

    pub fn delete_profile(&self, id: String) -> AppResult<()> {
        let conn = self.conn.lock().expect("storage mutex poisoned");
        conn.execute("DELETE FROM profiles WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_profile(&self, id: &str) -> AppResult<SshProfile> {
        let conn = self.conn.lock().expect("storage mutex poisoned");
        self.get_profile_locked(&conn, id)
    }

    pub fn list_terminal_themes(&self) -> AppResult<Vec<TerminalTheme>> {
        let conn = self.conn.lock().expect("storage mutex poisoned");
        self.list_terminal_themes_locked(&conn)
    }

    pub fn create_terminal_theme(
        &self,
        name: String,
        colors_json: String,
    ) -> AppResult<TerminalTheme> {
        let name = clean_required(name, "theme name")?;
        let colors_json = clean_json_object(colors_json, "theme colors")?;
        let id = Uuid::new_v4().to_string();
        let now = now();
        let conn = self.conn.lock().expect("storage mutex poisoned");

        conn.execute(
            "INSERT INTO terminal_themes (id, name, colors_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, name, colors_json, now, now],
        )?;

        self.get_terminal_theme_locked(&conn, &id)
    }

    pub fn active_terminal_theme_id(&self) -> AppResult<Option<String>> {
        let conn = self.conn.lock().expect("storage mutex poisoned");
        self.get_setting_locked(&conn, ACTIVE_TERMINAL_THEME_KEY)
    }

    pub fn set_active_terminal_theme_id(&self, id: String) -> AppResult<()> {
        let id = clean_required(id, "theme id")?;
        let conn = self.conn.lock().expect("storage mutex poisoned");
        if id != DEFAULT_TERMINAL_THEME_ID {
            self.ensure_terminal_theme_exists_locked(&conn, &id)?;
        }

        self.set_setting_locked(&conn, ACTIVE_TERMINAL_THEME_KEY, &id)
    }

    pub fn delete_terminal_theme(&self, id: String) -> AppResult<()> {
        let id = clean_required(id, "theme id")?;
        if id == DEFAULT_TERMINAL_THEME_ID {
            return Err(AppError::InvalidInput(
                "default terminal theme cannot be deleted".to_string(),
            ));
        }

        let conn = self.conn.lock().expect("storage mutex poisoned");
        self.ensure_terminal_theme_exists_locked(&conn, &id)?;
        conn.execute("DELETE FROM terminal_themes WHERE id = ?1", params![id])?;

        if self
            .get_setting_locked(&conn, ACTIVE_TERMINAL_THEME_KEY)?
            .as_deref()
            == Some(id.as_str())
        {
            self.set_setting_locked(
                &conn,
                ACTIVE_TERMINAL_THEME_KEY,
                DEFAULT_TERMINAL_THEME_ID,
            )?;
        }

        Ok(())
    }

    pub fn export_vault(&self, vault_id: String, path: String, password: String) -> AppResult<()> {
        let password = clean_required(password, "export password")?;
        let conn = self.conn.lock().expect("storage mutex poisoned");
        let vault = self.get_vault_locked(&conn, &vault_id)?;
        let credentials = self.list_credentials_locked(&conn, &vault_id)?;
        let profiles = self.list_profiles_locked(&conn, &vault_id)?;
        let terminal_themes = self.list_terminal_themes_locked(&conn)?;
        let active_terminal_theme_id = self.get_setting_locked(&conn, ACTIVE_TERMINAL_THEME_KEY)?;
        drop(conn);

        let export_credentials = credentials
            .into_iter()
            .map(|credential| {
                let password = if credential.has_password {
                    secrets::get_password(&credential.id).ok()
                } else {
                    None
                };

                ExportCredential {
                    id: credential.id,
                    label: credential.label,
                    username: credential.username,
                    password,
                }
            })
            .collect();

        let payload = ExportPayload {
            version: 1,
            exported_at: now(),
            vault: ExportVault {
                id: vault.id,
                name: vault.name,
            },
            credentials: export_credentials,
            profiles: profiles
                .into_iter()
                .map(|profile| ExportProfile {
                    id: profile.id,
                    credential_id: profile.credential_id,
                    name: profile.name,
                    host: profile.host,
                    port: profile.port,
                    username: profile.username,
                })
                .collect(),
            terminal_themes: terminal_themes
                .into_iter()
                .map(|theme| ExportTerminalTheme {
                    id: theme.id,
                    name: theme.name,
                    colors_json: theme.colors_json,
                })
                .collect(),
            active_terminal_theme_id,
        };
        let export_file = encrypt_export_payload(&payload, &password)?;
        fs::write(path, serde_json::to_vec_pretty(&export_file)?)?;
        Ok(())
    }

    pub fn import_vault(&self, path: String, password: String) -> AppResult<ImportVaultResult> {
        let password = clean_required(password, "export password")?;
        let file = fs::read(path)?;
        let export_file: ExportFile = serde_json::from_slice(&file)?;
        let payload = decrypt_export_payload(&export_file, &password)?;
        let vault_id = Uuid::new_v4().to_string();
        let vault_name = unique_import_name(&payload.vault.name);
        let now = now();
        let mut credential_id_map = HashMap::new();
        let mut theme_id_map = HashMap::new();

        let conn = self.conn.lock().expect("storage mutex poisoned");
        conn.execute(
            "INSERT INTO vaults (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![vault_id, vault_name, now, now],
        )?;

        for credential in &payload.credentials {
            let new_id = Uuid::new_v4().to_string();
            credential_id_map.insert(credential.id.clone(), new_id.clone());
            conn.execute(
                "INSERT INTO credentials
                 (id, vault_id, label, username, has_password, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    new_id,
                    vault_id,
                    credential.label,
                    credential.username,
                    credential.password.is_some(),
                    now,
                    now
                ],
            )?;

            if let Some(password) = &credential.password {
                secrets::set_password(&new_id, password)?;
            }
        }

        for profile in &payload.profiles {
            let new_id = Uuid::new_v4().to_string();
            let credential_id = profile
                .credential_id
                .as_ref()
                .and_then(|id| credential_id_map.get(id))
                .cloned();

            conn.execute(
                "INSERT INTO profiles
                 (id, vault_id, credential_id, name, host, port, username, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    new_id,
                    vault_id,
                    credential_id,
                    profile.name,
                    profile.host,
                    i64::from(profile.port),
                    profile.username,
                    now,
                    now
                ],
            )?;
        }

        for theme in &payload.terminal_themes {
            let new_id = Uuid::new_v4().to_string();
            let colors_json = clean_json_object(theme.colors_json.clone(), "theme colors")?;
            theme_id_map.insert(theme.id.clone(), new_id.clone());
            conn.execute(
                "INSERT INTO terminal_themes (id, name, colors_json, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![new_id, theme.name, colors_json, now, now],
            )?;
        }

        if let Some(active_theme_id) = payload.active_terminal_theme_id {
            if active_theme_id == DEFAULT_TERMINAL_THEME_ID {
                self.set_setting_locked(
                    &conn,
                    ACTIVE_TERMINAL_THEME_KEY,
                    DEFAULT_TERMINAL_THEME_ID,
                )?;
            } else if let Some(new_id) = theme_id_map.get(&active_theme_id) {
                self.set_setting_locked(&conn, ACTIVE_TERMINAL_THEME_KEY, new_id)?;
            }
        }

        Ok(ImportVaultResult {
            vault: self.get_vault_locked(&conn, &vault_id)?,
            credentials_imported: payload.credentials.len(),
            profiles_imported: payload.profiles.len(),
        })
    }

    fn migrate(&self) -> AppResult<()> {
        let conn = self.conn.lock().expect("storage mutex poisoned");
        conn.execute_batch(
            "
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS vaults (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS credentials (
                id TEXT PRIMARY KEY,
                vault_id TEXT NOT NULL,
                label TEXT NOT NULL,
                username TEXT NOT NULL,
                has_password INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                vault_id TEXT NOT NULL,
                credential_id TEXT,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE,
                FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS terminal_themes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                colors_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            ",
        )?;
        Ok(())
    }

    fn ensure_default_vault(&self) -> AppResult<()> {
        let conn = self.conn.lock().expect("storage mutex poisoned");
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM vaults", [], |row| row.get(0))?;
        if count == 0 {
            let id = Uuid::new_v4().to_string();
            let now = now();
            conn.execute(
                "INSERT INTO vaults (id, name, created_at, updated_at) VALUES (?1, 'Personal', ?2, ?3)",
                params![id, now, now],
            )?;
        }
        Ok(())
    }

    fn ensure_vault_exists(&self, vault_id: &str) -> AppResult<()> {
        let conn = self.conn.lock().expect("storage mutex poisoned");
        let exists: Option<String> = conn
            .query_row(
                "SELECT id FROM vaults WHERE id = ?1",
                params![vault_id],
                |row| row.get(0),
            )
            .optional()?;

        exists.map(|_| ()).ok_or(AppError::VaultNotFound)
    }

    fn ensure_credential_in_vault(
        &self,
        credential_id: Option<&str>,
        vault_id: &str,
    ) -> AppResult<()> {
        let Some(credential_id) = credential_id else {
            return Ok(());
        };

        let conn = self.conn.lock().expect("storage mutex poisoned");
        let exists: Option<String> = conn
            .query_row(
                "SELECT id FROM credentials WHERE id = ?1 AND vault_id = ?2",
                params![credential_id, vault_id],
                |row| row.get(0),
            )
            .optional()?;

        exists.map(|_| ()).ok_or(AppError::CredentialNotFound)
    }

    fn get_vault_locked(&self, conn: &Connection, id: &str) -> AppResult<Vault> {
        conn.query_row(
            "SELECT id, name, created_at, updated_at FROM vaults WHERE id = ?1",
            params![id],
            map_vault,
        )
        .optional()?
        .ok_or(AppError::VaultNotFound)
    }

    fn get_credential(&self, id: &str) -> AppResult<Credential> {
        let conn = self.conn.lock().expect("storage mutex poisoned");
        conn.query_row(
            "SELECT id, vault_id, label, username, has_password, created_at, updated_at
             FROM credentials
             WHERE id = ?1",
            params![id],
            map_credential,
        )
        .optional()?
        .ok_or(AppError::CredentialNotFound)
    }

    fn get_profile_locked(&self, conn: &Connection, id: &str) -> AppResult<SshProfile> {
        conn.query_row(
            "SELECT id, vault_id, credential_id, name, host, port, username, created_at, updated_at
             FROM profiles
             WHERE id = ?1",
            params![id],
            map_profile,
        )
        .optional()?
        .ok_or_else(|| AppError::InvalidInput("profile not found".to_string()))
    }

    fn list_credentials_locked(
        &self,
        conn: &Connection,
        vault_id: &str,
    ) -> AppResult<Vec<Credential>> {
        let mut stmt = conn.prepare(
            "SELECT id, vault_id, label, username, has_password, created_at, updated_at
             FROM credentials
             WHERE vault_id = ?1
             ORDER BY label",
        )?;
        let rows = stmt.query_map(params![vault_id], map_credential)?;
        collect_rows(rows)
    }

    fn list_profiles_locked(
        &self,
        conn: &Connection,
        vault_id: &str,
    ) -> AppResult<Vec<SshProfile>> {
        let mut stmt = conn.prepare(
            "SELECT id, vault_id, credential_id, name, host, port, username, created_at, updated_at
             FROM profiles
             WHERE vault_id = ?1
             ORDER BY name",
        )?;
        let rows = stmt.query_map(params![vault_id], map_profile)?;
        collect_rows(rows)
    }

    fn list_terminal_themes_locked(&self, conn: &Connection) -> AppResult<Vec<TerminalTheme>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, colors_json, created_at, updated_at
             FROM terminal_themes
             ORDER BY name",
        )?;
        let rows = stmt.query_map([], map_terminal_theme)?;
        collect_rows(rows)
    }

    fn get_terminal_theme_locked(&self, conn: &Connection, id: &str) -> AppResult<TerminalTheme> {
        conn.query_row(
            "SELECT id, name, colors_json, created_at, updated_at
             FROM terminal_themes
             WHERE id = ?1",
            params![id],
            map_terminal_theme,
        )
        .optional()?
        .ok_or_else(|| AppError::InvalidInput("terminal theme not found".to_string()))
    }

    fn ensure_terminal_theme_exists_locked(&self, conn: &Connection, id: &str) -> AppResult<()> {
        let exists: Option<String> = conn
            .query_row(
                "SELECT id FROM terminal_themes WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .optional()?;

        exists
            .map(|_| ())
            .ok_or_else(|| AppError::InvalidInput("terminal theme not found".to_string()))
    }

    fn get_setting_locked(&self, conn: &Connection, key: &str) -> AppResult<Option<String>> {
        conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(AppError::from)
    }

    fn set_setting_locked(&self, conn: &Connection, key: &str, value: &str) -> AppResult<()> {
        conn.execute(
            "INSERT INTO app_settings (key, value)
             VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }
}

fn map_vault(row: &Row<'_>) -> rusqlite::Result<Vault> {
    Ok(Vault {
        id: row.get(0)?,
        name: row.get(1)?,
        created_at: row.get(2)?,
        updated_at: row.get(3)?,
    })
}

fn map_credential(row: &Row<'_>) -> rusqlite::Result<Credential> {
    let has_password: bool = row.get::<_, i64>(4)? == 1;
    Ok(Credential {
        id: row.get(0)?,
        vault_id: row.get(1)?,
        label: row.get(2)?,
        username: row.get(3)?,
        has_password,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn map_profile(row: &Row<'_>) -> rusqlite::Result<SshProfile> {
    let port = row.get::<_, i64>(5)?;
    Ok(SshProfile {
        id: row.get(0)?,
        vault_id: row.get(1)?,
        credential_id: row.get(2)?,
        name: row.get(3)?,
        host: row.get(4)?,
        port: u16::try_from(port).unwrap_or(22),
        username: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

fn map_terminal_theme(row: &Row<'_>) -> rusqlite::Result<TerminalTheme> {
    Ok(TerminalTheme {
        id: row.get(0)?,
        name: row.get(1)?,
        colors_json: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn collect_rows<T>(rows: impl Iterator<Item = rusqlite::Result<T>>) -> AppResult<Vec<T>> {
    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }
    Ok(items)
}

fn clean_required(value: String, field_name: &str) -> AppResult<String> {
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(AppError::InvalidInput(format!("{field_name} is required")));
    }
    Ok(value)
}

fn clean_json_object(value: String, field_name: &str) -> AppResult<String> {
    let value = clean_required(value, field_name)?;
    let json: serde_json::Value = serde_json::from_str(&value)?;
    if !json.is_object() {
        return Err(AppError::InvalidInput(format!("{field_name} must be a JSON object")));
    }
    Ok(value)
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn unique_import_name(name: &str) -> String {
    format!("{name} (Imported)")
}

fn migrate_database_path(db_path: &Path, legacy_app_data_dir: Option<&Path>) -> AppResult<()> {
    if db_path.exists() {
        return Ok(());
    }

    let Some(legacy_app_data_dir) = legacy_app_data_dir else {
        return Ok(());
    };
    let legacy_db_path = legacy_app_data_dir.join("termini.sqlite3");
    if !legacy_db_path.exists() || legacy_db_path == db_path {
        return Ok(());
    }

    if fs::rename(&legacy_db_path, db_path).is_err() {
        fs::copy(&legacy_db_path, db_path)?;
    }
    Ok(())
}
