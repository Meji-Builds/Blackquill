"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Feather, Home, UserRound } from "lucide-react";

// Screens where every pixel belongs to the text: the chapter reader, the chapter editor and sign-in.
const HIDDEN = [/^\/story\/[^/]+\/chapter\//, /^\/studio\/[^/]+\/chapters\//, /^\/login/, /^\/auth\//, /^\/translate\/[^/]+\/[^/]+\/\d+/];

/** Phone navigation along the bottom edge, like a reading app. Hidden from tablet width up. */
export function TabBar({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  if (HIDDEN.some((re) => re.test(path))) return null;

  const tabs = [
    { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
    { href: "/browse", label: "Browse", icon: Compass, match: (p: string) => /^\/(browse|genre|tag|rankings)/.test(p) },
    { href: "/library", label: "Library", icon: BookOpen, match: (p: string) => /^\/(library|offline)/.test(p) },
    { href: "/studio", label: "Write", icon: Feather, match: (p: string) => p.startsWith("/studio") },
    {
      href: signedIn ? "/settings" : "/login",
      label: signedIn ? "Me" : "Sign in",
      icon: UserRound,
      match: (p: string) => /^\/(settings|author|translate|notifications)/.test(p),
    },
  ];

  return (
    <>
      {/* Keeps the end of every page clear of the bar. */}
      <div aria-hidden="true" className="h-[calc(4rem+env(safe-area-inset-bottom,0px))] md:hidden" />
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/90 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
          {tabs.map(({ href, label, icon: Icon, match }) => {
            const active = match(path);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                    active ? "text-accent" : "text-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
