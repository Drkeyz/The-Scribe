-- ============================================================
-- The Scribe — Database Schema
-- Postgres / Supabase. Run in the Supabase SQL editor.
-- Every table is protected by Row Level Security: users can
-- only ever touch rows they own.
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type ministry_lean as enum (
  'apostolic', 'prophetic', 'evangelistic', 'pastoral', 'teaching'
);

create type interview_status as enum ('in_progress', 'completed');

create type chapter_status as enum ('outlined', 'generating', 'drafted', 'edited', 'final');

-- ============================================================
-- 1. Profiles (mirrors auth.users, created by trigger)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  pen_name    text,
  ministry    text,          -- e.g. "Kingdom Word Assembly, Lagos"
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- 2. Voice profile — the spine of the product. One per user.
--    Structured JSONB for the dimensional stuff, normalized
--    tables for things the assistant queries individually.
-- ============================================================
create table public.voice_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references public.profiles (id) on delete cascade,

  -- Ministry identity
  primary_lean        ministry_lean,
  secondary_lean      ministry_lean,
  audience            text,            -- "intercessors and prayer leaders", "young believers", ...
  calling_summary     text,            -- one-paragraph articulation of their mandate

  -- Theological framework: positions the generator must honor.
  -- { "grace": "...", "spiritual_warfare": "...", "prophetic_protocol": "...",
  --   "healing": "...", "authority": "...", "denominational_notes": "..." }
  framework           jsonb not null default '{}'::jsonb,

  -- Tone parameters the prompt builder reads directly.
  -- { "declarative_vs_devotional": 0.7, "intensity": 0.6,
  --   "sentence_rhythm": "short, punchy declarations broken by long teaching passages",
  --   "preferred_translation": "KJV", "first_person_usage": "heavy", ... }
  tone                jsonb not null default '{}'::jsonb,

  -- Structural habits: how their chapters are built.
  -- { "chapter_opening": "personal story then scripture", "uses_prayer_points": true,
  --   "uses_prophetic_declarations": true, "uses_activation_exercises": false,
  --   "chapter_closing": "prayer and declaration", ... }
  habits              jsonb not null default '{}'::jsonb,

  -- Optional pasted writing sample for few-shot grounding
  writing_sample      text,

  -- Interview completeness, 0–100, drives the profile progress ring
  completeness        int not null default 0 check (completeness between 0 and 100),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------- Signature phrases ----------
create table public.signature_phrases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  phrase      text not null,
  context     text,           -- when/how they use it: "opens prophetic segments with this"
  source      text not null default 'interview',  -- 'interview' | 'manual' | 'detected'
  created_at  timestamptz not null default now()
);

-- ---------- Anchor scriptures ----------
create table public.anchor_scriptures (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  reference    text not null,         -- "Habakkuk 2:2"
  translation  text default 'KJV',
  text_excerpt text,                  -- short excerpt, author-provided
  significance text,                  -- why this scripture anchors them
  themes       text[] default '{}',   -- ['vision', 'patience', 'writing the vision']
  created_at   timestamptz not null default now()
);

-- ---------- Story bank ----------
create table public.stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null,          -- "The night in the Jos prayer camp"
  summary     text not null,          -- 2–4 sentence retelling in the author's words
  year_or_era text,                   -- "2019", "early ministry years"
  themes      text[] default '{}',    -- used to match stories to chapter topics
  emotional_register text,            -- "awe", "brokenness", "breakthrough"
  used_count  int not null default 0, -- prevents over-reuse across chapters
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 3. Interview sessions — the guided voice-capture flow
-- ============================================================
create table public.interview_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  status      interview_status not null default 'in_progress',
  -- which sections are done: { "identity": true, "framework": false, ... }
  progress    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.interview_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.interview_sessions (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('scribe', 'author')),
  content     text not null,
  -- extraction payload produced from this exchange (phrases/scriptures/stories found)
  extracted   jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 4. Books and chapters
-- ============================================================
create table public.books (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  title         text not null,
  subtitle      text,
  premise       text,            -- what this book is about, in the author's words
  target_reader text,
  -- generated outline snapshot: [{ "number": 1, "title": "...", "synopsis": "..." }]
  outline       jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.chapters (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  number      int not null,
  title       text not null,
  synopsis    text,
  content     text not null default '',   -- the manuscript text (markdown)
  status      chapter_status not null default 'outlined',
  word_count  int not null default 0,
  -- which stories/scriptures the generator wove in, for the provenance panel
  grounding   jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (book_id, number)
);

-- ============================================================
-- 5. The margin Scribe — persisted assistant threads.
--    A thread is anchored to a chapter, optionally to a text range.
-- ============================================================
create table public.assistant_threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  chapter_id  uuid references public.chapters (id) on delete cascade,
  -- anchor into the manuscript: { "from": 1240, "to": 1318, "quote": "nearness in stillness" }
  anchor      jsonb,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.assistant_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.assistant_threads (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('scribe', 'author')),
  content     text not null,
  -- if the Scribe proposed a rewrite: { "original": "...", "proposed": "...", "applied": false }
  proposal    jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index idx_phrases_user      on public.signature_phrases (user_id);
create index idx_scriptures_user   on public.anchor_scriptures (user_id);
create index idx_stories_user      on public.stories (user_id);
create index idx_stories_themes    on public.stories using gin (themes);
create index idx_scripture_themes  on public.anchor_scriptures using gin (themes);
create index idx_chapters_book     on public.chapters (book_id);
create index idx_threads_chapter   on public.assistant_threads (chapter_id);
create index idx_messages_thread   on public.assistant_messages (thread_id);
create index idx_interview_session on public.interview_messages (session_id);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_profiles_touch        before update on public.profiles           for each row execute function public.touch_updated_at();
create trigger trg_voice_profiles_touch  before update on public.voice_profiles     for each row execute function public.touch_updated_at();
create trigger trg_sessions_touch        before update on public.interview_sessions for each row execute function public.touch_updated_at();
create trigger trg_books_touch           before update on public.books              for each row execute function public.touch_updated_at();
create trigger trg_chapters_touch        before update on public.chapters           for each row execute function public.touch_updated_at();

-- ============================================================
-- New-user bootstrap: create profile + empty voice profile
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.voice_profiles (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.voice_profiles     enable row level security;
alter table public.signature_phrases  enable row level security;
alter table public.anchor_scriptures  enable row level security;
alter table public.stories            enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_messages enable row level security;
alter table public.books              enable row level security;
alter table public.chapters           enable row level security;
alter table public.assistant_threads  enable row level security;
alter table public.assistant_messages enable row level security;

-- Profiles: id IS the user id
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Everything else keys on user_id. One macro-style block per table.
create policy "own rows" on public.voice_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.signature_phrases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.anchor_scriptures
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.stories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.interview_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.interview_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.chapters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.assistant_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.assistant_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
