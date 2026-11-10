-- Obsidian Quill build step 2: writer studio helpers.
-- Every function checks that the caller owns the story before changing anything.

-- ---------------------------------------------------------------------------
-- Genres and tags for a story, replaced as a set
-- ---------------------------------------------------------------------------
create or replace function public.set_story_genres(p_story_id uuid, p_genre_slugs text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_story(p_story_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(array_length(p_genre_slugs, 1), 0) > 3 then
    raise exception 'a story can have at most 3 genres' using errcode = '22023';
  end if;
  delete from public.story_genres where story_id = p_story_id;
  insert into public.story_genres (story_id, genre_id)
    select p_story_id, g.id from public.genres g where g.slug = any (p_genre_slugs);
end;
$$;

-- Tag names are normalised to slugs ("Slow Burn" -> slow-burn); unknown tags are created.
create or replace function public.set_story_tags(p_story_id uuid, p_tag_names text[])
returns void language plpgsql security definer set search_path = public as $$
declare
  slugs text[];
begin
  if not public.owns_story(p_story_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct s), '{}') into slugs
  from (
    select left(trim(both '-' from regexp_replace(lower(trim(n)), '[^a-z0-9]+', '-', 'g')), 40) as s
    from unnest(coalesce(p_tag_names, '{}')) as n
  ) t
  where s <> '';

  if array_length(slugs, 1) > 15 then
    raise exception 'a story can have at most 15 tags' using errcode = '22023';
  end if;

  insert into public.tags (slug, name)
    select s, initcap(replace(s, '-', ' ')) from unnest(slugs) as s
  on conflict (slug) do nothing;

  delete from public.story_tags where story_id = p_story_id;
  insert into public.story_tags (story_id, tag_id)
    select p_story_id, t.id from public.tags t where t.slug = any (slugs);
end;
$$;

-- ---------------------------------------------------------------------------
-- Chapters: create at the end, reorder, delete with renumbering
-- ---------------------------------------------------------------------------
create or replace function public.create_chapter(p_story_id uuid, p_title text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if not public.owns_story(p_story_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- Serialise chapter creation per story so two tabs cannot take the same number.
  perform 1 from public.stories where id = p_story_id for update;
  insert into public.chapters (story_id, number, title)
  values (
    p_story_id,
    coalesce((select max(number) from public.chapters where story_id = p_story_id), 0) + 1,
    coalesce(p_title, '')
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- p_chapter_ids must list every chapter of the story exactly once, in the new order.
create or replace function public.reorder_chapters(p_story_id uuid, p_chapter_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_story(p_story_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform 1 from public.stories where id = p_story_id for update;
  if (select count(*) from public.chapters where story_id = p_story_id)
       <> coalesce(array_length(p_chapter_ids, 1), 0)
     or (select count(distinct x) from unnest(p_chapter_ids) x) <> coalesce(array_length(p_chapter_ids, 1), 0)
     or exists (select 1 from unnest(p_chapter_ids) x
                where not exists (select 1 from public.chapters c where c.id = x and c.story_id = p_story_id)) then
    raise exception 'chapter list does not match the story' using errcode = '22023';
  end if;
  -- (story_id, number) is unique deferrable initially deferred, so swaps are fine inside one statement.
  update public.chapters c set number = o.ord
  from unnest(p_chapter_ids) with ordinality as o (id, ord)
  where c.id = o.id and c.number <> o.ord;
end;
$$;

create or replace function public.delete_chapter(p_chapter_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
begin
  select story_id into sid from public.chapters where id = p_chapter_id;
  if sid is null or not public.owns_story(sid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform 1 from public.stories where id = sid for update;
  delete from public.chapters where id = p_chapter_id;
  update public.chapters c set number = r.rn
  from (select id, row_number() over (order by number) as rn from public.chapters where story_id = sid) r
  where c.id = r.id and c.number <> r.rn;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled publishing
-- ---------------------------------------------------------------------------
-- Publishing a scheduled chapter stamps it with its scheduled time, not the cron run time.
create or replace function public.chapter_before_write()
returns trigger language plpgsql as $$
begin
  new.word_count = case
    when new.body is null or trim(new.body) = '' then 0
    else coalesce(array_length(regexp_split_to_array(trim(new.body), '\s+'), 1), 0)
  end;
  if new.status = 'published' and new.published_at is null then
    new.published_at = least(now(), coalesce(new.publish_at, now()));
  end if;
  if new.status <> 'published' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

create or replace function public.publish_due_chapters()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  update public.chapters set status = 'published'
  where status = 'scheduled' and publish_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.publish_due_chapters() from public, anon, authenticated;

-- Run every minute where pg_cron is available (enable it under Database > Extensions in Supabase).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('publish-due-chapters', '* * * * *', 'select public.publish_due_chapters()');
  else
    raise notice 'pg_cron not available; schedule public.publish_due_chapters() another way';
  end if;
end;
$$;

grant execute on function public.set_story_genres(uuid, text[]) to authenticated;
grant execute on function public.set_story_tags(uuid, text[]) to authenticated;
grant execute on function public.create_chapter(uuid, text) to authenticated;
grant execute on function public.reorder_chapters(uuid, uuid[]) to authenticated;
grant execute on function public.delete_chapter(uuid) to authenticated;
