-- Obsidian Quill build step 9: comments, follows, notifications and writer analytics.

-- ---------------------------------------------------------------------------
-- Comments: one level of replies, same chapter, rate-limited
-- ---------------------------------------------------------------------------
create index if not exists comments_parent_idx on public.comments (parent_id);
create index if not exists comments_user_recent_idx on public.comments (user_id, created_at desc);

create or replace function public.comment_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  parent record;
begin
  new.body := trim(new.body);
  if new.parent_id is not null then
    select chapter_id, parent_id into parent from comments where id = new.parent_id;
    if parent.chapter_id is null or parent.chapter_id <> new.chapter_id then
      raise exception 'reply to a comment on the same chapter' using errcode = '22023';
    end if;
    if parent.parent_id is not null then
      raise exception 'replies can only go one level deep' using errcode = '22023';
    end if;
    new.paragraph_index := null; -- replies follow their thread
  end if;
  if (select count(*) from comments where user_id = new.user_id and created_at > now() - interval '5 minutes') >= 10 then
    raise exception 'you are commenting very quickly; wait a few minutes and try again' using errcode = '53400';
  end if;
  return new;
end;
$$;
create trigger comments_before_insert before insert on public.comments
  for each row execute function public.comment_before_insert();

-- ---------------------------------------------------------------------------
-- Follower counts (follows rows are private to their owner; counts are public)
-- ---------------------------------------------------------------------------
create or replace function public.follower_counts(p_story_id uuid default null, p_author_id uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'story', case when p_story_id is null then 0 else (select count(*) from follows where story_id = p_story_id) end,
    'author', case when p_author_id is null then 0 else (select count(*) from follows where author_id = p_author_id) end
  );
$$;
grant execute on function public.follower_counts(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create type notification_kind as enum ('new_chapter', 'comment_reply', 'story_comment', 'new_follower');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind notification_kind not null,
  actor_id uuid references public.profiles (id) on delete set null,
  story_id uuid references public.stories (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own notifications" on public.notifications for delete using (user_id = auth.uid());

-- New chapter: everyone following the story or its author hears about it, once per chapter.
create or replace function public.notify_new_chapter()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  st record;
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then return new; end if;
  select id, author_id, status into st from stories where id = new.story_id;
  if st.status = 'draft' then return new; end if;
  insert into notifications (user_id, kind, actor_id, story_id, chapter_id)
  select distinct f.user_id, 'new_chapter'::notification_kind, st.author_id, st.id, new.id
  from follows f
  where (f.story_id = st.id or f.author_id = st.author_id)
    and f.user_id <> st.author_id
    and not exists (select 1 from notifications n where n.user_id = f.user_id and n.chapter_id = new.id and n.kind = 'new_chapter');
  return new;
end;
$$;
create trigger chapters_notify_new after insert or update of status on public.chapters
  for each row execute function public.notify_new_chapter();

-- Comment: a reply notifies the parent's author; a top-level comment notifies the story's author.
create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  kind notification_kind;
  sid uuid;
begin
  select story_id into sid from chapters where id = new.chapter_id;
  if new.parent_id is not null then
    select user_id into target from comments where id = new.parent_id;
    kind := 'comment_reply';
  else
    select author_id into target from stories where id = sid;
    kind := 'story_comment';
  end if;
  if target is not null and target <> new.user_id then
    insert into notifications (user_id, kind, actor_id, story_id, chapter_id, comment_id)
    values (target, kind, new.user_id, sid, new.chapter_id, new.id);
  end if;
  return new;
end;
$$;
create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_comment();

-- Follow: the author being followed (or the story's author) hears about it.
create or replace function public.notify_follow()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if new.author_id is not null then target := new.author_id;
  else select author_id into target from stories where id = new.story_id;
  end if;
  if target is not null and target <> new.user_id then
    insert into notifications (user_id, kind, actor_id, story_id)
    values (target, 'new_follower', new.user_id, new.story_id);
  end if;
  return new;
end;
$$;
create trigger follows_notify after insert on public.follows
  for each row execute function public.notify_follow();

-- ---------------------------------------------------------------------------
-- Writer analytics (the story's author only)
-- ---------------------------------------------------------------------------
create or replace function public.story_analytics(p_story_id uuid, p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
  result jsonb;
begin
  if not public.owns_story(p_story_id) then raise exception 'not allowed' using errcode = '42501'; end if;

  with ev as (
    select * from reading_events where story_id = p_story_id and created_at >= since
  ),
  per_chapter as (
    select c.number, c.title, c.published_at,
           count(distinct e.viewer) filter (where e.event_type = 'open') as readers,
           count(distinct e.viewer) filter (where e.event_type = 'finish') as finishers
    from chapters c
    left join ev e on e.chapter_id = c.id
    where c.story_id = p_story_id and c.status = 'published'
    group by c.number, c.title, c.published_at
  ),
  daily as (
    select d::date as day, count(distinct e.viewer) as readers
    from generate_series(date_trunc('day', since), date_trunc('day', now()), interval '1 day') d
    left join ev e on date_trunc('day', e.created_at) = d and e.event_type = 'open'
    group by d order by d
  )
  select jsonb_build_object(
    'days', greatest(1, least(p_days, 365)),
    'readers', (select count(distinct viewer) from ev where event_type = 'open'),
    'opens', (select count(*) from ev where event_type = 'open'),
    'finishes', (select count(*) from ev where event_type = 'finish'),
    'returns', (select count(distinct viewer) from ev where event_type = 'return'),
    'shelf_adds', (select count(*) from ev where event_type = 'shelf_add'),
    'follows', (select count(*) from follows where story_id = p_story_id),
    'comments', (select count(*) from comments cm join chapters c on c.id = cm.chapter_id where c.story_id = p_story_id and cm.created_at >= since),
    'chapters', coalesce((select jsonb_agg(jsonb_build_object('number', number, 'title', title, 'published_at', published_at, 'readers', readers, 'finishers', finishers) order by number) from per_chapter), '[]'),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'readers', readers)) from daily), '[]'),
    'score', (select to_jsonb(sc) - 'story_id' from story_scores sc where sc.story_id = p_story_id),
    'fresh', (select jsonb_build_object('outcome', outcome, 'served', impressions_served, 'target', impressions_target, 'ends_at', ends_at) from fresh_shelf_slots where story_id = p_story_id)
  ) into result;
  return result;
end;
$$;
grant execute on function public.story_analytics(uuid, integer) to authenticated;
