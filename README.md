# Workout Tracker

Progressive overload strength training tracker with two independent platform implementations sharing the same XLSX/CSV data format and business logic.

## Platforms

| Platform | Stack | Status |
|----------|-------|--------|
| **Web App** | Next.js, TypeScript, Firebase, Tailwind | Active — primary |
| **iOS Native** | SwiftUI, Core Data, XcodeGen | Active |

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
- `/` — Home: program cards, start workout, resume banner
- `/history` — Session list + exercise PR board + copy a logged week to clipboard
- `/settings` — Import XLSX, manage programs, rest time, sound, version footer
- `/settings/equipment` — Owned-equipment inventory (plates, PowerBlock range, bands, etc.)
- `/programs/[id]` — Browse and edit exercises per week + copy a week to clipboard
- `/session/[id]` — Set-by-set session breakdown
- `/exercise/[name]` — Exercise progression history

**Key hooks:**
- `useWorkout` — full workout state machine (timer, sets, PRs, localStorage persistence, WakeLock, pause/resume, manual weight/set override)
- `usePrograms` — programs, workouts cache, XLSX import, week management
- `useHistory` — session history and exercise stats (weight, reps, duration)
- `useEquipmentConfig` — loads/saves the user's owned-equipment inventory

**Key services:**
- `lib/xlsx-parser.ts` — parses XLSX into Program/Workout objects (primary import format)
- `lib/csv-parser.ts` — parses CSV (used for `daily_mobility.csv`; not exposed in UI)
- `lib/progression-service.ts` — resolves planned weights from exercise definition
- `lib/equipment-calculator.ts` — barbell plate math (clamped to owned inventory), PowerBlock selector/rod config, landmine
- `lib/pr-detector.ts` — weight PR, estimated 1RM (Epley), volume PR
- `lib/week-export.ts` — formats a planned or logged week as clipboard-ready text
- `lib/firestore.ts` — all Firestore CRUD

### Firestore Schema

```
/users/{userId}/
  settings/prefs       — default rest time, sound, current weeks per program
  settings/equipment   — owned equipment inventory (plates, PowerBlock range, bands, etc.)
  programs/{id}        — program metadata (name, totalWeeks, archived flag)
  workouts/{id}        — exercises embedded (doc ID: {name}_{week}_{day})
  sessions/{id}        — completed sets embedded
  personalRecords/{id} — per-exercise PR values
```

### Workout Modes

**Active Workout** — sequential exercise flow. Each set opens a completion modal (reps, weight, difficulty rating: easy/normal/hard, failed toggle, notes). Rest timer runs between sets and exercises. Supports pause/resume and mid-workout weight/set-count overrides.

**Checklist Workout** — all exercises visible at once, tap to toggle complete. Used for Daily workouts (e.g. Daily Mobility). Syncs to Firestore incrementally; resumes today's session if already started.

### Progression Logic

Weights are planned ahead of time in the XLSX — no history-based auto-progression in the web app:

- `base_weight: fixed` → use that value directly
- `base_weight: "progressive"` → seed from `total_weight` in XLSX (falls back to 0 if not set)
- User can override weight for any exercise before or during a workout via the weight editor
- Ratings (easy/normal/hard) are recorded per set for history review but do not automatically adjust future weights

### Other Features

- **Copy to clipboard** — copy a week's planned exercises (Program Editor) or actual logged sets (History) as plain text
- **Equipment inventory** (`/settings/equipment`) — configure owned plates, PowerBlock range, bands, kettlebells, etc.; weight inputs and equipment dropdowns clamp/filter to what's actually owned
- **Program rename** — rename a program without resetting its history or progress
- **Version footer** — app version (from `web/package.json`) shown at the bottom of Settings; see [Versioning](#versioning) below

---

## iOS Native App

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
- Watch companion not yet implemented

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

App version lives in `web/package.json` and is shown in the Settings page footer. A `pre-commit` git hook (enabled via `git config core.hooksPath scripts/git-hooks`, see Quick Start above) interactively prompts a human committer for a semver bump on each commit; it auto-skips for non-interactive commits (including ones made by Claude Code).

---

## Full Specification

See [workout_tracker_spec.md](workout_tracker_spec.md) for complete data models, service APIs, workout flow details, Firestore schema, XLSX column reference, and deviations from the original design.
