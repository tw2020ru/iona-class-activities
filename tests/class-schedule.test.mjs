import assert from "node:assert/strict";
import test from "node:test";
import { findSessionToRestore, getMeetingWindow, isWithinMeetingWindow, selectDefaultMeeting } from "../app/class-schedule.ts";

function meeting(id, courseId, date, start, end) {
  return { id, courseId, meetingDate: date, startsAt: `${date}T${start}:00`, endsAt: `${date}T${end}:00` };
}

const schedule = [
  meeting("bus320-w02-c1", "course-1", "2026-09-01", "15:30", "16:48"),
  meeting("mba510-w02-c1", "course-4", "2026-09-01", "18:30", "21:45"),
  meeting("bus403-w02-c1", "course-2", "2026-09-02", "14:00", "14:52"),
  meeting("is670-w02-c1", "course-3", "2026-09-02", "18:30", "21:30"),
  meeting("bus320-w02-c2", "course-1", "2026-09-03", "15:30", "16:48"),
  meeting("bus320-w03-c1", "course-1", "2026-09-08", "15:30", "16:48"),
  meeting("mba510-w03-c1", "course-4", "2026-09-08", "18:30", "21:45"),
];
const at = timestamp => Date.parse(timestamp);
const selected = timestamp => selectDefaultMeeting(schedule, at(timestamp))?.id;

test("all four courses are selected by New York class time, including the second BUS 320 meeting", () => {
  for (const [time, id] of [
    ["2026-09-01T16:00:00-04:00", "bus320-w02-c1"],
    ["2026-09-01T19:00:00-04:00", "mba510-w02-c1"],
    ["2026-09-02T14:15:00-04:00", "bus403-w02-c1"],
    ["2026-09-02T19:00:00-04:00", "is670-w02-c1"],
    ["2026-09-03T16:00:00-04:00", "bus320-w02-c2"],
  ]) assert.equal(selected(time), id);
});

test("the 15-minute reuse window includes both boundaries and then moves to the next class", () => {
  const current = schedule[0];
  for (const time of ["15:15:00", "15:30:00", "16:48:00", "17:03:00"]) {
    const now = at(`2026-09-01T${time}-04:00`);
    assert.equal(isWithinMeetingWindow(current, now), true);
    assert.equal(selectDefaultMeeting(schedule, now)?.id, current.id);
  }
  assert.equal(isWithinMeetingWindow(current, at("2026-09-01T15:14:59-04:00")), false);
  assert.equal(isWithinMeetingWindow(current, at("2026-09-01T17:03:01-04:00")), false);
  assert.equal(selected("2026-09-01T17:03:01-04:00"), "mba510-w02-c1");
});

test("outside class windows, defaults to the next meeting, not a stale saved course", () => {
  assert.equal(selected("2026-09-01T08:00:00-04:00"), "bus320-w02-c1");
  assert.equal(selected("2026-09-02T17:00:00-04:00"), "is670-w02-c1");
  assert.equal(selected("2026-09-05T12:00:00-04:00"), "bus320-w03-c1");
  assert.equal(selectDefaultMeeting(schedule.filter(item => item.courseId === "course-4"), at("2026-09-05T12:00:00-04:00"))?.id, "mba510-w03-c1");
});

test("New York times remain correct across daylight saving and browser time zones", () => {
  const summer = getMeetingWindow(schedule[0]);
  const winter = getMeetingWindow(meeting("nov", "course-1", "2026-11-03", "15:30", "16:48"));
  assert.equal(new Date(summer.startsAt).toISOString(), "2026-09-01T19:30:00.000Z");
  assert.equal(new Date(winter.startsAt).toISOString(), "2026-11-03T20:30:00.000Z");
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "Asia/Shanghai", "America/Los_Angeles"]) {
      process.env.TZ = zone;
      assert.equal(selected("2026-09-01T23:00:00Z"), "mba510-w02-c1");
      assert.equal(getMeetingWindow(schedule[0]).startsAt, summer.startsAt);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("supports full local ISO, explicit offsets, and legacy time-only values without repeating dates", () => {
  const expected = getMeetingWindow(schedule[0]);
  assert.deepEqual(getMeetingWindow({ ...schedule[0], startsAt: "15:30", endsAt: "16:48" }), expected);
  assert.deepEqual(getMeetingWindow({ ...schedule[0], startsAt: "2026-09-01T19:30:00Z", endsAt: "2026-09-01T16:48:00-04:00" }), expected);
  assert.equal(getMeetingWindow({ ...schedule[0], startsAt: "invalid" }), null);
  assert.equal(getMeetingWindow({ ...schedule[0], startsAt: "2026-09-31T15:30:00" }), null);
  assert.equal(getMeetingWindow({ ...schedule[0], endsAt: schedule[0].startsAt }), null);
});

test("current class takes precedence over nearby margins; empty and past-term schedules are safe", () => {
  const nearby = [schedule[0], meeting("next", "course-4", "2026-09-01", "17:00", "18:00")];
  assert.equal(selectDefaultMeeting(nearby, at("2026-09-01T16:47:00-04:00"))?.id, schedule[0].id);
  assert.equal(selectDefaultMeeting(nearby, at("2026-09-01T16:50:00-04:00"))?.id, "next");
  assert.equal(selectDefaultMeeting([], Date.now()), undefined);
  assert.equal(selectDefaultMeeting([{ ...schedule[0], startsAt: "bad" }], Date.now()), undefined);
  assert.equal(selected("2027-01-01T12:00:00-05:00"), "mba510-w03-c1");
});

test("refresh restores only the same active class within its window; no new session is created", () => {
  const now = at("2026-09-01T16:00:00-04:00");
  const current = { id: "current", courseId: "course-1", exerciseId: schedule[0].id, active: true, startedAt: "2026-09-01T19:20:00Z" };
  const newer = { ...current, id: "newer", startedAt: "2026-09-01T19:25:00Z" };
  const closed = { ...current, id: "closed", active: false };
  const oldCourse = { ...current, id: "old", courseId: "course-4", exerciseId: schedule[1].id };
  const records = [closed, oldCourse, current, newer];
  const original = structuredClone(records);
  assert.equal(findSessionToRestore(records, schedule[0], now, "current"), current);
  assert.equal(findSessionToRestore(records, schedule[0], now, "old"), newer);
  assert.equal(findSessionToRestore([closed, oldCourse], schedule[0], now), undefined);
  assert.equal(findSessionToRestore(records, schedule[0], at("2026-09-01T17:03:01-04:00")), undefined);
  assert.equal(findSessionToRestore([], schedule[0], now), undefined);
  assert.deepEqual(records, original);
});
