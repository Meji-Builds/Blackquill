-- Obsidian Quill build step 5: discovery.
--
-- Reading events feed a per-story score that rewards depth (chapters finished, coming back, shelving,
-- following) over raw opens. New stories get a Fresh Shelf batch of readers in their first week; those
-- that hold readers graduate into Rising and Trending, the rest stay findable through search and genres.
--
-- Clients never write events directly: log_reading_event() validates and deduplicates them, and shelf adds
-- and follows are recorded by triggers. refresh_discovery() recomputes scores every 15 minutes.

-- ---------------------------------------------------------------------------
-- Tunable settings (one row)
-- ---------------------------------------------------------------------------
create table public.discovery_settings (
  id boolean primary key default true check (id),
  fresh_batch_size integer not null default 75,          -- distinct readers shown a new story
  fresh_days integer not null default 7,                 -- length of the Fresh Shelf window
  min_eval_readers numeric not null default 10,          -- readers needed to judge a story; else one extension
  graduate_min_depth numeric not null default 1.5,       -- smoothed points per reader needed to graduate
  organic_min_readers numeric not null default 25,       -- readers (30 days) that make a story eligible anyway
  rising_max_age_days integer not null default 90,
  rising_min_readers numeric not null default 5,
  trending_min_points numeric not null default 5,
  prior_weight numeric not null default 10,              -- Bayesian smoothing strength, in readers
  anon_weight numeric not null default 0.5,              -- signed-out readers count for less
  trending_half_life_hours numeric not null default 72,
  finish_wpm numeric not null default 900,               -- fastest believable reading speed for a finish
  updated_at timestamptz not null default now()
);
insert into public.discovery_settings default values;
alter table public.discovery_settings enable row level security;
create policy "settings readable" on public.discovery_settings for select using (true);
create policy "admins tune settings" on public.discovery_settings for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reading events: one viewer key for signed-in and signed-out readers; clients write only through the RPC
-- ---------------------------------------------------------------------------
alter table public.reading_events
  add column viewer text generated always as (coalesce(user_id::text, 'a:' || anon_id)) stored;
create index reading_events_viewer_idx on public.reading_events (story_id, viewer, event_type, created_at desc);
create index reading_events_recent_idx on public.reading_events (created_at desc);
drop policy if exists "log reading events" on public.reading_events;

-- ---------------------------------------------------------------------------
-- Fresh Shelf: outcome per slot, and which viewers have been shown each story
-- ---------------------------------------------------------------------------
alter table public.fresh_shelf_slots
  add column outcome text not null default 'active' check (outcome in ('active', 'graduated', 'ended')),
  add column extended boolean not null default false,
  add column evaluated_at timestamptz,
  alter column impressions_target set default 75;
update public.fresh_shelf_slots set impressions_target = 75 where outcome = 'active';
create index fresh_shelf_active_idx on public.fresh_shelf_slots (impressions_served) where outcome = 'active';

create table public.fresh_shelf_impressions (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer text not null,
  created_at timestamptz not null default now(),
  primary key (story_id, viewer)
);
alter table public.fresh_shelf_impressions enable row level security; -- no policies: functions only

-- ---------------------------------------------------------------------------
-- Scores, recomputed by refresh_discovery()
-- ---------------------------------------------------------------------------
create table public.story_scores (
  story_id uuid primary key references public.stories (id) on delete cascade,
  readers_7d numeric not null default 0,
  readers_30d numeric not null default 0,
  finishers_30d numeric not null default 0,
  returners_30d numeric not null default 0,
  shelf_adds_30d numeric not null default 0,
  points_30d numeric not null default 0,
  depth_30d numeric not null default 0,       -- smoothed points per reader
  finishers_total numeric not null default 0, -- distinct readers who finished any chapter, all time
  trending_score numeric not null default 0,
  rising_score numeric not null default 0,
  eligible boolean not null default false,    -- may appear in Rising and Trending
  computed_at timestamptz not null default now()
);
create index story_scores_trending_idx on public.story_scores (trending_score desc) where eligible;
create index story_scores_rising_idx on public.story_scores (rising_score desc) where eligible;
alter table public.story_scores enable row level security;
create policy "scores readable" on public.story_scores for select using (true);

-- ---------------------------------------------------------------------------
-- Logging
-- ---------------------------------------------------------------------------
-- p_anon is the signed-out reader's random id (a cookie); signed-in readers are identified by auth.uid().
-- Returns what was recorded, or why not.
create or replace function public.log_reading_event(
  p_story_id uuid,
  p_chapter_id uuid,
  p_type reading_event_type,
  p_anon text default null
)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  anon text := case when uid is null and p_anon ~ '^[0-9a-f-]{36}$' then lower(p_anon) end;
  who text := coalesce(uid::text, 'a:' || anon);
  st record;
  ch record;
  cfg discovery_settings;
  opened_at timestamptz;
  min_seconds numeric;
