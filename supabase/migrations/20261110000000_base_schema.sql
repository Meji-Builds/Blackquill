-- Blackquill base schema (build step 1)
-- Tables follow section 6 of the project scope. Every table has Row Level Security:
-- authors edit only their own stories and chapters; readers edit only their own
-- shelves, progress, follows, picks and comments.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type story_status as enum ('draft', 'ongoing', 'completed', 'hiatus');
create type content_rating as enum ('everyone', 'teen', 'mature');
create type chapter_status as enum ('draft', 'scheduled', 'published');
create type panel_status as enum ('pending', 'approved', 'rejected');
create type reading_event_type as enum ('open', 'finish', 'return', 'shelf_add', 'follow');
create type report_target as enum ('story', 'chapter', 'comment', 'profile');
create type report_status as enum ('open', 'actioned', 'dismissed');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per user, reader or writer
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text,
  avatar_url text,
  bio text check (char_length(bio) <= 1000),
  is_admin boolean not null default false,
  show_mature boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- stories
-- ---------------------------------------------------------------------------
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  slug text not null,
  cover_url text,
  synopsis text not null default '' check (char_length(synopsis) <= 5000),
  status story_status not null default 'draft',
  rating content_rating not null default 'everyone',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_chapter_at timestamptz,
  word_count integer not null default 0,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(synopsis, '')), 'B')
  ) stored,
  unique (author_id, slug)
);
create index stories_search_idx on public.stories using gin (search);
create index stories_title_trgm_idx on public.stories using gin (title gin_trgm_ops);
create index stories_published_idx on public.stories (published_at desc) where status <> 'draft';
create trigger stories_updated_at before update on public.stories
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- genres and tags
-- ---------------------------------------------------------------------------
create table public.genres (
  id smallserial primary key,
  slug text unique not null,
  name text not null
);

create table public.tags (
  id serial primary key,
  slug text unique not null check (slug ~ '^[a-z0-9-]{1,40}$'),
  name text not null
);

create table public.story_genres (
  story_id uuid references public.stories (id) on delete cascade,
  genre_id smallint references public.genres (id) on delete cascade,
  primary key (story_id, genre_id)
);
create index story_genres_genre_idx on public.story_genres (genre_id);

create table public.story_tags (
  story_id uuid references public.stories (id) on delete cascade,
  tag_id integer references public.tags (id) on delete cascade,
  primary key (story_id, tag_id)
);
create index story_tags_tag_idx on public.story_tags (tag_id);

insert into public.genres (slug, name) values
  ('fantasy', 'Fantasy'),
  ('romance', 'Romance'),
  ('sci-fi', 'Sci-Fi'),
  ('action', 'Action'),
  ('mystery', 'Mystery'),
  ('horror', 'Horror'),
  ('thriller', 'Thriller'),
  ('slice-of-life', 'Slice of Life'),
  ('comedy', 'Comedy'),
  ('drama', 'Drama'),
  ('historical', 'Historical'),
  ('litrpg', 'LitRPG'),
  ('xianxia', 'Xianxia'),
  ('isekai', 'Isekai'),
  ('light-novel', 'Light Novel');

-- ---------------------------------------------------------------------------
-- chapters
-- ---------------------------------------------------------------------------
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  number integer not null check (number > 0),
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '',
  word_count integer not null default 0,
  status chapter_status not null default 'draft',
  publish_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (story_id, number) deferrable initially deferred,
  check (status <> 'scheduled' or publish_at is not null)
);
create index chapters_story_idx on public.chapters (story_id, number);
create index chapters_scheduled_idx on public.chapters (publish_at) where status = 'scheduled';
create trigger chapters_updated_at before update on public.chapters
  for each row execute function public.set_updated_at();

create or replace function public.chapter_before_write()
returns trigger language plpgsql as $$
begin
  new.word_count = coalesce(array_length(regexp_split_to_array(trim(new.body), '\s+'), 1), 0);
  if new.body is null or trim(new.body) = '' then new.word_count = 0; end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;
create trigger chapters_before_write before insert or update on public.chapters
  for each row execute function public.chapter_before_write();

