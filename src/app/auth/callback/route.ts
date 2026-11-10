import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Relative redirects keep the visitor on the host they used (see the sign-out route).
const redirectTo = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(next);
  }
  return redirectTo(`/login?error=${encodeURIComponent("Sign-in link was invalid or expired.")}`);
}