begin
  if who is null then return 'no viewer'; end if;
  if p_type not in ('open', 'finish') then return 'type not allowed'; end if; -- shelf/follow come from triggers

  select id, author_id, status into st from stories where id = p_story_id;
  if st.id is null or st.status = 'draft' then return 'story not public'; end if;
  if st.author_id = uid then return 'author'; end if;

  select id, word_count into ch from chapters
  where id = p_chapter_id and story_id = p_story_id and status = 'published';
  if ch.id is null then return 'chapter not public'; end if;

  select * into cfg from discovery_settings;

  if p_type = 'open' then
    if exists (select 1 from reading_events where story_id = p_story_id and viewer = who and chapter_id = p_chapter_id
               and event_type = 'open' and created_at > now() - interval '30 minutes') then
      return 'duplicate';
    end if;
    -- Coming back on a later visit (12 hours after any earlier activity) counts once per day.
    if exists (select 1 from reading_events where story_id = p_story_id and viewer = who
               and created_at < now() - interval '12 hours')
       and not exists (select 1 from reading_events where story_id = p_story_id and viewer = who
                       and event_type = 'return' and created_at > now() - interval '20 hours') then
      insert into reading_events (user_id, anon_id, story_id, chapter_id, event_type)
      values (uid, anon, p_story_id, p_chapter_id, 'return');
    end if;
    insert into reading_events (user_id, anon_id, story_id, chapter_id, event_type)
    values (uid, anon, p_story_id, p_chapter_id, 'open');
    return 'open';
  end if;

  -- finish: once per chapter per viewer, and only after a believable time on the page.
  if exists (select 1 from reading_events where story_id = p_story_id and viewer = who
             and chapter_id = p_chapter_id and event_type = 'finish') then
    return 'duplicate';
  end if;
  select max(created_at) into opened_at from reading_events
  where story_id = p_story_id and viewer = who and chapter_id = p_chapter_id and event_type = 'open'
    and created_at > now() - interval '1 day';
  if opened_at is null then return 'not opened'; end if;
  min_seconds := least(600, greatest(10, ch.word_count / cfg.finish_wpm * 60));
  if now() - opened_at < make_interval(secs => min_seconds) then return 'too fast'; end if;
  insert into reading_events (user_id, anon_id, story_id, chapter_id, event_type)
  values (uid, anon, p_story_id, p_chapter_id, 'finish');
  return 'finish';
end;
$$;
revoke execute on function public.log_reading_event(uuid, uuid, reading_event_type, text) from public;
grant execute on function public.log_reading_event(uuid, uuid, reading_event_type, text) to anon, authenticated;

-- Shelf adds and follows are recorded where they happen, once per reader and story.
create or replace function public.log_library_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  sid uuid;
  kind reading_event_type;
begin
  if tg_table_name = 'shelf_items' then
    select user_id into uid from shelves where id = new.shelf_id;
    sid := new.story_id;
    kind := 'shelf_add';
  else
    uid := new.user_id;
    sid := new.story_id;
    kind := 'follow';
    if sid is null then return new; end if; -- following an author, not a story
  end if;
  if exists (select 1 from stories where id = sid and (author_id = uid or status = 'draft')) then return new; end if;
  if not exists (select 1 from reading_events where story_id = sid and user_id = uid and event_type = kind) then
    insert into reading_events (user_id, story_id, event_type) values (uid, sid, kind);
  end if;
  return new;
end;
$$;
create trigger shelf_items_log_event after insert on public.shelf_items
  for each row execute function public.log_library_event();
create trigger follows_log_event after insert on public.follows
  for each row execute function public.log_library_event();

-- ---------------------------------------------------------------------------
-- Fresh Shelf serving
-- ---------------------------------------------------------------------------
-- Stories in their Fresh Shelf batch, ones this viewer has not been shown first, then the least shown.
create or replace function public.fresh_shelf_stories(
  p_anon text default null,
  p_limit integer default 12,
  p_include_mature boolean default false
)
returns table (id uuid, title text, cover_url text, word_count integer, status story_status,
               author_username text, author_name text, chapter_count integer)
