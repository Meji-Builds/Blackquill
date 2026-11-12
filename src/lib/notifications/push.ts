import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushMessage, notificationHref, type NotificationKind } from "./text";

/** Push is set up when the app has its VAPID keys (see README). */
export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

interface Claimed {
  id: string;
  user_id: string;
  kind: NotificationKind;
  created_at: string;
  actor_name: string | null;
  actor_username: string | null;
  actor_avatar: string | null;
  story_id: string | null;
  story_title: string | null;
  story_cover: string | null;
  chapter_number: number | null;
  chapter_title: string | null;
  comment_id: string | null;
  comment_body: string | null;
  language: string | null;
  others: number;
}

function origin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://obsidianquill.vercel.app").replace(/\/$/, "");
}

const absolute = (url: string | null) => (!url ? null : url.startsWith("/") ? origin() + url : url);

/**
 * Send every notification that hasn't been pushed yet to the devices of the people it's for. Safe to call any number
 * of times at once: each notification is claimed by exactly one call. Returns how many alerts were delivered.
 */
export async function sendPendingPushes(deadlineMs = 20_000): Promise<{ sent: number; removed: number }> {
  if (!pushConfigured()) return { sent: 0, removed: 0 };
  webpush.setVapidDetails(
    // Push services want a way to reach the sender: an https address (or mailto:).
    process.env.VAPID_SUBJECT || (origin().startsWith("https://") ? origin() : "https://obsidianquill.vercel.app"),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const admin = createAdminClient();
  const stop = Date.now() + deadlineMs;
  let sent = 0;
  let removed = 0;

  while (Date.now() < stop) {
    const { data, error } = await admin.rpc("claim_push_batch", { p_limit: 200 });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Claimed[];
    if (rows.length === 0) break;

    const users = [...new Set(rows.map((r) => r.user_id))];
    const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", users);
    const byUser = new Map<string, { id: string; endpoint: string; p256dh: string; auth: string }[]>();
    for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

    const gone = new Set<string>();
    await Promise.all(
      rows.flatMap((r) => {
        const facts = {
          id: r.id,
          kind: r.kind,
          storyId: r.story_id,
          chapterNumber: r.chapter_number,
          actorUsername: r.actor_username,
          actorName: r.actor_name,
          language: r.language,
          storyTitle: r.story_title,
          chapterTitle: r.chapter_title,
          commentId: r.comment_id,
          commentBody: r.comment_body,
          others: r.others,
        };
        const message = pushMessage(facts);
        const payload = JSON.stringify({
          ...message,
          // Opening the alert marks it read, then goes to the chapter, comment or profile.
          url: `/notifications/open/${r.id}?to=${encodeURIComponent(notificationHref(facts))}`,
          icon: absolute(r.kind === "new_chapter" ? r.story_cover : r.actor_avatar),
          ts: new Date(r.created_at).getTime(),
        });
        return (byUser.get(r.user_id) ?? []).map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
              TTL: 60 * 60 * 24,
              urgency: r.kind === "new_chapter" || r.kind.endsWith("_like") ? "normal" : "high",
              topic: message.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32),
            });
            sent++;
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            // The browser was uninstalled, signed out or turned notifications off.
            if (status === 404 || status === 410) gone.add(s.id);
          }
        });
      }),
    );
    if (gone.size) {
      await admin.from("push_subscriptions").delete().in("id", [...gone]);
      removed += gone.size;
    }
  }
  return { sent, removed };
}