-- Keep the story's word count, last-chapter time and first publish date in sync.
create or replace function public.chapter_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid := coalesce(new.story_id, old.story_id);
begin
  update public.stories s set
    word_count = coalesce((select sum(word_count) from public.chapters
                           where story_id = sid and status = 'published'), 0),
    last_chapter_at = (select max(published_at) from public.chapters
                       where story_id = sid and status = 'published'),
    published_at = case when s.status = 'draft' then s.published_at
                        else coalesce(s.published_at, (select min(published_at) from public.chapters
                                                       where story_id = sid and status = 'published')) end
  where s.id = sid;
  return null;
end;
$$;
create trigger chapters_after_write after insert or update or delete on public.chapters
  for each row execute function public.chapter_after_write();

-- When a story leaves draft with chapters already published, it is published now.
create or replace function public.story_before_update()
returns trigger language plpgsql as $$
begin
  if new.status <> 'draft' and new.published_at is null
     and exists (select 1 from public.chapters where story_id = new.id and status = 'published') then
    new.published_at = now();
  end if;
  return new;
end;
$$;
create trigger stories_before_update before update on public.stories
  for each row execute function public.story_before_update();

-- Readers see a chapter when it is published and its story is public; authors see all of theirs.
create or replace function public.can_read_chapter(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chapters c join public.stories s on s.id = c.story_id
    where c.id = cid
      and ((c.status = 'published' and s.status <> 'draft') or s.author_id = auth.uid())
  );
$$;

create or replace function public.owns_chapter(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chapters c join public.stories s on s.id = c.story_id
    where c.id = cid and s.author_id = auth.uid()
  );
$$;

create or replace function public.owns_story(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stories where id = sid and author_id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- choice points (interactive stories)
-- ---------------------------------------------------------------------------
create table public.choice_points (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null unique references public.chapters (id) on delete cascade, -- MVP: one per chapter
  anchor_position integer not null check (anchor_position >= 0), -- paragraph index in the chapter body
  prompt text not null check (char_length(prompt) between 1 and 300),
  created_at timestamptz not null default now()
);

create table public.choice_options (
  id uuid primary key default gen_random_uuid(),
  choice_point_id uuid not null references public.choice_points (id) on delete cascade,
  position smallint not null check (position between 1 and 3), -- MVP: 2 to 3 options
  label text not null check (char_length(label) between 1 and 120),
  branch_body text not null default '',
  unique (choice_point_id, position)
);

create table public.choice_picks (
  choice_option_id uuid not null references public.choice_options (id) on delete cascade,
  choice_point_id uuid not null references public.choice_points (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (choice_point_id, user_id)
);
create index choice_picks_option_idx on public.choice_picks (choice_option_id);

-- Pick percentages without exposing who picked what.
create or replace view public.choice_option_stats with (security_invoker = false) as
  select o.id as choice_option_id, o.choice_point_id, count(p.user_id)::int as picks
  from public.choice_options o left join public.choice_picks p on p.choice_option_id = o.id
  group by o.id, o.choice_point_id;

-- ---------------------------------------------------------------------------
-- comic panels
-- ---------------------------------------------------------------------------
create table public.comic_panels (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  scene_index integer not null check (scene_index >= 0),
  prompt text not null,
  style text not null default 'default',
  reference_image_url text,
  image_url text,
  status panel_status not null default 'pending',
  generation_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_id, scene_index)
);
create trigger comic_panels_updated_at before update on public.comic_panels
  for each row execute function public.set_updated_at();

-- Featured stories allowed to use the comic pipeline (MVP cost control). Admin-managed.
create table public.comic_enabled_stories (
  story_id uuid primary key references public.stories (id) on delete cascade,
  regen_cap_per_chapter integer not null default 20,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- shelves and shelf items
-- ---------------------------------------------------------------------------
create table public.shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'custom' check (kind in ('reading', 'plan_to_read', 'completed', 'custom')),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create unique index shelves_default_kind_idx on public.shelves (user_id, kind) where kind <> 'custom';

create table public.shelf_items (
  shelf_id uuid not null references public.shelves (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (shelf_id, story_id)
);
create index shelf_items_story_idx on public.shelf_items (story_id);

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  story_id uuid references public.stories (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((story_id is null) <> (author_id is null)),
  check (author_id is null or author_id <> user_id)
);
create unique index follows_story_idx on public.follows (user_id, story_id) where story_id is not null;
create unique index follows_author_idx on public.follows (user_id, author_id) where author_id is not null;

-- ---------------------------------------------------------------------------
-- reading progress
-- ---------------------------------------------------------------------------
create table public.reading_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  scroll_position real not null default 0 check (scroll_position between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  paragraph_index integer check (paragraph_index >= 0), -- null = chapter-level comment
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_chapter_idx on public.comments (chapter_id, created_at);
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reading events (discovery + analytics); write-only for clients
-- ---------------------------------------------------------------------------
create table public.reading_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  anon_id text, -- for signed-out readers
  story_id uuid not null references public.stories (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete cascade,
  event_type reading_event_type not null,
  created_at timestamptz not null default now()
);
create index reading_events_story_idx on public.reading_events (story_id, created_at desc);
create index reading_events_chapter_idx on public.reading_events (chapter_id, event_type);

-- ---------------------------------------------------------------------------
-- fresh shelf slots
-- ---------------------------------------------------------------------------
create table public.fresh_shelf_slots (
  story_id uuid primary key references public.stories (id) on delete cascade,
  impressions_target integer not null default 100,
  impressions_served integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '7 days',
  graduated boolean not null default false,
  score real
);

-- Give a story its Fresh Shelf slot the first time it is published.
create or replace function public.story_fresh_slot()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.published_at is not null and (tg_op = 'INSERT' or old.published_at is null) then
    insert into public.fresh_shelf_slots (story_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger stories_fresh_slot after insert or update on public.stories
  for each row execute function public.story_fresh_slot();

-- ---------------------------------------------------------------------------
-- reports (light moderation)
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type report_target not null,
  target_id uuid not null,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 1000),
  status report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id)
);
create index reports_open_idx on public.reports (created_at) where status = 'open';

-- ---------------------------------------------------------------------------
-- New user: profile + default shelves
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text;
  uname text;
  n int := 0;
begin
  base := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'reader'),
    '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base) < 3 then base := base || 'reader'; end if;
  base := left(base, 24);
  uname := base;
  while exists (select 1 from public.profiles where username = uname) loop
    n := n + 1;
    uname := base || n::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id, uname,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', uname),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.shelves (user_id, name, kind, position) values
    (new.id, 'Reading', 'reading', 0),
    (new.id, 'Plan to Read', 'plan_to_read', 1),
    (new.id, 'Completed', 'completed', 2);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles enable row level security;
alter table public.stories enable row level security;
alter table public.genres enable row level security;
alter table public.tags enable row level security;
alter table public.story_genres enable row level security;
alter table public.story_tags enable row level security;
alter table public.chapters enable row level security;
alter table public.choice_points enable row level security;
alter table public.choice_options enable row level security;
alter table public.choice_picks enable row level security;
alter table public.comic_panels enable row level security;
alter table public.comic_enabled_stories enable row level security;
alter table public.shelves enable row level security;
alter table public.shelf_items enable row level security;
alter table public.follows enable row level security;
alter table public.reading_progress enable row level security;
alter table public.comments enable row level security;
alter table public.reading_events enable row level security;
alter table public.fresh_shelf_slots enable row level security;
alter table public.reports enable row level security;

-- profiles: public read; users update their own row (not is_admin)
create policy "profiles are public" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));

