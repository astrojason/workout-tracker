## Bugs

- "Last time" for some exercises (e.g. Pushdowns) shows reps with no weight; likely older sessions never saved a weight (actualWeight 0). Needs a look at the stored session data before changing anything; falling back to targetWeight would be a guess

## Features

- iPhone + Apple Watch app (`mobile/`, Expo shell around the deployed web app; install with `scripts/ios-install`). Built: native Google sign-in, rest-complete local notifications, watchOS mirror of set/rest timer. Remaining: fill `mobile/.env.local` (deployed URL, iOS Google client ID from the Firebase iOS app's `GoogleService-Info.plist`), run `scripts/ios-install` on a real iPhone and confirm sign-in, notification while locked, and the watch mirror; replace the placeholder `mobile/assets/icon.png`; check offline behaviour at the gym; TestFlight via a local `eas build --local`.
  - Then retire the Swift app (`WorkoutTracker/`, `project.yml`, `Resources/CSV`): archive it in git history and update README/CLAUDE.md, which still describe two independent platforms.

## Enhancements
