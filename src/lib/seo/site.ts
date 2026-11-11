import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/env";

/** The public address of the site, for absolute links in the sitemap and share cards. */
export function siteUrl() {
  // On Vercel, fall back to the production domain: per-deployment URLs are password-protected by default, so
  // WhatsApp and others could not fetch share images from them.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  let raw = (process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")).trim();
  if (!/^https?:\/\//.test(raw)) raw = `https://${raw}`; // tolerate "obsidianquill.vercel.app" without a scheme
  return raw.replace(/\/+$/, "");
}

/** A cookie-less client that sees only what any signed-out visitor sees. */
export function publicClient() {
  if (!isSupabaseConfigured()) return null;
  const { url, anonKey } = supabaseEnv();
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Fonts for generated share images (the image renderer needs woff, not woff2). */
// The files are listed in next.config.ts (outputFileTracingIncludes) so they are deployed with the image routes.
// If they are missing anyway, the image is drawn in the default font rather than failing.
export async function ogFonts() {
  try {
    const [display, sans] = await Promise.all([
      readFile(path.join(process.cwd(), "node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff")),
      readFile(path.join(process.cwd(), "node_modules/@fontsource/inter/files/inter-latin-500-normal.woff")),
    ]);
    return [
      { name: "Cormorant", data: display, weight: 600 as const, style: "normal" as const },
      { name: "Inter", data: sans, weight: 500 as const, style: "normal" as const },
    ];
  } catch (e) {
    console.error("share image fonts missing", e);
    return [];
  }
}

/** ImageResponse options with our fonts, or with the built-in default font if ours can't be read. */
export async function withFonts<T extends object>(opts: T) {
  const fonts = await ogFonts();
  return fonts.length ? { ...opts, fonts } : opts;
}

/**
 * A story's uploaded cover as a data URL the share-image renderer can draw (PNG or JPEG; WebP is converted),
 * or null to use the generated cover. Never throws: a share card must render even if the cover can't be read.
 */
export async function coverForShareCard(coverUrl: string | null): Promise<string | null> {
  if (!coverUrl) return null;
  try {
    const url = new URL(coverUrl, siteUrl() + "/");
    if (coverUrl.startsWith("/") && process.env.SUPABASE_INTERNAL_URL && process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("/")) {
      // Local setups proxy Supabase under a path; fetch it directly instead of through ourselves.
      const prefix = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (coverUrl.startsWith(prefix)) return coverForShareCard(process.env.SUPABASE_INTERNAL_URL.replace(/\/$/, "") + coverUrl.slice(prefix.length));
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    let bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 4_000_000) return null;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    let type = isPng ? "image/png" : isJpeg ? "image/jpeg" : null;
    if (!type || bytes.length > 600_000) {
      // WebP (or a large file): convert to a modest JPEG when the image library is available.
      try {
        const sharp = (await import("sharp")).default;
        bytes = await sharp(bytes).resize({ width: 680, height: 1020, fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
        type = "image/jpeg";
      } catch {
        if (!type) return null;
      }
    }
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}
