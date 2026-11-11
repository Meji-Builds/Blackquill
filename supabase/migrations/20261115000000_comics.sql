-- Obsidian Quill build step 8: comic panels.
-- Writers of featured (comic-enabled) stories split a chapter into scenes, edit each scene's prompt, generate one
-- panel per scene and approve each before readers see it. Generations are capped per chapter to control cost.
-- Images can only be attached through record_panel_image(), after begin_panel_generation() has spent from the cap.

alter table public.comic_panels
  add column caption text not null default '',
  add column error text,
  add column generated_at timestamptz;

alter table public.comic_panels drop constraint if exists comic_panels_chapter_id_scene_index_key;
alter table public.comic_panels add constraint comic_panels_chapter_scene_key unique (chapter_id, scene_index) deferrable initially deferred;

-- Approval needs an image; image changes need the generation path.
create or replace function public.comic_panel_guard()
returns trigger language plpgsql as $$
begin
  if new.image_url is distinct from old.image_url and coalesce(current_setting('oq.panel_image', true), '') <> 'on' then
    raise exception 'panel images can only be set by generation' using errcode = '42501';
  end if;
  if new.generation_count <> old.generation_count and coalesce(current_setting('oq.panel_image', true), '') <> 'on' then
    raise exception 'generation count is managed by the server' using errcode = '42501';
  end if;
  if new.status = 'approved' and new.image_url is null then
    raise exception 'generate the panel before approving it' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger comic_panels_guard before update on public.comic_panels
  for each row execute function public.comic_panel_guard();

-- Generations used and allowed for a chapter.
create or replace function public.comic_budget(p_chapter_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', ce.story_id is not null,
    'cap', coalesce(ce.regen_cap_per_chapter, 0),
    'used', coalesce((select sum(generation_count) from comic_panels where chapter_id = p_chapter_id), 0)
  )
  from chapters c
  left join comic_enabled_stories ce on ce.story_id = c.story_id
  where c.id = p_chapter_id and public.owns_chapter(p_chapter_id);
$$;

-- Replace a chapter's panels with new scenes: [{"prompt": "...", "caption": "..."}, ...] (1 to 12).
create or replace function public.prepare_comic_scenes(p_chapter_id uuid, p_scenes jsonb, p_style text default 'webtoon')
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer := coalesce(jsonb_array_length(p_scenes), 0);
  i integer;
  prior_used integer;
begin
  if not public.owns_chapter(p_chapter_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from chapters c join comic_enabled_stories ce on ce.story_id = c.story_id where c.id = p_chapter_id) then
    raise exception 'comic panels are available for featured stories only' using errcode = '42501';
  end if;
  if n not between 1 and 12 then raise exception 'a chapter can have 1 to 12 scenes' using errcode = '22023'; end if;

  -- Keep the chapter's generation history (it counts toward the cap) by carrying it onto the first new panel.
  perform set_config('oq.panel_image', 'on', true);
  select coalesce(sum(generation_count), 0) into prior_used from comic_panels where chapter_id = p_chapter_id;
  delete from comic_panels where chapter_id = p_chapter_id;
  for i in 0 .. n - 1 loop
    insert into comic_panels (chapter_id, scene_index, prompt, caption, style, generation_count)
    values (
      p_chapter_id, i,
      left(trim(coalesce(p_scenes -> i ->> 'prompt', '')), 1000),
      left(trim(coalesce(p_scenes -> i ->> 'caption', '')), 300),
      coalesce(nullif(p_style, ''), 'webtoon'),
      case when i = 0 then prior_used else 0 end
    );
  end loop;
  perform set_config('oq.panel_image', 'off', true);
  return n;
end;
$$;

-- Spend one generation from the chapter's budget. Returns the remaining budget, or raises when it is used up.
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
  -- Serialise generations per chapter so two tabs cannot overspend.
  perform 1 from chapters where id = p.chapter_id for update;
  select coalesce(sum(generation_count), 0) into used from comic_panels where chapter_id = p.chapter_id;
  if used >= cap then
    raise exception 'this chapter has used all % generations', cap using errcode = '53400';
  end if;
  perform set_config('oq.panel_image', 'on', true);
  update comic_panels set generation_count = generation_count + 1, error = null where id = p_panel_id;
  perform set_config('oq.panel_image', 'off', true);
  return cap - used - 1;
end;
$$;

-- Attach a freshly generated image (stored in the comic-panels bucket) and put the panel back up for review.
create or replace function public.record_panel_image(p_panel_id uuid, p_url text, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  p record;
begin
  select id, chapter_id, generation_count into p from comic_panels where id = p_panel_id;
  if p.id is null or not public.owns_chapter(p.chapter_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p.generation_count = 0 then raise exception 'generate the panel first' using errcode = '22023'; end if;
  perform set_config('oq.panel_image', 'on', true);
  if p_error is not null then
    update comic_panels set error = left(p_error, 300) where id = p_panel_id;
  else
    if p_url !~ '^(https?://|/)' then raise exception 'invalid image address' using errcode = '22023'; end if;
    update comic_panels set image_url = p_url, status = 'pending', error = null, generated_at = now() where id = p_panel_id;
  end if;
  perform set_config('oq.panel_image', 'off', true);
end;
$$;

grant execute on function public.comic_budget(uuid) to authenticated;
grant execute on function public.prepare_comic_scenes(uuid, jsonb, text) to authenticated;
grant execute on function public.begin_panel_generation(uuid) to authenticated;
grant execute on function public.record_panel_image(uuid, text, text) to authenticated;

-- Writers may store generated panels and their reference images in their own folders.
create policy "authors upload own comic panels" on storage.objects for insert to authenticated
  with check (bucket_id = 'comic-panels' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "authors replace own comic panels" on storage.objects for update to authenticated
  using (bucket_id = 'comic-panels' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "authors delete own comic panels" on storage.objects for delete to authenticated
  using (bucket_id = 'comic-panels' and (storage.foldername(name))[1] = auth.uid()::text);
