"use client";

import { useState } from "react";
import { Check, Flag, Loader2, X } from "lucide-react";
import { fileReport } from "@/app/community/actions";

export const REPORT_REASONS = [
  "Spam or advertising",
  "Harassment or hate",
  "Sexual content involving minors",
  "Plagiarism or stolen work",
  "Wrong content rating",
  "Something else",
] as const;

/** Opens a small dialog to report a story, chapter, comment or profile to moderators. */
export function ReportButton({
  targetType,
  targetId,
  variant = "link",
  className = "",
}: {
  targetType: "story" | "chapter" | "comment" | "profile";
  targetId: string;
  variant?: "link" | "menu";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          variant === "menu"
            ? "flex h-10 w-full items-center gap-2 px-3 text-left text-sm hover:bg-black/5"
            : `inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground ${className}`
        }
      >
        <Flag className="h-4 w-4" /> Report
      </button>
      {open && <ReportDialog targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportDialog({
  targetType,
  targetId,
  onClose,
}: {
  targetType: string;
  targetId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setError("Pick a reason.");
    setBusy(true);
    setError(null);
    const r = await fileReport(targetType as "story", targetId, details.trim() ? `${reason}: ${details.trim()}` : reason).catch(
      () => ({ ok: false as const, error: "You seem to be offline. Try again when you're connected." }),
    );
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center text-foreground sm:items-center" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="relative w-full max-w-md rounded-t-3xl border border-border bg-surface p-6 shadow-2xl sm:rounded-3xl">
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2">
          <X className="h-5 w-5" />
        </button>
        {done ? (
          <div className="py-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="h-6 w-6" />
            </span>
            <h2 id="report-title" className="mt-4 text-lg font-semibold">Thanks for telling us</h2>
            <p className="mt-1 text-sm text-muted">A moderator will review this {targetType}. You won&apos;t see a reply unless we need more information.</p>
            <button onClick={onClose} className="mt-6 inline-flex h-11 items-center rounded-lg bg-accent-strong px-6 text-sm font-medium text-white">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 id="report-title" className="text-lg font-semibold">Report this {targetType}</h2>
            <p className="mt-1 text-sm text-muted">Reports are private. The writer won&apos;t know who sent it.</p>
            <fieldset className="mt-4 space-y-1.5">
              <legend className="sr-only">Reason</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r} className={`flex h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-sm transition ${reason === r ? "border-accent bg-accent/10" : "border-border hover:bg-surface-2"}`}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[#8f6bff]" />
                  {r}
                </label>
              ))}
            </fieldset>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything else moderators should know? (optional)"
              rows={3}
              maxLength={800}
              className="mt-3 w-full rounded-xl border border-border-strong bg-background px-3.5 py-2.5 text-[15px] outline-none focus:border-accent"
            />
            {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-11 rounded-lg px-4 text-sm text-muted hover:bg-surface-2">Cancel</button>
              <button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent-strong px-5 text-sm font-medium text-white disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Sending…" : "Send report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
