import type { CategoryColor } from "./constants";

/** Tailwind text + bg-tint classes for a category color key (see globals.css tokens). */
export function categoryClasses(color: CategoryColor): { text: string; pill: string } {
  const map: Record<CategoryColor, { text: string; pill: string }> = {
    blue: { text: "text-cat-blue", pill: "bg-cat-blue/12 text-cat-blue" },
    teal: { text: "text-cat-teal", pill: "bg-cat-teal/12 text-cat-teal" },
    violet: { text: "text-cat-violet", pill: "bg-cat-violet/12 text-cat-violet" },
    amber: { text: "text-cat-amber", pill: "bg-cat-amber/12 text-cat-amber" },
    rose: { text: "text-cat-rose", pill: "bg-cat-rose/12 text-cat-rose" },
    green: { text: "text-cat-green", pill: "bg-cat-green/12 text-cat-green" },
  };
  return map[color];
}

/** cn — tiny className joiner. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// A spread of distinct, saturated hues for monogram avatars. Chosen to read well
// on both light and dark surfaces.
const AVATAR_HUES = [
  "#1D5BD8", // blue
  "#0E9384", // teal
  "#6E56CF", // violet
  "#D97706", // amber
  "#D6467E", // rose
  "#0E9F6E", // green
  "#DC2626", // red
  "#2563EB", // indigo-blue
  "#7C3AED", // purple
  "#0891B2", // cyan
  "#EA580C", // orange
  "#DB2777", // pink
];

/** Deterministic avatar color from a name (stable across renders). */
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

/** Hex color at a given alpha as an rgba() string, for tinted fills. */
export function withAlpha(hex: string, alpha: number): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
