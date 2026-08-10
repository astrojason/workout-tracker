# Equipment Guide for Workout Program Planning

**Purpose:** paste this into a Claude chat when asking it to design a new workout
program for this app. It documents exactly how to express equipment choices so
the resulting program imports cleanly via **Settings → Import Program (XLSX)**.
Verified directly against the current web app source (`web/src/lib/xlsx-parser.ts`,
`equipment-calculator.ts`, `types.ts`) — `workout_tracker_spec.md`'s Data Formats
section predates the exercise-library feature and its column names no longer
match the real importer; this doc supersedes it for equipment/XLSX purposes.

---

## 1. Owned equipment (what's actually available)

Full physical inventory lives in `Gym_Equipment.md`. Only the subset below is
modeled as a distinct `Equip Type` the app can calculate weights/plates for.
Everything else in that inventory (foam rollers, TENS unit, medicine balls,
jump ropes, chirp wheels, etc.) should be planned as `bodyweight` exercises
with a descriptive note — the app doesn't calculate anything for them.

| Category | Owned |
|---|---|
| Barbells | 45 lb Olympic, 35 lb, 15 lb EZ curl |
| Plates (per side, symmetric) | 45×1, 35×1, 25×2, 10×2, 5×1, 2.5×1, 1×1, 0.75×1, 0.5×1 |
| PowerBlock | Elite EXP, 5–50 lbs, 2.5 lb steps |
| Fixed dumbbell | 2 lb only |
| Kettlebells | 15, 25, 45 lb |
| Serious Steel bands | Orange, Purple, Red, Blue, Green, Black (all 6 owned) |
| Pull-up assist | up to 4 bands (~80 lbs assistance each) |
| Grippers | Captains of Crush: Trainer (T), 0.5, 1 |
| Spud Pulley System | plate-loaded, unilateral — no bar, no per-side split (see §8 for import workaround) |

These are defaults (`DEFAULT_EQUIPMENT_CONFIG`); the live per-user config is
editable at **Settings → Manage Equipment** and can differ from this table —
if precision matters, ask the user to confirm current inventory rather than
trusting this snapshot.

---

## 2. `Equip Type` — valid values

| Equip Type | Physical gear | Calculated by app? |
|---|---|---|
| `barbell_45` | 45 lb Olympic bar | Yes — auto plate math |
| `barbell_35` | 35 lb bar | Yes — auto plate math |
| `barbell_ez` | 15 lb EZ curl bar | Yes — auto plate math |
| `powerblock` | PowerBlock adjustable dumbbell | Yes — snaps to 2.5 lb steps, 5–50 lb range |
| `band` | Serious Steel resistance band | No calc; needs `Equip Detail` = color |
| `kettlebell` | Fixed kettlebell | No calc; weight = the kettlebell's own weight |
| `bodyweight` | No external load | No calc |
| `assisted_pullup` | Pull-up assist bands | No calc; weight = band count (see §4) |
| `gripper` | Captains of Crush gripper | No calc; weight = lbs rating |
| `dumbbell` | Plain/fixed dumbbell | No calc; weight = the dumbbell's own weight |

---

## 3. `Equip Detail` — per-type conventions

| Equip Type | Equip Detail format | Notes |
|---|---|---|
| `band` | One of: `Orange`, `Purple`, `Red`, `Blue`, `Green`, `Black` | Must match exactly (case-sensitive) or it displays as "Unknown Band". Leave blank only if you don't care about the resistance-range display. |
| `powerblock` | Blank normally. `2lb` (or any value <5, with or without `lb`/`lbs` suffix) triggers the fixed-dumbbell escape hatch. | Anything ≥5 is ignored — PowerBlock weight comes from `Total Weight`, not detail. |
| `bodyweight` | Free text, e.g. `2lb_optional`, `lacrosse_ball`, `choice`, `back_lats` | Purely descriptive, shown to the user as-is or defaults to "Bodyweight" if blank. Not parsed. |
| `barbell_45` / `barbell_35` / `barbell_ez` | Leave blank | Ignored entirely — plates are auto-calculated from owned inventory. |
| `assisted_pullup` | Leave blank | Ignored by the current calculator (band count comes from `Total Weight`, see §4) — only ever shown as a fallback label if weight is 0. |
| `kettlebell` / `gripper` | Leave blank | Not used. |

