# AMRAP Logging and PR Edge Cases

---

## AMRAP Set Logging

**As a user completing an AMRAP set:**

Given Assisted Pull-ups has `last_set_amrap: TRUE` on the final set:

- The final set displays "AMRAP" instead of a rep range
- The completion modal accepts any rep count I enter — there is no upper bound
- The entered rep count is recorded as `actualReps`
- `targetReps` is recorded as `repMin` (the minimum rep target), not 0 or null
- `completed: true` is set regardless of how many reps I enter, unless I toggle failed

**Rule:** An AMRAP set is never skipped automatically. It must be explicitly
completed or skipped by the user.

---

## Failed Sets

**As a user marking a set as failed:**

- I toggle the failed flag in the completion modal
- `completed: false` is recorded on the CompletedSet
- The actual reps and weight I entered are still recorded
- The set counts toward volume history but does **not** contribute to weight PR
  or estimated 1RM PR calculations
- Failed sets do not trigger a PR even if the weight or reps exceed previous records

---

## Skipped Sets

**As a user who skips a set:**

- `actualReps: 0`, `actualWeight: 0`, `completed: false` are recorded
- Notes field is set to "Skipped"
- Skipped sets are excluded from all PR calculations (weight, 1RM, volume)
- Skipped sets do not appear as data points in the exercise history chart

---

## Zero-Weight Sets

**As a user completing a bodyweight or band exercise:**

- `actualWeight: 0` is a valid value for bodyweight and band exercises
- Zero-weight sets do **not** generate a weight PR or estimated 1RM PR
- Zero-weight sets may still contribute to a volume PR if `actualReps > 0`
  (volume = 0 × reps = 0, so in practice they never generate a volume PR either)
- Zero-weight sets are excluded from the exercise history chart
  (`getExerciseHistory` filters out weight === 0 data points)

---

## PR Timing

**As a user who just finished a workout:**

- PRs are checked after `saveSession()` completes — never mid-workout
- All three PR types (weight, estimated 1RM, volume) are checked for every
  exercise that appears in the session
- A new PR overwrites the previous record in Firestore
- PRs achieved are displayed on the WorkoutComplete screen
- If no PRs were achieved for an exercise, nothing is shown for that exercise