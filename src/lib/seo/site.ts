import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isSupabaseConfigured, supabaseEnv } from "@/lib/supabase/env";

/** The public address of the site, for absolute links in the sitemap and share cards. */
export function siteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return raw.replace(/\/$/, "");
}

/** A cookie-less client that sees only what any signed-out visitor sees. */
export function publicClient() {
  if (!isSupabaseConfigured()) return null;
  const { url, anonKey } = supabaseEnv();
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Fonts for generated share images (the image renderer needs woff, not woff2). */
export async function ogFonts() {
  const dir = path.join(process.cwd(), "node_modules/@fontsource");
  const [display, sans] = await Promise.all([
    readFile(path.join(dir, "cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff")),
    readFile(path.join(dir, "inter/files/inter-latin-500-normal.woff")),
  ]);
  return [
    { name: "Cormorant", data: display, weight: 600 as const, style: "normal" as const },
    { name: "Inter", data: sans, weight: 500 as const, style: "normal" as const },
  ];
}
