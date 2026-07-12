// The one place the product name lives. Rename the app by editing this line.
export const APP_NAME = "cointraq";

export const APP_TAGLINE = "Your ledger.";

// Money validation bounds (whole rupees). SPEC §2.
export const AMOUNT_MIN = 1;
export const AMOUNT_MAX = 10_00_00_000; // 10 crore

// Note length cap. SPEC §4.
export const NOTE_MAX = 200;

// Icon upload cap (base64 data URL length). SPEC §9.
export const ICON_MAX_BYTES = 80 * 1024; // 80 KB

// IST — all "today" math happens in this zone. SPEC §2.
export const APP_TZ = "Asia/Kolkata";

// Session cookie. SPEC §10.
export const SESSION_COOKIE = "cointraq_session";
export const SESSION_MAX_AGE_DAYS = 30;

// The 6 category palette keys. SPEC §3.
export const CATEGORY_COLORS = [
  "blue",
  "teal",
  "violet",
  "amber",
  "rose",
  "green",
] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

// Hex + 12% tint for each palette key, ported from the design style tile.
export const CATEGORY_COLOR_HEX: Record<CategoryColor, { solid: string; tint: string }> = {
  blue: { solid: "#1D5BD8", tint: "rgba(29,91,216,.12)" },
  teal: { solid: "#0E9384", tint: "rgba(14,147,132,.12)" },
  violet: { solid: "#6E56CF", tint: "rgba(110,86,207,.12)" },
  amber: { solid: "#B97509", tint: "rgba(185,117,9,.12)" },
  rose: { solid: "#D6467E", tint: "rgba(214,70,126,.12)" },
  green: { solid: "#0E9F6E", tint: "rgba(14,159,110,.12)" },
};

// Categorical chart order (design style tile). CC Bill slice uses `income` green.
export const CHART_CATEGORICAL = [
  "#1D5BD8",
  "#0E9384",
  "#6E56CF",
  "#B97509",
  "#D6467E",
  "#0E9F6E",
] as const;
