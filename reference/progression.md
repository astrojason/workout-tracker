# Progression Rules Reference

`Progression` column valid values for program import (`progression-service.ts`,
`types.ts`). See `reference/exercise-import.md` for the full column schema.

| Rule | Effect |
|---|---|
| `add_5lb` | Auto weight progression (see below); 5 lb is the drop size after 3 misses |
| `add_2.5lb` | Auto weight progression; 2.5 lb drop size (typical for PowerBlock) |
| `add_10lb` | Auto weight progression; 10 lb drop size (barbell rows, hip thrusts, etc.) |
| `add_reps` | No auto weight change; track rep progress manually |
| `add_time` | No auto weight change; track duration progress manually |
| `add_rounds` | No auto weight change; track rounds manually |
| `maintain` | No change — fixed-load exercise |
| `deload` | No change — intended for deload weeks |
| `reduce_assistance` | No automated change (informational label) — user manually lowers `assisted_pullup` band count when ready |
| `progress_gripper` | No automated change — user manually notes CoC level progress |
| `none` | No progression tracking at all |
| Any other free-form string | Allowed and stored as-is (e.g. a band color name for dip-assist progression), no automatic effect — informational only |

Only `add_5lb` / `add_2.5lb` / `add_10lb` auto-progress weight in the current
app. Everything else requires the user to change weight manually.

## How the next weight is set

Runs once when a workout is saved, against the **last set logged** for each
exercise, and updates the program's stored weight for that exercise (shared by
every appearance of it in the program; other programs are unaffected). The
easy/normal/hard rating does **not** affect the weight, and the spreadsheet's
planned weights after the earliest week are not used.

| Final set | Next weight |
|---|---|
| Completed, AMRAP (`failure` rep max, or `last_set_amrap` on the final set) | Epley projection targeting the set's planned reps |
| Completed, not AMRAP | Epley projection targeting `repMin`; never lower than the current weight |
| Skipped or failed | Weight holds; the 3rd consecutive miss drops it by one increment |

Epley projection: `estimated1RM = actualWeight × (1 + actualReps / 30)`, then
`next = estimated1RM × 30 / (30 + targetReps)`, rounded **down** to a weight the
equipment can load. Reps above the target raise the weight, reps equal to it
hold it, and (for AMRAP only) fewer reps lower it.

Example: hip thrust, 15 reps at 105 with `repMin` 12 → 105 × 1.5 × 30/42 = 112.5.
