"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ANON_COOKIE, ANON_ID } from "@/lib/discovery/viewer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function anonId() {
  const v = (await cookies()).get(ANON_COOKIE)?.value;
  return v && ANON_ID.test(v) ? v : null;
}

/**
 * Records that a chapter was opened or finished. The database validates and deduplicates; the result says what
 * was recorded ("open", "finish") or why not ("too fast", "duplicate", ...).
 */
export async function logReadingEvent(storyId: string, chapterId: string, type: "open" | "finish") {
  if (!UUID.test(storyId) || !UUID.test(chapterId) || (type !== "open" && type !== "finish")) return "invalid";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_reading_event", {
    p_story_id: storyId,
    p_chapter_id: chapterId,
    p_type: type,
    p_anon: await anonId(),
  });
  return error ? "error" : (data as string);
}

/** Counts Fresh Shelf stories as shown once the row is actually on screen. */
export async function recordFreshImpressions(storyIds: string[]) {
  const ids = storyIds.filter((id) => UUID.test(id)).slice(0, 24);
  if (ids.length === 0) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("record_fresh_impressions", { p_story_ids: ids, p_anon: await anonId() });
  return (data as number) ?? 0;
}
