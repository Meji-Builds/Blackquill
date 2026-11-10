export type ReaderTheme = "dark" | "light" | "sepia";
export type ReaderFont = "serif" | "sans";

export interface ReaderSettings {
  theme: ReaderTheme;
  font: ReaderFont;
  size: number; // px
  lineHeight: number;
  width: "narrow" | "medium" | "wide";
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: "dark",
  font: "serif",
  size: 19,
  lineHeight: 1.8,
  width: "medium",
};

export const SIZES = [15, 17, 19, 21, 24, 28];
export const LINE_HEIGHTS = [1.5, 1.8, 2.1];

export const THEMES: Record<ReaderTheme, { label: string; bg: string; fg: string; muted: string; border: string }> = {
  dark: { label: "Dark", bg: "#0b0a0d", fg: "#e2dde8", muted: "#9a93a5", border: "#2a2630" },
  light: { label: "Light", bg: "#faf8f5", fg: "#1f1c22", muted: "#6b6570", border: "#e4dfd8" },
  sepia: { label: "Sepia", bg: "#f3e9d2", fg: "#4a3b2a", muted: "#85725a", border: "#dccdaa" },
};

export const WIDTHS = { narrow: "34rem", medium: "42rem", wide: "52rem" } as const;

const KEY = "bq:reader-settings";

export function loadSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as ReaderSettings;
    if (!(s.theme in THEMES)) s.theme = DEFAULT_SETTINGS.theme;
    if (!SIZES.includes(s.size)) s.size = DEFAULT_SETTINGS.size;
    if (!LINE_HEIGHTS.includes(s.lineHeight)) s.lineHeight = DEFAULT_SETTINGS.lineHeight;
    if (!(s.width in WIDTHS)) s.width = DEFAULT_SETTINGS.width;
    if (s.font !== "serif" && s.font !== "sans") s.font = DEFAULT_SETTINGS.font;
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function storeSettings(s: ReaderSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* settings just won't persist */
  }
}
