"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, MailCheck, RotateCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { btn, input, label } from "@/components/ui/styles";
import { PasswordInput, StrengthMeter, passwordStrength } from "./PasswordInput";
import { friendlyAuthError, type AuthProblem } from "./messages";

export type AuthMode = "signin" | "signup" | "forgot";

type Sent = { kind: "confirm" | "reset"; email: string };

const RESEND_SECONDS = 60;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Sign in, create an account, or reset a password. After a request that needs the inbox, the form is replaced by a
 * clear "check your inbox" screen, so nobody is left looking at a filled-in form wondering whether it worked.
 */
export function AuthPanel({ initialMode, next: rawNext, initialError }: { initialMode: AuthMode; next: string | null; initialError: string | null }) {
  const next = safeNext(rawNext);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"form" | "google" | null>(null);
  const [problem, setProblem] = useState<AuthProblem | null>(initialError ? { text: initialError } : null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Keep the address bar in step with the tab, so a refresh or a shared link opens the same form.
  function switchMode(m: AuthMode) {
    setMode(m);
    setProblem(null);
    const url = new URL(window.location.href);
    if (m === "signin") url.searchParams.delete("mode");
    else url.searchParams.set("mode", m);
    window.history.replaceState(null, "", url);
  }

  const callback = (to: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(to)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    const supabase = createClient();
    const cleanEmail = email.trim().toLowerCase();

    if (mode === "signup" && passwordStrength(password).score === 0) {
      setProblem({ text: "Choose a password of at least 8 characters." });
      return;
    }

    setBusy("form");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) return setProblem(friendlyAuthError(error.message));
        // A full page load, so the header and every other part of the layout render signed in.
        window.location.assign(next);
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: callback(next),
          },
        });
        if (error) return setProblem(friendlyAuthError(error.message));
        // With email confirmation on, an address that already has an account comes back with no identities.
        if (data.user && data.user.identities?.length === 0) {
          return setProblem({ text: "An account with this email already exists.", action: "signin" });
        }
        if (data.session) {
          window.location.assign(next);
          return;
        }
        setSent({ kind: "confirm", email: cleanEmail });
        setPassword("");
        setCooldown(RESEND_SECONDS);
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: callback("/auth/reset-password"),
      });
      if (error) return setProblem(friendlyAuthError(error.message));
      setSent({ kind: "reset", email: cleanEmail });
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setProblem(friendlyAuthError((err as Error).message));
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    if (!sent || cooldown > 0) return;
    setProblem(null);
    const supabase = createClient();
    const { error } =
      sent.kind === "confirm"
        ? await supabase.auth.resend({ type: "signup", email: sent.email, options: { emailRedirectTo: callback(next) } })
        : await supabase.auth.resetPasswordForEmail(sent.email, { redirectTo: callback("/auth/reset-password") });
    if (error) setProblem(friendlyAuthError(error.message));
    else setCooldown(RESEND_SECONDS);
  }

  async function resendFromProblem() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setProblem({ text: "Enter your email above first." });
    const { error } = await createClient().auth.resend({ type: "signup", email: cleanEmail, options: { emailRedirectTo: callback(next) } });
    if (error) setProblem(friendlyAuthError(error.message));
    else {
      setSent({ kind: "confirm", email: cleanEmail });
      setCooldown(RESEND_SECONDS);
    }
  }

  async function google() {
    setProblem(null);
    setBusy("google");
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback(next) } });
    if (error) {
      setProblem(friendlyAuthError(error.message));
      setBusy(null);
    }
  }

  // ---------------------------------------------------------------------------
  // After sending an email: the form is gone, the next step is unmistakable.
  // ---------------------------------------------------------------------------
  if (sent) {
    return (
      <div className="text-center" role="status" aria-live="polite">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
          <MailCheck className="h-8 w-8" strokeWidth={1.6} />
        </div>
        <h1 className="mt-6 font-display text-[34px] leading-tight font-semibold">Check your inbox</h1>
        <p className="mt-3 text-muted">
          {sent.kind === "confirm" ? "We sent a confirmation link to" : "We sent a password reset link to"}
        </p>
        <p className="mt-1 font-medium break-all">{sent.email}</p>
        <p className="mx-auto mt-4 max-w-sm text-sm text-muted">
          {sent.kind === "confirm"
            ? "Open it on this device to finish creating your account. It can take a minute to arrive; check spam if you don't see it."
            : "Open it on this device to choose a new password. The link works once and expires after an hour."}
        </p>
        {problem && <p className="mt-4 text-sm text-danger">{problem.text}</p>}
        <div className="mt-8 grid gap-2">
          <button onClick={resend} disabled={cooldown > 0} className={btn.secondary}>
            <RotateCw className="h-4 w-4" />
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend the email"}
          </button>
          <button
            onClick={() => {
              setSent(null);
              setEmail("");
              setProblem(null);
            }}
            className={btn.ghost}
          >
            <ArrowLeft className="h-4 w-4" /> Use a different email
          </button>
          {sent.kind === "reset" && (
            <button
              onClick={() => {
                setSent(null);
                switchMode("signin");
              }}
              className={btn.ghost}
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    );
  }

  const heading = { signin: "Welcome back", signup: "Create your account", forgot: "Reset your password" }[mode];
  const sub = {
    signin: "Sign in to pick up where you left off.",
    signup: "Free to read, free to publish. Your library and progress follow you everywhere.",
    forgot: "Enter the email you signed up with and we'll send you a link to set a new password.",
  }[mode];

  return (
    <div>
      {mode !== "forgot" && (
        <div role="tablist" aria-label="Account" className="mb-8 grid grid-cols-2 rounded-xl bg-surface-2 p-1 ring-1 ring-border">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`h-10 rounded-lg text-sm font-medium transition ${
                mode === m ? "bg-surface-3 text-foreground shadow-sm ring-1 ring-border-strong" : "text-muted hover:text-foreground"
              }`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      <h1 className="font-display text-[34px] leading-tight font-semibold">{heading}</h1>
      <p className="mt-2 text-muted">{sub}</p>

      {mode !== "forgot" && (
        <>
          <button type="button" onClick={google} disabled={busy !== null} className={`${btn.secondary} mt-7 w-full`}>
            {busy === "google" ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </button>
          <div className="my-6 flex items-center gap-3 text-xs tracking-wider text-muted uppercase">
            <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={submit} className={`space-y-4 ${mode === "forgot" ? "mt-7" : ""}`} noValidate={false}>
        <div>
          <label htmlFor="email" className={label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={input}
          />
        </div>
        {mode !== "forgot" && (
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className={label}>
                Password
              </label>
              {mode === "signin" && (
                <button type="button" onClick={() => switchMode("forgot")} className="text-sm text-accent hover:underline">
                  Forgot password?
                </button>
              )}
            </div>
            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? "At least 8 characters" : undefined}
              minLength={mode === "signup" ? 8 : undefined}
            />
            {mode === "signup" && <StrengthMeter password={password} />}
          </div>
        )}

        {problem && (
          <div role="alert" className="flex gap-3 rounded-xl border border-danger/30 bg-danger/10 p-3.5 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div>
              <p>{problem.text}</p>
              {problem.action === "forgot" && (
                <button type="button" onClick={() => switchMode("forgot")} className="mt-1 font-medium text-accent hover:underline">
                  Reset your password
                </button>
              )}
              {problem.action === "signin" && (
                <button type="button" onClick={() => switchMode("signin")} className="mt-1 font-medium text-accent hover:underline">
                  Sign in instead
                </button>
              )}
              {problem.action === "resend" && (
                <button type="button" onClick={resendFromProblem} className="mt-1 font-medium text-accent hover:underline">
                  Send a new confirmation link
                </button>
              )}
            </div>
          </div>
        )}

        <button type="submit" disabled={busy !== null} className={`${btn.primary} w-full`}>
          {busy === "form" && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </button>
      </form>

      {mode === "forgot" ? (
        <button onClick={() => switchMode("signin")} className={`${btn.ghost} mt-4 w-full`}>
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </button>
      ) : mode === "signup" ? (
        <p className="mt-6 text-center text-xs text-muted">
          By creating an account you agree to the{" "}
          <Link href="/guidelines" className="underline hover:text-foreground">
            community guidelines
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
