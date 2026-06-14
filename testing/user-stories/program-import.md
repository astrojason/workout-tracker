# Program Import

## XLSX Import

**As a user importing a program via XLSX:**

- I upload a valid multi-sheet XLSX file in Settings
- Each sheet named Monday–Sunday is parsed as a separate workout day
- Sheets with any other name are ignored
- The program appears on the home screen after import
- Re-importing the same XLSX updates exercise definitions without deleting session history

**Rules:**
- Each exercise gets a unique UUID assigned at parse time
- `total_weight > 0` seeds the starting weight for progressive exercises
- `last_set_amrap: TRUE` marks the final set as AMRAP regardless of `rep_max`
- `rest_after: FALSE` suppresses the between-exercise rest timer
- All warmup phase exercises default to `rest_after: false` when the column is absent
- Exercises within a workout are sorted: warmup → main → finisher → cooldown → mobility, then by `Order` within each phase
- After sorting, exercises are re-indexed 1–N

## Invalid Import

**As a user importing a malformed XLSX:**

- If a row is missing a required field (Week, Phase, Order, Exercise, Equip Type), I see a clear error message identifying the sheet and row number
- If `Equip Type` contains an unrecognized value, I see an error identifying the invalid value
- If `Phase` contains an unrecognized value, I see an error identifying the invalid value
- A failed import does not overwrite my existing programs

## Program Lifecycle

**As a user managing programs:**

- I can archive a program — it disappears from the home screen but session history is preserved
- I can delete a program — it is permanently removed
- I can re-import an XLSX to refresh exercise definitions for an existing program
- Archived programs do not appear in the week selector or on program cards