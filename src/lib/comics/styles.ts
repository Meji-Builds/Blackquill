export interface ComicStyle {
  id: string;
  label: string;
  prompt: string; // appended to every scene prompt
  palette: [string, string, string]; // used by the built-in demo generator
  mono?: boolean;
}

export const COMIC_STYLES: ComicStyle[] = [
  { id: "webtoon", label: "Webtoon colour", prompt: "full-colour webtoon panel, clean line art, soft cel shading, cinematic vertical composition", palette: ["#1b1440", "#7c5cff", "#ffb4d0"] },
  { id: "manga", label: "Manga ink", prompt: "black-and-white manga panel, expressive ink lines, screentone shading, dramatic framing", palette: ["#0d0d0d", "#5a5a5a", "#f2f2f2"], mono: true },
  { id: "watercolour", label: "Watercolour storybook", prompt: "watercolour storybook illustration, soft washes, textured paper, gentle light", palette: ["#24413d", "#7fb7a4", "#f6e7c8"] },
  { id: "noir", label: "Noir comic", prompt: "high-contrast noir comic panel, heavy shadows, limited palette with a single accent colour", palette: ["#060606", "#2a2a2a", "#d8323c"] },
  { id: "painterly", label: "Painterly fantasy", prompt: "painterly fantasy illustration, rich dramatic light, detailed environment, cinematic composition", palette: ["#2a1608", "#d08a2e", "#ffe6b8"] },
];

export const styleById = (id: string) => COMIC_STYLES.find((s) => s.id === id) ?? COMIC_STYLES[0];

/** The full prompt sent to an image model for one panel. */
export function panelPrompt(scene: string, styleId: string) {
  return `${scene.trim()}\n\nStyle: ${styleById(styleId).prompt}. Single comic panel, portrait orientation. No text, captions, speech bubbles or watermarks.`;
}
