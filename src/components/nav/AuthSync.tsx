"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the header honest. Next.js keeps the shared layout (header and tab bar) between page visits, so after
 * signing in or out somewhere other than a full page load it could keep showing the old state. If the browser's
 * session and the server-rendered header disagree, or the session changes (including in another tab), the layout
 * is refreshed from the server.
 */
export function AuthSync({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && Boolean(data.session) !== signedIn) router.refresh();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "SIGNED_OUT") && Boolean(session) !== signedIn) router.refresh();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [signedIn, router]);

  return null;
}
