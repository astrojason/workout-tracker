# Custom workout

- From Home, tapping **Custom workout** opens a builder with Exercise, Weight and Reps fields.
- A **Reps / Time** toggle switches a set between reps and a duration in seconds (shown as e.g. 45s; saved as a time-based set).
- A **Bodyweight** toggle disables the weight field and logs the set with no weight (shown as BW). Weight left blank also logs as bodyweight.
- Each logged weighted rep set shows an estimated 1RM (Epley, up to 12 reps); bodyweight, timed and high-rep sets show none.
- Each set gets a **Difficulty** rating (Easy / Normal / Hard, default Normal, reset after each set) that is saved with the set, like program workouts, for history and the coach.
- When the chosen exercise has history (any program or custom, warm-ups ignored) and the weight is blank, a "Suggested N lb" hint appears with a **Use N lb** button. It is the last weight moved by the same rating and time-away progression a program workout applies (see progression-and-weight-resolution). Nothing is suggested for bodyweight, timed, or never-done exercises.
- The Exercise field suggests library exercises but accepts any name.
- **Add set** logs the set. The exercise and weight carry over; reps are cleared for the next set.
- **Change exercise** clears the fields to start another exercise. Sets are grouped per exercise.
- A logged set can be removed with ✕.
- **Finish workout** saves a session under the "Custom Workout" program (shows in History) and checks for PRs. It never changes any program's weights.
- A finished custom workout counts for the day: it extends the streak, checks off any program day scheduled for the weekday it was done, and counts toward "completed this week".

## Scan equipment from a photo
- In the custom workout builder (and when adding a **new** exercise in the program editor), "Scan equipment photo" lets me pick or take a picture.
- The AI names the exercise and fills in the equipment/muscle groups (program editor) and a suggested working weight based on my own history; the one-line reasoning is shown.
- Everything stays editable; if the scan fails, the real error is shown in the error modal and nothing is filled in.
