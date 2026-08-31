# Equipment Reference

Owned equipment inventory and the `Equip Type` / `Equip Detail` / `Total
Weight` semantics used in program import (`equipment-calculator.ts`,
`types.ts`). For the rest of the exercise import schema, see
`reference/exercise-import.md`.

---

## 1. Owned equipment

Full physical inventory lives in `Gym_Equipment.md`. The table below is the
subset modeled as a distinct `Equip Type` the app calculates weights/plates
for.

| Category | Owned |
|---|---|
| Barbells | 45 lb Olympic, 35 lb, 15 lb EZ curl |
| Plates (per side, symmetric) | 45×1, 35×1, 25×2, 10×2, 5×1, 2.5×1, 1×1, 0.75×1, 0.5×1 |
| PowerBlock | Elite EXP, 5–50 lbs, 2.5 lb steps |
| Fixed dumbbell | 2 lb only |
| Kettlebells | 15, 25, 45 lb |
| Serious Steel bands | Orange, Purple, Red, Blue, Green, Black (all 6 owned) |
| Loop bands | Ultra-light, Light, Medium, Heavy, X-heavy, XX-heavy (all 6 owned; `Equip Type = loop_band`, distinct from Serious Steel bands) |
| Pull-up assist | up to 4 bands (~80 lbs assistance each) |
| Grippers | Captains of Crush: Trainer (T), 0.5, 1 |
| Spud Pulley System | plate-loaded, unilateral — no bar, no per-side split (`Equip Type = pulley`, see §2–§4) |

Defaults are `DEFAULT_EQUIPMENT_CONFIG`; live per-user config is at
**Settings → Manage Equipment** and can differ from this table.

---

## 2. `Equip Type` — valid values

| Equip Type | Physical gear | Calculated by app? |
|---|---|---|
| `barbell_45` | 45 lb Olympic bar | Yes — auto plate math |
| `barbell_35` | 35 lb bar | Yes — auto plate math |
| `barbell_ez` | 15 lb EZ curl bar | Yes — auto plate math |
| `powerblock` | PowerBlock adjustable dumbbell | Yes — snaps to 2.5 lb steps, 5–50 lb range |
| `band` | Serious Steel resistance band | No calc; needs `Equip Detail` = color |
| `loop_band` | Loop resistance band | No calc (no known lb range for these — only the size is tracked); needs `Equip Detail` = size |
| `kettlebell` | Fixed kettlebell | No calc; weight = the kettlebell's own weight |
| `bodyweight` | No external load | No calc |
| `assisted_pullup` | Pull-up assist bands | No calc; weight = band count (see §4) |
| `gripper` | Captains of Crush gripper | No calc; weight = lbs rating |
| `dumbbell` | Plain/fixed dumbbell | No calc; weight = the dumbbell's own weight |
| `pulley` | Plate-loaded pulley/cable attachment (e.g. Spud Pulley System) | Yes — auto plate math, single stack on one pin (no bar weight, no per-side split — see §3/§4) |

Equipment not in this table (foam rollers, medicine balls, jump ropes, chirp
wheels, etc. — full list in `Gym_Equipment.md`) uses `Equip Type = bodyweight`
with a descriptive `Equip Detail`.

---

## 3. `Equip Detail` — per-type conventions

| Equip Type | Equip Detail format | Notes |
|---|---|---|
| `band` | One of: `Orange`, `Purple`, `Red`, `Blue`, `Green`, `Black` | Must match exactly (case-sensitive) or it displays as "Unknown Band". Blank = no resistance-range display. |
| `loop_band` | One of: `Ultra-light`, `Light`, `Medium`, `Heavy`, `X-heavy`, `XX-heavy` | Not validated against this list — any value is shown as-is (e.g. `"${value} Loop Band"`). Defaults to `Medium` when blank. |
| `powerblock` | Blank normally. `2lb` (or any value <5, with or without `lb`/`lbs` suffix) triggers the fixed-dumbbell escape hatch. | Anything ≥5 is ignored — PowerBlock weight comes from `Total Weight`, not detail. |
| `bodyweight` | Free text, e.g. `2lb_optional`, `lacrosse_ball`, `choice`, `back_lats` | Purely descriptive, shown as-is or defaults to "Bodyweight" if blank. Not parsed. |
| `barbell_45` / `barbell_35` / `barbell_ez` | Blank | Ignored entirely — plates are auto-calculated from owned inventory. |
| `assisted_pullup` | Blank | Ignored by the calculator (band count comes from `Total Weight`, see §4) — only shown as a fallback label if weight is 0. |
| `kettlebell` / `gripper` | Blank | Not used. |
| `pulley` | Blank | Ignored — plates are auto-calculated from owned inventory, same as a barbell, just single-sided. |

---

## 4. Weight (`Total Weight` column)

Per-type semantics:

- **`assisted_pullup`: `Total Weight` = raw number of bands (e.g. `3`), NOT
  pounds of assistance.** The app multiplies by ~80 lbs itself for display.
  Older CSV data in this repo (`WorkoutTracker/Resources/CSV/*.csv`, iOS-only,
  not used by the web app) stored this as lbs-of-assistance (e.g. `240` for 3
  bands) — that convention does not apply to the current web XLSX import.
- **`gripper`: `Total Weight` = the gripper's closing-force rating in lbs**
  (e.g. a Captains of Crush #1 ≈ 100 lbs), not a CoC level string.
- **`barbell_*` / `powerblock`: `Total Weight` = full target weight including
  bar weight** (not per-side). The app snaps it to the nearest achievable
  plate combination / PowerBlock step automatically.
- **`kettlebell`: `Total Weight` = the kettlebell's fixed weight** (one of
  the owned weights: 15, 25, 45).
- **`pulley`: `Total Weight` = the total plate weight loaded on the pin** —
  the app calculates which plates achieve it (single stack, not split), the
  same way it does for a barbell's per-side plates.
- **`band` / `loop_band`: `Total Weight` is unused** — `0`. Resistance comes
  from `Equip Detail` (color for `band`, size for `loop_band`).
- **`bodyweight`: `Total Weight` = `0`** unless there's a genuine added load.

`0` or omitted starts the exercise unweighted/unseeded, set in-app on first
use. `Total Weight` only seeds a brand-new exercise — re-importing a program
never overwrites weight already progressed in-app for an exercise that
already exists in the library (matched by exact name, case-insensitive).
