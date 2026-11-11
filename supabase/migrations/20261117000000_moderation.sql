-- Obsidian Quill build step 10: moderation, takedowns, featured (comic) stories and rate limits.

-- ---------------------------------------------------------------------------
-- Takedowns: a removed story disappears for everyone but its author (who sees why) and admins.
-- ---------------------------------------------------------------------------
alter table public.stories
  add column removed_at timestamptz,
  add column removed_reason text check (char_length(removed_reason) <= 500);

drop policy "public stories are readable" on public.stories;
create policy "public stories are readable" on public.stories for select
  using ((status <> 'draft' and removed_at is null) or author_id = auth.uid() or public.is_admin());

create or replace function public.can_read_chapter(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chapters c join public.stories s on s.id = c.story_id
    where c.id = cid
      and ((c.status = 'published' and s.status <> 'draft' and s.removed_at is null) or s.author_id = auth.uid())
  );
$$;

-- Only admins change moderation fields; a hidden comment stays hidden and can't be edited by its writer.
create or replace function public.moderation_guard()
returns trigger language plpgsql as $$
begin
  if public.is_admin() or auth.uid() is null then return new; end if; -- admins, and server jobs
  if tg_table_name = 'stories' then
    if new.removed_at is distinct from old.removed_at or new.removed_reason is distinct from old.removed_reason then
      raise exception 'only moderators can change a takedown' using errcode = '42501';
    end if;
  elsif tg_table_name = 'comments' then
    if new.is_hidden is distinct from old.is_hidden then
      raise exception 'only moderators can hide or restore comments' using errcode = '42501';
    end if;
    if old.is_hidden then
      raise exception 'this comment was hidden by moderators and can no longer be edited' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger stories_moderation_guard before update on public.stories
  for each row execute function public.moderation_guard();
create trigger comments_moderation_guard before update on public.comments
  for each row execute function public.moderation_guard();

-- The writer's own comment edit policy required is_hidden = false; the guard covers that now.
drop policy "edit own comments" on public.comments;
create policy "edit own comments" on public.comments for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reports: one open report per person per target, and at most 20 a day.
-- ---------------------------------------------------------------------------
create unique index reports_one_open_idx on public.reports (reporter_id, target_type, target_id) where status = 'open';
alter table public.reports add column note text check (char_length(note) <= 1000);

create or replace function public.report_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'you are reporting very quickly; try again tomorrow' using errcode = '53400';
  end if;
  new.status := 'open';
  new.resolved_at := null;
  new.resolved_by := null;
  return new;
end;
$$;
create trigger reports_before_insert before insert on public.reports
  for each row execute function public.report_before_insert();

