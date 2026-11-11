"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { btn, label } from "@/components/ui/styles";
import { PasswordInput, StrengthMeter, passwordStrength } from "./PasswordInput";
import { friendlyAuthError } from "./messages";

/** Set a new password after following the reset link (the link signs the reader in for this one step). */
export function ResetPasswordForm() {
  const [state, setState] = useState<"checking" | "ready" | "expired" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setState(data.user ? "ready" : "expired"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (passwordStrength(password).score === 0) return setError("Choose a password of at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(friendlyAuthError(error.message).text);
    setPassword("");
    setConfirm("");
    setState("done");
  }

  if (state === "checking") {
    return <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" aria-label="Loading" />;
  }

  if (state === "expired") {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10 text-warning ring-1 ring-warning/30">
          <AlertCircle className="h-8 w-8" strokeWidth={1.6} />
        </div>
        <h1 className="mt-6 font-display text-[34px] leading-tight font-semibold">This link has expired</h1>
        <p className="mt-3 text-muted">Reset links work once and only for an hour. Ask for a new one and use it on this device.</p>
        <Link href="/login?mode=forgot" className={`${btn.primary} mt-8 w-full`}>
          Send a new link
        </Link>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="text-center" role="status">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 text-success ring-1 ring-success/30">
          <CheckCircle2 className="h-8 w-8" strokeWidth={1.6} />
        </div>
        <h1 className="mt-6 font-display text-[34px] leading-tight font-semibold">Password updated</h1>
        <p className="mt-3 text-muted">You are signed in. Use your new password next time.</p>
        <button
          onClick={() => window.location.assign("/")}
          className={`${btn.primary} mt-8 w-full`}
        >
          Continue reading
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/30">
        <KeyRound className="h-6 w-6" strokeWidth={1.8} />
      </div>
      <h1 className="mt-5 font-display text-[34px] leading-tight font-semibold">Choose a new password</h1>
      <p className="mt-2 text-muted">At least 8 characters. A short phrase is easier to remember and harder to guess.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <div>
          <label htmlFor="new-password" className={label}>
            New password
          </label>
          <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
          <StrengthMeter password={password} />
        </div>
        <div>
          <label htmlFor="confirm-password" className={label}>
            Type it again
          </label>
          <PasswordInput
            id="confirm-password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            invalid={confirm.length > 0 && confirm !== password}
          />
          {confirm.length > 0 && confirm !== password && <p className="mt-1.5 text-xs text-danger">Doesn’t match yet.</p>}
        </div>
        {error && (
          <p role="alert" className="flex gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={`${btn.primary} w-full`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save new password
        </button>
      </form>
    </div>
  );
}
