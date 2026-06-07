import { FolderSync, Search, Terminal } from "lucide-react";
import {
  SplitWorkspace,
  type WorkspaceDropPreviewState,
} from "../components/SplitWorkspace";
import type { TerminalThemeConfig } from "../terminalThemes";
import {
  collectPanes,
  type SftpPanelSide,
  type SftpSortField,
  type TerminalTab,
} from "../terminalTree";
import type { RemoteFileEntry, SftpTransferInfo, SshProfile, Vault } from "../types";

export interface WorkspaceDropPreview extends WorkspaceDropPreviewState {
  targetTabId: string;
}

export function SessionPage({
  activeTabId,
  activeVault,
  activeTheme,
  dropPreview,
  terminalFontSize,
  themeReady,
  profiles,
  sftpTransfers,
  tabs,
  visible,
  onClosePane,
  onConnect,
  onFocusPane,
  onOpenFiles,
  onPaneReady,
  onReconnectPane,
  onSftpNavigate,
  onSftpPaneReady,
  onSftpRefresh,
  onSftpSelect,
  onSftpSort,
  onSftpToggleHidden,
  onSftpUpload,
  onSftpDownload,
  onSftpCreateFolder,
  onSftpRename,
  onSftpDelete,
  onOpenFilesFromTerminal,
  onOpenTerminalFromSftp,
}: {
  activeTabId: string;
  activeVault: Vault | null;
  activeTheme: TerminalThemeConfig;
  dropPreview: WorkspaceDropPreview | null;
  terminalFontSize: number;
  themeReady: boolean;
  profiles: SshProfile[];
  sftpTransfers: SftpTransferInfo[];
  tabs: TerminalTab[];
  visible: boolean;
  onClosePane: (paneId: string) => void;
  onConnect: (profile: SshProfile) => void;
  onFocusPane: (tabId: string, paneId: string) => void;
  onOpenFiles: (profile: SshProfile) => void;
  onPaneReady: (paneId: string, cols: number, rows: number) => void;
  onReconnectPane: (paneId: string, cols: number, rows: number) => void;
  onSftpNavigate: (paneId: string, side: SftpPanelSide, path: string) => void;
  onSftpPaneReady: (paneId: string) => void;
  onSftpRefresh: (paneId: string, side: SftpPanelSide) => void;
  onSftpSelect: (
    paneId: string,
    side: SftpPanelSide,
    path: string | null,
  ) => void;
  onSftpSort: (
    paneId: string,
    side: SftpPanelSide,
    field: SftpSortField,
  ) => void;
  onSftpToggleHidden: (paneId: string, side: SftpPanelSide) => void;
  onSftpUpload: (
    paneId: string,
    entry: RemoteFileEntry,
    remoteDirectoryPath?: string,
  ) => void;
  onSftpDownload: (
    paneId: string,
    entry: RemoteFileEntry,
    localDirectoryPath?: string,
  ) => void;
  onSftpCreateFolder: (paneId: string, side: SftpPanelSide) => void;
  onSftpRename: (
    paneId: string,
    side: SftpPanelSide,
    entry: RemoteFileEntry,
  ) => void;
  onSftpDelete: (
    paneId: string,
    side: SftpPanelSide,
    entry: RemoteFileEntry,
  ) => void;
  onOpenFilesFromTerminal: (paneId: string) => void;
  onOpenTerminalFromSftp: (paneId: string) => void;
}) {
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const emptyTab = activeTab
    ? collectPanes(activeTab.root).every((pane) => !pane.profileId)
    : true;

  return (
    <section
      className={`min-h-0 grid-rows-[minmax(0,1fr)] bg-[#111522] ${
        visible ? "grid" : "hidden"
      }`}
    >
      <div className="relative min-h-0 bg-[#0d1116]">
        {themeReady && activeTab && !emptyTab ? (
          tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const tabEmpty = collectPanes(tab.root).every((pane) => !pane.profileId);
            if (tabEmpty) return null;

            return (
              <div
                key={tab.id}
                className={`absolute inset-3 min-h-0 min-w-0 ${
                  isActive ? "visible" : "invisible pointer-events-none"
                }`}
                aria-hidden={!isActive}
              >
                <SplitWorkspace
                  tabId={tab.id}
                  activePaneId={tab.activePaneId}
                  activeTheme={activeTheme}
                  dropPreview={
                    dropPreview?.targetTabId === tab.id ? dropPreview : null
                  }
                  terminalFontSize={terminalFontSize}
                  sftpTransfers={sftpTransfers}
                  node={tab.root}
                  onClosePane={onClosePane}
                  onFocusPane={(paneId) => onFocusPane(tab.id, paneId)}
                  onPaneReady={onPaneReady}
                  onReconnectPane={onReconnectPane}
                  onSftpNavigate={onSftpNavigate}
                  onSftpPaneReady={onSftpPaneReady}
                  onSftpRefresh={onSftpRefresh}
                  onSftpSelect={onSftpSelect}
                  onSftpSort={onSftpSort}
                  onSftpToggleHidden={onSftpToggleHidden}
                  onSftpUpload={onSftpUpload}
                  onSftpDownload={onSftpDownload}
                  onSftpCreateFolder={onSftpCreateFolder}
                  onSftpRename={onSftpRename}
                  onSftpDelete={onSftpDelete}
                  onOpenFilesFromTerminal={onOpenFilesFromTerminal}
                  onOpenTerminalFromSftp={onOpenTerminalFromSftp}
                />
              </div>
            );
          })
        ) : (
          <div className="h-full p-3">
            <SessionEmptyState
              activeVault={activeVault}
              profiles={profiles}
              onConnect={onConnect}
              onOpenFiles={onOpenFiles}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function SessionEmptyState({
  activeVault,
  profiles,
  onConnect,
  onOpenFiles,
}: {
  activeVault: Vault | null;
  profiles: SshProfile[];
  onConnect: (profile: SshProfile) => void;
  onOpenFiles: (profile: SshProfile) => void;
}) {
  const recentProfiles = profiles.slice(0, 6);
  return (
    <div className="grid h-full place-items-center">
      <div className="grid w-full max-w-3xl gap-4">
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#8d93ad]"
          />
          <input
            className="h-12 w-full rounded-xl border border-[#2b3044] bg-[#171b2c] pr-4 pl-11 text-sm outline-none placeholder:text-[#8d93ad] focus:border-[#1e9bff]"
            placeholder="Find a host or ssh user@hostname..."
          />
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {recentProfiles.map((profile) => (
            <article
              key={profile.id}
              className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-[#2b3044] bg-[#171b2c] p-3"
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-md bg-[#ff6726] text-white hover:bg-[#ff7f47]"
                  aria-label={`Open terminal for ${profile.name}`}
                  onClick={() => onConnect(profile)}
                >
                  <Terminal size={17} />
                </button>
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-md bg-[#1f3a34] text-[#d8fff3] hover:bg-[#294b43]"
                  aria-label={`Open files for ${profile.name}`}
                  onClick={() => onOpenFiles(profile)}
                >
                  <FolderSync size={17} />
                </button>
              </div>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">
                  {profile.name}
                </span>
                <span className="block truncate text-xs text-[#8d93ad]">
                  {profile.username}@{profile.host}
                </span>
              </span>
            </article>
          ))}
        </div>
        {!recentProfiles.length ? (
          <div className="rounded-xl border border-dashed border-[#2b3044] bg-[#171b2c] p-8 text-center text-sm text-[#8d93ad]">
            {activeVault ? "No hosts" : "No vault selected"}
          </div>
        ) : null}
      </div>
    </div>
  );
}
