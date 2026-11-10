/**
 * Supabase connection settings.
 *
 * NEXT_PUBLIC_SUPABASE_URL is normally the project URL. It may instead be a path such as "/sb": the app then
 * proxies Supabase at that path (see next.config.ts), browsers use it on the app's own origin, and the server
 * talks to SUPABASE_INTERNAL_URL directly. That lets a phone or a preview link reach a local Supabase through
 * the app's single port.
 */
export function supabaseEnv() {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publicUrl || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.",
    );
  }
  let url = publicUrl;
  if (publicUrl.startsWith("/")) {
    if (typeof window !== "undefined") url = window.location.origin + publicUrl;
    else {
      const internal = process.env.SUPABASE_INTERNAL_URL;
      if (!internal) throw new Error("SUPABASE_INTERNAL_URL is required when NEXT_PUBLIC_SUPABASE_URL is a path.");
      url = internal;
    }
  }
  return { url, anonKey, publicUrl };
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// The auth cookie name is otherwise derived from the Supabase host, which differs between the browser and the
// server when proxying. A fixed name keeps both sides on the same session.
export const cookieOptions = { name: "sb-blackquill-auth-token" };

/** Public URL of a file in a public storage bucket, as browsers should load it. */
export function publicStorageUrl(bucket: string, path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
