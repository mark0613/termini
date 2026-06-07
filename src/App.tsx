import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { basename, homeDir, join } from "@tauri-apps/api/path";
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
import {
  AppHeader,
  type TabDragPoint,
  type TabReorderPreview,
} from "./components/AppHeader";
import { AppSidebar } from "./components/AppSidebar";
import { ProfileDrawer } from "./components/ProfileDrawer";
import { ShortcutHelpModal } from "./components/ShortcutHelpModal";
import { preserveTerminalPaneRuntime } from "./components/TerminalPane";
import { ThemeEditorModal } from "./components/ThemeEditorModal";
import { SessionPage, type WorkspaceDropPreview } from "./pages/SessionPage";
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
  DEFAULT_TERMINAL_FONT_SIZE,
  WORKSPACE_TAB_TITLE,
  canDragTabIntoWorkspace,
  collectPanes,
  createSftpPane,
  createTab,
  findFirstPane,
  findPane,
  insertWorkspaceAtPane,
  removePane,
  splitPane,
  type SplitDirection,
  type SftpPanelSide,
  type SftpSortField,
  type TerminalTab,
  type WorkspacePaneState,
  type WorkspaceDropSide,
  updatePane,
  updatePaneBySession,
} from "./terminalTree";
import type {
  Credential,
  RemoteFileEntry,
  SftpStatusEvent,
  SftpTransferInfo,
  SshProfile,
  SshStatusEvent,
  Vault,
} from "./types";

