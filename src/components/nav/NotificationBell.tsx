"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { unreadCount } from "@/app/community/actions";

/** Bell with the unread count. Rechecks on navigation, when the tab regains focus and every two minutes. */
export function NotificationBell({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  const pathname = usePathname();

  useEffect(() => {
    let live = true;
    const check = () =>
      unreadCount()
        .then((n) => live && setCount(n))
        .catch(() => {});
    if (pathname !== "/notifications") check();
    else setCount(0);
    const timer = setInterval(check, 120_000);
    const onFocus = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [pathname]);

  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";
  return (
    <Link href="/notifications" aria-label={label} className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground">
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute top-1.5 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-strong px-1 text-[10px] font-bold text-white ring-2 ring-background tabular-nums">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
