"use client";

import { useEffect, useRef } from "react";
import "./intro.css";
import { INTRO_KEY } from "./boot";

// Deterministic stardust so server and browser render the same dots.
function dust(n: number) {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({ x: r() * 100, y: r() * 100, size: 1 + r() * 2.2, delay: r() * 3, dur: 2.5 + r() * 3 }));
}
const DUST = dust(46);
const EMBERS = dust(14).map((e, i) => ({ ...e, x: 30 + e.x * 0.4, delay: i * 0.17 }));

// The nib's six facets, with where each shard flies in from.
const FACETS = [
  { d: "M24 5 L13 14 L24 21 Z", fill: "top", dx: -60, dy: -90, r: -140 },
  { d: "M24 5 L35 14 L24 21 Z", fill: "fl", dx: 70, dy: -80, r: 120 },
  { d: "M13 14 L15.5 30 L24 21 Z", fill: "fl", dx: -110, dy: 10, r: -200 },
  { d: "M35 14 L32.5 30 L24 21 Z", fill: "fr", dx: 110, dy: 20, r: 160 },
  { d: "M15.5 30 L24 44 L24 21 Z", fill: "bl", dx: -70, dy: 100, r: 90 },
  { d: "M32.5 30 L24 44 L24 21 Z", fill: "br", dx: 60, dy: 110, r: -110 },
];

const WORD = "Obsidian";
const GOLD = "Quill";

/**
 * The opening: a spark bursts into obsidian shards that lock into the nib, a gold moon rises behind it, ink pours
 * down the slit and a falling drop writes the name. Pure CSS so it starts before the page is interactive; this
 * component only handles skipping and remembering that it has been seen.
 */
export function IntroSplash() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el || !root.hasAttribute("data-intro")) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      try {
        localStorage.setItem(INTRO_KEY, String(Date.now()));
      } catch {}
      root.removeAttribute("data-intro");
      document.body.style.overflow = prevOverflow;
      if (/[?&]intro\b/.test(location.search)) {
        const u = new URL(location.href);
        u.searchParams.delete("intro");
        history.replaceState(history.state, "", u);
      }
    };
    const skip = () => el.classList.add("oq-intro--skip");
    const onEnd = (e: AnimationEvent) => {
      if (e.target === el && (e.animationName === "oq-exit" || e.animationName === "oq-skip")) finish();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") skip();
    };
    el.addEventListener("animationend", onEnd);
    el.addEventListener("click", skip);
    window.addEventListener("keydown", onKey);
    const safety = window.setTimeout(finish, 9000); // in case animations never fire (e.g. a background tab)
    return () => {
      el.removeEventListener("animationend", onEnd);
      el.removeEventListener("click", skip);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(safety);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const g = (n: string) => `url(#oqi-${n})`;

  return (
    <div ref={ref} className="oq-intro" role="presentation" aria-hidden="true">
      <div className="oq-intro__haze" />
      <div className="oq-intro__dust">
        {DUST.map((p, i) => (
          <span
            key={i}
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
          />
        ))}
      </div>

      <div className="oq-intro__stage">
        <div className="oq-intro__mark">
          <div className="oq-intro__aura" />
          <div className="oq-intro__embers">
            {EMBERS.map((p, i) => (
              <span key={i} style={{ left: `${p.x}%`, animationDelay: `calc(var(--u) * 2.6 + ${p.delay}s)`, width: p.size + 1, height: p.size + 1 }} />
            ))}
          </div>
          <svg viewBox="0 0 48 48" className="oq-intro__svg">
            <defs>
              <linearGradient id="oqi-fl" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#b9a2ff" />
                <stop offset="1" stopColor="#5b3fd6" />
              </linearGradient>
              <linearGradient id="oqi-fr" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6d4fe0" />
                <stop offset="1" stopColor="#241848" />
              </linearGradient>
              <linearGradient id="oqi-bl" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#7a5cf0" />
                <stop offset="1" stopColor="#2b1d57" />
              </linearGradient>
              <linearGradient id="oqi-br" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3a2878" />
                <stop offset="1" stopColor="#130d26" />
              </linearGradient>
              <linearGradient id="oqi-top" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#e2d8ff" />
                <stop offset="1" stopColor="#9a80ff" />
              </linearGradient>
              <linearGradient id="oqi-gold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f6dfa6" />
                <stop offset="1" stopColor="#c9963f" />
              </linearGradient>
              <linearGradient id="oqi-sheen" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="oqi-glow">
                <stop offset="0" stopColor="#ffe6a8" stopOpacity="0.95" />
                <stop offset="1" stopColor="#ffe6a8" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="oqi-flash">
                <stop offset="0" stopColor="#fff" stopOpacity="1" />
                <stop offset="0.35" stopColor="#d9ccff" stopOpacity="0.6" />
                <stop offset="1" stopColor="#8f6bff" stopOpacity="0" />
              </radialGradient>
              <clipPath id="oqi-nib">
                <path d="M24 5 L35 14 L32.5 30 L24 44 L15.5 30 L13 14 Z" />
              </clipPath>
            </defs>

            <g className="oq-moon">
              <path className="oq-moon__fill" d="M19 3.6a20.6 20.6 0 1 0 25.6 23.9a18.4 18.4 0 1 1 -25.6 -23.9z" fill={g("gold")} />
              <path
                className="oq-moon__line"
                d="M19 3.6a20.6 20.6 0 1 0 25.6 23.9a18.4 18.4 0 1 1 -25.6 -23.9z"
                pathLength={1}
                fill="none"
                stroke="#f6dfa6"
                strokeWidth="0.6"
              />
            </g>

            <circle className="oq-spark" cx="24" cy="24" r="2.2" fill="#ffe9b0" />

            <g stroke="#0b0a0d" strokeWidth="0.55" strokeLinejoin="round">
              {FACETS.map((f, i) => (
                <path
                  key={i}
                  className="oq-facet"
                  d={f.d}
                  fill={g(f.fill)}
                  style={{ "--dx": `${f.dx}px`, "--dy": `${f.dy}px`, "--r": `${f.r}deg`, "--i": i } as React.CSSProperties}
                />
              ))}
            </g>

            <g clipPath="url(#oqi-nib)">
              <rect className="oq-sheen" x="-8" y="0" width="10" height="48" fill={g("sheen")} />
            </g>

            <circle className="oq-flash" cx="24" cy="24" r="22" fill={g("flash")} />
            <circle className="oq-glow" cx="24" cy="22.5" r="6" fill={g("glow")} />
            <path className="oq-slit" d="M24 25 L24 42.5" pathLength={1} stroke="#f3d48f" strokeWidth="1.6" strokeLinecap="round" />
            <circle className="oq-hole" cx="24" cy="22.5" r="2.5" fill="#f6dfa6" />
            <circle className="oq-drop" cx="24" cy="43.5" r="1.1" fill="#f6dfa6" />
          </svg>
        </div>

        <div className="oq-intro__ink" />
        <p className="oq-intro__word">
          {WORD.split("").map((c, i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties}>
              {c}
            </span>
          ))}
          <span className="oq-intro__gap" />
          {GOLD.split("").map((c, i) => (
            <span key={`q${i}`} className="oq-intro__gold" style={{ "--i": WORD.length + 1 + i } as React.CSSProperties}>
              {c}
            </span>
          ))}
        </p>
        <p className="oq-intro__tagline">Where stories are written in starlight</p>
      </div>

      <span className="oq-intro__skip">Tap to skip</span>
    </div>
  );
}
