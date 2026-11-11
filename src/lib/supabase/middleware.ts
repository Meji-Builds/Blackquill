import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions, isSupabaseConfigured, supabaseEnv } from "./env";
import { ANON_COOKIE, ANON_ID } from "@/lib/discovery/viewer";

const PROTECTED_PREFIXES = ["/studio", "/library", "/settings", "/notifications"];

export async function updateSession(request: NextRequest) {
  // Signed-out readers get a random id so discovery counts each of them once. It is set on the request too,
  // so pages rendered for this very request already see it.
  const existing = request.cookies.get(ANON_COOKIE)?.value;
  const anonId = existing && ANON_ID.test(existing) ? null : crypto.randomUUID();
  if (anonId) request.cookies.set(ANON_COOKIE, anonId);
  const withAnon = (res: NextResponse) => {
    if (anonId) {
      res.cookies.set(ANON_COOKIE, anonId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    return res;
  };

  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return withAnon(response);

  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", path);
    return withAnon(NextResponse.redirect(loginUrl));
  }

  return withAnon(response);
}
