const STYLES: Record<string, string> = {
  draft: "border-border text-muted",
  scheduled: "border-amber-400/40 text-amber-300",
  published: "border-emerald-400/40 text-emerald-300",
  ongoing: "border-emerald-400/40 text-emerald-300",
  completed: "border-accent/40 text-accent",
  hiatus: "border-amber-400/40 text-amber-300",
};

const LABELS: Record<string, string> = { hiatus: "On hiatus" };

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs capitalize ${STYLES[status] ?? STYLES.draft}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
