import { Database, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRef } from "react";
import type { AppPage } from "../appTypes";
import type { TerminalTab } from "../terminalTree";

const appWindow = getCurrentWindow();

export function AppHeader({
  activePage,
  activeTabId,
  tabs,
  onCloseTab,
  onSelectTab,
  reorderPreview,
  onTabDragMove,
  onTabDragStart,
  onTabDrop,
  onVaultsClick,
}: {
  activePage: AppPage;
  activeTabId: string;
  tabs: TerminalTab[];
  onCloseTab: (tabId: string) => void;
  onSelectTab: (tabId: string) => void;
  reorderPreview: TabReorderPreview | null;
  onTabDragMove: (tabId: string, point: TabDragPoint) => void;
  onTabDragStart: (tabId: string, point: TabDragPoint) => void;
  onTabDrop: (tabId: string, point: TabDragPoint) => void;
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
      <div
        className="flex min-w-0 flex-1 items-center gap-2"
        data-tab-reorder-list="true"
      >
        <TopPageButton
          active={activePage === "vaults"}
          label="Vaults"
          onClick={onVaultsClick}
        >
          <Database size={16} />
          <span>Vaults</span>
        </TopPageButton>
        {tabs.map((tab, index) => (
          <TabReorderSlot
            key={tab.id}
            active={reorderPreview?.targetIndex === index}
          >
            <HostTabButton
              active={activePage === "session" && tab.id === activeTabId}
              canDrag={activePage === "session"}
              tab={tab}
              onClose={() => onCloseTab(tab.id)}
              onDragMove={(point) => onTabDragMove(tab.id, point)}
              onDragStart={(point) => onTabDragStart(tab.id, point)}
              onDrop={(point) => onTabDrop(tab.id, point)}
              onSelect={() => onSelectTab(tab.id)}
            />
          </TabReorderSlot>
        ))}
        <TabReorderSlot active={reorderPreview?.targetIndex === tabs.length} />
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

function TabReorderSlot({
  active,
  children,
}: {
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative h-8">
      {active ? (
        <span className="pointer-events-none absolute top-1 bottom-1 -left-1 z-50 w-0.5 rounded-full bg-[#55c2a2] shadow-[0_0_10px_rgba(85,194,162,0.5)]" />
      ) : null}
      {children}
    </div>
  );
}

function HostTabButton({
  active,
  canDrag,
  tab,
  onDragMove,
  onDragStart,
  onDrop,
  onSelect,
  onClose,
}: {
  active: boolean;
  canDrag: boolean;
  tab: TerminalTab;
  onDragMove: (point: TabDragPoint) => void;
  onDragStart: (point: TabDragPoint) => void;
  onDrop: (point: TabDragPoint) => void;
  onSelect: () => void;
  onClose: () => void;
}) {
  const pointerStartRef = useRef<TabPointerStart | null>(null);
  const draggingRef = useRef(false);
  const suppressClickRef = useRef(false);

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!canDrag || event.button !== 0) {
      return;
    }

    event.stopPropagation();
    pointerStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const point = toTabDragPoint(event);
    const moved = Math.hypot(point.x - start.x, point.y - start.y);
    if (!draggingRef.current && moved < 4) return;

    event.preventDefault();
    event.stopPropagation();

    if (!draggingRef.current) {
      draggingRef.current = true;
      suppressClickRef.current = true;
      onDragStart(point);
    }
    onDragMove(point);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    finishPointerDrag(event, true);
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLButtonElement>) {
    finishPointerDrag(event, false);
  }

  function finishPointerDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    commit: boolean,
  ) {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    pointerStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!draggingRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = false;

    if (commit) {
      onDrop(toTabDragPoint(event));
    } else {
      onDrop({ x: Number.NaN, y: Number.NaN });
    }
  }

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onSelect();
  }

  return (
    <div
      data-tab-reorder-tab-id={tab.id}
      className={`flex h-8 min-w-32 max-w-56 items-center rounded-lg border ${
        active
          ? "border-[#2b3044] bg-[#262b42] text-white"
          : "border-transparent bg-[#1c2134] text-[#d5daf0] hover:bg-[#262b42]"
      }`}
    >
      <button
        type="button"
        className="min-w-0 flex-1 px-3 text-left text-sm font-semibold"
        onClick={handleClick}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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

export interface TabDragPoint {
  x: number;
  y: number;
}

export interface TabReorderPreview {
  targetIndex: number;
}

interface TabPointerStart extends TabDragPoint {
  pointerId: number;
}

function toTabDragPoint(event: React.PointerEvent<HTMLButtonElement>): TabDragPoint {
  return { x: event.clientX, y: event.clientY };
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
