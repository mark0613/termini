import { Eye, EyeOff, LoaderCircle, Save, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import type { ProfileFormState } from "../appTypes";
import {
  ActionButton,
  DangerButton,
  Drawer,
  ErrorBanner,
  Field,
} from "./ui";

export function ProfileDrawer({
  editing,
  error,
  form,
  isBusy,
  passwordLoading,
  passwordVisible,
  onChange,
  onClose,
  onDelete,
  onTogglePasswordVisibility,
  onSubmit,
}: {
  editing: boolean;
  error: string;
  form: ProfileFormState;
  isBusy: boolean;
  passwordLoading: boolean;
  passwordVisible: boolean;
  onChange: (form: ProfileFormState) => void;
  onClose: () => void;
  onDelete: () => void;
  onTogglePasswordVisibility: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const passwordToggleLabel = passwordVisible
    ? "Hide password"
    : editing && form.credentialId && !form.password
      ? "Show saved password"
      : "Show password";

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
        <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2">
          <Field
            disabled={passwordLoading}
            value={form.password}
            onChange={(password) => onChange({ ...form, password })}
            placeholder="Password"
            type={passwordVisible ? "text" : "password"}
          />
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
