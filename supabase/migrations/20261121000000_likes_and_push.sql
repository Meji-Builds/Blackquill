-- Likes on chapters and comments, and notifications on the phone (Web Push) even when the app is closed.
--   * chapter_likes / comment_likes: one heart per person per chapter or comment. Liking notifies the writer of the
--     chapter or comment, once per person (unliking and liking again doesn't notify twice).
--   * push_subscriptions: the devices each person turned notifications on for.
--   * profiles.push_prefs: which kinds of alerts reach the phone ({"likes": false} turns likes off; missing = on).
--   * Every new notification is pushed: a trigger asks the app (/api/push) to send what's waiting, through pg_net.
--     The app claims rows with claim_push_batch() so each notification is pushed at most once.

-- ---------------------------------------------------------------------------
-- Likes
-- ---------------------------------------------------------------------------
create table if not exists public.chapter_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chapter_id, user_id)
);
create index if not exists chapter_likes_user_idx on public.chapter_likes (user_id);

create table if not exists public.comment_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists comment_likes_user_idx on public.comment_likes (user_id);

alter table public.chapter_likes enable row level security;
alter table public.comment_likes enable row level security;

drop policy if exists "chapter likes are public" on public.chapter_likes;
drop policy if exists "like chapters" on public.chapter_likes;
drop policy if exists "unlike chapters" on public.chapter_likes;
create policy "chapter likes are public" on public.chapter_likes for select using (public.can_read_chapter(chapter_id));
create policy "like chapters" on public.chapter_likes for insert with check (user_id = auth.uid() and public.can_read_chapter(chapter_id));
create policy "unlike chapters" on public.chapter_likes for delete using (user_id = auth.uid());

drop policy if exists "comment likes are public" on public.comment_likes;
drop policy if exists "like comments" on public.comment_likes;
drop policy if exists "unlike comments" on public.comment_likes;
create policy "comment likes are public" on public.comment_likes for select
  using (exists (select 1 from comments c where c.id = comment_id));
create policy "like comments" on public.comment_likes for insert
  with check (user_id = auth.uid() and exists (select 1 from comments c where c.id = comment_id and not c.is_hidden));
create policy "unlike comments" on public.comment_likes for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Like notifications
-- ---------------------------------------------------------------------------
alter type notification_kind add value if not exists 'chapter_like';
alter type notification_kind add value if not exists 'comment_like';

create or replace function public.notify_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  sid uuid;
  cid uuid;
  k notification_kind;
begin
  if tg_table_name = 'chapter_likes' then
    select s.author_id, s.id into target, sid from chapters c join stories s on s.id = c.story_id where c.id = new.chapter_id;
    cid := new.chapter_id;
    k := 'chapter_like';
    if target is null or target = new.user_id then return new; end if;
    insert into notifications (user_id, kind, actor_id, story_id, chapter_id)
    select target, k, new.user_id, sid, cid
    where not exists (select 1 from notifications n where n.user_id = target and n.kind = k and n.actor_id = new.user_id and n.chapter_id = cid);
  else
    select cm.user_id, c.story_id, c.id into target, sid, cid
    from comments cm join chapters c on c.id = cm.chapter_id where cm.id = new.comment_id;
    k := 'comment_like';
    if target is null or target = new.user_id then return new; end if;
    insert into notifications (user_id, kind, actor_id, story_id, chapter_id, comment_id)
    select target, k, new.user_id, sid, cid, new.comment_id
    where not exists (select 1 from notifications n where n.user_id = target and n.kind = k and n.actor_id = new.user_id and n.comment_id = new.comment_id);
  end if;
  return new;
end;
$$;
drop trigger if exists chapter_likes_notify on public.chapter_likes;
create trigger chapter_likes_notify after insert on public.chapter_likes for each row execute function public.notify_like();
drop trigger if exists comment_likes_notify on public.comment_likes;
create trigger comment_likes_notify after insert on public.comment_likes for each row execute function public.notify_like();

-- ---------------------------------------------------------------------------
-- Devices and preferences
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own devices" on public.push_subscriptions;
drop policy if exists "remove own devices" on public.push_subscriptions;
create policy "own devices" on public.push_subscriptions for select using (user_id = auth.uid());
create policy "remove own devices" on public.push_subscriptions for delete using (user_id = auth.uid());

