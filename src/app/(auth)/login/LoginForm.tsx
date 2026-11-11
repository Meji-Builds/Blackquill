"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [notice, setNotice] = useState<string | null>(null);

  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        router.replace(next);
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) setError(error.message);
      else if (data.session) {
        router.replace(next);
        router.refresh();
      } else setNotice("Check your email to confirm your account.");
    }
    setBusy(false);
  }

  async function google() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <button
        type="button"
        onClick={google}
        disabled={busy}
        className="w-full rounded-md border border-border bg-surface px-4 py-2.5 font-medium hover:bg-surface-2 disabled:opacity-60"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-lg border border-border-strong bg-surface px-3.5 text-[15px] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-lg border border-border-strong bg-surface px-3.5 text-[15px] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        {notice && <p className="text-sm text-accent">{notice}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-accent-strong px-4 py-2.5 font-medium text-white hover:bg-accent disabled:opacity-60"
        >
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="text-accent hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
