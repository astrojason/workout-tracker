# Workout Tracker - Complete Technical Specification

> **Last updated:** March 2026
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
│   ├── usePrograms.ts            # Programs, settings, CSV import
│   ├── useHistory.ts             # Session history + exercise stats
│   └── useSound.ts
└── lib/
    ├── types.ts                  # All shared types + helper functions
    ├── firestore.ts              # All Firestore CRUD operations
    ├── csv-parser.ts             # CSV -> Program/Workout objects
    ├── progression-service.ts    # Weight resolution + progression logic
    ├── equipment-calculator.ts   # Plate math, PowerBlock, display strings
    └── pr-detector.ts            # PR detection (weight, 1RM, volume)
```

---

### Data Models

#### Core Types (`lib/types.ts`)

```typescript
type Phase = "warmup" | "main" | "finisher" | "cooldown" | "mobility";

type EquipmentType =
  | "barbell_45" | "barbell_35" | "barbell_ez"
  | "powerblock" | "band" | "kettlebell"
  | "bodyweight" | "assisted_pullup";

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
  notes: string | null;
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
  rating?: "easy" | "normal" | "hard";  // recorded per set
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
type EquipmentDisplay =
  | { type: "barbell"; config: PlateConfiguration }
  | { type: "powerblock"; weight: number }
  | { type: "dumbbell"; weight: number }   // PowerBlock detail < 5 lbs
  | { type: "band"; name: string; range: string }
  | { type: "bodyweight"; detail: string | null }
  | { type: "assisted"; weight: number; detail: string | null }
  | { type: "kettlebell"; weight: number };

interface PlateConfiguration {
  targetWeight: number;
  barWeight: number;
  achievedWeight: number;
  perSide: { plate: number; count: number }[];
  isLandmine?: boolean;                    // true for landmine exercises
}
```

---

### Firestore Schema

```
/users/{userId}/
  settings/prefs          -> UserSettings
  programs/{programId}    -> { name, totalWeeks, createdAt }
  workouts/{workoutId}    -> Workout (exercises embedded as array)
  sessions/{sessionId}    -> WorkoutSessionDoc (sets embedded as array)
  personalRecords/{prId}  -> PersonalRecordDoc
