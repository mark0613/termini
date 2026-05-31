import { Pencil, Plus, Search, Server, Terminal, Trash2 } from "lucide-react";
import type { Credential, SshProfile } from "../types";
import { EmptyState, ErrorBanner, IconButton } from "../components/ui";

export function VaultsPage({
  credentials,
  error,
  hostSearch,
  isBusy,
  profiles,
  selectedProfileId,
  onConnect,
  onDelete,
  onEdit,
  onNew,
  onSearchChange,
  onSelect,
}: {
  credentials: Credential[];
  error: string;
  hostSearch: string;
  isBusy: boolean;
  profiles: SshProfile[];
  selectedProfileId: string;
  onConnect: (profile: SshProfile) => void;
  onDelete: (id: string) => void;
  onEdit: (profile: SshProfile) => void;
  onNew: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="grid min-h-0 grid-rows-[64px_minmax(0,1fr)] border-l border-[#2b3044]">
      <div className="border-b border-[#2b3044] bg-[#252a3f] p-3">
        <div className="grid grid-cols-1">
          <div className="relative min-w-0">
            <Search
              size={17}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#8d93ad]"
            />
            <input
              className="h-9 w-full min-w-0 rounded-md border border-[#3a4058] bg-[#42485f] pr-3 pl-9 text-sm outline-none placeholder:text-[#9aa0ba] focus:border-[#1e9bff]"
              value={hostSearch}
              onChange={(event) => onSearchChange(event.currentTarget.value)}
              placeholder="Find a host or ssh user@hostname..."
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 overflow-auto bg-[#1d2133] p-8">
        {error ? <ErrorBanner message={error} /> : null}
        <HostsGrid
          credentials={credentials}
          isBusy={isBusy}
          profiles={profiles}
          selectedProfileId={selectedProfileId}
          onConnect={onConnect}
          onDelete={onDelete}
          onEdit={onEdit}
          onNew={onNew}
          onSelect={onSelect}
        />
      </div>
    </section>
  );
}

function HostsGrid({
  credentials,
  isBusy,
  profiles,
  selectedProfileId,
  onConnect,
  onDelete,
  onEdit,
  onNew,
  onSelect,
}: {
  credentials: Credential[];
  isBusy: boolean;
  profiles: SshProfile[];
  selectedProfileId: string;
  onConnect: (profile: SshProfile) => void;
  onDelete: (id: string) => void;
  onEdit: (profile: SshProfile) => void;
  onNew: () => void;
  onSelect: (id: string) => void;
}) {
  if (!profiles.length) {
    return (
      <EmptyState
        actionLabel="New host"
        icon={<Server size={24} />}
        title="No hosts"
        onAction={onNew}
      />
    );
  }

  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-white">Hosts</h2>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-md border border-[#3a4058] bg-[#33384f] px-3 text-sm font-semibold hover:bg-[#3d435c]"
          onClick={onNew}
        >
          <Plus size={16} />
          <span>New host</span>
        </button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2.5">
        {profiles.map((profile) => {
          const credential = profile.credentialId
            ? credentials.find((item) => item.id === profile.credentialId)
            : null;
          const selected = selectedProfileId === profile.id;
          return (
            <article
              key={profile.id}
              className={`group grid min-h-[60px] grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-2.5 ${
                selected
                  ? "border-[#1594ff] bg-[#282d43] shadow-[0_0_0_1px_#1594ff]"
                  : "border-transparent bg-[#282d43] hover:border-[#454c68]"
              }`}
              onClick={() => onSelect(profile.id)}
              onDoubleClick={() => onConnect(profile)}
            >
              <button
                type="button"
                className="grid size-10 place-items-center rounded-xl bg-[#ff6726] text-white"
                aria-label={`Connect ${profile.name}`}
                onClick={() => onConnect(profile)}
              >
                <Terminal size={20} />
              </button>
              <button type="button" className="min-w-0 text-left">
                <span className="block truncate text-sm font-bold text-white">
                  {profile.name}
                </span>
                <span className="block truncate text-xs text-[#9ca4bf]">
                  ssh, {profile.username}
                </span>
                <span className="block truncate text-xs text-[#7f87a2]">
                  {profile.username}@{profile.host}:{profile.port}
                  {credential ? ` · ${credential.label}` : ""}
                </span>
              </button>
              <div className="flex opacity-0 transition group-hover:opacity-100">
                <IconButton label="Edit" onClick={() => onEdit(profile)}>
                  <Pencil size={15} />
                </IconButton>
                <IconButton
                  label="Delete"
                  onClick={() => !isBusy && onDelete(profile.id)}
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
