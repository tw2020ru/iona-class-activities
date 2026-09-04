import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createAttendanceWorkbook } from '../app/attendance-report.ts';

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const password = (await readFile('work/instructor-password.txt', 'utf8')).trim();
const expected = JSON.parse(await readFile('outputs/roster-sync/verified-roster.json', 'utf8'));
const wrongPassword = await client.rpc('verify_instructor_password', { input_password: 'not-the-instructor-password' });
assert.equal(wrongPassword.data, false);
const unauthorized = await client.rpc('instructor_get_course_roster', { input_password: 'not-the-instructor-password', input_course_code: '1141' });
assert.ok(unauthorized.error);
const direct = await client.from('course_roster').select('*');
assert.ok(direct.error || direct.data?.length === 0);
const studentTable = await client.from('student_roster').select('*');
assert.ok(studentTable.error || studentTable.data?.length === 0);
await mkdir('outputs/roster-sync/reports', { recursive: true });
const courses = [['1141', 'course-1', 'BUS 320-F'], ['1142', 'course-2', 'BUS 403-A'], ['2082', 'course-3', 'IS 670-A'], ['1937', 'course-4', 'MBA 510-A']];
for (const [code, id, label] of courses) {
  const { data: roster, error } = await client.rpc('instructor_get_course_roster', { input_password: password, input_course_code: code });
  assert.ifError(error);
  assert.deepEqual(roster.map(row => row.student_id), expected.filter(row => row.course_code === code).map(row => row.student_id));
  assert.ok(roster.every(row => row.username));
  const sampleStudent = roster[0];
  const matched = await client.rpc('match_roster_username', { input_username: sampleStudent.username, input_course_code: code });
  assert.ifError(matched.error);
  assert.equal(matched.data?.[0]?.username, sampleStudent.username);
  const sessions = await client.from('class_sessions').select('*').eq('course_id', id).order('started_at', { ascending: false }).limit(1);
  assert.ifError(sessions.error);
  if (!sessions.data?.length) { console.log(`${label}: roster verified (${roster.length}), no session to export`); continue; }
  const session = sessions.data[0];
  const submissionsResult = await client.from('activity_submissions').select('*').eq('session_id', session.id);
  assert.ifError(submissionsResult.error);
  const rows = submissionsResult.data.map(row => ({ id: row.id, sessionId: row.session_id, email: row.email, name: row.name,
    signedAt: row.signed_at, answer: row.answer, matched: row.matched, ipStatus: row.ip_status ?? '' }));
  const match = session.exercise_id.match(/w(\d+)(?:-c(\d+))?/);
  const week = Number(match?.[1] ?? 1), classMeeting = Number(match?.[2] ?? 1);
  const base = code === '1142' || code === '2082' ? '2026-08-26' : code === '1141' && classMeeting === 2 ? '2026-08-27' : '2026-08-25';
  const date = new Date(`${base}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + (week - 1) * 7);
  const workbook = await createAttendanceWorkbook(roster, rows, { sessionId: session.id, courseCode: label, week, classMeeting, meetingDate: date.toISOString().slice(0, 10) });
  await workbook.xlsx.writeFile(`outputs/roster-sync/reports/${label}.xlsx`);
  const sheet = workbook.getWorksheet('Attendance');
  assert.equal(sheet.rowCount, roster.length + 5);
  console.log(`${label}: ${roster.length} roster rows; ${rows.length} submissions; Excel saved`);
}
console.log('Verified: password protection, private tables, course matching and four-course export order.');
