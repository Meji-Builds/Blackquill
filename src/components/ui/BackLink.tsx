import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** "Back to …" link with a real icon and a comfortable tap area. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex h-9 items-center gap-1 rounded-lg pr-3 pl-1 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
    >
      <ChevronLeft className="h-5 w-5" />
      {children}
    </Link>
  );
}
