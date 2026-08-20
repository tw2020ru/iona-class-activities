"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Course = {
  id: string;
  code: string;
  title: string;
  meeting: string;
  discipline: string;
  theme: string;
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
    discipline: "Business",
    theme: "Operations dashboard",
  },
  {
    id: "course-2",
    code: "BUS 403-A",
    title: "Excel for Business",
    meeting: "Wed 2:00-2:52 PM · LaPenta 212 Trading Floor",
    discipline: "Business",
    theme: "Spreadsheet lab",
  },
  {
    id: "course-3",
    code: "IS 670-A",
    title: "Artificial Intelligence in Business",
    meeting: "Wed 6:30-9:30 PM · LaPenta Business 308",
    discipline: "Graduate IS",
    theme: "AI discussion studio",
  },
  {
    id: "course-4",
    code: "MBA 510-A",
    title: "Fundamentals of Business Analytics",
    meeting: "Tue 6:30-9:45 PM · LaPenta Business 211",
    discipline: "MBA",
    theme: "Analytics workshop",
  },
];

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

const fallWeekHints = [
  "Aug 24-30",
  "Aug 31-Sep 6",
  "Sep 7-13",
  "Sep 14-20",
  "Sep 21-27",
  "Sep 28-Oct 4",
  "Oct 5-11",
  "Oct 12-18",
  "Oct 19-25",
  "Oct 26-Nov 1",
  "Nov 2-8",
  "Nov 9-15",
  "Nov 16-22",
  "Nov 23-29",
  "Nov 30-Dec 6",
  "Dec 7-11",
];

const exercisePlans = [
  {
    courseId: "course-1",
    slug: "bus320",
    count: 16,
    activityName: "Operations participation check",
    hasQuestion: false,
    prompt: "What is one operations decision from this week that could be measured with data?",
    type: "short" as const,
  },
  {
    courseId: "course-2",
    slug: "bus403",
    count: 16,
    activityName: "Excel lab check",
    hasQuestion: false,
    prompt: "Which Excel skill from this week's lab do you expect to use most often?",
    type: "choice" as const,
    options: ["Tables", "Formulas", "Charts", "Data cleaning"],
  },
  {
    courseId: "course-3",
    slug: "is670",
    count: 11,
    activityName: "AI in business reflection",
    hasQuestion: false,
    prompt: "Name one business use case where AI creates value and one risk it introduces.",
    type: "short" as const,
  },
  {
    courseId: "course-4",
    slug: "mba510",
    count: 11,
    activityName: "Analytics workshop response",
    hasQuestion: false,
    prompt: "What is one business question that analytics can help answer?",
    type: "short" as const,
  },
];

const exercises: Exercise[] = exercisePlans.flatMap((plan) =>
  Array.from({ length: plan.count }, (_, index) => {
    const week = index + 1;
    return {
      id: `${plan.slug}-w${String(week).padStart(2, "0")}`,
      courseId: plan.courseId,
      week,
      label: `Week ${week} Exercise`,
      dateHint: fallWeekHints[index],
      activityName: plan.activityName,
      hasQuestion: plan.hasQuestion,
      question: {
        id: `q-${plan.slug}-w${String(week).padStart(2, "0")}`,
        prompt: plan.prompt,
        type: plan.type,
        options: plan.options,
      },
    };
  }),
);

const emailPattern = /^[^\s@]+@(iona\.edu|gaels\.iona\.edu)$/i;
const tickMs = 45_000;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const publicSiteUrl = "https://iona-class-activities.vercel.app";

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

function makeToken(session: Session, now: number) {
  const bucket = Math.floor(now / tickMs);
  const raw = `${session.tokenSeed}-${bucket}`;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).toUpperCase().slice(0, 6).padStart(6, "0");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getStudent(email: string) {
  return roster.find((student) => student.email === normalizeEmail(email));
}

function getCourseExercises(courseId: string) {
  return exercises.filter((exercise) => exercise.courseId === courseId);
}

