import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, BookmarkPlus, CheckCheck, MessageCircle, Repeat, TrendingDown, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { BackLink } from "@/components/ui/BackLink";
import { ChapterChart, DailyChart } from "@/components/analytics/Charts";
import { dropOff, pct, retention, settled, type ChapterStat } from "@/lib/community/analytics";

export const metadata: Metadata = { title: "Analytics" };

type Params = Promise<{ storyId: string }>;
type Search = Promise<{ days?: string }>;

interface Analytics {
  days: number;
  readers: number;
  opens: number;
  finishes: number;
  returns: number;
  shelf_adds: number;
  follows: number;
  comments: number;
  chapters: ChapterStat[];
  daily: { day: string; readers: number }[];
  score: { trending_score: number; rising_score: number; eligible: boolean; depth_30d: number } | null;
  fresh: { outcome: string; served: number; target: number; ends_at: string } | null;
}

const RANGES = [7, 30, 90] as const;

export default async function AnalyticsPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { storyId } = await params;
  const { days: daysParam } = await searchParams;
  const days = RANGES.find((d) => String(d) === daysParam) ?? 30;
  const { supabase, user } = await requireUser(`/studio/${storyId}/analytics`);
  const { data: story } = await supabase.from("stories").select("id, title, status").eq("id", storyId).eq("author_id", user.id).maybeSingle();
  if (!story) notFound();
  const { data, error } = await supabase.rpc("story_analytics", { p_story_id: storyId, p_days: days });
  if (error || !data) throw new Error(error?.message ?? "Could not load analytics.");
  const a = data as Analytics;
  const judged = settled(a.chapters);
  const drop = dropOff(judged);
  const kept = retention(judged);
  const completion = a.opens > 0 ? a.finishes / a.opens : null;

  const tiles = [
    { icon: Users, label: "Readers", value: a.readers.toLocaleString(), hint: `opened a chapter in ${days} days` },
    { icon: CheckCheck, label: "Chapter completion", value: completion === null ? "—" : pct(Math.min(1, completion)), hint: `${a.finishes.toLocaleString()} of ${a.opens.toLocaleString()} opens read to the end` },
    { icon: Repeat, label: "Returning readers", value: a.returns.toLocaleString(), hint: "came back on another day" },
    { icon: BookmarkPlus, label: "Library adds", value: a.shelf_adds.toLocaleString(), hint: `in ${days} days` },
    { icon: Bell, label: "Followers", value: a.follows.toLocaleString(), hint: "all time" },
    { icon: MessageCircle, label: "Comments", value: a.comments.toLocaleString(), hint: `in ${days} days` },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-12">
      <BackLink href={`/studio/${storyId}`}>{story.title}</BackLink>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[34px] leading-tight font-semibold sm:text-[40px]">Analytics</h1>
        <nav aria-label="Time range" className="inline-grid grid-cols-3 rounded-xl border border-border bg-surface p-1">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/studio/${storyId}/analytics?days=${d}`}
              aria-current={d === days ? "page" : undefined}
              className={`inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium ${d === days ? "bg-accent-strong text-white" : "text-muted hover:text-foreground"}`}
            >
              {d} days
            </Link>
          ))}
        </nav>
      </div>
      <p className="mt-1 text-sm text-muted">Each reader is counted once, signed in or not. Your own reading isn&apos;t counted.</p>

      <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="flex items-center gap-2 text-sm text-muted">
              <t.icon className="h-4 w-4" /> {t.label}
            </p>
            <p className="mt-2 text-[28px] leading-none font-semibold tracking-tight tabular-nums">{t.value}</p>
            <p className="mt-1.5 text-xs text-muted">{t.hint}</p>
          </li>
        ))}
      </ul>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-semibold">Readers per day</h2>
        <div className="mt-4">
          {a.readers === 0 ? <Empty /> : <DailyChart data={a.daily} />}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Chapter by chapter</h2>
            <p className="mt-0.5 text-sm text-muted">Where readers keep going and where they stop.</p>
          </div>
          {kept !== null && (
            <p className="text-sm text-muted">
              <b className="text-foreground">{pct(kept)}</b> of chapter 1&apos;s readers reached chapter {judged[judged.length - 1].number}
            </p>
          )}
        </div>
        {drop && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning/10 px-3.5 py-3 text-sm">
            <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              Most readers stop after <b>chapter {drop.number}</b>: {drop.lost} of them ({pct(drop.share)}) didn&apos;t open the next one. A
              stronger closing hook there could keep more of them.
            </span>
          </p>
        )}
        <div className="mt-4">
          {a.chapters.length === 0 ? <Empty text="Publish a chapter to see how it does." /> : <ChapterChart data={a.chapters} dropAt={drop?.number ?? null} />}
        </div>
        {a.chapters.length > 0 && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted hover:text-foreground">Show as a table</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left tabular-nums">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Chapter</th>
                    <th className="py-2 pr-3 text-right font-medium">Opened</th>
                    <th className="py-2 pr-3 text-right font-medium">Finished</th>
                    <th className="py-2 text-right font-medium">Finish rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {a.chapters.map((c) => (
                    <tr key={c.number}>
                      <td className="max-w-[12rem] truncate py-2 pr-3">
                        {c.number}. {c.title}
                      </td>
                      <td className="py-2 pr-3 text-right">{c.readers}</td>
                      <td className="py-2 pr-3 text-right">{c.finishers}</td>
                      <td className="py-2 text-right">{c.readers ? pct(Math.min(1, c.finishers / c.readers)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      {(a.fresh || a.score) && (
        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {a.fresh && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="font-semibold">Fresh Shelf</h2>
              <p className="mt-1 text-sm text-muted">
                {a.fresh.outcome === "active"
                  ? `Shown to ${a.fresh.served} of ${a.fresh.target} new readers so far.`
                  : a.fresh.outcome === "graduated"
                    ? "Graduated: readers stayed, so the story now competes in Rising and Trending."
                    : "The Fresh Shelf run has ended."}
              </p>
            </div>
          )}
          {a.score && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="font-semibold">Rankings</h2>
              <p className="mt-1 text-sm text-muted">
                {a.score.eligible
                  ? `Eligible for Rising and Trending. Reading depth ${Number(a.score.depth_30d).toFixed(1)} points per reader.`
                  : "Not in Rising or Trending yet. Rankings reward readers who keep reading, finish and return."}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Empty({ text = "No readers in this period yet." }: { text?: string }) {
  return <p className="rounded-xl border border-dashed border-border-strong py-10 text-center text-sm text-muted">{text}</p>;
}
