export const DEFAULT_TERMINAL_THEME_ID = "termini-default";

export const TERMINAL_THEME_COLOR_FIELDS = [
  { key: "background", label: "Background" },
  { key: "foreground", label: "Foreground" },
  { key: "cursor", label: "Cursor" },
  { key: "selectionBackground", label: "Selection" },
  { key: "black", label: "Black" },
  { key: "red", label: "Red" },
  { key: "green", label: "Green" },
  { key: "yellow", label: "Yellow" },
  { key: "blue", label: "Blue" },
  { key: "magenta", label: "Magenta" },
  { key: "cyan", label: "Cyan" },
  { key: "white", label: "White" },
  { key: "brightBlack", label: "Bright black" },
  { key: "brightRed", label: "Bright red" },
  { key: "brightGreen", label: "Bright green" },
  { key: "brightYellow", label: "Bright yellow" },
  { key: "brightBlue", label: "Bright blue" },
  { key: "brightMagenta", label: "Bright magenta" },
  { key: "brightCyan", label: "Bright cyan" },
  { key: "brightWhite", label: "Bright white" },
] as const;

export type TerminalThemeColorKey =
  (typeof TERMINAL_THEME_COLOR_FIELDS)[number]["key"];

export type TerminalThemeColors = Record<TerminalThemeColorKey, string>;

export interface TerminalThemeConfig {
  id: string;
  name: string;
  colors: TerminalThemeColors;
  readOnly?: boolean;
}

export interface TerminalThemeDraft {
  name: string;
  colors: TerminalThemeColors;
}

export interface StoredTerminalTheme {
  id: string;
  name: string;
  colorsJson: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_TERMINAL_THEME: TerminalThemeConfig = {
  id: DEFAULT_TERMINAL_THEME_ID,
  name: "Termini Default",
  readOnly: true,
  colors: {
    background: "#0d1116",
    foreground: "#d9e3ec",
    cursor: "#55c2a2",
    selectionBackground: "#2e6f5d",
    black: "#0d1116",
    red: "#ff5c7a",
    green: "#6ee7a8",
    yellow: "#ffd166",
    blue: "#5aa9ff",
    magenta: "#c792ea",
    cyan: "#67d8ef",
    white: "#d9e3ec",
    brightBlack: "#5f6b7a",
    brightRed: "#ff7b93",
    brightGreen: "#8ff0bd",
    brightYellow: "#ffe08a",
    brightBlue: "#84c3ff",
    brightMagenta: "#dab6ff",
    brightCyan: "#9be8ff",
    brightWhite: "#ffffff",
  },
};

const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

export function serializeTerminalThemeDraft(theme: TerminalThemeDraft) {
  return JSON.stringify(
    {
      name: theme.name,
      colors: theme.colors,
    },
    null,
    2,
  );
}

export function parseTerminalThemeJson(value: string):
  | { theme: TerminalThemeDraft; error: null }
  | { theme: null; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (err) {
    return {
      theme: null,
      error: err instanceof Error ? err.message : "Invalid JSON",
    };
  }

  if (!isRecord(parsed)) {
    return { theme: null, error: "Theme JSON must be an object." };
  }

  if (typeof parsed.name !== "string" || !parsed.name.trim()) {
    return { theme: null, error: "Theme name is required." };
  }

  if (!isRecord(parsed.colors)) {
    return { theme: null, error: "Theme colors must be an object." };
  }

  const colors: TerminalThemeColors = { ...DEFAULT_TERMINAL_THEME.colors };
  for (const field of TERMINAL_THEME_COLOR_FIELDS) {
    const nextColor = parsed.colors[field.key];
    if (nextColor === undefined) continue;
    if (typeof nextColor !== "string" || !hexColorPattern.test(nextColor)) {
      return {
        theme: null,
        error: `${field.label} must be a #RRGGBB color.`,
      };
    }
    colors[field.key] = nextColor.toLowerCase();
  }

  return {
    theme: {
      name: parsed.name.trim(),
      colors,
    },
    error: null,
  };
}

export function storedThemeToConfig(
  theme: StoredTerminalTheme,
): TerminalThemeConfig | null {
  let colors: unknown;
  try {
    colors = JSON.parse(theme.colorsJson);
  } catch {
    return null;
  }

  const parsed = parseTerminalThemeJson(
    JSON.stringify({ name: theme.name, colors }),
  );
  if (!parsed.theme) return null;
  return {
    id: theme.id,
    name: parsed.theme.name,
    colors: parsed.theme.colors,
  };
}

export function toStoredColorsJson(theme: TerminalThemeDraft) {
  return JSON.stringify(theme.colors);
}

export function toXtermTheme(theme: TerminalThemeConfig = DEFAULT_TERMINAL_THEME) {
  return { ...theme.colors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
