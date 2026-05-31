import { X } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

export function IconButton({
  active,
  children,
  label,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid size-8 shrink-0 place-items-center rounded-md border ${
        active
          ? "border-[#3a4058] bg-[#33384f] text-white"
          : "border-transparent text-[#d5daf0] hover:bg-[#252a3f] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function Drawer({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/35">
      <aside className="absolute top-0 right-0 grid h-full w-full max-w-[420px] grid-rows-[56px_minmax(0,1fr)] border-l border-[#2b3044] bg-[#1d2133] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#2b3044] px-4">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="min-h-0 overflow-auto p-4">{children}</div>
      </aside>
    </div>
  );
}

export function EmptyState({
  actionLabel,
  icon,
  title,
  onAction,
}: {
  actionLabel: string;
  icon: ReactNode;
  title: string;
  onAction: () => void;
}) {
  return (
    <div className="grid min-h-[320px] place-items-center rounded-xl border border-dashed border-[#343a52] bg-[#20253a]">
      <div className="grid justify-items-center gap-3">
        <span className="grid size-12 place-items-center rounded-xl bg-[#282d43] text-[#9ca4bf]">
          {icon}
        </span>
        <span className="text-sm font-bold text-white">{title}</span>
        <button
          type="button"
          className="h-9 rounded-md border border-[#3a4058] bg-[#33384f] px-3 text-sm font-semibold hover:bg-[#3d435c]"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-[#7f3333] bg-[#321b1b] px-3 py-2 text-sm text-[#ffc9c9]">
      {message}
    </div>
  );
}

export function Panel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="grid gap-3 rounded-xl border border-[#2b3044] bg-[#252a3f] p-4">
      <h2 className="text-sm font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="text-xs font-semibold text-[#9ca4bf]">{children}</span>;
}

export function Field({
  disabled,
  inputMode,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  disabled?: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  value: string;
}) {
  return (
    <input
      className="h-10 min-w-0 rounded-md border border-[#3a4058] bg-[#1c2134] px-3 text-sm outline-none placeholder:text-[#7f87a2] focus:border-[#1e9bff] disabled:opacity-50"
      disabled={disabled}
      inputMode={inputMode}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder={placeholder}
      type={type}
    />
  );
}

export function PathField({
  onBrowse,
  onChange,
  placeholder,
  value,
}: {
  onBrowse: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <Field value={value} onChange={onChange} placeholder={placeholder} />
      <button
        type="button"
        className="h-10 rounded-md border border-[#3a4058] bg-[#33384f] px-3 text-sm font-semibold hover:bg-[#3d435c]"
        onClick={onBrowse}
      >
        Browse
      </button>
    </div>
  );
}

export function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div className="rounded-md border border-[#3a4058] bg-[#1c2134] px-3 py-2 font-mono text-sm text-[#dfe4f7]">
      {value}
    </div>
  );
}

export function ActionButton({
  children,
  disabled,
  onClick,
  type,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 justify-self-start rounded-md border border-[#2e6f5d] bg-[#1f3a34] px-3 text-sm font-semibold text-white hover:bg-[#294b43] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  disabled,
  onClick,
  type,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-[#553238] bg-[#2a171b] px-3 text-sm font-semibold text-[#ffb8c0] hover:bg-[#3a1f25] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#343a52] py-2 last:border-0">
      <span className="text-sm text-[#dfe4f7]">{label}</span>
      <span className="rounded-md border border-[#3a4058] bg-[#1c2134] px-2 py-1 font-mono text-xs text-[#9ca4bf]">
        {keys}
      </span>
    </div>
  );
}
