-- Translations: each story has an original language, and its writer decides per book whether readers may have it
-- machine-translated and whether volunteer translators may translate it. Translations are stored per chapter and
-- language, shared by every reader.

-- ---------------------------------------------------------------------------
-- Per-book settings
-- ---------------------------------------------------------------------------
alter table public.stories
  add column language text not null default 'en' check (language ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),
  add column allow_machine_translation boolean not null default true,
  add column allow_community_translation boolean not null default true;

-- A fingerprint of a chapter's words, so a translation knows when the original has changed since.
alter table public.chapters
  add column content_hash text generated always as (md5(title || E'\n' || body)) stored;

-- People who translate list their languages on their profile.
alter table public.profiles
  add column translator_languages text[] not null default '{}'
    check (cardinality(translator_languages) <= 12);

-- ---------------------------------------------------------------------------
-- Translators of a book: asked for by a translator (requested) or by the writer (invited); approved by the other.
-- ---------------------------------------------------------------------------
create type translator_status as enum ('requested', 'invited', 'approved', 'declined');

create table public.story_translators (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  language text not null check (language ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),
  status translator_status not null,
  message text check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (story_id, user_id, language)
);
create index story_translators_user_idx on public.story_translators (user_id);
alter table public.story_translators enable row level security;

create or replace function public.is_story_translator(p_story_id uuid, p_language text, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from story_translators t join stories s on s.id = t.story_id
    where t.story_id = p_story_id and t.language = p_language and t.user_id = p_user
      and t.status = 'approved' and s.allow_community_translation and s.removed_at is null
  );
$$;

create policy "translators are visible" on public.story_translators for select using (
  status = 'approved' or user_id = auth.uid() or public.owns_story(story_id));
-- Translators ask; writers invite.
create policy "ask to translate" on public.story_translators for insert with check (
  (user_id = auth.uid() and status = 'requested' and not public.owns_story(story_id))
  or (public.owns_story(story_id) and status = 'invited' and user_id <> auth.uid()));
-- Writers approve or decline requests; translators accept or decline invitations. Either side may end it.
create policy "answer translator requests" on public.story_translators for update using (
  public.owns_story(story_id) or user_id = auth.uid());
create policy "leave or remove translators" on public.story_translators for delete using (
  public.owns_story(story_id) or user_id = auth.uid());

create or replace function public.story_translator_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  st record;
  writer boolean;
begin
  select author_id, language, allow_community_translation into st from stories where id = new.story_id;
  if tg_op = 'INSERT' then
    if not st.allow_community_translation then
      raise exception 'this writer is not accepting translators for this story' using errcode = '42501';
    end if;
    if new.language = st.language then
      raise exception 'this story is already written in that language' using errcode = '22023';
    end if;
    if (select count(*) from story_translators where user_id = new.user_id and status = 'requested'
        and created_at > now() - interval '1 day') >= 10 then
      raise exception 'you have asked to translate 10 stories today; try again tomorrow' using errcode = '53400';
    end if;
    new.decided_at := null;
    return new;
  end if;
  -- Updates: only the status (and its time) change, and only the right side may answer.
  new.story_id := old.story_id; new.user_id := old.user_id; new.language := old.language; new.message := old.message;
  new.created_at := old.created_at;
  if new.status is distinct from old.status then
    writer := auth.uid() = st.author_id;
    if old.status = 'requested' and not writer then
      raise exception 'only the writer can answer a request' using errcode = '42501';
    elsif old.status = 'invited' and auth.uid() <> old.user_id then
      raise exception 'only the invited translator can answer an invitation' using errcode = '42501';
    elsif old.status in ('approved', 'declined') and new.status <> 'declined' then
      raise exception 'ask again to translate this story' using errcode = '22023';
    end if;
    if new.status not in ('approved', 'declined') then
      raise exception 'answer with approved or declined' using errcode = '22023';
    end if;
    new.decided_at := now();
  end if;
  return new;
end;
$$;
create trigger story_translators_guard before insert or update on public.story_translators
  for each row execute function public.story_translator_guard();

-- ---------------------------------------------------------------------------
-- Chapter translations
-- ---------------------------------------------------------------------------
create type translation_kind as enum ('machine', 'community');

