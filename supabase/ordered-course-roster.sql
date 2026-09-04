create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.instructor_access (
  id boolean primary key default true check (id),
  password_hash text not null
);
revoke all on private.instructor_access from public, anon, authenticated;

alter table public.student_roster
  add column if not exists middle_name text not null default '';

create table if not exists public.course_roster (
  term_code text not null,
  course_code text not null,
  student_id text not null,
  roster_order integer not null check (roster_order > 0),
  last_name text not null,
  first_name text not null,
  middle_name text not null default '',
  source_name text not null,
  username text,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (term_code, course_code, student_id)
);
alter table public.course_roster enable row level security;
revoke all on public.course_roster from public, anon, authenticated;
create index if not exists course_roster_order_idx
  on public.course_roster (term_code, course_code, roster_order) where active;

create or replace function public.verify_instructor_password(input_password text)
returns boolean
language sql security definer set search_path = ''
as $$
  select exists (
    select 1 from private.instructor_access
    where password_hash = encode(sha256(convert_to(input_password, 'UTF8')), 'hex')
  );
$$;
revoke all on function public.verify_instructor_password(text) from public;
grant execute on function public.verify_instructor_password(text) to anon, authenticated;

create or replace function public.instructor_get_course_roster(
  input_password text, input_course_code text, input_term_code text default '4725'
)
returns table (
  student_id text, roster_order integer, last_name text, first_name text,
  middle_name text, source_name text, username text, course_code text
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.verify_instructor_password(input_password) then
    raise exception 'Instructor access required' using errcode = '42501';
  end if;
  return query
    select r.student_id, r.roster_order, r.last_name, r.first_name,
      r.middle_name, r.source_name, r.username, r.course_code
    from public.course_roster r
    where r.term_code = input_term_code and r.course_code = input_course_code and r.active
    order by r.roster_order, r.student_id;
end;
$$;
revoke all on function public.instructor_get_course_roster(text, text, text) from public;
grant execute on function public.instructor_get_course_roster(text, text, text) to anon, authenticated;

create or replace function public.match_roster_username(input_username text, input_course_code text)
returns table (username text, full_name text, matched boolean)
language sql security definer set search_path = ''
as $$
  select r.username, concat_ws(' ', r.first_name, nullif(r.middle_name, ''), r.last_name), true
  from public.course_roster r
  where r.username = lower(trim(input_username))
    and r.course_code = trim(input_course_code)
    and r.term_code = '4725' and r.active
  limit 1;
$$;
revoke all on function public.match_roster_username(text, text) from public;
grant execute on function public.match_roster_username(text, text) to anon, authenticated;