-- Save this device for the signed-in person. A device that was signed in as someone else moves over.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if (select count(*) from push_subscriptions where user_id = auth.uid() and endpoint <> p_endpoint) >= 10 then
    -- Forget the oldest device rather than refuse: people replace phones and reinstall browsers.
    delete from push_subscriptions where id = (select id from push_subscriptions where user_id = auth.uid() order by created_at limit 1);
  end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;
revoke all on function public.save_push_subscription(text, text, text) from public;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

alter table public.profiles add column if not exists push_prefs jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Delivery
-- ---------------------------------------------------------------------------
alter table public.notifications add column if not exists pushed_at timestamptz;
update public.notifications set pushed_at = coalesce(pushed_at, created_at); -- don't push the backlog
create index if not exists notifications_push_idx on public.notifications (created_at) where pushed_at is null;

-- Which preference a kind of notification belongs to.
create or replace function public.push_group(k notification_kind)
returns text language sql immutable as $$
  select case
    when k::text = 'new_chapter' then 'chapters'
    when k::text in ('comment_reply', 'story_comment') then 'comments'
    when k::text in ('chapter_like', 'comment_like') then 'likes'
    when k::text = 'new_follower' then 'followers'
    else 'translations'
  end;
$$;

-- Take up to p_limit notifications that haven't been pushed, marking them pushed, and return what the app needs to
-- write the alert. Only for people with a device and that kind of alert turned on; the rest are marked and skipped.
create or replace function public.claim_push_batch(p_limit integer default 200)
returns table (
  id uuid,
  user_id uuid,
  kind text,
  created_at timestamptz,
  actor_name text,
  actor_username text,
  actor_avatar text,
  story_id uuid,
  story_title text,
  story_cover text,
  chapter_number integer,
  chapter_title text,
  comment_id uuid,
  comment_body text,
  language text,
  others integer
) language plpgsql security definer set search_path = public as $$
begin
  return query
  with picked as (
    select n.id from notifications n
    where n.pushed_at is null
    order by n.created_at
    limit p_limit
    for update skip locked
  ), marked as (
    update notifications n set pushed_at = now() from picked where n.id = picked.id
    returning n.*
  )
  select m.id, m.user_id, m.kind::text, m.created_at,
    coalesce(a.display_name, a.username), a.username, a.avatar_url,
    s.id, s.title, s.cover_url, c.number, c.title, cm.id, left(cm.body, 300), m.language,
    case m.kind::text
      when 'chapter_like' then (select count(*)::integer - 1 from chapter_likes l where l.chapter_id = m.chapter_id)
      when 'comment_like' then (select count(*)::integer - 1 from comment_likes l where l.comment_id = m.comment_id)
      else 0
    end
  from marked m
  join profiles p on p.id = m.user_id
  left join profiles a on a.id = m.actor_id
  left join stories s on s.id = m.story_id
  left join chapters c on c.id = m.chapter_id
  left join comments cm on cm.id = m.comment_id
  where m.created_at > now() - interval '1 day' -- anything older is stale news
    and coalesce((p.push_prefs ->> public.push_group(m.kind))::boolean, true)
    and exists (select 1 from push_subscriptions ps where ps.user_id = m.user_id);
end;
$$;
revoke all on function public.claim_push_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer) to service_role;

-- Where the app listens. Change it with: update private_push_settings set endpoint = 'https://…/api/push';
create table if not exists public.private_push_settings (
  id boolean primary key default true check (id),
  endpoint text
);
alter table public.private_push_settings enable row level security; -- no policies: nobody outside SQL reads it
insert into public.private_push_settings (endpoint) values ('https://obsidianquill.vercel.app/api/push')
on conflict (id) do nothing;

do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net is not available (%); turn it on under Database > Extensions to send phone notifications', sqlerrm;
end $$;

-- After any statement that adds notifications, ask the app to send them. pg_net sends the request after the
-- transaction commits and never blocks or fails the insert.
create or replace function public.kick_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  url text;
begin
  select endpoint into url from private_push_settings;
  if url is null or url = '' then return null; end if;
  begin
    execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := ''{"Content-Type":"application/json"}''::jsonb, timeout_milliseconds := 5000)'
    using url;
  exception when others then
    null; -- pg_net missing or the queue is full: the next notification or the app will pick these up
  end;
  return null;
end;
$$;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
  for each statement execute function public.kick_push();
