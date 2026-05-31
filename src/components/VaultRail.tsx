import { Server, Settings } from "lucide-react";
import type { VaultSection } from "../appTypes";

const vaultRailItems: Array<{
  id: VaultSection;
  label: string;
  icon: typeof Server;
}> = [{ id: "hosts", label: "Hosts", icon: Server }];

export function VaultRail({
  activeSection,
  onSectionChange,
  onSettingsClick,
}: {
  activeSection: VaultSection;
  onSectionChange: (section: VaultSection) => void;
  onSettingsClick: () => void;
}) {
  return (
    <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-[#272c40]">
      <nav className="grid gap-2 p-2">
        {vaultRailItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`flex h-9 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold ${
              activeSection === item.id
                ? "bg-[#464c65] text-white"
                : "text-white hover:bg-[#343a52]"
            }`}
            onClick={() => onSectionChange(item.id)}
          >
            <item.icon size={16} />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="min-h-0" />

      <div className="border-t border-[#343a52] p-2">
        <button
          type="button"
          className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold text-white hover:bg-[#343a52]"
          onClick={onSettingsClick}
        >
          <Settings size={16} />
          <span className="truncate">Settings</span>
        </button>
      </div>
    </aside>
  );
}
