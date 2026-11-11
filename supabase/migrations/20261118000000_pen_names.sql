-- Pen names belong to writers. Readers are known by their username; a pen name can be set once someone has
-- started a story.

create or replace function public.is_writer(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stories where author_id = uid);
$$;
grant execute on function public.is_writer(uuid) to anon, authenticated;

-- New accounts start with just a username (no pen name, not even the name from a Google account).
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
  values (new.id, uname, null, new.raw_user_meta_data ->> 'avatar_url');

  insert into public.shelves (user_id, name, kind, position) values
    (new.id, 'Reading', 'reading', 0),
    (new.id, 'Plan to Read', 'plan_to_read', 1),
    (new.id, 'Completed', 'completed', 2);
  return new;
end;
$$;

-- Only writers may set a pen name.
create or replace function public.pen_name_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.display_name is not null then
    new.display_name := nullif(trim(regexp_replace(new.display_name, '\s+', ' ', 'g')), '');
  end if;
  if new.display_name is not null
     and new.display_name is distinct from (case when tg_op = 'UPDATE' then old.display_name end)
     and auth.uid() is not null
     and not public.is_writer(new.id) then
    raise exception 'pen names are for writers; start a story to choose one' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profiles_pen_name_guard before insert or update of display_name on public.profiles
  for each row execute function public.pen_name_guard();

-- Existing readers: drop names they never chose (the username copy or a name from Google) and any pen name on an
-- account that has no stories. A writer's "pen name" that is just their username counts as none.
update public.profiles p set display_name = null
where display_name is not null and (not public.is_writer(p.id) or display_name = username);
