# Warmup Phase Behavior

Warmup exercises flow into each other without a rest timer between different
movements. They are identified by `phase: "warmup"` and always have
`restAfter: false` applied when the column is absent. `restAfter` only governs
the transition into the NEXT exercise — it never affects rest between an
exercise's own sets, which always uses `rest_seconds`.

---

## Rest Timer Still Runs Between Warmup Sets

**As a user moving through warmup sets:**

Given External Rotations is configured with `phase: warmup`, `sets: 2`,
`rest_seconds: 60`, and no `rest_after` column value:

- I complete Set 1 and see a 60s rest timer before Set 2 — `rest_seconds`
  always governs rest between an exercise's own sets, regardless of `restAfter`
- `rest_after: false` is applied by the parser for all warmup exercises
  when the `rest_after` column is absent, but that only suppresses the rest
  that would otherwise precede the NEXT exercise (e.g. Band Pull-Aparts)

**Rule:** `restAfter: false` skips the rest timer before moving to the next
exercise. It never skips rest between sets of the same exercise — that always
follows `rest_seconds`.

---

## Warmup to Main Phase Transition

**As a user finishing the last warmup exercise:**

- After the final set of the last warmup exercise, the workout advances
  immediately to the first main phase exercise
- No rest timer appears between the warmup and main phases
- The first main phase exercise is shown with its full set/weight/rep details

---

## Warmup Exercise Order

**As a user starting a workout:**

- Warmup exercises always appear before main phase exercises, regardless of
  their `Order` value in the XLSX
- Within the warmup phase, exercises are sorted by `Order` ascending
- The parser enforces phase order: warmup → main → finisher → cooldown → mobility

---

## Unilateral Warmup Exercises

**As a user viewing a unilateral warmup exercise:**

Given External Rotations LEFT ONLY is configured with `unilateral: TRUE`,
`sets: 1`, `phase: warmup`:

- I see a label indicating this is a single-side exercise (e.g. "Left only" or "Unilateral")
- There is no rest timer after the set
- The exercise advances immediately to the next warmup exercise

---

## Phase Ordering Rules (All Phases)

The following order is always enforced, regardless of `Order` values in the XLSX:

1. warmup
2. main
3. finisher
4. cooldown
5. mobility

Within each phase, exercises are sorted by their `Order` value ascending.
After sorting, all exercises are re-indexed 1–N globally within the workout.