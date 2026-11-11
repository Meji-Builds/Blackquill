// Builds the demo content SQL: 12 authors, 30 books (20-40 chapters each), three choice points and simulated
// reading activity. Run: node scripts/demo/build-seed.mjs
//
// Output (paste into the Supabase SQL editor in order):
//   supabase/seed/demo_1_books.sql      authors and books 1-15
//   supabase/seed/demo_2_books.sql      books 16-30
//   supabase/seed/demo_3_activity.sql   choice points, Fresh Shelf history, reading activity, rankings
//   supabase/seed/demo_remove.sql       removes every piece of demo content
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AUTHORS } from "./authors.mjs";
import choices from "./choices.mjs";
import p1 from "./books/part1.mjs";
import p2 from "./books/part2.mjs";
import p3 from "./books/part3.mjs";
import p4 from "./books/part4.mjs";
import p5 from "./books/part5.mjs";
import p6 from "./books/part6.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "supabase", "seed");
const DOMAIN = "demo.obsidianquill.invalid";
const GENRES = new Set(["fantasy", "romance", "sci-fi", "action", "mystery", "horror", "thriller", "slice-of-life", "comedy", "drama", "historical", "litrpg", "xianxia", "isekai", "light-novel"]);
// Books published in the past week, so the Fresh Shelf has something on it.
const FRESH = { "my-rival-is-the-demon-kings-tutor": 2, "night-market": 4, "orbital-garden": 5, "signal-drift": 6 };