language sql volatile security definer set search_path = public as $$
  with me as (
    select coalesce(auth.uid()::text, case when p_anon ~ '^[0-9a-f-]{36}$' then 'a:' || lower(p_anon) end) as who
  )
  select s.id, s.title, s.cover_url, s.word_count, s.status, p.username, p.display_name,
         (select count(*)::int from chapters c where c.story_id = s.id and c.status = 'published')
  from fresh_shelf_slots f
  join stories s on s.id = f.story_id
  join profiles p on p.id = s.author_id
  cross join me
  where f.outcome = 'active'
    and f.ends_at > now()
    and f.impressions_served < f.impressions_target
    and s.status <> 'draft'
    and s.last_chapter_at is not null
    and (p_include_mature or s.rating <> 'mature')
    and s.author_id is distinct from auth.uid()
  order by
    exists (select 1 from fresh_shelf_impressions i where i.story_id = s.id and i.viewer = me.who),
    f.impressions_served,
    random()
  limit least(greatest(coalesce(p_limit, 12), 1), 24);
$$;
grant execute on function public.fresh_shelf_stories(text, integer, boolean) to anon, authenticated;

-- Called when the Fresh Shelf row is actually on screen. Each viewer counts once per story.
create or replace function public.record_fresh_impressions(p_story_ids uuid[], p_anon text default null)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  who text := coalesce(auth.uid()::text, case when p_anon ~ '^[0-9a-f-]{36}$' then 'a:' || lower(p_anon) end);
  n integer := 0;
  sid uuid;
