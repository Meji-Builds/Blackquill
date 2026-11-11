"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/browse", label: "Browse", auth: false },
  { href: "/rankings", label: "Rankings", auth: false },
  { href: "/library", label: "Library", auth: true },
  { href: "/studio", label: "Write", auth: false },
];

/** Text links in the top bar from tablet width up; phones use the tab bar instead. */
export function NavLinks({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  return (
    <div className="hidden items-center gap-1 md:flex">
      {LINKS.filter((l) => signedIn || !l.auth).map((l) => {
        const active = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              active ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