function downloadCsv(rows: Submission[], activeSession: Session) {
  const headers = [
    "course",
    "session",
    "exercise",
    "exercise_date",
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
  const [selectedExerciseId, setSelectedExerciseId] = useState(exercises[0].id);
  const [view, setView] = useState<"console" | "projection" | "backend">("console");
  const [session, setSession] = useState<Session>(() => ({
    id: crypto.randomUUID(),
    courseId: courses[0].id,
    exerciseId: exercises[0].id,
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
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    loadRemoteSubmissions().then(setSubmissions);
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = () => loadRemoteSubmissions().then(setSubmissions);
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
      window.clearInterval(interval);
      window.removeEventListener("iona-submissions-updated", refresh);
      window.removeEventListener("storage", refresh);
      if (channel) {
        supabase?.removeChannel(channel);
      }
    };
  }, []);

  const selectedCourseExercises = getCourseExercises(selectedCourseId);
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
  const enrolled = roster.filter((student) => student.courseIds.includes(session.courseId));
  const answeredCount = sessionRows.filter((row) => row.answer.trim()).length;
  const rosterLeft = Math.max(enrolled.length - sessionRows.length, 0);

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
  }

  async function submitStudent() {
    const cleanEmail = normalizeEmail(email);
    if (!emailPattern.test(cleanEmail)) {
      setMessage("Use an @iona.edu or @gaels.iona.edu email.");
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
    const expectedToken = makeToken(session, Date.now());
    const urlToken = new URLSearchParams(window.location.search).get("token");
    if (urlToken && urlToken !== expectedToken) {
      setMessage("This QR code has expired. Scan the current code.");
      return;
    }
    const existing = supabase ? await loadRemoteSubmissions() : loadSubmissions();
    if (existing.some((item) => item.sessionId === session.id && item.email === cleanEmail)) {
      setMessage("You already submitted for this session.");
      return;
    }
    const student = getStudent(cleanEmail);
    const isEnrolled = Boolean(student?.courseIds.includes(session.courseId));
    const submission: Submission = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      email: cleanEmail,
      name: isEnrolled ? student?.name ?? "Roster match" : "Unmatched roster",
      matched: isEnrolled,
      signedAt: new Date().toISOString(),
      token: expectedToken,
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
      isEnrolled
        ? activeExercise.hasQuestion
          ? "Submitted. You are checked in and your response was saved."
          : "Checked in. Attendance recorded."
        : "Submitted as unmatched. Instructor can review.",
    );
    setAnswer("");
  }

  if (isStudentMode) {
    return (
      <main className="brand-shell min-h-screen px-4 py-5 text-[#232629]">
        <section className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase text-[#6f2c3e]">
            <span className="brand-knot">I</span>
            <span>Iona Class Activity</span>
          </div>
          <StudentActivityCard
            activeCourse={activeCourse}
            activeExercise={activeExercise}
            activeQuestion={activeQuestion}
            email={email}
            answer={answer}
            message={message}
            setEmail={setEmail}
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
              <span className="brand-knot">I</span>
              <span>IONA</span>
              <span className="brand-rule" />
              <span>Class Activities</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
              Attendance and live responses
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#f3ebe0]">
              Instructor view stays minimal: choose a course, choose the week exercise, generate a QR link. Course, session, token, timing, and roster
              matching are handled by the instructor side.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Checked in" value={sessionRows.length} />
            <Metric label="Answered" value={answeredCount} />
            <Metric label="Roster left" value={rosterLeft} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 pt-5">
        <div className="view-tabs" role="tablist" aria-label="Instructor view mode">
          <button className={view === "console" ? "view-tab active" : "view-tab"} onClick={() => setView("console")}>
            Full Console
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
          <Panel title="Instructor Console">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div>
                <div className="course-strip compact mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-[#6f2c3e]">{activeCourse.discipline}</p>
                    <p className="text-lg font-semibold">{activeCourse.code}</p>
                    <p className="text-xs text-[#565a5c]">{activeCourse.meeting}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{activeCourse.title}</p>
                    <p className="text-xs text-[#565a5c]">{activeCourse.theme}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Course</span>
                    <select
                      className="field"
                      value={selectedCourseId}
                      onChange={(event) => {
                        const nextCourseId = event.target.value;
                        setSelectedCourseId(nextCourseId);
                        setSelectedExerciseId(getCourseExercises(nextCourseId)[0]?.id ?? exercises[0].id);
                      }}
                    >
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.code} - {course.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Week exercise</span>
                    <select
                      className="field"
                      value={selectedExerciseId}
                      onChange={(event) => setSelectedExerciseId(event.target.value)}
                    >
                      {selectedCourseExercises.map((exercise) => (
                        <option key={exercise.id} value={exercise.id}>
                          {exercise.label} · {exercise.hasQuestion ? exercise.activityName : "Attendance only"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <button className="primary-button" onClick={startSession}>
                    Start session
                  </button>
                  <button className="secondary-button" onClick={() => downloadCsv(sessionRows, session)}>
                    Export CSV
                  </button>
                </div>
              </div>
              <QrBlock
                activeExercise={activeExercise}
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
        <section className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,2.28fr)]">
          <Panel title="Session QR">
            <QrBlock
              activeExercise={activeExercise}
              joinUrl={joinUrl}
              qrSrc={qrSrc}
              secondsLeft={secondsLeft}
              token={token}
            />
          </Panel>
          <div className="space-y-5">
            <Panel title="Class Activity">
              <CurrentClassCard activeCourse={activeCourse} activeExercise={activeExercise} />
              <div className="mt-4 rounded-md border border-[#e0e1dd] bg-[#faf7ef] p-5">
                {activeExercise.hasQuestion ? (
                  <>
                    <p className="text-sm font-semibold text-[#6f2c3e]">Prompt</p>
                    <p className="mt-2 text-2xl font-semibold">{activeQuestion.prompt}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-[#6f2c3e]">Attendance only</p>
                    <p className="mt-2 text-2xl font-semibold">Scan the QR code and check in with your Iona email.</p>
                  </>
                )}
              </div>
            </Panel>
            <Panel title="Class Response Results">
              <ResponseResults activeExercise={activeExercise} activeQuestion={activeQuestion} rows={sessionRows} />
            </Panel>
          </div>
        </section>
      ) : (
        <section className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel title="Live Submissions">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#e0e1dd] text-left text-[#565a5c]">
                    <th className="py-2 pr-3">Time</th>
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
                      <td className="py-2 pr-3">{row.email}</td>
                      <td className="py-2 pr-3">{row.name}</td>
                      <td className="py-2 pr-3">{row.answer}</td>
                      <td className="py-2 pr-3">{row.matched ? "Matched" : "Review"}</td>
                      <td className="py-2 pr-3 text-[#565a5c]">{row.ipStatus}</td>
                    </tr>
                  ))}
                  {!sessionRows.length ? (
                    <tr>
                      <td className="py-8 text-center text-[#565a5c]" colSpan={6}>
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
            <Panel title="Roster Matching">
              <div className="space-y-2">
                {enrolled.map((student) => {
                  const checkedIn = sessionRows.some((row) => row.email === student.email);
                  return (
                    <div
                      key={student.email}
                      className="flex items-center justify-between rounded-md bg-white p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-[#565a5c]">{student.email}</p>
                      </div>
                      <span className={checkedIn ? "mini-pill ok" : "mini-pill"}>{checkedIn ? "In" : "Out"}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        </section>
      )}
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#e0e1dd] bg-white p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
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
      <p className="text-sm text-[#f6dfaa]">Current class</p>
      <h2 className={compact ? "mt-1 text-2xl font-semibold" : "mt-1 text-3xl font-semibold"}>{activeCourse.code}</h2>
      <p className="mt-1 text-sm text-[#f3ebe0]">{activeCourse.title}</p>
      <p className="mt-1 text-xs text-[#f6dfaa]">{activeCourse.meeting}</p>
      <div className="mt-4 rounded-md bg-white/10 p-3">
        <p className="text-sm font-semibold">{activeExercise.label}</p>
        <p className="text-xs text-[#f6dfaa]">
          {activeExercise.dateHint} · {activeExercise.hasQuestion ? activeExercise.activityName : "Attendance only"}
        </p>
      </div>
    </div>
  );
}

function QrBlock({
  activeExercise,
  joinUrl,
  qrSrc,
  secondsLeft,
  token,
  compact = false,
}: {
  activeExercise: Exercise;
  joinUrl: string;
  qrSrc: string;
  secondsLeft: number;
  token: string;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div className="qr-card rounded-md p-4">
        <img
          className={compact ? "mx-auto aspect-square w-full max-w-[220px]" : "mx-auto aspect-square w-full max-w-[260px]"}
          src={qrSrc}
          alt="Dynamic session QR code"
        />
        <div className="mt-3 flex items-center justify-between rounded-md bg-[#6f2c3e] px-3 py-2 text-white">
          <span className="text-xs uppercase">Live token</span>
          <strong className="font-mono text-xl">{token}</strong>
        </div>
        <p className="mt-2 text-xs text-[#565a5c]">QR changes with the token. Current code refreshes in {secondsLeft}s.</p>
        <a className="mt-2 block break-all text-xs font-semibold text-[#6f2c3e]" href={joinUrl}>
          {joinUrl}
        </a>
      </div>
      <div className="rounded-md bg-[#faf7ef] p-3">
        <p className="text-sm font-semibold">QR target</p>
        <p className="mt-1 text-base">{activeExercise.label}</p>
        <p className="mt-1 text-xs text-[#565a5c]">
          {activeExercise.dateHint} · {activeExercise.hasQuestion ? activeExercise.activityName : "Attendance only"}
        </p>
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
        <p className="text-sm font-semibold text-[#6f2c3e]">Attendance only</p>
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
  answer,
  message,
  setEmail,
  setAnswer,
  submitStudent,
}: {
  activeCourse: Course;
  activeExercise: Exercise;
  activeQuestion: Question;
  email: string;
  answer: string;
  message: string;
  setEmail: (value: string) => void;
  setAnswer: (value: string) => void;
  submitStudent: () => void;
}) {
  return (
    <>
      <div className="student-course-banner rounded-md p-4 text-white">
        <p className="text-sm text-[#f6dfaa]">Current class</p>
        <h2 className="mt-1 text-3xl font-semibold">{activeCourse.code}</h2>
        <p className="mt-1 text-sm text-[#f3ebe0]">{activeCourse.title}</p>
        <p className="mt-1 text-xs text-[#f6dfaa]">{activeCourse.meeting}</p>
        <div className="mt-4 rounded-md bg-white/10 p-3">
          <p className="text-sm font-semibold">{activeExercise.label}</p>
          <p className="text-xs text-[#f6dfaa]">
            {activeExercise.dateHint} · {activeExercise.hasQuestion ? activeExercise.activityName : "Attendance only"}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Iona email</span>
          <input
            className="field"
            placeholder="name@iona.edu"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card min-w-24 rounded-md px-4 py-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-[#f3ebe0]">{label}</p>
    </div>
  );
}
