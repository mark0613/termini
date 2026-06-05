import { Search, Terminal } from "lucide-react";
import { SplitWorkspace } from "../components/SplitWorkspace";
import type { TerminalThemeConfig } from "../terminalThemes";
import { collectPanes, type TerminalTab } from "../terminalTree";
import type { SshProfile, Vault } from "../types";

export function SessionPage({
  activeTabId,
  activeVault,
  activeTheme,
  terminalFontSize,
  themeReady,
  profiles,
  tabs,
  visible,
  onClosePane,
  onConnect,
  onFocusPane,
  onPaneReady,
  onReconnectPane,
}: {
  activeTabId: string;
  activeVault: Vault | null;
  activeTheme: TerminalThemeConfig;
  terminalFontSize: number;
  themeReady: boolean;
  profiles: SshProfile[];
  tabs: TerminalTab[];
  visible: boolean;
  onClosePane: (paneId: string) => void;
  onConnect: (profile: SshProfile) => void;
  onFocusPane: (tabId: string, paneId: string) => void;
  onPaneReady: (paneId: string, cols: number, rows: number) => void;
  onReconnectPane: (paneId: string, cols: number, rows: number) => void;
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
                  activePaneId={tab.activePaneId}
                  activeTheme={activeTheme}
                  terminalFontSize={terminalFontSize}
                  node={tab.root}
                  onClosePane={onClosePane}
                  onFocusPane={(paneId) => onFocusPane(tab.id, paneId)}
                  onPaneReady={onPaneReady}
                  onReconnectPane={onReconnectPane}
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
}: {
  activeVault: Vault | null;
  profiles: SshProfile[];
  onConnect: (profile: SshProfile) => void;
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
            <button
              key={profile.id}
              type="button"
              className="grid grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-[#2b3044] bg-[#171b2c] p-3 text-left hover:border-[#1e9bff]"
              onClick={() => onConnect(profile)}
            >
              <span className="grid size-10 place-items-center rounded-xl bg-[#ff6726]">
                <Terminal size={18} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">
                  {profile.name}
                </span>
                <span className="block truncate text-xs text-[#8d93ad]">
                  {profile.username}@{profile.host}
                </span>
              </span>
            </button>
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
