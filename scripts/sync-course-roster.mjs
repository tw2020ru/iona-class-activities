import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import pg from 'pg';

const codes = ['1141', '1142', '2082', '1937'];
const expected = { '1141': 29, '1142': 29, '2082': 5, '1937': 13 };
const sourcePath = process.env.ROSTER_SOURCE ?? 'work/peoplesoft-roster-2026-09-03.tsv';
const source = parse(await readFile(sourcePath, 'utf8'), { columns: true, delimiter: '\t', skip_empty_lines: true });
const csvFiles = (await readdir('.')).filter(name => /^\d{4}\.4725_20260825\.csv$/.test(name));
const bbRows = (await Promise.all(csvFiles.map(async name =>
  parse(await readFile(name, 'utf8'), { columns: true, bom: true, skip_empty_lines: true })
))).flat();
const byId = new Map();
for (const row of bbRows) {
  const id = row['Student ID']?.trim();
  if (!id) continue;
  if (byId.has(id) && byId.get(id).Username !== row.Username) throw new Error(`Conflicting usernames for student ID ${id}`);
  byId.set(id, row);
}
const overrides = JSON.parse(await readFile('work/roster-username-overrides.json', 'utf8').catch(() => '{}'));
const roster = source.map(row => {
  const comma = row.source_name.indexOf(',');
  if (comma < 1) throw new Error('A roster source name has no surname separator');
  const lastName = row.source_name.slice(0, comma).trim();
  const givenNames = row.source_name.slice(comma + 1).trim();
  let bb = byId.get(row.student_id);
  if (!bb) {
    const matches = bbRows.filter(item => !item['Student ID'] &&
      item['Last Name'].trim().toLowerCase() === lastName.toLowerCase() &&
      item['First Name'].trim().toLowerCase() === givenNames.toLowerCase());
    if (new Set(matches.map(item => item.Username)).size === 1) bb = matches[0];
  }
  // The source is Last,First Middle. Keep source_name intact for reconciliation.
  const firstName = givenNames.split(/\s+/)[0];
  return {
    term_code: '4725', course_code: row.course_code, student_id: row.student_id,
    roster_order: Number(row.roster_order), last_name: lastName,
    first_name: firstName, middle_name: givenNames.slice(firstName.length).trim(),
    source_name: row.source_name, username: overrides[row.student_id] ?? bb?.Username?.trim().toLowerCase() ?? null,
  };
});
for (const code of codes) {
  const rows = roster.filter(row => row.course_code === code);
  if (rows.length !== expected[code] || new Set(rows.map(row => row.student_id)).size !== rows.length ||
      rows.some((row, index) => row.roster_order !== index + 1)) throw new Error(`Invalid count/order for ${code}`);
}
await mkdir('outputs/roster-sync', { recursive: true });
await writeFile('outputs/roster-sync/verified-roster.json', JSON.stringify(roster, null, 2));
console.log(JSON.stringify({ counts: Object.fromEntries(codes.map(code => [code, roster.filter(r => r.course_code === code).length])),
  missingUsernames: roster.filter(row => !row.username).map(row => ({ course: row.course_code, name: row.source_name, studentId: row.student_id })) }));
if (!process.argv.includes('--apply') && !process.argv.includes('--check')) process.exit(0);

const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST ?? `db.${ref}.supabase.co`,
  port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
  user: process.env.SUPABASE_DB_USER ?? 'postgres', database: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD, connectionTimeoutMillis: 12000,
  ssl: { rejectUnauthorized: true, ca: await readFile(process.env.SUPABASE_DB_CA ?? 'work/supabase-prod-ca-2021.crt', 'utf8') },
});
try {
  await client.connect();
  const before = await client.query('select * from public.student_roster order by username');
  const countsBefore = (await client.query('select (select count(*) from public.class_sessions) as sessions, (select count(*) from public.activity_submissions) as submissions')).rows[0];
  console.log(JSON.stringify({ existingRosterRows: before.rowCount, attendanceCounts: countsBefore }));
  if (process.argv.includes('--apply')) {
    await writeFile(`outputs/roster-sync/roster-before-${Date.now()}.json`, JSON.stringify(before.rows, null, 2));
    let password = (await readFile('work/instructor-password.txt', 'utf8').catch(() => '')).trim();
    if (!password) {
      password = randomBytes(18).toString('base64url');
      await writeFile('work/instructor-password.txt', password + '\n');
    }
    await client.query('begin');
    await client.query(await readFile('supabase/ordered-course-roster.sql', 'utf8'));
    const existingSecret = (await client.query('select password_hash from private.instructor_access where id')).rows[0];
    const hash = createHash('sha256').update(password).digest('hex');
    if (existingSecret && existingSecret.password_hash !== hash) throw new Error('Existing instructor key differs from the local key; no changes applied');
    await client.query('insert into private.instructor_access(id,password_hash) values(true,$1) on conflict(id) do nothing', [hash]);
    await client.query('update public.course_roster set active=false where term_code=$1 and course_code=any($2::text[])', ['4725', codes]);
    for (const r of roster) {
      await client.query(`insert into public.course_roster(term_code,course_code,student_id,roster_order,last_name,first_name,middle_name,source_name,username)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(term_code,course_code,student_id) do update set
        roster_order=excluded.roster_order,last_name=excluded.last_name,first_name=excluded.first_name,middle_name=excluded.middle_name,
        source_name=excluded.source_name,username=excluded.username,active=true,updated_at=now()`,
      [r.term_code,r.course_code,r.student_id,r.roster_order,r.last_name,r.first_name,r.middle_name,r.source_name,r.username]);
    }
    await client.query(`update public.student_roster set source_courses=array(select unnest(source_courses) except select unnest($1::text[])),updated_at=now()
      where source_courses && $1::text[]`, [codes]);
    const students = new Map(roster.filter(row => row.username).map(row => [row.username, row]));
    for (const [username, r] of students) {
      const memberships = roster.filter(row => row.username === username).map(row => row.course_code);
      await client.query(`insert into public.student_roster(username,first_name,last_name,middle_name,student_id,email_primary,source_courses)
        values($1,$2,$3,$4,$5,$6,$7) on conflict(username) do update set
        first_name=excluded.first_name,last_name=excluded.last_name,middle_name=excluded.middle_name,student_id=excluded.student_id,
        source_courses=array(select distinct unnest(public.student_roster.source_courses || excluded.source_courses)),active=true,updated_at=now()`,
      [username,r.first_name,r.last_name,r.middle_name,r.student_id,`${username}@gaels.iona.edu`,memberships]);
    }
    const after = (await client.query('select course_code,count(*)::int as students from public.course_roster where active and term_code=$1 group by course_code order by course_code', ['4725'])).rows;
    for (const row of after) if (codes.includes(row.course_code) && row.students !== expected[row.course_code]) throw new Error('Database count mismatch');
    const countsAfter = (await client.query('select (select count(*) from public.class_sessions) as sessions, (select count(*) from public.activity_submissions) as submissions')).rows[0];
    if (JSON.stringify(countsAfter) !== JSON.stringify(countsBefore)) throw new Error('Attendance counts changed during roster sync; retry');
    await client.query('commit');
    console.log(JSON.stringify({ applied: true, counts: after, attendancePreserved: true, instructorPasswordFile: 'work/instructor-password.txt' }));
  }
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error(`${error.code ?? 'ERROR'}: ${error.message}`);
  process.exitCode = 1;
} finally { await client.end(); }
