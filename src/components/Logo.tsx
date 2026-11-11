export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="oq-quill" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#8f6bff" />
          <stop offset="1" stopColor="#d9ccff" />
        </linearGradient>
      </defs>
      <path d="M20 3c-6 1-11 6-13 12l-2 6 2-1c1-3 3-5 5-6l-2-1c3-1 6-4 7-7l-2 1c2-1 4-3 5-4z" fill="url(#oq-quill)" />
      <path d="M5 21l3-7" stroke="#ece8f1" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Quill mark with the wordmark; the wordmark hides on the narrowest phones. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="hidden font-display text-[22px] leading-none font-semibold tracking-wide min-[360px]:inline">
        Obsidian Quill
      </span>
    </span>
  );
}
