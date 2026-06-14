# Workout Tracker - Complete Technical Specification

> **Last updated:** June 2026
> This document reflects the actual current implementation across both the native iOS app and the Next.js web app.

---

## Overview

Progressive overload strength training tracker with two fully independent platform implementations:

1. **iOS Native App** — SwiftUI + Core Data, XcodeGen project (`project.yml`)
2. **Web App** — Next.js (App Router), TypeScript, Firebase/Firestore (`web/`)

Both share the same CSV data format and business logic, but are implemented independently.

---

## Platform 1: Web App

### Tech Stack

- **Framework:** Next.js 15+ with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS (dark mode, `gray-950` base)
- **Auth:** Firebase Auth (Google OAuth only)
- **Database:** Firestore (per-user data under `/users/{uid}/`)
- **Local persistence:** `localStorage` for active session crash-recovery
- **Screen wake:** Web Screen Wake Lock API
- **Testing:** Vitest

### Project Structure

```
web/src/
├── app/
│   ├── page.tsx                  # Home — program cards, workout launch
│   ├── history/page.tsx          # Session list + exercise PR board
│   ├── settings/page.tsx         # Programs, rest time, sound, account
│   ├── programs/[id]/page.tsx    # Program detail — browse/edit exercises per week
│   ├── session/[id]/page.tsx     # Session detail — set-by-set breakdown
│   └── exercise/[name]/page.tsx  # Exercise history chart
├── components/
│   ├── home/
│   │   ├── ProgramCard.tsx
│   │   └── WeeklyOverview.tsx
│   ├── workout/
│   │   ├── ActiveWorkout.tsx     # Sequential workout UI
│   │   ├── ChecklistWorkout.tsx  # Checklist-style workout UI
│   │   ├── ExerciseCard.tsx
│   │   ├── RestTimer.tsx
│   │   ├── SetCompletionModal.tsx
│   │   └── WorkoutComplete.tsx
│   ├── programs/
│   │   └── ExerciseEditor.tsx    # Add/edit exercise modal
│   └── providers/
│       └── AuthProvider.tsx
├── hooks/
│   ├── useWorkout.ts             # Active workout state machine
│   ├── usePrograms.ts            # Programs, settings, XLSX import
│   ├── useHistory.ts             # Session history + exercise stats (useHistory, useExerciseHistory)
│   └── useSound.ts
└── lib/
    ├── types.ts                  # All shared types + helper functions
    ├── firestore.ts              # All Firestore CRUD operations
    ├── xlsx-parser.ts            # XLSX -> Program/Workout objects (primary import format)
    ├── csv-parser.ts             # CSV -> Program/Workout objects (daily_mobility.csv only; not exposed in UI)
    ├── progression-service.ts    # Planned weight resolution + equipment snapping
    ├── equipment-calculator.ts   # Plate math, PowerBlock selector/rod config, display strings
    └── pr-detector.ts            # PR detection (weight, 1RM, volume)
```

---

### Data Models

#### Core Types (`lib/types.ts`)

