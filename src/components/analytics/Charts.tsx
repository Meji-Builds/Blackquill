"use client";

import { useEffect, useRef, useState } from "react";

const PAD = { top: 16, right: 16, bottom: 28, left: 36 };

/** The container's width in CSS pixels, so the chart draws at real size and text stays 11px on every screen. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow * 4 >= v)! * pow;
  return step * 4;
}

const ticks = (max: number) => [0, 1, 2, 3, 4].map((i) => (max / 4) * i);

/** Readers per day: a single line with a hover crosshair and tooltip. */
export function DailyChart({ data }: { data: { day: string; readers: number }[] }) {
  const H = 200;
  const [ref, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.readers)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.readers).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)} ${PAD.top + ih} L${x(0).toFixed(1)} ${PAD.top + ih} Z`;
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(W / 90)));

  function move(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * iw;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round((px / iw) * (data.length - 1)))));
  }

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block w-full" role="img" aria-label="Readers per day">
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks(max).map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t ? "2 4" : undefined} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d.day} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : x(i) > W - 40 ? "end" : "middle"} fontSize="11" fill="var(--muted)">
              {fmt(d.day)}
            </text>
          ) : null,
        )}
        <path d={area} fill="url(#area)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--muted)" strokeOpacity="0.5" />
            <circle cx={x(hover)} cy={y(data[hover].readers)} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={iw}
          height={ih}
          fill="transparent"
          onPointerMove={move}
          onPointerDown={move}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-border-strong bg-surface-3 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <span className="text-muted">{fmt(data[hover].day)}</span>{" "}
          <b className="tabular-nums">{data[hover].readers}</b> {data[hover].readers === 1 ? "reader" : "readers"}
        </div>
      )}
    </div>
  );
}

/** Readers per chapter: one bar each, with finishers shown as the darker inner bar. */
export function ChapterChart({
  data,
  dropAt,
}: {
  data: { number: number; title: string; readers: number; finishers: number }[];
  dropAt: number | null;
}) {
  const H = 220;
  const [ref, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.readers)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const slot = iw / Math.max(1, data.length);
  const bw = Math.max(3, Math.min(28, slot - 2));
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const labelEvery = Math.ceil(data.length / Math.max(4, Math.floor(W / 40)));
  const bar = (x: number, v: number, w: number) => {
    const top = y(v);
    const h = PAD.top + ih - top;
    if (h <= 0) return "";
    const r = Math.min(4, w / 2, h);
    return `M${x} ${PAD.top + ih} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + w - r} Q${x + w} ${top} ${x + w} ${top + r} V${PAD.top + ih} Z`;
  };

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block w-full" role="img" aria-label="Readers and finishers per chapter">
        {ticks(max).map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t ? "2 4" : undefined} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * slot + (slot - bw) / 2;
          const faded = hover !== null && hover !== i;
          return (
            <g key={d.number} opacity={faded ? 0.45 : 1}>
              <path d={bar(x, d.readers, bw)} fill="var(--accent)" fillOpacity="0.35" />
              <path d={bar(x, d.finishers, bw)} fill="var(--accent)" />
              {d.number === dropAt && <circle cx={x + bw / 2} cy={y(d.readers) - 8} r="3" fill="var(--warning)" />}
              {i % labelEvery === 0 && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                  {d.number}
                </text>
              )}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={ih}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerDown={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 max-w-[16rem] -translate-x-1/2 rounded-lg border border-border-strong bg-surface-3 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${Math.min(80, Math.max(20, ((PAD.left + (hover + 0.5) * slot) / W) * 100))}%` }}
        >
          <p className="truncate font-medium">
            Ch. {data[hover].number}
            {data[hover].title && ` · ${data[hover].title}`}
          </p>
          <p className="text-muted">
            <b className="text-foreground tabular-nums">{data[hover].readers}</b> opened ·{" "}
            <b className="text-foreground tabular-nums">{data[hover].finishers}</b> finished
          </p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent/35" /> Opened
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Finished
        </span>
        {dropAt !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-warning" /> Biggest drop-off
          </span>
        )}
      </div>
    </div>
  );
}
