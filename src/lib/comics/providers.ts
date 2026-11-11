import "server-only";
import { createHash } from "node:crypto";
import { styleById } from "./styles";

export interface GeneratedImage {
  bytes: Buffer;
  contentType: string;
  extension: string;
}

export type ProviderName = "openai" | "demo";

/** OpenAI when an API key is configured, otherwise the built-in demo generator (no external calls, no cost). */
export function comicProvider(): ProviderName {
  return process.env.OPENAI_API_KEY ? "openai" : "demo";
}

export async function generatePanelImage(opts: {
  prompt: string;
  caption: string;
  styleId: string;
  seed: string;
  reference?: { bytes: Buffer; contentType: string } | null;
}): Promise<GeneratedImage> {
  return comicProvider() === "openai" ? openai(opts) : demo(opts);
}

// ---------------------------------------------------------------------------
// OpenAI Images API (gpt-image-1 by default). With a reference image, the edits endpoint uses it as a style guide.
// ---------------------------------------------------------------------------
async function openai({
  prompt,
  reference,
}: {
  prompt: string;
  reference?: { bytes: Buffer; contentType: string } | null;
}): Promise<GeneratedImage> {
  const key = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const size = "1024x1536";
  let res: Response;
  if (reference) {
    const form = new FormData();
    form.set("model", model);
    form.set("size", size);
    form.set("prompt", `${prompt}\n\nMatch the art style, palette and character designs of the reference image.`);
    form.append("image[]", new Blob([new Uint8Array(reference.bytes)], { type: reference.contentType }), "reference");
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size, n: 1 }),
    });
  }
  const json = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[]; error?: { message?: string } } | null;
  if (!res.ok || !json?.data?.[0]?.b64_json) {
    throw new Error(json?.error?.message ? `Image service: ${json.error.message}` : `Image service error (${res.status}).`);
  }
  return { bytes: Buffer.from(json.data[0].b64_json, "base64"), contentType: "image/png", extension: "png" };
}

// ---------------------------------------------------------------------------
// Demo generator: a stylised SVG panel (sky, landscape, a figure, light) in the chosen style's palette. Deterministic per panel and generation, so "regenerate" gives a different composition.
// ---------------------------------------------------------------------------
function rand(seed: string) {
  let a = parseInt(createHash("md5").update(seed).digest("hex").slice(0, 8), 16);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}



// Captions are shown by the reader under each panel, so the picture itself carries no text (as with real models).
async function demo({ styleId, seed }: { styleId: string; seed: string }): Promise<GeneratedImage> {
  const style = styleById(styleId);
  const [deep, mid, light] = style.palette;
  const r = rand(seed);
  const W = 800;
  const H = 1200;
  const horizon = 640 + r() * 160;
  const sunX = 140 + r() * 520;
  const sunY = 200 + r() * 220;
  const ridge = (base: number, amp: number, step: number) => {
    let d = `M0 ${H} L0 ${base}`;
    for (let x = 0; x <= W; x += step) d += ` L${x} ${(base - r() * amp).toFixed(0)}`;
    return d + ` L${W} ${H} Z`;
  };
  const figX = 180 + r() * 440;
  const figH = 150 + r() * 90;
  const figY = horizon + 120;
  const halftone = style.mono
    ? `<pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.2" fill="${light}" opacity="0.18"/></pattern><rect width="${W}" height="${H}" fill="url(#dots)"/>`
    : "";
  const rays = Array.from({ length: 7 }, (_, i) => {
    const a = (-Math.PI / 2) + (i - 3) * 0.32 + (r() - 0.5) * 0.1;
    return `<path d="M${sunX} ${sunY} L${(sunX + Math.cos(a) * 1400).toFixed(0)} ${(sunY + Math.sin(a) * 1400).toFixed(0)}" stroke="${light}" stroke-opacity="0.07" stroke-width="${30 + r() * 50}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}"/><stop offset="0.75" stop-color="${mid}"/><stop offset="1" stop-color="${light}"/></linearGradient>
<radialGradient id="sun"><stop offset="0" stop-color="${light}" stop-opacity="0.95"/><stop offset="0.5" stop-color="${light}" stop-opacity="0.35"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
${rays}
<circle cx="${sunX.toFixed(0)}" cy="${sunY.toFixed(0)}" r="230" fill="url(#sun)"/>
<circle cx="${sunX.toFixed(0)}" cy="${sunY.toFixed(0)}" r="${(50 + r() * 30).toFixed(0)}" fill="${light}" opacity="0.9"/>
<path d="${ridge(horizon - 60, 140, 80)}" fill="${mid}" opacity="0.55"/>
<path d="${ridge(horizon, 90, 50)}" fill="${deep}" opacity="0.85"/>
<path d="${ridge(horizon + 120, 40, 40)}" fill="${deep}"/>
<g fill="${deep}" stroke="${light}" stroke-opacity="0.25" stroke-width="2">
<circle cx="${figX.toFixed(0)}" cy="${(figY - figH).toFixed(0)}" r="${(figH * 0.12).toFixed(0)}"/>
<path d="M${(figX - figH * 0.16).toFixed(0)} ${(figY - figH * 0.86).toFixed(0)} Q${figX.toFixed(0)} ${(figY - figH * 0.95).toFixed(0)} ${(figX + figH * 0.16).toFixed(0)} ${(figY - figH * 0.86).toFixed(0)} L${(figX + figH * 0.28).toFixed(0)} ${figY.toFixed(0)} L${(figX - figH * 0.28).toFixed(0)} ${figY.toFixed(0)} Z"/>
</g>
${halftone}
<rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="${light}" stroke-opacity="0.35" stroke-width="4"/>
<text x="34" y="54" font-family="Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="3" fill="${light}" opacity="0.6">DEMO PANEL</text>
</svg>`;
  return { bytes: Buffer.from(svg, "utf8"), contentType: "image/svg+xml", extension: "svg" };
}
