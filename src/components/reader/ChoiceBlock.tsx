"use client";

import { useEffect, useState } from "react";
import { pickChoice } from "@/app/discovery/actions";
import { toParagraphs } from "@/lib/reader/text";
import { percentages, type ChoicePoint, type ChoiceState } from "@/lib/choices/types";
import type { Palette } from "./settings";

const localKey = (pointId: string) => `oq:choice:${pointId}`;

function readLocal(pointId: string): { picked?: string; skipped?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(localKey(pointId)) ?? "{}");
  } catch {
    return {};
  }
}

function writeLocal(pointId: string, v: { picked?: string; skipped?: boolean }) {
  try {
    localStorage.setItem(localKey(pointId), JSON.stringify(v));
  } catch {
    /* the choice still works for this visit */
  }
}

/**
 * The choice inside a chapter. Before picking: the question and the options. After: the chosen branch scene, how
 * other readers chose, and the other paths to read. `onResolved` tells the reader to show the rest of the chapter.
 */
export function ChoiceBlock({
  choice,
  initial,
  palette: t,
  font,
  onResolved,
}: {
  choice: ChoicePoint;
  initial: ChoiceState | null;
  palette: Palette;
  font: string;
  onResolved: () => void;
}) {
  const [state, setState] = useState<ChoiceState | null>(initial);
  const [picked, setPicked] = useState<string | null>(initial?.picked ?? null);
  const [showing, setShowing] = useState<string | null>(initial?.picked ?? null);
  const [skipped, setSkipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  // A pick or skip made earlier on this device (for example offline, or before signing in).
  useEffect(() => {
    if (picked) return;
    const local = readLocal(choice.id);
    if (local.picked && choice.options.some((o) => o.id === local.picked)) {
      setPicked(local.picked);
      setShowing(local.picked);
      onResolved();
    } else if (local.skipped) {
      setSkipped(true);
      onResolved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [choice.id]);

  async function choose(optionId: string) {
    setBusy(true);
    setPicked(optionId);
    setShowing(optionId);
    writeLocal(choice.id, { picked: optionId });
    onResolved();
    try {
      const r = await pickChoice(optionId);
      if (r) {
        setState(r);
        // The first pick is the one that counts; show it if this reader had picked before elsewhere.
        if (r.picked && r.picked !== optionId && !r.author) {
          setPicked(r.picked);
          setShowing(r.picked);
          writeLocal(choice.id, { picked: r.picked });
        }
      } else setOffline(true);
    } catch {
      setOffline(true);
    }
    setBusy(false);
  }

  function skip() {
    setSkipped(true);
    writeLocal(choice.id, { skipped: true });
    onResolved();
  }

  const card = { borderColor: t.border, background: `color-mix(in srgb, ${t.fg} 4%, transparent)` };
  const shown = choice.options.find((o) => o.id === showing);
  const counts = choice.options.map((o) => state?.counts?.[o.id] ?? 0);
  const pcts = percentages(counts);
  const hasTotals = state?.counts && typeof state.total === "number";

  return (
    <section aria-label="Choose what happens" className="my-10 font-sans" style={{ fontSize: 16, lineHeight: 1.5 }}>
      <div className="rounded-xl border p-5" style={card}>
        <p className="text-xs uppercase tracking-wider" style={{ color: t.muted }}>
          Your choice
        </p>
        <p className="mt-1 text-xl" style={{ fontFamily: font }}>
          {choice.prompt}
        </p>

        {!picked && !skipped && (
          <div className="mt-4 grid gap-2">
            {choice.options.map((o) => (
              <button
                key={o.id}
                onClick={() => choose(o.id)}
                disabled={busy}
                className="rounded-lg border px-4 py-3 text-left transition hover:border-[var(--accent-strong)] focus-visible:border-[var(--accent-strong)] focus-visible:outline-none"
                style={{ borderColor: t.border }}
              >
                {o.label}
              </button>
            ))}
            <button onClick={skip} className="mt-1 justify-self-start text-sm underline" style={{ color: t.muted }}>
              Skip the choice and keep reading
            </button>
          </div>
        )}

        {skipped && !picked && (
          <p className="mt-3 text-sm" style={{ color: t.muted }}>
            You skipped this choice.{" "}
            <button onClick={() => setSkipped(false)} className="underline">
              Choose now
            </button>
          </p>
        )}

        {picked && (
          <div className="mt-4 space-y-2" aria-live="polite">
            {choice.options.map((o, i) => {
              const mine = o.id === picked;
              return (
                <button
                  key={o.id}
                  onClick={() => setShowing(o.id)}
                  aria-pressed={showing === o.id}
                  className="relative block w-full overflow-hidden rounded-lg border px-4 py-2.5 text-left"
                  style={{ borderColor: showing === o.id ? "var(--accent-strong)" : t.border }}
                >
                  {hasTotals && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${pcts[i]}%`,
                        background: mine
                          ? "color-mix(in srgb, var(--accent-strong) 28%, transparent)"
                          : `color-mix(in srgb, ${t.fg} 9%, transparent)`,
                      }}
                    />
                  )}
                  <span className="relative flex items-baseline justify-between gap-3">
                    <span>
                      {o.label}
                      {mine && (
                        <span className="ml-2 text-xs" style={{ color: t.muted }}>
                          {state?.author ? "previewing" : "your choice"}
                        </span>
                      )}
                    </span>
                    {hasTotals && <span className="tabular-nums">{pcts[i]}%</span>}
                  </span>
                </button>
              );
            })}
            <p className="text-xs" style={{ color: t.muted }}>
              {hasTotals
                ? `${state!.total} ${state!.total === 1 ? "reader has" : "readers have"} chosen${
                    state?.author ? " (your own picks are not counted)" : ""
                  }. Tap an option to read that path.`
                : offline
                  ? "Saved on this device. Totals appear when you are back online."
                  : "Tap an option to read that path."}
            </p>
          </div>
        )}
      </div>

      {shown && (
        <div className="mt-6 border-l-2 pl-5" style={{ borderColor: "var(--accent-strong)" }}>
          <p className="text-xs uppercase tracking-wider" style={{ color: t.muted }}>
            {shown.id === picked ? "Your path" : "Another path"}: {shown.label}
          </p>
          <div className="mt-3 space-y-[1em]" style={{ fontFamily: font, fontSize: "var(--reader-size)", lineHeight: "var(--reader-lh)" }}>
            {toParagraphs(shown.branch).map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        </div>
      )}

      {(picked || skipped) && (
        <p className="mt-8 text-center text-xs uppercase tracking-[0.2em]" style={{ color: t.muted }}>
          ✦ The story continues ✦
        </p>
      )}
    </section>
  );
}
