import { ShortcutRow } from "./ui";

const shortcuts = [
  { keys: "Ctrl++", label: "Terminal zoom in" },
  { keys: "Ctrl+-", label: "Terminal zoom out" },
  { keys: "Alt+Shift+D", label: "Auto split" },
  { keys: "Alt+Shift++", label: "Vertical split" },
  { keys: "Alt+Shift+-", label: "Horizontal split" },
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
