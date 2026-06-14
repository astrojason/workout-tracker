# Unilateral Exercises

Unilateral exercises work one side at a time. They are identified by `unilateral: TRUE`
in the XLSX. The weight displayed is the per-side load, not a combined total.

---

## Display

**As a user viewing a unilateral exercise:**

Given External Rotations is configured with `unilateral: TRUE`, `equipment_type: band`,
`equipment_detail: "Purple"`:

- I see a label indicating this is a per-side exercise (e.g. "Each side" or "Unilateral")
- The band color displayed is "Purple"
- The rep target applies per side — "12 reps each side", not "12 reps total"

Given a unilateral PowerBlock exercise at 20 lbs:

- I see "20 lbs each side"
- The PowerBlock selector/rod instructions are for a single 20 lb dumbbell
- I am not shown a combined 40 lb total

---

## Logging

**As a user completing a unilateral set:**

- The completion modal records reps and weight as per-side values
- `actualWeight` in the CompletedSet is the per-side load
- The set is logged once — not once per side
- `isUnilateral: true` is not currently stored on CompletedSet but the
  per-side weight convention must be consistent with how the exercise was displayed

---

## PR Detection for Unilateral Exercises

**As a user who sets a PR on a unilateral exercise:**

- Max weight PR uses the per-side `actualWeight` — not doubled
- Estimated 1RM uses the per-side weight
- Volume PR uses `actualWeight × actualReps` (per-side weight × per-side reps)
- PRs for unilateral exercises are comparable across sessions only if the
  per-side convention is applied consistently

---

## Rules

- `unilateral: TRUE` affects display labeling and weight interpretation only
- It does not change set count, rep count, or rest timer behavior
- A unilateral exercise with `sets: 3` means 3 sets per side (as labeled),
  logged as 3 CompletedSet records