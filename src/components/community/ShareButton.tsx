"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, Mail, Share2, X } from "lucide-react";

/**
 * Shares a page. On phones this opens the system share sheet (WhatsApp, Instagram, Messages…); elsewhere a small
 * panel with copy-link and the common networks. Links unfurl into the page's share card wherever they're pasted.
 */
export function ShareButton({
  path,
  title,
  text,
  variant = "button",
  className = "",
  style,
}: {
  /** Site-relative path, e.g. /story/123 */
  path: string;
  title: string;
  text?: string;
  variant?: "button" | "icon";
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    const canNative = typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (canNative) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // the reader closed the sheet
      }
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        aria-label={variant === "icon" ? `Share ${title}` : undefined}
        className={
          variant === "icon"
            ? `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-strong text-muted transition hover:bg-surface-2 hover:text-foreground ${className}`
            : className
        }
        style={style}
      >
        <Share2 className="h-4 w-4" />
        {variant === "button" && "Share"}
      </button>
      {open && <SharePanel path={path} title={title} text={text} onClose={() => setOpen(false)} />}
    </>
  );
}

function SharePanel({ path, title, text, onClose }: { path: string; title: string; text?: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const url = typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();
  const message = text ? `${title}: ${text}` : title;
  const e = encodeURIComponent;
  const targets = [
    { name: "WhatsApp", href: `https://wa.me/?text=${e(`${message} ${url}`)}`, color: "#25D366" },
    { name: "X", href: `https://x.com/intent/post?text=${e(message)}&url=${e(url)}`, color: "#e7e9ea" },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`, color: "#1877F2" },
    { name: "Telegram", href: `https://t.me/share/url?url=${e(url)}&text=${e(message)}`, color: "#29A9EB" },
    { name: "Reddit", href: `https://www.reddit.com/submit?url=${e(url)}&title=${e(title)}`, color: "#FF4500" },
  ];

  useEffect(() => {
    ref.current?.focus();
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center text-foreground sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="relative w-full max-w-md rounded-t-3xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:rounded-3xl"
      >
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2">
          <X className="h-5 w-5" />
        </button>
        <h2 id="share-title" className="text-lg font-semibold">Share</h2>
        <p className="mt-1 line-clamp-1 text-sm text-muted">{title}</p>

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-border-strong bg-background p-1.5 pl-3">
          <Link2 className="h-4 w-4 shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate text-sm">{url}</span>
          <button onClick={copy} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent-strong px-3 text-sm font-medium text-white">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {targets.map((t) => (
            <li key={t.name}>
              <a
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-xs text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-black" style={{ background: t.color }}>
                  {t.name.charAt(0)}
                </span>
                {t.name}
              </a>
            </li>
          ))}
          <li>
            <a
              href={`mailto:?subject=${e(title)}&body=${e(`${message}\n\n${url}`)}`}
              className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-xs text-muted hover:bg-surface-2 hover:text-foreground"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-3 text-foreground">
                <Mail className="h-5 w-5" />
              </span>
              Email
            </a>
          </li>
        </ul>
        <p className="mt-4 text-xs text-muted">The link shows the story&apos;s cover card wherever you paste it.</p>
      </div>
    </div>
  );
}