-- The moderation queue: open reports grouped by target, with what each target is.
create or replace function public.moderation_queue(p_status report_status default 'open')
returns table (
  target_type report_target,
  target_id uuid,
  reports bigint,
  reasons text[],
  first_at timestamptz,
  last_at timestamptz,
  title text,
  excerpt text,
  href text,
  owner_username text,
  is_removed boolean
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  with g as (
    select r.target_type, r.target_id, count(*) as n, array_agg(r.reason order by r.created_at) as reasons,
           min(r.created_at) as first_at, max(r.created_at) as last_at
    from reports r where r.status = p_status
    group by r.target_type, r.target_id
  )
  select g.target_type, g.target_id, g.n, g.reasons, g.first_at, g.last_at,
    case g.target_type
      when 'story' then (select s.title from stories s where s.id = g.target_id)
      when 'chapter' then (select s.title || ' · Chapter ' || c.number from chapters c join stories s on s.id = c.story_id where c.id = g.target_id)
      when 'comment' then (select 'Comment on ' || s.title || ' · Chapter ' || c.number from comments cm join chapters c on c.id = cm.chapter_id join stories s on s.id = c.story_id where cm.id = g.target_id)
      when 'profile' then (select coalesce(p.display_name, p.username) from profiles p where p.id = g.target_id)
    end,
    case g.target_type
      when 'story' then (select left(s.synopsis, 280) from stories s where s.id = g.target_id)
      when 'chapter' then (select left(c.body, 280) from chapters c where c.id = g.target_id)
      when 'comment' then (select left(cm.body, 280) from comments cm where cm.id = g.target_id)
      when 'profile' then (select left(p.bio, 280) from profiles p where p.id = g.target_id)
    end,
    case g.target_type
      when 'story' then '/story/' || g.target_id
      when 'chapter' then (select '/story/' || c.story_id || '/chapter/' || c.number from chapters c where c.id = g.target_id)
      when 'comment' then (select '/story/' || c.story_id || '/chapter/' || c.number || '#comments' from comments cm join chapters c on c.id = cm.chapter_id where cm.id = g.target_id)
      when 'profile' then (select '/author/' || p.username from profiles p where p.id = g.target_id)
    end,
    case g.target_type
      when 'story' then (select p.username from stories s join profiles p on p.id = s.author_id where s.id = g.target_id)
      when 'chapter' then (select p.username from chapters c join stories s on s.id = c.story_id join profiles p on p.id = s.author_id where c.id = g.target_id)
      when 'comment' then (select p.username from comments cm join profiles p on p.id = cm.user_id where cm.id = g.target_id)
      when 'profile' then (select p.username from profiles p where p.id = g.target_id)
    end,
    case g.target_type
      when 'story' then (select s.removed_at is not null from stories s where s.id = g.target_id)
      when 'chapter' then (select s.removed_at is not null from chapters c join stories s on s.id = c.story_id where c.id = g.target_id)
      when 'comment' then (select cm.is_hidden from comments cm where cm.id = g.target_id)
      else false
    end
  from g
  order by g.n desc, g.first_at;
end;
$$;

-- Act on every open report about one target.
--   dismiss: nothing wrong.   remove: take the story down (story or chapter) or hide the comment.   restore: undo a removal.
create or replace function public.resolve_reports(p_target_type report_target, p_target_id uuid, p_action text, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
  n integer;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_action not in ('dismiss', 'remove', 'restore') then raise exception 'unknown action' using errcode = '22023'; end if;

  if p_action in ('remove', 'restore') then
    if p_target_type = 'comment' then
      update comments set is_hidden = (p_action = 'remove') where id = p_target_id;
    elsif p_target_type in ('story', 'chapter') then
      sid := case when p_target_type = 'story' then p_target_id else (select story_id from chapters where id = p_target_id) end;
      update stories set
        removed_at = case when p_action = 'remove' then now() end,
        removed_reason = case when p_action = 'remove' then left(coalesce(nullif(trim(p_note), ''), 'Breaks the community guidelines'), 500) end
      where id = sid;
      if p_action = 'remove' then
        update fresh_shelf_slots set outcome = 'ended', evaluated_at = now() where story_id = sid and outcome = 'active';
        delete from story_scores where story_id = sid;
      end if;
    elsif p_action = 'remove' then
      raise exception 'profiles cannot be removed here; dismiss or edit the profile instead' using errcode = '22023';
    end if;
  end if;

  update reports set status = case when p_action = 'dismiss' then 'dismissed'::report_status else 'actioned'::report_status end,
                     resolved_at = now(), resolved_by = auth.uid(), note = left(p_note, 1000)
  where target_type = p_target_type and target_id = p_target_id and status = 'open';
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.moderation_queue(report_status) to authenticated;
grant execute on function public.resolve_reports(report_target, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Rate limits on writing: new stories and published chapters.
-- ---------------------------------------------------------------------------
create or replace function public.story_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- seeds and SQL editor
  if (select count(*) from stories where author_id = new.author_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'you have started 10 stories today; try again tomorrow' using errcode = '53400';
  end if;
  return new;
end;
$$;
create trigger stories_rate_limit before insert on public.stories
  for each row execute function public.story_rate_limit();

create or replace function public.chapter_publish_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- the scheduled publisher and seeds
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    if (select count(*) from chapters c join stories s on s.id = c.story_id
        where s.author_id = auth.uid() and c.status = 'published' and c.published_at > now() - interval '1 hour') >= 30 then
      raise exception 'you have published 30 chapters in the last hour; schedule the rest instead' using errcode = '53400';
    end if;
  end if;
  return new;
end;
$$;
create trigger chapters_publish_rate_limit before insert or update of status on public.chapters
  for each row execute function public.chapter_publish_rate_limit();

-- Comic generations: on top of each chapter's cap, at most 60 per writer per day.
create table public.comic_generation_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  panel_id uuid references public.comic_panels (id) on delete set null,
  created_at timestamptz not null default now()
);
create index comic_generation_log_user_idx on public.comic_generation_log (user_id, created_at desc);
alter table public.comic_generation_log enable row level security;
create policy "own generation log" on public.comic_generation_log for select using (user_id = auth.uid());

create or replace function public.begin_panel_generation(p_panel_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  p record;
  cap integer;
  used integer;
begin
  select cp.id, cp.chapter_id into p from comic_panels cp where cp.id = p_panel_id for update;
  if p.id is null or not public.owns_chapter(p.chapter_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  select ce.regen_cap_per_chapter into cap
  from chapters c join comic_enabled_stories ce on ce.story_id = c.story_id where c.id = p.chapter_id;
  if cap is null then raise exception 'comic panels are available for featured stories only' using errcode = '42501'; end if;
  if (select count(*) from comic_generation_log where user_id = auth.uid() and created_at > now() - interval '1 day') >= 60 then
    raise exception 'you have generated 60 panels today; try again tomorrow' using errcode = '53400';
  end if;
  perform 1 from chapters where id = p.chapter_id for update;
  select coalesce(sum(generation_count), 0) into used from comic_panels where chapter_id = p.chapter_id;
  if used >= cap then
    raise exception 'this chapter has used all % generations', cap using errcode = '53400';
  end if;
  perform set_config('oq.panel_image', 'on', true);
  update comic_panels set generation_count = generation_count + 1, error = null where id = p_panel_id;
  perform set_config('oq.panel_image', 'off', true);
  insert into comic_generation_log (user_id, panel_id) values (auth.uid(), p_panel_id);
  return cap - used - 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Featured (comic-enabled) stories, managed by admins.
-- ---------------------------------------------------------------------------
create or replace function public.set_comic_enabled(p_story_id uuid, p_enabled boolean, p_cap integer default 6)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_enabled then
    insert into comic_enabled_stories (story_id, regen_cap_per_chapter)
    values (p_story_id, greatest(1, least(coalesce(p_cap, 6), 50)))
    on conflict (story_id) do update set regen_cap_per_chapter = excluded.regen_cap_per_chapter;
  else
    delete from comic_enabled_stories where story_id = p_story_id;
  end if;
end;
$$;
grant execute on function public.set_comic_enabled(uuid, boolean, integer) to authenticated;
