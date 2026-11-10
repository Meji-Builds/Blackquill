/* eslint-disable @next/next/no-img-element -- covers come from user storage; sizes are fixed by CSS */
export function Cover({ url, title, className = "" }: { url: string | null; title: string; className?: string }) {
  if (url) {
    return <img src={url} alt={`Cover of ${title}`} className={`aspect-[2/3] rounded-md object-cover ${className}`} />;
  }
  return (
    <div
      aria-hidden="true"
      className={`@container flex aspect-[2/3] items-end rounded-md border border-border bg-gradient-to-br from-surface-2 to-background p-1.5 font-serif @[6rem]:p-3 text-muted ${className}`}
    >
      {/* Small covers (rankings, lists) get smaller type so titles wrap instead of being cut off. */}
      <span className="line-clamp-4 w-full text-[10px] leading-tight [overflow-wrap:anywhere] @[6rem]:text-xs @[8rem]:line-clamp-3 @[8rem]:text-sm">
        {title}
      </span>
    </div>
  );
}
