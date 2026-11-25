## Bugs

- "Last time" for some exercises (e.g. Pushdowns) shows reps with no weight; likely older sessions never saved a weight (actualWeight 0). Needs a look at the stored session data before changing anything; falling back to targetWeight would be a guess
- Streak counter on Home only counts about the last week, because Home now loads only the last 7 days of sessions. Fix by storing the streak (or a lightweight query for just the completed dates) instead of deriving it from loaded sessions
- Changelog page: the "Changelog" heading and version headings render in a very dim colour on the dark background; check contrast
- the generated warm up set for a kettlebell exercise suggests equipment that the user does not have, make sure that the calculated warm up sets are possible

## Features

- iPhone + Apple Watch app (`mobile/`): built and installed (native Google sign-in, rest-complete notifications, Live Activity, Home Screen widget, watchOS mirror). Still to confirm on a real device after the latest deploy: sign-in and the Home screen load, a rest notification while locked, the Live Activity countdown, the widget showing today's workout, and the watch display. Then: check offline behaviour at the gym (Firestore has no offline cache), and ship via TestFlight with a local `eas build --local`.
  - Then retire the Swift app (`WorkoutTracker/`, `project.yml`, `Resources/CSV`): archive it in git history and update README/CLAUDE.md, which still describe it as an active platform.
