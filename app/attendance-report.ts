export type RosterEntry = {
  student_id: string;
  roster_order: number;
  last_name: string;
  first_name: string;
  middle_name: string;
  source_name: string;
  username: string | null;
  course_code: string;
};

export type AttendanceSubmission = {
  id: string;
  sessionId: string;
  email: string;
  name: string;
  signedAt: string;
  answer: string;
  matched: boolean;
  ipStatus: string;
};

export type AttendanceRow = RosterEntry & {
  checkedIn: boolean;
  signedAt: string;
  email: string;
  answer: string;
  ipStatus: string;
  submissionCount: number;
};

export function submissionUsername(email: string) {
  return email.trim().toLowerCase().split('@')[0];
}

export function buildAttendanceRows(roster: RosterEntry[], submissions: AttendanceSubmission[], sessionId: string) {
  const sessionRows = submissions.filter(row => row.sessionId === sessionId)
    .sort((a, b) => a.signedAt.localeCompare(b.signedAt));
  const knownUsernames = new Set(roster.map(row => row.username?.toLowerCase()).filter(Boolean));
  const rows: AttendanceRow[] = [...roster].sort((a, b) => a.roster_order - b.roster_order).map(student => {
    const matches = student.username ? sessionRows.filter(row => submissionUsername(row.email) === student.username?.toLowerCase()) : [];
    return {
      ...student, checkedIn: matches.length > 0, signedAt: matches[0]?.signedAt ?? '',
      email: [...new Set(matches.map(row => row.email))].join('; '),
      answer: [...new Set(matches.map(row => row.answer).filter(Boolean))].join('\n'),
      ipStatus: [...new Set(matches.map(row => row.ipStatus).filter(Boolean))].join('; '),
      submissionCount: matches.length,
    };
  });
  return { rows, unmatched: sessionRows.filter(row => !knownUsernames.has(submissionUsername(row.email))), submissions: sessionRows };
}

export type AttendanceReportContext = {
  sessionId: string;
  courseCode: string;
  week: number;
  classMeeting: number;
  meetingDate: string;
};

function newYorkExcelDate(iso: string) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (name: string) => parts.find(item => item.type === name)?.value;
  return new Date(`${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}Z`);
}

export async function createAttendanceWorkbook(roster: RosterEntry[], submissions: AttendanceSubmission[], context: AttendanceReportContext) {
  if (!roster.length) throw new Error('The course roster is unavailable. Refresh the roster before exporting.');
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Iona Class Activities';
  workbook.created = new Date();
  const report = buildAttendanceRows(roster, submissions, context.sessionId);
  const sheet = workbook.addWorksheet('Attendance', {
    views: [{ state: 'frozen', ySplit: 5, xSplit: 5 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const columns = [
    ['Order', 8], ['Student ID', 13], ['Last name', 24], ['First name', 20], ['Middle name', 24],
    ['Attendance', 18], ['Checked in (New York)', 25], ['Username', 23], ['Submitted email', 36],
    ['Course', 16], ['Week / class', 16], ['Answer', 46], ['Roster', 22], ['IP', 28], ['PeopleSoft name', 34],
  ] as const;
  sheet.columns = columns.map(([, width]) => ({ width }));
  sheet.mergeCells('A1:O1');
  sheet.getCell('A1').value = `${context.courseCode} | ${context.meetingDate} | Week ${context.week} / ${context.classMeeting}`;
  sheet.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF6F2C3E' } };
  sheet.getRow(1).height = 30;
  sheet.mergeCells('A2:O2');
  sheet.getCell('A2').value = `Expected: ${report.rows.length}   Checked in: ${report.rows.filter(row => row.checkedIn).length}   Not checked in: ${report.rows.filter(row => !row.checkedIn).length}   Submissions needing review: ${report.unmatched.length}`;
  sheet.mergeCells('A3:O3');
  sheet.getCell('A3').value = `Session: ${context.sessionId}`;
  sheet.addRow([]);
  sheet.getRow(5).values = columns.map(([name]) => name);
  sheet.getRow(5).height = 28;
  sheet.getRow(5).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6F2C3E' } };
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  for (const entry of report.rows) {
    const row = sheet.addRow([
      entry.roster_order, entry.student_id, entry.last_name, entry.first_name, entry.middle_name || null,
      entry.checkedIn ? 'Checked in' : 'Not checked in', newYorkExcelDate(entry.signedAt), entry.username ?? '',
      entry.email, context.courseCode, `Week ${context.week} / ${context.classMeeting}`, entry.answer,
      entry.username ? 'Matched roster' : 'Username pending', entry.ipStatus, entry.source_name,
    ]);
    row.height = 30;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { name: 'Calibri', size: 11, color: { argb: entry.checkedIn ? 'FF232629' : 'FF9C0006' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: entry.checkedIn ? 'FFFFFFFF' : 'FFFCE4E4' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFD8DCE0' } } };
    });
    row.getCell(2).numFmt = '@';
    row.getCell(7).numFmt = 'yyyy-mm-dd hh:mm:ss';
  }
  sheet.autoFilter = `A5:O${sheet.rowCount}`;
  sheet.pageSetup.printTitlesRow = '1:5';

  const appendSubmissions = (name: string, items: AttendanceSubmission[]) => {
    const audit = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    audit.columns = [
      { header: 'Course', width: 16 }, { header: 'Week / class', width: 18 },
      { header: 'Checked in (New York)', width: 25 }, { header: 'Username', width: 24 },
      { header: 'Submitted email', width: 38 }, { header: 'Submitted name', width: 28 },
      { header: 'Answer', width: 48 }, { header: 'Roster at check-in', width: 24 },
      { header: 'IP', width: 28 }, { header: 'Submission ID', width: 40 },
    ];
    for (const entry of items) {
      const row = audit.addRow([context.courseCode, `Week ${context.week} / ${context.classMeeting}`,
        newYorkExcelDate(entry.signedAt), submissionUsername(entry.email), entry.email, entry.name,
        entry.answer, entry.matched ? 'Matched' : 'Review', entry.ipStatus, entry.id]);
      row.getCell(3).numFmt = 'yyyy-mm-dd hh:mm:ss';
      row.alignment = { vertical: 'top', wrapText: true };
    }
    audit.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    audit.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6F2C3E' } };
    audit.getRow(1).height = 26;
    audit.autoFilter = `A1:J${Math.max(audit.rowCount, 1)}`;
  };
  if (report.unmatched.length) appendSubmissions('Needs review', report.unmatched);
  appendSubmissions('Submissions', report.submissions);
  return workbook;
}

export async function downloadAttendanceWorkbook(roster: RosterEntry[], submissions: AttendanceSubmission[], context: AttendanceReportContext) {
  const workbook = await createAttendanceWorkbook(roster, submissions, context);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${context.courseCode}-${context.meetingDate}-week-${context.week}-class-${context.classMeeting}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
