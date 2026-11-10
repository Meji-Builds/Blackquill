export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-serif text-xl tracking-wide ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
        <path
          d="M20 3c-6 1-11 6-13 12l-2 6 2-1c1-3 3-5 5-6l-2-1c3-1 6-4 7-7l-2 1c2-1 4-3 5-4z"
          fill="currentColor"
          className="text-accent"
        />
        <path d="M5 21l3-7" stroke="currentColor" strokeWidth="1.5" className="text-foreground" />
      </svg>
      Blackquill
    </span>
  );
}