```typescript
type Phase = "warmup" | "main" | "finisher" | "cooldown" | "mobility";

type EquipmentType =
  | "barbell_45" | "barbell_35" | "barbell_ez"
  | "powerblock" | "dumbbell" | "band" | "kettlebell"
  | "bodyweight" | "assisted_pullup" | "gripper";

type ProgressionRule =
  | "add_5lb" | "add_2.5lb" | "add_10lb"
  | "reduce_assistance" | "maintain" | "deload"
  | "none" | "add_reps" | "add_time" | "add_rounds" | "progress_gripper"
  | string; // specific next-step value: band color (e.g. "Blue") or band count (e.g. "2 bands")

// base_weight field: "progressive" means resolve from history
type WeightSpec =
  | { type: "fixed"; value: number }
  | { type: "progressive" };

// rep_max field: "failure" means AMRAP
type RepTarget =
  | { type: "count"; value: number }
  | { type: "failure" };

interface Exercise {
  id: string;                   // UUID (generated on parse, not in CSV)
  order: number;
  name: string;
  phase: Phase;
  equipmentType: EquipmentType;
  equipmentDetail: string | null;
  baseWeight: WeightSpec;
  sets: number;
  repMin: number;
  repMax: RepTarget;
  restSeconds: number;
  progressionRule: ProgressionRule;
  isUnilateral: boolean;
  isTimeBased: boolean;         // true when repMin is a duration (seconds); set by parser
  notes: string | null;
  // XLSX-only fields (optional on legacy CSV-sourced exercises):
  totalWeight?: number;         // pre-calculated total weight; seeds progressive starting weight
  lastSetAmrap?: boolean;       // when true, the final set is AMRAP regardless of repMax
  restAfter?: false | number;   // false = no rest timer; number = rest seconds after exercise
}

interface Workout {
  id: string;                   // "{programName}_{week}_{day}" (lowercase)
  programName: string;
  week: number;
  dayOfWeek: string;            // e.g. "Monday", "Daily"
  exercises: Exercise[];
  isChecklist?: boolean;        // explicit flag; falls back to heuristic
}

interface Program {
  id: string;                   // name.toLowerCase().replace(/\s+/g, "-")
  name: string;
  totalWeeks: number;
  createdAt: Timestamp | Date;
  archived?: boolean;           // soft-delete; archived programs hidden from home screen
}

interface UserSettings {
  defaultRestSeconds: number;   // 60/90/120/150/180, default 120
  soundEnabled: boolean;
  currentWeeks: Record<string, number>; // programName -> currentWeek
}
```

#### Session / History Types

```typescript
interface CompletedSet {
  id: string;
  exerciseName: string;
  exerciseOrder: number;
  setNumber: number;
  targetWeight: number;
  actualWeight: number;
  targetReps: number;
  actualReps: number;
  completed: boolean;
  timestamp: Timestamp | Date;
  notes: string | null;
  rating?: "easy" | "normal" | "hard";  // recorded per set (informational only)
  isTimeBased?: boolean;                // true for time-based exercises
  equipmentType?: EquipmentType;        // recorded for history display
}

interface WorkoutSessionDoc {
  id: string;
  programName: string;
  week: number;
  dayOfWeek: string;
  date: Timestamp | Date;
  completed: boolean;
  durationSeconds: number;
  sets: CompletedSet[];
}

interface PersonalRecordDoc {
  exerciseName: string;
  recordType: "weight" | "estimated1RM" | "volume";
  value: number;
  date: Timestamp | Date;
}
```

#### Active Session State

```typescript
interface ActiveSession {
  workout: Workout;
  resolvedWeights: Record<string, number>; // exerciseId -> weight in lbs
  currentExerciseIndex: number;
  currentSetNumber: number;
  completedSets: CompletedSet[];
  isResting: boolean;
  restTimeRemaining: number;               // seconds
  startTime: Date;
  prsAchieved: PRResult[];
}
```

#### Equipment Display Types

```typescript
interface PlateConfiguration {
  targetWeight: number;
  barWeight: number;
  achievedWeight: number;
  perSide: { plate: number; count: number }[];
  isLandmine?: boolean;                    // true for landmine exercises
}

interface PowerBlockInstructions {
  selector: number;                        // selector weight to dial to
  rods: "none" | "one" | "both";          // rod insert configuration
  label: string;                           // e.g. "Selector to 25 · no rods"
}

type EquipmentDisplay =
  | { type: "barbell"; config: PlateConfiguration }
  | { type: "powerblock"; weight: number; instructions: PowerBlockInstructions }
  | { type: "dumbbell"; weight: number }   // fixed dumbbell or PowerBlock detail < 5 lbs
  | { type: "band"; name: string; range: string }
  | { type: "bodyweight"; detail: string | null }
  | { type: "assisted"; weight: number; detail: string | null }
  | { type: "kettlebell"; weight: number }
  | { type: "gripper"; weight: number };
```

---

### Firestore Schema

```
/users/{userId}/
  settings/prefs          -> UserSettings
  programs/{programId}    -> { name, totalWeeks, createdAt, archived? }
  workouts/{workoutId}    -> Workout (exercises embedded as array)
  sessions/{sessionId}    -> WorkoutSessionDoc (sets embedded as array)
  personalRecords/{prId}  -> PersonalRecordDoc
```

