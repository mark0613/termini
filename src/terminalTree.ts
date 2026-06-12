import type { RemoteFileEntry, SshProfile } from "./types";

export type SplitDirection = "vertical" | "horizontal";
export type WorkspaceDropSide = "left" | "right" | "top" | "bottom";
export type SftpPanelSide = "local" | "remote";
export type SftpSortField = "name" | "size" | "modified";
export type SftpSortDirection = "asc" | "desc";

export const DEFAULT_TERMINAL_FONT_SIZE = 15;
export const WORKSPACE_TAB_TITLE = "Workspace";

export interface WorkspacePaneBase {
  type: "pane";
  id: string;
  kind: "terminal" | "sftp";
  profileId: string | null;
  sessionId: string | null;
  title: string;
  endpoint: string | null;
  status: string;
  message: string | null;
}

export interface TerminalPaneState extends WorkspacePaneBase {
  kind: "terminal";
  fontSize: number;
}

export interface SftpPaneState extends WorkspacePaneBase {
  kind: "sftp";
  localPath: string;
  localEntries: RemoteFileEntry[];
  localSelectedPath: string | null;
  localSortBy: SftpSortField;
  localSortDirection: SftpSortDirection;
  localShowHidden: boolean;
  localStatus: string;
  localMessage: string | null;
  remotePath: string;
  remoteEntries: RemoteFileEntry[];
  remoteSelectedPath: string | null;
  remoteSortBy: SftpSortField;
  remoteSortDirection: SftpSortDirection;
  remoteShowHidden: boolean;
}

export interface SplitNodeState {
  type: "split";
  id: string;
  direction: SplitDirection;
  children: [WorkspaceNode, WorkspaceNode];
}

export type WorkspacePaneState = TerminalPaneState | SftpPaneState;
export type WorkspaceNode = WorkspacePaneState | SplitNodeState;

export interface TerminalTab {
  id: string;
  title: string;
  root: WorkspaceNode;
  activePaneId: string;
  workspace: boolean;
}

export function createTerminalPane(
  profile?: SshProfile,
  fontSize = DEFAULT_TERMINAL_FONT_SIZE,
): TerminalPaneState {
  return {
    type: "pane",
    id: crypto.randomUUID(),
    kind: "terminal",
    profileId: profile?.id ?? null,
    sessionId: null,
    title: profile?.name ?? "Shell",
    endpoint: profile
      ? `${profile.username}@${profile.host}:${profile.port}`
      : null,
    status: profile ? "pending" : "idle",
    message: null,
    fontSize,
  };
}

export function createSftpPane(profile?: SshProfile): SftpPaneState {
  return {
    type: "pane",
    id: crypto.randomUUID(),
    kind: "sftp",
    profileId: profile?.id ?? null,
    sessionId: null,
    title: profile ? `${profile.name} Files` : "Files",
    endpoint: profile
      ? `${profile.username}@${profile.host}:${profile.port}`
      : null,
    status: profile ? "pending" : "idle",
    message: null,
    localPath: "",
    localEntries: [],
    localSelectedPath: null,
    localSortBy: "name",
    localSortDirection: "asc",
    localShowHidden: false,
    localStatus: "pending",
    localMessage: null,
    remotePath: "",
    remoteEntries: [],
    remoteSelectedPath: null,
    remoteSortBy: "name",
    remoteSortDirection: "asc",
    remoteShowHidden: false,
  };
}

export function createTab(
  profile?: SshProfile,
  kind: WorkspacePaneState["kind"] = "terminal",
): TerminalTab {
  const pane =
    kind === "sftp" ? createSftpPane(profile) : createTerminalPane(profile);
  return {
    id: crypto.randomUUID(),
    title: profile
      ? kind === "sftp"
        ? `${profile.name} Files`
        : profile.name
      : "New tab",
    root: pane,
    activePaneId: pane.id,
    workspace: false,
  };
}

export function canDragTabIntoWorkspace(tab: TerminalTab): boolean {
  return !tab.workspace && tab.root.type === "pane";
}

export function updatePane(
  node: WorkspaceNode,
  paneId: string,
  updater: (pane: WorkspacePaneState) => WorkspacePaneState,
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
  updater: (pane: WorkspacePaneState) => WorkspacePaneState,
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
): WorkspacePaneState | null {
  if (node.type === "pane") {
    return node.id === paneId ? node : null;
  }

  return findPane(node.children[0], paneId) ?? findPane(node.children[1], paneId);
}

export function findFirstPane(node: WorkspaceNode): WorkspacePaneState {
  return node.type === "pane" ? node : findFirstPane(node.children[0]);
}

export function collectPanes(node: WorkspaceNode): WorkspacePaneState[] {
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

    const newPane: WorkspacePaneState = {
      ...clonePaneForSplit(node),
      profileId: node.profileId,
      title: node.title,
      endpoint: node.endpoint,
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

function clonePaneForSplit(pane: WorkspacePaneState): WorkspacePaneState {
  if (pane.kind === "sftp") {
    return {
      ...createSftpPane(),
      localPath: pane.localPath,
      localSortBy: pane.localSortBy,
      localSortDirection: pane.localSortDirection,
      localShowHidden: pane.localShowHidden,
      remotePath: pane.remotePath,
      remoteSortBy: pane.remoteSortBy,
      remoteSortDirection: pane.remoteSortDirection,
      remoteShowHidden: pane.remoteShowHidden,
    };
  }

  return createTerminalPane(undefined, pane.fontSize);
}

export function insertWorkspaceAtPane(
  node: WorkspaceNode,
  paneId: string,
  insertedNode: WorkspaceNode,
  side: WorkspaceDropSide,
): { node: WorkspaceNode; inserted: boolean } {
  if (node.type === "pane") {
    if (node.id !== paneId) {
      return { node, inserted: false };
    }

    const direction = side === "left" || side === "right" ? "vertical" : "horizontal";
    const insertedFirst = side === "left" || side === "top";

    return {
      node: {
        type: "split",
        id: crypto.randomUUID(),
        direction,
        children: insertedFirst ? [insertedNode, node] : [node, insertedNode],
      },
      inserted: true,
    };
  }

  const first = insertWorkspaceAtPane(node.children[0], paneId, insertedNode, side);
  if (first.inserted) {
    return {
      node: { ...node, children: [first.node, node.children[1]] },
      inserted: true,
    };
  }

  const second = insertWorkspaceAtPane(node.children[1], paneId, insertedNode, side);
  if (second.inserted) {
    return {
      node: { ...node, children: [node.children[0], second.node] },
      inserted: true,
    };
  }

  return { node, inserted: false };
}

export function removePane(
  node: WorkspaceNode,
  paneId: string,
): { node: WorkspaceNode | null; removed: WorkspacePaneState | null } {
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
