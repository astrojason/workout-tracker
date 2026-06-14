# Time-Based Exercises

Time-based exercises track hold duration in seconds rather than rep count.
They are identified when `isTimeBased: true`, which is set by the parser when
`progression_rule === "add_time"` or `repMin >= 30`.

---

## Display

**As a user viewing a time-based exercise:**

Given Scapular Hangs is configured with `rep_min: 30`, `rep_max: 30`, `isTimeBased: true`:

- I see the target displayed as "30 sec" or "30s" — not "30 reps"
- I do **not** see a rep range like "30–30 reps"
- The set counter displays normally: "Set 1 of 3", "Set 2 of 3", etc.
- The equipment assistance ("3 bands") is still displayed

**Rule:** Any exercise where `isTimeBased: true` must display its target as a duration,
never as a rep count.

---

## Set Completion Modal

**As a user completing a time-based set:**

- The completion modal prompts for duration achieved (seconds), not reps
- I can enter a duration less than the target (e.g. 20s when target is 30s)
- The entered duration is recorded as `actualReps` in the CompletedSet (seconds)
- `isTimeBased: true` is recorded on the CompletedSet for correct history display
- The difficulty rating (easy / normal / hard) and failed toggle still apply

---

## Rest Timer After a Time-Based Set

**As a user after completing a Scapular Hang set:**

Given `rest_seconds: 30`:

- After completing a set, the 30-second rest timer starts
- The rest timer behavior is identical to rep-based exercises
- Skipping rest advances to the next set immediately

---

## History Display

**As a user viewing time-based exercise history:**

- Duration is shown in seconds or formatted as "Xm Ys" for longer holds
- The progression chart shows duration on the Y axis, not weight
- `useExerciseHistory` returns `isTimeBased: true` for these exercises
- Sets with `actualReps === 0` are excluded from history (same rule as weight-based)

---

## Parser Rules

- `isTimeBased` is derived at parse time — it is never stored in the XLSX
- The rule: `progression_rule === "add_time"` OR `repMin >= 30` → `isTimeBased: true`
- A rep-based exercise with `repMin: 29` is **not** time-based even if it looks like a duration