create table public.chapter_translations (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  language text not null check (language ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$'),
  kind translation_kind not null,
  title text not null default '' check (char_length(title) <= 300),
  body text not null default '' check (char_length(body) <= 400000),
  translator_id uuid references public.profiles (id) on delete set null,
  published boolean not null default false,
  source_hash text not null,   -- the chapter's content_hash when this was translated
  provider text,               -- which service made a machine translation
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (chapter_id, language, kind)
);
create index chapter_translations_lang_idx on public.chapter_translations (language) where published;
create trigger chapter_translations_updated_at before update on public.chapter_translations
  for each row execute function public.set_updated_at();
alter table public.chapter_translations enable row level security;

-- Readers see published translations of chapters they can read, when the writer allows that kind;
-- translators see their own drafts; writers see every translation of their stories.
create policy "readable translations" on public.chapter_translations for select using (
  (published and public.can_read_chapter(chapter_id) and exists (
     select 1 from chapters c join stories s on s.id = c.story_id where c.id = chapter_id
       and ((kind = 'machine' and s.allow_machine_translation) or (kind = 'community' and s.allow_community_translation))))
  or translator_id = auth.uid()
  or public.owns_chapter(chapter_id));

-- Only approved translators write community translations. Machine translations are written by the server alone
-- (with the service key), so nobody can plant text in the shared cache.
create policy "translators write" on public.chapter_translations for insert with check (
  kind = 'community' and translator_id = auth.uid() and exists (
    select 1 from chapters c where c.id = chapter_id and c.status = 'published'
      and public.is_story_translator(c.story_id, language)));
create policy "translators edit their own" on public.chapter_translations for update
  using (kind = 'community' and translator_id = auth.uid())
  with check (kind = 'community' and translator_id = auth.uid() and exists (
    select 1 from chapters c where c.id = chapter_id and public.is_story_translator(c.story_id, language)));
create policy "translators and writers delete" on public.chapter_translations for delete using (
  (kind = 'community' and translator_id = auth.uid()) or public.owns_chapter(chapter_id));

create or replace function public.chapter_translation_before_write()
returns trigger language plpgsql as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then new.published_at := now(); end if;
  if not new.published then new.published_at := null; end if;
  return new;
end;
$$;
create trigger chapter_translations_before_write before insert or update on public.chapter_translations
  for each row execute function public.chapter_translation_before_write();

-- Who asked for machine translations (a signed-in reader or a device), for the daily limits.
create table public.translation_requests (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete cascade,
  anon_id text,
  chapter_id uuid references public.chapters (id) on delete set null,
  language text not null,
  created_at timestamptz not null default now()
);
create index translation_requests_user_idx on public.translation_requests (user_id, created_at desc);
create index translation_requests_anon_idx on public.translation_requests (anon_id, created_at desc);
alter table public.translation_requests enable row level security;
create policy "own translation requests" on public.translation_requests for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- What a story offers: its original language and each translated language with progress.
-- ---------------------------------------------------------------------------
create or replace function public.story_languages(p_story_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select id, language, allow_machine_translation, allow_community_translation from stories
    where id = p_story_id and status <> 'draft' and removed_at is null
  ),
  pub as (select count(*) as n from chapters where story_id = p_story_id and status = 'published'),
  community as (
    select t.language, count(distinct t.chapter_id) as chapters,
           array_agg(distinct coalesce(p.display_name, p.username)) filter (where p.id is not null) as translators
    from chapter_translations t
    join chapters c on c.id = t.chapter_id and c.status = 'published'
    left join profiles p on p.id = t.translator_id
    join s on s.id = c.story_id
    where t.kind = 'community' and t.published and s.allow_community_translation
    group by t.language
  )
  select jsonb_build_object(
    'original', s.language,
    'machine', s.allow_machine_translation,
    'community', s.allow_community_translation,
    'chapters', (select n from pub),
    'translations', coalesce((select jsonb_agg(jsonb_build_object('language', language, 'chapters', chapters, 'translators', translators) order by chapters desc) from community), '[]')
  )
  from s;
$$;
grant execute on function public.story_languages(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notifications for translator requests, invitations and answers
-- ---------------------------------------------------------------------------
alter type notification_kind add value if not exists 'translator_request';
alter type notification_kind add value if not exists 'translator_invite';
alter type notification_kind add value if not exists 'translator_approved';
alter type notification_kind add value if not exists 'translator_declined';
alter table public.notifications add column language text;

create or replace function public.notify_translator()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  author uuid;
begin
  select author_id into author from stories where id = new.story_id;
  if tg_op = 'INSERT' then
    if new.status = 'requested' then
      insert into notifications (user_id, kind, actor_id, story_id, language)
      values (author, 'translator_request', new.user_id, new.story_id, new.language);
    elsif new.status = 'invited' then
      insert into notifications (user_id, kind, actor_id, story_id, language)
      values (new.user_id, 'translator_invite', author, new.story_id, new.language);
    end if;
  elsif new.status is distinct from old.status and new.status in ('approved', 'declined') then
    insert into notifications (user_id, kind, actor_id, story_id, language)
    values (case when old.status = 'requested' then new.user_id else author end,
            (case when new.status = 'approved' then 'translator_approved' else 'translator_declined' end)::notification_kind,
            case when old.status = 'requested' then author else new.user_id end, new.story_id, new.language);
  end if;
  return new;
end;
$$;
create trigger story_translators_notify after insert or update on public.story_translators
  for each row execute function public.notify_translator();

-- ---------------------------------------------------------------------------
-- Search can filter by language: written in it, or translated into it by the community.
-- ---------------------------------------------------------------------------
drop function public.search_stories(text, text[], text[], story_status, integer, integer, integer, boolean, text, integer, integer);
create function public.search_stories(
  p_query text default null,
  p_genres text[] default null,
  p_tags text[] default null,
  p_status story_status default null,
  p_min_words integer default null,
  p_max_words integer default null,
  p_updated_within_days integer default null,
  p_include_mature boolean default false,
  p_sort text default 'relevance',
  p_limit integer default 24,
  p_offset integer default 0,
  p_language text default null
)
returns table (
  id uuid,
  title text,
  cover_url text,
  synopsis text,
  status story_status,
  rating content_rating,
  word_count integer,
  last_chapter_at timestamptz,
  published_at timestamptz,
  author_username text,
  author_name text,
  chapter_count integer,
  genres text[],
  rank real,
  total_count bigint,
  language text
)
language plpgsql stable security invoker set search_path = public as $$
declare
  q text := nullif(trim(coalesce(p_query, '')), '');
  q_lower text := lower(q);
  ts_en tsquery := case when q is null then null else websearch_to_tsquery('english', q) end;
  ts_simple tsquery := case when q is null then null else websearch_to_tsquery('simple', q) end;
  sort text := case when p_sort in ('relevance', 'updated', 'newest', 'words', 'title') then p_sort else 'relevance' end;
  lang text := nullif(trim(coalesce(p_language, '')), '');
begin
  if q is null and sort = 'relevance' then sort := 'updated'; end if;

  return query
  with base as (
    select s.*, p.username, p.display_name,
      case when q is null then 0::real else (
        ts_rank(s.search, ts_en) + ts_rank(s.search, ts_simple)
        + 2 * word_similarity(q, s.title)
        + case when position(q_lower in lower(s.title)) > 0 then 1 else 0 end
        + case when lower(p.username) = q_lower or lower(coalesce(p.display_name, '')) = q_lower then 1.5 else 0 end
        + case when exists (select 1 from story_tags st join tags t on t.id = st.tag_id
                            where st.story_id = s.id and (lower(t.name) = q_lower or t.slug = q_lower)) then 0.75 else 0 end
      )::real end as r
    from stories s
    join profiles p on p.id = s.author_id
    where s.status <> 'draft'
      and s.last_chapter_at is not null
      and (p_include_mature or s.rating <> 'mature')
      and (p_status is null or s.status = p_status)
      and (p_min_words is null or s.word_count >= p_min_words)
      and (p_max_words is null or s.word_count < p_max_words)
      and (p_updated_within_days is null or s.last_chapter_at >= now() - make_interval(days => p_updated_within_days))
      and (lang is null or s.language = lang or (s.allow_community_translation and exists (
            select 1 from chapter_translations ct join chapters c on c.id = ct.chapter_id
            where c.story_id = s.id and ct.language = lang and ct.kind = 'community' and ct.published)))
      and (coalesce(cardinality(p_genres), 0) = 0 or exists (
            select 1 from story_genres sg join genres g on g.id = sg.genre_id
            where sg.story_id = s.id and g.slug = any (p_genres)))
      and (coalesce(cardinality(p_tags), 0) = 0 or (
            select count(distinct t.slug) from story_tags st join tags t on t.id = st.tag_id
            where st.story_id = s.id and t.slug = any (p_tags)) = (select count(distinct x) from unnest(p_tags) x))
      and (q is null
           or s.search @@ ts_en
           or s.search @@ ts_simple
           or word_similarity(q, s.title) >= 0.4
           or position(q_lower in lower(s.title)) > 0
           or position(q_lower in lower(p.username)) > 0
           or position(q_lower in lower(coalesce(p.display_name, ''))) > 0
           or exists (select 1 from story_tags st join tags t on t.id = st.tag_id
                      where st.story_id = s.id and (position(q_lower in lower(t.name)) > 0 or t.slug = q_lower)))
  )
  select b.id, b.title, b.cover_url, b.synopsis, b.status, b.rating, b.word_count, b.last_chapter_at,
         b.published_at, b.username, b.display_name,
         (select count(*)::int from chapters c where c.story_id = b.id and c.status = 'published'),
         array(select g.slug from story_genres sg join genres g on g.id = sg.genre_id
               where sg.story_id = b.id order by g.name),
         b.r,
         count(*) over (),
         b.language
  from base b
  order by
    case when sort = 'relevance' then b.r end desc nulls last,
    case when sort = 'newest' then b.published_at end desc nulls last,
    case when sort = 'words' then b.word_count end desc nulls last,
    case when sort = 'title' then lower(b.title) end asc nulls last,
    b.last_chapter_at desc nulls last,
    b.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
grant execute on function public.search_stories(text, text[], text[], story_status, integer, integer, integer, boolean, text, integer, integer, text) to anon, authenticated;
