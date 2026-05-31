import type { SshProfile } from "./types";

export type AppPage = "vaults" | "session" | "settings";
export type VaultSection = "hosts";
export type SettingsSection = "data" | "shortcuts" | "terminal" | "about";

export interface ProfileFormState {
  name: string;
  host: string;
  port: string;
  username: string;
  password: string;
  credentialId: string;
}

export const emptyProfileForm: ProfileFormState = {
  name: "",
  host: "",
  port: "22",
  username: "",
  password: "",
  credentialId: "",
};

export function toProfileForm(profile: SshProfile): ProfileFormState {
  return {
    name: profile.name,
    host: profile.host,
    port: String(profile.port),
    username: profile.username,
    password: "",
    credentialId: profile.credentialId ?? "",
  };
}
