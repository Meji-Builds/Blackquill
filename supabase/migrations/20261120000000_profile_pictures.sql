-- Profile pictures for everyone: readers, writers and translators.
--   * Pictures live in the public "avatars" bucket under "<user id>/...", already cropped and shrunk by the app.
--   * profiles.avatar_url may only point at the person's own folder in that bucket (or be cleared).
--   * At most 10 picture changes a day, and a few files per person in storage.
--   * Admins can remove a reported picture (and bio) from the moderation queue.

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- How many pictures someone has stored now (the app deletes the old one on every change).
create or replace function public.avatar_file_count(p_user uuid)
returns integer language sql stable security definer set search_path = storage, public as $$
  select count(*)::integer from storage.objects where bucket_id = 'avatars' and (storage.foldername(name))[1] = p_user::text;
$$;
revoke all on function public.avatar_file_count(uuid) from public;
grant execute on function public.avatar_file_count(uuid) to authenticated;

drop policy if exists "public read avatars" on storage.objects;
drop policy if exists "users upload own avatar" on storage.objects;
drop policy if exists "users delete own avatar" on storage.objects;
create policy "public read avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "users upload own avatar" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.avatar_file_count(auth.uid()) < 4
  );
drop policy if exists "admins delete avatars" on storage.objects;
create policy "users delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "admins delete avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.is_admin());

-- ---------------------------------------------------------------------------
-- What profiles.avatar_url may hold, and how often it may change
-- ---------------------------------------------------------------------------
create table if not exists public.avatar_changes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists avatar_changes_user_idx on public.avatar_changes (user_id, created_at desc);
alter table public.avatar_changes enable row level security; -- written only by the trigger below

create or replace function public.avatar_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.avatar_url is not distinct from old.avatar_url then return new; end if;
  -- Admins (moderation) and the system (no signed-in user) may change any picture.
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.avatar_url is not null
     and position(('/storage/v1/object/public/avatars/' || new.id::text || '/') in new.avatar_url) = 0 then
    raise exception 'profile pictures must be uploaded here' using errcode = '42501';
  end if;
  if new.avatar_url is not null then
    if (select count(*) from avatar_changes where user_id = new.id and created_at > now() - interval '1 day') >= 10 then
      raise exception 'you have changed your picture a lot today; try again tomorrow' using errcode = '53400';
    end if;
    insert into avatar_changes (user_id) values (new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_avatar_guard on public.profiles;
create trigger profiles_avatar_guard before update of avatar_url on public.profiles
  for each row execute function public.avatar_guard();

-- ---------------------------------------------------------------------------
-- Moderation: show the reported person's picture, and let admins remove it.
-- ---------------------------------------------------------------------------
drop function if exists public.moderation_queue(report_status);
create function public.moderation_queue(p_status report_status default 'open')
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
  is_removed boolean,
  image text
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
      when 'profile' then (select coalesce(p.display_name, '@' || p.username) from profiles p where p.id = g.target_id)
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
    end,
    case g.target_type
      when 'profile' then (select p.avatar_url from profiles p where p.id = g.target_id)
      when 'comment' then (select p.avatar_url from comments cm join profiles p on p.id = cm.user_id where cm.id = g.target_id)
    end
  from g
  order by g.n desc, g.first_at;
end;
$$;
grant execute on function public.moderation_queue(report_status) to authenticated;

-- Act on every open report about one target.
--   dismiss: nothing wrong.   remove: take the story down, hide the comment, or clear a profile's picture and bio.
--   restore: undo a story or comment removal (a cleared picture can't come back; the person uploads a new one).
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
      -- The app deletes the stored files with the storage API (Supabase doesn't allow deleting them from SQL).
      update profiles set avatar_url = null, bio = null where id = p_target_id;
    else
      raise exception 'a removed picture cannot be restored' using errcode = '22023';
    end if;
  end if;

  update reports set status = case when p_action = 'dismiss' then 'dismissed'::report_status else 'actioned'::report_status end,
                     resolved_at = now(), resolved_by = auth.uid(), note = left(p_note, 1000)
  where target_type = p_target_type and target_id = p_target_id and status = 'open';
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.resolve_reports(report_target, uuid, text, text) to authenticated;

-- One-click removal of a picture from a report about a profile or a comment. The app then deletes the stored files.
create or replace function public.remove_profile_picture(p_username text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update profiles set avatar_url = null where username = p_username returning id into uid;
  return uid;
end;
$$;
grant execute on function public.remove_profile_picture(text) to authenticated;
