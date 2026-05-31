import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  Plug,
  Rocket,
  Server,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as api from "../api";
import type { SshOutputEvent } from "../types";
import type { TerminalPaneState } from "../terminalTree";

interface TerminalPaneProps {
  pane: TerminalPaneState;
  active: boolean;
  onFocus: () => void;
  onReady: (cols: number, rows: number) => void;
  onClose: () => void;
}

export function TerminalPane({
  pane,
  active,
  onFocus,
  onReady,
  onClose,
}: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const tailRef = useRef("");
  const sessionIdRef = useRef<string | null>(pane.sessionId);
  const connectedRef = useRef(pane.status === "connected");
  const lastDimensionsRef = useRef<{ cols: number; rows: number } | null>(null);
  const lastNoticeRef = useRef("");
  const overlayStartedRef = useRef(false);
  const overlayTimersRef = useRef<number[]>([]);
  const [promptVisible, setPromptVisible] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(
    pane.status === "pending" || pane.status === "connecting",
  );
  const [overlayStep, setOverlayStep] = useState(0);
  const connecting = pane.status === "pending" || pane.status === "connecting";
  const showConnectionOverlay = connecting || overlayVisible;

  useEffect(() => {
    sessionIdRef.current = pane.sessionId;
    connectedRef.current = pane.status === "connected";
    resizeBackend();
  }, [pane.sessionId, pane.status]);

  useEffect(() => {
    return () => clearOverlayTimers();
  }, []);

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

    const terminal = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      convertEol: true,
      fontFamily:
        "Cascadia Mono, JetBrains Mono, Consolas, ui-monospace, monospace",
      fontSize: 13,
      theme: {
        background: "#0d1116",
        foreground: "#d9e3ec",
        cursor: "#55c2a2",
        selectionBackground: "#2e6f5d",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(hostRef.current);
    fitAddon.fit();

    terminal.onData((data) => {
      setPromptVisible(false);
      const sessionId = sessionIdRef.current;
      if (connectedRef.current && sessionId) {
        void api.writeSsh({ sessionId, data }).catch(() => {});
      }
    });
    terminal.attachCustomKeyEventHandler((event) => {
      const sessionId = sessionIdRef.current;
      if (
        event.type === "keydown" &&
        event.key === "Tab" &&
        promptVisible &&
        connectedRef.current &&
        sessionId
      ) {
        void api.sendProfilePassword(sessionId).catch(() => {});
        setPromptVisible(false);
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
    });
    observer.observe(hostRef.current);

    let unlisten: UnlistenFn | null = null;
    void listen<SshOutputEvent>("ssh-output", (event) => {
      const sessionId = sessionIdRef.current;
      if (event.payload.sessionId !== sessionId) return;
      terminal.write(event.payload.data);
      recordOutputTail(event.payload.data);
    }).then((handler) => {
      unlisten = handler;
    });

    return () => {
      observer.disconnect();
      unlisten?.();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (active) {
      terminalRef.current?.focus();
    }
  }, [active]);

  useEffect(() => {
    if (pane.status === "connected") {
      terminalRef.current?.clear();
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
      setPromptVisible(true);
    }
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
    : `relative grid h-full min-h-0 min-w-0 grid-rows-[30px_minmax(0,1fr)] border ${
        active ? "border-[#55c2a2]" : "border-[#25313c]"
      } bg-[#0d1116]`;

  return (
    <div
      className={paneFrameClass}
      onMouseDown={onFocus}
    >
      {!showConnectionOverlay ? (
        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[#25313c] bg-[#151b22] px-2 text-xs text-[#8fa1b2]">
          <span className="truncate">
            {pane.title} · {pane.status}
          </span>
          <button
            type="button"
            className="grid size-6 place-items-center rounded text-[#ffb8c0] hover:bg-[#2a171b]"
            onClick={onClose}
            aria-label={`Close ${pane.title}`}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
      <div
        ref={hostRef}
        className={
          showConnectionOverlay
            ? "invisible absolute inset-0 min-h-0 min-w-0 p-2"
            : "min-h-0 min-w-0 p-2"
        }
      />
      {showConnectionOverlay ? (
        <ConnectingOverlay pane={pane} activeStep={overlayStep} onClose={onClose} />
      ) : null}
      {promptVisible ? (
        <div className="absolute right-4 bottom-4 rounded-md border border-[#55c2a2] bg-[#142820] px-3 py-2 text-xs text-[#d9e3ec] shadow-lg">
          Press Tab to send saved password
        </div>
      ) : null}
      {pane.message && !showConnectionOverlay ? (
        <div className="absolute left-4 bottom-4 max-w-[70%] rounded-md border border-[#334353] bg-[#151b22] px-3 py-2 text-xs text-[#8fa1b2]">
          {pane.message}
        </div>
      ) : null}
    </div>
  );
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
