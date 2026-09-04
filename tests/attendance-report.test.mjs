import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAttendanceRows, createAttendanceWorkbook } from '../app/attendance-report.ts';

const roster = [
  { student_id: '0000002', roster_order: 2, last_name: 'Baker', first_name: 'Jamie', middle_name: 'Lee', source_name: 'Baker,Jamie Lee', username: 'jbaker', course_code: '1141' },
  { student_id: '0000001', roster_order: 1, last_name: 'Allen', first_name: 'Alex', middle_name: '', source_name: 'Allen,Alex', username: 'aallen', course_code: '1141' },
  { student_id: '0000003', roster_order: 3, last_name: 'Clark', first_name: 'Taylor', middle_name: '', source_name: 'Clark,Taylor', username: null, course_code: '1141' },
];
const context = { sessionId: 'session-one', courseCode: 'BUS 320-F', week: 2, classMeeting: 2, meetingDate: '2026-09-03' };
const submission = (id, email, sessionId = context.sessionId) => ({
  id, email, sessionId, name: 'Submitted name', signedAt: '2026-09-03T19:35:00Z',
  answer: '', matched: false, ipStatus: '',
});

test('uses official order, includes absentees and excludes other sessions', () => {
  const report = buildAttendanceRows(roster, [submission('one', 'aallen@gaels.iona.edu'), submission('two', 'jbaker@gaels.iona.edu', 'another-session')], context.sessionId);
  assert.deepEqual(report.rows.map(row => row.student_id), ['0000001', '0000002', '0000003']);
  assert.deepEqual(report.rows.map(row => row.checkedIn), [true, false, false]);
  assert.equal(report.rows[1].middle_name, 'Lee');
  assert.equal(report.unmatched.length, 0);
});

test('counts one username once across email aliases and keeps unmatched submissions', () => {
  const report = buildAttendanceRows(roster, [submission('one', 'AALLEN@gaels.iona.edu'), submission('two', 'aallen@iona.edu'), submission('three', 'visitor@iona.edu')], context.sessionId);
  assert.equal(report.rows.filter(row => row.checkedIn).length, 1);
  assert.equal(report.rows[0].submissionCount, 2);
  assert.equal(report.unmatched.length, 1);
  assert.equal(report.submissions.length, 3);
});

test('exports all absent students even when nobody checked in', async () => {
  const workbook = await createAttendanceWorkbook(roster, [], context);
  const sheet = workbook.getWorksheet('Attendance');
  assert.equal(sheet.rowCount, 8);
  for (let row = 6; row <= 8; row++) {
    assert.equal(sheet.getCell(`F${row}`).value, 'Not checked in');
    assert.equal(sheet.getCell(`C${row}`).font.color.argb, 'FF9C0006');
    assert.equal(sheet.getCell(`O${row}`).fill.fgColor.argb, 'FFFCE4E4');
  }
});

test('saved Excel preserves names, red rows, text IDs, date zone and literal answers', async () => {
  const input = submission('one', 'aallen@iona.edu');
  input.answer = '=HYPERLINK("https://example.invalid", "test")';
  const workbook = await createAttendanceWorkbook(roster, [input, submission('review', 'visitor@iona.edu')], context);
  const buffer = await workbook.xlsx.writeBuffer();
  const { default: ExcelJS } = await import('exceljs');
  const saved = new ExcelJS.Workbook();
  await saved.xlsx.load(buffer);
  const sheet = saved.getWorksheet('Attendance');
  assert.equal(sheet.getCell('B6').value, '0000001');
  assert.equal(sheet.getCell('L6').value, input.answer);
  assert.equal(sheet.getCell('E7').value, 'Lee');
  assert.equal(sheet.getCell('G6').value.toISOString(), '2026-09-03T15:35:00.000Z');
  assert.equal(sheet.getCell('C7').fill.fgColor.argb, 'FFFCE4E4');
  assert.equal(saved.getWorksheet('Needs review').rowCount, 2);
  assert.equal(saved.getWorksheet('Submissions').rowCount, 3);
  assert.equal(sheet.autoFilter, 'A5:O8');
});

test('fails closed when no official roster is available', async () => {
  await assert.rejects(createAttendanceWorkbook([], [], context), /roster is unavailable/);
});
