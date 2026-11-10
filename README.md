# Blackquill

A global web novel and light novel platform: writers publish serialized fiction for free, and readers discover
stories through a fair, depth-based discovery system (the Fresh Shelf). Later stages add interactive choice-point
stories and AI-generated comic panels.

Stack: Next.js (App Router) + React + Tailwind CSS, Supabase (Postgres, Auth, Storage, Realtime, pg_cron), hosted on
Vercel.

## Getting started

1. Create a Supabase project.
2. Apply the schema: `supabase db push` (Supabase CLI, linked to your project), or paste
   `supabase/migrations/20261110000000_base_schema.sql` into the SQL editor.
3. In Supabase Auth, enable Email and Google providers, and add `http://localhost:3000/auth/callback` (plus your
   production URL) to the redirect allow list.
4. `cp .env.example .env.local` and fill in the project URL and anon key.
5. Enable the `pg_cron` extension (Database > Extensions) before applying the migrations, so scheduled chapters
   publish on time.
6. `npm install && npm run dev`, then open http://localhost:3000. `npm test` runs the unit tests.

## Local development with a local Supabase

With Docker running: `npx supabase start` applies the migrations to a local stack and prints the API URL and anon
key for `.env.local`. Email confirmation is off locally, so sign-up logs straight in.

## What is in place

### Build step 3: reader

- Story page (`/story/[id]`): cover, author, status, rating, word count and reading time, genres, tags,
  synopsis, published chapters, and Start reading / Continue: Chapter N.
- Chapter reader (`/story/[id]/chapter/[n]`): dark, light and sepia themes, serif or sans, six text sizes,
  three line spacings, three widths (remembered on the device), a reading progress bar, previous/next links and
  arrow-key navigation. Drafts and scheduled chapters return 404.
- Reading progress: the current chapter and scroll position are saved every few seconds and when the tab is
  hidden, and restored on any device signed into the same account.
- Library (`/library`): Reading, Plan to Read and Completed (a story sits on at most one of these), plus custom
  shelves you can create, rename and delete. Add to library from any story page; remove from a shelf in the
  library. Cards link straight to the chapter you are on.

### Build step 2: writer studio

- `/studio`: your stories with status, chapter count and published word count.
- `/studio/new` and the story page's "Story details": title, cover upload (JPG/PNG/WebP, 2 MB), synopsis,
  up to 3 genres, up to 15 tags (normalised, created on first use), content rating and status.
- Stories stay private drafts until "Publish story"; publishing starts the story's Fresh Shelf week.
- Chapter list with new chapter, move up/down, and delete (later chapters renumber).
- Chapter editor: distraction-free serif writing surface with a focus mode, live word count, autosave 1.5 s after
  typing (plus Ctrl/Cmd+S and on tab hide), a local backup offered back after a crash, retry when offline, and
  conflict detection so a stale tab never overwrites newer text.
- Publish now, schedule for a date and time, cancel a schedule, or unpublish. `pg_cron` publishes due chapters
  every minute, stamped with their scheduled time.
- Database functions `set_story_genres`, `set_story_tags`, `create_chapter`, `reorder_chapters`, `delete_chapter`
  and `publish_due_chapters` (migration `20261111000000_writer_studio.sql`); each checks story ownership.

### Build step 1: setup

- Next.js 15 + Tailwind v4 app with the dark Blackquill theme, site header, home page shell.
- Supabase browser/server clients and a middleware that refreshes sessions and guards `/studio` and `/library`.
- Email/password and Google sign-in (`/login`), OAuth/email callback (`/auth/callback`), sign-out.
- Base schema for every table in the project scope, with Row Level Security:
  - Authors edit only their own stories, chapters, choice points and comic panels.
  - Readers edit only their own shelves, progress, follows, picks and comments.
  - Draft stories and unpublished chapters are visible only to their author.
  - Profiles cannot grant themselves admin; default shelves cannot be deleted.
- Triggers: a profile and the three default shelves on sign-up; chapter word counts; story word count and
  last-updated; a Fresh Shelf slot when a story is first published.
- Postgres full-text search on story title and synopsis, plus trigram title search.
- Storage buckets: `covers` (public), `references` (private), `comic-panels` (public; written server-side).

## Build order

1. ~~Project setup, auth, base schema with RLS~~
2. ~~Writer studio basics: create a story, write and autosave chapters, publish, schedule~~
3. ~~Reader basics: story page, chapter reader with themes, progress saving, shelves~~
4. Search, genre and tag browse pages, home page rows
5. Discovery: reading events, Fresh Shelf logic, Rising and Trending rankings
6. PWA and offline chapter downloads
7. Choice-point builder and inline reader experience, with pick percentages
8. Comic panel pipeline
9. Writer analytics dashboard, comments, notifications
10. Moderation tools, polish, launch prep
