import { Download, Upload } from "lucide-react";
import type { FormEvent } from "react";
import type { SettingsSection } from "../appTypes";
import {
  ActionButton,
  Field,
  Label,
  Panel,
  PathField,
  ReadOnlyValue,
  ShortcutRow,
} from "../components/ui";
import type { Vault } from "../types";

const databaseLocation = "%APPDATA%\\Termini\\termini.sqlite3";

export function SettingsPage({
  activeSection,
  activeVault,
  exportPassword,
  exportPath,
  importPassword,
  importPath,
  isBusy,
  onChooseExportPath,
  onChooseImportPath,
  onExport,
  onExportPasswordChange,
  onExportPathChange,
  onImport,
  onImportPasswordChange,
  onImportPathChange,
}: {
  activeSection: SettingsSection;
  activeVault: Vault | null;
  exportPassword: string;
  exportPath: string;
  importPassword: string;
  importPath: string;
  isBusy: boolean;
  onChooseExportPath: () => void;
  onChooseImportPath: () => void;
  onExport: (event: FormEvent) => void;
  onExportPasswordChange: (value: string) => void;
  onExportPathChange: (value: string) => void;
  onImport: (event: FormEvent) => void;
  onImportPasswordChange: (value: string) => void;
  onImportPathChange: (value: string) => void;
}) {
  return (
    <section className="min-h-0 overflow-auto bg-[#1d2133] p-8">
      {activeSection === "data" ? (
        <div className="grid max-w-3xl gap-5">
          <Panel title="Database">
            <div className="grid gap-2">
              <Label>Location</Label>
              <ReadOnlyValue value={databaseLocation} />
            </div>
          </Panel>

          <Panel title="Export">
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
              <ActionButton
                type="submit"
                disabled={!activeVault || !exportPath || isBusy}
              >
                <Upload size={16} />
                <span>Export</span>
              </ActionButton>
            </form>
          </Panel>

          <Panel title="Import">
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
              <ActionButton type="submit" disabled={!importPath || isBusy}>
                <Download size={16} />
                <span>Import</span>
              </ActionButton>
            </form>
          </Panel>
        </div>
      ) : activeSection === "shortcuts" ? (
        <Panel title="Shortcuts">
          <ShortcutRow keys="Alt+Shift+D" label="Auto split" />
          <ShortcutRow keys="Alt+Shift++" label="Vertical split" />
          <ShortcutRow keys="Alt+Shift+-" label="Horizontal split" />
        </Panel>
      ) : activeSection === "preferences" ? (
        <Panel title="Terminal">
          <ReadOnlyValue value="Cascadia Mono, 13px" />
        </Panel>
      ) : (
        <Panel title="About">
          <ReadOnlyValue value="Termini 0.1.0" />
        </Panel>
      )}
    </section>
  );
}