**Workout document ID:** `{programName_lowercase}_{week}_{dayOfWeek}`
**PR document ID:** `{exerciseName}_{recordType}`

---

### Services

#### XLSX Parser (`lib/xlsx-parser.ts`)

Reads multi-sheet XLSX files (primary import format). Each sheet is a day of the week. Parses all XLSX-extended columns, assigns `crypto.randomUUID()` to each exercise on parse. Sets `isChecklist: true` for any workout where `dayOfWeek === "Daily"`. Derives `isTimeBased` per exercise based on the progression rule and rep values.

#### CSV Parser (`lib/csv-parser.ts`)

Validates 16-column CSV, groups rows into `Program[]` and `Workout[]`. Used only for `daily_mobility.csv`; not exposed via the Settings UI (XLSX import only).

#### Equipment Calculator (`lib/equipment-calculator.ts`)

**Plate inventory (per side):**

| Plate | Max count per side |
|-------|-------------------|
| 45    | 1 |
| 35    | 1 |
| 25    | 2 |
| 10    | 2 |
| 5     | 1 |
| 2.5   | 1 |
| 1     | 1 |
| 0.75  | 1 |
| 0.5   | 1 |

**`calculateBarbell(targetWeight, barWeight)`** — subtracts bar, divides by 2, builds greedy plate combination (largest plates first). If exact match impossible, rounds down in 0.25 lb increments to the nearest achievable weight.

**`calculateLandmine(targetWeight, barWeight)`** — same but uses one-side loading (no ÷2). Triggered when exercise name contains "landmine".

**`nearestPowerBlock(target)`** — clamps to 5–50 lbs, rounds to nearest 2.5 lbs.

**`getPowerBlockInstructions(weight)`** — returns `PowerBlockInstructions` with selector dial position and rod configuration for each valid PowerBlock weight (5–50 lbs in 2.5 lb steps).

**`getEquipmentDisplay(exercise, weight)`** — returns the appropriate `EquipmentDisplay` variant:
- `equipmentType === "powerblock"` with `equipmentDetail` or weight < 5 lbs → `{ type: "dumbbell" }` instead
- `equipmentType === "dumbbell"` → `{ type: "dumbbell" }` directly
- `equipmentType === "gripper"` → `{ type: "gripper" }`
- All barbell types check for "landmine" in exercise name → uses `calculateLandmine`

**Band info:**

| Color  | Resistance  |
|--------|-------------|
| Orange | 2–12 lbs   |
| Purple | 5–35 lbs   |
| Red    | 10–50 lbs  |
| Blue   | 20–80 lbs  |

#### Progression Service (`lib/progression-service.ts`)

Called at workout start to resolve each exercise's planned weight. Uses the exercise definition directly — no Firestore history lookup.

**Weight resolution logic (`resolveWeightWithMeta`):**

1. `base_weight: fixed` → return that value directly
2. `base_weight: "progressive"` → return `exercise.totalWeight ?? 0` (the pre-calculated total weight from XLSX; 0 if not set)

Returns `{ weight: number, prevWeight: null }`.

**Manual overrides (in `useWorkout.ts`):**
- `updateWeight(exerciseId, newWeight)` — user can edit weight for any exercise before or during a workout
- `updateSets(exerciseId, newSets)` — user can adjust set count mid-workout

**Ratings** (easy/normal/hard) are still recorded per set for session history and PR display, but do not automatically trigger weight changes.

**`applyProgression(currentWeight, exercise)`** — increments weight by the rule's amount and snaps to nearest achievable equipment value. Used for display/reference; not called automatically at workout end.

#### PR Detector (`lib/pr-detector.ts`)

Three PR types checked after each workout:
1. **Max weight** — highest `actualWeight` across all completed sets
2. **Estimated 1RM** — Epley formula: `weight * (1 + reps/30)`; 1-rep sets use raw weight
3. **Volume** — `sum(actualWeight * actualReps)` for all completed sets

---

### Workout Flow (Web)

#### Two Workout Modes

**1. Active Workout** (sequential, rest-timer driven)

