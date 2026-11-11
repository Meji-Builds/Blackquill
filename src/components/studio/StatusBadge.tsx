const STYLES: Record<string, string> = {
  draft: "bg-surface-3 text-muted ring-border-strong",
  scheduled: "bg-warning/10 text-warning ring-warning/30",
  published: "bg-success/10 text-success ring-success/30",
  ongoing: "bg-success/10 text-success ring-success/30",
  completed: "bg-accent/10 text-accent ring-accent/30",
  hiatus: "bg-warning/10 text-warning ring-warning/30",
};

const LABELS: Record<string, string> = { hiatus: "On hiatus", completed: "Complete" };

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ${STYLES[status] ?? STYLES.draft}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status] ?? status}
    </span>
  );
}
