"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { inviteTranslator } from "@/app/translation/actions";
import { LANGUAGES, languageLabel } from "@/lib/translation/languages";
import { btn, input } from "@/components/ui/styles";

export function InviteTranslator({ storyId, original }: { storyId: string; original: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [lang, setLang] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !lang) return setMsg({ ok: false, text: "Enter a username and pick a language." });
    setBusy(true);
    setMsg(null);
    const r = await inviteTranslator(storyId, username, lang).catch(() => ({ ok: false as const, error: "You seem to be offline." }));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: `Invitation sent to @${username.replace(/^@/, "")}.` });
    setUsername("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@username" aria-label="Translator's username" className={input} />
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language" className={input}>
          <option value="">Into…</option>
          {LANGUAGES.filter((l) => l.code !== original).map((l) => (
            <option key={l.code} value={l.code}>
              {languageLabel(l.code)}
            </option>
          ))}
        </select>
        <button disabled={busy} className={btn.secondary}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Invite
        </button>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      <p className="mt-2 text-xs text-muted">
        Looking for someone? <Link href="/translators" className="underline hover:text-foreground">Browse translators by language</Link>.
      </p>
    </form>
  );
}