```
Start Workout
  -> resolveWeightWithMeta() for all exercises (uses planned weight from exercise definition)

Exercise Loop:
  Show ExerciseCard (name, set N of M, weight, equipment setup, next-up preview)
  User can edit weight or set count before/during the exercise
  User taps "Complete Set"
    -> SetCompletionModal (reps, weight, difficulty rating, failed toggle, notes)
    -> playSetComplete()
    -> Record rating per set (informational; does not change weight)
    -> If sets remain + restSeconds > 0: RestTimer overlay (between-set rest)
    -> After last set of exercise: RestTimer with restAfter duration (between-exercise rest)
    -> Advance to next set or next exercise
  User taps "Skip" -> record 0 reps, skip rest, advance

Rest Timer:
  Full-screen overlay with mm:ss countdown + SVG progress ring
  Shows "Next Set" or "Up Next" with equipment detail
  "Skip Rest" button
  On expiry: playTimerComplete(), auto-advance

Workout Complete:
  checkForPRs() -> savePR() for new records
  saveSession() to Firestore
  Clear localStorage
  WorkoutComplete screen (duration, sets, PRs, exercise summary)
```

**2. Checklist Workout** (all-at-once, tap-to-toggle)

Used when `isChecklistWorkout(workout)` returns true. Loads today's existing session from Firestore (via `getTodayChecklistSession`) and upserts on every toggle. No rest timer. No set completion modal. Each exercise is a tap-to-complete checkbox; uncheck is allowed.

#### Checklist Detection

```typescript
function isChecklistWorkout(workout: Workout): boolean {
  if (workout.isChecklist !== undefined) return workout.isChecklist;
  // Heuristic: all exercises have restSeconds === 0 and non-weight progression
  return workout.exercises.every(
    (ex) => ex.restSeconds === 0 &&
            ["none","maintain","add_time","add_reps"].includes(ex.progressionRule)
  );
}
```

The `isChecklist` flag can also be toggled manually in the Program Editor UI.

#### Session Persistence (Crash Recovery)

Active sessions are serialized to `localStorage` (key: `activeWorkout`) on every state change. Rest timer end-time is stored separately (`activeWorkoutRestEnd`). On next load:
- If `workoutPaused` key is set -> show resume banner, do not auto-resume
- If rest timer had time remaining -> restart from correct end-time
- If rest timer expired -> advance state immediately

#### Screen Wake Lock

`navigator.wakeLock.request("screen")` acquired when a session starts, released when it ends. Re-acquired on `visibilitychange` (tab comes back to foreground).

#### Pause / Resume

`pauseWorkout()` -> saves session to localStorage with `workoutPaused = "1"`, clears active session state -> shows resume banner on home screen. `resumeWorkout()` -> restores session, removes paused key.

---

### UI Pages

#### Home (`/`)

- Google sign-in if not authenticated
- Resume banner if a workout is paused
- `ProgramCard` for each loaded program: today's suggested workout, available days, completed days (checkmarks)
- Starting a checklist workout -> `ChecklistWorkout` component (full-page takeover)
- Starting a regular workout -> `ActiveWorkout` component (full-page takeover)
- Workout complete -> `WorkoutComplete` component

#### History (`/history`)

- **Exercise Progress** section: all exercises with a weight PR, sorted alphabetically. Tapping navigates to `/exercise/[name]`
- **Recent Workouts** section: sessions (program, day, week, date, duration). Tapping navigates to `/session/[id]`
- Both sections paginate at 10 items, expandable

#### Session Detail (`/session/[id]`)

- Header stats: duration, sets completed, completion status (Done/Partial)
- Exercises grouped, each with a set table: set number, weight, reps, difficulty rating, pass/fail
- "Progress ->" link to exercise history chart

#### Exercise History (`/exercise/[name]`)

- Historical progression data for a single exercise
- Powered by `getExerciseHistory()` — uses heaviest completed set per session, excludes weight=0 sets

#### Settings (`/settings`)

- Per-program week selector dropdown
- Edit exercises -> `/programs/[id]`
- Delete or archive program (keeps history)
- Re-import XLSX to update exercise definitions
- Default rest time: 60/90/120/150/180s
- Timer sound toggle
- Account info (email) + sign out

#### Program Editor (`/programs/[id]`)

- Week tabs
- Exercises listed by day, sorted by exercise order
- Add/Edit/Delete exercises via `ExerciseEditor` modal
- Checklist toggle per workout day
- Auto-heals duplicate order values on load

