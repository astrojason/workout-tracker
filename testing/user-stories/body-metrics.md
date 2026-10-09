# Body Metrics Tracking

## Weekly Check-ins

**As a user tracking changes in my body alongside strength progress:**

- I can log a check-in from the History screen with a date and required body weight in pounds
- I can optionally record chest, waist, hips, arm, and thigh measurements in inches, plus left/right bicep, thigh, and calf
- I can optionally transcribe RunStar smart-scale readings for body fat, BMI, heart rate,
  muscle mass, bone mass, body water, visceral fat, protein, BMR, metabolic age,
  standard/fat-free weight, subcutaneous fat, skeletal muscle, and water weight
- Blank optional measurements are not stored as zeroes
- After saving, the newest check-in is shown immediately without reloading the page
- A failed load, save, or delete is shown in the app error modal with the original error details

## Trends and History

- I see my latest body weight and any optional measurements recorded with it
- I can chart body weight and each optional measurement that has historical data
- Smart-scale composition values are identified as estimates for trend tracking, not medical measurements
- Check-ins are charted chronologically even if I enter an older date later
- I can review recent dated weigh-ins and delete an incorrect entry after confirmation
- Deleting one entry does not affect workout sessions, exercise history, or other body check-ins

## Baseline From Program Import

- Importing a program XLSX that has a `Measurements` sheet records its Baseline column as my first check-in (dated the import day)
- STOMACH is saved as waist; left/right bicep, thigh, and calf are saved per side; fractions like `12 7/8"` become 12.875 in
- The baseline has no body weight; it shows in Latest check-in and the history list without a weight, and weight is not required for imported entries
- Re-importing an existing program does not add another baseline
