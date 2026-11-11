"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { AtSign, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { updateProfile, usernameAvailable } from "@/app/settings/actions";
import { btn, input, label, textarea } from "@/components/ui/styles";

interface Initial {
  penName: string;
  username: string;
  bio: string;
  showMature: boolean;
  isWriter: boolean;
}

export function ProfileForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  const [username, setUsername] = useState(initial.username);
  const [penName, setPenName] = useState(initial.penName);
  const [bio, setBio] = useState(initial.bio);
  const [avail, setAvail] = useState<boolean | null | "checking">(true);

  // Check a changed username after the writer pauses typing.
  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (u === initial.username) return setAvail(true);
    setAvail("checking");
    const t = setTimeout(() => usernameAvailable(u).then(setAvail), 400);
    return () => clearTimeout(t);
  }, [username, initial.username]);

  const preview = (initial.isWriter && penName.trim()) || username;

  return (
    <form action={action} className="mt-6 space-y-5">
      <div className="flex items-center gap-4 rounded-xl bg-surface-2 p-4 ring-1 ring-border">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-strong to-[#5b3fd6] font-display text-2xl font-semibold text-white">
          {preview.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-serif text-lg font-semibold">{initial.isWriter && penName.trim() ? preview : `@${username || "username"}`}</p>
          <p className="truncate text-sm text-muted">
            {initial.isWriter && penName.trim() ? `@${username || "username"}` : initial.isWriter ? "Writer" : "Reader"}
          </p>
        </div>
      </div>

      {initial.isWriter ? (
        <div>
          <label htmlFor="penName" className={label}>
            Pen name
          </label>
          <input
            id="penName"
            name="penName"
            value={penName}
            onChange={(e) => setPenName(e.target.value)}
            maxLength={60}
            placeholder={initial.username}
            className={input}
          />
          <p className="mt-1.5 text-xs text-muted">Shown on your stories and author page. Leave empty to use your username.</p>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border-strong px-4 py-3 text-sm text-muted">
          Readers are known by their username. Writing something? Start a story in the{" "}
          <Link href="/studio/new" className="font-medium text-foreground underline">
            studio
          </Link>{" "}
          and you can choose a pen name for it.
        </p>
      )}

      <div>
        <label htmlFor="username" className={label}>
          Username
        </label>
        <div className="relative">
          <AtSign className="pointer-events-none absolute top-3 left-3 h-5 w-5 text-muted" />
          <input
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            maxLength={30}
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`${input} pr-10 pl-10`}
          />
          <span className="absolute top-3 right-3" aria-live="polite">
            {avail === "checking" && <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label="Checking" />}
            {avail === true && username !== initial.username && <CheckCircle2 className="h-5 w-5 text-success" aria-label="Available" />}
            {avail === false && <XCircle className="h-5 w-5 text-danger" aria-label="Taken" />}
          </span>
        </div>
        <p className={`mt-1.5 text-xs ${avail === false || avail === null ? "text-danger" : "text-muted"}`}>
          {avail === false
            ? `@${username} is taken.`
            : avail === null
              ? "3 to 30 characters: lowercase letters, numbers and underscores."
              : username !== initial.username
                ? "Available. Your author page address will change to match."
                : "Your author page lives at /author/" + username}
        </p>
      </div>

      <div>
        <label htmlFor="bio" className={label}>
          Bio <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="A line or two about you and what you write."
          className={textarea}
        />
        <p className="mt-1.5 text-right text-xs text-muted tabular-nums">{bio.length}/1000</p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-border hover:bg-surface-2">
        <input type="checkbox" name="showMature" defaultChecked={initial.showMature} className="mt-1 h-4 w-4 accent-[var(--accent-strong)]" />
        <span>
          <span className="block text-sm font-medium">Show mature stories</span>
          <span className="block text-xs text-muted">Include stories rated Mature in browse, search and rankings.</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || avail === false || avail === null || avail === "checking"} className={btn.primary}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save profile
        </button>
        {state && !state.ok && <p className="text-sm text-danger">{state.error}</p>}
        {state?.ok && (
          <p className="inline-flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
