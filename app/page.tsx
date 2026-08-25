"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Course = {
  id: string;
  code: string;
  title: string;
  meeting: string;
};

type Student = {
  email: string;
  name: string;
  courseIds: string[];
};

type Question = {
  id: string;
  prompt: string;
  type: "choice" | "short";
  options?: string[];
};

type Exercise = {
  id: string;
  courseId: string;
  week: number;
  classMeeting: number;
  meetingDate: string;
  startsAt: string;
  endsAt: string;
  location: string;
  label: string;
  dateHint: string;
  activityName: string;
  hasQuestion: boolean;
  question: Question;
};

type Session = {
  id: string;
  courseId: string;
  exerciseId: string;
  label: string;
  active: boolean;
  tokenSeed: string;
  startedAt: string;
};

type Submission = {
  id: string;
  sessionId: string;
  email: string;
  name: string;
  matched: boolean;
  signedAt: string;
  token: string;
  answer: string;
  userAgent: string;
  ipStatus: string;
};

const courses: Course[] = [
  {
    id: "course-1",
    code: "BUS 320-F",
    title: "Operations Management Analytics",
    meeting: "Tue/Thu 3:30-4:48 PM · LaPenta Business 204/211",
  },
  {
    id: "course-2",
    code: "BUS 403-A",
    title: "Excel for Business",
    meeting: "Wed 2:00-2:52 PM · LaPenta 212 Trading Floor",
  },
  {
    id: "course-3",
    code: "IS 670-A",
    title: "Artificial Intelligence in Business",
    meeting: "Wed 6:30-9:30 PM · LaPenta Business 308",
  },
  {
    id: "course-4",
    code: "MBA 510-A",
    title: "Fundamentals of Business Analytics",
    meeting: "Tue 6:30-9:45 PM · LaPenta Business 211",
  },
];

const courseEnrollmentCounts: Record<string, number> = {
  "course-1": 29,
  "course-2": 29,
  "course-3": 12,
  "course-4": 6,
};

const roster: Student[] = [
  {
    email: "student.one@iona.edu",
    name: "Student One",
    courseIds: ["course-1", "course-3"],
  },
  {
    email: "student.two@gaels.iona.edu",
    name: "Student Two",
    courseIds: ["course-1", "course-2"],
  },
  {
    email: "student.three@iona.edu",
    name: "Student Three",
    courseIds: ["course-4"],
  },
];

const activityDefaults = {
  "course-1": {
    activityName: "Operations participation check",
    hasQuestion: false,
    prompt: "What is one operations decision from this week that could be measured with data?",
    type: "short" as const,
  },
  "course-2": {
    activityName: "Excel lab check",
    hasQuestion: false,
    prompt: "Which Excel skill from this week's lab do you expect to use most often?",
    type: "choice" as const,
    options: ["Tables", "Formulas", "Charts", "Data cleaning"],
  },
  "course-3": {
    activityName: "AI in business reflection",
    hasQuestion: false,
    prompt: "Name one business use case where AI creates value and one risk it introduces.",
    type: "short" as const,
  },
  "course-4": {
    activityName: "Analytics workshop response",
    hasQuestion: false,
    prompt: "What is one business question that analytics can help answer?",
    type: "short" as const,
  },
};

const courseMeetingPatterns = [
  {
    courseId: "course-1",
    slug: "bus320",
    firstDate: "2026-08-25",
    count: 16,
    dayLabel: "Tue",
    classMeeting: 1,
    startTime: "15:30",
    endTime: "16:48",
    timeLabel: "3:30-4:48 PM",
    location: "LaPenta Business 204",
  },
  {
    courseId: "course-1",
    slug: "bus320",
    firstDate: "2026-08-27",
    count: 16,
    dayLabel: "Thu",
    classMeeting: 2,
    startTime: "15:30",
    endTime: "16:48",
    timeLabel: "3:30-4:48 PM",
    location: "LaPenta Business 211",
  },
  {
    courseId: "course-2",
    slug: "bus403",
    firstDate: "2026-08-26",
    count: 16,
    dayLabel: "Wed",
    classMeeting: 1,
    startTime: "14:00",
    endTime: "14:52",
    timeLabel: "2:00-2:52 PM",
    location: "LaPenta 212 Trading Floor",
  },
  {
    courseId: "course-3",
    slug: "is670",
    firstDate: "2026-08-26",
    count: 11,
    dayLabel: "Wed",
    classMeeting: 1,
    startTime: "18:30",
    endTime: "21:30",
    timeLabel: "6:30-9:30 PM",
    location: "LaPenta Business 308",
  },
  {
    courseId: "course-4",
    slug: "mba510",
    firstDate: "2026-08-25",
    count: 11,
    dayLabel: "Tue",
    classMeeting: 1,
    startTime: "18:30",
    endTime: "21:45",
    timeLabel: "6:30-9:45 PM",
    location: "LaPenta Business 211",
  },
];

