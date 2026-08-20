drop policy if exists "Public create submissions" on public.activity_submissions;

create policy "Public create submissions"
on public.activity_submissions
for insert
to anon
with check (
  email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
);
