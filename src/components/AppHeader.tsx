import { Database, Minus, Square, X } from "lucide-react";
import type { AppPage } from "../appTypes";
import type { TerminalTab } from "../terminalTree";

export function AppHeader({
  activePage,
  activeTabId,
  tabs,
  onCloseTab,
  onSelectTab,
  onVaultsClick,
}: {
  activePage: AppPage;
  activeTabId: string;
  tabs: TerminalTab[];
  onCloseTab: (tabId: string) => void;
  onSelectTab: (tabId: string) => void;
  onVaultsClick: () => void;
}) {
  return (
    <header className="flex min-w-0 items-center justify-between border-b border-[#2b3044] bg-[#111426] px-3">
      <div className="flex min-w-0 items-center gap-2">
        <TopPageButton
          active={activePage === "vaults"}
          label="Vaults"
          onClick={onVaultsClick}
        >
          <Database size={16} />
          <span>Vaults</span>
        </TopPageButton>
        {tabs.map((tab) => (
          <HostTabButton
            key={tab.id}
            active={activePage === "session" && tab.id === activeTabId}
            tab={tab}
            onClose={() => onCloseTab(tab.id)}
            onSelect={() => onSelectTab(tab.id)}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 text-[#8d93ad]">
        <Minus size={14} />
        <Square size={12} />
        <X size={16} />
      </div>
    </header>
  );
}

function TopPageButton({
  active,
  children,
  label,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-8 min-w-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold ${
        active
          ? "border-[#2b3044] bg-[#262b42] text-white"
          : "border-transparent bg-[#1c2134] text-[#d5daf0] hover:bg-[#262b42]"
      }`}
    >
      {children}
    </button>
  );
}

function HostTabButton({
  active,
  tab,
  onSelect,
  onClose,
}: {
  active: boolean;
  tab: TerminalTab;
  onSelect: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className={`flex h-8 min-w-32 max-w-56 items-center rounded-lg border ${
        active
          ? "border-[#2b3044] bg-[#262b42] text-white"
          : "border-transparent bg-[#1c2134] text-[#d5daf0] hover:bg-[#262b42]"
      }`}
    >
      <button
        type="button"
        className="min-w-0 flex-1 px-3 text-left text-sm font-semibold"
        onClick={onSelect}
      >
        <span className="block truncate">{tab.title}</span>
      </button>
      <button
        type="button"
        className="grid size-8 shrink-0 place-items-center text-[#9ca4bf] hover:text-[#ffb8c0]"
        onClick={onClose}
        aria-label={`Close ${tab.title}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}
