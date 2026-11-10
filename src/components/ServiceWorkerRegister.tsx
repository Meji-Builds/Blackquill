"use client";

import { useEffect } from "react";

/** Registers the offline service worker in production builds on secure origins (HTTPS or localhost). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* offline reading is a bonus; the site works without it */
    });
  }, []);
  return null;
}
