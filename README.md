# Obsidian Quill

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

To open the local app from a phone or a preview link, set `NEXT_PUBLIC_SUPABASE_URL=/sb` and
`SUPABASE_INTERNAL_URL=http://127.0.0.1:54321`, rebuild, and run `npx next start -H 0.0.0.0`. The app then proxies
Supabase at `/sb`, so only the app's port needs to be reachable.

## What is in place

### Build step 5: discovery

- Reading events: the reader logs opening a chapter and finishing it (the end of the text on screen after a
  believable time, re-checked by the server); a later visit logs a return; shelf adds and follows are logged by
  database triggers. Authors' own reads never count. Signed-out readers get a random `oq_aid` cookie and count
  for half. Clients cannot insert events directly; `log_reading_event()` validates and deduplicates them.
- Depth points per reader: each chapter finished (up to 10) 1, a return 2, a shelf add 3, a follow 2; opening
  alone 0, so readers who bounce lower a story's score. Depth is a smoothed average of points per reader.
- Fresh Shelf: every new story is shown to its first 75 distinct readers within 7 days. A view counts only when
  the row is on screen, and viewers see stories they have not been shown first. When the batch or the week ends
  the story graduates (depth at least 1.5) or stops being pushed; too few readers to judge gets one more week.
  Stories that stop being pushed stay in search and genre pages and can still rise if readers find them.
- Trending (past week, recent days weigh more) and Rising (under 90 days old, depth per reader) on the home page
  and `/rankings`, which also has Most finished and a genre filter. Writers see their Fresh Shelf status in the
  studio.
- `refresh_discovery()` recomputes scores every 15 minutes with `pg_cron`. Every threshold above lives in the
  one-row `discovery_settings` table, editable by admins.

### Build step 4: search, browse and home

- `/browse`: search titles, synopses, author names and tags (full-text plus typo-tolerant title matching), with
  filters for genre, status, length, last updated and sort, an "Include mature" switch, removable filter chips,
  pagination and popular tags. Empty form fields redirect to a clean URL.
- `/genre/[slug]` and `/tag/[slug]`: the same view locked to one genre or tag; story pages link to them.
- Home page rows: Continue Reading (signed in), Fresh Shelf (stories in their first week), Recently Updated, the
  four biggest genres, and a Browse by genre list.
- Mature stories are hidden from browse and home unless "Include mature" is ticked.
- Database functions `search_stories`, `popular_tags` and `genre_counts` (migration
  `20261112000000_search_browse.sql`), all running under the caller's Row Level Security.

### Build step 3: reader

- Story page (`/story/[id]`): cover, author, status, rating, word count and reading time, genres, tags,
  synopsis, published chapters, and Start reading / Continue: Chapter N.
- Chapter reader (`/story/[id]/chapter/[n]`) with a reading settings sheet:
  - Brightness (40 to 100 percent) that dims the whole screen.
  - Background: nine presets (Midnight, Charcoal, Slate, Night blue, White, Cream, Sepia, Parchment, Sage) or any
    custom colour; text colour is picked automatically for contrast (at least 7:1 on presets, 4.5:1 on any colour).
  - Background type: plain, paper grain or linen.
  - Fonts: Classic, Literata, Merriweather, Lora, EB Garamond, System sans, Inter, Atkinson Hyperlegible and
    OpenDyslexic (self-hosted via Fontsource).
  - Text size, line spacing and page width; reset to defaults.
  - Settings live in a cookie (and localStorage), so pages render in the chosen look with no flash.
- Reading progress bar, previous/next links and arrow-key navigation. Drafts and scheduled chapters return 404.
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

- Next.js 15 + Tailwind v4 app with the dark Obsidian Quill theme, site header, home page shell.
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
4. ~~Search, genre and tag browse pages, home page rows~~
5. ~~Discovery: reading events, Fresh Shelf logic, Rising and Trending rankings~~
6. PWA and offline chapter downloads
7. Choice-point builder and inline reader experience, with pick percentages
8. Comic panel pipeline
9. Writer analytics dashboard, comments, notifications
10. Moderation tools, polish, launch prep