-- stories: public once out of draft; authors manage their own
create policy "public stories are readable" on public.stories for select
  using (status <> 'draft' or author_id = auth.uid() or public.is_admin());
create policy "authors create stories" on public.stories for insert with check (author_id = auth.uid());
create policy "authors update own stories" on public.stories for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "authors delete own stories" on public.stories for delete using (author_id = auth.uid());
create policy "admins take down stories" on public.stories for update using (public.is_admin());

-- genres and tags: public read; any signed-in user may create a tag
create policy "genres are public" on public.genres for select using (true);
create policy "tags are public" on public.tags for select using (true);
create policy "signed-in users create tags" on public.tags for insert to authenticated with check (true);

create policy "story genres readable" on public.story_genres for select using (true);
create policy "authors set story genres" on public.story_genres for all
  using (public.owns_story(story_id)) with check (public.owns_story(story_id));
create policy "story tags readable" on public.story_tags for select using (true);
create policy "authors set story tags" on public.story_tags for all
  using (public.owns_story(story_id)) with check (public.owns_story(story_id));

-- chapters
create policy "readable chapters" on public.chapters for select using (
  public.owns_story(story_id)
  or (status = 'published'
      and exists (select 1 from public.stories s where s.id = story_id and s.status <> 'draft')));
create policy "authors create chapters" on public.chapters for insert with check (public.owns_story(story_id));
create policy "authors update chapters" on public.chapters for update
  using (public.owns_story(story_id)) with check (public.owns_story(story_id));
