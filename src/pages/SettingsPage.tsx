import {
  CheckCircle2,
  Download,
  Info,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import type { FormEvent } from "react";
import type { SettingsSection } from "../appTypes";
import {
  ActionButton,
  ErrorBanner,
  Field,
  Label,
  Panel,
  PathField,
  ReadOnlyValue,
} from "../components/ui";
import { ShortcutTable } from "../components/ShortcutTable";
import type { TerminalThemeConfig } from "../terminalThemes";
import type { Vault } from "../types";
import type { AppUpdateState } from "../useAppUpdate";

const databaseLocation = "%APPDATA%\\Termini\\termini.sqlite3";

export function SettingsPage({
  activeSection,
  activeVault,
  appUpdate,
  activeTerminalThemeId,
  exportError,
  exportPassword,
  exportPath,
  importError,
  importPassword,
  importPath,
  isBusy,
  terminalFontSize,
  terminalThemeError,
  terminalThemes,
  onActiveTerminalThemeChange,
  onChooseExportPath,
  onChooseImportPath,
  onCreateTheme,
  onDeleteTheme,
  onExport,
  onExportPasswordChange,
  onExportPathChange,
  onImport,
  onImportPasswordChange,
  onImportPathChange,
  onCheckForUpdates,
  onInstallUpdate,
}: {
  activeSection: SettingsSection;
  activeVault: Vault | null;
  appUpdate: AppUpdateState;
  activeTerminalThemeId: string;
  exportError: string;
  exportPassword: string;
  exportPath: string;
  importError: string;
  importPassword: string;
  importPath: string;
  isBusy: boolean;
  terminalFontSize: number;
  terminalThemeError: string;
  terminalThemes: TerminalThemeConfig[];
  onActiveTerminalThemeChange: (id: string) => void;
  onChooseExportPath: () => void;
  onChooseImportPath: () => void;
  onCreateTheme: () => void;
  onDeleteTheme: (theme: TerminalThemeConfig) => void;
  onExport: (event: FormEvent) => void;
  onExportPasswordChange: (value: string) => void;
  onExportPathChange: (value: string) => void;
  onImport: (event: FormEvent) => void;
  onImportPasswordChange: (value: string) => void;
  onImportPathChange: (value: string) => void;
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
}) {
  return (
    <section className="min-h-0 overflow-auto bg-[#1d2133] p-8">
      <div className="grid max-w-3xl gap-5">
        {activeSection === "data" ? (
          <>
            <Panel title="Database">
              <div className="grid gap-2">
                <Label>Location</Label>
                <ReadOnlyValue value={databaseLocation} />
              </div>
            </Panel>

            <Panel title="Export">
              {exportError ? <ErrorBanner message={exportError} /> : null}
              <form className="grid gap-3" onSubmit={onExport}>
                <PathField
                  placeholder="Export path"
                  value={exportPath}
                  onBrowse={onChooseExportPath}
                  onChange={onExportPathChange}
                />
                <Field
                  placeholder="Export password"
                  type="password"
                  value={exportPassword}
                  onChange={onExportPasswordChange}
                />
                <ActionButton type="submit" disabled={!activeVault || isBusy}>
                  <Upload size={16} />
                  <span>Export</span>
                </ActionButton>
              </form>
            </Panel>

            <Panel title="Import">
              {importError ? <ErrorBanner message={importError} /> : null}
              <form className="grid gap-3" onSubmit={onImport}>
                <PathField
                  placeholder="Import path"
                  value={importPath}
                  onBrowse={onChooseImportPath}
                  onChange={onImportPathChange}
                />
                <Field
                  placeholder="Import password"
                  type="password"
                  value={importPassword}
                  onChange={onImportPasswordChange}
                />
                <ActionButton type="submit" disabled={isBusy}>
                  <Download size={16} />
                  <span>Import</span>
                </ActionButton>
              </form>
            </Panel>
          </>
        ) : activeSection === "shortcuts" ? (
          <Panel title="Shortcuts">
            <ShortcutTable />
          </Panel>
        ) : activeSection === "preferences" ? (
          <>
            <Panel title="Terminal">
              <ReadOnlyValue value={`Cascadia Mono, ${terminalFontSize}px`} />
            </Panel>

            <Panel title="Theme">
              {terminalThemeError ? (
                <ErrorBanner message={terminalThemeError} />
              ) : null}
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Active theme</Label>
                  <ActionButton type="button" onClick={onCreateTheme} disabled={isBusy}>
                    <Plus size={16} />
                    <span>Create theme</span>
                  </ActionButton>
                </div>

                <div className="grid gap-2">
                  {terminalThemes.map((theme) => {
                    const active = theme.id === activeTerminalThemeId;
                    return (
                      <div
                        key={theme.id}
                        role="button"
                        tabIndex={0}
                        className={`grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 py-2 text-left ${
                          active
                            ? "border-[#1e9bff] bg-[#24364d]"
                            : "border-[#343a52] bg-[#1c2134] hover:border-[#4a526d] hover:bg-[#23283d]"
                        }`}
                        onClick={() => {
                          if (isBusy) return;
                          if (!active) onActiveTerminalThemeChange(theme.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          if (isBusy) return;
                          if (!active) onActiveTerminalThemeChange(theme.id);
                        }}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">
                            {theme.name}
                          </div>
                        </div>
                        {!theme.readOnly ? (
                          <button
                            type="button"
                            className="grid size-8 place-items-center rounded-md text-[#ffb8c0] hover:bg-[#2a171b] disabled:opacity-50"
                            disabled={isBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteTheme(theme);
                            }}
                            aria-label={`Delete ${theme.name}`}
                            title={`Delete ${theme.name}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <span className="size-8" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          </>
        ) : (
          <AboutPanel
            appUpdate={appUpdate}
            onCheckForUpdates={onCheckForUpdates}
            onInstallUpdate={onInstallUpdate}
          />
        )}
      </div>
    </section>
  );
}

function AboutPanel({
  appUpdate,
  onCheckForUpdates,
  onInstallUpdate,
}: {
  appUpdate: AppUpdateState;
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
}) {
  const busy =
    appUpdate.status === "checking" ||
    appUpdate.status === "downloading" ||
    appUpdate.status === "installing" ||
    appUpdate.status === "ready";
  const canInstall = appUpdate.status === "available";
  const canCheck = !busy;

  return (
    <Panel title="About">
      <div className="grid gap-3">
        <div className="grid gap-2">
          <Label>Version</Label>
          <ReadOnlyValue value={`Termini ${appUpdate.currentVersion || "loading"}`} />
        </div>

        <div className="rounded-lg border border-[#343a52] bg-[#1c2134] p-3">
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#252a3f] text-[#9ca4bf]">
              {appUpdate.status === "current" ? (
                <CheckCircle2 size={17} />
              ) : appUpdate.status === "checking" ||
                appUpdate.status === "downloading" ||
                appUpdate.status === "installing" ? (
                <RefreshCw size={17} className="animate-spin" />
              ) : (
                <Info size={17} />
              )}
            </span>

            <div className="grid min-w-0 flex-1 gap-2">
              <div>
                <div className="text-sm font-semibold text-white">
                  {updateStatusTitle(appUpdate)}
                </div>
                <div className="mt-1 text-xs leading-5 text-[#9ca4bf]">
                  {updateStatusDescription(appUpdate)}
                </div>
              </div>

              {appUpdate.status === "downloading" ? (
                <DownloadProgress appUpdate={appUpdate} />
              ) : null}

              {appUpdate.notes ? (
                <div className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-[#343a52] bg-[#151929] p-3 text-xs leading-5 text-[#c9d0e8]">
                  {appUpdate.notes}
                </div>
              ) : null}

              {appUpdate.error ? <ErrorBanner message={appUpdate.error} /> : null}

              <div className="flex flex-wrap gap-2">
                {canInstall ? (
                  <ActionButton type="button" onClick={onInstallUpdate}>
                    <Download size={16} />
                    <span>Update</span>
                  </ActionButton>
                ) : null}

                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-[#3a4058] bg-[#33384f] px-3 text-sm font-semibold text-white hover:bg-[#3d435c] disabled:opacity-50"
                  disabled={!canCheck}
                  onClick={onCheckForUpdates}
                >
                  <RefreshCw size={16} />
                  <span>Check</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function DownloadProgress({ appUpdate }: { appUpdate: AppUpdateState }) {
  const percent =
    appUpdate.totalBytes && appUpdate.totalBytes > 0
      ? Math.min(100, (appUpdate.downloadedBytes / appUpdate.totalBytes) * 100)
      : null;

  return (
    <div className="grid gap-2">
      <div className="h-2 overflow-hidden rounded-full bg-[#111426]">
        <div
          className="h-full rounded-full bg-[#44d19d]"
          style={{ width: `${percent ?? 25}%` }}
        />
      </div>
      <div className="text-xs text-[#9ca4bf]">
        {percent === null
          ? `${formatBytes(appUpdate.downloadedBytes)} downloaded`
          : `${Math.round(percent)}% (${formatBytes(
              appUpdate.downloadedBytes,
            )} / ${formatBytes(appUpdate.totalBytes ?? 0)})`}
      </div>
    </div>
  );
}

function updateStatusTitle(appUpdate: AppUpdateState) {
  if (appUpdate.status === "checking") return "Checking for updates";
  if (appUpdate.status === "current") return "Termini is up to date";
  if (appUpdate.status === "available") return "Update available";
  if (appUpdate.status === "downloading") return "Downloading update";
  if (appUpdate.status === "installing") return "Installing update";
  if (appUpdate.status === "ready") return "Restarting Termini";
  if (appUpdate.status === "error") return "Update check failed";
  return "Update checks are ready";
}

function updateStatusDescription(appUpdate: AppUpdateState) {
  if (appUpdate.status === "available" && appUpdate.availableVersion) {
    return `Version ${appUpdate.availableVersion} is ready to install.`;
  }

  if (appUpdate.status === "checking") {
    return "Termini is checking the release channel.";
  }

  if (appUpdate.status === "current") {
    return "No newer release is available.";
  }

  if (appUpdate.status === "downloading") {
    return "Keep Termini open while the update downloads.";
  }

  if (appUpdate.status === "installing") {
    return "The update is being installed.";
  }

  if (appUpdate.status === "ready") {
    return "Termini will restart into the updated version.";
  }

  if (appUpdate.status === "error") {
    return "You can try checking again.";
  }

  return "Termini checks for updates automatically after launch.";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(1)} MB`;
}
