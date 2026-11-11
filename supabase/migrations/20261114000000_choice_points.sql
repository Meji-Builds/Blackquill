-- Obsidian Quill build step 7: interactive choice points.
-- A chapter can have one choice point after a given paragraph, with 2 to 3 options. Each option leads to a short
-- branch scene; the reader then rejoins the main text. Readers (signed in or not) pick once; the totals are shown
-- after picking. Writes go through functions that check ownership and limits.

-- ---------------------------------------------------------------------------
-- Picks: one per reader per choice point, for signed-in and signed-out readers alike
-- ---------------------------------------------------------------------------
alter table public.choice_picks drop constraint choice_picks_pkey;
alter table public.choice_picks alter column user_id drop not null;
alter table public.choice_picks
  add column id bigint generated always as identity primary key,
  add column anon_id text,
  add column viewer text generated always as (coalesce(user_id::text, 'a:' || anon_id)) stored,
  add constraint choice_picks_has_viewer check (user_id is not null or anon_id is not null);
create unique index choice_picks_viewer_idx on public.choice_picks (choice_point_id, viewer);
drop policy if exists "readers pick" on public.choice_picks;

-- ---------------------------------------------------------------------------
-- Saving a choice point (author only)
-- ---------------------------------------------------------------------------
-- p_options: [{"label": "...", "branch": "..."}, ...] with 2 or 3 entries, in display order.
create or replace function public.save_choice_point(
  p_chapter_id uuid,
  p_anchor integer,
  p_prompt text,
  p_options jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  point_id uuid;
  n integer := coalesce(jsonb_array_length(p_options), 0);
  i integer;
  opt jsonb;
  lbl text;
  branch text;
begin
  if not public.owns_chapter(p_chapter_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_anchor is null or p_anchor < 0 then
    raise exception 'choose where the choice appears' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_prompt, ''))) not between 1 and 300 then
    raise exception 'the question must be 1 to 300 characters' using errcode = '22023';
  end if;
  if jsonb_typeof(p_options) <> 'array' or n not between 2 and 3 then
    raise exception 'a choice needs 2 or 3 options' using errcode = '22023';
  end if;
  for i in 0 .. n - 1 loop
    opt := p_options -> i;
    lbl := trim(coalesce(opt ->> 'label', ''));
    branch := trim(coalesce(opt ->> 'branch', ''));
    if char_length(lbl) not between 1 and 120 then
      raise exception 'option % needs a label of 1 to 120 characters', i + 1 using errcode = '22023';
    end if;
    if char_length(branch) not between 1 and 20000 then
      raise exception 'option % needs a branch scene (up to 20,000 characters)', i + 1 using errcode = '22023';
    end if;
  end loop;

  insert into choice_points (chapter_id, anchor_position, prompt)
  values (p_chapter_id, p_anchor, trim(p_prompt))
  on conflict (chapter_id) do update set anchor_position = excluded.anchor_position, prompt = excluded.prompt
  returning id into point_id;

  -- Options are matched by position, so editing wording keeps the picks already made.
  for i in 0 .. n - 1 loop
    opt := p_options -> i;
    insert into choice_options (choice_point_id, position, label, branch_body)
    values (point_id, i + 1, trim(opt ->> 'label'), trim(opt ->> 'branch'))
    on conflict (choice_point_id, position) do update set label = excluded.label, branch_body = excluded.branch_body;
  end loop;
  delete from choice_options where choice_point_id = point_id and position > n;

  return point_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Picking and the totals readers see afterwards
-- ---------------------------------------------------------------------------
create or replace function public.choice_totals(p_point_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'counts', coalesce(jsonb_object_agg(o.id, (select count(*) from choice_picks p where p.choice_option_id = o.id)), '{}'),
    'total', (select count(*) from choice_picks p where p.choice_point_id = p_point_id)
  )
  from choice_options o where o.choice_point_id = p_point_id;
$$;
revoke execute on function public.choice_totals(uuid) from public, anon, authenticated;

-- What this reader picked, with totals once they have picked (authors always see totals).
create or replace function public.choice_state(p_point_id uuid, p_anon text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  who text := coalesce(uid::text, case when p_anon ~ '^[0-9a-f-]{36}$' then 'a:' || lower(p_anon) end);
  cp record;
  picked uuid;
  is_author boolean;
begin
  select id, chapter_id into cp from choice_points where id = p_point_id;
  if cp.id is null or not public.can_read_chapter(cp.chapter_id) then return null; end if;
  is_author := public.owns_chapter(cp.chapter_id);
  select choice_option_id into picked from choice_picks where choice_point_id = p_point_id and viewer = who;
  return jsonb_build_object('picked', picked, 'author', is_author)
         || case when picked is not null or is_author then choice_totals(p_point_id) else '{}'::jsonb end;
end;
$$;

-- Records the reader's first pick (later picks do not change it) and returns the totals.
-- Authors trying their own choice are shown the totals without being counted.
create or replace function public.pick_choice(p_option_id uuid, p_anon text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  anon text := case when uid is null and p_anon ~ '^[0-9a-f-]{36}$' then lower(p_anon) end;
  opt record;
begin
  select o.id, o.choice_point_id, cp.chapter_id into opt
  from choice_options o join choice_points cp on cp.id = o.choice_point_id
  where o.id = p_option_id;
  if opt.id is null or not public.can_read_chapter(opt.chapter_id) then
    raise exception 'choice not available' using errcode = '42501';
  end if;
  if uid is null and anon is null then
    raise exception 'no reader id' using errcode = '22023';
  end if;
  if not public.owns_chapter(opt.chapter_id) then
    insert into choice_picks (choice_option_id, choice_point_id, user_id, anon_id)
    values (opt.id, opt.choice_point_id, uid, anon)
    on conflict (choice_point_id, viewer) do nothing;
  end if;
  return choice_state(opt.choice_point_id, p_anon)
         || case when public.owns_chapter(opt.chapter_id)
                 then jsonb_build_object('picked', opt.id) else '{}'::jsonb end;
end;
$$;

grant execute on function public.save_choice_point(uuid, integer, text, jsonb) to authenticated;
grant execute on function public.choice_state(uuid, text) to anon, authenticated;
grant execute on function public.pick_choice(uuid, text) to anon, authenticated;

-- The per-option totals view bypassed Row Level Security; totals now come only from the functions above.
drop view if exists public.choice_option_stats;
