# Workout Session Flow

## Set Progression with Rest Timer

**As a user completing a multi-set exercise:**

Given Landmine Press is configured as 3 sets (2 × 8–10, last set AMRAP) at 90 lbs:

- I see "Set 1 of 3 — 90 lbs — 8–10 reps"
- On completion, a 2-minute rest timer starts
- When the timer ends, I see "Set 2 of 3 — 90 lbs — 8–10 reps"
- On completion, the 2-minute rest timer starts again
- When the timer ends, I see "Set 3 of 3 — 90 lbs — AMRAP"
- On completion of set 3, the workout advances to the next exercise

**Rules:**
- The rest timer must complete (or be skipped) before the next set is shown
- Skipping the rest timer advances to the next set immediately — it does not skip the set
- The set counter must never advance more than one step per completed set
- The final set of an exercise marked `last_set_amrap: true` always displays as AMRAP regardless of the `rep_max` value

---

## Rest Timer Behavior

**As a user during a rest period:**

- The timer counts down in seconds from the configured rest duration
- I can skip the rest timer at any time — doing so advances to the next set, not the next exercise
- If I close and reopen the app while resting, the timer resumes from the correct remaining time
- If the timer expired while the app was closed, I land on the correct next set when I reopen — no sets are skipped

---

## Exercise Progression

**As a user moving between exercises:**

- After the final set of an exercise, the between-exercise rest timer starts (using `rest_after` if configured, otherwise `rest_seconds`)
- When the timer ends, I see the first set of the next exercise
- If `rest_after: false` is set, there is no rest timer — the next exercise appears immediately
- The exercise index never skips forward more than one exercise per transition

---

## Skipping a Set

**As a user who skips a set:**

- The skipped set is logged with 0 reps and a "Skipped" note
- The workout advances to the next set (or next exercise if it was the final set)
- A skipped final set still triggers the between-exercise rest timer (or immediate advance if `rest_after: false`)