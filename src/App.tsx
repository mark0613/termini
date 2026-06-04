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
} from "./appTypes";
import { AppHeader } from "./components/AppHeader";
import { AppSidebar } from "./components/AppSidebar";
import { ProfileDrawer } from "./components/ProfileDrawer";
import { ShortcutHelpModal } from "./components/ShortcutHelpModal";
import { ThemeEditorModal } from "./components/ThemeEditorModal";
import { SessionPage } from "./pages/SessionPage";
import { SettingsPage } from "./pages/SettingsPage";
import {
  DEFAULT_TERMINAL_THEME,
  DEFAULT_TERMINAL_THEME_ID,
  storedThemeToConfig,
  toStoredColorsJson,
  type TerminalThemeConfig,
  type TerminalThemeDraft,
} from "./terminalThemes";
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
const defaultTerminalFontSize = 13;
const minTerminalFontSize = 9;
const maxTerminalFontSize = 24;

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function App() {
  const [activePage, setActivePage] = useState<AppPage>("vaults");
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
  const [profilePasswordVisible, setProfilePasswordVisible] = useState(false);
  const [profilePasswordLoading, setProfilePasswordLoading] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [hostSearch, setHostSearch] = useState("");
  const [exportPath, setExportPath] = useState("");
  const [exportPassword, setExportPassword] = useState("");
  const [exportError, setExportError] = useState("");
  const [importPath, setImportPath] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importError, setImportError] = useState("");
  const [terminalThemes, setTerminalThemes] = useState<TerminalThemeConfig[]>([
    DEFAULT_TERMINAL_THEME,
  ]);
  const [terminalThemesLoaded, setTerminalThemesLoaded] = useState(false);
  const [activeTerminalThemeId, setActiveTerminalThemeId] = useState(
    DEFAULT_TERMINAL_THEME.id,
  );
  const [terminalThemeError, setTerminalThemeError] = useState("");
  const [themeEditorOpen, setThemeEditorOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [terminalFontSize, setTerminalFontSize] = useState(
    defaultTerminalFontSize,
  );
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const connectingPaneIdsRef = useRef(new Set<string>());

  const activeVault = useMemo(
    () => vaults.find((vault) => vault.id === activeVaultId) ?? null,
    [activeVaultId, vaults],
  );
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, tabs],
  );
  const activeTerminalTheme = useMemo(
    () =>
      terminalThemes.find((theme) => theme.id === activeTerminalThemeId) ??
      DEFAULT_TERMINAL_THEME,
    [activeTerminalThemeId, terminalThemes],
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
      await Promise.all([refreshVaults(), refreshTerminalThemes()]);
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
      if (event.key === "F1" || event.code === "F1") {
        event.preventDefault();
        event.stopPropagation();
        setShortcutHelpOpen(true);
        return;
      }

      if (event.ctrlKey && !event.altKey && activePage === "session") {
        if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") {
          event.preventDefault();
          event.stopPropagation();
          setTerminalFontSize((current) =>
            Math.min(maxTerminalFontSize, current + 1),
          );
          return;
        }

        if (
          event.key === "-" ||
          event.key === "_" ||
          event.code === "Minus" ||
          event.code === "NumpadSubtract"
        ) {
          event.preventDefault();
          event.stopPropagation();
          setTerminalFontSize((current) =>
            Math.max(minTerminalFontSize, current - 1),
          );
          return;
        }
      }

      if (!event.altKey || !event.shiftKey || !activeTab || activePage !== "session") {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "d") {
        event.preventDefault();
        event.stopPropagation();
        splitActivePane(
          window.innerWidth >= window.innerHeight ? "vertical" : "horizontal",
        );
        return;
      }

      if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") {
        event.preventDefault();
        event.stopPropagation();
        splitActivePane("vertical");
        return;
      }

      if (
        event.key === "-" ||
        event.key === "_" ||
        event.code === "Minus" ||
        event.code === "NumpadSubtract"
      ) {
        event.preventDefault();
        event.stopPropagation();
        splitActivePane("horizontal");
      }
    }

    window.addEventListener("keydown", handleShortcut, true);
    return () => window.removeEventListener("keydown", handleShortcut, true);
  }, [activePage, activeTabId, activeTab?.activePaneId]);

  async function runAction(action: () => Promise<void>) {
    setIsBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(getErrorMessage(err));
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

  async function refreshTerminalThemes() {
    const [storedThemes, activeThemeId] = await Promise.all([
      api.listTerminalThemes(),
      api.activeTerminalThemeId(),
    ]);
    const customThemes = storedThemes
      .map(storedThemeToConfig)
      .filter((theme): theme is TerminalThemeConfig => Boolean(theme));
    const nextThemes = [DEFAULT_TERMINAL_THEME, ...customThemes];
    setTerminalThemes(nextThemes);
    setActiveTerminalThemeId(
      activeThemeId && nextThemes.some((theme) => theme.id === activeThemeId)
        ? activeThemeId
        : DEFAULT_TERMINAL_THEME.id,
    );
    setTerminalThemesLoaded(true);
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
    setProfilePasswordVisible(false);
    setProfilePasswordLoading(false);
    setProfileDrawerOpen(true);
  }

  function openEditProfileDrawer(profile: SshProfile) {
    const form = toProfileForm(profile);
    const shouldLoadPassword = Boolean(form.credentialId);
    setEditingProfileId(profile.id);
    setProfileForm(form);
    setProfileDrawerError("");
    setProfilePasswordVisible(false);
    setProfilePasswordLoading(shouldLoadPassword);
    setProfileDrawerOpen(true);
    if (shouldLoadPassword) {
      void loadProfilePassword(form.credentialId, false);
    }
  }

  function closeProfileDrawer() {
    setProfileDrawerOpen(false);
    setEditingProfileId("");
    setProfileForm(emptyProfileForm);
    setProfileDrawerError("");
    setProfilePasswordVisible(false);
    setProfilePasswordLoading(false);
  }

  async function toggleProfilePasswordVisibility() {
    if (profilePasswordVisible) {
      setProfilePasswordVisible(false);
      return;
    }

    setProfileDrawerError("");
    if (profileForm.password || !editingProfileId || !profileForm.credentialId) {
      setProfilePasswordVisible(true);
      return;
    }

    await loadProfilePassword(profileForm.credentialId, true);
  }

  async function loadProfilePassword(credentialId: string, reveal: boolean) {
    setProfilePasswordLoading(true);
    try {
      const password = await api.revealCredentialPassword(credentialId);
      setProfileForm((current) =>
        current.credentialId === credentialId && !current.password
          ? { ...current, password }
          : current,
      );
      if (reveal) {
        setProfilePasswordVisible(true);
      }
    } catch (err) {
      setProfileDrawerError(getErrorMessage(err));
    } finally {
      setProfilePasswordLoading(false);
    }
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
      } else {
        const profile = await api.createProfile({ vaultId: activeVault.id, ...payload });
        setSelectedProfileId(profile.id);
      }

      setProfileForm(emptyProfileForm);
      setEditingProfileId("");
      setProfileDrawerOpen(false);
      setProfilePasswordVisible(false);
      setProfilePasswordLoading(false);
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
      closeProfileDrawer();
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
      setExportError("");
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
      setImportError("");
    }
  }

  async function handleExportVault(event: FormEvent) {
    event.preventDefault();
    setExportError("");
    if (!activeVault) {
      setExportError("No active vault.");
      return;
    }

    const path = exportPath.trim();
    const password = exportPassword.trim();
    if (!path) {
      setExportError("Export path is required.");
      return;
    }
    if (!password) {
      setExportError("Export password is required.");
      return;
    }

    setIsBusy(true);
    try {
      await api.exportVault({
        vaultId: activeVault.id,
        path,
        password,
      });
      setExportPassword("");
    } catch (err) {
      setExportError(getErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleImportVault(event: FormEvent) {
    event.preventDefault();
    setImportError("");
    const path = importPath.trim();
    const password = importPassword.trim();
    if (!path) {
      setImportError("Import path is required.");
      return;
    }
    if (!password) {
      setImportError("Import password is required.");
      return;
    }

    setIsBusy(true);
    try {
      const result = await api.importVault({
        path,
        password,
      });
      setImportPassword("");
      await refreshVaults(result.vault.id);
      await refreshTerminalThemes();
    } catch (err) {
      setImportError(getErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleActiveTerminalThemeChange(id: string) {
    const previousId = activeTerminalThemeId;
    setActiveTerminalThemeId(id);
    setTerminalThemeError("");

    try {
      await api.setActiveTerminalThemeId(id);
    } catch (err) {
      setActiveTerminalThemeId(previousId);
      setTerminalThemeError(getErrorMessage(err));
    }
  }

  async function handleCreateTerminalTheme(theme: TerminalThemeDraft) {
    setIsBusy(true);
    setTerminalThemeError("");

    try {
      const createdTheme = await api.createTerminalTheme({
        name: theme.name,
        colorsJson: toStoredColorsJson(theme),
      });
      const config = storedThemeToConfig(createdTheme);
      if (!config) {
        throw new Error("Created theme could not be loaded.");
      }

      await api.setActiveTerminalThemeId(config.id);
      setTerminalThemes((current) => [
        DEFAULT_TERMINAL_THEME,
        ...current
          .filter((item) => !item.readOnly && item.id !== config.id)
          .concat(config)
          .sort((a, b) => a.name.localeCompare(b.name)),
      ]);
      setActiveTerminalThemeId(config.id);
      setThemeEditorOpen(false);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteTerminalTheme(theme: TerminalThemeConfig) {
    if (theme.readOnly) return;

    const confirmed = await confirmDelete(
      `Delete theme "${theme.name}"?`,
      "Delete theme",
    );
    if (!confirmed) return;

    setIsBusy(true);
    setTerminalThemeError("");
    try {
      await api.deleteTerminalTheme(theme.id);
      setTerminalThemes((current) => current.filter((item) => item.id !== theme.id));
      if (activeTerminalThemeId === theme.id) {
        setActiveTerminalThemeId(DEFAULT_TERMINAL_THEME_ID);
      }
    } catch (err) {
      setTerminalThemeError(getErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="grid h-dvh w-full grid-rows-[50px_minmax(0,1fr)] overflow-hidden bg-[#191d2d] text-[#f4f6fb]">
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

      {activePage === "vaults" || activePage === "settings" ? (
        <section className="grid min-h-0 grid-cols-[184px_minmax(0,1fr)] bg-[#1b2033]">
          <AppSidebar
            activePage={activePage}
            activeSettingsSection={activeSettingsSection}
            onHostsClick={() => setActivePage("vaults")}
            onSettingsSectionClick={(section) => {
              setActiveSettingsSection(section);
              setActivePage("settings");
            }}
          />
          {activePage === "vaults" ? (
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
          ) : (
            <SettingsPage
              activeSection={activeSettingsSection}
              activeVault={activeVault}
              activeTerminalThemeId={activeTerminalThemeId}
              exportError={exportError}
              exportPassword={exportPassword}
              exportPath={exportPath}
              importError={importError}
              importPassword={importPassword}
              importPath={importPath}
              isBusy={isBusy}
              terminalFontSize={terminalFontSize}
              terminalThemeError={terminalThemeError}
              terminalThemes={terminalThemes}
              onActiveTerminalThemeChange={(id) => {
                void handleActiveTerminalThemeChange(id);
              }}
              onChooseExportPath={chooseExportPath}
              onChooseImportPath={chooseImportPath}
              onCreateTheme={() => setThemeEditorOpen(true)}
              onDeleteTheme={(theme) => {
                void handleDeleteTerminalTheme(theme);
              }}
              onExport={handleExportVault}
              onExportPasswordChange={(value) => {
                setExportPassword(value);
                setExportError("");
              }}
              onExportPathChange={(value) => {
                setExportPath(value);
                setExportError("");
              }}
              onImport={handleImportVault}
              onImportPasswordChange={(value) => {
                setImportPassword(value);
                setImportError("");
              }}
              onImportPathChange={(value) => {
                setImportPath(value);
                setImportError("");
              }}
            />
          )}
        </section>
      ) : null}

      <SessionPage
        activeTabId={activeTabId}
        activeVault={activeVault}
        activeTheme={activeTerminalTheme}
        terminalFontSize={terminalFontSize}
        themeReady={terminalThemesLoaded}
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

      {profileDrawerOpen ? (
        <ProfileDrawer
          editing={Boolean(editingProfileId)}
          error={profileDrawerError}
          form={profileForm}
          isBusy={isBusy}
          passwordLoading={profilePasswordLoading}
          passwordVisible={profilePasswordVisible}
          onChange={setProfileForm}
          onClose={closeProfileDrawer}
          onDelete={() => editingProfileId && handleDeleteProfile(editingProfileId)}
          onTogglePasswordVisibility={() => {
            void toggleProfilePasswordVisibility();
          }}
          onSubmit={handleSaveProfile}
        />
      ) : null}

      {themeEditorOpen ? (
        <ThemeEditorModal
          initialTheme={{
            name: `${activeTerminalTheme.name} Copy`,
            colors: activeTerminalTheme.colors,
          }}
          isBusy={isBusy}
          onClose={() => setThemeEditorOpen(false)}
          onSave={handleCreateTerminalTheme}
        />
      ) : null}

      {shortcutHelpOpen ? (
        <ShortcutHelpModal onClose={() => setShortcutHelpOpen(false)} />
      ) : null}
    </main>
  );
}

export default App;
