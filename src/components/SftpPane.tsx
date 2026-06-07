import {
  AlertTriangle,
  ArrowUp,
  Download,
  Eye,
  EyeOff,
  File,
  Folder,
  FolderPlus,
  HardDrive,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Server,
  Terminal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type {
  SftpPanelSide,
  SftpPaneState,
  SftpSortDirection,
  SftpSortField,
} from "../terminalTree";
import type { RemoteFileEntry, SftpTransferInfo } from "../types";

interface MouseDragState {
  active: boolean;
  entry: RemoteFileEntry;
  side: SftpPanelSide;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

export function SftpPane({
  active,
  pane,
  onClose,
  onCreateFolder,
  onDelete,
  onDownload,
  onFocus,
  onNavigate,
  onOpenTerminal,
  onReady,
  onRefresh,
  onRename,
  onSelect,
  onUpload,
  onSort,
  onToggleHidden,
  transfers,
}: {
  active: boolean;
  pane: SftpPaneState;
  onClose: () => void;
  onCreateFolder: (side: SftpPanelSide) => void;
  onDelete: (side: SftpPanelSide, entry: RemoteFileEntry) => void;
  onDownload: (entry: RemoteFileEntry, localDirectoryPath?: string) => void;
  onFocus: () => void;
  onNavigate: (side: SftpPanelSide, path: string) => void;
  onOpenTerminal: () => void;
  onReady: () => void;
  onRefresh: (side: SftpPanelSide) => void;
  onRename: (side: SftpPanelSide, entry: RemoteFileEntry) => void;
  onSelect: (side: SftpPanelSide, path: string | null) => void;
  onUpload: (entry: RemoteFileEntry, remoteDirectoryPath?: string) => void;
  onSort: (side: SftpPanelSide, field: SftpSortField) => void;
  onToggleHidden: (side: SftpPanelSide) => void;
  transfers: SftpTransferInfo[];
}) {
  const [mouseDrag, setMouseDrag] = useState<MouseDragState | null>(null);
  const mouseDragRef = useRef<MouseDragState | null>(null);

  useEffect(() => {
    if (
      pane.localStatus === "pending" ||
      (pane.status === "pending" && pane.profileId)
    ) {
      onReady();
    }
  }, [onReady, pane.localStatus, pane.profileId, pane.status]);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      const drag = mouseDragRef.current;
      if (!drag) return;

      const active =
        drag.active ||
        Math.abs(event.clientX - drag.startX) > 5 ||
        Math.abs(event.clientY - drag.startY) > 5;
      const nextDrag = {
        ...drag,
        active,
        x: event.clientX,
        y: event.clientY,
      };

      mouseDragRef.current = nextDrag;
      setMouseDrag(nextDrag);
      if (active) event.preventDefault();
    }

    function handleMouseUp(event: MouseEvent) {
      const drag = mouseDragRef.current;
      if (!drag) return;

      mouseDragRef.current = null;
      setMouseDrag(null);
      if (!drag.active) return;

      const target = document.elementFromPoint(event.clientX, event.clientY);
      const panel = target?.closest<HTMLElement>("[data-sftp-drop-side]");
      const targetSide = panel?.dataset.sftpDropSide as SftpPanelSide | undefined;
      if (!panel || !targetSide || targetSide === drag.side) return;

      const folder = target?.closest<HTMLElement>("[data-sftp-drop-directory]");
      const directoryPath =
        folder?.dataset.sftpDropDirectory || panel.dataset.sftpDropPath;
      if (targetSide === "remote") {
        onUpload(drag.entry, directoryPath);
      } else {
        onDownload(drag.entry, directoryPath);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onDownload, onUpload]);

  function beginMouseDrag(
    event: ReactMouseEvent<HTMLElement>,
    side: SftpPanelSide,
    entry: RemoteFileEntry,
  ) {
    if (event.button !== 0 || entry.kind === "directory") return;

    const nextDrag = {
      active: false,
      entry,
      side,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
    };

    mouseDragRef.current = nextDrag;
    setMouseDrag(nextDrag);
  }

  const sessionTransfers = pane.sessionId
    ? transfers.filter((transfer) => transfer.sessionId === pane.sessionId)
    : [];
  const localSelectedEntry =
    pane.localEntries.find((entry) => entry.path === pane.localSelectedPath) ??
    null;
  const remoteSelectedEntry =
    pane.remoteEntries.find((entry) => entry.path === pane.remoteSelectedPath) ??
    null;
  const remoteBusy = pane.status === "connecting" || pane.status === "loading";
  const localBusy = pane.localStatus === "loading";

  return (
    <section
      className={`relative grid h-full min-h-0 grid-rows-[42px_minmax(0,1fr)] overflow-hidden rounded-sm border bg-[#111827] ${
        active ? "border-[#1e9bff]" : "border-[#2b3044]"
      }`}
      onMouseDown={onFocus}
    >
      <header className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-[#2b3044] bg-[#171d2d] px-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-[#dfe4f7]">
            {pane.title}
          </div>
          <div className="truncate text-[11px] text-[#8d93ad]">
            {pane.endpoint ?? "SFTP"} · {formatStatus(pane.status)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <SftpIconButton
            label="Open terminal"
            disabled={remoteBusy}
            onClick={onOpenTerminal}
          >
            <Terminal size={16} />
          </SftpIconButton>
          <SftpIconButton label="Close SFTP pane" onClick={onClose}>
            <X size={16} />
          </SftpIconButton>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 p-2">
        <FilePanel
          side="local"
          title="Local"
          subtitle="This computer"
          icon={<HardDrive size={16} />}
          path={pane.localPath}
          entries={pane.localEntries}
          selectedPath={pane.localSelectedPath}
          selectedEntry={localSelectedEntry}
          status={pane.localStatus}
          message={pane.localMessage}
          showHidden={pane.localShowHidden}
          sortBy={pane.localSortBy}
          sortDirection={pane.localSortDirection}
          transferDisabled={
            localBusy ||
            remoteBusy ||
            pane.status !== "connected" ||
            !localSelectedEntry ||
            localSelectedEntry.kind === "directory"
          }
          transferLabel="Upload selected"
          transferIcon={<Upload size={16} />}
          onBeginDrag={beginMouseDrag}
          onCreateFolder={onCreateFolder}
          onDelete={onDelete}
          onNavigate={onNavigate}
          onRefresh={onRefresh}
          onRename={onRename}
          onSelect={onSelect}
          onSort={onSort}
          onToggleHidden={onToggleHidden}
          onTransfer={() => {
            if (localSelectedEntry) onUpload(localSelectedEntry);
          }}
        />
        <FilePanel
          side="remote"
          title="Remote"
          subtitle={pane.endpoint ?? "SFTP server"}
          icon={<Server size={16} />}
          path={pane.remotePath}
          entries={pane.remoteEntries}
          selectedPath={pane.remoteSelectedPath}
          selectedEntry={remoteSelectedEntry}
          status={pane.status}
          message={pane.message}
          showHidden={pane.remoteShowHidden}
          sortBy={pane.remoteSortBy}
          sortDirection={pane.remoteSortDirection}
          transferDisabled={
            remoteBusy ||
            localBusy ||
            pane.localStatus !== "connected" ||
            !remoteSelectedEntry ||
            remoteSelectedEntry.kind === "directory"
          }
          transferLabel="Download selected"
          transferIcon={<Download size={16} />}
          onBeginDrag={beginMouseDrag}
          onCreateFolder={onCreateFolder}
          onDelete={onDelete}
          onNavigate={onNavigate}
          onRefresh={onRefresh}
          onRename={onRename}
          onSelect={onSelect}
          onSort={onSort}
          onToggleHidden={onToggleHidden}
          onTransfer={() => {
            if (remoteSelectedEntry) onDownload(remoteSelectedEntry);
          }}
        />
      </div>

      <SftpTransferToasts transfers={sessionTransfers} />
      {mouseDrag?.active ? <MouseDragPreview drag={mouseDrag} /> : null}
    </section>
  );
}

function FilePanel({
  entries,
  icon,
  message,
  onBeginDrag,
  onCreateFolder,
  onDelete,
  onNavigate,
  onRefresh,
  onRename,
  onSelect,
  onSort,
  onToggleHidden,
  onTransfer,
  path,
  selectedEntry,
  selectedPath,
  showHidden,
  side,
  sortBy,
  sortDirection,
  status,
  subtitle,
  title,
  transferDisabled,
  transferIcon,
  transferLabel,
}: {
  entries: RemoteFileEntry[];
  icon: ReactNode;
  message: string | null;
  onBeginDrag: (
    event: ReactMouseEvent<HTMLElement>,
    side: SftpPanelSide,
    entry: RemoteFileEntry,
  ) => void;
  onCreateFolder: (side: SftpPanelSide) => void;
  onDelete: (side: SftpPanelSide, entry: RemoteFileEntry) => void;
  onNavigate: (side: SftpPanelSide, path: string) => void;
  onRefresh: (side: SftpPanelSide) => void;
  onRename: (side: SftpPanelSide, entry: RemoteFileEntry) => void;
  onSelect: (side: SftpPanelSide, path: string | null) => void;
  onSort: (side: SftpPanelSide, field: SftpSortField) => void;
  onToggleHidden: (side: SftpPanelSide) => void;
  onTransfer: () => void;
  path: string;
  selectedEntry: RemoteFileEntry | null;
  selectedPath: string | null;
  showHidden: boolean;
  side: SftpPanelSide;
  sortBy: SftpSortField;
  sortDirection: SftpSortDirection;
  status: string;
  subtitle: string;
  title: string;
  transferDisabled: boolean;
  transferIcon: ReactNode;
  transferLabel: string;
}) {
  const [pathDraft, setPathDraft] = useState(path);
  const busy = status === "connecting" || status === "loading";
  const parent = parentPath(side, path);
  const canGoUp = Boolean(path && parent !== path);
  const visibleEntries = sortEntries(
    showHidden ? entries : entries.filter((entry) => !entry.name.startsWith(".")),
    sortBy,
    sortDirection,
  );

  useEffect(() => {
    setPathDraft(path);
  }, [path]);

  function submitPathDraft() {
    if (side !== "local" || busy) return;

    const nextPath = pathDraft.trim();
    if (!nextPath || nextPath === path) {
      setPathDraft(path);
      return;
    }

    onNavigate(side, nextPath);
  }

  return (
    <section
      className="grid min-h-0 grid-rows-[70px_minmax(0,1fr)] overflow-hidden rounded-sm border border-[#2b3044] bg-[#121a29]"
      data-sftp-drop-path={path}
      data-sftp-drop-side={side}
    >
      <header className="grid min-w-0 grid-rows-[32px_1fr] border-b border-[#2b3044] bg-[#172033] px-2">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#243044] text-[#d5daf0]">
              {icon}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-[#dfe4f7]">
                {title}
              </span>
              <span className="block truncate text-[10px] text-[#8d93ad]">
                {subtitle}
              </span>
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
            <SftpIconButton
              label="Parent folder"
              disabled={!canGoUp || busy}
              onClick={() => onNavigate(side, parent)}
            >
              <ArrowUp size={15} className={canGoUp ? "" : "opacity-35"} />
            </SftpIconButton>
            <SftpIconButton
              label="Refresh"
              disabled={busy}
              onClick={() => onRefresh(side)}
            >
              <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
            </SftpIconButton>
            <SftpIconButton
              label="Toggle hidden files"
              disabled={busy}
              onClick={() => onToggleHidden(side)}
            >
              {showHidden ? <EyeOff size={15} /> : <Eye size={15} />}
            </SftpIconButton>
            <SftpIconButton
              label={transferLabel}
              disabled={transferDisabled}
              onClick={onTransfer}
            >
              {transferIcon}
            </SftpIconButton>
            <SftpIconButton
              label="New folder"
              disabled={busy || status === "error"}
              onClick={() => onCreateFolder(side)}
            >
              <FolderPlus size={15} />
            </SftpIconButton>
            <SftpIconButton
              label="Rename"
              disabled={busy || !selectedEntry}
              onClick={() => selectedEntry && onRename(side, selectedEntry)}
            >
              <Pencil size={15} />
            </SftpIconButton>
            <SftpIconButton
              label="Delete"
              disabled={busy || !selectedEntry}
              onClick={() => selectedEntry && onDelete(side, selectedEntry)}
            >
              <Trash2 size={15} />
            </SftpIconButton>
          </div>
        </div>
        {side === "local" ? (
          <input
            aria-label="Local path"
            className="h-6 min-w-0 rounded-sm border border-transparent bg-transparent px-1 font-mono text-[11px] text-[#c9d2e6] outline-none hover:border-[#354158] focus:border-[#1e9bff] focus:bg-[#101827]"
            disabled={busy}
            value={pathDraft}
            onBlur={submitPathDraft}
            onChange={(event) => setPathDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setPathDraft(path);
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          <div className="min-w-0 truncate py-1 font-mono text-[11px] text-[#9ca4bf]">
            {path || formatStatus(status)}
          </div>
        )}
      </header>

      <div
        className="relative min-h-0"
      >
        {status === "error" ? (
          <PanelError
            message={message ?? `${title} unavailable.`}
            onRetry={() => onRefresh(side)}
          />
        ) : (
          <FileTable
            entries={visibleEntries}
            onBeginDrag={onBeginDrag}
            onNavigate={(nextPath) => onNavigate(side, nextPath)}
            onSelect={(nextPath) => onSelect(side, nextPath)}
            onSort={(field) => onSort(side, field)}
            selectedPath={selectedPath}
            side={side}
            sortBy={sortBy}
            sortDirection={sortDirection}
          />
        )}
        {busy ? (
          <div className="absolute inset-0 grid place-items-center bg-[#111827]/72 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-md border border-[#2b3044] bg-[#171d2d] px-3 py-2 text-sm text-[#dfe4f7]">
              <LoaderCircle size={17} className="animate-spin" />
              <span>{status === "connecting" ? "Connecting" : "Loading"}</span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FileTable({
  entries,
  onBeginDrag,
  onNavigate,
  onSelect,
  onSort,
  selectedPath,
  side,
  sortBy,
  sortDirection,
}: {
  entries: RemoteFileEntry[];
  onBeginDrag: (
    event: ReactMouseEvent<HTMLElement>,
    side: SftpPanelSide,
    entry: RemoteFileEntry,
  ) => void;
  onNavigate: (path: string) => void;
  onSelect: (path: string | null) => void;
  onSort: (field: SftpSortField) => void;
  selectedPath: string | null;
  side: SftpPanelSide;
  sortBy: SftpSortField;
  sortDirection: SftpSortDirection;
}) {
  if (!entries.length) {
    return (
      <div className="grid h-full place-items-center text-sm text-[#8d93ad]">
        Empty folder
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto">
      <table className="w-full min-w-[420px] table-fixed text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[#1c2435] text-xs text-[#9ca4bf]">
          <tr>
            <th className="w-[54%] px-3 py-2 font-semibold">
              <SortButton
                active={sortBy === "name"}
                direction={sortDirection}
                onClick={() => onSort("name")}
              >
                Name
              </SortButton>
            </th>
            <th className="w-[18%] px-3 py-2 font-semibold">
              <SortButton
                active={sortBy === "size"}
                direction={sortDirection}
                onClick={() => onSort("size")}
              >
                Size
              </SortButton>
            </th>
            <th className="w-[28%] px-3 py-2 font-semibold">
              <SortButton
                active={sortBy === "modified"}
                direction={sortDirection}
                onClick={() => onSort("modified")}
              >
                Modified
              </SortButton>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#222b3c]">
          {entries.map((entry) => {
            const directory = entry.kind === "directory";
            return (
              <tr
                key={entry.path}
                data-sftp-drop-directory={directory ? entry.path : undefined}
                className={`select-none text-[#dfe4f7] hover:bg-[#1b2638] ${
                  selectedPath === entry.path ? "bg-[#20344a]" : ""
                } ${directory ? "" : "cursor-grab active:cursor-grabbing"}`}
                onClick={() => onSelect(entry.path)}
                onDoubleClick={() => {
                  if (directory) onNavigate(entry.path);
                }}
                onMouseDown={(event) => onBeginDrag(event, side, entry)}
              >
                <td className="min-w-0 px-3 py-2">
                  <button
                    type="button"
                    className="grid max-w-full select-none grid-cols-[20px_minmax(0,1fr)] items-center gap-2 text-left"
                    onClick={() => onSelect(entry.path)}
                  >
                    {directory ? (
                      <Folder size={16} className="text-[#55c2a2]" />
                    ) : (
                      <File size={16} className="text-[#8d93ad]" />
                    )}
                    <span className="truncate">{entry.name}</span>
                  </button>
                </td>
                <td className="px-3 py-2 text-[#9ca4bf]">{formatSize(entry)}</td>
                <td className="px-3 py-2 text-[#9ca4bf]">
                  {formatTimestamp(entry.modifiedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortButton({
  active,
  children,
  direction,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  direction: SftpSortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex max-w-full items-center gap-1 truncate text-left font-semibold"
      onClick={onClick}
    >
      <span className="truncate">{children}</span>
      {active ? (
        <ArrowUp
          size={11}
          className={direction === "asc" ? "" : "rotate-180"}
        />
      ) : null}
    </button>
  );
}

function SftpTransferToasts({ transfers }: { transfers: SftpTransferInfo[] }) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const timersRef = useRef(new Map<string, number>());

  useEffect(() => {
    for (const transfer of transfers) {
      if (
        transfer.status !== "completed" ||
        dismissedIds.includes(transfer.transferId) ||
        timersRef.current.has(transfer.transferId)
      ) {
        continue;
      }

      const timer = window.setTimeout(() => {
        setDismissedIds((current) => [...current, transfer.transferId]);
        timersRef.current.delete(transfer.transferId);
      }, 3200);
      timersRef.current.set(transfer.transferId, timer);
    }
  }, [dismissedIds, transfers]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  const visibleTransfers = transfers
    .filter((transfer) => !dismissedIds.includes(transfer.transferId))
    .slice(-5)
    .reverse();
  if (!visibleTransfers.length) return null;

  return (
    <div className="pointer-events-none absolute right-3 bottom-3 z-40 grid w-[min(360px,calc(100%-24px))] gap-2">
      {visibleTransfers.map((transfer) => {
        const progress =
          transfer.bytesTotal && transfer.bytesTotal > 0
            ? Math.min(100, (transfer.bytesTransferred / transfer.bytesTotal) * 100)
            : transfer.status === "completed"
              ? 100
              : 0;
        const fileName = fileNameFromPath(transfer.destinationPath);
        const direction = transfer.direction === "upload" ? "上傳" : "下載";
        const status =
          transfer.status === "running"
            ? "正在傳輸"
            : transfer.status === "completed"
              ? "成功"
              : "失敗";
        return (
          <div
            key={transfer.transferId}
            className="pointer-events-auto grid gap-2 rounded-md border border-[#2b3044] bg-[#111827]/96 p-3 shadow-2xl"
            title={transfer.message ?? undefined}
          >
            <div className="flex min-w-0 items-start justify-between gap-3 text-xs text-[#9ca4bf]">
              <span className="min-w-0 truncate font-semibold text-[#dfe4f7]">
                {fileName} {direction} {status}
              </span>
              <span className="shrink-0 text-[11px]">
                {formatProgress(transfer, progress)}
              </span>
              {transfer.status === "error" ? (
                <button
                  type="button"
                  aria-label="Close transfer message"
                  title="Close"
                  className="-mr-1 -mt-1 grid size-6 shrink-0 place-items-center rounded-md text-[#9ca4bf] hover:bg-[#252a3f] hover:text-white"
                  onClick={() =>
                    setDismissedIds((current) => [
                      ...current,
                      transfer.transferId,
                    ])
                  }
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#263149]">
              <div
                className={`h-full ${
                  transfer.status === "error" ? "bg-[#ff5d6c]" : "bg-[#55c2a2]"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatProgress(transfer: SftpTransferInfo, progress: number) {
  if (transfer.status === "completed") return "100%";
  if (transfer.status === "error") return "失敗";
  if (transfer.bytesTotal && transfer.bytesTotal > 0) {
    return `${Math.floor(progress)}%`;
  }
  return formatSizeValue(transfer.bytesTransferred);
}

function MouseDragPreview({ drag }: { drag: MouseDragState }) {
  return (
    <div
      className="pointer-events-none fixed z-[1000] grid max-w-[260px] grid-cols-[18px_minmax(0,1fr)] items-center gap-2 rounded-md border border-[#55c2a2] bg-[#172033] px-3 py-2 text-xs font-semibold text-[#dfe4f7] shadow-2xl"
      style={{
        left: drag.x + 12,
        top: drag.y + 12,
      }}
    >
      <File size={15} className="text-[#8d93ad]" />
      <span className="truncate">{drag.entry.name}</span>
    </div>
  );
}

function SftpIconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="grid size-7 shrink-0 place-items-center rounded-md border border-transparent text-[#d5daf0] hover:bg-[#252a3f] hover:text-white disabled:pointer-events-none disabled:opacity-35"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PanelError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="grid h-full place-items-center p-4">
      <div className="grid max-w-sm justify-items-center gap-3 text-center">
        <span className="grid size-11 place-items-center rounded-md border border-[#553238] bg-[#2a171b] text-[#ffb8c0]">
          <AlertTriangle size={20} />
        </span>
        <div className="text-sm font-semibold text-white">{message}</div>
        <button
          type="button"
          className="h-9 rounded-md border border-[#3a4058] bg-[#33384f] px-3 text-sm font-semibold hover:bg-[#3d435c]"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function parentPath(side: SftpPanelSide, path: string) {
  return side === "remote" ? parentRemotePath(path) : parentLocalPath(path);
}

function parentRemotePath(path: string) {
  const current = path.trim();
  if (!current || current === "." || current === "/") return current || ".";

  const trimmed = current.replace(/\/+$/, "");
  const separatorIndex = trimmed.lastIndexOf("/");
  if (separatorIndex <= 0) return separatorIndex === 0 ? "/" : ".";

  return trimmed.slice(0, separatorIndex);
}

function parentLocalPath(path: string) {
  const current = path.trim();
  if (!current) return current;

  const trimmed = current.replace(/[\\/]+$/, "");
  if (/^[A-Za-z]:$/.test(trimmed)) return `${trimmed}\\`;
  if (/^[A-Za-z]:[\\/]?$/.test(current)) return current;

  const separatorIndex = Math.max(
    trimmed.lastIndexOf("/"),
    trimmed.lastIndexOf("\\"),
  );
  if (separatorIndex < 0) return current;

  const parent = trimmed.slice(0, separatorIndex);
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}\\`;
  return parent || current;
}

function formatStatus(status: string) {
  if (status === "connected") return "Connected";
  if (status === "connecting") return "Connecting";
  if (status === "loading") return "Loading";
  if (status === "error") return "Error";
  if (status === "pending") return "Pending";
  return status || "Idle";
}

function formatSize(entry: RemoteFileEntry) {
  if (entry.kind === "directory") return "";
  return formatSizeValue(entry.size ?? 0);
}

function formatSizeValue(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatTimestamp(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function fileNameFromPath(path: string) {
  return path.replace(/[/\\]+$/, "").split(/[/\\]/).pop() || path;
}

function sortEntries(
  entries: RemoteFileEntry[],
  sortBy: SftpSortField,
  sortDirection: SftpSortDirection,
) {
  const direction = sortDirection === "asc" ? 1 : -1;
  return entries.slice().sort((a, b) => {
    const directorySort = Number(b.kind === "directory") - Number(a.kind === "directory");
    if (directorySort) return directorySort;

    if (sortBy === "size") {
      return direction * ((a.size ?? 0) - (b.size ?? 0));
    }

    if (sortBy === "modified") {
      return direction * (timestampValue(a.modifiedAt) - timestampValue(b.modifiedAt));
    }

    return direction * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function timestampValue(value: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
