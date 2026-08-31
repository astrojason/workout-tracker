# Exercise Import Reference

XLSX program import file structure and column schema
(`web/src/lib/xlsx-parser.ts`). Equipment column semantics are in
`reference/equipment.md`; progression rule values are in
`reference/progression.md`.

---

## Sheet structure

Sheet name must be exactly `Monday`, `Tuesday`, `Wednesday`, `Thursday`,
`Friday`, `Saturday`, `Sunday`, or `Daily` — any other sheet name is ignored.
`Daily` = the workout is offered every day and auto-detected as checklist
mode (no rest timers, just a tick-through list) if every exercise also has
`Rest (s) = 0` and a non-weight-tracking progression rule.

---

## Columns

Title Case headers, not snake_case:

| Column | Required | Notes |
|---|---|---|
| `Week` | Yes | Integer, 1–N |
| `Phase` | Yes | `warmup`, `main`, `finisher`, `cooldown`, `mobility` |
| `Order` | Yes | Integer sort order within the day (re-sorted by phase then order on import) |
| `Exercise` | Yes | Exercise name — a blank cell here silently skips the row (used for divider rows) |
| `Equip Category` | No | Display-only grouping, not stored |
| `Equip Type` | Yes | See `reference/equipment.md` §2 |
| `Equip Detail` | No | See `reference/equipment.md` §3 |
| `Total Weight` | No | See `reference/equipment.md` §4 |
| `Sets` | Yes | Integer |
| `Rep Min` | Yes | Integer (or hold-duration seconds if time-based) |
| `Rep Max` | Yes | Integer, or `failure` for AMRAP |
| `Last Set AMRAP` | No | `TRUE`/`FALSE` — final set is AMRAP regardless of `Rep Max` |
| `Rest (s)` | Yes | Integer seconds of rest between this exercise's own sets. `0` = no rest timer between sets. |
| `Rest After` | No | Rest before the NEXT exercise only — never affects rest between this exercise's own sets, which always uses `Rest (s)`. `FALSE`, an integer, `"90s"`, `"2m"`, or `"2:00"`. Warmup-phase rows default to `FALSE` if omitted; non-warmup rows default to blank. |
| `Progression` | No | See `reference/progression.md`; defaults to `none` if blank |
| `Unilateral` | No | `TRUE`/`FALSE` — per-side exercise |
| `Is Timed` | No | `TRUE`/`FALSE`; also auto-inferred when `Progression = add_time` or `Rep Min ≥ 30` |
| `Notes` | No | Shown to the user during the workout |

No `Program Name` column — the program name is set once when importing the
file, not per-row. No `Base Weight` column (that's the old CSV-only format)
— `Total Weight` replaces it.

Re-importing matches exercises by name only (trimmed, case-insensitive)
against the user's existing exercise library — reusing an exact existing
name updates its metadata (equipment/progression) but never touches its
current weight or progress history.

---

## Worked examples (one row per equipment type)

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
1    | main  | 9     | Tricep Pushdown   | pulley         |              | 45           | 3    | 12      | 15      | 60       | none          | TRUE
1    | main  | 10    | Monster Walk      | loop_band      | Medium       | 0            | 3    | 15      | 20      | 45       | none          | FALSE
```

Examples omit `Rest After` entirely — that's the default. A value is only
set on a row that overrides the rest before the *next* exercise (e.g.
`FALSE` for a superset pair, or a shorter override).
