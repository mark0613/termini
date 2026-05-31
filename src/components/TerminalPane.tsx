import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { X } from "lucide-react";
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
  const [promptVisible, setPromptVisible] = useState(false);

  useEffect(() => {
    sessionIdRef.current = pane.sessionId;
    connectedRef.current = pane.status === "connected";
    resizeBackend();
  }, [pane.sessionId, pane.status]);

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
    terminal.writeln("Termini");
    terminal.writeln("Waiting for SSH session...");
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
      terminal.writeln("");
      terminal.writeln(pane.message ?? "Connecting...");
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

  return (
    <div
      className={`relative grid min-h-0 min-w-0 grid-rows-[30px_minmax(0,1fr)] border ${
        active ? "border-[#55c2a2]" : "border-[#25313c]"
      } bg-[#0d1116]`}
      onMouseDown={onFocus}
    >
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
      <div ref={hostRef} className="min-h-0 min-w-0 p-2" />
      {promptVisible ? (
        <div className="absolute right-4 bottom-4 rounded-md border border-[#55c2a2] bg-[#142820] px-3 py-2 text-xs text-[#d9e3ec] shadow-lg">
          Press Tab to send saved password
        </div>
      ) : null}
      {pane.message ? (
        <div className="absolute left-4 bottom-4 max-w-[70%] rounded-md border border-[#334353] bg-[#151b22] px-3 py-2 text-xs text-[#8fa1b2]">
          {pane.message}
        </div>
      ) : null}
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
