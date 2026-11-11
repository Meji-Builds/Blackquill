import Link from "next/link";
import { ChevronRight } from "lucide-react";
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

export function formatWords(n: number) {
  if (n < 1000) return `${n} words`;
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k words`;
  return `${Math.round(n / 1000)}k words`;
}

/** Cover-first card for grids and rows. `subtitle` replaces the default meta line; `progress` (0..1) adds a bar. */
export function StoryCard({
  story,
  subtitle,
  href,
  progress,
}: {
  story: CardStory;
  subtitle?: string;
  href?: string;
  progress?: number;
}) {
  const author = story.author_name || (story.author_username ? `@${story.author_username}` : null);
  const meta =
    subtitle ??
    [
      story.chapter_count !== undefined ? `${story.chapter_count} ch` : null,
      story.word_count !== undefined ? formatWords(story.word_count) : null,
      story.status === "completed" ? "Complete" : null,
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    <Link href={href ?? `/story/${story.id}`} className="group block rounded-lg">
      <div className="relative transition duration-300 group-hover:-translate-y-0.5">
        <Cover url={story.cover_url} title={story.title} author={author} className="w-full" />
        {progress !== undefined && (
          <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-black/50">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
        )}
      </div>
      <p className="mt-2.5 line-clamp-2 font-serif text-[15px] leading-snug font-semibold text-foreground group-hover:text-accent">
        {story.title}
      </p>
      {author && <p className="mt-0.5 truncate text-xs text-muted">{author}</p>}
      {meta && <p className="mt-0.5 truncate text-xs text-muted/80">{meta}</p>}
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
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-[28px] leading-tight font-semibold">{title}</h2>
          {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-sm font-medium text-accent hover:bg-accent/10"
          >
            See all <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong bg-surface/50 p-6 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children.map((c, i) => (
            <li key={i} className="w-[30vw] max-w-40 min-w-28 shrink-0 snap-start sm:w-36">
              {c}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
