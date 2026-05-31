import {
  BookOpen,
  Database,
  Keyboard,
  Server,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { AppPage, SettingsSection } from "../appTypes";

const settingsRailItems: Array<{
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "data", label: "Data & Security", icon: Database },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "about", label: "About", icon: BookOpen },
];

export function AppSidebar({
  activePage,
  activeSettingsSection,
  onHostsClick,
  onSettingsSectionClick,
}: {
  activePage: AppPage;
  activeSettingsSection: SettingsSection;
  onHostsClick: () => void;
  onSettingsSectionClick: (section: SettingsSection) => void;
}) {
  return (
    <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-[#272c40]">
      <nav className="grid gap-1 p-2">
        <RailButton
          active={activePage === "vaults"}
          icon={Server}
          label="Hosts"
          onClick={onHostsClick}
        />

        {settingsRailItems.map((item) => (
          <RailButton
            key={item.id}
            active={activePage === "settings" && activeSettingsSection === item.id}
            icon={item.icon}
            label={item.label}
            onClick={() => onSettingsSectionClick(item.id)}
          />
        ))}
      </nav>

      <div className="min-h-0" />
    </aside>
  );
}

function RailButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex h-9 items-center gap-3 rounded-md px-3 text-left text-sm font-semibold ${
        active ? "bg-[#464c65] text-white" : "text-white hover:bg-[#343a52]"
      }`}
      onClick={onClick}
    >
      <Icon size={16} />
      <span className="truncate">{label}</span>
    </button>
  );
}
