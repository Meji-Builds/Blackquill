"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/** Text clamped to a few lines with a "Read more" toggle, shown only when the text is actually cut off. */
export function Expandable({ children, lines = 4 }: { children: React.ReactNode; lines?: number }) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) setClipped(el.scrollHeight > el.clientHeight + 2);
  }, []);

  return (
    <div>
      <div
        ref={ref}
        className="space-y-3 overflow-hidden"
        style={open ? undefined : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical" }}
      >
        {children}
      </div>
      {(clipped || open) && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          {open ? "Show less" : "Read more"}
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
