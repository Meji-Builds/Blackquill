import Link from "next/link";
import { cache } from "react";
import { Search } from "lucide-react";
import { Logo } from "./Logo";
import { NavLinks } from "./nav/NavLinks";
import { AccountMenu } from "./nav/AccountMenu";
import { TabBar } from "./nav/TabBar";
import { btn } from "./ui/styles";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface Viewer {
  username: string;
  penName: string;
  isAdmin: boolean;
}

/** The signed-in reader, looked up once per request however many components ask. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("username, display_name, is_admin")
    .eq("id", user.id)
    .single();
  if (!data) return null;
  return { username: data.username, penName: data.display_name || data.username, isAdmin: data.is_admin };
});

export async function SiteHeader() {
  const viewer = await getViewer();

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4" aria-label="Main">
          <Link href="/" aria-label="Obsidian Quill home" className="mr-2 shrink-0 rounded-lg">
            <Logo />
          </Link>
          <NavLinks signedIn={Boolean(viewer)} />
          <div className="ml-auto flex items-center gap-1">
            <Link href="/browse" aria-label="Search stories" className={btn.icon}>
              <Search className="h-5 w-5" />
            </Link>
            {viewer ? (
              <AccountMenu viewer={viewer} />
            ) : (
              <>
                <span className="hidden sm:block">
                  <Link href="/login" className={btn.ghost}>
                    Sign in
                  </Link>
                </span>
                <Link href="/login?mode=signup" className={`${btn.primary} h-9 px-4`}>
                  <span className="sm:hidden">Join</span>
                  <span className="hidden sm:inline">Create account</span>
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}

/** Phone tab bar; placed after the page content so its spacer sits at the end of the page. */
export async function SiteTabBar() {
  const viewer = await getViewer();
  return <TabBar signedIn={Boolean(viewer)} />;
}
