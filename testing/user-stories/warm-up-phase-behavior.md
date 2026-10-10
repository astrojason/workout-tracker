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

---

## Warm-Up Ramp (barbell and PowerBlock lifts)

**As a user starting a workout where a lift has a warm-up row and a work row:**

Given Bench Press has a warm-up row and a work row, and its current work weight is 200 lbs:

- The warm-up row is replaced by a ramp built from the work weight: the empty bar x8,
  then 40% x5, 60% x3 and 80% x2 (so 45x8, 80x5, 120x3, 160x2), each a single set
- Every ramp weight is **below** the work weight and **at most 85%** of it, rounds
  **down** to something the equipment can load, and strictly increases
- If the work weight is about the bar, no ramp is possible and the warm-up is dropped
- Ramp steps rest 60s between them; after the last one the sheet's own transition
  into the work set applies (normally no rest)
- When the work weight goes up (progression), the next workout's warm-up ramps from
  the new weight; it never stays at the spreadsheet's old warm-up weight
- Warm-up sets never change any stored weight, whatever their progression rule
- Other equipment (e.g. a kettlebell warm-up sharing a lift with a work row) keeps the
  sheet's warm-up as written, capped so it never exceeds the work weight
