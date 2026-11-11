import { toParagraphs } from "../reader/text.ts";

export interface Scene {
  caption: string;
  prompt: string;
}

const COMMON = new Set(
  "The A An And But Or If In On At Of To For With From By As It He She They We I You His Her Their Our My Your This That These Those There Here When While Then After Before Every Each Some No Not Nobody Somebody Someone Somewhere".split(
    " ",
  ),
);

function sentences(p: string) {
  return p
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=["'“A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const isDialogue = (s: string) => /["“”]/.test(s);

function clip(s: string, n: number) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(" ") > n * 0.6 ? cut.lastIndexOf(" ") : n).replace(/[,;:]$/, "") + "…";
}

/** Capitalised words that are not sentence starters, most frequent first: a rough cast list. */
function names(text: string, max = 3) {
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/(?<=[a-z,;:] )([A-Z][a-z]+(?: [A-Z][a-z]+)?)/g)) {
    const n = m[1];
    if (COMMON.has(n.split(" ")[0])) continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([n]) => n);
}

/**
 * Splits a chapter into 3-8 scenes (fewer for very short chapters). Paragraphs are grouped in order into blocks of
 * similar length; each scene's caption is its most descriptive non-dialogue sentence and its prompt adds who is in it.
 * Writers edit both before generating, so this only has to be a good first draft.
 */
export function splitScenes(body: string, { min = 3, max = 8, wordsPerScene = 130 } = {}): Scene[] {
  const paras = toParagraphs(body);
  if (paras.length === 0) return [];
  const count = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const total = paras.reduce((a, p) => a + count(p), 0);
  const target = Math.max(Math.min(min, paras.length), Math.min(max, paras.length, Math.round(total / wordsPerScene)));

  const groups: string[][] = [];
  let current: string[] = [];
  let acc = 0;
  const per = total / target;
  paras.forEach((p, i) => {
    current.push(p);
    acc += count(p);
    const left = paras.length - i - 1;
    const groupsLeft = target - groups.length - 1;
    if ((acc >= per && groupsLeft > 0 && left >= groupsLeft) || left < groupsLeft + 1) {
      if (groups.length < target - 1) {
        groups.push(current);
        current = [];
        acc = 0;
      }
    }
  });
  if (current.length) groups.push(current);

  return groups.map((g) => {
    const text = g.join(" ");
    const all = g.flatMap(sentences);
    const narrative = all.filter((s) => !isDialogue(s));
    const pool = narrative.length ? narrative : all;
    const key = pool.reduce((best, s) => (s.length > best.length ? s : best), pool[0] ?? text);
    const cast = names(text);
    const prompt = `${clip(key, 300)}${cast.length ? ` Characters: ${cast.join(", ")}.` : ""}`;
    return { caption: clip(key, 180), prompt: clip(prompt, 400) };
  });
}
