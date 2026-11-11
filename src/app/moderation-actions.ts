"use server";

import { cookies } from "next/headers";
import { MATURE_COOKIE } from "@/lib/moderation/mature";

/** Remembers on this device that the reader confirmed they are an adult (for a year). */
export async function confirmAdult() {
  (await cookies()).set(MATURE_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
}
