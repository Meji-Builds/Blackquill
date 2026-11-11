/* eslint-disable @next/next/no-img-element -- covers come from user storage; sizes are fixed by CSS */

// Jewel-toned schemes for generated covers: [deep, glow, ink]. Picked from the title so a story keeps its look.
const SCHEMES: [string, string, string][] = [
  ["#1a1033", "#7c5cff", "#e8e0ff"], // violet
  ["#0d1f2d", "#2f8fbf", "#dff2ff"], // deep sea
  ["#2a0f16", "#c2415d", "#ffe4ea"], // garnet
  ["#10241a", "#3fa66b", "#e2fbe9"], // emerald
  ["#2b1a0a", "#d08a2e", "#fff0d9"], // amber
  ["#0f1630", "#4c6fff", "#e2e8ff"], // sapphire
  ["#221326", "#b25cc7", "#fbe6ff"], // amethyst
  ["#1c1c1c", "#bfa36b", "#f6efe0"], // gilt
  ["#0e2424", "#2bb3a3", "#dcfffa"], // teal
  ["#2a1410", "#e0643a", "#ffe9e1"], // ember
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A story cover. Uploaded covers are shown as they are; otherwise a generated jacket in the story's own colours,
 * with the title set in the display face. Type sizes follow the cover's width (container units), so the same
 * cover works in a 64px list row and a 240px hero.
 */
export function Cover({
  url,
  title,
  author,
  className = "",
}: {
  url: string | null;
  title: string;
  author?: string | null;
  className?: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={`Cover of ${title}`}
        loading="lazy"
        className={`aspect-[2/3] rounded-lg object-cover shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/5 ${className}`}
      />
    );
  }
  const h = hash(title);
  const [deep, glow, ink] = SCHEMES[h % SCHEMES.length];
  const angle = 140 + (h % 60);
  const glowX = 25 + (h % 50);
  return (
    <div
      role="img"
      aria-label={`Cover of ${title}`}
      className={`@container relative isolate flex aspect-[2/3] flex-col overflow-hidden rounded-lg shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)] ring-1 ring-white/5 ${className}`}
      style={{
        background: `radial-gradient(circle at ${glowX}% 22%, ${glow}55 0%, transparent 55%), linear-gradient(${angle}deg, ${deep} 0%, #070609 100%)`,
        color: ink,
      }}
    >
      {/* Frame and ornament, like a cloth-bound jacket. */}
      <div aria-hidden="true" className="absolute inset-[5%] rounded-[3px] border" style={{ borderColor: `${glow}40` }} />
      <div
        aria-hidden="true"
        className="absolute top-[18%] left-1/2 aspect-square w-[34%] -translate-x-1/2 rounded-full"
        style={{ background: `radial-gradient(circle, ${glow}90 0%, ${glow}10 60%, transparent 70%)` }}
      />
      <div className="relative mt-auto flex flex-col items-center px-[11%] pb-[13%] text-center">
        <span aria-hidden="true" className="mb-[6cqw] h-px w-[30%]" style={{ background: `${glow}aa` }} />
        <span
          className="line-clamp-4 font-display leading-[1.02] font-semibold [overflow-wrap:anywhere]"
          style={{ fontSize: "clamp(9px, 13.5cqw, 34px)" }}
        >
          {title}
        </span>
        {author && (
          <span
            className="mt-[5cqw] truncate font-sans tracking-[0.18em] uppercase opacity-70"
            style={{ fontSize: "clamp(5px, 5cqw, 11px)", maxWidth: "100%" }}
          >
            {author}
          </span>
        )}
      </div>
    </div>
  );
}
