import { TZDateMini } from "@date-fns/tz";

export const courseTimeZone = "America/New_York";
const sessionMarginMs = 15 * 60 * 1000;

export type ScheduledMeeting = {
  id: string;
  courseId: string;
  meetingDate: string;
  startsAt: string;
  endsAt: string;
};

type RecordedSession = {
  id: string;
  courseId: string;
  exerciseId: string;
  active: boolean;
  startedAt: string;
};

function meetingTimestamp(value: string, dateKey: string): number {
  const timestamp = value.includes("T") ? value : `${dateKey}T${value}`;
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)) return Date.parse(timestamp);
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timestamp);
  if (!parts) return NaN;
  const [year, month, day, hour, minute, second] = parts.slice(1).map(part => Number(part ?? 0));
  // Schedule timestamps are New York wall time, not the browser's local time.
  const date = new TZDateMini(year, month - 1, day, hour, minute, second, courseTimeZone);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ||
      date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) return NaN;
  return date.getTime();
}

export function getMeetingWindow(meeting?: ScheduledMeeting) {
  if (!meeting) return null;
  const startsAt = meetingTimestamp(meeting.startsAt, meeting.meetingDate);
  const endsAt = meetingTimestamp(meeting.endsAt, meeting.meetingDate);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= startsAt) return null;
  return { startsAt, endsAt, opensAt: startsAt - sessionMarginMs, closesAt: endsAt + sessionMarginMs };
}

export function isWithinMeetingWindow(meeting: ScheduledMeeting | undefined, now = Date.now()) {
  const window = getMeetingWindow(meeting);
  return Boolean(window && now >= window.opensAt && now <= window.closesAt);
}

export function selectDefaultMeeting<T extends ScheduledMeeting>(meetings: readonly T[], now = Date.now()): T | undefined {
  const scheduled = meetings.flatMap(meeting => {
    const window = getMeetingWindow(meeting);
    return window ? [{ meeting, ...window }] : [];
  }).sort((a, b) => a.startsAt - b.startsAt || a.meeting.id.localeCompare(b.meeting.id));
  const current = scheduled.find(item => now >= item.startsAt && now <= item.endsAt);
  const startingSoon = scheduled.find(item => now >= item.opensAt && now < item.startsAt);
  const justEnded = scheduled.filter(item => now > item.endsAt && now <= item.closesAt).at(-1);
  const next = scheduled.find(item => item.startsAt > now);
  return (current ?? startingSoon ?? justEnded ?? next ?? scheduled.at(-1))?.meeting;
}

export function findSessionToRestore<T extends RecordedSession>(
  sessions: readonly T[], meeting: ScheduledMeeting, now = Date.now(), preferredId?: string,
): T | undefined {
  if (!isWithinMeetingWindow(meeting, now)) return undefined;
  const matching = sessions.filter(item => item.active && item.courseId === meeting.courseId && item.exerciseId === meeting.id);
  return matching.find(item => item.id === preferredId) ??
    matching.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
}
