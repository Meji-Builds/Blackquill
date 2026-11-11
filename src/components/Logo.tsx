/**
 * The mark: a pen nib cut from faceted obsidian, its slit and breather hole lit gold, set against a crescent moon.
 * `id` keeps gradient ids unique when the mark appears more than once on a page.
 */
export function LogoMark({ className = "h-8 w-8", id = "oq" }: { className?: string; id?: string }) {
  const g = (name: string) => `${id}-${name}`;
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={g("fl")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9a2ff" />
          <stop offset="1" stopColor="#5b3fd6" />
        </linearGradient>
        <linearGradient id={g("fr")} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6d4fe0" />
          <stop offset="1" stopColor="#241848" />
        </linearGradient>
        <linearGradient id={g("bl")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a5cf0" />
          <stop offset="1" stopColor="#2b1d57" />
        </linearGradient>
        <linearGradient id={g("br")} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a2878" />
          <stop offset="1" stopColor="#130d26" />
        </linearGradient>
        <linearGradient id={g("top")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2d8ff" />
          <stop offset="1" stopColor="#9a80ff" />
        </linearGradient>
        <linearGradient id={g("gold")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dfa6" />
          <stop offset="1" stopColor="#c9963f" />
        </linearGradient>
        <radialGradient id={g("glow")}>
          <stop offset="0" stopColor="#ffe6a8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe6a8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M19 3.6a20.6 20.6 0 1 0 25.6 23.9a18.4 18.4 0 1 1 -25.6 -23.9z" fill={`url(#${g("gold")})`} />
      <g stroke="#0b0a0d" strokeWidth="0.55" strokeLinejoin="round">
        <path d="M24 5 L13 14 L24 21 Z" fill={`url(#${g("top")})`} />
        <path d="M24 5 L35 14 L24 21 Z" fill={`url(#${g("fl")})`} />
        <path d="M13 14 L15.5 30 L24 21 Z" fill={`url(#${g("fl")})`} />
        <path d="M35 14 L32.5 30 L24 21 Z" fill={`url(#${g("fr")})`} />
        <path d="M15.5 30 L24 44 L24 21 Z" fill={`url(#${g("bl")})`} />
        <path d="M32.5 30 L24 44 L24 21 Z" fill={`url(#${g("br")})`} />
      </g>
      <circle cx="24" cy="22.5" r="6" fill={`url(#${g("glow")})`} />
      <path d="M24 25 L24 42.5" stroke="#f3d48f" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="24" cy="22.5" r="2.5" fill="#f6dfa6" />
    </svg>
  );
}

/** Mark with the wordmark; the wordmark hides on the narrowest phones. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-8 w-8 shrink-0 drop-shadow-[0_0_10px_rgba(143,107,255,0.35)]" />
      <span className="hidden font-display text-[23px] leading-none font-semibold tracking-[0.02em] whitespace-nowrap min-[360px]:inline">
        Obsidian{" "}
        <span className="bg-gradient-to-b from-[#f6dfa6] to-[#c9963f] bg-clip-text text-transparent">Quill</span>
      </span>
    </span>
  );
}
