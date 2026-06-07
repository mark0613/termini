export const ungroupedGroupName = "Ungrouped";

const groupTagPalette = [
  { background: "#1f3a34", border: "#2e6f5d", text: "#d8fff3" },
  { background: "#27385c", border: "#3e6fb6", text: "#dbeafe" },
  { background: "#3b274d", border: "#7b4aa2", text: "#f0ddff" },
  { background: "#442b32", border: "#9d5061", text: "#ffe0e6" },
  { background: "#42351f", border: "#9b762a", text: "#ffedc2" },
  { background: "#263b46", border: "#4b8fa4", text: "#d6f7ff" },
  { background: "#3d2f1f", border: "#a46c32", text: "#ffe4c7" },
  { background: "#273d2c", border: "#4d8b5d", text: "#dfffe8" },
];

export function normalizeGroupName(group: string | null | undefined) {
  return group?.trim() || ungroupedGroupName;
}

export function groupTagColor(group: string) {
  const normalized = normalizeGroupName(group);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return groupTagPalette[hash % groupTagPalette.length];
}