```

**Workout document ID:** `{programName_lowercase}_{week}_{dayOfWeek}`
**PR document ID:** `{exerciseName}_{recordType}`

---

### Services

#### CSV Parser (`lib/csv-parser.ts`)

Validates 16-column CSV, groups rows into `Program[]` and `Workout[]`. Assigns `crypto.randomUUID()` to each exercise on parse. Sets `isChecklist: true` for any workout where `dayOfWeek === "Daily"`.

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

**`calculateBarbell(targetWeight, barWeight)`** — subtracts bar, divides by 2, builds greedy plate combination. If exact match impossible, rounds up in 0.25 lb increments.

**`calculateLandmine(targetWeight, barWeight)`** — same but divides by 1 (one-side loading). Triggered when exercise name contains "landmine".

**`nearestPowerBlock(target)`** — clamps to 5–50 lbs, rounds to nearest 2.5 lbs.

**`getEquipmentDisplay(exercise, weight)`** — returns the appropriate `EquipmentDisplay` variant. Special case: if `equipmentType === "powerblock"` and `equipmentDetail` indicates a weight < 5 lbs (e.g. "2lb"), returns `{ type: "dumbbell" }` instead.

**Band info:**

| Color  | Resistance  |
|--------|-------------|
| Orange | 2–12 lbs   |
| Purple | 5–35 lbs   |
| Red    | 10–50 lbs  |
| Blue   | 20–80 lbs  |

#### Progression Service (`lib/progression-service.ts`)

Called at workout start to resolve each progressive exercise's weight.

**Weight resolution logic (`resolveWeightWithMeta`):**

1. `fixed` base weight -> return as-is (`reason: "fixed"`)
2. No history -> return 0 (`reason: "no_history"`, prompts user to set weight)
3. Last session did not complete all sets:
   - Check two sessions back
   - Both failed -> reduce by 1x increment (`reason: "reduced_2x_miss"`)
   - Only one failed -> keep same weight (`reason: "kept_same_miss"`)
4. Last session completed:
   - Last set rated "easy" -> bump by 2x increment (`reason: "easy_bump"`)
   - Any set rated "hard" -> keep same weight (`reason: "kept_same_hard"`)
   - Normal -> apply progression rule (`reason: "normal_progression"`)
   - No increment (band/bodyweight/etc.) -> keep same (`reason: "no_increment"`)

**Mid-workout adjustments (in `useWorkout.ts`):**
- After completing a set rated "easy" with sets remaining -> immediately bump weight for remaining sets by 1x increment
- After last set of exercise rated "easy" (all sets met repMin) -> show prompt: 2x next session vs. standard
- After a set rated "hard" with sets remaining -> show prompt: keep weight vs. reduce by 1x increment for remaining sets

**2x Miss deduction at workout start:** surfaced as `MissReductionPrompt` queue — user sees one prompt per affected exercise before the workout begins and can accept or override the reduction.

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
  -> resolveWeightWithMeta() for all exercises
  -> Show MissReductionPrompt queue (if any 2x-miss exercises)

Exercise Loop:
  Show ExerciseCard (name, set N of M, weight, equipment setup, next-up preview)
  User taps "Complete Set"
    -> SetCompletionModal (reps, weight, difficulty rating, failed toggle, notes)
    -> playSetComplete()
    -> If sets remain + restSeconds > 0: RestTimer overlay
    -> If rated "easy" + sets remain: bump weight immediately by 1x increment
    -> If rated "hard" + sets remain: show HardWeightDecision prompt
    -> After last set if all-easy: show EasyPrompt (2x jump vs standard)
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
- Delete program (keeps history)
- Import CSV via file picker
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
| `useWorkout(userId)` | Full active workout state machine: session, rest timer, set completion, PR detection, pause/resume, localStorage persistence, WakeLock |
| `usePrograms(userId)` | Programs list, per-program workouts cache, week state, CSV import, settings load/save |
| `useHistory(userId)` | Recent sessions + per-exercise best-set stats |
| `useExerciseHistory(userId, name)` | Time-series history for a single exercise |
| `useSound()` | `playTimerComplete()`, `playSetComplete()`, `initAudio()` |

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
    case powerblock, band, kettlebell, bodyweight, assisted_pullup

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
    let notes: String?

    var isTimeBased: Bool     // repMin >= 30 && progressionRule == .add_time
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

Key difference from web: no easy/hard rating influence, no 2x-miss deduction.

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
| `equipment_type` | string | See EquipmentType enum |
| `equipment_detail` | string | Band color, "2lb" for regular dumbbell, etc. |
| `base_weight` | number or "progressive" | lbs; "progressive" = resolve from history |
| `sets` | integer | Number of sets |
| `rep_min` | integer | Minimum reps (or hold duration in seconds for time-based) |
| `rep_max` | integer or "failure" | Max reps; "failure" = AMRAP |
| `rest_seconds` | integer | Rest after each set (0 = no rest) |
| `progression_rule` | string | See ProgressionRule enum |
| `unilateral` | boolean | TRUE/FALSE — each side |
| `notes` | string | Displayed to user during workout |

**Special values:**
- `base_weight: "progressive"` — weight resolved from prior session history
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
| Progression model | Add weight if all sets done | Rating-based (easy/hard prompts, 2x-miss deduction, mid-workout adjustments) |
| Set capture | Reps + weight + failed toggle | Adds **difficulty rating** (easy/normal/hard) per set |
| Checklist mode | Not specified | Full checklist UI for Daily workouts with Firestore incremental sync + today-resume |
| Landmine loading | Not specified | `calculateLandmine()` — one-side plate loading |
| Pause/resume | Not specified | Full pause -> resume banner -> restore, with localStorage flag |
| Program editor | Not specified | In-app add/edit/delete exercises, checklist toggle per day |
| Session detail view | Not specified | `/session/[id]` with per-set breakdown and rating display |
| Watch companion app | Planned | Not implemented |
| Apple Health integration | Post-MVP | Not implemented |
| Voice commands | Post-MVP | Not implemented |
| Equipment inventory (web) | User configures missing plates | iOS only (`EquipmentInventoryView`); not yet in web |
| Progression rules | add_5lb, add_2.5lb, reduce_assistance, maintain, deload, none | Added: `add_10lb`, `add_reps`, `add_time`, `progress_gripper`, `add_rounds`; `reduce_assistance` replaced by specific next-step strings (band color or band count) |
| Auth (web) | Not specified | Google OAuth via Firebase; all data scoped per user |
| Progression graphs | Swift Charts | iOS: `ProgressionChartView`; Web: `/exercise/[name]` page |
| Resistance bands | Orange, Purple, Red, Blue | Added: Green (50–120 lbs), Black (60–150 lbs) |
| rest_after column | Not specified | `FALSE` = flow through with no rest timer (warmup phase default); numeric/string = rest after exercise completes |
| AMRAP last set | rep_max: "failure" | Explicit `last_set_amrap` flag per exercise row; Monday/Wednesday/Friday/Tuesday primary lifts |
| Active program file | reacher_build_workout.csv | Superseded by reacher_build_cycle2.xlsx (multi-sheet XLSX, one sheet per day) |

---

## Testing

Tests live in `web/src/lib/__tests__/` and `web/src/hooks/__tests__/`.

```bash
cd web
npm test
```

Test coverage:
- `csv-parser.test.ts` — unit tests for CSV parsing edge cases
- `csv-parser.integration.test.ts` — parses actual bundled CSV files, validates all fields
- `equipment-calculator.test.ts` — plate math, landmine, PowerBlock, rounding
- `progression-service.test.ts` — all weight resolution scenarios
- `pr-detector.test.ts` — weight PR, estimated 1RM, volume PR
- `types.test.ts` — helper functions
- `useWorkout.test.ts` — workout hook state transitions

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
