"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { answerTranslator, removeTranslator } from "@/app/translation/actions";
import { btn } from "@/components/ui/styles";

/** Approve/decline (or accept/decline an invitation), or remove an existing translator. */
export function TranslatorAnswer({
  storyId,
  userId,
  language,
  mode,
}: {
  storyId: string;
  userId: string;
  language: string;
  mode: "answer-request" | "answer-invite" | "remove" | "leave" | "cancel-invite" | "withdraw";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      else router.refresh();
    });
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {(mode === "answer-request" || mode === "answer-invite") && (
        <>
          <button disabled={pending} onClick={() => run(() => answerTranslator(storyId, userId, language, true))} className={`${btn.small} border-accent/50 bg-accent-strong text-white hover:bg-[#9c7dff]`}>
            {mode === "answer-invite" ? "Accept" : "Approve"}
          </button>
          <button disabled={pending} onClick={() => run(() => answerTranslator(storyId, userId, language, false))} className={btn.small}>
            Decline
          </button>
        </>
      )}
      {mode === "remove" && (
        <button disabled={pending} onClick={() => run(() => removeTranslator(storyId, userId, language), "Remove this translator? Chapters they published stay up.")} className={`${btn.small} text-danger`}>
          Remove
        </button>
      )}
      {(mode === "cancel-invite" || mode === "withdraw") && (
        <button disabled={pending} onClick={() => run(() => removeTranslator(storyId, userId, language))} className={btn.small}>
          {mode === "withdraw" ? "Withdraw request" : "Cancel invitation"}
        </button>
      )}
      {mode === "leave" && (
        <button disabled={pending} onClick={() => run(() => removeTranslator(storyId, userId, language), "Stop translating this story? Chapters you published stay up.")} className={btn.small}>
          Stop translating
        </button>
      )}
      {pending && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
      {error && <span role="alert" className="w-full text-sm text-danger">{error}</span>}
    </span>
  );
}
