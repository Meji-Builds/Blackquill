/** Cookie holding a random id for signed-out readers, so discovery can count them once each. */
export const ANON_COOKIE = "oq_aid";
export const ANON_ID = /^[0-9a-f-]{36}$/;

/**
 * Seconds a reader must spend on a chapter before it counts as finished. Mirrors the server's rule in
 * log_reading_event() (which has the final say): 900 words a minute, at least 10 seconds, at most 10 minutes.
 */
export function minFinishSeconds(words: number, wpm = 900) {
  return Math.min(600, Math.max(10, (words / wpm) * 60));
}
