import type { SshProfile } from "./types";

export type AppPage = "vaults" | "session" | "settings";
export type SettingsSection = "data" | "shortcuts" | "preferences" | "about";

export interface ProfileFormState {
  name: string;
  host: string;
  port: string;
  username: string;
  password: string;
  credentialId: string;
  sshKeyPath: string;
}

export const emptyProfileForm: ProfileFormState = {
  name: "",
  host: "",
  port: "22",
  username: "",
  password: "",
  credentialId: "",
  sshKeyPath: "",
};

export function toProfileForm(profile: SshProfile): ProfileFormState {
  return {
    name: profile.name,
    host: profile.host,
    port: String(profile.port),
    username: profile.username,
    password: "",
    credentialId: profile.credentialId ?? "",
    sshKeyPath: profile.sshKeyPath ?? "",
  };
}
