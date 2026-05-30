import { FormEvent, useEffect, useMemo, useState } from "react";
import * as api from "./api";
import type { Credential, SshProfile, Vault } from "./types";

interface CredentialFormState {
  label: string;
  username: string;
  password: string;
}

interface ProfileFormState {
  name: string;
  host: string;
  port: string;
  username: string;
  credentialId: string;
}

const emptyCredentialForm: CredentialFormState = {
  label: "",
  username: "",
  password: "",
};

const emptyProfileForm: ProfileFormState = {
  name: "",
  host: "",
  port: "22",
  username: "",
  credentialId: "",
};

function App() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [activeVaultId, setActiveVaultId] = useState("");
  const [vaultName, setVaultName] = useState("");
  const [newVaultName, setNewVaultName] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [profiles, setProfiles] = useState<SshProfile[]>([]);
  const [credentialForm, setCredentialForm] =
    useState<CredentialFormState>(emptyCredentialForm);
  const [editingCredentialId, setEditingCredentialId] = useState("");
  const [profileForm, setProfileForm] =
    useState<ProfileFormState>(emptyProfileForm);
  const [editingProfileId, setEditingProfileId] = useState("");
  const [exportPath, setExportPath] = useState("");
  const [exportPassword, setExportPassword] = useState("");
  const [importPath, setImportPath] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Ready");

  const activeVault = useMemo(
    () => vaults.find((vault) => vault.id === activeVaultId) ?? null,
    [activeVaultId, vaults],
  );

  useEffect(() => {
    void refreshVaults();
  }, []);

  useEffect(() => {
    if (!activeVaultId) {
      setCredentials([]);
      setProfiles([]);
      setVaultName("");
      return;
    }

    const vault = vaults.find((item) => item.id === activeVaultId);
    setVaultName(vault?.name ?? "");
    void refreshVaultData(activeVaultId);
  }, [activeVaultId, vaults]);

  async function runAction(action: () => Promise<void>) {
    setIsBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshVaults(preferredVaultId?: string) {
    const nextVaults = await api.listVaults();
    setVaults(nextVaults);
    const preferred = preferredVaultId
      ? nextVaults.find((vault) => vault.id === preferredVaultId)
      : null;
    const current = nextVaults.find((vault) => vault.id === activeVaultId);
    const nextActive = preferred ?? current ?? nextVaults[0];
    setActiveVaultId(nextActive?.id ?? "");
  }

  async function refreshVaultData(vaultId: string) {
    const [nextCredentials, nextProfiles] = await Promise.all([
      api.listCredentials(vaultId),
      api.listProfiles(vaultId),
    ]);
    setCredentials(nextCredentials);
    setProfiles(nextProfiles);
  }

  function selectCredential(credential: Credential) {
    setEditingCredentialId(credential.id);
    setCredentialForm({
      label: credential.label,
      username: credential.username,
      password: "",
    });
  }

  function selectProfile(profile: SshProfile) {
    setEditingProfileId(profile.id);
    setProfileForm({
      name: profile.name,
      host: profile.host,
      port: String(profile.port),
      username: profile.username,
      credentialId: profile.credentialId ?? "",
    });
  }

  async function handleCreateVault(event: FormEvent) {
    event.preventDefault();
    await runAction(async () => {
      const vault = await api.createVault(newVaultName);
      setNewVaultName("");
      setStatus(`Vault created: ${vault.name}`);
      await refreshVaults(vault.id);
    });
  }

  async function handleSaveVault(event: FormEvent) {
    event.preventDefault();
    if (!activeVault) return;
    await runAction(async () => {
      const vault = await api.updateVault(activeVault.id, vaultName);
      setStatus(`Vault renamed: ${vault.name}`);
      await refreshVaults(vault.id);
    });
  }

  async function handleDeleteVault() {
    if (!activeVault) return;
    await runAction(async () => {
      await api.deleteVault(activeVault.id);
      setStatus(`Vault deleted: ${activeVault.name}`);
      await refreshVaults();
    });
  }

  async function handleSaveCredential(event: FormEvent) {
    event.preventDefault();
    if (!activeVault) return;

    await runAction(async () => {
      if (editingCredentialId) {
        await api.updateCredential({
          id: editingCredentialId,
          label: credentialForm.label,
          username: credentialForm.username,
          password: credentialForm.password || undefined,
        });
        setStatus(`Credential updated: ${credentialForm.label}`);
      } else {
        await api.createCredential({
          vaultId: activeVault.id,
          label: credentialForm.label,
          username: credentialForm.username,
          password: credentialForm.password,
        });
        setStatus(`Credential created: ${credentialForm.label}`);
      }

      setCredentialForm(emptyCredentialForm);
      setEditingCredentialId("");
      await refreshVaultData(activeVault.id);
    });
  }

  async function handleDeleteCredential(id: string) {
    if (!activeVault) return;
    await runAction(async () => {
      await api.deleteCredential(id);
      setStatus("Credential deleted");
      await refreshVaultData(activeVault.id);
    });
  }

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!activeVault) return;

    const payload = {
      credentialId: profileForm.credentialId || null,
      name: profileForm.name,
      host: profileForm.host,
      port: Number(profileForm.port || 22),
      username: profileForm.username,
    };

    await runAction(async () => {
      if (editingProfileId) {
        await api.updateProfile({ id: editingProfileId, ...payload });
        setStatus(`Profile updated: ${profileForm.name}`);
      } else {
        await api.createProfile({ vaultId: activeVault.id, ...payload });
        setStatus(`Profile created: ${profileForm.name}`);
      }

      setProfileForm(emptyProfileForm);
      setEditingProfileId("");
      await refreshVaultData(activeVault.id);
    });
  }

  async function handleDeleteProfile(id: string) {
    if (!activeVault) return;
    await runAction(async () => {
      await api.deleteProfile(id);
      setStatus("Profile deleted");
      await refreshVaultData(activeVault.id);
    });
  }

  async function handleExportVault(event: FormEvent) {
    event.preventDefault();
    if (!activeVault) return;
    await runAction(async () => {
      await api.exportVault({
        vaultId: activeVault.id,
        path: exportPath,
        password: exportPassword,
      });
      setExportPassword("");
      setStatus(`Vault exported: ${exportPath}`);
    });
  }

  async function handleImportVault(event: FormEvent) {
    event.preventDefault();
    await runAction(async () => {
      const result = await api.importVault({
        path: importPath,
        password: importPassword,
      });
      setImportPassword("");
      setStatus(
        `Imported ${result.credentialsImported} credentials and ${result.profilesImported} profiles`,
      );
      await refreshVaults(result.vault.id);
    });
  }

  return (
    <main className="grid h-dvh w-full grid-cols-[300px_minmax(0,1fr)] overflow-hidden bg-[#11161c] text-[#e7edf3] max-[900px]:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col border-r border-[#25313c] bg-[#161d24]">
        <div className="flex min-h-[72px] items-center gap-3 border-b border-[#25313c] p-4">
          <span className="grid size-9 place-items-center rounded-lg bg-[#55c2a2] font-extrabold text-[#081117]">
            T
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg leading-6 font-semibold">Termini</h1>
            <p className="truncate text-xs leading-4 text-[#8fa1b2]">
              Local SSH vault
            </p>
          </div>
        </div>

        <section className="border-b border-[#25313c] p-3">
          <form className="flex gap-2" onSubmit={handleCreateVault}>
            <input
              className="min-w-0 flex-1 rounded-md border border-[#334353] bg-[#10161d] px-2.5 py-2 text-sm outline-none focus:border-[#55c2a2]"
              value={newVaultName}
              onChange={(event) => setNewVaultName(event.currentTarget.value)}
              placeholder="New vault"
            />
            <button
              type="submit"
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-md border border-[#334353] bg-[#1d2731] hover:bg-[#263442]"
              disabled={isBusy}
              aria-label="新增 vault"
            >
              +
            </button>
          </form>
        </section>

        <section className="flex min-h-0 flex-1 flex-col p-3">
          <h2 className="mb-2 text-xs font-bold tracking-normal text-[#8fa1b2] uppercase">
            Vaults
          </h2>
          <div className="grid gap-1 overflow-auto">
            {vaults.map((vault) => (
              <button
                key={vault.id}
                type="button"
                className={`min-h-9 cursor-pointer rounded-md border px-2.5 text-left text-sm ${
                  vault.id === activeVaultId
                    ? "border-[#2e6f5d] bg-[#1f3a34] text-[#d9e3ec]"
                    : "border-transparent text-[#8fa1b2] hover:bg-[#1d2731] hover:text-[#d9e3ec]"
                }`}
                onClick={() => setActiveVaultId(vault.id)}
              >
                <span className="block truncate">{vault.name}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="grid h-full min-w-0 grid-rows-[44px_minmax(0,1fr)_28px]">
        <header className="flex items-end gap-1 border-b border-[#25313c] bg-[#151b22] px-2 pt-1.5">
          <button
            type="button"
            className="h-9 min-w-36 max-w-64 cursor-pointer rounded-t-lg border border-b-0 border-[#25313c] bg-[#202b35] px-3 text-left text-sm"
          >
            <span className="block truncate">
              {activeVault?.name ?? "No vault"}
            </span>
          </button>
        </header>

        <section className="min-h-0 min-w-0 overflow-auto bg-[#0d1116] p-4">
          <div className="mx-auto grid max-w-[1280px] gap-4">
            {error ? (
              <div className="rounded-md border border-[#7f3333] bg-[#321b1b] px-3 py-2 text-sm text-[#ffc9c9]">
                {error}
              </div>
            ) : null}

            <section className="grid gap-4 rounded-lg border border-[#25313c] bg-[#151b22] p-4">
              <div className="flex flex-wrap items-end gap-3">
                <form className="flex min-w-72 flex-1 gap-2" onSubmit={handleSaveVault}>
                  <label className="grid min-w-0 flex-1 gap-1 text-xs text-[#8fa1b2]">
                    Vault name
                    <input
                      className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm text-[#e7edf3] outline-none focus:border-[#55c2a2]"
                      value={vaultName}
                      onChange={(event) => setVaultName(event.currentTarget.value)}
                      disabled={!activeVault || isBusy}
                    />
                  </label>
                  <button
                    type="submit"
                    className="h-10 rounded-md border border-[#334353] bg-[#1d2731] px-3 text-sm hover:bg-[#263442] disabled:opacity-50"
                    disabled={!activeVault || isBusy}
                  >
                    Save
                  </button>
                </form>
                <button
                  type="button"
                  className="h-10 rounded-md border border-[#553238] bg-[#2a171b] px-3 text-sm text-[#ffb8c0] hover:bg-[#3a1f25] disabled:opacity-50"
                  disabled={!activeVault || isBusy}
                  onClick={handleDeleteVault}
                >
                  Delete vault
                </button>
              </div>
            </section>

            <div className="grid grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.1fr)] gap-4 max-[1120px]:grid-cols-1">
              <section className="grid min-h-0 gap-4 rounded-lg border border-[#25313c] bg-[#151b22] p-4">
                <div>
                  <h2 className="text-sm font-semibold">Credentials</h2>
                  <p className="text-xs text-[#8fa1b2]">
                    密碼存在 OS keychain，這裡只顯示 metadata。
                  </p>
                </div>

                <div className="grid gap-2">
                  {credentials.map((credential) => (
                    <div
                      key={credential.id}
                      className="grid gap-2 rounded-md border border-[#25313c] bg-[#10161d] p-3"
                    >
                      <button
                        type="button"
                        className="min-w-0 text-left"
                        onClick={() => selectCredential(credential)}
                      >
                        <span className="block truncate text-sm font-medium">
                          {credential.label}
                        </span>
                        <span className="block truncate text-xs text-[#8fa1b2]">
                          {credential.username}
                        </span>
                      </button>
                      <div className="flex justify-between gap-2 text-xs">
                        <span className="text-[#55c2a2]">
                          {credential.hasPassword ? "Password saved" : "No password"}
                        </span>
                        <button
                          type="button"
                          className="text-[#ffb8c0] hover:text-[#ffd1d6]"
                          onClick={() => handleDeleteCredential(credential.id)}
                          disabled={isBusy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {credentials.length === 0 ? (
                    <p className="rounded-md border border-dashed border-[#334353] p-3 text-sm text-[#8fa1b2]">
                      No credentials yet.
                    </p>
                  ) : null}
                </div>

                <form className="grid gap-2" onSubmit={handleSaveCredential}>
                  <h3 className="text-sm font-semibold">
                    {editingCredentialId ? "Edit credential" : "New credential"}
                  </h3>
                  <input
                    className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm outline-none focus:border-[#55c2a2]"
                    value={credentialForm.label}
                    onChange={(event) =>
                      setCredentialForm((current) => ({
                        ...current,
                        label: event.currentTarget.value,
                      }))
                    }
                    placeholder="Label"
                  />
                  <input
                    className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm outline-none focus:border-[#55c2a2]"
                    value={credentialForm.username}
                    onChange={(event) =>
                      setCredentialForm((current) => ({
                        ...current,
                        username: event.currentTarget.value,
                      }))
                    }
                    placeholder="Username"
                  />
                  <input
                    className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm outline-none focus:border-[#55c2a2]"
                    value={credentialForm.password}
                    onChange={(event) =>
                      setCredentialForm((current) => ({
                        ...current,
                        password: event.currentTarget.value,
                      }))
                    }
                    placeholder={
                      editingCredentialId
                        ? "New password, leave blank to keep"
                        : "Password"
                    }
                    type="password"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="h-10 rounded-md border border-[#2e6f5d] bg-[#1f3a34] px-3 text-sm hover:bg-[#294b43] disabled:opacity-50"
                      disabled={!activeVault || isBusy}
                    >
                      {editingCredentialId ? "Update" : "Create"}
                    </button>
                    {editingCredentialId ? (
                      <button
                        type="button"
                        className="h-10 rounded-md border border-[#334353] bg-[#1d2731] px-3 text-sm hover:bg-[#263442]"
                        onClick={() => {
                          setEditingCredentialId("");
                          setCredentialForm(emptyCredentialForm);
                        }}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </form>
              </section>

              <section className="grid gap-4 rounded-lg border border-[#25313c] bg-[#151b22] p-4">
                <div>
                  <h2 className="text-sm font-semibold">SSH Profiles</h2>
                  <p className="text-xs text-[#8fa1b2]">
                    下一階段會把 profile 接到 SSH terminal session。
                  </p>
                </div>

                <div className="grid gap-2">
                  {profiles.map((profile) => {
                    const credential = credentials.find(
                      (item) => item.id === profile.credentialId,
                    );
                    return (
                      <div
                        key={profile.id}
                        className="grid gap-2 rounded-md border border-[#25313c] bg-[#10161d] p-3"
                      >
                        <button
                          type="button"
                          className="min-w-0 text-left"
                          onClick={() => selectProfile(profile)}
                        >
                          <span className="block truncate text-sm font-medium">
                            {profile.name}
                          </span>
                          <span className="block truncate text-xs text-[#8fa1b2]">
                            {profile.username}@{profile.host}:{profile.port}
                          </span>
                        </button>
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="truncate text-[#8fa1b2]">
                            {credential?.label ?? "No credential"}
                          </span>
                          <button
                            type="button"
                            className="text-[#ffb8c0] hover:text-[#ffd1d6]"
                            onClick={() => handleDeleteProfile(profile.id)}
                            disabled={isBusy}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {profiles.length === 0 ? (
                    <p className="rounded-md border border-dashed border-[#334353] p-3 text-sm text-[#8fa1b2]">
                      No SSH profiles yet.
                    </p>
                  ) : null}
                </div>

                <form className="grid gap-2" onSubmit={handleSaveProfile}>
                  <h3 className="text-sm font-semibold">
                    {editingProfileId ? "Edit profile" : "New profile"}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 max-[700px]:grid-cols-1">
                    <input
                      className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm outline-none focus:border-[#55c2a2]"
                      value={profileForm.name}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          name: event.currentTarget.value,
                        }))
                      }
                      placeholder="Profile name"
                    />
                    <input
                      className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm outline-none focus:border-[#55c2a2]"
                      value={profileForm.username}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          username: event.currentTarget.value,
                        }))
                      }
                      placeholder="SSH username"
                    />
                    <input
                      className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm outline-none focus:border-[#55c2a2]"
                      value={profileForm.host}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          host: event.currentTarget.value,
                        }))
                      }
                      placeholder="Host"
                    />
                    <input
                      className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm outline-none focus:border-[#55c2a2]"
                      value={profileForm.port}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          port: event.currentTarget.value,
                        }))
                      }
                      placeholder="Port"
                      inputMode="numeric"
                    />
                  </div>
                  <select
                    className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm outline-none focus:border-[#55c2a2]"
                    value={profileForm.credentialId}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        credentialId: event.currentTarget.value,
                      }))
                    }
                  >
                    <option value="">No credential</option>
                    {credentials.map((credential) => (
                      <option key={credential.id} value={credential.id}>
                        {credential.label} ({credential.username})
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="h-10 rounded-md border border-[#2e6f5d] bg-[#1f3a34] px-3 text-sm hover:bg-[#294b43] disabled:opacity-50"
                      disabled={!activeVault || isBusy}
                    >
                      {editingProfileId ? "Update" : "Create"}
                    </button>
                    {editingProfileId ? (
                      <button
                        type="button"
                        className="h-10 rounded-md border border-[#334353] bg-[#1d2731] px-3 text-sm hover:bg-[#263442]"
                        onClick={() => {
                          setEditingProfileId("");
                          setProfileForm(emptyProfileForm);
                        }}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </form>
              </section>
            </div>

            <section className="grid grid-cols-2 gap-4 max-[1120px]:grid-cols-1">
              <form
                className="grid gap-2 rounded-lg border border-[#25313c] bg-[#151b22] p-4"
                onSubmit={handleExportVault}
              >
                <h2 className="text-sm font-semibold">Encrypted export</h2>
                <input
                  className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm outline-none focus:border-[#55c2a2]"
                  value={exportPath}
                  onChange={(event) => setExportPath(event.currentTarget.value)}
                  placeholder="C:\\Users\\User\\Desktop\\termini-vault.json"
                />
                <input
                  className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm outline-none focus:border-[#55c2a2]"
                  value={exportPassword}
                  onChange={(event) => setExportPassword(event.currentTarget.value)}
                  placeholder="Export password"
                  type="password"
                />
                <button
                  type="submit"
                  className="h-10 justify-self-start rounded-md border border-[#334353] bg-[#1d2731] px-3 text-sm hover:bg-[#263442] disabled:opacity-50"
                  disabled={!activeVault || isBusy}
                >
                  Export vault
                </button>
              </form>

              <form
                className="grid gap-2 rounded-lg border border-[#25313c] bg-[#151b22] p-4"
                onSubmit={handleImportVault}
              >
                <h2 className="text-sm font-semibold">Encrypted import</h2>
                <input
                  className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm outline-none focus:border-[#55c2a2]"
                  value={importPath}
                  onChange={(event) => setImportPath(event.currentTarget.value)}
                  placeholder="C:\\Users\\User\\Desktop\\termini-vault.json"
                />
                <input
                  className="rounded-md border border-[#334353] bg-[#10161d] px-3 py-2 text-sm outline-none focus:border-[#55c2a2]"
                  value={importPassword}
                  onChange={(event) => setImportPassword(event.currentTarget.value)}
                  placeholder="Export password"
                  type="password"
                />
                <button
                  type="submit"
                  className="h-10 justify-self-start rounded-md border border-[#334353] bg-[#1d2731] px-3 text-sm hover:bg-[#263442] disabled:opacity-50"
                  disabled={isBusy}
                >
                  Import vault
                </button>
              </form>
            </section>
          </div>
        </section>

        <footer className="flex min-w-0 items-center gap-[18px] overflow-hidden border-t border-[#25313c] bg-[#151b22] px-2.5 text-xs whitespace-nowrap text-[#8fa1b2] max-[820px]:gap-2.5">
          <span>{isBusy ? "Working..." : status}</span>
          <span>{profiles.length} profiles</span>
          <span>{credentials.length} credentials</span>
          <span>Alt+Shift+D split</span>
        </footer>
      </section>
    </main>
  );
}

export default App;
