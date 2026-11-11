"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { btn, label } from "@/components/ui/styles";
import { PasswordInput, StrengthMeter, passwordStrength } from "@/components/auth/PasswordInput";
import { friendlyAuthError } from "@/components/auth/messages";

export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (passwordStrength(password).score === 0) return setMsg({ ok: false, text: "Use at least 8 characters." });
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: friendlyAuthError(error.message).text });
    setPassword("");
    setOpen(false);
    setMsg({ ok: true, text: "Password changed." });
  }

  if (!open) {
    return (
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={() => (setOpen(true), setMsg(null))} className={btn.secondary}>
          <KeyRound className="h-4 w-4" /> Change password
        </button>
        {msg?.ok && (
          <span className="inline-flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> {msg.text}
          </span>
        )}
      </div>
    );
  }
  return (
    <form onSubmit={save} className="mt-5 space-y-3">
      <label htmlFor="settings-new-password" className={label}>
        New password
      </label>
      <PasswordInput id="settings-new-password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
      <StrengthMeter password={password} />
      {msg && !msg.ok && <p className="text-sm text-danger">{msg.text}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className={btn.primary}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save password
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btn.ghost}>
          Cancel
        </button>
      </div>
    </form>
  );
}
