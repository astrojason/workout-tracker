# Progression Rules Reference

`Progression` column valid values for program import (`progression-service.ts`,
`types.ts`). See `reference/exercise-import.md` for the full column schema.

| Rule | Effect |
|---|---|
| `add_5lb` | Auto +5 lbs when all sets complete at rep target |
| `add_2.5lb` | Auto +2.5 lbs (typical for PowerBlock) |
| `add_10lb` | Auto +10 lbs (barbell rows, hip thrusts, etc.) |
| `add_reps` | No auto weight change; track rep progress manually |
| `add_time` | No auto weight change; track duration progress manually |
| `add_rounds` | No auto weight change; track rounds manually |
| `maintain` | No change — fixed-load exercise |
| `deload` | No change — intended for deload weeks |
| `reduce_assistance` | No automated change (informational label) — user manually lowers `assisted_pullup` band count when ready |
| `progress_gripper` | No automated change — user manually notes CoC level progress |
| `none` | No progression tracking at all |
| Any other free-form string | Allowed and stored as-is (e.g. a band color name for dip-assist progression), no automatic effect — informational only |

Only `add_5lb` / `add_2.5lb` / `add_10lb` auto-increment weight in the current
app. Everything else requires the user to change weight manually.
