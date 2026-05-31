import type { CSSProperties } from "react";
import type { SplitNodeState, TerminalPaneState, WorkspaceNode } from "../terminalTree";
import { TerminalPane } from "./TerminalPane";

interface SplitWorkspaceProps {
  node: WorkspaceNode;
  activePaneId: string;
  onFocusPane: (paneId: string) => void;
  onPaneReady: (paneId: string, cols: number, rows: number) => void;
  onClosePane: (paneId: string) => void;
}

export function SplitWorkspace({
  node,
  activePaneId,
  onFocusPane,
  onPaneReady,
  onClosePane,
}: SplitWorkspaceProps) {
  const paneLayouts = collectPaneLayouts(node);

  return (
    <div className="relative h-full min-h-0 min-w-0">
      {paneLayouts.map(({ pane, style }) => (
        <div
          key={pane.id}
          className="absolute min-h-0 min-w-0 p-0.5"
          style={style}
        >
          <TerminalPane
            pane={pane}
            active={pane.id === activePaneId}
            onFocus={() => onFocusPane(pane.id)}
            onReady={(cols, rows) => onPaneReady(pane.id, cols, rows)}
            onClose={() => onClosePane(pane.id)}
          />
        </div>
      ))}
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
