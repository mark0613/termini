import { Upload, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import {
  parseTerminalThemeJson,
  serializeTerminalThemeDraft,
  TERMINAL_THEME_COLOR_FIELDS,
  type TerminalThemeColorKey,
  type TerminalThemeDraft,
} from "../terminalThemes";
import { ErrorBanner, IconButton } from "./ui";

export function ThemeEditorModal({
  initialTheme,
  isBusy,
  onClose,
  onSave,
}: {
  initialTheme: TerminalThemeDraft;
  isBusy: boolean;
  onClose: () => void;
  onSave: (theme: TerminalThemeDraft) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [theme, setTheme] = useState<TerminalThemeDraft>(initialTheme);
  const [jsonText, setJsonText] = useState(() =>
    serializeTerminalThemeDraft(initialTheme),
  );
  const [validationError, setValidationError] = useState("");
  const [saveError, setSaveError] = useState("");

  function applyTheme(nextTheme: TerminalThemeDraft) {
    setTheme(nextTheme);
    setJsonText(serializeTerminalThemeDraft(nextTheme));
    setValidationError("");
    setSaveError("");
  }

  function handleJsonChange(value: string) {
    setJsonText(value);
    setSaveError("");
    const parsed = parseTerminalThemeJson(value);
    if (!parsed.theme) {
      setValidationError(parsed.error);
      return;
    }

    setTheme(parsed.theme);
    setValidationError("");
  }

  function handleNameChange(name: string) {
    applyTheme({ ...theme, name });
  }

  function handleColorChange(
    key: TerminalThemeColorKey,
    value: string,
  ) {
    const nextValue = value.toLowerCase();
    if (!/^#[0-9a-f]{6}$/i.test(nextValue)) {
      setValidationError("Color must be a #RRGGBB value.");
      return;
    }

    applyTheme({
      ...theme,
      colors: {
        ...theme.colors,
        [key]: nextValue,
      },
    });
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    handleJsonChange(text);
  }

  async function handleSave() {
    const parsed = parseTerminalThemeJson(jsonText);
    if (!parsed.theme) {
      setValidationError(parsed.error);
      return;
    }

    setSaveError("");
    try {
      await onSave(parsed.theme);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }

  const disabled = Boolean(validationError) || isBusy;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-6">
      <section className="mx-auto grid h-full max-h-[860px] w-full max-w-6xl grid-rows-[56px_minmax(0,1fr)_64px] rounded-xl border border-[#2b3044] bg-[#1d2133] shadow-2xl">
        <header className="flex min-w-0 items-center justify-between border-b border-[#2b3044] px-4">
          <h2 className="text-sm font-bold text-white">Create theme</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>

        <div className="grid min-h-0 grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] gap-4 overflow-hidden p-4">
          <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
              <div>
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    void handleUpload(event.currentTarget.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-[#3a4058] bg-[#33384f] px-3 text-sm font-semibold hover:bg-[#3d435c]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={16} />
                  <span>Upload JSON</span>
                </button>
              </div>

              <label className="grid gap-1">
                <span className="text-xs font-semibold text-[#9ca4bf]">
                  Theme name
                </span>
                <input
                  className="h-10 min-w-0 rounded-md border border-[#3a4058] bg-[#1c2134] px-3 text-sm outline-none focus:border-[#1e9bff]"
                  value={theme.name}
                  onChange={(event) => handleNameChange(event.currentTarget.value)}
                />
              </label>
            </div>

            <div className="grid min-h-0 grid-rows-[minmax(170px,0.48fr)_minmax(220px,0.52fr)] gap-3">
              <div className="min-h-0 overflow-auto rounded-lg border border-[#2b3044] bg-[#20253a] p-3">
                <div className="grid grid-cols-2 gap-2">
                  {TERMINAL_THEME_COLOR_FIELDS.map((field) => (
                    <label
                      key={field.key}
                      className="grid grid-cols-[minmax(88px,1fr)_28px_96px] items-center gap-2 text-xs"
                    >
                      <span className="truncate font-semibold text-[#dfe4f7]">
                        {field.label}
                      </span>
                      <input
                        type="color"
                        className="h-7 w-7 rounded border border-[#3a4058] bg-transparent p-0"
                        value={theme.colors[field.key]}
                        onChange={(event) =>
                          handleColorChange(field.key, event.currentTarget.value)
                        }
                      />
                      <input
                        className="h-7 rounded border border-[#3a4058] bg-[#1c2134] px-2 font-mono text-xs outline-none focus:border-[#1e9bff]"
                        value={theme.colors[field.key]}
                        onChange={(event) =>
                          handleColorChange(field.key, event.currentTarget.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2">
                <textarea
                  className="min-h-0 resize-none rounded-lg border border-[#2b3044] bg-[#111426] p-3 font-mono text-xs leading-5 text-[#dfe4f7] outline-none focus:border-[#1e9bff]"
                  value={jsonText}
                  spellCheck={false}
                  onChange={(event) => handleJsonChange(event.currentTarget.value)}
                />
                {validationError ? <ErrorBanner message={validationError} /> : null}
                {saveError ? <ErrorBanner message={saveError} /> : null}
              </div>
            </div>
          </div>

          <TerminalThemePreview theme={theme} />
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#2b3044] px-4">
          <button
            type="button"
            className="h-9 rounded-md border border-[#3a4058] bg-[#33384f] px-3 text-sm font-semibold hover:bg-[#3d435c]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled}
            className="h-9 rounded-md border border-[#2e6f5d] bg-[#1f3a34] px-3 text-sm font-semibold text-white hover:bg-[#294b43] disabled:opacity-50"
            onClick={handleSave}
          >
            Save
          </button>
        </footer>
      </section>
    </div>
  );
}

function TerminalThemePreview({ theme }: { theme: TerminalThemeDraft }) {
  const colors = theme.colors;
  return (
    <div
      className="min-h-0 overflow-hidden rounded-lg border border-[#2b3044] p-4 font-mono text-sm shadow-inner"
      style={{
        background: colors.background,
        color: colors.foreground,
      }}
    >
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-4">
        <div className="flex items-center justify-between border-b pb-3 text-xs"
          style={{ borderColor: colors.selectionBackground }}
        >
          <span style={{ color: colors.brightCyan }}>termini preview</span>
          <span style={{ color: colors.brightBlack }}>{theme.name}</span>
        </div>

        <div className="min-h-0 overflow-hidden leading-6">
          <Line>
            <span style={{ color: colors.green }}>deploy@prod-api</span>
            <span style={{ color: colors.foreground }}>:</span>
            <span style={{ color: colors.blue }}>~/app</span>
            <span style={{ color: colors.foreground }}>$ ls --color</span>
          </Line>
          <Line>
            <span style={{ color: colors.blue }}>drwxr-xr-x</span>
            <span>  src</span>
          </Line>
          <Line>
            <span style={{ color: colors.green }}>-rwxr-xr-x</span>
            <span>  deploy.sh</span>
          </Line>
          <Line>
            <span style={{ color: colors.yellow }}>warning:</span>
            <span> using cached host key</span>
          </Line>
          <Line>
            <span style={{ color: colors.red }}>error:</span>
            <span> permission denied</span>
          </Line>
          <Line>
            <span style={{ color: colors.green }}>success:</span>
            <span> connected</span>
          </Line>
          <Line>
            <span style={{ color: colors.magenta }}>[sudo]</span>
            <span> password for deploy: </span>
            <span
              className="inline-block h-4 w-2 align-middle"
              style={{ background: colors.cursor }}
            />
          </Line>
          <Line>
            <span
              className="rounded px-1"
              style={{
                background: colors.selectionBackground,
                color: colors.brightWhite,
              }}
            >
              selected output sample
            </span>
          </Line>
          <div className="mt-5 grid grid-cols-4 gap-2 text-xs">
            {[
              ["black", colors.black],
              ["red", colors.red],
              ["green", colors.green],
              ["yellow", colors.yellow],
              ["blue", colors.blue],
              ["magenta", colors.magenta],
              ["cyan", colors.cyan],
              ["white", colors.white],
            ].map(([label, color]) => (
              <span key={label} className="flex items-center gap-2">
                <span
                  className="inline-block size-3 rounded-sm"
                  style={{ background: color }}
                />
                <span style={{ color }}>{label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ children }: { children: ReactNode }) {
  return <div className="min-h-6 whitespace-pre-wrap">{children}</div>;
}