---

### Hooks

| Hook | Responsibility |
|------|---------------|
| `useWorkout(userId)` | Full active workout state machine: session, rest timer, set completion, PR detection, pause/resume, localStorage persistence, WakeLock, manual weight/set-count override |
| `usePrograms(userId)` | Programs list, per-program workouts cache, week state, XLSX import, settings load/save |
| `useHistory(userId)` | Recent sessions + per-exercise best-set stats (`ExerciseStat` — handles weight, time-based, bodyweight) |
| `useExerciseHistory(userId, name)` | Time-series history for a single exercise; returns `isTimeBased` and `isBodyweight` flags |
| `useSound()` | `playTimerComplete()`, `playSetComplete()`, `initAudio()` |

**`ExerciseStat` interface (from `useHistory`):**
```typescript
interface ExerciseStat {
  name: string;
  maxWeight: number;
  maxWeightReps: number;
  isTimeBased: boolean;
  isBodyweight: boolean;
  maxReps: number;  // max reps (bodyweight) or max duration in seconds (time-based)
}
```

**`useWorkout` return values:**
- `session`, `pausedSession`, `currentExercise`, `currentWeight`
- `setsCompletedForCurrent`, `isCurrentSetAmrap`
- `startWorkout`, `completeSet`, `skipSet`, `skipRest`
- `endWorkout`, `dismissWorkout`, `pauseWorkout`, `resumeWorkout`
- `updateWeight(exerciseId, newWeight)`, `updateSets(exerciseId, newSets)`

---

## Platform 2: iOS Native App

### Tech Stack

- **Platform:** iOS 17+
- **Framework:** SwiftUI
- **Language:** Swift 5.9+
- **Persistence:** Core Data (defined programmatically in `CoreDataStack.swift`, no `.xcdatamodeld`)
- **State:** `@Observable WorkoutManager` passed via `.environment()`
- **Build:** XcodeGen (`project.yml` at root)

### Project Structure

```
WorkoutTracker/
├── App/
│   ├── WorkoutTrackerApp.swift
│   └── ContentView.swift
├── Models/
│   ├── Exercise.swift            # Phase, EquipmentType, ProgressionRule, WeightSpec, RepTarget, Exercise
│   ├── Program.swift
│   └── WorkoutSession.swift
├── Services/
│   ├── CSVParser.swift
│   ├── EquipmentCalculator.swift
│   ├── ProgressionService.swift
│   ├── WorkoutManager.swift      # @Observable — central state
│   ├── SoundManager.swift
│   └── PRDetector.swift
├── Persistence/
│   └── CoreDataStack.swift
└── Views/
    ├── Home/
    │   ├── HomeView.swift
    │   ├── WeeklyOverview.swift
    │   └── WorkoutSelectionSheet.swift
    ├── Workout/
    │   ├── ActiveWorkoutView.swift
    │   ├── ExerciseCardView.swift
    │   ├── RestTimerView.swift
    │   ├── SetCompletionSheet.swift
    │   ├── ChecklistExerciseRow.swift
    │   └── WorkoutCompleteView.swift
    ├── History/
    │   ├── HistoryView.swift
    │   ├── ExerciseProgressView.swift
    │   └── ProgressionChartView.swift
    └── Settings/
        ├── SettingsView.swift
        └── EquipmentInventoryView.swift
```

### iOS Data Models (`Models/Exercise.swift`)

