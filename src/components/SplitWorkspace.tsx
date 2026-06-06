import type { CSSProperties } from "react";
import type { TerminalThemeConfig } from "../terminalThemes";
import type {
  SplitNodeState,
  TerminalPaneState,
  WorkspaceDropSide,
  WorkspaceNode,
} from "../terminalTree";
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
  onFocusPane: (paneId: string) => void;
  onPaneReady: (paneId: string, cols: number, rows: number) => void;
  onReconnectPane: (paneId: string, cols: number, rows: number) => void;
  onClosePane: (paneId: string) => void;
}

export function SplitWorkspace({
  tabId,
  node,
  activePaneId,
  activeTheme,
  dropPreview,
  terminalFontSize,
  onFocusPane,
  onPaneReady,
  onReconnectPane,
  onClosePane,
}: SplitWorkspaceProps) {
  const paneLayouts = collectPaneLayouts(node);

  return (
    <div className="relative h-full min-h-0 min-w-0">
      {paneLayouts.map(({ pane, style }) => (
        <div
          key={pane.id}
          className="absolute min-h-0 min-w-0 p-0.5"
          data-workspace-drop-pane-id={pane.id}
          data-workspace-drop-tab-id={tabId}
          style={style}
        >
          <TerminalPane
            pane={pane}
            active={pane.id === activePaneId}
            terminalTheme={activeTheme}
            terminalFontSize={pane.fontSize ?? terminalFontSize}
            onFocus={() => onFocusPane(pane.id)}
            onReady={(cols, rows) => onPaneReady(pane.id, cols, rows)}
            onReconnect={(cols, rows) => onReconnectPane(pane.id, cols, rows)}
            onClose={() => onClosePane(pane.id)}
          />
          {dropPreview?.targetPaneId === pane.id ? (
            <WorkspaceDropPreview side={dropPreview.side} />
          ) : null}
        </div>
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

function collectPaneLayouts(
  node: WorkspaceNode,
  bounds: PaneBounds = { x: 0, y: 0, width: 100, height: 100 },
): PaneLayout[] {
  if (node.type === "pane") {
    return [{ pane: node, style: toStyle(bounds) }];
  }

  return node.direction === "vertical"
    ? collectVerticalLayouts(node, bounds)
    : collectHorizontalLayouts(node, bounds);
}

function collectVerticalLayouts(node: SplitNodeState, bounds: PaneBounds) {
  const width = bounds.width / 2;
  return [
    ...collectPaneLayouts(node.children[0], { ...bounds, width }),
    ...collectPaneLayouts(node.children[1], {
      ...bounds,
      x: bounds.x + width,
      width,
    }),
  ];
}

function collectHorizontalLayouts(node: SplitNodeState, bounds: PaneBounds) {
  const height = bounds.height / 2;
  return [
    ...collectPaneLayouts(node.children[0], { ...bounds, height }),
    ...collectPaneLayouts(node.children[1], {
      ...bounds,
      y: bounds.y + height,
      height,
    }),
  ];
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
  pane: TerminalPaneState;
  style: CSSProperties;
}
