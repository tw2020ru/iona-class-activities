create table if not exists public.course_schedule_meetings (
  id text primary key,
  course_id text not null,
  course_code text not null,
  course_title text not null,
  week integer not null,
  class_meeting integer not null,
  meeting_date date not null,
  start_time time not null,
  end_time time not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null,
  label text not null,
  date_hint text not null,
  activity_name text not null,
  has_question boolean not null default false,
  question_prompt text,
  question_type text,
  question_options text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, meeting_date, class_meeting)
);

alter table public.course_schedule_meetings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'course_schedule_meetings'
      and policyname = 'Public read course schedule'
  ) then
    create policy "Public read course schedule"
    on public.course_schedule_meetings
    for select
    to anon
    using (true);
  end if;
end $$;

with patterns (
  course_id,
  slug,
  course_code,
  course_title,
  first_date,
  count,
  day_label,
  class_meeting,
  start_time,
  end_time,
  time_label,
  location,
  activity_name,
  has_question,
  question_prompt,
  question_type,
  question_options
) as (
  values
    (
      'course-1',
      'bus320',
      'BUS 320-F',
      'Operations Management Analytics',
      date '2026-08-25',
      16,
      'Tue',
      1,
      time '15:30',
      time '16:48',
      '3:30-4:48 PM',
      'LaPenta Business 204',
      'Operations participation check',
      false,
      'What is one operations decision from this week that could be measured with data?',
      'short',
      null::text[]
    ),
    (
      'course-1',
      'bus320',
      'BUS 320-F',
      'Operations Management Analytics',
      date '2026-08-27',
      16,
      'Thu',
      2,
      time '15:30',
      time '16:48',
      '3:30-4:48 PM',
      'LaPenta Business 211',
      'Operations participation check',
      false,
      'What is one operations decision from this week that could be measured with data?',
      'short',
      null::text[]
    ),
    (
      'course-2',
      'bus403',
      'BUS 403-A',
      'Excel for Business',
      date '2026-08-26',
      16,
      'Wed',
      1,
      time '14:00',
      time '14:52',
      '2:00-2:52 PM',
      'LaPenta 212 Trading Floor',
      'Excel lab check',
      false,
      'Which Excel skill from this week''s lab do you expect to use most often?',
      'choice',
      array['Tables', 'Formulas', 'Charts', 'Data cleaning']
    ),
    (
      'course-3',
      'is670',
      'IS 670-A',
      'Artificial Intelligence in Business',
      date '2026-08-26',
      11,
      'Wed',
      1,
      time '18:30',
      time '21:30',
      '6:30-9:30 PM',
      'LaPenta Business 308',
      'AI in business reflection',
      false,
      'Name one business use case where AI creates value and one risk it introduces.',
      'short',
      null::text[]
    ),
    (
      'course-4',
      'mba510',
      'MBA 510-A',
      'Fundamentals of Business Analytics',
      date '2026-08-25',
      11,
      'Tue',
      1,
      time '18:30',
      time '21:45',
      '6:30-9:45 PM',
      'LaPenta Business 211',
      'Analytics workshop response',
      false,
      'What is one business question that analytics can help answer?',
      'short',
      null::text[]
    )
),
expanded as (
  select
    format('%s-w%s-c%s', slug, lpad(week::text, 2, '0'), class_meeting) as id,
    course_id,
    course_code,
    course_title,
    week,
    class_meeting,
    first_date + ((week - 1) * interval '7 days') as meeting_date,
    start_time,
    end_time,
    (first_date + ((week - 1) * interval '7 days') + start_time) at time zone 'America/New_York' as starts_at,
    (first_date + ((week - 1) * interval '7 days') + end_time) at time zone 'America/New_York' as ends_at,
    location,
    'Week ' || week || ' · ' || day_label || ' ' || to_char(first_date + ((week - 1) * interval '7 days'), 'Mon FMDD') ||
      case when course_id = 'course-1' then ' · Class ' || class_meeting else '' end as label,
    day_label || ' ' || to_char(first_date + ((week - 1) * interval '7 days'), 'Mon FMDD') || ' · ' || time_label || ' · ' || location as date_hint,
    activity_name,
    has_question,
    question_prompt,
    question_type,
    question_options
  from patterns
  cross join lateral generate_series(1, count) as week
)
insert into public.course_schedule_meetings (
  id,
  course_id,
  course_code,
  course_title,
  week,
  class_meeting,
  meeting_date,
  start_time,
  end_time,
  starts_at,
  ends_at,
  location,
  label,
  date_hint,
  activity_name,
  has_question,
  question_prompt,
  question_type,
  question_options,
  updated_at
)
select
  id,
  course_id,
  course_code,
  course_title,
  week,
  class_meeting,
  meeting_date::date,
  start_time,
  end_time,
  starts_at,
  ends_at,
  location,
  label,
  date_hint,
  activity_name,
  has_question,
  question_prompt,
  question_type,
  question_options,
  now()
from expanded
on conflict (id) do update set
  course_id = excluded.course_id,
  course_code = excluded.course_code,
  course_title = excluded.course_title,
  week = excluded.week,
  class_meeting = excluded.class_meeting,
  meeting_date = excluded.meeting_date,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  location = excluded.location,
  label = excluded.label,
  date_hint = excluded.date_hint,
  activity_name = excluded.activity_name,
  has_question = excluded.has_question,
  question_prompt = excluded.question_prompt,
  question_type = excluded.question_type,
  question_options = excluded.question_options,
  updated_at = now();
