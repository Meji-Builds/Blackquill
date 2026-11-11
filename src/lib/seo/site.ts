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