---

## 4. Weight (`Total Weight` column)

`Total Weight` seeds the exercise's starting weight in the app's units — **read
this carefully for `assisted_pullup`, it's a real trap**:

- **`assisted_pullup`: `Total Weight` = raw number of bands (e.g. `3`), NOT
  pounds of assistance.** The app multiplies by ~80 lbs itself for display.
  Older CSV data in this repo (`WorkoutTracker/Resources/CSV/*.csv`, iOS-only,
  not used by the web app) stored this as lbs-of-assistance (e.g. `240` for 3
  bands) — that convention does **not** apply to the current web XLSX import.
  Use the band count directly.
- **`gripper`: `Total Weight` = the gripper's closing-force rating in lbs**
  (e.g. a Captains of Crush #1 ≈ 100 lbs), not a CoC level string.
- **`barbell_*` / `powerblock`: `Total Weight` = full target weight including
  bar weight** (not per-side). The app snaps it to the nearest achievable
  plate combination / PowerBlock step automatically.
- **`kettlebell`: `Total Weight` = the kettlebell's fixed weight** (should
  match one of the owned weights: 15, 25, 45).
- **`band`: `Total Weight` is unused** — leave `0`. Resistance comes from the
  band color in `Equip Detail`.
- **`bodyweight`: `Total Weight` = `0`** unless there's a genuine added load.

If omitted or `0`, the exercise starts unweighted/unseeded and the user sets
it in-app on first use. `Total Weight` only seeds a **brand-new** exercise —
re-importing a program never overwrites weight already progressed in-app for
an exercise that already exists in the library (matched by exact name,
case-insensitive).

---

## 5. `Progression` rule — valid values

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
| Any other free-form string | Allowed and stored as-is (e.g. a band color name for dip-assist progression), but has no automatic effect — informational only |

Only `add_5lb` / `add_2.5lb` / `add_10lb` actually auto-increment weight in the
current app. Everything else requires the user to change weight manually.

---

## 6. XLSX file structure

- **One sheet per day of week.** Sheet name must be exactly `Monday`,
  `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday`, or
  `Daily`. Any other sheet name is ignored entirely. `Daily` = the workout
  is offered every day and auto-detected as **checklist mode** (no rest
  timers, just a tick-through list) if every exercise also has
  `Rest (s) = 0` and a non-weight-tracking progression rule.
- **Columns use Title Case headers**, not snake_case:

  | Column | Required | Notes |
  |---|---|---|
  | `Week` | Yes | Integer, 1–N |
  | `Phase` | Yes | `warmup`, `main`, `finisher`, `cooldown`, `mobility` |
  | `Order` | Yes | Integer sort order within the day (re-sorted by phase then order on import) |
  | `Exercise` | Yes | Exercise name — **a blank cell here silently skips the row** (used for divider rows) |
  | `Equip Category` | No | Display-only grouping, not stored — safe to omit |
  | `Equip Type` | Yes | See §2 |
  | `Equip Detail` | No | See §3 |
  | `Total Weight` | No | See §4 |
  | `Sets` | Yes | Integer |
  | `Rep Min` | Yes | Integer (or hold-duration seconds if time-based) |
  | `Rep Max` | Yes | Integer, or `failure` for AMRAP |
  | `Last Set AMRAP` | No | `TRUE`/`FALSE` — final set is AMRAP regardless of `Rep Max` |
  | `Rest (s)` | Yes | Integer seconds of rest **between this exercise's own sets**. `0` = no rest timer between sets. |
  | `Rest After` | No | Rest **before the NEXT exercise only** — never affects rest between this exercise's own sets, which always uses `Rest (s)`. Leave blank for normal exercises. `FALSE`, an integer, `"90s"`, `"2m"`, or `"2:00"`. Warmup-phase rows default to `FALSE` if omitted (so warmup movements flow into each other), but non-warmup rows should be left blank unless you deliberately want a superset/no-rest transition into the next exercise — don't fill this column with `FALSE` by default. |
  | `Progression` | No | See §5; defaults to `none` if blank |
  | `Unilateral` | No | `TRUE`/`FALSE` — per-side exercise |
  | `Is Timed` | No | `TRUE`/`FALSE`; also auto-inferred when `Progression = add_time` or `Rep Min ≥ 30` |
  | `Notes` | No | Shown to the user during the workout |

