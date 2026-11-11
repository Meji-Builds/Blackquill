import { AlertTriangle } from "lucide-react";

/** Only the author (and moderators) can still open a story that was taken down. */
export function RemovedNotice({ reason }: { reason: string | null }) {
  return (
    <div role="alert" className="mb-6 flex gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
      <div>
        <p className="font-semibold text-foreground">This story was taken down by moderators</p>
        <p className="mt-1 text-muted">
          Readers can no longer find or open it. {reason ? <>Reason: {reason}.</> : null} If you think this is a mistake, reply to
          the email from the moderation team or contact support.
        </p>
      </div>
    </div>
  );
}
