import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Languages, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { PicturePicker } from "@/components/settings/PicturePicker";
import { ChangePassword } from "@/components/settings/ChangePassword";
import { btn, card } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Profile and settings" };

export default async function SettingsPage() {
  const { supabase, user } = await requireUser("/settings");
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, show_mature, created_at, avatar_url")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  const { count: stories } = await supabase.from("stories").select("id", { count: "exact", head: true }).eq("author_id", user.id);
  const isWriter = (stories ?? 0) > 0;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-12 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Your account</p>
          <h1 className="mt-1 font-display text-[38px] leading-tight font-semibold">Profile and settings</h1>
        </div>
        <Link href={`/author/${profile.username}`} className={btn.small}>
          <ExternalLink className="h-4 w-4" /> {isWriter ? "View your author page" : "View your profile"}
        </Link>
      </div>

      <section className={`${card} mt-8 p-5 sm:p-6`}>
        <h2 className="font-display text-2xl font-semibold">Profile</h2>
        <p className="mt-1 text-sm text-muted">
          {isWriter ? "How readers see you on your stories and author page." : "How others see you in comments and on your profile."}
        </p>
        <PicturePicker url={profile.avatar_url} name={profile.display_name || profile.username} username={profile.username} />
        <ProfileForm
          initial={{
            penName: profile.display_name ?? "",
            username: profile.username,
            bio: profile.bio ?? "",
            showMature: profile.show_mature,
            isWriter,
            avatarUrl: profile.avatar_url,
          }}
        />
      </section>

      <section className={`${card} mt-6 p-5 sm:p-6`}>
        <h2 className="font-display text-2xl font-semibold">Translating</h2>
        <p className="mt-1 text-sm text-muted">
          Speak more than one language? Volunteer to translate stories for readers who can&apos;t read the original. Set your languages and
          follow your translations at the translation desk.
        </p>
        <Link href="/translate" className={`${btn.small} mt-4`}>
          <Languages className="h-4 w-4" /> Open the translation desk
        </Link>
      </section>

      <section className={`${card} mt-6 p-5 sm:p-6`}>
        <h2 className="font-display text-2xl font-semibold">Account</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Email</dt>
          <dd className="min-w-0 break-all">{user.email}</dd>
          <dt className="text-muted">Member since</dt>
          <dd>{new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</dd>
        </dl>
        <ChangePassword />
        <form action="/auth/signout" method="post" className="mt-6 border-t border-border pt-5">
          <button className={btn.secondary}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
