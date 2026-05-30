import type {
  SplitNodeState,
  WorkspaceNode,
} from "../terminalTree";
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
  if (node.type === "pane") {
    return (
      <TerminalPane
        pane={node}
        active={node.id === activePaneId}
        onFocus={() => onFocusPane(node.id)}
        onReady={(cols, rows) => onPaneReady(node.id, cols, rows)}
        onClose={() => onClosePane(node.id)}
      />
    );
  }

  return <SplitNode node={node} {...{ activePaneId, onFocusPane, onPaneReady, onClosePane }} />;
}

function SplitNode({
  node,
  activePaneId,
  onFocusPane,
  onPaneReady,
  onClosePane,
}: SplitWorkspaceProps & { node: SplitNodeState }) {
  return (
    <div
      className={`grid min-h-0 min-w-0 gap-1 ${
        node.direction === "vertical" ? "grid-cols-2" : "grid-rows-2"
      }`}
    >
      {node.children.map((child) => (
        <SplitWorkspace
          key={child.id}
          node={child}
          activePaneId={activePaneId}
          onFocusPane={onFocusPane}
          onPaneReady={onPaneReady}
          onClosePane={onClosePane}
        />
      ))}
    </div>
  );
}
