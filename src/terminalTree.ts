import type { SshProfile } from "./types";

export type SplitDirection = "vertical" | "horizontal";

export interface TerminalPaneState {
  type: "pane";
  id: string;
  profileId: string | null;
  sessionId: string | null;
  title: string;
  status: string;
  message: string | null;
}

export interface SplitNodeState {
  type: "split";
  id: string;
  direction: SplitDirection;
  children: [WorkspaceNode, WorkspaceNode];
}

export type WorkspaceNode = TerminalPaneState | SplitNodeState;

export interface TerminalTab {
  id: string;
  title: string;
  root: WorkspaceNode;
  activePaneId: string;
}

export function createPane(profile?: SshProfile): TerminalPaneState {
  return {
    type: "pane",
    id: crypto.randomUUID(),
    profileId: profile?.id ?? null,
    sessionId: null,
    title: profile?.name ?? "Shell",
    status: profile ? "pending" : "idle",
    message: null,
  };
}

export function createTab(profile?: SshProfile): TerminalTab {
  const pane = createPane(profile);
  return {
    id: crypto.randomUUID(),
    title: profile?.name ?? "New tab",
    root: pane,
    activePaneId: pane.id,
  };
}

export function updatePane(
  node: WorkspaceNode,
  paneId: string,
  updater: (pane: TerminalPaneState) => TerminalPaneState,
): WorkspaceNode {
  if (node.type === "pane") {
    return node.id === paneId ? updater(node) : node;
  }

  return {
    ...node,
    children: [
      updatePane(node.children[0], paneId, updater),
      updatePane(node.children[1], paneId, updater),
    ],
  };
}

export function updatePaneBySession(
  node: WorkspaceNode,
  sessionId: string,
  updater: (pane: TerminalPaneState) => TerminalPaneState,
): WorkspaceNode {
  if (node.type === "pane") {
    return node.sessionId === sessionId ? updater(node) : node;
  }

  return {
    ...node,
    children: [
      updatePaneBySession(node.children[0], sessionId, updater),
      updatePaneBySession(node.children[1], sessionId, updater),
    ],
  };
}

export function findPane(
  node: WorkspaceNode,
  paneId: string,
): TerminalPaneState | null {
  if (node.type === "pane") {
    return node.id === paneId ? node : null;
  }

  return findPane(node.children[0], paneId) ?? findPane(node.children[1], paneId);
}

export function findFirstPane(node: WorkspaceNode): TerminalPaneState {
  return node.type === "pane" ? node : findFirstPane(node.children[0]);
}

export function collectPanes(node: WorkspaceNode): TerminalPaneState[] {
  if (node.type === "pane") {
    return [node];
  }

  return [...collectPanes(node.children[0]), ...collectPanes(node.children[1])];
}

export function splitPane(
  node: WorkspaceNode,
  paneId: string,
  direction: SplitDirection,
): { node: WorkspaceNode; newPaneId: string | null } {
  if (node.type === "pane") {
    if (node.id !== paneId) {
      return { node, newPaneId: null };
    }

    const newPane: TerminalPaneState = {
      ...createPane(),
      profileId: node.profileId,
      title: node.title,
      status: node.profileId ? "pending" : "idle",
    };

    return {
      node: {
        type: "split",
        id: crypto.randomUUID(),
        direction,
        children: [node, newPane],
      },
      newPaneId: newPane.id,
    };
  }

  const first = splitPane(node.children[0], paneId, direction);
  if (first.newPaneId) {
    return {
      node: { ...node, children: [first.node, node.children[1]] },
      newPaneId: first.newPaneId,
    };
  }

  const second = splitPane(node.children[1], paneId, direction);
  return {
    node: { ...node, children: [node.children[0], second.node] },
    newPaneId: second.newPaneId,
  };
}

export function removePane(
  node: WorkspaceNode,
  paneId: string,
): { node: WorkspaceNode | null; removed: TerminalPaneState | null } {
  if (node.type === "pane") {
    return node.id === paneId
      ? { node: null, removed: node }
      : { node, removed: null };
  }

  const first = removePane(node.children[0], paneId);
  if (first.removed) {
    return {
      node: first.node ? { ...node, children: [first.node, node.children[1]] } : node.children[1],
      removed: first.removed,
    };
  }

  const second = removePane(node.children[1], paneId);
  if (second.removed) {
    return {
      node: second.node ? { ...node, children: [node.children[0], second.node] } : node.children[0],
      removed: second.removed,
    };
  }

  return { node, removed: null };
}
