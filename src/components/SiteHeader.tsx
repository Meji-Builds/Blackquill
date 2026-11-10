import Link from "next/link";
import { Logo } from "./Logo";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function SiteHeader() {
  let username: string | null = null;
  let signedIn = false;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      signedIn = true;
      const { data } = await supabase.from("profiles").select("username").eq("id", user.id).single();
      username = data?.username ?? null;
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" aria-label="Blackquill home">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center gap-5 text-sm text-muted">
          <Link href="/browse" className="hover:text-foreground">Browse</Link>
          <Link href="/rankings" className="hover:text-foreground">Rankings</Link>
          {signedIn && <Link href="/library" className="hover:text-foreground">Library</Link>}
          {signedIn && <Link href="/studio" className="hover:text-foreground">Write</Link>}
        </div>
        {signedIn ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">@{username}</span>
            <form action="/auth/signout" method="post">
              <button className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-2">Sign out</button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-accent-strong px-3 py-1.5 text-sm font-medium text-white hover:bg-accent"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
