# Workout Tracker

Progressive overload strength training tracker. The web app is the product; the iPhone + Apple Watch app is a native shell around it. A legacy SwiftUI app remains in the repo until it is retired.

## Platforms

| Platform | Stack | Status |
|----------|-------|--------|
| **Web App** (`web/`) | Next.js, TypeScript, Firebase, Tailwind | Active — primary |
| **iPhone + Apple Watch** (`mobile/`) | Expo (React Native) WebView shell, SwiftUI widget / watch targets | Active — see [below](#iphone--apple-watch-app-mobile) |
| **iOS Native** (`WorkoutTracker/`) | SwiftUI, Core Data, XcodeGen | Legacy — to be retired (see `TODO.md`) |

---

## Web App

### Quick Start

```bash
cd web
npm install
# Copy and fill in Firebase config
cp .env.local.example .env.local
npm run dev        # http://localhost:3000
npm test           # run vitest suite
```

One-time repo setup (from the repo root) to enable the version-bump pre-commit hook:

```bash
git config core.hooksPath scripts/git-hooks
```

### Architecture

```
Next.js App Router + Firebase Auth (Google) + Firestore
```

**Pages:**
- `/` — Home: program cards, week progress, start workout, resume banner, custom workout
- `/history` — Session list + exercise PR board + body metrics + copy a logged week to clipboard
- `/settings` — Import XLSX, manage programs, rest time, sound
- `/settings/equipment` — Owned-equipment inventory (plates, PowerBlock range, bands, etc.)
- `/settings/exercises` — The exercise library (definitions shared across programs)
- `/changelog` — Release notes (linked from the version number in the footer)
- `/programs/[id]` — Browse and edit exercises per week + copy a week to clipboard
- `/session/[id]` — Set-by-set session breakdown
- `/exercise/[name]` — Exercise progression history

**Key hooks:**
- `useWorkout` — full workout state machine (timer, sets, PRs, localStorage persistence, WakeLock, pause/resume, manual weight/set override)
- `usePrograms` — programs, workouts cache, XLSX import, week management
- `useHistory` — session history and exercise stats (weight, reps, duration); Home asks for just the last 7 days, other pages for the last 50
- `useNativeMirror` — inside the iPhone app, posts set/rest state to native (notifications, Live Activity, watch)
- `useEquipmentConfig` — loads/saves the user's owned-equipment inventory

**Key services:**
- `lib/xlsx-parser.ts` — parses XLSX into Program/Workout objects (primary import format)
- `lib/csv-parser.ts` — parses CSV (used for `daily_mobility.csv`; not exposed in UI)
- `lib/progression-service.ts` — resolves planned weights from exercise definition
- `lib/equipment-calculator.ts` — barbell plate math (clamped to owned inventory), PowerBlock selector/rod config, landmine
- `lib/pr-detector.ts` — weight PR, estimated 1RM (Epley), volume PR
- `lib/week-export.ts` — formats a planned or logged week as clipboard-ready text
- `lib/firestore.ts` — all Firestore CRUD
- `lib/last-performance-doc.ts` — the per-user summary of each exercise's last sets (see [Performance](#performance))
- `lib/native-bridge.ts` / `lib/home-summary.ts` — web ↔ iPhone-app messages (sign-in, rest state, widget data)

### Firestore Schema

```
/users/{userId}/
  settings/prefs       — default rest time, sound, current weeks per program
  settings/equipment   — owned equipment inventory (plates, PowerBlock range, bands, etc.)
  settings/lastPerformance — each exercise's most recent completed sets (see Performance)
  programs/{id}        — program metadata (name, totalWeeks, archived flag, per-exercise weights)
  exerciseDefinitions/{id} — the exercise library (name, equipment, rules)
  workouts/{id}        — exercises as references into the library (doc ID: {name}_{week}_{day})
  sessions/{id}        — completed sets embedded
  personalRecords/{id} — per-exercise PR values
  bodyMeasurements/{id} — body metrics entries
```

### Workout Modes

**Active Workout** — sequential exercise flow. Each set opens a completion modal (reps, weight, difficulty rating: easy/normal/hard, failed toggle, notes). Rest timer runs between sets and exercises. Supports pause/resume and mid-workout weight/set-count overrides.

**Checklist Workout** — all exercises visible at once, tap to toggle complete. Used for Daily workouts (e.g. Daily Mobility). Syncs to Firestore incrementally; resumes today's session if already started.

### Progression Logic

Weights are planned in the XLSX and then move on their own as you train (`lib/progression-service.ts`):

- `base_weight: fixed` → that value; `"progressive"` → seeded from `total_weight` (or the last session)
- When a session is saved, each exercise's next weight is chosen from its `progression_rule` using the final set: reps against the rep range, the Easy/Normal/Hard rating, and an Epley 1RM projection for AMRAP sets (capped at 2× the target reps)
- A weight is held after 2+ weeks away from an exercise and drops one increment after 4+ weeks
- Deleting a session undoes the weight changes it caused
- You can override a weight before or during a workout with the weight editor

### Other Features

- **Copy to clipboard** — copy a week's planned exercises (Program Editor) or actual logged sets (History) as plain text
- **Equipment inventory** (`/settings/equipment`) — configure owned plates, PowerBlock range, bands, kettlebells, etc.; weight inputs and equipment dropdowns clamp/filter to what's actually owned
- **Program rename** — rename a program without resetting its history or progress
- **Custom workout** — build a session as you go (timed sets, bodyweight, ratings, estimated 1RM, suggested weights); it counts for the day
- **Footer** — a slim bottom nav (Home / History / Settings) with the app version on every screen; the version links to `/changelog`. See [Versioning](#versioning)

### Performance

Home loads only the last 7 days of sessions. Starting a workout and the custom-workout weight suggestion read `users/{uid}/settings/lastPerformance`, one small document holding each exercise's most recent completed sets, instead of the session history. It is updated in the same transaction as every session save, and rebuilt (`rebuildLastPerformance`) if a delete invalidates it. A brand-new account starts with none; an account that has sessions but no summary gets an error rather than partial data. The coach loads its history only when asked.

---

## iOS Native App (legacy)

A CSV-era SwiftUI snapshot with no exercise library, program editor, Firebase or coach. It is superseded by the iPhone app below and will be retired (see `TODO.md`).

### Quick Start

```bash
# Generate .xcodeproj from project.yml
xcodegen generate
open WorkoutTracker.xcodeproj
# Build and run in Xcode
```

No iOS SDK on the development machine — build only through Xcode GUI.

### Architecture

`@Observable WorkoutManager` holds all state and is passed via `.environment()`. Core Data is configured programmatically (no `.xcdatamodeld` file).

**Services:** CSVParser, EquipmentCalculator, ProgressionService, WorkoutManager, SoundManager, PRDetector

**Views (19 Swift files):** Home (3), Workout (6), History (3), Settings (2) + shared

### Key Differences from Web

- Progression checks last session via Core Data; advances weight if all sets completed
- Screen lock via `UIApplication.shared.isIdleTimerDisabled`
- Persistence in Core Data (local only)
- No auth — single-user

---

## Data Formats

### XLSX Format (primary, `reacher_build_cycle2.xlsx`)

Multi-sheet XLSX, one sheet per day of the week. Full column set:

```
program_name, week, day_of_week, phase, exercise_order, exercise_name,
equipment_type, equipment_category, equipment_detail,
base_weight, total_weight,
sets, rep_min, rep_max, last_set_amrap,
rest_seconds, rest_after,
progression_rule, unilateral, notes
```

| Column | Values |
|--------|--------|
| `equipment_type` | `barbell_45`, `barbell_35`, `barbell_ez`, `powerblock`, `dumbbell`, `band`, `kettlebell`, `bodyweight`, `assisted_pullup`, `gripper` |
| `base_weight` | number in lbs, or `"progressive"` (seed from `total_weight`) |
| `total_weight` | Pre-calculated total weight in lbs. Seeds progressive starting weight. |
| `rep_max` | integer, or `"failure"` (AMRAP) |
| `last_set_amrap` | `TRUE` = final set is AMRAP regardless of `rep_max` |
| `day_of_week` | `Monday`–`Sunday` or `"Daily"` (available every day, triggers checklist mode) |
| `rest_after` | `FALSE` = no rest (warmup default); integer seconds, `"90s"`, `"2m"`, or `"2:00"`. Overrides `rest_seconds` between exercises. |
| `progression_rule` | `add_5lb`, `add_2.5lb`, `add_10lb`, `add_reps`, `add_time`, `add_rounds`, `maintain`, `deload`, `progress_gripper`, `none` — **or** a specific next-step value: band color string (e.g. `"Blue"`) or band count string (e.g. `"2 bands"`) |
| `unilateral` | `TRUE` / `FALSE` |

### CSV Format (16 columns, used for `daily_mobility.csv`)

```
program_name,week,day_of_week,phase,exercise_order,exercise_name,
equipment_type,equipment_detail,base_weight,sets,rep_min,rep_max,
rest_seconds,progression_rule,unilateral,notes
```

**Bundled programs:**
- `reacher_build_cycle2.xlsx` — 6-day strength program, 4 weeks (current active program)
- `daily_mobility.csv` — 18-exercise daily mobility routine

---

## Equipment

**Barbells:** 45 lb Olympic bar, 35 lb bar, 15 lb EZ curl bar

**Plates (pairs):** 45(×1), 35(×1), 25(×2), 10(×2), 5(×1), 2.5(×1), 1(×1), 0.75(×1), 0.5(×1)

**PowerBlock Elite EXP:** 5–50 lbs in 2.5 lb increments. Uses a selector + rod configuration per weight. Equipment detail `"2lb"` → treated as regular dumbbell (`dumbbell` type).

**Resistance Bands (Serious Steel):** Orange (2–12 lbs), Purple (5–35 lbs), Red (10–50 lbs), Blue (20–80 lbs), Green (50–120 lbs), Black (60–150 lbs)

**Landmine:** Exercises with "landmine" or "meadows" in the name (e.g. Meadows Row) use single-side plate loading (not per-side × 2).

**Grippers:** Captains of Crush (Trainer, 0.5, 1) and other grip tools use `gripper` equipment type.

All of the above are defaults — see `/settings/equipment` to configure what's actually owned.

---

## Versioning

The app version lives in `web/package.json` (and is mirrored in `VERSION` at the repo root). It is shown in the footer nav on every screen, and each release gets an entry in `web/src/lib/changelog.ts`. A `pre-commit` git hook (enabled via `git config core.hooksPath scripts/git-hooks`, see Quick Start above) interactively prompts a human committer for a semver bump on each commit; it auto-skips for non-interactive commits (including ones made by Claude Code).

---

## Full Specification

See [workout_tracker_spec.md](workout_tracker_spec.md) for complete data models, service APIs, workout flow details, Firestore schema, XLSX column reference, and deviations from the original design.

---

## iPhone + Apple Watch app (`mobile/`)

An Expo (React Native) shell that loads the deployed web app (https://workout.astrojason.com) in a WebView and adds the native pieces the web can't do:

- **Google sign-in** through the native SDK, handed to the web app's Firebase session (same project and data)
- **Rest-complete notification** scheduled locally so it fires while the phone is locked; iOS mirrors it to the watch
- **Live Activity** (Lock Screen / Dynamic Island, via `expo-live-activity`) with the rest countdown and current set
- **Home Screen widget** (`mobile/targets/widget`, small / medium / Lock Screen) showing today's workout per program and the week's progress
- **Apple Watch app** (`mobile/targets/watch`, SwiftUI) mirroring the current set and rest countdown
- **Error banner** that shows errors from inside the page (crashes, failed requests) as copyable text

### Install on a device

Builds run on this Mac (not EAS cloud). You need Xcode signed in to your Apple team, the phone connected, unlocked and in Developer Mode, and:

```bash
cd mobile
cp .env.local.example .env.local   # fill in the three values below
cd .. && ./scripts/ios-install      # prebuild + Release build, installed on the connected iPhone
```

`mobile/.env.local` needs `EXPO_PUBLIC_WEB_URL` (the deployed site, not localhost), `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (`CLIENT_ID` from the Firebase iOS app's `GoogleService-Info.plist`, bundle ID `com.astrojason.workout`) and `APPLE_TEAM_ID`. The app loads the live site, so web changes reach the phone on deploy; only native changes need a reinstall. The first build for a new extension or app group may need `xcodebuild … -allowProvisioningUpdates` once so Xcode can create the provisioning profiles.

### How it fits together

- Web ↔ native messages are defined in `web/src/lib/native-bridge.ts` (web side) and `mobile/src/native.ts` (native side). Requests with a reply use `callNative`; state updates (`workoutState`, `homeSummary`) are fire-and-forget. Errors are shown, never swallowed.
- The widget reads a summary the app writes to the shared app group `group.com.astrojason.workout` (`mobile/src/appGroup.ts`, `mobile/app.config.ts`, `mobile/targets/widget`).
- `mobile/patches/` holds a one-line `patch-package` fix to `@bacons/apple-targets` so its widget target can coexist with `expo-live-activity`'s extension; it is applied automatically on `npm install`.
- `mobile/` has its own tests: `cd mobile && npm test` (vitest) and `npm run typecheck`.
