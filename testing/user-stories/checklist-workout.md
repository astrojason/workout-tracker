# Checklist Workout

## Checklist Detection

**As a user launching a Daily workout:**

- Any workout where `dayOfWeek === "Daily"` is treated as a checklist workout
- A workout can also be manually flagged as checklist via the Program Editor toggle
- If neither flag is set, the heuristic applies: all exercises have `restSeconds === 0` and use only `none`, `maintain`, `add_time`, or `add_reps` progression rules

## Checklist Behavior

**As a user completing a checklist workout:**

- All exercises are visible at once as a list of checkboxes
- I tap an exercise to mark it complete — no set completion modal, no rest timer
- I can uncheck a completed exercise
- Each toggle syncs to Firestore immediately (incremental save, not on session end)
- If I leave and return on the same day, my progress is restored — already-checked exercises remain checked

**Rules:**
- There is no rest timer in checklist mode
- There is no sequential exercise flow — I can complete exercises in any order
- The session is not marked complete until I explicitly end it or all exercises are checked

## Checklist vs Active Workout

**As a user on the home screen:**

- Regular workout days (Monday–Sunday non-Daily) launch Active Workout mode
- Daily workouts always launch Checklist mode
- A program card shows today's suggested workout and which days have been completed (checkmarks)