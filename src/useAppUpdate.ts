import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  check,
  type DownloadEvent,
  type Update,
} from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";

export type AppUpdateStatus =
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "installing"
  | "ready"
  | "error";

export interface AppUpdateState {
  status: AppUpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  notes: string | null;
  error: string | null;
  downloadedBytes: number;
  totalBytes: number | null;
}

const initialUpdateState: AppUpdateState = {
  status: "idle",
  currentVersion: "",
  availableVersion: null,
  notes: null,
  error: null,
  downloadedBytes: 0,
  totalBytes: null,
};

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function toNotes(update: Update) {
  return update.body?.trim() || null;
}

export function useAppUpdate() {
  const updateRef = useRef<Update | null>(null);
  const [state, setState] = useState<AppUpdateState>(initialUpdateState);

  const checkForUpdates = useCallback(async () => {
    setState((current) => ({
      ...current,
      status: "checking",
      error: null,
      downloadedBytes: 0,
      totalBytes: null,
    }));

    try {
      const [currentVersion, update] = await Promise.all([getVersion(), check()]);
      updateRef.current = update;

      if (!update) {
        setState({
          ...initialUpdateState,
          status: "current",
          currentVersion,
        });
        return;
      }

      setState({
        ...initialUpdateState,
        status: "available",
        currentVersion,
        availableVersion: update.version,
        notes: toNotes(update),
      });
    } catch (err) {
      setState((current) => ({
        ...current,
        status: "error",
        error: getErrorMessage(err),
      }));
    }
  }, []);

  const installAndRelaunch = useCallback(async () => {
    const update = updateRef.current;
    if (!update) {
      setState((current) => ({
        ...current,
        status: "error",
        error: "No update is available.",
      }));
      return;
    }

    setState((current) => ({
      ...current,
      status: "downloading",
      error: null,
      downloadedBytes: 0,
      totalBytes: null,
    }));

    try {
      let downloadedBytes = 0;
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          downloadedBytes = 0;
          setState((current) => ({
            ...current,
            status: "downloading",
            downloadedBytes: 0,
            totalBytes: event.data.contentLength ?? null,
          }));
          return;
        }

        if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          setState((current) => ({
            ...current,
            status: "downloading",
            downloadedBytes,
          }));
          return;
        }

        setState((current) => ({
          ...current,
          status: "installing",
        }));
      });

      setState((current) => ({
        ...current,
        status: "ready",
      }));
      await relaunch();
    } catch (err) {
      setState((current) => ({
        ...current,
        status: "error",
        error: getErrorMessage(err),
      }));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkForUpdates();
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    ...state,
    checkForUpdates,
    installAndRelaunch,
  };
}
