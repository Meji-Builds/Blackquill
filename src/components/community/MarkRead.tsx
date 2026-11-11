"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "@/app/community/actions";

/** Marks everything read once the list has been seen; this visit still shows which ones were new. */
export function MarkRead() {
  useEffect(() => {
    markNotificationsRead().catch(() => {});
  }, []);
  return null;
}
