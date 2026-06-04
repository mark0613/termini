import { Download, Plus, Trash2, Upload } from "lucide-react";
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

const databaseLocation = "%APPDATA%\\Termini\\termini.sqlite3";

export function SettingsPage({
  activeSection,
  activeVault,
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
}: {
  activeSection: SettingsSection;
  activeVault: Vault | null;
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
          <Panel title="About">
            <ReadOnlyValue value="Termini 0.1.0" />
          </Panel>
        )}
      </div>
    </section>
  );
}
