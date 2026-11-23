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

## General (Single-Week) Program Import

**As a user importing a general program (e.g. `Reacher_Build.xlsx`):** one sheet per weekday with columns `Exercise | Sets | Reps / Time | Weight | Notes` and no Week/Phase/Equip columns.

- The import detects this format automatically (no day sheet has a `Week` column) and creates a program with 1 week
- `2+1` sets become 3 sets with the last set AMRAP; the following `(AMRAP)` row is merged into that exercise (its progression note is kept) rather than imported twice
- Reps like `5 min` / `Max hold` / `1 min on` become timed exercises (seconds); `Max` / `AMRAP` become to-failure
- Weights are mapped to equipment: `3 bands` → assisted pull-up, `BW` → bodyweight, `Loop band` → loop band, `15 lb KB` → kettlebell, EZ-bar lifts → EZ bar, lb weights at a non-Home location → machine, other lb weights → barbell / PowerBlock / dumbbell by size
- Rows with warmup/activation notes are warm-ups; everything else is a main exercise
- Text the importer cannot map (an unrecognised weight) is kept in the exercise's notes, never dropped
- An invalid `Sets` or `Reps / Time` value gives an error naming the sheet and row
- Importing under the name of an existing program is refused with an error (use Re-import instead); the program id comes from the chosen name, so importing never overwrites another program

## Matching Imported Exercises to the Library

**As a user importing or re-importing a program:**

- Exercises whose name matches one in my library (case-insensitive) are linked automatically
- For each exercise with no match I am asked, one at a time ("Exercise 2 of 5"), whether to use an existing library exercise or create a new one; the closest-named library exercise is pre-selected and I can search the library
- Linking to an existing exercise keeps that exercise as it is (no rename); creating makes a new exercise from the spreadsheet row
- Cancelling at any prompt stops the import with "Import cancelled — nothing was changed."; no programs, workouts or exercises are written

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