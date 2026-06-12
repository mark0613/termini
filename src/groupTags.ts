export const ungroupedGroupName = "Ungrouped";

export const groupTagPalette = [
  { id: "green", background: "#0f3f2e", border: "#34d399", text: "#d1fae5" },
  { id: "blue", background: "#1e3a8a", border: "#60a5fa", text: "#dbeafe" },
  { id: "purple", background: "#44206f", border: "#c084fc", text: "#f3e8ff" },
  { id: "rose", background: "#5f1f3a", border: "#fb7185", text: "#ffe4e6" },
  { id: "amber", background: "#4a3b09", border: "#facc15", text: "#fef9c3" },
  { id: "cyan", background: "#164e4a", border: "#2dd4bf", text: "#ccfbf1" },
  { id: "orange", background: "#5a240b", border: "#fb923c", text: "#ffedd5" },
  { id: "mint", background: "#365314", border: "#a3e635", text: "#ecfccb" },
];

export function normalizeGroupName(group: string | null | undefined) {
  return group?.trim() || ungroupedGroupName;
}

export function groupTagColor(group: string, colorId?: string | null) {
  return colorId ? groupTagColorById(colorId) : groupTagColorByHash(group);
}

export function groupTagColorById(colorId: string) {
  return (
    groupTagPalette.find((color) => color.id === colorId) ?? groupTagPalette[0]
  );
}

export function defaultGroupColorId(group: string) {
  return groupTagColorByHash(group).id;
}

function groupTagColorByHash(group: string) {
  const normalized = normalizeGroupName(group);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return groupTagPalette[hash % groupTagPalette.length];
}
