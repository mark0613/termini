import {
  Search,
  SplitSquareHorizontal,
  SplitSquareVertical,
  Terminal,
} from "lucide-react";
import { SplitWorkspace } from "../components/SplitWorkspace";
import { IconButton } from "../components/ui";
import { collectPanes, type SplitDirection, type TerminalTab } from "../terminalTree";
import type { SshProfile, Vault } from "../types";

export function SessionPage({
  activeTab,
  activeVault,
  profiles,
  sessionPaneCount,
  onClosePane,
  onConnect,
  onFocusPane,
  onPaneReady,
  onSplit,
}: {
  activeTab: TerminalTab | null;
  activeVault: Vault | null;
  profiles: SshProfile[];
  sessionPaneCount: number;
  onClosePane: (paneId: string) => void;
  onConnect: (profile: SshProfile) => void;
  onFocusPane: (paneId: string) => void;
  onPaneReady: (paneId: string, cols: number, rows: number) => void;
  onSplit: (direction: SplitDirection) => void;
}) {
  const emptyTab = activeTab
    ? collectPanes(activeTab.root).every((pane) => !pane.profileId)
    : true;

  return (
    <section className="grid min-h-0 grid-rows-[40px_minmax(0,1fr)] bg-[#111522]">
      <header className="flex min-w-0 items-center justify-end gap-1 border-b border-[#2b3044] bg-[#171b2c] px-2">
        <IconButton label="Split vertical" onClick={() => onSplit("vertical")}>
          <SplitSquareVertical size={17} />
        </IconButton>
        <IconButton label="Split horizontal" onClick={() => onSplit("horizontal")}>
          <SplitSquareHorizontal size={17} />
        </IconButton>
        <span className="px-2 text-xs text-[#8d93ad]">
          {sessionPaneCount} panes
        </span>
      </header>

      <div className="min-h-0 bg-[#0d1116] p-3">
        {activeTab && !emptyTab ? (
          <SplitWorkspace
            activePaneId={activeTab.activePaneId}
            node={activeTab.root}
            onClosePane={onClosePane}
            onFocusPane={onFocusPane}
            onPaneReady={onPaneReady}
          />
        ) : (
          <SessionEmptyState
            activeVault={activeVault}
            profiles={profiles}
            onConnect={onConnect}
          />
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
