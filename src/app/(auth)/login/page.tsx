import type { Metadata } from "next";
import Link from "next/link";
import { AuthPanel, type AuthMode } from "@/components/auth/AuthPanel";
import { AuthShell } from "@/components/auth/AuthShell";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<{ mode?: string; next?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const mode: AuthMode = sp.mode === "signup" || sp.mode === "forgot" ? sp.mode : "signin";

  return (
    <AuthShell>
      {isSupabaseConfigured() ? (
        <AuthPanel initialMode={mode} next={sp.next ?? null} initialError={sp.error ?? null} />
      ) : (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add your project
          keys. <Link href="/" className="text-accent underline">Home</Link>
        </p>
      )}
    </AuthShell>
  );
}