```swift
enum Phase: String, Codable { case warmup, main, finisher, cooldown, mobility }

enum EquipmentType: String, Codable {
    case barbell_45, barbell_35, barbell_ez
    case powerblock, dumbbell, band, kettlebell, bodyweight, assisted_pullup, gripper

    var barWeight: Double? { /* 45, 35, 15, nil */ }
}

enum ProgressionRule: String, Codable {
    case add_5lb
    case add_2_5lb = "add_2.5lb"
    case add_10lb
    case reduce_assistance, maintain, deload, none
    case add_reps, add_time, progress_gripper

    var weightIncrement: Double? { /* 5, 2.5, 10, nil */ }
}

enum WeightSpec: Codable {
    case fixed(Double)
    case progressive

    init(csvValue: String)  // parses "progressive" or numeric string
}

enum RepTarget: Codable {
    case count(Int)
    case failure

    init(csvValue: String)  // parses "failure" or integer string
}

struct Exercise: Identifiable, Codable {
    let id: UUID
    let order: Int
    let name: String
    let phase: Phase
    let equipmentType: EquipmentType
    let equipmentDetail: String?
    let baseWeight: WeightSpec
    let sets: Int
    let repMin: Int
    let repMax: RepTarget
    let restSeconds: Int
    let progressionRule: ProgressionRule
    let isUnilateral: Bool
    let isTimeBased: Bool     // explicit field; true when repMin represents a duration
    let notes: String?

    var timeDisplay: String?  // formats repMin as "2 min", "30s", etc.
}
```

### iOS WorkoutManager (`@Observable`)

- `programs: [Program]` — loaded from bundled CSVs on launch via `CSVParser.loadBundled()`
- `session: WorkoutSession?` — active session object
- `defaultRestSeconds`, `soundEnabled` — stored in `UserDefaults`
- `calculator: EquipmentCalculator`, lazy `progressionService`

**Screen lock:** `UIApplication.shared.isIdleTimerDisabled = true` on workout start, `false` on end/dismiss.

### iOS Progression Service

1. `resolveWeight(for: Exercise)` — checks last session via Core Data
2. If last session completed all sets (`completed=true` and `actualReps >= repMin` for each) -> apply progression rule
3. Otherwise -> keep same weight
4. `adjustForEquipment()` -> runs through EquipmentCalculator to snap to achievable weight

Key difference from web: iOS reads session history to auto-advance weight; the web app uses planned weights from the XLSX and requires manual overrides.

---

## Data Formats

### CSV Format (16 columns)

```
program_name,week,day_of_week,phase,exercise_order,exercise_name,
equipment_type,equipment_detail,base_weight,sets,rep_min,rep_max,
rest_seconds,progression_rule,unilateral,notes
```

| Column | Type | Values / Notes |
|--------|------|----------------|
| `program_name` | string | e.g. "Reacher Build" |
| `week` | integer | 1–N |
| `day_of_week` | string | "Monday"–"Sunday" or "Daily" |
| `phase` | string | warmup, main, finisher, cooldown, mobility |
| `exercise_order` | integer | Sort order within workout |
| `exercise_name` | string | Free text |
| `equipment_type` | string | `barbell_45`, `barbell_35`, `barbell_ez`, `powerblock`, `dumbbell`, `band`, `kettlebell`, `bodyweight`, `assisted_pullup`, `gripper` |
| `equipment_detail` | string | Band color, "2lb" for regular dumbbell, etc. |
| `base_weight` | number or "progressive" | lbs; "progressive" = seed from `total_weight` |
| `sets` | integer | Number of sets |
| `rep_min` | integer | Minimum reps (or hold duration in seconds for time-based) |
| `rep_max` | integer or "failure" | Max reps; "failure" = AMRAP |
| `rest_seconds` | integer | Rest after each set (0 = no rest) |
| `progression_rule` | string | See ProgressionRule enum |
| `unilateral` | boolean | TRUE/FALSE — each side |
| `notes` | string | Displayed to user during workout |

**Special values:**
- `base_weight: "progressive"` — weight seeded from `total_weight` in XLSX (or 0 if not set)
- `rep_max: "failure"` — last set is AMRAP
- `day_of_week: "Daily"` — workout available every day; triggers checklist mode on import
- `rest_seconds: 0` — no rest timer (also part of checklist heuristic detection)

**Bundled programs:**
- `reacher_build_cycle2.xlsx` — 6-day strength program, 4 weeks (current active program). Multi-sheet XLSX, one sheet per day of week. Supersedes `reacher_build_workout.csv`.
- `daily_mobility.csv` — 18-exercise daily mobility routine

---

### XLSX Format (extended columns)

The XLSX format (`reacher_build_cycle2.xlsx`) is an alternative import format with an expanded column set. It contains all 16 CSV columns plus the following additions:

