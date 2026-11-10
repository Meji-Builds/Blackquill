"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createShelf, deleteShelf, renameShelf } from "@/app/reader/actions";

export function ShelfManager({ active }: { active: { id: string; name: string; custom: boolean } | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      else after?.();
    });
  }

  return (
    <div className="ml-auto flex items-center gap-2 text-sm">
      {active?.custom && (
        <>
          <button
            disabled={pending}
            className="text-muted hover:text-foreground"
            onClick={() => {
              const name = window.prompt("Rename shelf", active.name);
              if (name && name.trim() !== active.name) run(() => renameShelf(active.id, name));
            }}
          >
            Rename
          </button>
          <button
            disabled={pending}
            className="text-muted hover:text-danger"
            onClick={() => {
              if (window.confirm(`Delete the shelf "${active.name}"? The stories stay on your other shelves.`))
                run(() => deleteShelf(active.id), () => router.push("/library"));
            }}
          >
            Delete
          </button>
        </>
      )}
      <button
        disabled={pending}
        className="rounded-full border border-dashed border-border px-3 py-1.5 text-muted hover:text-foreground"
        onClick={() => {
          const name = window.prompt("New shelf name");
          if (name) run(() => createShelf(name));
        }}
      >
        + New shelf
      </button>
      {error && <span className="text-danger">{error}</span>}
    </div>
  );
}
