import { Eye, EyeOff, LoaderCircle, Save, Trash2, X } from "lucide-react";
import type { CSSProperties, FormEvent } from "react";
import type { ProfileFormState } from "../appTypes";
import { groupTagColor } from "../groupTags";
import type { HostGroup } from "../types";
import {
  ActionButton,
  DangerButton,
  Drawer,
  ErrorBanner,
  Field,
  PathField,
} from "./ui";

export function ProfileDrawer({
  editing,
  error,
  form,
  groupOptions,
  isBusy,
  passwordLoading,
  passwordVisible,
  onChange,
  onClose,
  onDelete,
  onChooseSshKeyPath,
  onTogglePasswordVisibility,
  onSubmit,
}: {
  editing: boolean;
  error: string;
  form: ProfileFormState;
  groupOptions: HostGroup[];
  isBusy: boolean;
  passwordLoading: boolean;
  passwordVisible: boolean;
  onChange: (form: ProfileFormState) => void;
  onClose: () => void;
  onDelete: () => void;
  onChooseSshKeyPath: () => void;
  onTogglePasswordVisibility: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const passwordToggleLabel = passwordVisible
    ? "Hide password"
    : editing && form.credentialId && !form.password
      ? "Show saved password"
      : "Show password";
  const canClearPassword = editing && Boolean(form.credentialId);

  function handlePasswordChange(password: string) {
    onChange({
      ...form,
      credentialId: editing && !password.trim() ? "" : form.credentialId,
      password,
    });
  }

  return (
    <Drawer title={editing ? "Edit host" : "New host"} onClose={onClose}>
      <form className="relative grid gap-3" onSubmit={onSubmit} noValidate>
        {passwordLoading ? (
          <div
            className="absolute inset-0 z-10 grid place-items-center rounded-lg bg-[#1d2133]/80 backdrop-blur-sm"
            role="status"
            aria-label="Loading password"
          >
            <LoaderCircle size={22} className="animate-spin text-[#dfe4f7]" />
          </div>
        ) : null}
        {error ? <ErrorBanner message={error} /> : null}
        <Field
          value={form.name}
          onChange={(name) => onChange({ ...form, name })}
          placeholder="Label"
        />
        <GroupTagPicker
          options={groupOptions}
          value={form.group}
          onChange={(group) => onChange({ ...form, group })}
        />
        <Field
          value={form.username}
          onChange={(username) => onChange({ ...form, username })}
          placeholder="Username"
        />
        <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-2">
          <Field
            value={form.host}
            onChange={(host) => onChange({ ...form, host })}
            placeholder="Host / IP address"
          />
          <Field
            value={form.port}
            onChange={(port) => onChange({ ...form, port })}
            placeholder="Port"
            inputMode="numeric"
          />
        </div>
        <div
          className={
            canClearPassword
              ? "grid grid-cols-[minmax(0,1fr)_40px_40px] gap-2"
              : "grid grid-cols-[minmax(0,1fr)_40px] gap-2"
          }
        >
          <Field
            disabled={passwordLoading}
            value={form.password}
            onChange={handlePasswordChange}
            placeholder="Password (optional)"
            type={passwordVisible ? "text" : "password"}
          />
          {canClearPassword ? (
            <button
              type="button"
              aria-label="Clear saved password"
              title="Clear saved password"
              disabled={isBusy || passwordLoading}
              className="grid size-10 place-items-center rounded-md border border-[#3a4058] bg-[#33384f] text-[#d5daf0] hover:bg-[#3d435c] hover:text-white disabled:opacity-50"
              onClick={() => {
                onChange({ ...form, credentialId: "", password: "" });
              }}
            >
              <X size={16} />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={passwordToggleLabel}
            title={passwordToggleLabel}
            disabled={isBusy || passwordLoading}
            className="grid size-10 place-items-center rounded-md border border-[#3a4058] bg-[#33384f] text-[#d5daf0] hover:bg-[#3d435c] hover:text-white disabled:opacity-50"
            onClick={onTogglePasswordVisibility}
          >
            {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <PathField
          value={form.sshKeyPath}
          onChange={(sshKeyPath) => onChange({ ...form, sshKeyPath })}
          placeholder="SSH key path (optional)"
          onBrowse={onChooseSshKeyPath}
        />
        <div className="flex gap-2 pt-2">
          <ActionButton type="submit" disabled={isBusy}>
            <Save size={16} />
            <span>{editing ? "Update" : "Create"}</span>
          </ActionButton>
          {editing ? (
            <DangerButton type="button" disabled={isBusy} onClick={onDelete}>
              <Trash2 size={16} />
              <span>Delete</span>
            </DangerButton>
          ) : null}
        </div>
      </form>
    </Drawer>
  );
}

function GroupTagPicker({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: HostGroup[];
  value: string;
}) {
  const selectedGroup = value.trim();
  const selectedOption = options.find((option) => option.label === selectedGroup);
  const color = groupTagColor(selectedGroup, selectedOption?.colorId);

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2">
        <div className="relative min-w-0">
          <span
            className="absolute top-1/2 left-3 size-2.5 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: color.border }}
          />
          <input
            className="h-10 w-full min-w-0 rounded-md border border-[#3a4058] bg-[#1c2134] pr-3 pl-8 text-sm outline-none placeholder:text-[#7f87a2] focus:border-[#1e9bff]"
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            placeholder="Group tag"
          />
        </div>
        <button
          type="button"
          aria-label="Clear group"
          disabled={!selectedGroup}
          className="grid size-10 place-items-center rounded-md border border-[#3a4058] bg-[#33384f] text-[#d5daf0] hover:bg-[#3d435c] hover:text-white disabled:opacity-40"
          onClick={() => onChange("")}
        >
          <X size={16} />
        </button>
      </div>
      {options.length ? (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = option.label === selectedGroup;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                className="inline-flex h-7 max-w-full items-center rounded-md border px-2 text-xs font-semibold"
                style={groupTagStyle(option.label, selected, option.colorId)}
                onClick={() => onChange(option.label)}
              >
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function groupTagStyle(
  group: string,
  selected: boolean,
  colorId?: string | null,
): CSSProperties {
  const color = groupTagColor(group, colorId);
  return {
    backgroundColor: selected ? color.background : `${color.background}99`,
    borderColor: selected ? color.text : color.border,
    color: color.text,
  };
}