const books = [...p1, ...p2, ...p3, ...p4, ...p5, ...p6];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const problems = [];
if (books.length !== 30) problems.push(`expected 30 books, found ${books.length}`);
const slugs = new Set();
for (const b of books) {
  if (slugs.has(b.slug)) problems.push(`duplicate slug ${b.slug}`);
  slugs.add(b.slug);
  if (!AUTHORS[b.author]) problems.push(`${b.slug}: unknown author ${b.author}`);
  if (b.ch.length < 20 || b.ch.length > 40) problems.push(`${b.slug}: ${b.ch.length} chapters (needs 20-40)`);
  for (const g of b.genres) if (!GENRES.has(g)) problems.push(`${b.slug}: unknown genre ${g}`);
  if (b.status === "completed" && !b.ending) problems.push(`${b.slug}: completed but no ending`);
  for (const k of ["atmos", "voices", "thoughts", "hooks", "opening", "synopsis", "pov"])
    if (!b[k] || b[k].length === 0) problems.push(`${b.slug}: missing ${k}`);
}
for (const c of choices) {
  const b = books.find((x) => x.slug === c.book);
  if (!b) problems.push(`choice for unknown book ${c.book}`);
  else if (!b.ch[c.chapter - 1]) problems.push(`choice for missing chapter ${c.book} #${c.chapter}`);
}
if (problems.length) {
  console.error("Demo data problems:\n- " + problems.join("\n- "));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const uuid = (name) => {
  const h = createHash("sha1").update(`obsidian-quill-demo:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const tagSlug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

function rng(seed) {
  let a = parseInt(createHash("md5").update(seed).digest("hex").slice(0, 8), 16);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// Words that are proper nouns in a book: cast names, title words and anything capitalised mid-sentence.
function properNouns(b) {
  const set = new Set(b.cast.flatMap((c) => c.split(/\s+/)));
  for (const w of b.title.split(/\s+/)) set.add(w.replace(/[^\w'-]/g, ""));
  const text = [b.synopsis, ...b.ch.map((c) => c[1])].join(" ");
  for (const m of text.matchAll(/[a-z,;] ([A-Z][\w'-]+)/g)) set.add(m[1]);
  return set;
}

// "In which ..." chapter arguments, the old novelists' way of telling you what a chapter holds.
function argument(beat, nouns) {
  const first = beat.split(/\s+/)[0].replace(/[^\w'-]/g, "");
  const keep = nouns.has(first) || /^[A-Z]{2,}/.test(first);
  return `In which ${keep ? beat : beat.charAt(0).toLowerCase() + beat.slice(1)}`;
}

function dialogue(r, [speaker, line]) {
  const form = Math.floor(r() * 3);
  // "Line," she said.  /  "Line?" she said.  (a closing full stop becomes a comma before the tag)
  const tagged = (l) => (l.endsWith(".") ? `${l.slice(0, -1)},` : l);
  if (form === 0) return `"${tagged(line)}" ${speaker} said.`;
  if (form === 1) return `${speaker} said, "${line}"`;
  const [first, ...rest] = line.split(/(?<=[.!?])\s+/);
  return rest.length ? `"${first}" ${speaker} paused. "${rest.join(" ")}"` : `"${tagged(line)}" ${speaker} said quietly.`;
}

function chapterBody(b, i, nouns) {
  const r = rng(`${b.slug}:${i}`);
  const n = b.ch.length;
  const [, beat] = b.ch[i];
  const at = (arr, k) => arr[(i * 3 + k) % arr.length];
  const paras = [];
  if (i === 0) {
    paras.push(...b.opening.split(/\n\n/));
    paras.push(at(b.atmos, 0));
    paras.push(dialogue(r, at(b.voices, 0)));
    paras.push(at(b.hooks, 0));
    return paras.join("\n\n");
  }
  paras.push(argument(beat, nouns));
  paras.push(at(b.atmos, 0));
  paras.push(at(b.thoughts, 1));
  paras.push(dialogue(r, at(b.voices, 2)));
  paras.push(at(b.atmos, 4));
  paras.push(at(b.thoughts, 3));
  if (r() < 0.7) paras.push(dialogue(r, at(b.voices, 4)));
  if (i === n - 1 && b.status === "completed") paras.push(...b.ending.split(/\n\n/));
  else paras.push(pick(r, b.hooks));
  return paras.join("\n\n");
}

const words = (s) => s.trim().split(/\s+/).length;

// Publication dates: first chapter `days` ago; ongoing books updated recently, completed books finished a while back.
function chapterDates(b) {
  const r = rng(`${b.slug}:dates`);
  const n = b.ch.length;
  const startDays = FRESH[b.slug] ?? b.days;
  const endDays = FRESH[b.slug] !== undefined ? 0.2 : b.status === "completed" ? Math.max(8, Math.round(startDays * 0.25)) : 1 + r() * 6;
  return b.ch.map((_, k) => {
    const t = n === 1 ? 0 : k / (n - 1);
    const d = startDays - (startDays - endDays) * t - r() * 0.4;
    return Math.max(0.05, d);
  });
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------
const header = (title) =>
  `-- Obsidian Quill demo content: ${title}\n-- Generated by scripts/demo/build-seed.mjs. Paste into the Supabase SQL editor and run.\n\n`;

function authorsSql() {
  let s = "-- Demo authors (cannot sign in: no password, reserved .invalid email domain)\n";
  for (const [key, a] of Object.entries(AUTHORS)) {
    const id = uuid(`author:${key}`);
    const username = a.penName.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
    s += `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', ${q(`${key}@${DOMAIN}`)}, '', now(), '{"provider":"email","providers":["email"]}', ${q(JSON.stringify({ username, full_name: a.penName }))}, now() - interval '${a.joinedDaysAgo} days', now(), '', '', '', '')
on conflict (id) do nothing;
update public.profiles set display_name = ${q(a.penName)}, bio = ${q(a.bio)}, created_at = now() - interval '${a.joinedDaysAgo} days' where id = '${id}';\n`;
  }
  return s + "\n";
}

function bookSql(b) {
  const sid = uuid(`story:${b.slug}`);
  const aid = uuid(`author:${b.author}`);
  const nouns = properNouns(b);
  const dates = chapterDates(b);
  let s = `-- ${b.title} (${b.ch.length} chapters)\n`;
  s += `insert into public.stories (id, author_id, title, slug, synopsis, status, rating, created_at)
values ('${sid}', '${aid}', ${q(b.title)}, ${q(b.slug)}, ${q(b.synopsis)}, '${b.status}', '${b.rating}', now() - interval '${(dates[0] + 1).toFixed(2)} days')
on conflict (id) do nothing;\n`;
  s += `insert into public.story_genres (story_id, genre_id) select '${sid}', id from public.genres where slug in (${b.genres.map(q).join(", ")}) on conflict do nothing;\n`;
  s += `insert into public.tags (slug, name) values ${b.tags.map((t) => `(${q(tagSlug(t))}, ${q(t)})`).join(", ")} on conflict (slug) do nothing;\n`;
  s += `insert into public.story_tags (story_id, tag_id) select '${sid}', id from public.tags where slug in (${b.tags.map((t) => q(tagSlug(t))).join(", ")}) on conflict do nothing;\n`;
  s += `insert into public.chapters (id, story_id, number, title, body, status, published_at, created_at) values\n`;
  s += b.ch
    .map(([title], i) => {
      const body = chapterBody(b, i, nouns);
      const when = `now() - interval '${dates[i].toFixed(3)} days'`;
      return `  ('${uuid(`chapter:${b.slug}:${i + 1}`)}', '${sid}', ${i + 1}, ${q(title)}, ${q(body)}, 'published', ${when}, ${when})`;
    })
    .join(",\n");
  s += `\non conflict (id) do nothing;\n\n`;
  return s;
}

function choicesSql() {
  let s = "-- Choice points\n";
  for (const c of choices) {
    const cid = uuid(`chapter:${c.book}:${c.chapter}`);
    const pid = uuid(`choice:${c.book}:${c.chapter}`);
    s += `insert into public.choice_points (id, chapter_id, anchor_position, prompt) values ('${pid}', '${cid}', ${c.after}, ${q(c.prompt)}) on conflict do nothing;\n`;
    s += `insert into public.choice_options (id, choice_point_id, position, label, branch_body) values\n`;
    s += c.options.map(([label, branch], k) => `  ('${uuid(`option:${c.book}:${c.chapter}:${k}`)}', '${pid}', ${k + 1}, ${q(label)}, ${q(branch)})`).join(",\n");
    s += `\non conflict do nothing;\n`;
  }
  return s + "\n";
}

// Reading activity is generated inside the database (compact, and the same on every run thanks to setseed).
function activitySql() {
  const profiles = books.map((b) => {
    const r = rng(`${b.slug}:audience`);
    const fresh = FRESH[b.slug] !== undefined;
    return {
      sid: uuid(`story:${b.slug}`),
      readers: Math.round((fresh ? 15 : 30) + r() * (fresh ? 30 : 110)),
      stick: +(0.35 + r() * 0.55).toFixed(2),
    };
  });
  return `-- Fresh Shelf history: older books finished their first week long ago; new ones are mid-week.
update public.fresh_shelf_slots f set
  starts_at = s.published_at,
  ends_at = s.published_at + interval '7 days',
  impressions_served = case when s.published_at < now() - interval '7 days' then f.impressions_target
                            else (15 + floor(random() * 35))::int end
from public.stories s
where s.id = f.story_id and s.author_id in (select id from auth.users where email like '%@${DOMAIN}');

-- Simulated readers (signed-out ids) for the past 30 days: each opens chapters in order, finishes with the
-- story's "stickiness", sometimes comes back on a later day. Deterministic thanks to setseed.
do $$
declare
  plan jsonb := ${q(JSON.stringify(profiles))};
  b jsonb;
  reader int;
  anon text;
  depth int;
  n int;
  k int;
  t timestamptz;
  first_pub timestamptz;
  ch record;
begin
  -- Run once: if demo readers already exist, leave them as they are.
  if exists (select 1 from public.reading_events e join public.stories s on s.id = e.story_id
             where s.author_id in (select id from auth.users where email like '%@${DOMAIN}') and e.anon_id is not null) then
    raise notice 'Demo reading activity already present; skipping.';
    return;
  end if;
  perform setseed(0.42);
  for b in select * from jsonb_array_elements(plan) loop
    select min(published_at), count(*) into first_pub, n from public.chapters where story_id = (b->>'sid')::uuid;
    for reader in 1 .. (b->>'readers')::int loop
      anon := gen_random_uuid()::text;
      t := greatest(first_pub, now() - interval '30 days') + random() * (now() - greatest(first_pub, now() - interval '30 days'));
      depth := 1;
      while depth < n and depth < 15 and random() < (b->>'stick')::numeric loop depth := depth + 1; end loop;
      k := 0;
      for ch in select id, number, published_at from public.chapters where story_id = (b->>'sid')::uuid order by number limit depth loop
        k := k + 1;
        t := greatest(t, ch.published_at) + random() * interval '40 minutes';
        exit when t > now();
        insert into public.reading_events (anon_id, story_id, chapter_id, event_type, created_at)
        values (anon, (b->>'sid')::uuid, ch.id, 'open', t);
        if k < depth or random() < (b->>'stick')::numeric then
          insert into public.reading_events (anon_id, story_id, chapter_id, event_type, created_at)
          values (anon, (b->>'sid')::uuid, ch.id, 'finish', t + interval '6 minutes');
        end if;
        if k = 3 and random() < (b->>'stick')::numeric * 0.6 then
          t := t + interval '1 day' + random() * interval '2 days';
          exit when t > now();
          insert into public.reading_events (anon_id, story_id, chapter_id, event_type, created_at)
          values (anon, (b->>'sid')::uuid, ch.id, 'return', t);
        end if;
      end loop;
    end loop;
  end loop;
end $$;

-- Compute scores and close finished Fresh Shelf weeks.
select public.refresh_discovery();
`;
}

function removeSql() {
  return `${header("removal")}-- Removes every demo author and, through cascading deletes, their stories, chapters, choices, comments,
-- reading events and scores. Tags created for the demo stay (they are shared and harmless).
begin;
delete from auth.users where email like '%@${DOMAIN}';
select public.refresh_discovery();
commit;
`;
}

mkdirSync(OUT, { recursive: true });
const half = 15;
writeFileSync(join(OUT, "demo_1_books.sql"), header("authors and books 1-15") + "begin;\n" + authorsSql() + books.slice(0, half).map(bookSql).join("") + "commit;\n");
writeFileSync(join(OUT, "demo_2_books.sql"), header("books 16-30") + "begin;\n" + books.slice(half).map(bookSql).join("") + "commit;\n");
writeFileSync(join(OUT, "demo_3_activity.sql"), header("choice points and reading activity") + "begin;\n" + choicesSql() + activitySql() + "commit;\n");
writeFileSync(join(OUT, "demo_remove.sql"), removeSql());

const totalCh = books.reduce((a, b) => a + b.ch.length, 0);
const totalWords = books.reduce((a, b) => a + b.ch.reduce((x, _, i) => x + words(chapterBody(b, i, properNouns(b))), 0), 0);
console.log(`${books.length} books, ${totalCh} chapters, ~${Math.round(totalWords / 1000)}k words`);
for (const b of books) console.log(`  ${String(b.ch.length).padStart(2)}  ${b.status.padEnd(9)} ${b.rating.padEnd(8)} ${b.title}`);
for (const c of choices) console.log(`  choice: ${c.book} #${c.chapter} "${books.find((b) => b.slug === c.book).ch[c.chapter - 1][0]}"`);
