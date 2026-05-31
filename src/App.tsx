import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api";
import {
  emptyProfileForm,
  toProfileForm,
  type AppPage,
  type ProfileFormState,
  type SettingsSection,
  type VaultSection,
} from "./appTypes";
import { AppHeader } from "./components/AppHeader";
import { ProfileDrawer } from "./components/ProfileDrawer";
import { VaultRail } from "./components/VaultRail";
import { SessionPage } from "./pages/SessionPage";
import { SettingsPage } from "./pages/SettingsPage";
import { VaultsPage } from "./pages/VaultsPage";
import {
  collectPanes,
  createTab,
  findFirstPane,
  findPane,
  removePane,
  splitPane,
  type SplitDirection,
  type TerminalTab,
  updatePane,
  updatePaneBySession,
} from "./terminalTree";
import type { Credential, SshProfile, SshStatusEvent, Vault } from "./types";

const vaultFileFilters = [{ name: "Termini vault export", extensions: ["json"] }];

function App() {
  const [activePage, setActivePage] = useState<AppPage>("vaults");
  const [activeVaultSection, setActiveVaultSection] =
    useState<VaultSection>("hosts");
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSection>("data");
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [activeVaultId, setActiveVaultId] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [profiles, setProfiles] = useState<SshProfile[]>([]);
  const [profileForm, setProfileForm] =
    useState<ProfileFormState>(emptyProfileForm);
  const [editingProfileId, setEditingProfileId] = useState("");
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [profileDrawerError, setProfileDrawerError] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [hostSearch, setHostSearch] = useState("");
  const [exportPath, setExportPath] = useState("");
  const [exportPassword, setExportPassword] = useState("");
  const [importPath, setImportPath] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Ready");
  const connectingPaneIdsRef = useRef(new Set<string>());

  const activeVault = useMemo(
    () => vaults.find((vault) => vault.id === activeVaultId) ?? null,
    [activeVaultId, vaults],
  );
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, tabs],
  );
  const filteredProfiles = useMemo(() => {
    const query = hostSearch.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter((profile) =>
      [
        profile.name,
        profile.host,
        profile.username,
        `${profile.username}@${profile.host}`,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [hostSearch, profiles]);
  useEffect(() => {
    void runAction(async () => {
      await refreshVaults();
    });
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    void listen<SshStatusEvent>("ssh-status", (event) => {
      setTabs((current) =>
        current.map((tab) => ({
          ...tab,
          root: updatePaneBySession(tab.root, event.payload.sessionId, (pane) => ({
            ...pane,
            status: event.payload.status,
            message: event.payload.message,
          })),
        })),
      );
    }).then((handler) => {
      unlisten = handler;
    });

    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (!activeVaultId) {
      setCredentials([]);
      setProfiles([]);
      setSelectedProfileId("");
      return;
    }

    void runAction(async () => {
      await refreshVaultData(activeVaultId);
    });
  }, [activeVaultId, vaults]);

  useEffect(() => {
    if (!profiles.length) {
      setSelectedProfileId("");
      return;
    }

    if (
      selectedProfileId &&
      !profiles.some((profile) => profile.id === selectedProfileId)
    ) {
      setSelectedProfileId("");
    }
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!event.altKey || !event.shiftKey || !activeTab) return;

      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        splitActivePane(
          window.innerWidth >= window.innerHeight ? "vertical" : "horizontal",
        );
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        splitActivePane("vertical");
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        splitActivePane("horizontal");
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeTabId, activeTab?.activePaneId]);

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

  function updatePaneInTabs(
    paneId: string,
    updater: Parameters<typeof updatePane>[2],
  ) {
    setTabs((current) =>
      current.map((tab) => ({
        ...tab,
        root: updatePane(tab.root, paneId, updater),
      })),
    );
  }

  function connectProfile(profile: SshProfile) {
    const tab = createTab(profile);
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setActivePage("session");
    setStatus(`Opening ${profile.name}`);
  }

  async function handlePaneReady(paneId: string, cols: number, rows: number) {
    if (connectingPaneIdsRef.current.has(paneId)) return;

    const tab = tabs.find((item) => findPane(item.root, paneId));
    const pane = tab ? findPane(tab.root, paneId) : null;
    if (!pane?.profileId || pane.sessionId || pane.status !== "pending") return;
    connectingPaneIdsRef.current.add(paneId);

    const sessionId = crypto.randomUUID();
    updatePaneInTabs(paneId, (current) => ({
      ...current,
      sessionId,
      status: "connecting",
      message: "Connecting...",
    }));

    try {
      const session = await api.connectSsh({
        sessionId,
        profileId: pane.profileId,
        cols,
        rows,
      });
      updatePaneInTabs(paneId, (current) => ({
        ...current,
        sessionId: session.sessionId,
        status: "connected",
        message: null,
      }));
    } catch (err) {
      updatePaneInTabs(paneId, (current) => ({
        ...current,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  function splitActivePane(direction: SplitDirection) {
    if (!activeTab) return;

    setTabs((current) =>
      current.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const result = splitPane(tab.root, tab.activePaneId, direction);
        return {
          ...tab,
          root: result.node,
          activePaneId: result.newPaneId ?? tab.activePaneId,
        };
      }),
    );
  }

  function closePane(paneId: string) {
    connectingPaneIdsRef.current.delete(paneId);

    setTabs((current) => {
      const nextTabs: TerminalTab[] = [];

      for (const tab of current) {
        const result = removePane(tab.root, paneId);
        if (!result.removed) {
          nextTabs.push(tab);
          continue;
        }

        if (result.removed.sessionId) {
          void api.disconnectSsh(result.removed.sessionId).catch(() => {});
        }

        if (!result.node) continue;
        const nextActive =
          tab.activePaneId === paneId ? findFirstPane(result.node).id : tab.activePaneId;
        nextTabs.push({ ...tab, root: result.node, activePaneId: nextActive });
      }

      if (nextTabs.length === 0) {
        setActiveTabId("");
        setActivePage("vaults");
        return [];
      }

      if (!nextTabs.some((tab) => tab.id === activeTabId)) {
        setActiveTabId(nextTabs[0].id);
        setActivePage("session");
      }

      return nextTabs;
    });
  }

  function closeTab(tabId: string) {
    setTabs((current) => {
      const tab = current.find((item) => item.id === tabId);
      if (tab) {
        for (const pane of collectPanes(tab.root)) {
          connectingPaneIdsRef.current.delete(pane.id);
          if (pane.sessionId) void api.disconnectSsh(pane.sessionId).catch(() => {});
        }
      }

      const remaining = current.filter((item) => item.id !== tabId);
      if (remaining.length === 0) {
        setActiveTabId("");
        setActivePage("vaults");
        return [];
      }

      if (activeTabId === tabId) {
        setActiveTabId(remaining[0].id);
        setActivePage("session");
      }
      return remaining;
    });
  }

  function openNewProfileDrawer() {
    setEditingProfileId("");
    setProfileForm(emptyProfileForm);
    setProfileDrawerError("");
    setProfileDrawerOpen(true);
  }

  function openEditProfileDrawer(profile: SshProfile) {
    setEditingProfileId(profile.id);
    setProfileForm(toProfileForm(profile));
    setProfileDrawerError("");
    setProfileDrawerOpen(true);
  }

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!activeVault) {
      setProfileDrawerError("No active vault.");
      return;
    }

    const name = profileForm.name.trim();
    const host = profileForm.host.trim();
    const username = profileForm.username.trim();
    const password = profileForm.password;
    const port = Number(profileForm.port || 22);

    if (!name || !host || !username || !profileForm.port.trim()) {
      setProfileDrawerError("Label, Host / IP address, Username, and Port are required.");
      return;
    }

    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      setProfileDrawerError("Port must be a number between 1 and 65535.");
      return;
    }

    if (!editingProfileId && !password.trim() && !profileForm.credentialId) {
      setProfileDrawerError("Password is required for password SSH login.");
      return;
    }

    setIsBusy(true);
    setError("");
    setProfileDrawerError("");
    try {
      let credentialId = profileForm.credentialId || null;
      if (password.trim()) {
        if (credentialId) {
          await api.updateCredential({
            id: credentialId,
            label: `${name} password`,
            username,
            password,
          });
        } else {
          const credential = await api.createCredential({
            vaultId: activeVault.id,
            label: `${name} password`,
            username,
            password,
          });
          credentialId = credential.id;
        }
      }

      const payload = {
        credentialId,
        name,
        host,
        port,
        username,
      };

      if (editingProfileId) {
        const profile = await api.updateProfile({ id: editingProfileId, ...payload });
        setSelectedProfileId(profile.id);
        setStatus(`Host updated: ${profileForm.name}`);
      } else {
        const profile = await api.createProfile({ vaultId: activeVault.id, ...payload });
        setSelectedProfileId(profile.id);
        setStatus(`Host created: ${profileForm.name}`);
      }

      setProfileForm(emptyProfileForm);
      setEditingProfileId("");
      setProfileDrawerOpen(false);
      await refreshVaultData(activeVault.id);
    } catch (err) {
      setProfileDrawerError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteProfile(id: string) {
    if (!activeVault) return;
    const profile = profiles.find((item) => item.id === id);
    const confirmed = await confirmDelete(
      `Delete host "${profile?.name ?? "selected host"}"?`,
      "Delete host",
    );
    if (!confirmed) return;

    await runAction(async () => {
      await api.deleteProfile(id);
      setStatus("Host deleted");
      setProfileDrawerOpen(false);
      setSelectedProfileId("");
      await refreshVaultData(activeVault.id);
    });
  }

  async function confirmDelete(message: string, title: string) {
    try {
      return await confirm(message, {
        title,
        kind: "warning",
        okLabel: "Delete",
        cancelLabel: "Cancel",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  async function chooseExportPath() {
    const selectedPath = await save({
      title: "Export Termini vault",
      defaultPath: "termini-vault.json",
      filters: vaultFileFilters,
    });
    if (selectedPath) {
      setExportPath(selectedPath);
    }
  }

  async function chooseImportPath() {
    const selectedPath = await open({
      title: "Import Termini vault",
      multiple: false,
      filters: vaultFileFilters,
    });
    if (typeof selectedPath === "string") {
      setImportPath(selectedPath);
    }
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
        `Imported ${result.credentialsImported} identities and ${result.profilesImported} hosts`,
      );
      await refreshVaults(result.vault.id);
    });
  }

  return (
    <main className="grid h-dvh w-full grid-rows-[50px_minmax(0,1fr)_28px] overflow-hidden bg-[#191d2d] text-[#f4f6fb]">
      <AppHeader
        activePage={activePage}
        activeTabId={activeTabId}
        tabs={tabs}
        onCloseTab={closeTab}
        onSelectTab={(tabId) => {
          setActiveTabId(tabId);
          setActivePage("session");
        }}
        onVaultsClick={() => setActivePage("vaults")}
      />

      {activePage === "vaults" ? (
        <section className="grid min-h-0 grid-cols-[184px_minmax(0,1fr)] bg-[#1b2033]">
          <VaultRail
            activeSection={activeVaultSection}
            onSectionChange={setActiveVaultSection}
            onSettingsClick={() => setActivePage("settings")}
          />
          <VaultsPage
            credentials={credentials}
            error={error}
            hostSearch={hostSearch}
            isBusy={isBusy}
            profiles={filteredProfiles}
            selectedProfileId={selectedProfileId}
            onConnect={connectProfile}
            onDelete={handleDeleteProfile}
            onEdit={openEditProfileDrawer}
            onNew={openNewProfileDrawer}
            onSearchChange={setHostSearch}
            onSelect={setSelectedProfileId}
            onClearSelection={() => setSelectedProfileId("")}
          />
        </section>
      ) : null}

      {activePage === "settings" ? (
        <SettingsPage
          activeSection={activeSettingsSection}
          activeVault={activeVault}
          exportPassword={exportPassword}
          exportPath={exportPath}
          importPassword={importPassword}
          importPath={importPath}
          isBusy={isBusy}
          onBack={() => setActivePage("vaults")}
          onChooseExportPath={chooseExportPath}
          onChooseImportPath={chooseImportPath}
          onExport={handleExportVault}
          onExportPasswordChange={setExportPassword}
          onExportPathChange={setExportPath}
          onImport={handleImportVault}
          onImportPasswordChange={setImportPassword}
          onImportPathChange={setImportPath}
          onSectionChange={setActiveSettingsSection}
        />
      ) : null}

      <SessionPage
        activeTabId={activeTabId}
        activeVault={activeVault}
        profiles={profiles}
        tabs={tabs}
        visible={activePage === "session"}
        onClosePane={closePane}
        onConnect={connectProfile}
        onFocusPane={(tabId, paneId) =>
          setTabs((current) =>
            current.map((tab) =>
              tab.id === tabId ? { ...tab, activePaneId: paneId } : tab,
            ),
          )
        }
        onPaneReady={handlePaneReady}
      />

      <footer className="flex min-w-0 items-center justify-between border-t border-[#2b3044] bg-[#15192a] px-3 text-xs text-[#8d93ad]">
        <span className="truncate">{isBusy ? "Working..." : status}</span>
        <span className="truncate">
          {profiles.length} hosts · {tabs.length} sessions
        </span>
      </footer>

      {profileDrawerOpen ? (
        <ProfileDrawer
          editing={Boolean(editingProfileId)}
          error={profileDrawerError}
          form={profileForm}
          isBusy={isBusy}
          onChange={setProfileForm}
          onClose={() => setProfileDrawerOpen(false)}
          onDelete={() => editingProfileId && handleDeleteProfile(editingProfileId)}
          onSubmit={handleSaveProfile}
        />
      ) : null}
    </main>
  );
}

export default App;
