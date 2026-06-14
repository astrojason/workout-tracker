# Settings and Program Editor

## Settings Page

**As a user in Settings:**

- I can set a default rest time: 60, 90, 120, 150, or 180 seconds (default: 120)
- I can toggle timer sound on or off
- I can select the current week for each program via a dropdown
- I can import a new XLSX to add or update a program
- I can sign out
- I can see my account email

## Program Editor

**As a user editing a program at /programs/[id]:**

- I see exercises grouped by week (tabs) and by day
- Exercises are sorted by exercise order within each day
- I can add a new exercise via the ExerciseEditor modal
- I can edit an existing exercise via the ExerciseEditor modal
- I can delete an exercise
- I can toggle checklist mode per workout day
- Duplicate order values are auto-healed on load — no two exercises share the same order within a day

## Exercise Editor Modal

**As a user adding or editing an exercise:**

- I can set: name, phase, equipment type, equipment detail, total weight, sets, rep min, rep max, rest seconds, rest after, progression rule, unilateral flag, last set AMRAP flag, notes
- Saving writes the exercise to Firestore immediately
- Cancelling discards changes
- The updated exercise is reflected in the program view without a page reload

## Week Management

**As a user managing program weeks:**

- The current week for each program is stored in settings (not the program itself)
- Changing the week in Settings immediately updates which workout is shown on the home screen
- The week selector shows weeks 1 through the program's `totalWeeks`