import { invoke } from "@tauri-apps/api/core";
import type {
  Credential,
  ImportVaultResult,
  SshSessionInfo,
  SshProfile,
  TerminalTheme,
  Vault,
} from "./types";

export function listVaults() {
  return invoke<Vault[]>("list_vaults");
}

export function createVault(name: string) {
  return invoke<Vault>("create_vault", { input: { name } });
}

export function updateVault(id: string, name: string) {
  return invoke<Vault>("update_vault", { input: { id, name } });
}

export function deleteVault(id: string) {
  return invoke<void>("delete_vault", { id });
}

export function listCredentials(vaultId: string) {
  return invoke<Credential[]>("list_credentials", { vaultId });
}

export function createCredential(input: {
  vaultId: string;
  label: string;
  username: string;
  password: string;
}) {
  return invoke<Credential>("create_credential", { input });
}

export function updateCredential(input: {
  id: string;
  label: string;
  username: string;
  password?: string;
}) {
  return invoke<Credential>("update_credential", { input });
}

export function deleteCredential(id: string) {
  return invoke<void>("delete_credential", { id });
}

export function listProfiles(vaultId: string) {
  return invoke<SshProfile[]>("list_profiles", { vaultId });
}

export function createProfile(input: {
  vaultId: string;
  credentialId: string | null;
  name: string;
  host: string;
  port: number;
  username: string;
}) {
  return invoke<SshProfile>("create_profile", { input });
}

export function updateProfile(input: {
  id: string;
  credentialId: string | null;
  name: string;
  host: string;
  port: number;
  username: string;
}) {
  return invoke<SshProfile>("update_profile", { input });
}

export function deleteProfile(id: string) {
  return invoke<void>("delete_profile", { id });
}

export function exportVault(input: {
  vaultId: string;
  path: string;
  password: string;
}) {
  return invoke<void>("export_vault", { input });
}

export function importVault(input: { path: string; password: string }) {
  return invoke<ImportVaultResult>("import_vault", { input });
}

export function listTerminalThemes() {
  return invoke<TerminalTheme[]>("list_terminal_themes");
}

export function createTerminalTheme(input: {
  name: string;
  colorsJson: string;
}) {
  return invoke<TerminalTheme>("create_terminal_theme", { input });
}

export function activeTerminalThemeId() {
  return invoke<string | null>("active_terminal_theme_id");
}

export function setActiveTerminalThemeId(id: string) {
  return invoke<void>("set_active_terminal_theme_id", { input: { id } });
}

export function deleteTerminalTheme(id: string) {
  return invoke<void>("delete_terminal_theme", { id });
}

export function connectSsh(input: {
  sessionId: string;
  profileId: string;
  cols: number;
  rows: number;
}) {
  return invoke<SshSessionInfo>("connect_ssh", { input });
}

export function writeSsh(input: { sessionId: string; data: string }) {
  return invoke<void>("write_ssh", { input });
}

export function resizeSsh(input: {
  sessionId: string;
  cols: number;
  rows: number;
}) {
  return invoke<void>("resize_ssh", { input });
}

export function disconnectSsh(sessionId: string) {
  return invoke<void>("disconnect_ssh", { input: { sessionId } });
}

export function sendProfilePassword(sessionId: string) {
  return invoke<void>("send_profile_password", { input: { sessionId } });
}