function addWeeks(dateKey: string, weeks: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(`${dateKey}T12:00:00`));
}

function getNewYorkDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/New_York",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const exercises: Exercise[] = courseMeetingPatterns
  .flatMap((pattern) =>
    Array.from({ length: pattern.count }, (_, index) => {
      const defaults = activityDefaults[pattern.courseId as keyof typeof activityDefaults];
      const meetingDate = addWeeks(pattern.firstDate, index);
      const week = index + 1;
      const classSuffix = pattern.classMeeting > 1 || pattern.courseId === "course-1" ? ` · Class ${pattern.classMeeting}` : "";
      return {
        id: `${pattern.slug}-w${String(week).padStart(2, "0")}-c${pattern.classMeeting}`,
        courseId: pattern.courseId,
        week,
        classMeeting: pattern.classMeeting,
        meetingDate,
        startsAt: `${meetingDate}T${pattern.startTime}:00`,
        endsAt: `${meetingDate}T${pattern.endTime}:00`,
        location: pattern.location,
        label: `Week ${week} · ${pattern.dayLabel} ${formatShortDate(meetingDate)}${classSuffix}`,
        dateHint: `${pattern.dayLabel} ${formatShortDate(meetingDate)} · ${pattern.timeLabel} · ${pattern.location}`,
        activityName: defaults.activityName,
        hasQuestion: defaults.hasQuestion,
        question: {
          id: `q-${pattern.slug}-w${String(week).padStart(2, "0")}-c${pattern.classMeeting}`,
          prompt: defaults.prompt,
          type: defaults.type,
          options: "options" in defaults ? defaults.options : undefined,
        },
      };
    }),
  )
  .sort((first, second) => first.meetingDate.localeCompare(second.meetingDate) || first.classMeeting - second.classMeeting);

function getCourseExercises(courseId: string) {
  return exercises.filter((exercise) => exercise.courseId === courseId);
}

function getDefaultExerciseId(courseId: string, date = new Date()) {
  const courseExercises = getCourseExercises(courseId);
  const today = getNewYorkDateKey(date);
  return courseExercises.find((exercise) => exercise.meetingDate >= today)?.id ?? courseExercises.at(-1)?.id ?? exercises[0].id;
}

const emailPattern = /^[^\s@]+@[^@\s]+\.[^@\s]+$/i;
const usernamePattern = /^[a-z0-9._-]+$/i;
const tickMs = 45_000;
const tokenGraceMs = 75_000;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const publicSiteUrl = "https://iona-class-activities.vercel.app";
const ionaKnotSrc =
  "https://d1ctk4ronrg3qz.cloudfront.net/admin/1659367858478_IONA-University_PrimaryStacked-LightBG.png";

function loadSubmissions() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("iona-submissions") ?? "[]");
  } catch {
    return [];
  }
}

function saveSubmissions(items: Submission[]) {
  localStorage.setItem("iona-submissions", JSON.stringify(items));
  window.dispatchEvent(new Event("iona-submissions-updated"));
}

async function loadRemoteSubmissions() {
  if (!supabase) return loadSubmissions();
  const { data, error } = await supabase
    .from("activity_submissions")
    .select("id, session_id, email, name, matched, signed_at, token, answer, user_agent, ip_status")
    .order("signed_at", { ascending: false });
  if (error || !data) return loadSubmissions();
  return data.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    email: row.email,
    name: row.name,
    matched: row.matched,
    signedAt: row.signed_at,
    token: row.token,
    answer: row.answer,
    userAgent: row.user_agent ?? "",
    ipStatus: row.ip_status ?? "Captured by Supabase request path",
  }));
}

