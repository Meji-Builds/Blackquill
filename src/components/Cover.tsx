/* eslint-disable @next/next/no-img-element -- covers come from user storage; sizes are fixed by CSS */
export function Cover({ url, title, className = "" }: { url: string | null; title: string; className?: string }) {
  if (url) {
    return <img src={url} alt={`Cover of ${title}`} className={`aspect-[2/3] rounded-md object-cover ${className}`} />;
  }
  return (
    <div
      aria-hidden="true"
      className={`flex aspect-[2/3] items-end rounded-md border border-border bg-gradient-to-br from-surface-2 to-background p-3 font-serif text-sm text-muted ${className}`}
    >
      <span className="line-clamp-3">{title}</span>
    </div>
  );
}
