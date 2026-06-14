# Progression and Weight Resolution

## Starting Weight

**As a user starting a workout:**

- Each exercise resolves its starting weight before the workout begins
- If `total_weight` is set and greater than 0 in the XLSX, that value is used as the starting weight
- If `total_weight` is 0 or absent, the starting weight is 0 and I must set it manually
- The resolved weight is locked in at workout start — changes to the XLSX mid-session do not affect the active workout

## Manual Weight Override

**As a user adjusting weight during a workout:**

- I can edit the weight for any exercise before or during a set
- The updated weight applies immediately to the current and all remaining sets of that exercise
- The change does not affect other exercises or future sessions
- The original planned weight is still recorded as `targetWeight` in the completed set

## Manual Set Count Override

**As a user adjusting set count during a workout:**

- I can increase or decrease the number of sets for any exercise mid-workout
- If I reduce sets below the current set number, the exercise completes immediately
- The change does not affect the program definition — only the active session

## Progression Rules

**As a user reviewing progression after a session:**

- `add_5lb` — next planned weight increases by 5 lbs
- `add_2.5lb` — next planned weight increases by 2.5 lbs
- `add_10lb` — next planned weight increases by 10 lbs
- `add_reps`, `add_time`, `add_rounds` — weight does not change; rep/time/round target increases
- `maintain`, `deload`, `none` — no automatic change
- `progress_gripper` — no weight change; custom gripper progression
- Band color string (e.g. `"Blue"`) — next step is that specific band
- Band count string (e.g. `"2 bands"`) — next step is that band count

**Rule:** Progression rules are informational in the web app. They are displayed for reference but do not automatically update future session weights. The user applies them manually via the weight editor.

## Equipment Snapping

**As a user viewing a suggested next weight:**

- Barbell weights snap to the nearest achievable plate combination (rounding down if exact match is impossible)
- PowerBlock weights snap to the nearest 2.5 lbs, clamped between 5 and 50 lbs
- Band, bodyweight, kettlebell, and gripper weights are not snapped