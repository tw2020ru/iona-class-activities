# BUS 320 Operations Game Concept

## Purpose

This document records the current design discussion for a future BUS 320 operations management simulation app. The app should extend the current class activity system without making attendance, QR check-in, or live responses more complicated.

Current priority: keep the project free to run. Any feature that requires paid infrastructure should be postponed.

## Recommended Format

Build this as a web-based app, not a local desktop app.

Reasons:

- Students can use phones or laptops without installing anything.
- Instructor projection works naturally in the browser.
- It can reuse the current Vercel + Supabase free setup.
- Updates are instant after deployment.
- A local app would create installation, compatibility, and update problems.

Recommended route:

- Add a separate route such as `/bus320-lab`.
- Keep the current attendance/check-in interface simple.
- Connect game activities to course meetings later, but do not force every class session to have a game.

## Core Idea

The strongest format is:

**Simulation game + instructor-controlled classroom activity**

It should not be only a calculator, and it should not be only a game. The goal is to let students feel operations management tradeoffs through decisions, constraints, randomness, and performance metrics.

## Two Main Modes

### 1. Chapter Mini-Sim

Each chapter has a short simulation that takes about 5-12 minutes in class.

Possible modules:

- Process analysis: adjust capacity, identify bottlenecks, compare cycle time and throughput.
- Forecasting: use historical demand to estimate future demand.
- Inventory: choose order quantity, reorder point, or safety stock.
- Quality: choose inspection level and balance defect cost against inspection cost.
- Queuing: adjust servers or service rate and observe waiting time/utilization.
- Supply chain: choose suppliers with different cost, lead time, and risk.
- Project management: schedule tasks and respond to delays.
- Lean/JIT: reduce waste and inventory, then face demand or supply shocks.

Classroom use:

- Instructor launches a scenario.
- Students make a small number of decisions.
- Results appear in instructor dashboard or projection view.
- Students may also submit a short reflection.

### 2. Semester Business Mode

Students create and run a virtual business across the semester.

Possible businesses:

- Campus coffee shop
- Food truck
- Custom T-shirt shop
- Small online retail store
- Simple manufacturer

Each chapter unlocks or emphasizes one part of the business:

- Business model and product choice
- Demand forecasting
- Process and capacity
- Inventory
- Quality
- Supply chain
- Scheduling
- Project management
- Operations strategy

Saved progress should include the student's business, decisions, simulation state, scores, and reflections.

## Fixed Mode vs Custom Mode

### Fixed Mode

All students face the same scenario and the same random seed.

Benefits:

- Fair comparison.
- Good for classroom competition.
- Easier to explain.
- Suitable for leaderboard.

Example:

- "Week 6 Supply Shock Scenario"
- Everyone faces the same supplier delay, demand spike, and quality issue.

### Custom Mode

Students create their own virtual business.

Benefits:

- Better for a semester project.
- Students feel ownership.
- More room for reflection and strategy.

Possible project output:

- Business description
- Operations choices
- Performance dashboard
- Final reflection

## Leaderboard Design

Use leaderboards carefully. Do not rank only by profit, because students may learn to optimize in unrealistic or risky ways.

Better leaderboard categories:

- Highest profit
- Best service level
- Best quality
- Lowest waste
- Best resilience after disruption
- Best balanced operations score

Recommended overall score:

- Profit
- Customer satisfaction
- Service level
- Quality
- Waste
- Inventory performance
- Resilience

## First MVP Recommendation

Start with one simple business and three operations concepts.

Suggested MVP:

**BUS 320 Operations Lab: Campus Coffee Shop**

Modules:

1. Forecasting
2. Inventory
3. Capacity / bottleneck

Basic flow:

1. Student enters Iona email and course access code.
2. Student creates or resumes a coffee shop.
3. Student makes decisions for 8-12 simulated weeks.
4. System calculates results.
5. Student sees score and dashboard.
6. Instructor sees submissions and leaderboard.

This is much more manageable than starting with a full semester-scale game.

## Login and Progress Saving

Progress can be saved without passwords if the system can identify the student.

### Phase 1: Email + Course Access Code

Student enters:

- Iona email
- Course access code, such as `BUS320-FALL2026`

The system can then create or load:

- Student profile
- Course enrollment record
- Virtual business
- Game progress
- Decisions
- Scores

Pros:

- Very easy to build.
- No password reset or account management.
- Good for early testing.

Cons:

- A student could theoretically impersonate another student if they know the email.

### Phase 2: Email Magic Link

Student enters Iona email and receives a login link.

Pros:

- No password needed.
- More reliable student identity.
- Supabase Auth can support this.

Cons:

- Requires students to access email.
- Slightly more setup and testing.

### Phase 3: Username + Password

Possible later, but not recommended for the first version.

Reasons to postpone:

- Password reset flow.
- More security responsibility.
- More friction for students.

## Data Model Draft

Possible Supabase tables:

- `game_students`
- `game_courses`
- `game_enrollments`
- `game_businesses`
- `game_modules`
- `game_sessions`
- `game_decisions`
- `game_results`
- `game_leaderboard_entries`
- `game_reflections`

Important principle:

Do not write to the database every second. Save once per decision, round, or module. This keeps usage low and works well with the free plan.

## Cost and Usage Notes

This can stay within the current free stack if designed carefully.

Low-cost choices:

- Web app on Vercel Hobby.
- Supabase Free for database/auth.
- Store game state as JSON rows when appropriate.
- Avoid large video/audio files.
- Avoid constant real-time writes.

Potential cost risks:

- Large media files.
- Frequent real-time updates from many students.
- Uploading many student images.
- Complex analytics logging every click.

For the first version, use round-based saving rather than continuous streaming.

## Relationship to Current Attendance App

The current app handles:

- Course selection
- Class meeting selection
- QR attendance
- Live student submissions
- Instructor projection
- Backend review

The game app should be adjacent, not mixed into every attendance screen.

Possible integration later:

- A class meeting can optionally have a `gameModuleId`.
- Projection can show the active game module instead of a plain question.
- Student check-in can lead to the game activity when assigned.
- Game scores can be exported with attendance/activity CSV.

## Open Design Questions

- Which first business should be used: coffee shop, food truck, T-shirt shop, or another example?
- Should the first MVP focus on classroom mode or semester project mode?
- What exact BUS 320 chapters should map to the first three modules?
- How should the balanced operations score be calculated?
- Should students see all metrics immediately, or discover some through reports?
- Should random events be fully fixed per class session or partially personalized?
- Should leaderboard be public to students or instructor-only?

## Next Step

Recommended next step:

Design the first MVP module in detail:

**Campus Coffee Shop: Forecasting + Inventory + Capacity**

Define:

- Student decisions
- Simulation inputs
- Random events
- Score formula
- Dashboard metrics
- Reflection prompt
- Database fields needed to save progress
