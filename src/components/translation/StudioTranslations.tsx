import Link from "next/link";
import { Languages } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { languageLabel } from "@/lib/translation/languages";
import { TranslatorAnswer } from "./TranslatorAnswer";
import { InviteTranslator } from "./InviteTranslator";

interface Row {
  user_id: string;
  language: string;
  status: "requested" | "invited" | "approved" | "declined";
  message: string | null;
  created_at: string;
  profiles: { username: string; display_name: string | null } | null;
}

/** The writer's view of who translates their story, requests to answer, and progress per language. */
export async function StudioTranslations({
  supabase,
  story,
  publishedChapterIds,
}: {
  supabase: SupabaseClient;
  story: { id: string; language: string; allow_community_translation: boolean; allow_machine_translation: boolean };
  publishedChapterIds: string[];
}) {
  const [{ data }, { data: done }] = await Promise.all([
    supabase
      .from("story_translators")
      .select("user_id, language, status, message, created_at, profiles(username, display_name)")
      .eq("story_id", story.id)
      .order("created_at", { ascending: false }),
    publishedChapterIds.length
      ? supabase.from("chapter_translations").select("language, kind, published").in("chapter_id", publishedChapterIds).eq("published", true)
      : Promise.resolve({ data: [] as { language: string; kind: string; published: boolean }[] }),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const name = (r: Row) => r.profiles?.display_name || r.profiles?.username || "Someone";
  const requests = rows.filter((r) => r.status === "requested");
  const team = rows.filter((r) => r.status === "approved");
  const invited = rows.filter((r) => r.status === "invited");
  const perLang = new Map<string, number>();
  for (const t of done ?? []) if (t.kind === "community") perLang.set(t.language, (perLang.get(t.language) ?? 0) + 1);
  const machineLangs = new Set((done ?? []).filter((t) => t.kind === "machine").map((t) => t.language));

  return (
    <section className="mt-10 rounded-2xl border border-border bg-surface p-5 sm:p-6" id="translations">
      <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
        <Languages className="h-5 w-5 text-accent" /> Translations
      </h2>
      <p className="mt-1 text-sm text-muted">
        Written in {languageLabel(story.language)}.{" "}
        {story.allow_machine_translation ? "Readers may machine-translate it." : "Machine translation is off."}{" "}
        {story.allow_community_translation ? "Volunteer translators are welcome." : "Volunteer translations are off."} Change this in Story details.
      </p>

      {story.allow_community_translation && (
        <>
          {requests.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Requests</h3>
              <ul className="mt-2 space-y-2">
                {requests.map((r) => (
                  <li key={`${r.user_id}:${r.language}`} className="rounded-xl border border-accent/30 bg-accent/[0.06] p-3.5">
                    <p className="text-sm">
                      <Link href={`/author/${r.profiles?.username}`} className="font-semibold hover:underline">{name(r)}</Link> offers to translate it into{" "}
                      <b>{languageLabel(r.language)}</b>.
                    </p>
                    {r.message && <p className="mt-1.5 rounded-lg bg-background px-3 py-2 text-sm text-muted italic">“{r.message}”</p>}
                    <div className="mt-2.5">
                      <TranslatorAnswer storyId={story.id} userId={r.user_id} language={r.language} mode="answer-request" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5">
            <h3 className="text-sm font-semibold">Translators</h3>
            {team.length === 0 && invited.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No translators yet. Readers can offer from your story page, or invite someone below.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                {team.map((r) => (
                  <li key={`${r.user_id}:${r.language}`} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                    <span className="min-w-0 flex-1 text-sm">
                      <Link href={`/author/${r.profiles?.username}`} className="font-medium hover:underline">{name(r)}</Link>
                      <span className="text-muted"> · {languageLabel(r.language)} · {perLang.get(r.language) ?? 0} of {publishedChapterIds.length} chapters</span>
                    </span>
                    <TranslatorAnswer storyId={story.id} userId={r.user_id} language={r.language} mode="remove" />
                  </li>
                ))}
                {invited.map((r) => (
                  <li key={`${r.user_id}:${r.language}`} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                    <span className="min-w-0 flex-1 text-sm">
                      {name(r)} <span className="text-muted">· {languageLabel(r.language)} · invited, waiting for an answer</span>
                    </span>
                    <TranslatorAnswer storyId={story.id} userId={r.user_id} language={r.language} mode="cancel-invite" />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold">Invite a translator</h3>
            <InviteTranslator storyId={story.id} original={story.language} />
          </div>
        </>
      )}
      {machineLangs.size > 0 && (
        <p className="mt-5 text-xs text-muted">
          Machine-translated so far into: {[...machineLangs].map((l) => languageLabel(l)).join(", ")}.
        </p>
      )}
    </section>
  );
}
