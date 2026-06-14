# Equipment Weight Display

## Landmine Press — Single-Side Plate Loading

**As a user viewing Landmine Press weight:**

Given Landmine Press is configured at 55 lbs total:
- I see: 45 lb bar + 10 lb plate (one side)
- I do **not** see: 45 lb bar + 5 lb/side

Given Landmine Press is configured at 90 lbs total:
- I see: 45 lb bar + 45 lb plate (one side)

**Rule:** Any exercise with "landmine" in the name loads plates on one side only.
Total weight = bar weight + single-side plate load. Plate weight is never split across two sides.

---

## Barbell Press — Bilateral Plate Loading

**As a user viewing a standard barbell press weight:**

Given Bench Press is configured at 135 lbs total (45 lb bar):
- I see: 45 lb bar + 45 lb/side

Given Bench Press is configured at 155 lbs total:
- I see: 45 lb bar + 55 lb/side (25 + 25 + 5)

**Rule:** Standard barbell exercises split the plate load evenly across both sides.
Total weight = bar weight + (plate load per side × 2).

---

## PowerBlock Dumbbells

**As a user viewing PowerBlock weight:**

Given an exercise is configured at 25 lbs with `equipment_type: powerblock`:
- I see the selector and rod configuration for 25 lbs
- I do **not** see a plate breakdown

Given `equipment_detail: "2lb"`:
- The exercise is treated as a regular dumbbell, not a PowerBlock

---

## Weight Display Consistency

**Rules that apply to all equipment types:**

- The displayed total weight must always match the configured `total_weight` value
- The plate/configuration breakdown is informational — it tells me what to load, not a different weight
- If the breakdown does not sum to the configured total, that is a bug