const vaultFileFilters = [{ name: "Termini vault export", extensions: ["json"] }];
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
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [sftpTransfers, setSftpTransfers] = useState<SftpTransferInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [dropPreview, setDropPreview] = useState<WorkspaceDropPreview | null>(
    null,
  );
  const [reorderPreview, setReorderPreview] =
    useState<TabReorderPreview | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const connectingPaneIdsRef = useRef(new Set<string>());
  const draggingTabIdRef = useRef<string | null>(null);

  const activeVault = useMemo(
    () => vaults.find((vault) => vault.id === activeVaultId) ?? null,
    [activeVaultId, vaults],
  );
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [activeTabId, tabs],
  );
  const activeTerminalFontSize = useMemo(() => {
    if (!activeTab) return DEFAULT_TERMINAL_FONT_SIZE;

    return (
      getTerminalPaneFontSize(findPane(activeTab.root, activeTab.activePaneId))
    );
  }, [activeTab]);
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
          root: updatePaneBySession(tab.root, event.payload.sessionId, (pane) =>
            pane.kind === "terminal"
              ? {
                  ...pane,
                  status: event.payload.status,
                  message: event.payload.message,
                }
              : pane,
          ),
        })),
      );
    }).then((handler) => {
      unlisten = handler;
    });

    return () => unlisten?.();
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    void listen<SftpTransferInfo>("sftp-transfer", (event) => {
      setSftpTransfers((current) => upsertSftpTransfer(current, event.payload));
    }).then((handler) => {
      unlisten = handler;
    });

    return () => unlisten?.();
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    void listen<SftpStatusEvent>("sftp-status", (event) => {
      setTabs((current) =>
        current.map((tab) => ({
          ...tab,
          root: updatePaneBySession(tab.root, event.payload.sessionId, (pane) =>
            pane.kind === "sftp"
              ? {
                  ...pane,
                  status: event.payload.status,
                  message: event.payload.message,
                }
              : pane,
          ),
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

      if (
        event.ctrlKey &&
        event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "w" &&
        activePage === "session" &&
        activeTab &&
        !shortcutHelpOpen
      ) {
        event.preventDefault();
        event.stopPropagation();
        closePane(activeTab.activePaneId);
        return;
      }

      if (event.ctrlKey && !event.altKey && activePage === "session") {
        if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") {
          event.preventDefault();
          event.stopPropagation();
          zoomActivePane(1);
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
          zoomActivePane(-1);
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
  }, [activePage, activeTabId, activeTab?.activePaneId, shortcutHelpOpen]);

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

  function findPaneInOpenTabs(paneId: string) {
    for (const tab of tabs) {
      const pane = findPane(tab.root, paneId);
      if (pane) return pane;
    }

    return null;
  }

  function zoomActivePane(delta: number) {
    if (!activeTab) return;

    setTabs((current) =>
      current.map((tab) => {
        if (tab.id !== activeTabId) return tab;

        return {
          ...tab,
          root: updatePane(tab.root, tab.activePaneId, (pane) =>
            pane.kind === "terminal"
              ? {
                  ...pane,
                  fontSize: clampTerminalFontSize(pane.fontSize + delta),
                }
              : pane,
          ),
        };
      }),
    );
  }

  function connectProfile(profile: SshProfile) {
    const tab = createTab(profile);
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setActivePage("session");
  }

  function openSftpProfile(profile: SshProfile) {
    const tab = createTab(profile, "sftp");
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setActivePage("session");
  }

  async function handlePaneReady(paneId: string, cols: number, rows: number) {
    const pane = findPaneInOpenTabs(paneId);
    if (
      !pane?.profileId ||
      pane.kind !== "terminal" ||
      pane.sessionId ||
      pane.status !== "pending"
    ) {
      return;
    }

    await connectPane(paneId, cols, rows);
  }

  async function reconnectPane(paneId: string, cols: number, rows: number) {
    const pane = findPaneInOpenTabs(paneId);
    if (
      !pane?.profileId ||
      pane.kind !== "terminal" ||
      !isRecoverableSshStatus(pane.status)
    ) {
      return;
    }

    await connectPane(paneId, cols, rows);
  }

  async function connectPane(paneId: string, cols: number, rows: number) {
    if (connectingPaneIdsRef.current.has(paneId)) return;

    const pane = findPaneInOpenTabs(paneId);
    if (!pane?.profileId || pane.kind !== "terminal") return;

    connectingPaneIdsRef.current.add(paneId);
    const previousSessionId = pane.sessionId;
    const sessionId = crypto.randomUUID();
    updatePaneInTabs(paneId, (current) => ({
      ...current,
      sessionId,
      status: "connecting",
      message: "Connecting...",
    }));

    if (previousSessionId) {
      void api.disconnectSsh(previousSessionId).catch(() => {});
    }

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
        sessionId,
        status: "error",
        message: getErrorMessage(err),
      }));
    } finally {
      connectingPaneIdsRef.current.delete(paneId);
    }
  }

  async function handleSftpPaneReady(paneId: string) {
    const pane = findPaneInOpenTabs(paneId);
    if (!pane || pane.kind !== "sftp") return;

    const tasks: Promise<void>[] = [];
    if (pane.localStatus === "pending" || !pane.localPath) {
      tasks.push(loadInitialLocalDirectory(paneId));
    }
    if (pane.profileId && pane.status === "pending") {
      tasks.push(connectSftpPane(paneId));
    }

    await Promise.all(tasks);
  }

  async function connectSftpPane(paneId: string) {
    if (connectingPaneIdsRef.current.has(paneId)) return;

    const pane = findPaneInOpenTabs(paneId);
    if (!pane?.profileId || pane.kind !== "sftp") return;

    connectingPaneIdsRef.current.add(paneId);
    const previousSessionId = pane.sessionId;
    const sessionId = crypto.randomUUID();
    updatePaneInTabs(paneId, (current) =>
      current.kind === "sftp"
        ? {
            ...current,
            sessionId,
            status: "connecting",
            message: "Connecting...",
          }
        : current,
    );

    if (previousSessionId) {
      void api.disconnectSftp(previousSessionId).catch(() => {});
    }

    try {
      const session = await api.connectSftp({
        sessionId,
        profileId: pane.profileId,
      });
      const path = session.homePath || ".";
      updatePaneInTabs(paneId, (current) =>
        current.kind === "sftp"
          ? {
              ...current,
              sessionId: session.sessionId,
              status: "loading",
              message: null,
              remotePath: path,
              remoteEntries: [],
              remoteSelectedPath: null,
            }
          : current,
      );
      await loadRemoteDirectoryForSession(paneId, session.sessionId, path);
    } catch (err) {
      updatePaneInTabs(paneId, (current) =>
        current.kind === "sftp"
          ? {
              ...current,
              sessionId,
              status: "error",
              message: getErrorMessage(err),
            }
          : current,
      );
    } finally {
      connectingPaneIdsRef.current.delete(paneId);
    }
  }

  async function loadInitialLocalDirectory(paneId: string) {
    const pane = findPaneInOpenTabs(paneId);
    if (!pane || pane.kind !== "sftp") return;

    const path = pane.localPath || (await defaultLocalTransferPath());
    await loadLocalDirectoryForPane(paneId, path);
  }

  async function loadSftpPanelDirectory(
    paneId: string,
    side: SftpPanelSide,
    path: string,
  ) {
    if (side === "local") {
      await loadLocalDirectoryForPane(paneId, path);
      return;
    }

    const pane = findPaneInOpenTabs(paneId);
    if (!pane?.sessionId || pane.kind !== "sftp") return;

    await loadRemoteDirectoryForSession(paneId, pane.sessionId, path);
  }

  async function refreshSftpPanelDirectory(
    paneId: string,
    side: SftpPanelSide,
  ) {
    const pane = findPaneInOpenTabs(paneId);
    if (!pane || pane.kind !== "sftp") return;

    if (side === "local") {
      await loadLocalDirectoryForPane(
        paneId,
        pane.localPath || (await defaultLocalTransferPath()),
      );
      return;
    }

    if (!pane.sessionId || pane.status === "error") {
      await connectSftpPane(paneId);
      return;
    }

    await loadRemoteDirectoryForSession(
      paneId,
      pane.sessionId,
      pane.remotePath || ".",
    );
  }

  async function loadLocalDirectoryForPane(paneId: string, path: string) {
    updatePaneInTabs(paneId, (current) =>
      current.kind === "sftp"
        ? {
            ...current,
            localStatus: "loading",
            localMessage: null,
          }
        : current,
    );

    try {
      const entries = await api.localReadDir({ path });
      updatePaneInTabs(paneId, (current) =>
        current.kind === "sftp"
          ? {
              ...current,
              localStatus: "connected",
              localMessage: null,
              localPath: path,
              localEntries: entries,
              localSelectedPath: null,
            }
          : current,
      );
    } catch (err) {
      updatePaneInTabs(paneId, (current) =>
        current.kind === "sftp"
          ? {
              ...current,
              localStatus: "error",
              localMessage: getErrorMessage(err),
            }
          : current,
      );
    }
  }

  async function loadRemoteDirectoryForSession(
    paneId: string,
    sessionId: string,
    path: string,
  ) {
    updatePaneInTabs(paneId, (current) =>
      current.kind === "sftp"
        ? {
            ...current,
            status: "loading",
            message: null,
          }
        : current,
    );

    try {
      const entries = await api.sftpReadDir({ sessionId, path });
      updatePaneInTabs(paneId, (current) =>
        current.kind === "sftp"
          ? {
              ...current,
              status: "connected",
              message: null,
              remotePath: path,
              remoteEntries: entries,
              remoteSelectedPath: null,
            }
          : current,
      );
    } catch (err) {
      updatePaneInTabs(paneId, (current) =>
        current.kind === "sftp"
          ? {
              ...current,
              status: "error",
              message: getErrorMessage(err),
            }
          : current,
      );
    }
  }

  function selectSftpEntry(
    paneId: string,
    side: SftpPanelSide,
    path: string | null,
  ) {
    updatePaneInTabs(paneId, (current) =>
      current.kind === "sftp"
        ? side === "local"
          ? {
              ...current,
              localSelectedPath: path,
            }
          : {
              ...current,
              remoteSelectedPath: path,
            }
        : current,
    );
  }

  function sortSftpEntries(
    paneId: string,
    side: SftpPanelSide,
    field: SftpSortField,
  ) {
    updatePaneInTabs(paneId, (current) => {
      if (current.kind !== "sftp") return current;

      if (side === "local") {
        const sameField = current.localSortBy === field;
        return {
          ...current,
          localSortBy: field,
          localSortDirection:
            sameField && current.localSortDirection === "asc" ? "desc" : "asc",
        };
      }

      const sameField = current.remoteSortBy === field;
      return {
        ...current,
        remoteSortBy: field,
        remoteSortDirection:
          sameField && current.remoteSortDirection === "asc" ? "desc" : "asc",
      };
    });
  }

  function toggleSftpHidden(paneId: string, side: SftpPanelSide) {
    updatePaneInTabs(paneId, (current) =>
      current.kind === "sftp"
        ? side === "local"
          ? {
              ...current,
              localShowHidden: !current.localShowHidden,
            }
          : {
              ...current,
              remoteShowHidden: !current.remoteShowHidden,
            }
        : current,
    );
  }

  function openFilesFromTerminalPane(paneId: string) {
    const pane = findPaneInOpenTabs(paneId);
    if (!pane?.profileId || pane.kind !== "terminal") return;

    const profile = profiles.find((item) => item.id === pane.profileId);
    if (!profile) return;

    insertPaneBeside(paneId, createSftpPane(profile), `${profile.name} Files`);
  }

  function openTerminalFromSftpPane(paneId: string) {
    const pane = findPaneInOpenTabs(paneId);
    if (!pane?.profileId || pane.kind !== "sftp") return;

    const profile = profiles.find((item) => item.id === pane.profileId);
    if (!profile) return;

    const tab = createTab(profile);
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setActivePage("session");
  }

  function insertPaneBeside(
    paneId: string,
    pane: WorkspacePaneState,
    title?: string,
  ) {
    setTabs((current) =>
      current.map((tab) => {
        const targetPane = findPane(tab.root, paneId);
        if (!targetPane) return tab;

        if (targetPane.kind === "terminal") {
          preserveTerminalPaneRuntime(targetPane.id);
        }

        const result = insertWorkspaceAtPane(tab.root, paneId, pane, "right");
        if (!result.inserted) return tab;

        return {
          ...tab,
          title:
            title ??
            (targetPane.kind === "sftp" || pane.kind === "sftp"
              ? tab.title
              : WORKSPACE_TAB_TITLE),
          workspace: true,
          root: result.node,
          activePaneId: pane.id,
        };
      }),
    );
  }

  async function createSftpFolder(paneId: string, side: SftpPanelSide) {
    const pane = findPaneInOpenTabs(paneId);
    if (!pane || pane.kind !== "sftp") return;

    const name = window.prompt("Folder name");
    const folderName = name?.trim();
    if (!folderName) return;

    try {
      if (side === "local") {
        await api.localCreateDir({
          path: await join(pane.localPath || (await defaultLocalTransferPath()), folderName),
        });
      } else {
        if (!pane.sessionId) return;
        await api.sftpCreateDir({
          sessionId: pane.sessionId,
          path: joinRemotePath(pane.remotePath || ".", folderName),
        });
      }
      await refreshSftpPanelDirectory(paneId, side);
    } catch (err) {
      setSftpPanelError(paneId, side, err);
    }
  }

  async function renameSftpEntry(
    paneId: string,
    side: SftpPanelSide,
    entry: RemoteFileEntry,
  ) {
    const pane = findPaneInOpenTabs(paneId);
    if (!pane || pane.kind !== "sftp") return;

    const name = window.prompt("Rename", entry.name);
    const nextName = name?.trim();
    if (!nextName || nextName === entry.name) return;

    try {
      if (side === "local") {
        await api.localRename({
          oldPath: entry.path,
          newPath: await join(parentLocalPath(entry.path), nextName),
        });
      } else {
        if (!pane.sessionId) return;
        await api.sftpRename({
          sessionId: pane.sessionId,
          oldPath: entry.path,
          newPath: joinRemotePath(parentRemotePath(entry.path), nextName),
        });
      }
      await refreshSftpPanelDirectory(paneId, side);
    } catch (err) {
      setSftpPanelError(paneId, side, err);
    }
  }

  async function deleteSftpEntry(
    paneId: string,
    side: SftpPanelSide,
    entry: RemoteFileEntry,
  ) {
    const pane = findPaneInOpenTabs(paneId);
    if (!pane || pane.kind !== "sftp") return;

    const confirmed = await confirm(`Delete "${entry.name}"?`, {
      title: side === "local" ? "Delete local item" : "Delete remote item",
      kind: "warning",
      okLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    try {
      if (side === "local") {
        if (entry.kind === "directory") {
          await api.localDeleteDir({ path: entry.path });
        } else {
          await api.localDeleteFile({ path: entry.path });
        }
      } else {
        if (!pane.sessionId) return;
        if (entry.kind === "directory") {
          await api.sftpDeleteDir({ sessionId: pane.sessionId, path: entry.path });
        } else {
          await api.sftpDeleteFile({ sessionId: pane.sessionId, path: entry.path });
        }
      }
      await refreshSftpPanelDirectory(paneId, side);
    } catch (err) {
      setSftpPanelError(paneId, side, err);
    }
  }

  async function uploadLocalFileToRemote(
    paneId: string,
    entry: RemoteFileEntry,
    remoteDirectoryPath?: string,
  ) {
    const pane = findPaneInOpenTabs(paneId);
    if (
      !pane?.sessionId ||
      pane.kind !== "sftp" ||
      entry.kind === "directory"
    ) {
      return;
    }

    try {
      const remoteDirectory = remoteDirectoryPath || pane.remotePath || ".";
      const fileName = entry.name || (await basename(entry.path));
      const existingEntries = isSameRemotePath(remoteDirectory, pane.remotePath)
        ? pane.remoteEntries
        : await api.sftpReadDir({
            sessionId: pane.sessionId,
            path: remoteDirectory,
          });
      const remoteFileName = nextUniqueFileName(
        fileName,
        existingEntries.map((item) => item.name),
      );

      await api.sftpUploadFile({
        sessionId: pane.sessionId,
        localPath: entry.path,
        remotePath: joinRemotePath(remoteDirectory, remoteFileName),
      });
      await refreshSftpPanelDirectory(paneId, "remote");
    } catch (err) {
      setSftpPanelError(paneId, "remote", err);
    }
  }

  async function downloadRemoteFileToLocal(
    paneId: string,
    entry: RemoteFileEntry,
    localDirectoryPath?: string,
  ) {
    const pane = findPaneInOpenTabs(paneId);
    if (!pane?.sessionId || pane.kind !== "sftp" || entry.kind === "directory") {
      return;
    }

    try {
      const localDirectory =
        localDirectoryPath || pane.localPath || (await defaultLocalTransferPath());
      const existingEntries = isSameLocalPath(localDirectory, pane.localPath)
        ? pane.localEntries
        : await api.localReadDir({ path: localDirectory });
      const localFileName = nextUniqueFileName(
        entry.name,
        existingEntries.map((item) => item.name),
        true,
      );

      await api.sftpDownloadFile({
        sessionId: pane.sessionId,
        remotePath: entry.path,
        localPath: await join(localDirectory, localFileName),
      });
      await refreshSftpPanelDirectory(paneId, "local");
    } catch (err) {
      setSftpPanelError(paneId, "local", err);
    }
  }

  function setSftpPanelError(
    paneId: string,
    side: SftpPanelSide,
    err: unknown,
  ) {
    updatePaneInTabs(paneId, (current) =>
      current.kind === "sftp"
        ? side === "local"
          ? {
              ...current,
              localStatus: "error",
              localMessage: getErrorMessage(err),
            }
          : {
              ...current,
              status: "error",
              message: getErrorMessage(err),
            }
        : current,
    );
  }

  function splitActivePane(direction: SplitDirection) {
    if (!activeTab) return;

    setTabs((current) =>
      current.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        const activePane = findPane(tab.root, tab.activePaneId);
        const result = splitPane(tab.root, tab.activePaneId, direction);
        const splitCreated = Boolean(result.newPaneId);
        return {
          ...tab,
          title:
            splitCreated && activePane?.kind !== "sftp"
              ? WORKSPACE_TAB_TITLE
              : tab.title,
          workspace: splitCreated ? true : tab.workspace,
          root: result.node,
          activePaneId: result.newPaneId ?? tab.activePaneId,
        };
      }),
    );
  }

  function handleTabDragStart(tabId: string, point: TabDragPoint) {
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return;

    draggingTabIdRef.current = tabId;
    updateTabDragPreview(tabId, point);
  }

  function handleTabDragMove(tabId: string, point: TabDragPoint) {
    const sourceTabId = draggingTabIdRef.current ?? tabId;
    updateTabDragPreview(sourceTabId, point);
  }

  function handleTabDrop(tabId: string, point: TabDragPoint) {
    const sourceTabId = draggingTabIdRef.current ?? tabId;
    const reorderTarget = findTabReorderTarget(point, sourceTabId);
    if (reorderTarget) {
      clearTabDragState();
      reorderTab(sourceTabId, reorderTarget.targetIndex);
      return;
    }

    const target = findWorkspaceDropTarget(point);
    clearTabDragState();

    if (!target) return;
    commitWorkspaceDrop(sourceTabId, target.tabId, target.paneId, target.side);
  }

  function clearTabDragState() {
    draggingTabIdRef.current = null;
    setDropPreview(null);
    setReorderPreview(null);
  }

  function updateTabDragPreview(sourceTabId: string, point: TabDragPoint) {
    const reorderTarget = findTabReorderTarget(point, sourceTabId);
    if (reorderTarget) {
      setDropPreview(null);
      setReorderPreview((current) =>
        current?.targetIndex === reorderTarget.targetIndex
          ? current
          : { targetIndex: reorderTarget.targetIndex },
      );
      return;
    }

    setReorderPreview(null);
    updateWorkspaceDropPreview(sourceTabId, point);
  }

  function updateWorkspaceDropPreview(sourceTabId: string, point: TabDragPoint) {
    const target = findWorkspaceDropTarget(point);
    if (!target || sourceTabId === target.tabId) {
      setDropPreview(null);
      return;
    }

    const draggingTab = tabs.find((tab) => tab.id === sourceTabId);
    if (!draggingTab || !canDragTabIntoWorkspace(draggingTab)) {
      setDropPreview(null);
      return;
    }

    setDropPreview((current) => {
      if (
        current?.targetTabId === target.tabId &&
        current.targetPaneId === target.paneId &&
        current.side === target.side
      ) {
        return current;
      }

      return {
        targetTabId: target.tabId,
        targetPaneId: target.paneId,
        side: target.side,
      };
    });
  }

  function commitWorkspaceDrop(
    sourceTabId: string,
    targetTabId: string,
    targetPaneId: string,
    side: WorkspaceDropSide,
  ) {
    if (!sourceTabId || sourceTabId === targetTabId) return;

    setTabs((current) => {
      const sourceTab = current.find((tab) => tab.id === sourceTabId);
      const targetTab = current.find((tab) => tab.id === targetTabId);
      if (
        !sourceTab ||
        !targetTab ||
        sourceTab.id === targetTab.id ||
        !canDragTabIntoWorkspace(sourceTab)
      ) {
        return current;
      }

      const result = insertWorkspaceAtPane(
        targetTab.root,
        targetPaneId,
        sourceTab.root,
        side,
      );
      if (!result.inserted) return current;

      if (sourceTab.root.type === "pane" && sourceTab.root.kind === "terminal") {
        preserveTerminalPaneRuntime(sourceTab.root.id);
      }

      return current.flatMap((tab) => {
        if (tab.id === sourceTab.id) return [];
        if (tab.id !== targetTab.id) return [tab];

        return [
          {
            ...tab,
            title: mergedWorkspaceTitle(sourceTab, targetTab),
            workspace: true,
            root: result.node,
            activePaneId: sourceTab.activePaneId,
          },
        ];
      });
    });

    setActiveTabId(targetTabId);
    setActivePage("session");
  }

  function reorderTab(sourceTabId: string, targetIndex: number) {
    setTabs((current) => {
      const sourceIndex = current.findIndex((tab) => tab.id === sourceTabId);
      if (sourceIndex < 0) return current;

      const boundedTargetIndex = Math.max(
        0,
        Math.min(current.length, targetIndex),
      );
      const nextIndex =
        sourceIndex < boundedTargetIndex
          ? boundedTargetIndex - 1
          : boundedTargetIndex;
      if (nextIndex === sourceIndex) return current;

      const nextTabs = current.slice();
      const [movingTab] = nextTabs.splice(sourceIndex, 1);
      nextTabs.splice(nextIndex, 0, movingTab);
      return nextTabs;
    });
  }

  function findTabReorderTarget(
    point: TabDragPoint,
    sourceTabId: string,
  ): TabReorderTarget | null {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

    const tabList = findTabReorderList(point);
    if (!tabList) return null;

    const tabElements = Array.from(
      tabList.querySelectorAll<HTMLElement>("[data-tab-reorder-tab-id]"),
    );
    if (!tabElements.length) return null;

    let targetIndex = tabElements.length;
    for (let index = 0; index < tabElements.length; index += 1) {
      const rect = tabElements[index].getBoundingClientRect();
      if (point.x < rect.left + rect.width / 2) {
        targetIndex = index;
        break;
      }
    }

    const sourceIndex = tabs.findIndex((tab) => tab.id === sourceTabId);
    if (targetIndex === sourceIndex || targetIndex === sourceIndex + 1) {
      return null;
    }

    return { targetIndex };
  }

  function findTabReorderList(point: TabDragPoint) {
    for (const element of document.elementsFromPoint(point.x, point.y)) {
      const target = element.closest<HTMLElement>("[data-tab-reorder-list]");
      if (target) return target;
    }

    return null;
  }

  function findWorkspaceDropTarget(
    point: TabDragPoint,
  ): WorkspaceDropTarget | null {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

    for (const element of document.elementsFromPoint(point.x, point.y)) {
      const target = element.closest<HTMLElement>(
        "[data-workspace-drop-pane-id][data-workspace-drop-tab-id]",
      );
      if (!target) continue;

      const paneId = target.dataset.workspaceDropPaneId;
      const tabId = target.dataset.workspaceDropTabId;
      if (!paneId || !tabId) continue;

      return {
        paneId,
        tabId,
        side: getWorkspaceDropSide(target, point),
      };
    }

    return null;
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

        disconnectPaneSession(result.removed);
        if (result.removed.kind === "sftp") {
          setSftpTransfers((current) =>
            current.filter((transfer) => transfer.sessionId !== result.removed?.sessionId),
          );
        }

        if (!result.node) continue;
        const nextActive =
          tab.activePaneId === paneId ? findFirstPane(result.node).id : tab.activePaneId;
        nextTabs.push({
          ...tab,
          title:
            result.node.type === "pane"
              ? result.node.title
              : collectPanes(result.node).some((pane) => pane.kind === "sftp")
                ? tab.title
                : WORKSPACE_TAB_TITLE,
          workspace: result.node.type === "split",
          root: result.node,
          activePaneId: nextActive,
        });
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
          disconnectPaneSession(pane);
          if (pane.kind === "sftp") {
            setSftpTransfers((current) =>
              current.filter((transfer) => transfer.sessionId !== pane.sessionId),
            );
          }
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
    const sshKeyPath = profileForm.sshKeyPath.trim();
    const port = Number(profileForm.port || 22);

    if (!name || !host || !username || !profileForm.port.trim()) {
      setProfileDrawerError("Label, Host / IP address, Username, and Port are required.");
      return;
    }

    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      setProfileDrawerError("Port must be a number between 1 and 65535.");
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
        sshKeyPath: sshKeyPath || null,
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

  async function chooseProfileSshKeyPath() {
    const selectedPath = await open({
      title: "Choose SSH private key",
      multiple: false,
    });
    if (typeof selectedPath === "string") {
      setProfileForm((current) => ({ ...current, sshKeyPath: selectedPath }));
      setProfileDrawerError("");
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
        reorderPreview={reorderPreview}
        onTabDragMove={handleTabDragMove}
        onTabDragStart={handleTabDragStart}
        onTabDrop={handleTabDrop}
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
              onOpenFiles={openSftpProfile}
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
              terminalFontSize={activeTerminalFontSize}
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
        dropPreview={dropPreview}
        terminalFontSize={DEFAULT_TERMINAL_FONT_SIZE}
        themeReady={terminalThemesLoaded}
        profiles={profiles}
        sftpTransfers={sftpTransfers}
        tabs={tabs}
        visible={activePage === "session"}
        onClosePane={closePane}
        onConnect={connectProfile}
        onOpenFiles={openSftpProfile}
        onFocusPane={(tabId, paneId) =>
          setTabs((current) =>
            current.map((tab) =>
              tab.id === tabId ? { ...tab, activePaneId: paneId } : tab,
            ),
          )
        }
        onPaneReady={handlePaneReady}
        onReconnectPane={(paneId, cols, rows) => {
          void reconnectPane(paneId, cols, rows);
        }}
        onSftpNavigate={(paneId, side, path) => {
          void loadSftpPanelDirectory(paneId, side, path);
        }}
        onSftpPaneReady={(paneId) => {
          void handleSftpPaneReady(paneId);
        }}
        onSftpRefresh={(paneId, side) => {
          void refreshSftpPanelDirectory(paneId, side);
        }}
        onSftpSelect={selectSftpEntry}
        onSftpSort={sortSftpEntries}
        onSftpToggleHidden={toggleSftpHidden}
        onSftpUpload={(paneId, entry, remoteDirectoryPath) => {
          void uploadLocalFileToRemote(paneId, entry, remoteDirectoryPath);
        }}
        onSftpDownload={(paneId, entry, localDirectoryPath) => {
          void downloadRemoteFileToLocal(paneId, entry, localDirectoryPath);
        }}
        onSftpCreateFolder={(paneId, side) => {
          void createSftpFolder(paneId, side);
        }}
        onSftpRename={(paneId, side, entry) => {
          void renameSftpEntry(paneId, side, entry);
        }}
        onSftpDelete={(paneId, side, entry) => {
          void deleteSftpEntry(paneId, side, entry);
        }}
        onOpenFilesFromTerminal={openFilesFromTerminalPane}
        onOpenTerminalFromSftp={openTerminalFromSftpPane}
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
          onChooseSshKeyPath={() => {
            void chooseProfileSshKeyPath();
          }}
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

function isRecoverableSshStatus(status: string) {
  return status === "error" || status === "disconnected" || status === "exited";
}

function getTerminalPaneFontSize(pane: WorkspacePaneState | null) {
  return pane?.kind === "terminal" ? pane.fontSize : DEFAULT_TERMINAL_FONT_SIZE;
}

function mergedWorkspaceTitle(sourceTab: TerminalTab, targetTab: TerminalTab) {
  if (collectPanes(sourceTab.root).some((pane) => pane.kind === "sftp")) {
    return sourceTab.title;
  }
  if (collectPanes(targetTab.root).some((pane) => pane.kind === "sftp")) {
    return targetTab.title;
  }
  return WORKSPACE_TAB_TITLE;
}

function disconnectPaneSession(pane: WorkspacePaneState) {
  if (!pane.sessionId) return;

  if (pane.kind === "sftp") {
    void api.disconnectSftp(pane.sessionId).catch(() => {});
    return;
  }

  void api.disconnectSsh(pane.sessionId).catch(() => {});
}

async function defaultLocalTransferPath(fileName?: string) {
  try {
    const homeRoot = await homeDir();
    return fileName ? await join(homeRoot, fileName) : homeRoot;
  } catch {
    return fileName ? `~/${fileName}` : "~";
  }
}

function joinRemotePath(basePath: string, name: string) {
  const base = basePath.trim() || ".";
  const child = name.trim().replace(/^\/+/, "");
  if (!child) return base;
  if (base === ".") return child;
  if (base === "/") return `/${child}`;
  return `${base.replace(/\/+$/, "")}/${child}`;
}

function parentRemotePath(path: string) {
  const trimmed = path.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed === "." || trimmed === "/") return trimmed || ".";

  const separatorIndex = trimmed.lastIndexOf("/");
  if (separatorIndex <= 0) return separatorIndex === 0 ? "/" : ".";

  return trimmed.slice(0, separatorIndex);
}

function parentLocalPath(path: string) {
  const trimmed = path.trim().replace(/[\\/]+$/, "");
  if (!trimmed) return path;
  if (/^[A-Za-z]:$/.test(trimmed)) return `${trimmed}\\`;
  if (/^[A-Za-z]:[\\/]?$/.test(trimmed)) return trimmed;

  const separatorIndex = Math.max(
    trimmed.lastIndexOf("/"),
    trimmed.lastIndexOf("\\"),
  );
  if (separatorIndex < 0) return trimmed;

  const parent = trimmed.slice(0, separatorIndex);
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}\\`;
  return parent || trimmed;
}

function isSameRemotePath(left: string, right: string) {
  return normalizeRemotePath(left) === normalizeRemotePath(right);
}

function normalizeRemotePath(path: string) {
  const trimmed = path.trim().replace(/\/+$/, "");
  return trimmed || ".";
}

function isSameLocalPath(left: string, right: string) {
  return normalizeLocalPath(left) === normalizeLocalPath(right);
}

function normalizeLocalPath(path: string) {
  return path.trim().replace(/[\\/]+$/, "").toLowerCase();
}

function nextUniqueFileName(
  fileName: string,
  existingNames: string[],
  caseInsensitive = false,
) {
  const names = new Set(
    existingNames.map((name) => (caseInsensitive ? name.toLowerCase() : name)),
  );
  const normalize = (name: string) =>
    caseInsensitive ? name.toLowerCase() : name;
  if (!names.has(normalize(fileName))) return fileName;

  const { stem, extension } = splitFileName(fileName);
  for (let index = 1; index < 10000; index += 1) {
    const nextName = `${stem} (${index})${extension}`;
    if (!names.has(normalize(nextName))) return nextName;
  }

  return `${stem} (${crypto.randomUUID().slice(0, 8)})${extension}`;
}

function splitFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return { stem: fileName || "file", extension: "" };
  }

  return {
    stem: fileName.slice(0, dotIndex) || "file",
    extension: fileName.slice(dotIndex),
  };
}

function upsertSftpTransfer(
  transfers: SftpTransferInfo[],
  nextTransfer: SftpTransferInfo,
) {
  const index = transfers.findIndex(
    (transfer) => transfer.transferId === nextTransfer.transferId,
  );
  if (index < 0) return [...transfers, nextTransfer].slice(-20);

  const next = transfers.slice();
  next[index] = nextTransfer;
  return next;
}

interface WorkspaceDropTarget {
  tabId: string;
  paneId: string;
  side: WorkspaceDropSide;
}

interface TabReorderTarget {
  targetIndex: number;
}

function getWorkspaceDropSide(
  target: HTMLElement,
  point: TabDragPoint,
): WorkspaceDropSide {
  const rect = target.getBoundingClientRect();
  const x = point.x - rect.left;
  const y = point.y - rect.top;
  const distances = [
    { side: "left" as const, value: x },
    { side: "right" as const, value: rect.width - x },
    { side: "top" as const, value: y },
    { side: "bottom" as const, value: rect.height - y },
  ];

  return distances.reduce((closest, next) =>
    next.value < closest.value ? next : closest,
  ).side;
}

function clampTerminalFontSize(fontSize: number) {
  return Math.min(maxTerminalFontSize, Math.max(minTerminalFontSize, fontSize));
}

export default App;
