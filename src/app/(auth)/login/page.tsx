import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-serif text-3xl">Welcome to Obsidian Quill</h1>
      <p className="mt-2 text-sm text-muted">Sign in to save your library, follow stories, and write.</p>
      {isSupabaseConfigured() ? (
        <Suspense>
          <LoginForm />
        </Suspense>
      ) : (
        <p className="mt-8 rounded-md border border-border bg-surface p-4 text-sm text-muted">
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add your project
          keys.
        </p>
      )}
    </div>
  );
}
