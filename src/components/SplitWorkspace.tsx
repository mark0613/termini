import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { TerminalThemeConfig } from "../terminalThemes";
import {
  DEFAULT_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  MIN_SPLIT_RATIO,
  clampSplitRatio,
  type SplitDirection,
  type SplitNodeState,
  type SftpPanelSide,
  type SftpSortField,
  type WorkspacePaneState,
  type WorkspaceDropSide,
  type WorkspaceNode,
} from "../terminalTree";
import type { RemoteFileEntry, SftpTransferInfo } from "../types";
import { SftpPane } from "./SftpPane";
import { TerminalPane } from "./TerminalPane";

export interface WorkspaceDropPreviewState {
  targetPaneId: string;
  side: WorkspaceDropSide;
}

interface SplitWorkspaceProps {
  tabId: string;
  node: WorkspaceNode;
  activePaneId: string;
  activeTheme: TerminalThemeConfig;
  dropPreview: WorkspaceDropPreviewState | null;
  terminalFontSize: number;
  sftpTransfers: SftpTransferInfo[];
  onFocusPane: (paneId: string) => void;
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
  onResizeSplit: (splitId: string, ratio: number) => void;
  onClosePane: (paneId: string) => void;
}

export function SplitWorkspace({
  tabId,
  node,
  activePaneId,
  activeTheme,
  dropPreview,
  terminalFontSize,
  sftpTransfers,
  onFocusPane,
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
  onResizeSplit,
  onClosePane,
}: SplitWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const resizeDragRef = useRef<SplitResizeDrag | null>(null);
  const [resizingSplitId, setResizingSplitId] = useState<string | null>(null);
  const paneLayouts = collectPaneLayouts(node);
  const resizeHandles = collectSplitResizeHandles(node);

  useEffect(() => {
    if (!resizingSplitId) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor =
      resizeDragRef.current?.direction === "vertical"
        ? "col-resize"
        : "row-resize";
    document.body.style.userSelect = "none";

    function handlePointerMove(event: PointerEvent) {
      const drag = resizeDragRef.current;
      if (!drag) return;

      event.preventDefault();
      updateSplitResize(event, drag, workspaceRef.current, onResizeSplit);
    }

    function finishResize() {
      resizeDragRef.current = null;
      setResizingSplitId(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
    };
  }, [onResizeSplit, resizingSplitId]);

  function startResize(
    handle: SplitResizeHandleLayout,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    resizeDragRef.current = {
      bounds: handle.bounds,
      direction: handle.direction,
      splitId: handle.splitId,
    };
    setResizingSplitId(handle.splitId);
  }

  return (
    <div ref={workspaceRef} className="relative h-full min-h-0 min-w-0">
      {paneLayouts.map(({ pane, style }) => (
        <div
          key={pane.id}
          className="absolute min-h-0 min-w-0 p-0.5"
          data-workspace-drop-pane-id={pane.id}
          data-workspace-drop-tab-id={tabId}
          style={style}
        >
          {pane.kind === "sftp" ? (
            <SftpPane
              pane={pane}
              active={pane.id === activePaneId}
              onClose={() => onClosePane(pane.id)}
              onCreateFolder={(side) => onSftpCreateFolder(pane.id, side)}
              onDelete={(side, entry) => onSftpDelete(pane.id, side, entry)}
              onDownload={(entry, localDirectoryPath) =>
                onSftpDownload(pane.id, entry, localDirectoryPath)
              }
              onFocus={() => onFocusPane(pane.id)}
              onNavigate={(side, path) => onSftpNavigate(pane.id, side, path)}
              onOpenTerminal={() => onOpenTerminalFromSftp(pane.id)}
              onReady={() => onSftpPaneReady(pane.id)}
              onRefresh={(side) => onSftpRefresh(pane.id, side)}
              onRename={(side, entry) => onSftpRename(pane.id, side, entry)}
              onSelect={(side, path) => onSftpSelect(pane.id, side, path)}
              onSort={(side, field) => onSftpSort(pane.id, side, field)}
              onToggleHidden={(side) => onSftpToggleHidden(pane.id, side)}
              onUpload={(entry, remoteDirectoryPath) =>
                onSftpUpload(pane.id, entry, remoteDirectoryPath)
              }
              transfers={sftpTransfers}
            />
          ) : (
            <TerminalPane
              pane={pane}
              active={pane.id === activePaneId}
              terminalTheme={activeTheme}
              terminalFontSize={pane.fontSize ?? terminalFontSize}
              onFocus={() => onFocusPane(pane.id)}
              onReady={(cols, rows) => onPaneReady(pane.id, cols, rows)}
              onReconnect={(cols, rows) => onReconnectPane(pane.id, cols, rows)}
              onOpenFiles={() => onOpenFilesFromTerminal(pane.id)}
              onClose={() => onClosePane(pane.id)}
            />
          )}
          {dropPreview?.targetPaneId === pane.id ? (
            <WorkspaceDropPreview side={dropPreview.side} />
          ) : null}
        </div>
      ))}
      {resizeHandles.map((handle) => (
        <SplitResizeHandle
          key={handle.splitId}
          active={resizingSplitId === handle.splitId}
          handle={handle}
          onPointerDown={startResize}
        />
      ))}
    </div>
  );
}

function WorkspaceDropPreview({ side }: { side: WorkspaceDropSide }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 rounded-sm border border-[#55c2a2] bg-[#06110e]/20">
      <div
        className={`absolute rounded-sm border border-[#55c2a2] bg-[#55c2a2]/22 shadow-[0_0_18px_rgba(85,194,162,0.24)] ${getPreviewSideClass(
          side,
        )}`}
      />
    </div>
  );
}

function getPreviewSideClass(side: WorkspaceDropSide) {
  switch (side) {
    case "left":
      return "inset-y-1 left-1 right-1/2";
    case "right":
      return "inset-y-1 right-1 left-1/2";
    case "top":
      return "inset-x-1 top-1 bottom-1/2";
    case "bottom":
      return "inset-x-1 bottom-1 top-1/2";
  }
}

function SplitResizeHandle({
  active,
  handle,
  onPointerDown,
}: {
  active: boolean;
  handle: SplitResizeHandleLayout;
  onPointerDown: (
    handle: SplitResizeHandleLayout,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
}) {
  const vertical = handle.direction === "vertical";
  const orientation = vertical ? "vertical" : "horizontal";
  const cursorClass = vertical ? "cursor-col-resize" : "cursor-row-resize";
  const lineShapeClass = vertical
    ? "h-[calc(100%-8px)] w-px"
    : "h-px w-[calc(100%-8px)]";

  return (
    <div
      aria-label="Resize split panels"
      aria-orientation={orientation}
      aria-valuemax={Math.round(MAX_SPLIT_RATIO * 100)}
      aria-valuemin={Math.round(MIN_SPLIT_RATIO * 100)}
      aria-valuenow={Math.round(handle.ratio * 100)}
      className={`group absolute z-40 flex touch-none select-none items-center justify-center rounded-sm outline-none transition-colors ${cursorClass} ${
        active ? "bg-[#55c2a2]/14" : "hover:bg-[#55c2a2]/10"
      }`}
      onPointerDown={(event) => onPointerDown(handle, event)}
      role="separator"
      style={handle.style}
      tabIndex={-1}
    >
      <span
        className={`block rounded-full transition-colors ${lineShapeClass} ${
          active ? "bg-[#55c2a2]" : "bg-[#465067] group-hover:bg-[#55c2a2]"
        }`}
      />
    </div>
  );
}

function collectPaneLayouts(
  node: WorkspaceNode,
  bounds: PaneBounds = { x: 0, y: 0, width: 100, height: 100 },
): PaneLayout[] {
  if (node.type === "pane") {
    return [{ pane: node, style: toStyle(bounds) }];
  }

  const [firstBounds, secondBounds] = getSplitChildBounds(node, bounds);
  return [
    ...collectPaneLayouts(node.children[0], firstBounds),
    ...collectPaneLayouts(node.children[1], secondBounds),
  ];
}

function collectSplitResizeHandles(
  node: WorkspaceNode,
  bounds: PaneBounds = { x: 0, y: 0, width: 100, height: 100 },
): SplitResizeHandleLayout[] {
  if (node.type === "pane") {
    return [];
  }

  const ratio = splitRatio(node);
  const [firstBounds, secondBounds] = getSplitChildBounds(node, bounds);
  return [
    {
      bounds,
      direction: node.direction,
      ratio,
      splitId: node.id,
      style: toResizeHandleStyle(node.direction, bounds, ratio),
    },
    ...collectSplitResizeHandles(node.children[0], firstBounds),
    ...collectSplitResizeHandles(node.children[1], secondBounds),
  ];
}

function getSplitChildBounds(
  node: SplitNodeState,
  bounds: PaneBounds,
): [PaneBounds, PaneBounds] {
  const ratio = splitRatio(node);

  if (node.direction === "vertical") {
    const firstWidth = bounds.width * ratio;
    return [
      { ...bounds, width: firstWidth },
      {
        ...bounds,
        x: bounds.x + firstWidth,
        width: bounds.width - firstWidth,
      },
    ];
  }

  const firstHeight = bounds.height * ratio;
  return [
    { ...bounds, height: firstHeight },
    {
      ...bounds,
      y: bounds.y + firstHeight,
      height: bounds.height - firstHeight,
    },
  ];
}

function updateSplitResize(
  event: PointerEvent,
  drag: SplitResizeDrag,
  workspace: HTMLDivElement | null,
  onResizeSplit: (splitId: string, ratio: number) => void,
) {
  if (!workspace) return;

  const workspaceRect = workspace.getBoundingClientRect();
  const ratio =
    drag.direction === "vertical"
      ? horizontalPointerRatio(event, drag.bounds, workspaceRect)
      : verticalPointerRatio(event, drag.bounds, workspaceRect);

  if (ratio !== null) {
    onResizeSplit(drag.splitId, ratio);
  }
}

function horizontalPointerRatio(
  event: PointerEvent,
  bounds: PaneBounds,
  workspaceRect: DOMRect,
) {
  const splitWidth = workspaceRect.width * (bounds.width / 100);
  if (splitWidth <= 0) return null;

  const splitLeft = workspaceRect.left + workspaceRect.width * (bounds.x / 100);
  return clampSplitRatio((event.clientX - splitLeft) / splitWidth);
}

function verticalPointerRatio(
  event: PointerEvent,
  bounds: PaneBounds,
  workspaceRect: DOMRect,
) {
  const splitHeight = workspaceRect.height * (bounds.height / 100);
  if (splitHeight <= 0) return null;

  const splitTop = workspaceRect.top + workspaceRect.height * (bounds.y / 100);
  return clampSplitRatio((event.clientY - splitTop) / splitHeight);
}

function toResizeHandleStyle(
  direction: SplitDirection,
  bounds: PaneBounds,
  ratio: number,
): CSSProperties {
  if (direction === "vertical") {
    return {
      top: `${bounds.y}%`,
      left: `${bounds.x + bounds.width * ratio}%`,
      width: 12,
      height: `${bounds.height}%`,
      transform: "translateX(-50%)",
    };
  }

  return {
    top: `${bounds.y + bounds.height * ratio}%`,
    left: `${bounds.x}%`,
    width: `${bounds.width}%`,
    height: 12,
    transform: "translateY(-50%)",
  };
}

function splitRatio(node: SplitNodeState) {
  return clampSplitRatio(node.ratio ?? DEFAULT_SPLIT_RATIO);
}

function toStyle(bounds: PaneBounds): CSSProperties {
  return {
    top: `${bounds.y}%`,
    left: `${bounds.x}%`,
    width: `${bounds.width}%`,
    height: `${bounds.height}%`,
  };
}

interface PaneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PaneLayout {
  pane: WorkspacePaneState;
  style: CSSProperties;
}

interface SplitResizeDrag {
  bounds: PaneBounds;
  direction: SplitDirection;
  splitId: string;
}

interface SplitResizeHandleLayout extends SplitResizeDrag {
  ratio: number;
  style: CSSProperties;
}
