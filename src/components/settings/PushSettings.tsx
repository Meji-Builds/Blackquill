"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2, X } from "lucide-react";
import { removePushSubscription, savePushSubscription, setPushPrefs } from "@/app/community/actions";
import { PUSH_GROUPS, type PushGroup } from "@/lib/notifications/text";
import { btn } from "@/components/ui/styles";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const DISMISS = "oq_push_prompt_dismissed";

type State = "checking" | "unconfigured" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function keyBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
}

async function sendToServer(sub: PushSubscription) {
  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error("This browser can't receive notifications.");
  const r = await savePushSubscription({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
  if (!r.ok) throw new Error(r.error);
}

function detect(): State {
  if (!KEY) return "unconfigured";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return ios && !standalone ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return "off";
}

/** Turn phone notifications on or off for this device, and choose which kinds arrive. */
export function PushSettings({ prefs: initialPrefs, variant = "full" }: { prefs?: Record<string, boolean>; variant?: "full" | "prompt" }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initialPrefs ?? {});
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let live = true;
    try {
      setDismissed(variant === "prompt" && localStorage.getItem(DISMISS) === "1");
    } catch {
      setDismissed(false);
    }
    const s = detect();
    if (s !== "off") return setState(s);
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (!live) return;
      if (sub && Notification.permission === "granted") {
        setState("on");
        sendToServer(sub).catch(() => {}); // keep this device attached to whoever is signed in now
      } else setState("off");
    })().catch(() => live && setState("off"));
    return () => {
      live = false;
    };
  }, [variant]);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      const options = { userVisibleOnly: true, applicationServerKey: keyBytes(KEY) };
      if (!sub) {
        sub = await reg.pushManager.subscribe(options).catch(async (e) => {
          // A leftover subscription made with another key: start fresh.
          const old = await reg.pushManager.getSubscription();
          if (!old) throw e;
          await old.unsubscribe();
          return reg.pushManager.subscribe(options);
        });
      }
      await sendToServer(sub);
      setState("on");
    } catch (e) {
      const m = (e as Error).message || "";
      setError(
        /permission|denied|not allowed/i.test(m)
          ? "Your browser didn't allow notifications for Obsidian Quill. Check its site settings and try again."
          : m || "Couldn't turn on notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setError((e as Error).message || "Couldn't turn off notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(key: PushGroup, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const r = await setPushPrefs(next).catch(() => ({ ok: false as const, error: "You seem to be offline." }));
    if (!r.ok) {
      setPrefs(prefs);
      setError(r.error);
    }
  }

  if (variant === "prompt") {
    if (dismissed || !(state === "off" || state === "ios-install")) return null;
    const close = () => {
      setDismissed(true);
      try {
        localStorage.setItem(DISMISS, "1");
      } catch {}
    };
    return (
      <div className="relative mt-5 flex gap-3.5 rounded-2xl border border-accent/30 bg-accent/[0.07] p-4 pr-11">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <BellRing className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">Get these on your phone</p>
          {state === "ios-install" ? (
            <p className="mt-0.5 text-sm text-muted">
              On iPhone and iPad, tap Share, then <b>Add to Home Screen</b>. Open Obsidian Quill from there and turn notifications on in Settings.
            </p>
          ) : (
            <>
              <p className="mt-0.5 text-sm text-muted">New chapters, replies and likes, even when Obsidian Quill is closed.</p>
              <button onClick={turnOn} disabled={busy} className={`${btn.small} mt-3`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Turn on notifications
              </button>
            </>
          )}
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        </div>
        <button onClick={close} aria-label="Not now" className="absolute top-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-3.5">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${state === "on" ? "bg-accent/15 text-accent" : "bg-surface-3 text-muted"}`}>
          {state === "on" ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {state === "on" ? "On for this device" : state === "checking" ? "Checking this device…" : "Off for this device"}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {state === "on" && "You'll get alerts even when Obsidian Quill is closed."}
            {state === "off" && "Get new chapters, replies, comments and likes as phone alerts, even when the app is closed."}
            {state === "denied" &&
              "Notifications are blocked for Obsidian Quill. Allow them in your browser's site settings (or your phone's app settings), then come back here."}
            {state === "ios-install" && (
              <>
                On iPhone and iPad, notifications work once Obsidian Quill is on your Home Screen: tap Share, then <b>Add to Home Screen</b>, open it
                from there and come back to this page.
              </>
            )}
            {state === "unsupported" && "This browser can't show notifications. Try Chrome, Edge, Firefox or Safari."}
            {state === "unconfigured" && "Phone notifications aren't available on this site yet."}
          </p>
          {(state === "on" || state === "off") && (
            <button onClick={state === "on" ? turnOff : turnOn} disabled={busy} className={`${state === "on" ? btn.ghost : btn.primary} mt-3`}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {state === "on" ? "Turn off on this device" : "Turn on notifications"}
            </button>
          )}
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      </div>

      {state === "on" && (
        <fieldset className="mt-5 border-t border-border pt-4">
          <legend className="sr-only">What to be alerted about</legend>
          <p className="text-sm font-medium">Alert me about</p>
          <ul className="mt-2 divide-y divide-border">
            {PUSH_GROUPS.map((g) => (
              <li key={g.key}>
                <label className="flex cursor-pointer items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">{g.label}</span>
                    <span className="block text-xs text-muted">{g.hint}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs[g.key] !== false}
                    onChange={(e) => toggle(g.key, e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-[#8f6bff]"
                  />
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">These apply to every device you&apos;ve turned notifications on for.</p>
        </fieldset>
      )}
    </div>
  );
}
