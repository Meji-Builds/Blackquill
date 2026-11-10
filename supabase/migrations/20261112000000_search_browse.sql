-- Obsidian Quill build step 4: search and browse.
-- One function serves search, the browse page, genre and tag pages, and the home page rows.
-- It runs as the caller, so Row Level Security still applies; drafts and stories with no published
-- chapters are excluded explicitly, and mature stories are hidden unless asked for.

create index if not exists stories_last_chapter_idx on public.stories (last_chapter_at desc) where status <> 'draft';
create index if not exists tags_name_trgm_idx on public.tags using gin (name gin_trgm_ops);
create index if not exists profiles_username_trgm_idx on public.profiles using gin (username gin_trgm_ops);

create or replace function public.search_stories(
  p_query text default null,
  p_genres text[] default null,          -- genre slugs; a story matches if it has any of them
  p_tags text[] default null,            -- tag slugs; a story must have all of them
  p_status story_status default null,    -- ongoing, completed or hiatus
  p_min_words integer default null,
  p_max_words integer default null,
  p_updated_within_days integer default null,
  p_include_mature boolean default false,
  p_sort text default 'relevance',       -- relevance, updated, newest, words, title
  p_limit integer default 24,
  p_offset integer default 0
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
  total_count bigint
)
language plpgsql stable security invoker set search_path = public as $$
declare
  q text := nullif(trim(coalesce(p_query, '')), '');
  q_lower text := lower(q);
  ts_en tsquery := case when q is null then null else websearch_to_tsquery('english', q) end;
  ts_simple tsquery := case when q is null then null else websearch_to_tsquery('simple', q) end;
  sort text := case when p_sort in ('relevance', 'updated', 'newest', 'words', 'title') then p_sort else 'relevance' end;
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
         count(*) over ()
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

grant execute on function public.search_stories(text, text[], text[], story_status, integer, integer, integer, boolean, text, integer, integer)
  to anon, authenticated;

-- Tags in use on public stories, most used first (for the browse filter and the tag cloud).
create or replace function public.popular_tags(p_limit integer default 30)
returns table (slug text, name text, uses bigint)
language sql stable security invoker set search_path = public as $$
  select t.slug, t.name, count(*) as uses
  from tags t
  join story_tags st on st.tag_id = t.id
  join stories s on s.id = st.story_id
  where s.status <> 'draft' and s.last_chapter_at is not null and s.rating <> 'mature'
  group by t.id
  order by uses desc, t.name
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

grant execute on function public.popular_tags(integer) to anon, authenticated;

-- Genres with how many public, non-mature stories they hold (home page rows and genre chips).
create or replace function public.genre_counts()
returns table (slug text, name text, stories bigint)
language sql stable security invoker set search_path = public as $$
  select g.slug, g.name, count(s.id) as stories
  from genres g
  left join story_genres sg on sg.genre_id = g.id
  left join stories s on s.id = sg.story_id
    and s.status <> 'draft' and s.last_chapter_at is not null and s.rating <> 'mature'
  group by g.id
  order by stories desc, g.name;
$$;

grant execute on function public.genre_counts() to anon, authenticated;