function makeTokenForBucket(session: Session, bucket: number) {
  const raw = `${session.tokenSeed}-${bucket}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).toUpperCase().slice(0, 6).padStart(6, "0");
}

function makeToken(session: Session, now: number) {
  return makeTokenForBucket(session, Math.floor(now / tickMs));
}

function isRecentToken(session: Session, tokenToCheck: string, now: number) {
  const currentBucket = Math.floor(now / tickMs);
  const normalizedToken = tokenToCheck.toUpperCase();
  const bucketsToCheck = Math.ceil((tickMs + tokenGraceMs) / tickMs) + 1;
  return Array.from({ length: bucketsToCheck }, (_, index) => currentBucket - index).some((bucket) => {
    const tokenExpiresAt = (bucket + 1) * tickMs + tokenGraceMs;
    return now <= tokenExpiresAt && makeTokenForBucket(session, bucket) === normalizedToken;
  });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeStudentEmail(value: string, domain: string) {
  const cleanValue = value.trim().toLowerCase();
  if (!cleanValue) return "";
  if (cleanValue.includes("@")) return cleanValue;
  return `${cleanValue}@${domain}`;
}

function getUsername(value: string) {
  return normalizeEmail(value).split("@")[0] ?? "";
}

function getStudent(email: string) {
  const username = getUsername(email);
  return roster.find((student) => getUsername(student.email) === username);
}

async function matchRosterUsername(username: string) {
  if (!supabase) {
    const localStudent = roster.find((student) => getUsername(student.email) === username);
    return {
      matched: Boolean(localStudent),
      name: localStudent?.name ?? username,
    };
  }
  const { data, error } = await supabase.rpc("match_roster_username", { input_username: username });
  if (error || !data?.length) {
    return {
      matched: false,
      name: username,
    };
  }
  return {
    matched: true,
    name: data[0].full_name || username,
  };
}

function downloadCsv(rows: Submission[], activeSession: Session) {
  const headers = [
    "course",
    "session",
    "exercise",
    "exercise_date",
    "username",
    "email",
    "name",
    "matched_roster",
    "signed_at",
    "token",
    "answer",
    "attendance_score",
    "response_score",
    "total_score",
    "ip_status",
    "user_agent",
  ];
  const course = courses.find((item) => item.id === activeSession.courseId);
  const exercise = exercises.find((item) => item.id === activeSession.exerciseId);
  const csvRows = rows.map((row) =>
    [
      course?.code ?? "",
      activeSession.label,
      exercise?.label ?? "",
      exercise?.dateHint ?? "",
      getUsername(row.email),
      row.email,
      row.name,
      row.matched ? "yes" : "no",
      row.signedAt,
      row.token,
      row.answer,
      "1",
      row.answer.trim() ? "1" : "0",
      String(1 + (row.answer.trim() ? 1 : 0)),
      row.ipStatus,
      row.userAgent,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${course?.code ?? "course"}-${activeSession.label}-activity.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0].id);
  const [selectedExerciseId, setSelectedExerciseId] = useState(() => getDefaultExerciseId(courses[0].id));
  const [view, setView] = useState<"console" | "projection" | "backend">("console");
  const [session, setSession] = useState<Session>(() => ({
    id: crypto.randomUUID(),
    courseId: courses[0].id,
    exerciseId: getDefaultExerciseId(courses[0].id),
    label: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    active: true,
    tokenSeed: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
  }));
  const [now, setNow] = useState(Date.now());
  const [email, setEmail] = useState("");
  const [emailDomain, setEmailDomain] = useState("gaels.iona.edu");
  const [customEmailDomain, setCustomEmailDomain] = useState("");
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [checkedInSubmission, setCheckedInSubmission] = useState<Submission | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    loadRemoteSubmissions().then(setSubmissions);
    const refresh = () => loadRemoteSubmissions().then(setSubmissions);
    const clockInterval = window.setInterval(() => setNow(Date.now()), 1000);
    const submissionsRefreshInterval = window.setInterval(refresh, 10000);
    window.addEventListener("iona-submissions-updated", refresh);
    window.addEventListener("storage", refresh);
    const sessionId = new URLSearchParams(window.location.search).get("session");
    if (sessionId && supabase) {
      supabase
        .from("class_sessions")
        .select("id, course_id, exercise_id, label, active, token_seed, started_at")
        .eq("id", sessionId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setSession({
              id: data.id,
              courseId: data.course_id,
              exerciseId: data.exercise_id,
              label: data.label,
              active: data.active,
              tokenSeed: data.token_seed,
              startedAt: data.started_at,
            });
            setView("projection");
          }
        });
    }
    const channel = supabase
      ?.channel("classroom-activity")
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_submissions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "class_sessions" }, refresh)
      .subscribe();
    return () => {
      window.clearInterval(clockInterval);
      window.clearInterval(submissionsRefreshInterval);
      window.removeEventListener("iona-submissions-updated", refresh);
      window.removeEventListener("storage", refresh);
      if (channel) {
        supabase?.removeChannel(channel);
      }
    };
  }, []);

  const selectedCourseExercises = getCourseExercises(selectedCourseId);
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? courses[0];
  const activeCourse = courses.find((course) => course.id === session.courseId) ?? courses[0];
  const activeExercise = exercises.find((exercise) => exercise.id === session.exerciseId) ?? exercises[0];
  const activeQuestion = activeExercise.question;
  const token = makeToken(session, now);
  const secondsLeft = tickMs / 1000 - Math.floor((now % tickMs) / 1000);
  const isStudentMode =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("student") === "1";
  const joinUrl =
    typeof window === "undefined"
      ? ""
      : `${publicSiteUrl}/?student=1&session=${session.id}&exercise=${activeExercise.id}&token=${token}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(joinUrl)}`;

  const sessionRows = useMemo(
    () => submissions.filter((item) => item.sessionId === session.id),
    [session.id, submissions],
  );
  const expectedCount = courseEnrollmentCounts[session.courseId] ?? roster.length;
  const answeredCount = sessionRows.filter((row) => row.answer.trim()).length;
  const rosterLeft = Math.max(expectedCount - sessionRows.length, 0);

  async function startSession() {
    const nextSession = {
      id: crypto.randomUUID(),
      courseId: selectedCourseId,
      exerciseId: selectedExerciseId,
      label: new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      active: true,
      tokenSeed: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
    };
    setSession(nextSession);
    if (supabase) {
      await supabase.from("class_sessions").insert({
        id: nextSession.id,
        course_id: nextSession.courseId,
        exercise_id: nextSession.exerciseId,
        label: nextSession.label,
        active: nextSession.active,
        token_seed: nextSession.tokenSeed,
        started_at: nextSession.startedAt,
      });
    }
    setView("projection");
    setMessage("");
    setAnswer("");
    setCheckedInSubmission(null);
  }

  async function submitStudent() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSessionId = urlParams.get("session");
    if (urlSessionId && session.id !== urlSessionId) {
      setMessage("Loading this class session. Please try again in a moment.");
      return;
    }
    const selectedEmailDomain = emailDomain === "custom" ? customEmailDomain.trim().toLowerCase() : emailDomain;
    const cleanEmail = normalizeStudentEmail(email, selectedEmailDomain);
    const username = cleanEmail.split("@")[0] ?? "";
    if (!selectedEmailDomain || !emailPattern.test(cleanEmail) || !usernamePattern.test(username)) {
      setMessage("Enter your email username, such as username1.");
      return;
    }
    if (activeExercise.hasQuestion && !answer.trim()) {
      setMessage("Submit an answer to complete the activity.");
      return;
    }
    if (!session.active) {
      setMessage("This session is not active.");
      return;
    }
    const urlToken = urlParams.get("token");
    if (urlToken && !isRecentToken(session, urlToken, Date.now())) {
      setMessage("This QR code has expired. Scan the current code.");
      return;
    }
    const submittedToken = urlToken?.toUpperCase() ?? makeToken(session, Date.now());
    const existing = supabase ? await loadRemoteSubmissions() : loadSubmissions();
    const duplicateSubmission = existing.find((item) => item.sessionId === session.id && item.email === cleanEmail);
    if (duplicateSubmission) {
      setCheckedInSubmission(duplicateSubmission);
      setMessage("You already submitted for this session.");
      return;
    }
    const rosterMatch = await matchRosterUsername(username);
    const submission: Submission = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      email: cleanEmail,
      name: rosterMatch.name,
      matched: rosterMatch.matched,
      signedAt: new Date().toISOString(),
      token: submittedToken,
      answer: activeExercise.hasQuestion ? answer.trim() : "",
      userAgent: navigator.userAgent,
      ipStatus: "Captured after API deployment",
    };
    if (supabase) {
      const { error } = await supabase.from("activity_submissions").insert({
        id: submission.id,
        session_id: submission.sessionId,
        email: submission.email,
        name: submission.name,
        matched: submission.matched,
        signed_at: submission.signedAt,
        token: submission.token,
        answer: submission.answer,
        user_agent: submission.userAgent,
        ip_status: submission.ipStatus,
      });
      if (error) {
        setMessage("Database submit failed. Check Supabase table setup.");
        return;
      }
      setSubmissions(await loadRemoteSubmissions());
    } else {
      const next = [submission, ...existing];
      saveSubmissions(next);
      setSubmissions(next);
    }
    setMessage(
      rosterMatch.matched
        ? activeExercise.hasQuestion
          ? "Submitted. You are checked in and your response was saved."
          : "Checked in. Attendance recorded."
        : "Submitted as unmatched. Instructor can review.",
    );
    setCheckedInSubmission(submission);
    setAnswer("");
  }

  if (isStudentMode) {
    return (
      <main className="brand-shell min-h-screen px-4 py-5 text-[#232629]">
        <section className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-[#6f2c3e]">
            <IonaMark />
            <span>Iona Class Activity</span>
          </div>
          <StudentActivityCard
            activeCourse={activeCourse}
            activeExercise={activeExercise}
            activeQuestion={activeQuestion}
            email={email}
            answer={answer}
            message={message}
            checkedInSubmission={checkedInSubmission}
            setEmail={setEmail}
            emailDomain={emailDomain}
            setEmailDomain={setEmailDomain}
            customEmailDomain={customEmailDomain}
            setCustomEmailDomain={setCustomEmailDomain}
            setAnswer={setAnswer}
            submitStudent={submitStudent}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="brand-shell min-h-screen text-[#232629]">
      <section className="brand-header">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="brand-mark" aria-label="Iona University class activities">
              <IonaMark />
              <span>IONA</span>
              <span className="brand-rule" />
              <span>Class Activities</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">Attendance and live responses</h1>
              <span className="title-help">
                <button className="title-help-button" aria-label="About the instructor view" type="button">
                  ?
                </button>
                <span className="title-help-panel" role="tooltip">
                  Choose a course and week, generate a QR link, and let the instructor side handle session, token, timing, and roster matching.
                </span>
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Checked in" value={sessionRows.length} />
            <Metric
              label={activeExercise.hasQuestion ? "Answered" : "Expected"}
              value={activeExercise.hasQuestion ? answeredCount : expectedCount}
            />
            <Metric label="Remaining" value={rosterLeft} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 pt-5">
        <div className="view-tabs" role="tablist" aria-label="Instructor view mode">
          <button className={view === "console" ? "view-tab active" : "view-tab"} onClick={() => setView("console")}>
            Session Setup
          </button>
          <button
            className={view === "projection" ? "view-tab active" : "view-tab"}
            onClick={() => setView("projection")}
          >
            Projection
          </button>
          <button className={view === "backend" ? "view-tab active" : "view-tab"} onClick={() => setView("backend")}>
            Backend
          </button>
        </div>
      </div>

      {view === "console" ? (
        <section className="mx-auto max-w-7xl px-5 py-5">
          <Panel>
            <div className="grid items-stretch gap-5 lg:grid-cols-2">
              <div className="console-controls flex flex-col gap-4 rounded-md p-4">
                <div className="course-strip compact">
                  <div className="course-summary">
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-2xl font-semibold">{selectedCourse.code}</span>
                      <span className="text-2xl font-normal">{selectedCourse.title}</span>
                    </p>
                    <p className="mt-1 text-sm text-[#565a5c]">{selectedCourse.meeting}</p>
                  </div>
                </div>
                <div className="grid gap-3">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Course</span>
                    <select
                      className="field"
                      value={selectedCourseId}
                      onChange={(event) => {
                        const nextCourseId = event.target.value;
                        setSelectedCourseId(nextCourseId);
                        setSelectedExerciseId(getDefaultExerciseId(nextCourseId));
                      }}
                    >
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.code} - {course.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="w-full max-w-xs space-y-1 text-sm">
                    <span className="font-medium">Week / class meeting</span>
                    <select
                      className="field"
                      value={selectedExerciseId}
                      onChange={(event) => setSelectedExerciseId(event.target.value)}
                    >
                      {selectedCourseExercises.map((exercise) => (
                        <option key={exercise.id} value={exercise.id}>
                          {exercise.hasQuestion ? `${exercise.label} · ${exercise.activityName}` : exercise.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-auto grid gap-3">
                  <button className="primary-button session-action-bar" onClick={startSession}>
                    Start session
                  </button>
                </div>
              </div>
              <QrBlock
                joinUrl={joinUrl}
                qrSrc={qrSrc}
                secondsLeft={secondsLeft}
                token={token}
                compact
              />
            </div>
          </Panel>
        </section>
      ) : view === "projection" ? (
        <section className="dashboard-layout reversed mx-auto grid max-w-7xl items-stretch gap-5 px-5 py-5">
          <Panel title="Session QR">
            <QrBlock
              joinUrl={joinUrl}
              qrSrc={qrSrc}
              secondsLeft={secondsLeft}
              token={token}
            />
          </Panel>
          <div className="flex h-full flex-col gap-5">
            <Panel>
              <CurrentClassCard activeCourse={activeCourse} activeExercise={activeExercise} />
              <div className="mt-4 rounded-md border border-[#e0e1dd] bg-[#faf7ef] p-5">
                {activeExercise.hasQuestion ? (
                  <>
                    <p className="text-sm font-semibold text-[#6f2c3e]">Prompt</p>
                    <p className="mt-2 text-2xl font-semibold">{activeQuestion.prompt}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-2xl font-semibold">Scan the QR code and check in with your Gaels email username.</p>
                  </>
                )}
              </div>
            </Panel>
            <Panel title="Class Response Results" className="flex-1">
              <ResponseResults activeExercise={activeExercise} activeQuestion={activeQuestion} rows={sessionRows} />
            </Panel>
          </div>
        </section>
      ) : (
        <section className="dashboard-layout mx-auto grid max-w-7xl gap-5 px-5 py-5">
          <Panel title="Live Submissions">
            <div className="mb-4 flex justify-end">
              <button className="secondary-button px-4" onClick={() => downloadCsv(sessionRows, session)}>
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e0e1dd] text-left text-[#565a5c]">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Username</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Answer</th>
                    <th className="py-2 pr-3">Roster</th>
                    <th className="py-2 pr-3">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionRows.map((row) => (
                    <tr key={row.id} className="border-b border-[#e0e1dd]">
                      <td className="py-2 pr-3">{new Date(row.signedAt).toLocaleTimeString()}</td>
                      <td className="py-2 pr-3">{getUsername(row.email)}</td>
                      <td className="py-2 pr-3">{row.email}</td>
                      <td className="py-2 pr-3">{row.name}</td>
                      <td className="py-2 pr-3">{row.answer}</td>
                      <td className="py-2 pr-3">{row.matched ? "Matched" : "Review"}</td>
                      <td className="py-2 pr-3 text-[#565a5c]">{row.ipStatus}</td>
                    </tr>
                  ))}
                  {!sessionRows.length ? (
                    <tr>
                      <td className="py-8 text-center text-[#565a5c]" colSpan={7}>
                        Waiting for student scans.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>
          <div className="space-y-5">
            <Panel title="Class Response Results">
              <ResponseResults activeExercise={activeExercise} activeQuestion={activeQuestion} rows={sessionRows} />
            </Panel>
            <Panel title="Username Review">
              <div className="space-y-2">
                {sessionRows.length ? (
                  sessionRows.map((row) => (
                    <div key={row.id} className="flex items-center justify-between rounded-md bg-white p-3 text-sm">
                      <div>
                        <p className="font-medium">{getUsername(row.email)}</p>
                        <p className="text-[#565a5c]">{row.email}</p>
                      </div>
                      <span className={row.matched ? "mini-pill ok" : "mini-pill"}>{row.matched ? "Matched" : "Review"}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-md bg-white p-3 text-sm text-[#565a5c]">Waiting for student scans.</p>
                )}
              </div>
            </Panel>
          </div>
        </section>
      )}
    </main>
  );
}

function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-[#e0e1dd] bg-white p-4 shadow-sm ${className}`}>
      {title ? <h2 className="mb-4 text-lg font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

function IonaMark() {
  return <img className="iona-mark" src={ionaKnotSrc} alt="" aria-hidden="true" />;
}

function CurrentClassCard({
  activeCourse,
  activeExercise,
  compact = false,
}: {
  activeCourse: Course;
  activeExercise: Exercise;
  compact?: boolean;
}) {
  return (
    <div className="student-course-banner rounded-md p-4 text-white">
      <h2 className={compact ? "text-2xl font-semibold" : "text-3xl font-semibold"}>{activeCourse.code}</h2>
      <p className="mt-1 text-sm text-[#f3ebe0]">{activeCourse.title}</p>
      <div className="mt-4 rounded-md bg-white/10 p-3">
        <p className="text-sm font-semibold">{activeExercise.label}</p>
        <p className="text-xs text-[#f6dfaa]">{activeExercise.dateHint}</p>
      </div>
    </div>
  );
}

function QrBlock({
  joinUrl,
  qrSrc,
  secondsLeft,
  token,
  compact = false,
}: {
  joinUrl: string;
  qrSrc: string;
  secondsLeft: number;
  token: string;
  compact?: boolean;
}) {
  const blockClass = compact ? "grid h-full gap-4" : "grid gap-4";
  const cardClass = compact ? "qr-card flex h-full flex-col rounded-md p-4" : "qr-card flex flex-col rounded-md p-4";

  return (
    <div className={blockClass}>
      <div className={cardClass}>
        {compact ? (
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[#565a5c]">
            <p>Refreshes in {secondsLeft}s.</p>
            <span className="qr-link-help">
              <a className="qr-link-button" href={joinUrl} aria-label="Open student link">
                Student link
              </a>
              <span className="qr-link-panel" role="tooltip">
                {joinUrl}
              </span>
            </span>
          </div>
        ) : null}
        <img
          className={compact ? "mx-auto aspect-square w-full max-w-[320px]" : "mx-auto aspect-square w-full max-w-[360px]"}
          src={qrSrc}
          alt="Dynamic session QR code"
        />
        <div className="mt-auto pt-5">
          <div className="session-action-bar flex items-center justify-center gap-3 rounded-md bg-[#6f2c3e] px-4 text-white">
            <span className="text-base font-bold">Live token</span>
            <strong className="font-mono text-base font-bold">{token}</strong>
          </div>
          {!compact ? (
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#565a5c]">
            <p>Current code refreshes in {secondsLeft}s.</p>
            <span className="qr-link-help">
              <a className="qr-link-button" href={joinUrl} aria-label="Open student link">
                Student link
              </a>
              <span className="qr-link-panel" role="tooltip">
                {joinUrl}
              </span>
            </span>
          </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ResponseResults({
  activeExercise,
  activeQuestion,
  rows,
}: {
  activeExercise: Exercise;
  activeQuestion: Question;
  rows: Submission[];
}) {
  if (!activeExercise.hasQuestion) {
    return (
      <div className="rounded-md bg-[#faf7ef] p-5">
        <p className="mt-2 text-3xl font-semibold">{rows.length}</p>
        <p className="text-sm text-[#565a5c]">students checked in for this session</p>
      </div>
    );
  }

  if (activeQuestion.type === "choice") {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {activeQuestion.options?.map((option) => {
          const votes = rows.filter((row) => row.answer === option).length;
          const share = rows.length ? (votes / rows.length) * 100 : 0;
          return (
            <div key={option} className="rounded-md border border-[#e0e1dd] bg-[#faf7ef] p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-base font-semibold">{option}</p>
                <p className="text-2xl font-semibold text-[#6f2c3e]">{votes}</p>
              </div>
              <div className="mt-3 h-3 rounded bg-[#e0e1dd]">
                <div className="h-3 rounded bg-[#6f2c3e]" style={{ width: `${share}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {rows.length ? (
        rows.slice(0, 8).map((row, index) => (
          <div key={row.id} className="rounded-md border border-[#e0e1dd] bg-[#faf7ef] p-3 text-sm">
            <p className="text-xs font-semibold text-[#6f2c3e]">Response {index + 1}</p>
            <p className="mt-1">{row.answer}</p>
          </div>
        ))
      ) : (
        <p className="rounded-md bg-[#faf7ef] p-4 text-sm text-[#565a5c]">Waiting for responses.</p>
      )}
    </div>
  );
}

function StudentActivityCard({
  activeCourse,
  activeExercise,
  activeQuestion,
  email,
  emailDomain,
  customEmailDomain,
  answer,
  message,
  checkedInSubmission,
  setEmail,
  setEmailDomain,
  setCustomEmailDomain,
  setAnswer,
  submitStudent,
}: {
  activeCourse: Course;
  activeExercise: Exercise;
  activeQuestion: Question;
  email: string;
  emailDomain: string;
  customEmailDomain: string;
  answer: string;
  message: string;
  checkedInSubmission: Submission | null;
  setEmail: (value: string) => void;
  setEmailDomain: (value: string) => void;
  setCustomEmailDomain: (value: string) => void;
  setAnswer: (value: string) => void;
  submitStudent: () => void;
}) {
  if (checkedInSubmission) {
    return (
      <>
        <StudentClassHeader activeCourse={activeCourse} activeExercise={activeExercise} />
        <div className="mt-4 rounded-md border border-[#e0e1dd] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase text-[#6f2c3e]">Check-in complete</p>
              <h2 className="mt-1 text-2xl font-semibold">You are recorded for this class session.</h2>
              <p className="mt-2 text-sm text-[#565a5c]">
                Submitted as <span className="font-semibold text-[#232629]">{checkedInSubmission.email}</span>
              </p>
            </div>
            <span className={checkedInSubmission.matched ? "mini-pill ok" : "mini-pill"}>
              {checkedInSubmission.matched ? "Roster matched" : "Instructor review"}
            </span>
          </div>
          {message ? <p className="mt-4 rounded-md bg-[#fff7e3] p-3 text-sm text-[#6f2c3e]">{message}</p> : null}
        </div>

        <div className="mt-4 rounded-md border border-[#e0e1dd] bg-[#faf7ef] p-4">
          <p className="text-sm font-semibold uppercase text-[#6f2c3e]">Today</p>
          <h3 className="mt-1 text-xl font-semibold">{activeExercise.label}</h3>
          <p className="mt-1 text-sm text-[#565a5c]">
            {activeExercise.meetingDate} · {activeExercise.startsAt}-{activeExercise.endsAt} · {activeExercise.location}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[#232629]">
            <li>Attendance is saved for this session.</li>
            {activeExercise.hasQuestion ? (
              <li>Your class response is saved with your check-in.</li>
            ) : (
              <li>No in-class question is open right now.</li>
            )}
            <li>Follow the instructor's next in-class activity.</li>
          </ul>
        </div>

        <div className="mt-4 rounded-md border border-[#e0e1dd] bg-white p-4">
          <p className="text-sm font-semibold uppercase text-[#6f2c3e]">Class outline</p>
          <div className="mt-3 grid gap-3">
            <div className="rounded-md bg-[#faf7ef] p-3">
              <p className="font-semibold">Session focus</p>
              <p className="mt-1 text-sm text-[#565a5c]">{activeCourse.title}</p>
            </div>
            <div className="rounded-md bg-[#faf7ef] p-3">
              <p className="font-semibold">Current requirement</p>
              <p className="mt-1 text-sm text-[#565a5c]">
                Check in with your Gaels email username and complete any in-class prompt assigned by the instructor.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <StudentClassHeader activeCourse={activeCourse} activeExercise={activeExercise} />

      <div className="mt-4 space-y-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Gaels email username</span>
          <div className="email-entry">
            <input
              className="field email-entry-input"
              placeholder="username1"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <select
              className="email-entry-suffix"
              aria-label="Email domain"
              value={emailDomain}
              onChange={(event) => setEmailDomain(event.target.value)}
            >
              <option value="gaels.iona.edu">@gaels.iona.edu</option>
              <option value="iona.edu">@iona.edu</option>
              <option value="custom">Other</option>
            </select>
          </div>
          {emailDomain === "custom" ? (
            <input
              className="field mt-2"
              placeholder="school.edu"
              value={customEmailDomain}
              onChange={(event) => setCustomEmailDomain(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          ) : null}
        </label>

        {activeExercise.hasQuestion ? (
          <div className="rounded-md border border-[#e0e1dd] p-3">
            <p className="text-sm font-semibold">{activeQuestion.prompt}</p>
            {activeQuestion.type === "choice" ? (
              <div className="mt-3 grid gap-2">
                {activeQuestion.options?.map((option) => (
                  <button
                    key={option}
                    className={answer === option ? "answer-button selected" : "answer-button"}
                    onClick={() => setAnswer(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                className="field mt-3 min-h-28"
                placeholder="Type a short response"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
              />
            )}
          </div>
        ) : null}

        <button className="primary-button w-full" onClick={submitStudent}>
          {activeExercise.hasQuestion ? "Check in and submit" : "Check in"}
        </button>
        {message ? <p className="rounded-md bg-[#fff7e3] p-3 text-sm text-[#6f2c3e]">{message}</p> : null}
      </div>
    </>
  );
}

function StudentClassHeader({
  activeCourse,
  activeExercise,
}: {
  activeCourse: Course;
  activeExercise: Exercise;
}) {
  return (
    <div className="student-course-banner rounded-md p-4 text-white">
      <h2 className="text-3xl font-semibold">{activeCourse.code}</h2>
      <p className="mt-1 text-sm text-[#f3ebe0]">{activeCourse.title}</p>
      <div className="mt-4 rounded-md bg-white/10 p-3">
        <p className="text-sm font-semibold">{activeExercise.label}</p>
        <p className="text-xs text-[#f6dfaa]">
          {activeExercise.meetingDate} · {activeExercise.startsAt}-{activeExercise.endsAt} · {activeExercise.location}
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card min-w-24 rounded-md px-4 py-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-[#f3ebe0]">{label}</p>
    </div>
  );
}
