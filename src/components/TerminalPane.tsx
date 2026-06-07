import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  KeyRound,
  FolderSync,
  Plug,
  RefreshCw,
  Rocket,
  Server,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import * as api from "../api";
import {
  DEFAULT_TERMINAL_THEME,
  toXtermTheme,
  type TerminalThemeConfig,
} from "../terminalThemes";
import type { SshOutputEvent } from "../types";
import type { TerminalPaneState } from "../terminalTree";

const passwordPromptPopoverWidth = 176;
const passwordPromptPopoverHeight = 34;
const preservedTerminalPaneIds = new Set<string>();
const terminalRuntimeCache = new Map<string, TerminalRuntime>();

interface TerminalRuntime {
  terminal: Terminal;
  fitAddon: FitAddon;
  disposeTimer: number | null;
  mountCount: number;
}

export function preserveTerminalPaneRuntime(paneId: string) {
  preservedTerminalPaneIds.add(paneId);
}

function scheduleTerminalRuntimeDispose(paneId: string) {
  const runtime = terminalRuntimeCache.get(paneId);
  if (!runtime || runtime.disposeTimer || runtime.mountCount > 0) return;

  const delay = preservedTerminalPaneIds.delete(paneId) ? 1200 : 120;
  runtime.disposeTimer = window.setTimeout(() => {
    const current = terminalRuntimeCache.get(paneId);
    if (current !== runtime) return;

    terminalRuntimeCache.delete(paneId);
    runtime.terminal.dispose();
  }, delay);
}

interface TerminalPaneProps {
  pane: TerminalPaneState;
  active: boolean;
  terminalTheme?: TerminalThemeConfig;
  terminalFontSize: number;
  onFocus: () => void;
  onReady: (cols: number, rows: number) => void;
  onReconnect: (cols: number, rows: number) => void;
  onOpenFiles: () => void;
  onClose: () => void;
}

