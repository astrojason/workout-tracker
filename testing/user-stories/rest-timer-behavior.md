# Rest Timer Behavior

`restSeconds` always governs rest between an exercise's own sets. `restAfter`
governs only the rest before moving to the NEXT exercise, and never affects
rest between sets of the current exercise.

---

## Rest Between Sets

**As a user completing a mid-workout set:**

Given an exercise configured with `sets: 3` and `rest_seconds: 45`:

- I click Complete Set on Set 1 (or Set 2) of 3
- A rest timer starts and counts down from 45s
- When the countdown finishes, the next set is shown

---

## Rest After The Exercise Suppressed (`restAfter: false`)

**As a user finishing the last set of an exercise configured to skip the
transition rest:**

Given an exercise configured with `sets: 3`, `rest_seconds: 45`, and
`rest_after: false`:

- I click Complete Set on Set 3 (the last set)
- The next exercise is shown immediately — no rest timer appears

---

## Rest After The Exercise Enabled (default / not `false`)

**As a user finishing the last set of an exercise with no `restAfter`
override:**

Given an exercise configured with `sets: 3` and `rest_seconds: 45`
(`rest_after` unset):

- I click Complete Set on Set 3 (the last set)
- A rest timer starts and counts down from 45s
- When the countdown finishes, the next exercise is shown
