import type { Metadata } from "next";

export const metadata: Metadata = { title: "Community guidelines" };

const RULES: { title: string; body: string }[] = [
  { title: "Write and share your own work", body: "Publish only stories you wrote or have the right to share. Fan fiction is welcome when it is clearly labelled and transformative." },
  { title: "Rate your story honestly", body: "Use the Mature rating for graphic violence, explicit sexual content or intense themes. Mature stories are hidden from readers who have not chosen to see them." },
  { title: "No sexual content involving minors", body: "Any sexual content involving characters under 18 is removed and the account is closed." },
  { title: "Respect people", body: "No harassment, hate speech, threats, or sharing someone's private information, in stories or comments." },
  { title: "No spam or manipulation", body: "Don't use fake accounts, scripts or swaps to inflate reads or rankings. Discovery rewards real reading, and manipulation is removed." },
  { title: "Report what breaks these rules", body: "Use the report button on any story, chapter or comment. Moderators review every report." },
];

export default function GuidelinesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:pt-10">
      <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Obsidian Quill</p>
      <h1 className="mt-1 font-display text-[40px] leading-tight font-semibold">Community guidelines</h1>
      <p className="mt-3 text-muted">A short set of rules so writers and readers can trust each other.</p>
      <ol className="mt-8 space-y-4">
        {RULES.map((r, i) => (
          <li key={r.title} className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="flex items-baseline gap-3 font-serif text-lg font-semibold">
              <span className="text-sm text-muted tabular-nums">{i + 1}</span>
              {r.title}
            </h2>
            <p className="mt-2 pl-7 text-muted">{r.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
