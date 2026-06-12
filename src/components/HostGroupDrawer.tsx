import { Save } from "lucide-react";
import type { FormEvent } from "react";
import { groupTagColorById, groupTagPalette } from "../groupTags";
import { ActionButton, Drawer, ErrorBanner, Field, Label } from "./ui";

type GroupColor = (typeof groupTagPalette)[number];

export interface HostGroupFormState {
  label: string;
  colorId: string;
}

const previewLabelMaxLength = 8;

export function HostGroupDrawer({
  error,
  form,
  isBusy,
  onChange,
  onClose,
  onSubmit,
}: {
  error: string;
  form: HostGroupFormState;
  isBusy: boolean;
  onChange: (form: HostGroupFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const selectedColor = groupTagColorById(form.colorId);

  return (
    <Drawer title="Edit group" onClose={onClose}>
      <form className="grid gap-4" onSubmit={onSubmit} noValidate>
        {error ? <ErrorBanner message={error} /> : null}
        <Field
          value={form.label}
          onChange={(label) => onChange({ ...form, label })}
          placeholder="Group label"
        />
        <div className="grid gap-2">
          <Label>Color</Label>
          <div className="grid grid-cols-4 gap-2">
            {groupTagPalette.map((color) => (
              <ColorSwatch
                key={color.id}
                color={color}
                label={form.label.trim() || "Group"}
                selected={color.id === selectedColor.id}
                onSelect={() => onChange({ ...form, colorId: color.id })}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <ActionButton type="submit" disabled={isBusy}>
            <Save size={16} />
            <span>Update</span>
          </ActionButton>
        </div>
      </form>
    </Drawer>
  );
}

function ColorSwatch({
  color,
  label,
  selected,
  onSelect,
}: {
  color: GroupColor;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const previewLabel = truncatePreviewLabel(label);

  return (
    <button
      type="button"
      aria-label={`Use ${color.id} group color`}
      aria-pressed={selected}
      title={label}
      className="grid h-10 min-w-0 cursor-pointer place-items-center rounded-md border px-2 transition hover:bg-[#252a3f]"
      style={{
        backgroundColor: "transparent",
        borderColor: selected ? color.text : "transparent",
      }}
      onClick={onSelect}
    >
      <span
        className="inline-flex max-w-full items-center rounded-md border px-2 py-1 text-xs font-bold"
        style={{
          backgroundColor: color.background,
          borderColor: color.border,
          color: color.text,
        }}
      >
        <span className="truncate">{previewLabel}</span>
      </span>
    </button>
  );
}

function truncatePreviewLabel(label: string) {
  return label.length > previewLabelMaxLength
    ? `${label.slice(0, previewLabelMaxLength)}...`
    : label;
}
