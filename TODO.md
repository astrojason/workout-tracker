## Bugs

- "Last time" for some exercises (e.g. Pushdowns) shows reps with no weight; likely older sessions never saved a weight (actualWeight 0). Needs a look at the stored session data before changing anything; falling back to targetWeight would be a guess

## Features

- Ship the web app as an iOS app via a native shell (Capacitor) instead of porting the Swift app. Decided over a full native port: the Swift app is a CSV-era snapshot with no exercise library, program editor, Firebase or coach, and porting would duplicate the progression/equipment logic.
  - Capacitor scaffold is in (`web/capacitor.config.ts`, `web/ios/`, native Google sign-in in `lib/native-auth.ts`). Remaining: run it in Xcode, add `GoogleService-Info.plist` and the reversed-client-ID URL scheme, set `CAP_SERVER_URL` to the deployed site, and confirm sign-in works on a device. The app relies on API routes (`/api/coach`, `/api/equipment-photo`), so the shell loads the deployed site (`server.url`) rather than a static export.
  - Native pieces worth the shell: keep-awake during workouts, local notifications for the rest timer (works when the app is backgrounded), haptics, camera for equipment scan.
  - Check the offline story (active session in localStorage; Firestore persistence) since gym signal is poor.
  - Distribution: Apple Developer Program, bundle ID and signing, app icon and splash, TestFlight for personal use, then decide on an App Store release. Stopgap: confirm the PWA (`manifest.ts`) installs cleanly from Safari.
  - Then retire the Swift app (`WorkoutTracker/`, `project.yml`, `Resources/CSV`): archive it in git history and update README/CLAUDE.md, which still describe two independent platforms.

## Enhancements
