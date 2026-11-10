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
