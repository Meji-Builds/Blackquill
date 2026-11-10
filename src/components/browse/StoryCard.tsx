import Link from "next/link";
import { Cover } from "@/components/Cover";

export interface CardStory {
  id: string;
  title: string;
  cover_url: string | null;
  author_name?: string | null;
  author_username?: string | null;
  word_count?: number;
  chapter_count?: number;
  status?: string;
}

function formatWords(n: number) {
  if (n < 1000) return `${n} words`;
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k words`;
  return `${Math.round(n / 1000)}k words`;
}

/** Cover-first card for grids and rows. `subtitle` overrides the default meta line. */
export function StoryCard({ story, subtitle, href }: { story: CardStory; subtitle?: string; href?: string }) {
  const meta =
    subtitle ??
    [
      story.chapter_count !== undefined ? `${story.chapter_count} ch` : null,
      story.word_count !== undefined ? formatWords(story.word_count) : null,
      story.status === "completed" ? "Completed" : null,
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    <Link href={href ?? `/story/${story.id}`} className="group block">
      <Cover url={story.cover_url} title={story.title} className="w-full transition group-hover:opacity-90" />
      <p className="mt-2 line-clamp-2 font-serif leading-snug group-hover:text-accent">{story.title}</p>
      {(story.author_name || story.author_username) && (
        <p className="truncate text-xs text-muted">{story.author_name || `@${story.author_username}`}</p>
      )}
      {meta && <p className="text-xs text-muted">{meta}</p>}
    </Link>
  );
}

/** A titled, horizontally scrolling row of cards. Renders nothing when empty unless `empty` is given. */
export function StoryRow({
  title,
  href,
  children,
  empty,
  note,
}: {
  title: string;
  href?: string;
  children: React.ReactNode[];
  empty?: string;
  note?: string;
}) {
  if (children.length === 0 && !empty) return null;
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl">{title}</h2>
          {note && <p className="text-sm text-muted">{note}</p>}
        </div>
        {href && (
          <Link href={href} className="shrink-0 text-sm text-accent hover:underline">
            See all →
          </Link>
        )}
      </div>
      {children.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
          {children.map((c, i) => (
            <li key={i} className="w-32 shrink-0 snap-start sm:w-36">
              {c}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