export function TerminalPane({
  pane,
  active,
  terminalTheme,
  terminalFontSize,
  onFocus,
  onReady,
  onReconnect,
  onOpenFiles,
  onClose,
}: TerminalPaneProps) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const tailRef = useRef("");
  const sessionIdRef = useRef<string | null>(pane.sessionId);
  const connectedRef = useRef(pane.status === "connected");
  const lastDimensionsRef = useRef<{ cols: number; rows: number } | null>(null);
  const lastClearedSessionRef = useRef<string | null>(
    pane.status === "connected" ? pane.sessionId : null,
  );
  const lastNoticeRef = useRef("");
  const overlayStartedRef = useRef(false);
  const overlayTimersRef = useRef<number[]>([]);
  const promptVisibleRef = useRef(false);
  const promptSendingRef = useRef(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptSending, setPromptSending] = useState(false);
  const [promptError, setPromptError] = useState("");
  const [promptAnchor, setPromptAnchor] = useState<PromptAnchor | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(
    pane.status === "pending" || pane.status === "connecting",
  );
  const [overlayStep, setOverlayStep] = useState(0);
  const effectiveTheme = terminalTheme ?? DEFAULT_TERMINAL_THEME;
  const xtermTheme = useMemo(() => toXtermTheme(effectiveTheme), [effectiveTheme]);
  const terminalBackground = effectiveTheme.colors.background;
  const connecting = pane.status === "pending" || pane.status === "connecting";
  const recoverableConnectionStatus =
    pane.status === "error" ||
    pane.status === "disconnected" ||
    pane.status === "exited";
  const showConnectionOverlay = connecting || overlayVisible;
  const showRecoveryOverlay = !showConnectionOverlay && recoverableConnectionStatus;

  useEffect(() => {
    sessionIdRef.current = pane.sessionId;
    connectedRef.current = pane.status === "connected";
    resizeBackend();
  }, [pane.sessionId, pane.status]);

  useEffect(() => {
    return () => clearOverlayTimers();
  }, []);

  useEffect(() => {
    promptVisibleRef.current = promptVisible;
  }, [promptVisible]);

  useEffect(() => {
    promptSendingRef.current = promptSending;
  }, [promptSending]);

  useEffect(() => {
    if (pane.status !== "connected") {
      hidePasswordPrompt();
    }
  }, [pane.status]);

  useEffect(() => {
    if (connecting) {
      setOverlayVisible(true);
      if (!overlayStartedRef.current) {
        overlayStartedRef.current = true;
        setOverlayStep(0);
        scheduleOverlayRun();
      }
      if (pane.status === "connecting") {
        setOverlayStep((current) => Math.max(current, 1));
      }
      return;
    }

    if (pane.status === "connected") {
      if (!overlayStartedRef.current) {
        setOverlayVisible(false);
        return;
      }

      clearOverlayTimers();
      setOverlayVisible(true);
      setOverlayStep(2);
      overlayTimersRef.current = [
        window.setTimeout(() => {
          setOverlayVisible(false);
          overlayStartedRef.current = false;
        }, 420),
      ];
      return;
    }

    clearOverlayTimers();
    overlayStartedRef.current = false;
    setOverlayVisible(false);
  }, [connecting, pane.status]);

  useEffect(() => {
    if (!hostRef.current) return;

    const cachedRuntime = terminalRuntimeCache.get(pane.id);
    if (cachedRuntime?.disposeTimer) {
      window.clearTimeout(cachedRuntime.disposeTimer);
      cachedRuntime.disposeTimer = null;
    }

    const terminal =
      cachedRuntime?.terminal ??
      new Terminal({
        allowProposedApi: true,
        cursorBlink: true,
        convertEol: true,
        fontFamily:
          "Cascadia Mono, JetBrains Mono, Consolas, ui-monospace, monospace",
        fontSize: terminalFontSize,
        theme: {
          ...xtermTheme,
        },
      });
    const fitAddon = cachedRuntime?.fitAddon ?? new FitAddon();

    const runtime =
      cachedRuntime ?? { terminal, fitAddon, disposeTimer: null, mountCount: 0 };
    runtime.mountCount += 1;

    if (!cachedRuntime) {
      terminal.loadAddon(fitAddon);
      terminal.open(hostRef.current);
      terminalRuntimeCache.set(pane.id, runtime);
    } else if (terminal.element) {
      hostRef.current.appendChild(terminal.element);
    }

    terminal.options.fontSize = terminalFontSize;
    applyTerminalTheme(terminal, xtermTheme);
    fitAddon.fit();

    const dataDisposable = terminal.onData((data) => {
      hidePasswordPrompt();
      const sessionId = sessionIdRef.current;
      if (connectedRef.current && sessionId) {
        void api.writeSsh({ sessionId, data }).catch(() => {});
      }
    });
    terminal.attachCustomKeyEventHandler((event) => {
      if (isTerminalCopyShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
        copyTerminalSelection(terminal);
        return false;
      }

      const sessionId = sessionIdRef.current;
      if (
        event.type === "keydown" &&
        event.key === "Tab" &&
        promptVisibleRef.current &&
        !promptSendingRef.current &&
        connectedRef.current &&
        sessionId
      ) {
        void sendSavedPassword();
        return false;
      }
      return true;
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const dimensions = fitAddon.proposeDimensions();
    lastDimensionsRef.current = {
      cols: dimensions?.cols ?? 80,
      rows: dimensions?.rows ?? 24,
    };
    onReady(lastDimensionsRef.current.cols, lastDimensionsRef.current.rows);

    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      const next = fitAddon.proposeDimensions();
      if (next) {
        lastDimensionsRef.current = { cols: next.cols, rows: next.rows };
        resizeBackend();
      }
      if (promptVisibleRef.current) {
        updatePasswordPromptAnchor();
      }
    });
    observer.observe(hostRef.current);

    let disposed = false;
    let unlisten: UnlistenFn | null = null;
    void listen<SshOutputEvent>("ssh-output", (event) => {
      const sessionId = sessionIdRef.current;
      if (event.payload.sessionId !== sessionId) return;
      terminal.write(event.payload.data, () => {
        recordOutputTail(event.payload.data);
      });
    }).then((handler) => {
      if (disposed) {
        handler();
        return;
      }
      unlisten = handler;
    });

    return () => {
      disposed = true;
      observer.disconnect();
      unlisten?.();
      dataDisposable.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      runtime.mountCount = Math.max(0, runtime.mountCount - 1);
      scheduleTerminalRuntimeDispose(pane.id);
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    terminal.options.fontSize = terminalFontSize;
    fitAddonRef.current?.fit();
    const next = fitAddonRef.current?.proposeDimensions();
    if (next) {
      lastDimensionsRef.current = { cols: next.cols, rows: next.rows };
      resizeBackend();
    }
    if (promptVisibleRef.current) {
      updatePasswordPromptAnchor();
    }
  }, [terminalFontSize]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    applyTerminalTheme(terminal, xtermTheme);
    fitAddonRef.current?.fit();
    if (promptVisibleRef.current) {
      updatePasswordPromptAnchor();
    }
  }, [xtermTheme]);

  useEffect(() => {
    if (active) {
      terminalRef.current?.focus();
    }
  }, [active]);

  useEffect(() => {
    if (
      pane.status === "connected" &&
      lastClearedSessionRef.current !== pane.sessionId
    ) {
      terminalRef.current?.clear();
      lastClearedSessionRef.current = pane.sessionId;
      return;
    }

    if (pane.status !== "connected") {
      lastClearedSessionRef.current = null;
    }
  }, [pane.sessionId, pane.status]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const noticeKey = `${pane.sessionId ?? "no-session"}:${pane.status}:${
      pane.message ?? ""
    }`;
    if (lastNoticeRef.current === noticeKey) return;
    lastNoticeRef.current = noticeKey;

    if (pane.status === "connecting") {
      return;
    }

    if (pane.status === "error") {
      const message = pane.message ?? "Unknown SSH error";
      console.error(`[Termini] SSH connection failed for "${pane.title}": ${message}`);
      terminal.writeln("");
      terminal.writeln(`Connection failed: ${message}`);
      return;
    }

    if (pane.status === "disconnected" || pane.status === "exited") {
      terminal.writeln("");
      terminal.writeln(pane.message ?? `SSH session ${pane.status}`);
    }
  }, [pane.sessionId, pane.status, pane.message]);

  function resizeBackend() {
    const sessionId = sessionIdRef.current;
    const dimensions = lastDimensionsRef.current;
    if (!connectedRef.current || !sessionId || !dimensions) return;

    void api
      .resizeSsh({
        sessionId,
        cols: dimensions.cols,
        rows: dimensions.rows,
      })
      .catch(() => {});
  }

  function recordOutputTail(data: string) {
    tailRef.current = stripAnsi(`${tailRef.current}${data}`).slice(-500);
    if (hasPasswordPrompt(tailRef.current)) {
      setPromptError("");
      promptVisibleRef.current = true;
      setPromptVisible(true);
      schedulePasswordPromptAnchorUpdate();
    }
  }

  function hidePasswordPrompt() {
    promptVisibleRef.current = false;
    setPromptVisible(false);
    setPromptError("");
    setPromptAnchor(null);
  }

  function schedulePasswordPromptAnchorUpdate() {
    window.requestAnimationFrame(updatePasswordPromptAnchor);
  }

  function updatePasswordPromptAnchor() {
    const terminal = terminalRef.current;
    const paneElement = paneRef.current;
    const terminalElement = terminal?.element;
    if (!terminal || !paneElement || !terminalElement) return;

    const rowsElement =
      terminalElement.querySelector<HTMLElement>(".xterm-rows") ?? terminalElement;
    const paneRect = paneElement.getBoundingClientRect();
    const rowsRect = rowsElement.getBoundingClientRect();
    const cellWidth = rowsRect.width / Math.max(terminal.cols, 1);
    const cellHeight = rowsRect.height / Math.max(terminal.rows, 1);
    const rawLeft =
      rowsRect.left -
      paneRect.left +
      terminal.buffer.active.cursorX * cellWidth +
      14;
    const rawTop =
      rowsRect.top -
      paneRect.top +
      terminal.buffer.active.cursorY * cellHeight +
      4;
    const maxLeft = Math.max(8, paneRect.width - passwordPromptPopoverWidth - 8);
    const maxTop = Math.max(34, paneRect.height - passwordPromptPopoverHeight - 8);

    setPromptAnchor({
      left: Math.max(8, Math.min(rawLeft, maxLeft)),
      top: Math.max(34, Math.min(rawTop, maxTop)),
    });
  }

  async function sendSavedPassword() {
    const sessionId = sessionIdRef.current;
    if (!connectedRef.current || !sessionId || promptSendingRef.current) return;

    setPromptError("");
    promptSendingRef.current = true;
    setPromptSending(true);
    try {
      await api.sendProfilePassword(sessionId);
      tailRef.current = "";
      hidePasswordPrompt();
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : String(err));
    } finally {
      promptSendingRef.current = false;
      setPromptSending(false);
      terminalRef.current?.focus();
    }
  }

  function dismissPasswordPrompt() {
    hidePasswordPrompt();
    terminalRef.current?.focus();
  }

  function requestReconnect() {
    hidePasswordPrompt();
    const dimensions = lastDimensionsRef.current ?? {
      cols: terminalRef.current?.cols ?? 80,
      rows: terminalRef.current?.rows ?? 24,
    };
    onReconnect(dimensions.cols, dimensions.rows);
  }

  function scheduleOverlayRun() {
    clearOverlayTimers();
    overlayTimersRef.current = [
      window.setTimeout(() => setOverlayStep(1), 360),
      window.setTimeout(() => setOverlayStep(2), 980),
    ];
  }

  function clearOverlayTimers() {
    for (const timer of overlayTimersRef.current) {
      window.clearTimeout(timer);
    }
    overlayTimersRef.current = [];
  }

  const paneFrameClass = showConnectionOverlay
    ? "relative h-full min-h-0 min-w-0 bg-[#111426]"
    : `relative h-full min-h-0 min-w-0 border ${
        active ? "border-[#55c2a2]" : "border-[#25313c]"
      } bg-[#0d1116]`;

  return (
    <div
      ref={paneRef}
      className={paneFrameClass}
      style={{ background: terminalBackground }}
      onMouseDown={onFocus}
    >
      <div
        ref={hostRef}
        style={{ background: terminalBackground }}
        className={
          showConnectionOverlay
            ? "invisible absolute inset-0 min-h-0 min-w-0 p-2"
            : "h-full min-h-0 min-w-0 p-2"
        }
      />
      {showConnectionOverlay ? (
        <ConnectingOverlay pane={pane} activeStep={overlayStep} onClose={onClose} />
      ) : null}
      {showRecoveryOverlay ? (
        <ConnectionRecoveryOverlay
          pane={pane}
          onReconnect={requestReconnect}
          onClose={onClose}
        />
      ) : null}
      {promptVisible ? (
        <PasswordPromptPopover
          anchor={promptAnchor}
          error={promptError}
          sending={promptSending}
          onDismiss={dismissPasswordPrompt}
          onSend={() => {
            void sendSavedPassword();
          }}
        />
      ) : null}
      {pane.message && !showConnectionOverlay && !showRecoveryOverlay ? (
        <div className="absolute left-4 bottom-4 max-w-[70%] rounded-md border border-[#334353] bg-[#151b22] px-3 py-2 text-xs text-[#8fa1b2]">
          {pane.message}
        </div>
      ) : null}
      {pane.profileId && pane.status === "connected" && !showConnectionOverlay && !showRecoveryOverlay ? (
        <button
          type="button"
          aria-label="Open SFTP files"
          title="Open SFTP files"
          className="absolute top-3 right-3 z-30 grid size-8 place-items-center rounded-md border border-[#2b3044] bg-[#151b22]/92 text-[#d5daf0] opacity-70 shadow-lg hover:bg-[#252a3f] hover:text-white hover:opacity-100"
          onClick={onOpenFiles}
        >
          <FolderSync size={16} />
        </button>
      ) : null}
    </div>
  );
}

