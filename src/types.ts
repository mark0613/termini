export interface Vault {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Credential {
  id: string;
  vaultId: string;
  label: string;
  username: string;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SshProfile {
  id: string;
  vaultId: string;
  credentialId: string | null;
  name: string;
  host: string;
  port: number;
  username: string;
  sshKeyPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportVaultResult {
  vault: Vault;
  credentialsImported: number;
  profilesImported: number;
}

export interface TerminalTheme {
  id: string;
  name: string;
  colorsJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface SshSessionInfo {
  sessionId: string;
  profileId: string;
  credentialId: string | null;
}

export interface SshOutputEvent {
  sessionId: string;
  data: string;
}

export interface SshStatusEvent {
  sessionId: string;
  status: string;
  message: string | null;
}