| New Column | Type | Purpose |
|------------|------|---------|
| `equipment_category` | string | Human-readable equipment grouping for display — "barbell", "dumbbell", "machine", "band", "bodyweight". Used for UI grouping; does not affect weight calculations. |
| `total_weight` | number | Pre-calculated total target weight in lbs including bar weight. Seeds the progressive starting weight for the first session when provided. If both `base_weight` and `total_weight` are set, `total_weight` takes priority as the session starting weight. |
| `last_set_amrap` | boolean | `TRUE` = final set is AMRAP regardless of `rep_max`. All preceding sets use `rep_min`–`rep_max` range. Stored internally as `repMax: { type: "failure" }`. Takes priority over `rep_max` if both are present. |
| `rest_after` | integer, string, or `FALSE` | Human-friendly alternative to `rest_seconds`. `FALSE` = flow directly to next exercise, no rest timer (applied to all warmup phase exercises). Accepts: integer seconds (`90`), seconds string (`"90s"`), minutes string (`"2m"`), or mm:ss string (`"2:00"`). Takes priority over `rest_seconds` if both columns are present. |

**Full XLSX column order:**

```
program_name, week, day_of_week, phase, exercise_order, exercise_name,
equipment_type, equipment_category, equipment_detail,
base_weight, total_weight,
sets, rep_min, rep_max, last_set_amrap,
rest_seconds, rest_after,
progression_rule, unilateral, notes
```

---

## Progressive Overload Logic

Weights are planned in the XLSX (`total_weight` column seeds the starting weight for progressive exercises). The web app does not auto-adjust weights based on session history — users modify weights manually via the weight editor. The iOS app checks the last Core Data session and advances weight if all sets were completed.

### Progression Rules

| Rule | Weight Effect | Typical Use |
|------|--------------|-------------|
| `add_5lb` | +5 lbs when all sets completed at repMin | Barbell compounds |
| `add_2.5lb` | +2.5 lbs when all sets completed | PowerBlock isolation |
| `add_10lb` | +10 lbs when all sets completed | Barbell rows, hip thrusts |
| `add_reps` | No weight change; track rep progress | Bodyweight progressions |
| `add_time` | No weight change; track duration progress | Timed holds |
| `add_rounds` | No weight change; increase rounds | Jump rope |
| `maintain` | No weight change | Fixed-load exercises |
| `deload` | Weight remains; intended for deload weeks | Recovery |
| `progress_gripper` | No weight change; custom progression | Grip training |
| `none` | No tracking | Warm-ups, cues |
| Band color string (e.g. `"Blue"`) | Move to named band | Dip assist progression |
| Band count string (e.g. `"2 bands"`) | Reduce to named band count | Pull-up assist progression |

### Equipment Constraints Applied to Progressions

All target weights are snapped to achievable equipment values before being presented:
- **Barbell** — rounds up to nearest achievable plate combination
- **PowerBlock** — rounds to nearest 2.5 lbs, clamped 5–50 lbs
- **Assisted pullup** — progression tracked as assistance weight reduction
- **Band/bodyweight/kettlebell** — no snapping

---

## Equipment Reference

### Barbells

| Bar | Weight |
|-----|--------|
| Olympic barbell | 45 lbs |
| Shorter barbell | 35 lbs |
| EZ curl bar | 15 lbs |

### Plates (available per side)

| Plate | Max per side |
|-------|-------------|
| 45 lb | 1 |
| 35 lb | 1 |
| 25 lb | 2 |
| 10 lb | 2 |
| 5 lb  | 1 |
| 2.5 lb | 1 |
| 1 lb  | 1 |
| 0.75 lb | 1 |
| 0.5 lb | 1 |

### PowerBlock Elite EXP

- Range: 5–50 lbs
- Increment: 2.5 lbs
- Equipment detail `"2lb"` -> treated as a regular fixed dumbbell (not PowerBlock)

### Resistance Bands (Serious Steel)

| Color | Resistance |
|-------|-----------|
| Orange | 2–12 lbs |
| Purple | 5–35 lbs |
| Red | 10–50 lbs |
| Blue | 20–80 lbs |
| Green | 50–120 lbs |
| Black | 60–150 lbs |

### Landmine

Exercises with "landmine" in the name use single-side plate loading (`calculateLandmine`). Plates are loaded on one end only; achieved weight = bar + plates (not bar + plates x 2).

