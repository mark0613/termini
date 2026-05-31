import {
  ArrowLeft,
  BookOpen,
  Database,
  Download,
  List,
  Terminal,
  Upload,
} from "lucide-react";
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
const settingsRailItems: Array<{
  id: SettingsSection;
  label: string;
  icon: typeof Database;
}> = [
  { id: "data", label: "Data & Security", icon: Database },
  { id: "shortcuts", label: "Shortcuts", icon: List },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "about", label: "About", icon: BookOpen },
];

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
  onBack,
  onSectionChange,
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
  onBack: () => void;
  onSectionChange: (section: SettingsSection) => void;
}) {
  return (
    <section className="grid min-h-0 grid-cols-[220px_minmax(0,1fr)] bg-[#1d2133]">
      <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] border-r border-[#2b3044] bg-[#252a3f]">
        <nav className="p-2">
          {settingsRailItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mb-1 flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold ${
                activeSection === item.id
                  ? "bg-[#464c65] text-white"
                  : "text-[#dfe4f7] hover:bg-[#343a52]"
              }`}
              onClick={() => onSectionChange(item.id)}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="min-h-0" />

        <div className="border-t border-[#343a52] p-2">
          <button
            type="button"
            className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold text-white hover:bg-[#343a52]"
            onClick={onBack}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
        </div>
      </aside>

      <div className="min-h-0 overflow-auto p-8">
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
        ) : activeSection === "terminal" ? (
          <Panel title="Terminal">
            <ReadOnlyValue value="Cascadia Mono, 13px" />
          </Panel>
        ) : (
          <Panel title="About">
            <ReadOnlyValue value="Termini 0.1.0" />
          </Panel>
        )}
      </div>
    </section>
  );
}
