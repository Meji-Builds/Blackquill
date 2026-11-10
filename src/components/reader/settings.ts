// Reader appearance settings. Shared by the server (reads the cookie so the page renders in the
// reader's chosen look with no flash) and the client (edits and stores them).

export type FontId =
  | "system-serif"
  | "literata"
  | "merriweather"
  | "lora"
  | "garamond"
  | "system-sans"
  | "inter"
  | "atkinson"
  | "opendyslexic";

export type BackgroundId =
  | "midnight"
  | "charcoal"
  | "slate"
  | "navy"
  | "white"
  | "cream"
  | "sepia"
  | "parchment"
  | "sage"
  | "custom";

export type Texture = "none" | "paper" | "linen";
export type Width = "narrow" | "medium" | "wide";

export interface ReaderSettings {
  font: FontId;
  background: BackgroundId;
  customBg: string; // #rrggbb, used when background is "custom"
  texture: Texture;
  brightness: number; // 40..100, percent
  size: number; // px
  lineHeight: number;
  width: Width;
}

export const FONTS: Record<FontId, { label: string; stack: string; note?: string }> = {
  "system-serif": { label: "Classic", stack: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' },
  literata: { label: "Literata", stack: '"Literata", Georgia, serif', note: "Made for long reading" },
  merriweather: { label: "Merriweather", stack: '"Merriweather", Georgia, serif' },
  lora: { label: "Lora", stack: '"Lora", Georgia, serif' },
  garamond: { label: "EB Garamond", stack: '"EB Garamond", Garamond, Georgia, serif' },
  "system-sans": { label: "System sans", stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  inter: { label: "Inter", stack: '"Inter", ui-sans-serif, system-ui, sans-serif' },
  atkinson: {
    label: "Atkinson Hyperlegible",
    stack: '"Atkinson Hyperlegible", ui-sans-serif, sans-serif',
    note: "Easier for low vision",
  },
  opendyslexic: { label: "OpenDyslexic", stack: '"OpenDyslexic", ui-sans-serif, sans-serif', note: "For dyslexic readers" },
};

export const BACKGROUNDS: Record<Exclude<BackgroundId, "custom">, { label: string; color: string }> = {
  midnight: { label: "Midnight", color: "#0b0a0d" },
  charcoal: { label: "Charcoal", color: "#1f1e23" },
  slate: { label: "Slate", color: "#232a33" },
  navy: { label: "Night blue", color: "#0f1726" },
  white: { label: "White", color: "#ffffff" },
  cream: { label: "Cream", color: "#faf8f5" },
  sepia: { label: "Sepia", color: "#f3e9d2" },
  parchment: { label: "Parchment", color: "#e9dcbc" },
  sage: { label: "Sage", color: "#e2eadc" },
};

export const TEXTURES: Record<Texture, string> = { none: "Plain", paper: "Paper", linen: "Linen" };
export const SIZES = [15, 17, 19, 21, 24, 28];
export const LINE_HEIGHTS = [1.5, 1.8, 2.1];
export const WIDTHS: Record<Width, string> = { narrow: "34rem", medium: "42rem", wide: "52rem" };
export const MIN_BRIGHTNESS = 40;

export const DEFAULT_SETTINGS: ReaderSettings = {
  font: "system-serif",
  background: "midnight",
  customBg: "#2b2530",
  texture: "none",
  brightness: 100,
  size: 19,
  lineHeight: 1.8,
  width: "medium",
};

export const COOKIE = "bq_reader";
const STORAGE_KEY = "bq:reader-settings";
const HEX = /^#[0-9a-f]{6}$/i;

/** Validates anything (cookie, localStorage, old formats) into complete settings. */
export function parseSettings(raw: string | null | undefined): ReaderSettings {
  if (!raw) return DEFAULT_SETTINGS;
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(raw);
    if (!v || typeof v !== "object") return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
  const s = { ...DEFAULT_SETTINGS };
  if (typeof v.font === "string" && v.font in FONTS) s.font = v.font as FontId;
  else if (v.font === "sans") s.font = "system-sans"; // settings saved before custom fonts
  if (typeof v.background === "string" && (v.background in BACKGROUNDS || v.background === "custom"))
    s.background = v.background as BackgroundId;
  else if (v.theme === "light") s.background = "cream";
  else if (v.theme === "sepia") s.background = "sepia";
  if (typeof v.customBg === "string" && HEX.test(v.customBg)) s.customBg = v.customBg.toLowerCase();
  if (typeof v.texture === "string" && v.texture in TEXTURES) s.texture = v.texture as Texture;
  if (typeof v.brightness === "number" && Number.isFinite(v.brightness))
    s.brightness = Math.round(Math.min(100, Math.max(MIN_BRIGHTNESS, v.brightness)));
  if (typeof v.size === "number" && SIZES.includes(v.size)) s.size = v.size;
  if (typeof v.lineHeight === "number" && LINE_HEIGHTS.includes(v.lineHeight)) s.lineHeight = v.lineHeight;
  if (typeof v.width === "string" && v.width in WIDTHS) s.width = v.width as Width;
  return s;
}

export function storeSettings(s: ReaderSettings) {
  const json = JSON.stringify(s);
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* private mode: the cookie still works */
  }
  document.cookie = `${COOKIE}=${encodeURIComponent(json)}; path=/; max-age=31536000; samesite=lax`;
}

export function readStoredSettings(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Colours: text colours follow the background so any custom colour stays readable.
// ---------------------------------------------------------------------------

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mix(a: string, b: string, t: number) {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return (
    "#" +
    [1, 3, 5]
      .map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, "0"))
      .join("")
  );
}

export interface Palette {
  bg: string;
  fg: string;
  muted: string;
  border: string;
  dark: boolean;
}

export function palette(s: ReaderSettings): Palette {
  const bg = s.background === "custom" ? s.customBg : BACKGROUNDS[s.background].color;
  // Warm light backgrounds get brown ink; others get near-black. Light or dark ink is picked by
  // whichever reads better, so any custom colour stays legible.
  const warm = parseInt(bg.slice(1, 3), 16) - parseInt(bg.slice(5, 7), 16) > 20;
  const darkInk = warm && contrast("#47382a", bg) >= 7 ? "#47382a" : "#000000";
  const lightInk = contrast("#ece8f1", bg) >= 7 ? "#ece8f1" : "#ffffff";
  const dark = contrast(lightInk, bg) > contrast(darkInk, bg);
  const fg = dark ? lightInk : darkInk;
  return { bg, fg, muted: mix(fg, bg, 0.42), border: mix(fg, bg, 0.82), dark };
}

/** Contrast ratio between two #rrggbb colours (WCAG). */
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** A subtle texture drawn as an SVG data URI, light on dark backgrounds and dark on light ones. */
export function textureImage(t: Texture, dark: boolean): string | undefined {
  if (t === "none") return undefined;
  const [r, g, b] = dark ? [1, 1, 1] : [0.24, 0.16, 0.08];
  const svg =
    t === "paper"
      ? // fractal noise mapped to one ink colour; the noise only drives the alpha channel
        `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${dark ? 0.16 : 0.22} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`
      : `<svg xmlns='http://www.w3.org/2000/svg' width='6' height='6'><path d='M0 .5h6M.5 0v6' stroke='rgb(${r * 255},${g * 255},${b * 255})' stroke-opacity='${dark ? 0.05 : 0.07}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
