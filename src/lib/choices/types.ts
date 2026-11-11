export interface ChoiceOption {
  id: string;
  position: number;
  label: string;
  branch: string;
}

export interface ChoicePoint {
  id: string;
  anchor: number; // the choice appears after this paragraph (0-based)
  prompt: string;
  options: ChoiceOption[];
}

/** What a reader picked, and the totals once they have (from the choice_state / pick_choice functions). */
export interface ChoiceState {
  picked: string | null;
  author?: boolean;
  counts?: Record<string, number>;
  total?: number;
}

export const CHOICE_LIMITS = { prompt: 300, label: 120, branch: 20000, minOptions: 2, maxOptions: 3 } as const;

/** Whole-number percentages that add up to 100 (largest remainder), so the bars never sum to 99 or 101. */
export function percentages(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - floors[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left-- <= 0) break;
    floors[i]++;
  }
  return floors;
}

/** Maps database rows (choice_points with choice_options) to a ChoicePoint. */
export function toChoicePoint(row: {
  id: string;
  anchor_position: number;
  prompt: string;
  choice_options: { id: string; position: number; label: string; branch_body: string }[];
} | null): ChoicePoint | null {
  if (!row) return null;
  return {
    id: row.id,
    anchor: row.anchor_position,
    prompt: row.prompt,
    options: [...row.choice_options]
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, position: o.position, label: o.label, branch: o.branch_body })),
  };
}
