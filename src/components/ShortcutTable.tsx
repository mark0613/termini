import { ShortcutRow } from "./ui";

const shortcuts = [
  { keys: "Alt+Shift+D", label: "Auto split" },
  { keys: "Ctrl+Shift+W", label: "Close active terminal" },
  { keys: "Alt+Shift+-", label: "Horizontal split" },
  { keys: "Tab", label: "Send saved password when prompted" },
  { keys: "Ctrl++", label: "Terminal zoom in" },
  { keys: "Ctrl+-", label: "Terminal zoom out" },
  { keys: "Alt+Shift++", label: "Vertical split" },
];

export function ShortcutTable() {
  return (
    <div>
      {shortcuts.map((shortcut) => (
        <ShortcutRow
          key={`${shortcut.keys}-${shortcut.label}`}
          keys={shortcut.keys}
          label={shortcut.label}
        />
      ))}
    </div>
  );
}
