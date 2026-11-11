import "server-only";
import { cookies } from "next/headers";

export const MATURE_COOKIE = "oq_mature";

/** Whether to show the 18+ notice before a mature story: not for its author, nor for readers who opted in. */
export async function needsMatureGate(
  story: { rating: string; author_id: string },
  viewer: { id: string; showMature: boolean } | null,
): Promise<boolean> {
  if (story.rating !== "mature") return false;
  if (viewer && (viewer.id === story.author_id || viewer.showMature)) return false;
  return (await cookies()).get(MATURE_COOKIE)?.value !== "1";
}
