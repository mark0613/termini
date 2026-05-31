import { Database, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppPage } from "../appTypes";
import type { TerminalTab } from "../terminalTree";

const appWindow = getCurrentWindow();

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
  async function handleHeaderMouseDown(event: React.MouseEvent<HTMLElement>) {
    if (event.button !== 0 || isWindowControlTarget(event.target)) {
      return;
    }

    await appWindow.startDragging();
  }

  return (
    <header
      className="flex min-w-0 items-center justify-between border-b border-[#2b3044] bg-[#111426] px-3"
      onMouseDown={handleHeaderMouseDown}
    >
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

      <div className="flex items-center text-[#8d93ad]">
        <WindowButton label="Minimize" onClick={() => appWindow.minimize()}>
          <Minus size={16} />
        </WindowButton>
        <WindowButton label="Maximize" onClick={() => appWindow.toggleMaximize()}>
          <Square size={14} />
        </WindowButton>
        <WindowButton
          label="Close"
          onClick={() => appWindow.close()}
          variant="danger"
        >
          <X size={17} />
        </WindowButton>
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

function isWindowControlTarget(target: EventTarget) {
  return target instanceof Element && Boolean(target.closest("button"));
}

function WindowButton({
  children,
  label,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => Promise<void>;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`grid size-9 place-items-center rounded-md ${
        variant === "danger"
          ? "hover:bg-[#ff5c7a] hover:text-white"
          : "hover:bg-[#262b42] hover:text-white"
      }`}
      onClick={() => {
        void onClick();
      }}
    >
      {children}
    </button>
  );
}