- **No `Program Name` column** — the program name is set once when importing
  the file, not per-row.
- **No `Base Weight` column** (that's the old CSV-only format) — use
  `Total Weight` instead.
- Re-importing matches exercises by **name only** (trimmed, case-insensitive)
  against the user's existing exercise library — reusing an exact existing
  name updates its metadata (equipment/progression) but never touches its
  current weight or progress history.

---

## 7. Worked examples (one row per equipment type)

```
Week | Phase | Order | Exercise          | Equip Type     | Equip Detail | Total Weight | Sets | Rep Min | Rep Max | Rest (s) | Progression   | Unilateral
1    | main  | 1     | Bench Press       | barbell_45     |              | 135          | 3    | 6       | 8       | 120      | add_5lb       | FALSE
1    | main  | 2     | Bicep Curl        | powerblock     |              | 25           | 3    | 8       | 10      | 90       | add_2.5lb     | FALSE
1    | main  | 3     | Wrist Curl        | powerblock     | 2lb          | 2            | 2    | 15      | 20      | 60       | none          | FALSE
1    | main  | 4     | Band Pull-Apart   | band           | Blue         | 0            | 3    | 15      | 20      | 60       | none          | FALSE
1    | main  | 5     | Goblet Squat      | kettlebell     |              | 25           | 3    | 10      | 12      | 90       | maintain      | FALSE
1    | main  | 6     | Weighted Pull-up  | assisted_pullup|              | 2            | 3    | 5       | 8       | 120      | reduce_assistance | FALSE
1    | main  | 7     | Push-up           | bodyweight     |              | 0            | 3    | 12      | 15      | 60       | add_reps      | FALSE
1    | main  | 8     | Gripper Close     | gripper        |              | 100          | 3    | 5       | 5       | 90       | progress_gripper | FALSE
```

Note these examples omit `Rest After` entirely — that's the correct default. Only add a
`Rest After` column value on a row when you specifically want to override the rest
before the *next* exercise (e.g. `FALSE` for a superset pair, or a shorter override).

---

## 8. Other known gaps (as of this writing)

- Loop bands (`loopBands` in the equipment config) are trackable as owned
  inventory in Settings but have no dedicated `Equip Type` — they aren't
  currently assignable to an exercise at all.
- **Spud Pulley System has no dedicated `Equip Type`.** It's plate-loaded
  (unlike `bodyweight`, which never shows a weight number) but has no bar
  weight and no per-side split (unlike `barbell_*`/landmine mode, which
  bakes in a 45/35 lb bar and splits remaining plates across two sides —
  wrong here since a Spud row is a single stack of plates on one pin,
  worked unilaterally). **Workaround: use `Equip Type = kettlebell`** with
  `Total Weight` = the actual plate weight loaded on the pulley pin. That
  type displays the raw weight number with no calculation or splitting,
  which matches how the pulley actually loads. Use `Notes` to clarify it's
  a Spud Pulley exercise, not a literal kettlebell.
