# Personal Records and History

## PR Detection

**As a user who just completed a workout:**

Three PR types are checked per exercise after every session:

1. **Max weight** — highest `actualWeight` across all completed sets for that exercise
2. **Estimated 1RM** — Epley formula: `weight × (1 + reps / 30)`; single-rep sets use raw weight
3. **Volume** — sum of `actualWeight × actualReps` across all completed sets

**Rules:**
- PRs are only checked against sets where `completed: true`
- Skipped sets (0 reps, `completed: false`) are excluded from PR calculations
- If a new PR is achieved, it is saved to Firestore and displayed on the WorkoutComplete screen
- If no PR is achieved, nothing is saved or displayed for that exercise

## History Page

**As a user viewing /history:**

- I see an Exercise Progress section listing all exercises that have a weight PR, sorted alphabetically
- I see a Recent Workouts section listing past sessions (program, day, week, date, duration)
- Each section shows 10 items initially and can be expanded
- Tapping an exercise navigates to /exercise/[name]
- Tapping a session navigates to /session/[id]

## Session Detail

**As a user viewing /session/[id]:**

- I see total duration, number of sets completed, and completion status (Done or Partial)
- Exercises are grouped with a set table showing: set number, weight, reps, difficulty rating, pass/fail
- A "Progress →" link navigates to the exercise history chart

## Exercise History

**As a user viewing /exercise/[name]:**

- I see a time-series chart of progression for that exercise
- Each data point represents the heaviest completed set from a session
- Sets with weight = 0 are excluded
- Time-based exercises display duration instead of weight
- Bodyweight exercises display max reps instead of weight