---

## Deviations from Original Spec

| Area | Original Spec | Actual Implementation |
|------|--------------|----------------------|
| Platform | iOS + Watch only | iOS native **+** separate Next.js/Firebase web app |
| Progression model (web) | Add weight if all sets done | Planned weights only — `total_weight` in XLSX seeds progressive exercises; user overrides manually; no history-based auto-progression |
| Progression model (iOS) | Add weight if all sets done | Core Data history check; advance weight if last session completed all sets |
| Set capture | Reps + weight + failed toggle | Adds **difficulty rating** (easy/normal/hard) per set — recorded for history, does not auto-adjust weight |
| Checklist mode | Not specified | Full checklist UI for Daily workouts with Firestore incremental sync + today-resume |
| Landmine loading | Not specified | `calculateLandmine()` — one-side plate loading |
| Pause/resume | Not specified | Full pause -> resume banner -> restore, with localStorage flag |
| Program editor | Not specified | In-app add/edit/delete exercises, checklist toggle per day; mid-workout weight/set-count editor |
| Session detail view | Not specified | `/session/[id]` with per-set breakdown and rating display |
| Program lifecycle | Not specified | Archive (soft-delete) or delete programs; re-import XLSX to refresh exercise definitions |
| Watch companion app | Planned | Not implemented |
| Apple Health integration | Post-MVP | Not implemented |
| Voice commands | Post-MVP | Not implemented |
| Equipment inventory (web) | User configures missing plates | iOS only (`EquipmentInventoryView`); not yet in web |
| Equipment types | barbell, powerblock, band, kettlebell, bodyweight, assisted_pullup | Added: `dumbbell` (distinct type), `gripper` |
| Progression rules | add_5lb, add_2.5lb, reduce_assistance, maintain, deload, none | Added: `add_10lb`, `add_reps`, `add_time`, `progress_gripper`, `add_rounds`; `reduce_assistance` replaced by specific next-step strings (band color or band count) |
| Auth (web) | Not specified | Google OAuth via Firebase; all data scoped per user |
| Progression graphs | Swift Charts | iOS: `ProgressionChartView`; Web: `/exercise/[name]` page (handles weight, time-based, bodyweight) |
| Resistance bands | Orange, Purple, Red, Blue | Added: Green (50–120 lbs), Black (60–150 lbs) |
| PowerBlock display | Weight only | Adds selector position + rod configuration instructions via lookup table |
| rest_after column | Not specified | `FALSE` = flow through with no rest timer (warmup phase default); numeric/string = rest after exercise completes |
| AMRAP last set | rep_max: "failure" | Explicit `last_set_amrap` flag per exercise row; Monday/Wednesday/Friday/Tuesday primary lifts |
| Import format (web) | Not specified | XLSX only (multi-sheet); CSV parser retained for `daily_mobility.csv` but not exposed in UI |
| Active program file | reacher_build_workout.csv | Superseded by reacher_build_cycle2.xlsx (multi-sheet XLSX, one sheet per day) |

---

## Testing

Tests live in `web/src/lib/__tests__/` and `web/src/hooks/__tests__/`.

```bash
cd web
npm test
```

Test coverage:
- `xlsx-parser.test.ts` — unit tests for XLSX parsing edge cases
- `xlsx-parser.integration.test.ts` — parses actual XLSX program file, validates all fields
- `csv-parser.test.ts` — unit tests for CSV parsing edge cases
- `csv-parser.integration.test.ts` — parses actual bundled CSV files, validates all fields
- `equipment-calculator.test.ts` — plate math, landmine, PowerBlock, rounding
- `progression-service.test.ts` — weight resolution scenarios
- `pr-detector.test.ts` — weight PR, estimated 1RM, volume PR
- `types.test.ts` — helper functions

---

## Local Development

### Web App

```bash
cd web
npm install
# Add Firebase project config to .env.local
npm run dev     # http://localhost:3000
npm test        # vitest
npm run build   # production build check
```

### iOS App

```bash
# Generate .xcodeproj from project.yml
xcodegen generate
open WorkoutTracker.xcodeproj
# Build and run from Xcode GUI
```

No iOS SDK on development machine — build only through Xcode.
