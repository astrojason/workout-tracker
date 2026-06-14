# Resistance Reduction Progression

Progression for assisted exercises works in reverse — the goal is to need *less* help over time.
Progress means moving to a lighter band or fewer bands, not adding weight.

---

## Assisted Pull-ups — Band Count Reduction

**As a user viewing Assisted Pull-ups:**

Given Assisted Pull-ups is configured with `equipment_detail: "3_bands"` and `progression_rule: "2 bands"`:

- I see the current assistance displayed as "3 bands"
- The exercise is `equipment_type: assisted_pullup` — it is not treated as a weighted exercise
- The displayed assistance tells me how many bands to loop over the bar
- The next-step progression displayed is "2 bands" — fewer bands = less assistance = harder

**Rules:**
- Assistance band count is displayed from `equipment_detail`, not calculated from a weight value
- The progression rule value (`"2 bands"`) is the next step — it is a label, not a weight increment
- Reducing band count is progress; the app must never treat a lower band count as a regression

---

## Assisted Pull-ups — Time-Based Variant (Scapular Hangs)

**As a user viewing Scapular Hangs:**

Given Scapular Hangs is configured with `equipment_detail: "3_bands"`, `rep_min: 30`, `progression_rule: "none"`, and `isTimeBased: true`:

- I see the target displayed as a duration: "30 seconds" (not "30 reps")
- The assistance is displayed as "3 bands"
- There is no progression step shown — `none` means hold at current band count and duration
- The rest timer between sets is 30 seconds

---

## Dips — Band Color Reduction

**As a user viewing Dips:**

Given Dips is configured with `equipment_type: band`, `equipment_detail: "Green"`, and `progression_rule: "Blue"`:

- I see the current assistance displayed as "Green band"
- The resistance range for Green is shown: 50–120 lbs
- The next-step progression displayed is "Blue band" (20–80 lbs)
- Blue provides less assistance than Green — this is progress

**Rules:**
- Band color progressions use the `progression_rule` field as a specific next-step label, not an enum keyword
- The app must never interpret a band color string as an unrecognized progression rule or throw an error
- Band resistance ranges are informational — they are displayed to the user but do not affect set counting or weight math

---

## General Rules for Resistance Reduction Exercises

- `equipment_type: assisted_pullup` exercises are never treated as weighted exercises — no plate math applies
- `equipment_detail` holds the current assistance configuration (band color or band count string)
- `progression_rule` holds the next-step target when it is a specific string value (e.g. `"Blue"`, `"2 bands"`)
- Progress = less assistance; the UI must frame next steps as advancement, not reduction
- These exercises do not contribute to weight-based PRs — they may contribute to rep or volume PRs only if `actualWeight > 0`