function ConnectionRecoveryOverlay({
  pane,
  onReconnect,
  onClose,
}: {
  pane: TerminalPaneState;
  onReconnect: () => void;
  onClose: () => void;
}) {
  const title =
    pane.status === "error"
      ? "Connection failed"
      : pane.status === "exited"
        ? "Session ended"
        : "Connection lost";
  const message =
    pane.message ??
    (pane.status === "exited"
      ? "Remote shell exited."
      : "SSH session disconnected.");

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[#070a10]/88 px-6 text-[#f4f6fb] backdrop-blur-[2px]">
      <div className="grid w-full max-w-[520px] gap-6">
        <div className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-4">
          <span className="grid size-[50px] place-items-center rounded-xl bg-[#7c5268] text-white">
            <Server size={22} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-white">{pane.title}</div>
            <div className="truncate text-sm text-[#9ca4bf]">
              SSH {pane.endpoint ?? "remote shell"}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#2b3044] px-3 text-sm font-bold text-white hover:bg-[#343b55]"
            onClick={onClose}
            aria-label="Close terminal pane"
          >
            <X size={15} />
            <span>Close</span>
          </button>
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-semibold text-[#dce3ef]">{title}</div>
          <div className="text-xs text-[#9ca4bf]">{message}</div>
        </div>

        <div>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1e9bff] px-4 text-sm font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-[#3aa8ff]"
            onClick={onReconnect}
          >
            <RefreshCw size={16} />
            <span>重新連線</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordPromptPopover({
  anchor,
  error,
  sending,
  onDismiss,
  onSend,
}: {
  anchor: PromptAnchor | null;
  error: string;
  sending: boolean;
  onDismiss: () => void;
  onSend: () => void;
}) {
  const positionStyle: CSSProperties = anchor
    ? { left: anchor.left, top: anchor.top }
    : { right: "1rem", bottom: "1rem" };

  function handleItemClick() {
    if (!sending) onSend();
  }

  function handleItemKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (sending || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onSend();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Send saved password"
      className="absolute z-30 grid w-[176px] cursor-pointer gap-1 rounded-md border border-[#55c2a2] bg-[#142820] p-1 text-xs text-[#d9e3ec] shadow-2xl outline-none hover:bg-[#18372d] focus:border-[#74e0bd]"
      style={positionStyle}
      onClick={handleItemClick}
      onKeyDown={handleItemKeyDown}
    >
      <div className="flex min-w-0 items-center gap-1">
        <span className="grid size-5 shrink-0 place-items-center text-[#74e0bd]">
          <KeyRound size={13} />
        </span>
        <span className="min-w-0 flex-1 rounded px-1.5 py-1 font-mono text-[12px] font-semibold text-white">
          {sending ? "Sending..." : "******"}
        </span>
        <span className="rounded border border-[#3a4058] bg-[#1c2134] px-1 py-0.5 font-mono text-[10px] text-[#9ca4bf]">
          Tab
        </span>
        <button
          type="button"
          className="grid size-5 shrink-0 place-items-center rounded text-[#aeb7ca] hover:bg-[#203b32] hover:text-white"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
          aria-label="Dismiss password prompt"
          title="Dismiss"
        >
          <X size={12} />
        </button>
      </div>

      {error ? (
        <div className="rounded border border-[#7f3333] bg-[#321b1b] px-2 py-1 text-[11px] text-[#ffc9c9]">
          {error}
        </div>
      ) : null}
    </div>
  );
}

interface PromptAnchor {
  left: number;
  top: number;
}

function ConnectingOverlay({
  pane,
  activeStep,
  onClose,
}: {
  pane: TerminalPaneState;
  activeStep: number;
  onClose: () => void;
}) {
  const steps = [
    { label: "Resolving host", icon: Plug },
    { label: "Starting SSH session", icon: Rocket },
    { label: "Opening shell", icon: TerminalIcon },
  ];
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-[#111426] text-[#f4f6fb]">
      <div className="grid w-full max-w-[520px] gap-7 px-8">
        <div className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-4">
          <span className="grid size-[50px] place-items-center rounded-xl bg-[#ff6726] text-white">
            <Server size={22} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-white">{pane.title}</div>
            <div className="truncate text-sm text-[#9ca4bf]">
              SSH {pane.endpoint ?? "remote shell"}
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg bg-[#2b3044] px-4 py-2 text-sm font-bold text-white hover:bg-[#343b55]"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-[24px_minmax(0,1fr)_44px_minmax(0,1fr)_24px] items-center">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const active = index <= activeStep;
            const current = index === activeStep;

            return (
              <span
                key={step.label}
                className={`relative z-10 grid size-8 place-items-center rounded-full ${
                  active ? "bg-[#1e9bff] text-white" : "bg-[#6f758c] text-white"
                } ${
                  current
                    ? "animate-pulse shadow-[0_0_0_6px_rgba(30,155,255,0.22)]"
                    : ""
                }`}
                title={step.label}
              >
                <Icon size={15} />
              </span>
            );
          }).reduce<React.ReactNode[]>((items, item, index) => {
            if (index > 0) {
              items.push(
                <span
                  key={`line-${index}`}
                  className={`h-1 ${
                    index <= activeStep ? "bg-[#1e9bff]" : "bg-[#6f758c]"
                  }`}
                />,
              );
            }
            items.push(item);
            return items;
          }, [])}
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-semibold text-[#aeb7ca]">
            {pane.message ?? "Connecting to SSH host..."}
          </div>
          <div className="text-xs text-[#737c96]">Preparing interactive shell...</div>
        </div>
      </div>
    </div>
  );
}

function hasPasswordPrompt(value: string) {
  return /(\[sudo\]\s+password\s+for\s+[^:]+:\s*|(^|\n|\r)password:\s*)$/i.test(
    value,
  );
}

function stripAnsi(value: string) {
  return value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
}

function applyTerminalTheme(
  terminal: Terminal,
  theme: ReturnType<typeof toXtermTheme>,
) {
  const nextTheme = { ...theme };
  terminal.options.theme = nextTheme;

  const element = terminal.element;
  if (element) {
    element.style.backgroundColor = nextTheme.background ?? "";
    element.style.color = nextTheme.foreground ?? "";

    for (const item of element.querySelectorAll<HTMLElement>(
      ".xterm-viewport, .xterm-screen, .xterm-rows",
    )) {
      item.style.backgroundColor = nextTheme.background ?? "";
      item.style.color = nextTheme.foreground ?? "";
    }
  }

  terminal.refresh(0, Math.max(0, terminal.rows - 1));
}

function isTerminalCopyShortcut(event: globalThis.KeyboardEvent) {
  return (
    event.type === "keydown" &&
    event.ctrlKey &&
    event.shiftKey &&
    !event.altKey &&
    event.key.toLowerCase() === "c"
  );
}

function copyTerminalSelection(terminal: Terminal) {
  const selectedText = terminal.getSelection();
  if (!selectedText) return;

  void writeClipboardText(selectedText);
}

async function writeClipboardText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall through to the legacy clipboard path for WebViews without Clipboard API access.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
