export interface ChapterStat {
  number: number;
  title: string;
  readers: number;
  finishers: number;
  published_at?: string | null;
}

/** Chapters old enough to judge: a chapter out for less than three days hasn't had time to be read yet. */
export function settled(chapters: ChapterStat[], now = Date.now()): ChapterStat[] {
  return chapters.filter((c) => !c.published_at || now - new Date(c.published_at).getTime() >= 3 * 86_400_000);
}

/**
 * The chapter after which the most readers stop: the largest fall in readers from one chapter to the next,
 * relative to the chapter's readers. Only chapters with at least `min` readers count, so noise is ignored.
 */
export function dropOff(chapters: ChapterStat[], min = 3): { number: number; lost: number; share: number } | null {
  let best: { number: number; lost: number; share: number } | null = null;
  for (let i = 0; i < chapters.length - 1; i++) {
    const a = chapters[i].readers;
    const b = chapters[i + 1].readers;
    if (a < min || b >= a) continue;
    const share = (a - b) / a;
    if (!best || share > best.share) best = { number: chapters[i].number, lost: a - b, share };
  }
  return best;
}

/** Share of readers of the first chapter who reached the latest one. */
export function retention(chapters: ChapterStat[]): number | null {
  if (chapters.length < 2 || chapters[0].readers === 0) return null;
  return Math.min(1, chapters[chapters.length - 1].readers / chapters[0].readers);
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
