# Progression Rules Reference

`Progression` column valid values for program import (`progression-service.ts`,
`types.ts`). See `reference/exercise-import.md` for the full column schema.

| Rule | Effect |
|---|---|
| `add_5lb` | Auto +5 lbs per step (see below) |
| `add_2.5lb` | Auto +2.5 lbs per step (typical for PowerBlock) |
| `add_10lb` | Auto +10 lbs per step (barbell rows, hip thrusts, etc.) |
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
spreadsheet's planned weights after the earliest week are not used. Deleting the
session restores the weight it changed, unless a later session has moved it on.

**Non-AMRAP exercises** follow the last set's rating (step = the rule's increment):

| Last set | Next weight |
|---|---|
| Easy | +2 steps, rounded down to loadable. Also bumps +1 step mid-workout, so the next set loads heavier right away |
| Normal (or unrated) | +1 step, rounded down |
| Hard | Holds; the 3rd hard in a row drops 1 step and resets the count |
| Skipped or failed | Counts as hard |

**AMRAP exercises** (`failure` rep max, or `last_set_amrap` on the final set) ignore
the rating and project from reps (Epley):
`estimated1RM = actualWeight × (1 + reps / 30)` (reps capped at 2× the target — more
means the weight was too light), then
`next = estimated1RM × 30 / (30 + targetReps)`, rounded down to loadable.
