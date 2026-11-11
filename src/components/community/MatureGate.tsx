"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { confirmAdult } from "@/app/moderation-actions";
import { btn } from "@/components/ui/styles";

/** Shown instead of a mature story until the reader confirms they are 18 or older. */
export function MatureGate({ title, signedIn }: { title: string; signedIn: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
        <ShieldAlert className="h-7 w-7" />
      </span>
      <p className="mt-6 text-xs font-semibold tracking-[0.18em] text-gold uppercase">Mature · 18+</p>
      <h1 className="mt-2 font-display text-[32px] leading-tight font-semibold">{title}</h1>
      <p className="mt-3 text-muted">
        The writer marked this story as mature. It may include explicit content, strong violence or other adult themes.
      </p>
      <div className="mt-8 grid w-full gap-2">
        <button
          onClick={() =>
            start(async () => {
              await confirmAdult();
              router.refresh();
            })
          }
          disabled={pending}
          className={`${btn.primary} w-full`}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} I&apos;m 18 or older, continue
        </button>
        <Link href="/" className={`${btn.secondary} w-full`}>
          Take me back
        </Link>
      </div>
      {signedIn && (
        <p className="mt-6 text-sm text-muted">
          You can stop seeing this notice in{" "}
          <Link href="/settings" className="underline hover:text-foreground">
            settings
          </Link>
          .
        </p>
      )}
    </div>
  );
}