create policy "authors delete chapters" on public.chapters for delete using (public.owns_story(story_id));

-- choice points and options follow their chapter
create policy "readable choice points" on public.choice_points for select using (public.can_read_chapter(chapter_id));
create policy "authors manage choice points" on public.choice_points for all
  using (public.owns_chapter(chapter_id)) with check (public.owns_chapter(chapter_id));

create policy "readable choice options" on public.choice_options for select using (
  exists (select 1 from public.choice_points cp where cp.id = choice_point_id and public.can_read_chapter(cp.chapter_id)));
create policy "authors manage choice options" on public.choice_options for all
  using (exists (select 1 from public.choice_points cp where cp.id = choice_point_id and public.owns_chapter(cp.chapter_id)))
  with check (exists (select 1 from public.choice_points cp where cp.id = choice_point_id and public.owns_chapter(cp.chapter_id)));

-- choice picks: a reader sees and makes only their own pick; totals come from choice_option_stats
create policy "readers see own picks" on public.choice_picks for select using (user_id = auth.uid());
create policy "readers pick" on public.choice_picks for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.choice_options o
              where o.id = choice_option_id and o.choice_point_id = choice_picks.choice_point_id
                and exists (select 1 from public.choice_points cp
                            where cp.id = o.choice_point_id and public.can_read_chapter(cp.chapter_id))));

-- comic panels: readers see approved panels; authors manage theirs on enabled stories
create policy "approved panels are readable" on public.comic_panels for select using (
  (status = 'approved' and public.can_read_chapter(chapter_id)) or public.owns_chapter(chapter_id));
create policy "authors review panels" on public.comic_panels for update
  using (public.owns_chapter(chapter_id)) with check (public.owns_chapter(chapter_id));
create policy "authors delete panels" on public.comic_panels for delete using (public.owns_chapter(chapter_id));
-- Inserts and image writes go through the server-side generation function (service role).

create policy "comic-enabled list readable" on public.comic_enabled_stories for select using (true);
create policy "admins manage comic-enabled list" on public.comic_enabled_stories for all
  using (public.is_admin()) with check (public.is_admin());

-- shelves: private to their owner
create policy "own shelves" on public.shelves for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "protect default shelves" on public.shelves as restrictive for delete
  using (kind = 'custom');
create policy "own shelf items" on public.shelf_items for all
  using (exists (select 1 from public.shelves s where s.id = shelf_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.shelves s where s.id = shelf_id and s.user_id = auth.uid()));

-- follows: owner manages; authors may count followers via stats views later
create policy "own follows" on public.follows for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reading progress: private
create policy "own progress" on public.reading_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- comments
create policy "visible comments" on public.comments for select using (
  public.can_read_chapter(chapter_id) and (not is_hidden or user_id = auth.uid() or public.is_admin()));
create policy "readers comment" on public.comments for insert with check (
  user_id = auth.uid() and public.can_read_chapter(chapter_id));
create policy "edit own comments" on public.comments for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_hidden = false);
create policy "delete own comments" on public.comments for delete using (user_id = auth.uid());
create policy "admins moderate comments" on public.comments for update using (public.is_admin());

-- reading events: insert-only for clients; authors read events on their own stories
create policy "log reading events" on public.reading_events for insert with check (
  (user_id is null or user_id = auth.uid()));
create policy "authors read own story events" on public.reading_events for select using (public.owns_story(story_id));

-- fresh shelf: public read; maintained by scheduled functions (service role)
create policy "fresh shelf readable" on public.fresh_shelf_slots for select using (true);

-- reports: reporters file and see their own; admins see and resolve all
create policy "file reports" on public.reports for insert with check (reporter_id = auth.uid());
create policy "see own reports" on public.reports for select using (reporter_id = auth.uid() or public.is_admin());
create policy "admins resolve reports" on public.reports for update using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('covers', 'covers', true),
  ('references', 'references', false),
  ('comic-panels', 'comic-panels', true)
on conflict (id) do nothing;

-- Files live under "<user id>/..." so ownership is the first path segment.
create policy "public read covers" on storage.objects for select using (bucket_id = 'covers');
create policy "users upload own covers" on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users replace own covers" on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own covers" on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users manage own references" on storage.objects for all to authenticated
  using (bucket_id = 'references' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'references' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "public read comic panels" on storage.objects for select using (bucket_id = 'comic-panels');
