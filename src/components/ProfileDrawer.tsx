import { Save, Trash2 } from "lucide-react";
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
  onChange,
  onClose,
  onDelete,
  onSubmit,
}: {
  editing: boolean;
  error: string;
  form: ProfileFormState;
  isBusy: boolean;
  onChange: (form: ProfileFormState) => void;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Drawer title={editing ? "Edit host" : "New host"} onClose={onClose}>
      <form className="grid gap-3" onSubmit={onSubmit} noValidate>
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
        <Field
          value={form.password}
          onChange={(password) => onChange({ ...form, password })}
          placeholder={editing ? "New password, leave blank to keep" : "Password"}
          type="password"
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
