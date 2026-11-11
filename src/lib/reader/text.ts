/** Splits chapter text into paragraphs: blank lines separate paragraphs, single newlines stay inside one. */
export function toParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Rough reading time at 230 words a minute, never below one minute. */
export function readingMinutes(words: number) {
  return Math.max(1, Math.round(words / 230));
}

/**
 * Index of the paragraph (as toParagraphs counts them) that contains a cursor position, or the one just before it
 * when the cursor sits on a blank line. Used to place a choice "after this paragraph".
 */
export function paragraphIndexAt(body: string, caret: number): number {
  const before = toParagraphs(body.slice(0, Math.max(0, caret)));
  return Math.max(0, before.length - 1);
}
