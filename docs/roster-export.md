# Course roster and Excel reports

The current app uses Vite, Vercel and the existing Supabase project. No paid service is required for roster matching or Excel generation. ExcelJS is loaded only when a teacher exports a workbook.

## Source and identity

- PeopleSoft Attendance > View supplies student IDs, display names and the explicit per-course row order.
- Blackboard CSVs supply usernames; match by student ID. A unique exact full-name match is used only when the Blackboard student ID is missing.
- Verified username exceptions are stored locally in `work/roster-username-overrides.json`.
- Source names use `Last,First Middle`. Surnames are everything before the comma; the first given-name token is stored as `first_name` and the remaining tokens as `middle_name`. Multiword given names may need manual correction. `source_name` always preserves the full PeopleSoft display name.
- No first/middle names are guessed for unmatched submissions.

The current term code is 4725. Course codes: BUS 320 = 1141, BUS 403 = 1142, IS 670 = 2082, MBA 510 = 1937.

## Private data

`course_roster` stores course membership, student ID, separate name fields, username and `roster_order`. RLS is enabled and anonymous users cannot select the table. The instructor RPC checks a server-stored password hash before returning a course roster. The password is not embedded in the client build. The browser retains it in session storage until Lock or the tab session ends.

This change protects roster reads. It does not change the pre-existing public policies on `class_sessions` or `activity_submissions`; those need a separate server-side access migration.

The locally generated instructor password is in `work/instructor-password.txt`. Do not commit it, the roster CSV/TSV/JSON, or generated reports. Do not reuse the database password for instructor access.

## Updating rosters

1. Save the observed course records as a local TSV with `course_code`, `roster_order`, `student_id`, `source_name` columns. Preserve leading zeros in IDs.
2. Set `ROSTER_SOURCE` when using a different source file and adjust expected counts in `scripts/sync-course-roster.mjs` after verifying enrollment.
3. Download the public Supabase root certificate from the official dashboard or the URL in Supabase's official `apps/studio/hooks/custom-content/custom-content.json`. Save it to `work/supabase-prod-ca-2021.crt`, or set `SUPABASE_DB_CA`.
4. Run `node --env-file=.env.local scripts/sync-course-roster.mjs` to preview, `--check` to check the database, then `--apply` to update. The script backs up existing roster rows locally, uses a transaction, and does not alter attendance submissions or sessions.
5. Run `node --env-file=.env.local scripts/verify-roster-export.mjs` to check private access, course matching and exports using live read-only queries.

Existing roster rows outside these four courses are preserved. Removed course memberships are deactivated rather than deleting student/session records.

## Downloads

- Select a recorded session in Backend, then Export Excel, or use End session & export Excel.
- The Attendance sheet lists every enrolled student in the current PeopleSoft order. Students with no check-in are dark red on a pale red row, including when nobody checked in.
- First check-in time is displayed in America/New_York time. IDs remain text with leading zeros.
- Matching uses the session course and username, ignoring email suffix/case. Multiple submissions for the same username count once; all raw submissions remain on the Submissions sheet.
- Records not in that course's roster go to Needs review, never silently disappearing or counting as another student's attendance.
- Historical exports currently use the latest roster for the selected course, not a historical enrollment snapshot.
- Fresh roster and attendance reads are required before export. A failed read produces an error instead of downloading an incomplete all-absent report.

Run `npm run test:attendance` with Node 22.13+ or the bundled Node runtime, followed by `npm run build`.
