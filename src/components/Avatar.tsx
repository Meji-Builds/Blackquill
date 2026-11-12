/* eslint-disable @next/next/no-img-element -- profile pictures come from user storage, already resized to 256px */

// Jewel tones for monograms: [from, to]. Picked from the username so a person keeps their colour everywhere.
const TONES: [string, string][] = [
  ["#8f6bff", "#4b2fc0"],
  ["#d9a04a", "#8a5a1c"],
  ["#3fae9a", "#1d6157"],
  ["#d0607a", "#7d2a40"],
  ["#5a8be0", "#28457f"],
  ["#a46bd6", "#5a2c80"],
  ["#c27a4a", "#6e3d1f"],
  ["#6c9a4e", "#3a5a27"],
];

function tone(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

/** The first letter of a name, skipping punctuation and keeping letters outside the Latin alphabet. */
export function initial(name: string) {
  const m = name.match(/\p{L}|\p{N}/u);
  return (m?.[0] ?? "?").toLocaleUpperCase();
}

/**
 * A round profile picture, or a monogram on a jewel-toned circle for people without one.
 * `seed` should be the username so the colour is the same wherever the person appears.
 */
export function Avatar({
  url,
  name,
  seed,
  size = 32,
  className = "",
}: {
  url?: string | null;
  name: string;
  seed?: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={style}
        className={`shrink-0 rounded-full bg-surface-2 object-cover ${className}`}
      />
    );
  }
  const [from, to] = tone(seed ?? name);
  return (
    <span
      aria-hidden="true"
      style={{ ...style, backgroundImage: `linear-gradient(135deg, ${from}, ${to})`, fontSize: Math.round(size * 0.46) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display leading-none font-semibold text-white select-none ${className}`}
    >
      {initial(name)}
    </span>
  );
}
