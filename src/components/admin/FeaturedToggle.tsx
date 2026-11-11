"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setComicEnabled } from "@/app/admin/actions";
import { btn } from "@/components/ui/styles";

export function FeaturedToggle({ storyId, enabled, cap }: { storyId: string; enabled: boolean; cap: number }) {
  const [on, setOn] = useState(enabled);
  const [value, setValue] = useState(cap);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(next: boolean, nextCap = value) {
    setError(null);
    start(async () => {
      const r = await setComicEnabled(storyId, next, nextCap);
      if (!r.ok) setError(r.error);
      else setOn(next);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {on && (
        <label className="inline-flex items-center gap-2 text-sm text-muted">
          Panels per chapter
          <input
            type="number"
            min={1}
            max={50}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            onBlur={() => value !== cap && save(true, value)}
            className="h-9 w-16 rounded-lg border border-border-strong bg-background px-2 text-sm text-foreground"
          />
        </label>
      )}
      <button onClick={() => save(!on)} disabled={pending} className={on ? `${btn.small} border-danger/40 text-danger hover:bg-danger/10` : btn.small}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {on ? "Remove from featured" : "Feature for comics"}
      </button>
      {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}
