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
  createdAt: string;
  updatedAt: string;
}

export interface ImportVaultResult {
  vault: Vault;
  credentialsImported: number;
  profilesImported: number;
}
