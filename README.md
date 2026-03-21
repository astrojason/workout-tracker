# Workout Tracker

Progressive overload strength training tracker with two independent platform implementations sharing the same CSV data format and business logic.

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

### Architecture

```
Next.js App Router + Firebase Auth (Google) + Firestore
```

**Pages:**
- `/` — Home: program cards, start workout, resume banner
- `/history` — Session list + exercise PR board
- `/settings` — Import CSV, manage programs, rest time, sound
- `/programs/[id]` — Browse and edit exercises per week
- `/session/[id]` — Set-by-set session breakdown
- `/exercise/[name]` — Exercise progression history

**Key hooks:**
- `useWorkout` — full workout state machine (timer, sets, PRs, localStorage persistence, WakeLock, pause/resume)
- `usePrograms` — programs, workouts cache, CSV import, week management
- `useHistory` — session history and exercise stats

**Key services:**
- `lib/csv-parser.ts` — parses CSV into Program/Workout objects
- `lib/progression-service.ts` — resolves weights from history with rating-based logic
- `lib/equipment-calculator.ts` — barbell plate math, PowerBlock, landmine
- `lib/pr-detector.ts` — weight PR, estimated 1RM (Epley), volume PR
- `lib/firestore.ts` — all Firestore CRUD

### Firestore Schema

```
/users/{userId}/
  settings/prefs       — default rest time, sound, current weeks per program
  programs/{id}        — program metadata
  workouts/{id}        — exercises embedded (doc ID: {name}_{week}_{day})
  sessions/{id}        — completed sets embedded
  personalRecords/{id} — per-exercise PR values
```

### Workout Modes

**Active Workout** — sequential exercise flow. Each set opens a completion modal (reps, weight, difficulty rating: easy/normal/hard, failed toggle, notes). Rest timer runs between sets and exercises. Supports pause/resume.

**Checklist Workout** — all exercises visible at once, tap to toggle complete. Used for Daily workouts (e.g. Daily Mobility). Syncs to Firestore incrementally; resumes today's session if already started.

### Progression Logic

Weight for the next session is resolved from history using a rating-aware algorithm:

- All sets completed → apply progression rule (add weight increment)
- Any set rated "easy" → double the increment for next session (user can decline)
- Any set rated "hard" → keep weight (user offered mid-workout reduce option)
- Missed target 2 sessions in a row → auto-reduce by one increment (user can override)
- No history → weight starts at 0 (user sets it on first use)

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

- Progression is simpler — no easy/hard rating, no 2× miss deduction
- Screen lock via `UIApplication.shared.isIdleTimerDisabled`
- Persistence in Core Data (local only)
- No auth — single-user
- Watch companion not yet implemented

---

## Data Formats

### CSV Format (16 columns)

```
program_name,week,day_of_week,phase,exercise_order,exercise_name,
equipment_type,equipment_detail,base_weight,sets,rep_min,rep_max,
rest_seconds,progression_rule,unilateral,notes
```

| Column | Values |
|--------|--------|
| `equipment_type` | `barbell_45`, `barbell_35`, `barbell_ez`, `powerblock`, `band`, `kettlebell`, `bodyweight`, `assisted_pullup` |
| `base_weight` | number in lbs, or `"progressive"` (resolve from history) |
| `rep_max` | integer, or `"failure"` (AMRAP) |
| `day_of_week` | `Monday`–`Sunday` or `"Daily"` (available every day, triggers checklist mode) |
| `progression_rule` | Enum keyword: `add_5lb`, `add_2.5lb`, `add_10lb`, `add_reps`, `add_time`, `add_rounds`, `maintain`, `deload`, `progress_gripper`, `none` — **or** a specific next-step value: band color string (e.g. `"Blue"`) for band assist, band count string (e.g. `"2 bands"`) for pull-up assist |
| `unilateral` | `TRUE` / `FALSE` |

**Bundled programs:**
- `reacher_build_cycle2.xlsx` — 6-day strength program, 4 weeks (current active program). Multi-sheet XLSX, one sheet per day. Supersedes `reacher_build_workout.csv`.
- `daily_mobility.csv` — 18-exercise daily mobility routine

### XLSX Format (extended columns)

The XLSX format adds the following columns to the base CSV set:

| New Column | Type | Purpose |
|------------|------|---------|
| `equipment_category` | string | Human-readable grouping (barbell, dumbbell, machine, band, bodyweight) — for display, not calculation |
| `total_weight` | number | Pre-calculated total weight in lbs (bar + plates). Seeds progressive starting weight if provided. |
| `last_set_amrap` | boolean | `TRUE` = final set is AMRAP regardless of `rep_max` value |
| `rest_after` | integer, string, or `FALSE` | Rest after exercise completes. `FALSE` = flow directly to next exercise (no rest timer). Integer seconds, `"90s"`, `"2m"`, or `"2:00"` otherwise. Takes priority over `rest_seconds` if both present. Warmup phase exercises are always `FALSE`. |

---

## Equipment

**Barbells:** 45 lb Olympic bar, 35 lb bar, 15 lb EZ curl bar

**Plates (pairs):** 45(×1), 35(×1), 25(×2), 10(×2), 5(×1), 2.5(×1), 1(×1), 0.75(×1), 0.5(×1)

**PowerBlock Elite EXP:** 5–50 lbs in 2.5 lb increments. Equipment detail `"2lb"` → treated as regular dumbbell.

**Resistance Bands (Serious Steel):** Orange (2–12 lbs), Purple (5–35 lbs), Red (10–50 lbs), Blue (20–80 lbs), Green (50–120 lbs), Black (60–150 lbs)

**Landmine:** Exercises with "landmine" in the name use single-side plate loading (not per-side × 2).

---

## Full Specification

See [workout_tracker_spec.md](workout_tracker_spec.md) for complete data models, service APIs, workout flow details, Firestore schema, XLSX column reference, and deviations from the original design.
