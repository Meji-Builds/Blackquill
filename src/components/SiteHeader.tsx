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
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:gap-6">
        <Link href="/" aria-label="Blackquill home" className="shrink-0">
          <Logo compact={signedIn} />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-4 text-sm whitespace-nowrap text-muted sm:gap-5">
          <Link href="/browse" className="hover:text-foreground">Browse</Link>
          {signedIn && <Link href="/library" className="hover:text-foreground">Library</Link>}
          {signedIn && <Link href="/studio" className="hover:text-foreground">Write</Link>}
        </div>
        {signedIn ? (
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <span className="hidden text-muted md:inline">@{username}</span>
            <form action="/auth/signout" method="post">
              <button className="whitespace-nowrap text-muted hover:text-foreground sm:rounded-md sm:border sm:border-border sm:px-3 sm:py-1.5 sm:text-foreground sm:hover:bg-surface-2">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="shrink-0 rounded-md bg-accent-strong px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white hover:bg-accent"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
