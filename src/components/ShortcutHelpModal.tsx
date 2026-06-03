import { X } from "lucide-react";
import { ShortcutTable } from "./ShortcutTable";
import { IconButton } from "./ui";

export function ShortcutHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-help-title"
        className="grid w-full max-w-md grid-rows-[56px_minmax(0,1fr)] rounded-xl border border-[#2b3044] bg-[#1d2133] shadow-2xl"
      >
        <header className="flex min-w-0 items-center justify-between border-b border-[#2b3044] px-4">
          <h2 id="shortcut-help-title" className="text-sm font-bold text-white">
            Shortcuts
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="min-h-0 overflow-auto p-4">
          <ShortcutTable />
        </div>
      </section>
    </div>
  );
}
