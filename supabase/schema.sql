create table if not exists public.class_sessions (
  id uuid primary key,
  course_id text not null,
  exercise_id text not null,
  label text not null,
  active boolean not null default true,
  token_seed text not null,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.activity_submissions (
  id uuid primary key,
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  email text not null,
  name text not null,
  matched boolean not null default false,
  signed_at timestamptz not null default now(),
  token text not null,
  answer text not null,
  user_agent text,
  ip_status text,
  created_at timestamptz not null default now(),
  unique (session_id, email)
);

alter table public.class_sessions enable row level security;
alter table public.activity_submissions enable row level security;

drop policy if exists "Public read sessions" on public.class_sessions;
create policy "Public read sessions"
on public.class_sessions
for select
to anon
using (true);

drop policy if exists "Public create sessions" on public.class_sessions;
create policy "Public create sessions"
on public.class_sessions
for insert
to anon
with check (true);

drop policy if exists "Public read submissions" on public.activity_submissions;
create policy "Public read submissions"
on public.activity_submissions
for select
to anon
using (true);

drop policy if exists "Public create submissions" on public.activity_submissions;
create policy "Public create submissions"
on public.activity_submissions
for insert
to anon
with check (
  email ~* '^[^[:space:]@]+@(iona\.edu|gaels\.iona\.edu)$'
  and length(answer) > 0
);

alter publication supabase_realtime add table public.class_sessions;
alter publication supabase_realtime add table public.activity_submissions;
