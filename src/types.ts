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
  group: string | null;
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

export interface SftpSessionInfo {
  sessionId: string;
  profileId: string;
  credentialId: string | null;
  homePath: string;
}

export type RemoteFileKind = "directory" | "file" | "symlink" | "other";

export interface RemoteFileEntry {
  name: string;
  path: string;
  kind: RemoteFileKind;
  size: number | null;
  permissions: number | null;
  modifiedAt: string | null;
  accessedAt: string | null;
  user: string | null;
  group: string | null;
  uid: number | null;
  gid: number | null;
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

export interface SftpStatusEvent {
  sessionId: string;
  status: string;
  message: string | null;
}

export type SftpTransferDirection = "upload" | "download";
export type SftpTransferStatus = "running" | "completed" | "error";

export interface SftpTransferInfo {
  transferId: string;
  sessionId: string;
  direction: SftpTransferDirection;
  sourcePath: string;
  destinationPath: string;
  bytesTransferred: number;
  bytesTotal: number | null;
  status: SftpTransferStatus;
  message: string | null;
}
