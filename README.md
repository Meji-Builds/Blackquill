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
5. `npm install && npm run dev`, then open http://localhost:3000.

## What is in place (build step 1)

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
2. Writer studio basics: create a story, write and autosave chapters, publish, schedule
3. Reader basics: story page, chapter reader with themes, progress saving, shelves
4. Search, genre and tag browse pages, home page rows
5. Discovery: reading events, Fresh Shelf logic, Rising and Trending rankings
6. PWA and offline chapter downloads
7. Choice-point builder and inline reader experience, with pick percentages
8. Comic panel pipeline
9. Writer analytics dashboard, comments, notifications
10. Moderation tools, polish, launch prep
