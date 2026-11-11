import Link from "next/link";
import { LogoMark } from "@/components/Logo";

const LINES = [
  { quote: "The stairs went down farther than the city went up.", from: "Lanterns Below" },
];

/**
 * Two-panel frame for the account pages: a brand panel with an opening line on wide screens, and the form in a
 * calm column. On phones the brand panel collapses into a header.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const line = LINES[0];
  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-border lg:block">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(143,107,255,0.35),transparent_50%),radial-gradient(circle_at_80%_90%,rgba(217,178,111,0.18),transparent_45%),linear-gradient(160deg,#16121f,#08070a)]"
        />
        <div aria-hidden="true" className="absolute inset-10 rounded-[28px] border border-white/10" />
        <div className="relative flex h-full flex-col justify-between p-16">
          <Link href="/" className="inline-flex items-center gap-3">
            <LogoMark className="h-9 w-9" />
            <span className="font-display text-3xl font-semibold">Obsidian Quill</span>
          </Link>
          <figure className="max-w-md">
            <blockquote className="font-display text-[40px] leading-[1.1] font-semibold">“{line.quote}”</blockquote>
            <figcaption className="mt-4 text-sm tracking-[0.2em] text-gold uppercase">{line.from}</figcaption>
          </figure>
          <p className="max-w-sm text-sm text-muted">
            Free to read, free to publish. Stories rise by how deeply people read them, not by clicks.
          </p>
        </div>
      </aside>
      <div className="flex items-start justify-center px-5 pt-10 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
