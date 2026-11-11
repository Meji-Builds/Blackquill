"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Download, Feather, LogOut, Settings, Shield, UserRound } from "lucide-react";
import type { Viewer } from "@/components/SiteHeader";

/** Avatar button with the reader's own pages and sign out. */
export function AccountMenu({ viewer }: { viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-surface-3";
  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-strong to-[#5b3fd6] font-display text-lg font-semibold text-white ring-2 ring-background transition hover:ring-accent/40"
      >
        {viewer.penName.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-border bg-surface-2 p-2 shadow-2xl shadow-black/60"
        >
          <div className="px-3 pt-2 pb-3">
            <p className="truncate font-medium">{viewer.penName}</p>
            <p className="truncate text-sm text-muted">@{viewer.username}</p>
          </div>
          <div className="h-px bg-border" />
          <div className="py-1">
            <Link role="menuitem" href={`/author/${viewer.username}`} onClick={close} className={item}>
              <UserRound className="h-4 w-4 text-muted" /> Your author page
            </Link>
            <Link role="menuitem" href="/studio" onClick={close} className={item}>
              <Feather className="h-4 w-4 text-muted" /> Writer studio
            </Link>
            <Link role="menuitem" href="/library" onClick={close} className={item}>
              <BookOpen className="h-4 w-4 text-muted" /> Library
            </Link>
            <Link role="menuitem" href="/offline" onClick={close} className={item}>
              <Download className="h-4 w-4 text-muted" /> Downloaded stories
            </Link>
            <Link role="menuitem" href="/settings" onClick={close} className={item}>
              <Settings className="h-4 w-4 text-muted" /> Profile and settings
            </Link>
            {viewer.isAdmin && (
              <Link role="menuitem" href="/admin" onClick={close} className={item}>
                <Shield className="h-4 w-4 text-muted" /> Moderation
              </Link>
            )}
          </div>
          <div className="h-px bg-border" />
          <form action="/auth/signout" method="post" className="pt-1">
            <button role="menuitem" className={`${item} w-full text-left`}>
              <LogOut className="h-4 w-4 text-muted" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