begin
  if who is null or p_story_ids is null then return 0; end if;
  foreach sid in array p_story_ids[1:24] loop
    if exists (select 1 from fresh_shelf_slots f join stories s on s.id = f.story_id
               where f.story_id = sid and f.outcome = 'active' and f.ends_at > now()
                 and s.author_id is distinct from auth.uid()) then
      insert into fresh_shelf_impressions (story_id, viewer) values (sid, who) on conflict do nothing;
      if found then
        update fresh_shelf_slots set impressions_served = impressions_served + 1 where story_id = sid;
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end;
$$;
grant execute on function public.record_fresh_impressions(uuid[], text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Scoring
-- ---------------------------------------------------------------------------
-- Points a reader earns for a story: each chapter finished (up to 10) 1, coming back 2, shelving 3,
-- following 2. Opening alone earns nothing, so readers who bounce lower a story's depth.
create or replace function public.refresh_discovery()
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  cfg discovery_settings;
  global_mean numeric;
begin
  select * into cfg from discovery_settings;

  if to_regclass('pg_temp.tmp_viewer') is not null then drop table tmp_viewer; end if;
  create temporary table tmp_viewer on commit drop as
  select e.story_id, e.viewer,
         max(case when e.user_id is null then cfg.anon_weight else 1 end) as w,
         bool_or(e.created_at > now() - interval '7 days') as active_7d,
         least(count(distinct e.chapter_id) filter (where e.event_type = 'finish'), 10) as finished,
         bool_or(e.event_type = 'return') as returned,
         bool_or(e.event_type = 'shelf_add') as shelved,
         bool_or(e.event_type = 'follow') as followed,
         least(16, sum(
           case when e.created_at > now() - interval '7 days' then
             power(0.5, extract(epoch from now() - e.created_at) / 3600 / cfg.trending_half_life_hours)
             * case e.event_type when 'finish' then 1 when 'return' then 2 when 'shelf_add' then 3
                                 when 'follow' then 2 else 0 end
           else 0 end)) as trend_points
  from reading_events e
  where e.created_at > now() - interval '30 days'
  group by e.story_id, e.viewer;

  select coalesce(sum(w * (finished + 2 * returned::int + 3 * shelved::int + 2 * followed::int)) / nullif(sum(w), 0), 1)
  into global_mean from tmp_viewer;

  insert into story_scores as sc (story_id, readers_7d, readers_30d, finishers_30d, returners_30d, shelf_adds_30d,
                                  points_30d, depth_30d, finishers_total, trending_score, rising_score, eligible,
                                  computed_at)
  select s.id,
         coalesce(a.readers_7d, 0), coalesce(a.readers_30d, 0), coalesce(a.finishers, 0), coalesce(a.returners, 0),
         coalesce(a.shelvers, 0), coalesce(a.points, 0),
         (coalesce(a.points, 0) + cfg.prior_weight * global_mean) / (coalesce(a.readers_30d, 0) + cfg.prior_weight),
         coalesce(t.finishers_total, 0),
         coalesce(a.trend, 0),
         0, false, now()
  from stories s
  left join (
    select story_id,
           sum(w) filter (where active_7d) as readers_7d,
           sum(w) as readers_30d,
           sum(w) filter (where finished > 0) as finishers,
           sum(w) filter (where returned) as returners,
           sum(w) filter (where shelved) as shelvers,
           sum(w * (finished + 2 * returned::int + 3 * shelved::int + 2 * followed::int)) as points,
           sum(w * trend_points) as trend
    from tmp_viewer group by story_id
  ) a on a.story_id = s.id
  left join (
    select story_id, sum(w) as finishers_total from (
      select story_id, viewer, max(case when user_id is null then cfg.anon_weight else 1 end) as w
      from reading_events where event_type = 'finish' group by story_id, viewer
    ) f group by story_id
  ) t on t.story_id = s.id
  where s.status <> 'draft'
  on conflict (story_id) do update set
    readers_7d = excluded.readers_7d, readers_30d = excluded.readers_30d, finishers_30d = excluded.finishers_30d,
    returners_30d = excluded.returners_30d, shelf_adds_30d = excluded.shelf_adds_30d,
    points_30d = excluded.points_30d, depth_30d = excluded.depth_30d, finishers_total = excluded.finishers_total,
    trending_score = excluded.trending_score, computed_at = excluded.computed_at;

  -- Close Fresh Shelf windows: a full batch or an expired week is judged on depth; a week that ended
  -- without enough readers to judge gets one more week.
  update fresh_shelf_slots f set
    ends_at = f.ends_at + make_interval(days => cfg.fresh_days),
    extended = true
  from story_scores sc
  where sc.story_id = f.story_id and f.outcome = 'active' and not f.extended
    and f.ends_at <= now() and f.impressions_served < f.impressions_target
    and sc.readers_30d < cfg.min_eval_readers;

  update fresh_shelf_slots f set
    outcome = case when sc.depth_30d >= cfg.graduate_min_depth then 'graduated' else 'ended' end,
    graduated = sc.depth_30d >= cfg.graduate_min_depth,
    score = sc.depth_30d,
    evaluated_at = now()
  from story_scores sc
  where sc.story_id = f.story_id and f.outcome = 'active'
    and (f.impressions_served >= f.impressions_target or f.ends_at <= now());

  -- Eligible for Rising and Trending: graduated, never had a Fresh Shelf slot, or later found enough readers
  -- on its own who read as deeply as a graduating story's.
  update story_scores sc set
    eligible = (f.story_id is null or f.outcome = 'graduated'
                or (sc.readers_30d >= cfg.organic_min_readers and sc.depth_30d >= cfg.graduate_min_depth)),
    rising_score = case
      when s.published_at > now() - make_interval(days => cfg.rising_max_age_days)
           and sc.readers_30d >= cfg.rising_min_readers
      then round((sc.depth_30d * ln(1 + sc.readers_7d))::numeric, 4) else 0 end,
    trending_score = case when sc.trending_score >= cfg.trending_min_points then sc.trending_score else 0 end
  from stories s
  left join fresh_shelf_slots f on f.story_id = s.id
  where s.id = sc.story_id;
end;
$$;
revoke execute on function public.refresh_discovery() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ranked lists for the home rows and the rankings page
-- ---------------------------------------------------------------------------
create or replace function public.ranked_stories(
  p_list text default 'trending',        -- trending, rising or finished
  p_genre text default null,
  p_include_mature boolean default false,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (id uuid, title text, cover_url text, synopsis text, status story_status, rating content_rating,
               word_count integer, author_username text, author_name text, chapter_count integer, genres text[],
               readers_7d numeric, finishers_total numeric, depth numeric, score numeric)
language sql stable security invoker set search_path = public as $$
  select s.id, s.title, s.cover_url, s.synopsis, s.status, s.rating, s.word_count, p.username, p.display_name,
         (select count(*)::int from chapters c where c.story_id = s.id and c.status = 'published'),
         array(select g.slug from story_genres sg join genres g on g.id = sg.genre_id
               where sg.story_id = s.id order by g.name),
         sc.readers_7d, sc.finishers_total, round(sc.depth_30d, 2),
         case p_list when 'rising' then sc.rising_score when 'finished' then sc.finishers_total
                     else sc.trending_score end
  from story_scores sc
  join stories s on s.id = sc.story_id
  join profiles p on p.id = s.author_id
  where s.status <> 'draft'
    and s.last_chapter_at is not null
    and (p_include_mature or s.rating <> 'mature')
    and (p_genre is null or exists (select 1 from story_genres sg join genres g on g.id = sg.genre_id
                                    where sg.story_id = s.id and g.slug = p_genre))
    and case p_list
          when 'rising' then sc.eligible and sc.rising_score > 0
          when 'finished' then sc.finishers_total > 0
          else sc.eligible and sc.trending_score > 0
        end
  order by 15 desc, s.last_chapter_at desc, s.id
  limit least(greatest(coalesce(p_limit, 12), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.ranked_stories(text, text, boolean, integer, integer) to anon, authenticated;

-- Every 15 minutes where pg_cron is available.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('refresh-discovery', '*/15 * * * *', 'select public.refresh_discovery()');
  end if;
end;
$$;

select public.refresh_discovery();
