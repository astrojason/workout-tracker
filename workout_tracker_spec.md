# Workout Tracker - Complete Technical Specification

> **Last updated:** July 2026
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
│   ├── history/page.tsx          # Session list + exercise PR board + copy-logged-week
│   ├── settings/
│   │   ├── page.tsx               # Programs, rest time, sound, account, version footer
│   │   └── equipment/page.tsx     # Owned-equipment inventory editor
│   ├── programs/[id]/page.tsx    # Program detail — browse/edit exercises per week, copy-week
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
│   │   ├── ExerciseEditor.tsx        # Add/edit exercise modal (filters equipment options by owned inventory)
│   │   └── EquipmentWeightInput.tsx  # Per-equipment-type weight inputs (barbell/PowerBlock/pullup-assist), clamped to owned inventory
│   ├── settings/
│   │   ├── BarbellSection.tsx
│   │   ├── PlatesSection.tsx
│   │   ├── PowerBlockSection.tsx
│   │   ├── KettlebellsSection.tsx
│   │   ├── BandsSection.tsx
│   │   ├── LoopBandsSection.tsx
│   │   ├── FixedDumbbellsSection.tsx
│   │   ├── GripperSection.tsx
│   │   └── AssistedPullupSection.tsx
│   └── providers/
│       └── AuthProvider.tsx
├── hooks/
│   ├── useWorkout.ts             # Active workout state machine
│   ├── usePrograms.ts            # Programs, settings, XLSX import
│   ├── useHistory.ts             # Session history + exercise stats (useHistory, useExerciseHistory)
│   ├── useEquipmentConfig.ts     # Loads/saves owned-equipment inventory, merged over defaults
│   └── useSound.ts
└── lib/
    ├── types.ts                  # All shared types + helper functions
    ├── firestore.ts              # All Firestore CRUD operations
    ├── xlsx-parser.ts            # XLSX -> Program/Workout objects (primary import format)
    ├── csv-parser.ts             # CSV -> Program/Workout objects (daily_mobility.csv only; not exposed in UI)
    ├── progression-service.ts    # Planned weight resolution + equipment snapping
    ├── equipment-calculator.ts   # Plate math, PowerBlock selector/rod config, display strings, owned-equipment defaults
    ├── pr-detector.ts            # PR detection (weight, 1RM, volume)
    ├── week-export.ts            # Formats a week (planned or logged) as clipboard-ready text
    └── version.ts                # Re-exports package.json version for the Settings footer
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
  migratedProgramIds?: string[];
}
```

#### Equipment Inventory (`lib/types.ts` + `lib/equipment-calculator.ts`)

The user's owned equipment (plates, PowerBlock range, bands, etc.) is configurable in both the web app and iOS, and is used to clamp/filter weight inputs and equipment options rather than assuming a fixed inventory.

```typescript
type BandColor = "Orange" | "Purple" | "Red" | "Blue" | "Green" | "Black";
type LoopBandSize = "Ultra-light" | "Light" | "Medium" | "Heavy" | "X-heavy" | "XX-heavy";
type CoCLevel = "T" | "0.5" | "1" | "1.5" | "2" | "2.5" | "3" | "3.5" | "4";

interface UserEquipmentConfig {
  barbells: { has45lb: boolean; has35lb: boolean; hasEZBar: boolean };
  // totalOwned = total physical plates owned across both sides.
  // Barbell per-side limit = floor(totalOwned/2); landmine per-side limit = totalOwned.
  plates: { weight: number; totalOwned: number }[]; // ordered largest -> smallest
  powerBlock: { owned: boolean; minLbs: number; maxLbs: number };
  fixedDumbbells: number[];
  kettlebells: number[];        // sorted ascending
  bands: BandColor[];           // owned Serious Steel bands
  loopBands: LoopBandSize[];    // owned loop bands
  assistedPullupBands: number;  // max bands available for pullup assist (0 = none owned)
  grippers: CoCLevel[];         // owned Captains of Crush levels
}
```

`DEFAULT_EQUIPMENT_CONFIG` (in `equipment-calculator.ts`) seeds a new user with the full standard inventory documented in [Equipment Reference](#equipment-reference); a saved config is merged over these defaults so missing fields don't break older docs.

**Stored at:** `/users/{userId}/settings/equipment` (separate Firestore doc from `settings/prefs`). Loaded/saved via `useEquipmentConfig(userId)`, which exposes `{ config, loading, saving, saveConfig }` with optimistic updates (reverted + `showError` on failure).

**Consumed by:**
- `ExerciseEditor.tsx` — filters the barbell `<select>` options by `barbells.has45lb/has35lb/hasEZBar` (still shows the currently selected type even if unowned, so an in-use value is never hidden)
- `EquipmentWeightInput.tsx` — `calculateBarbell()` uses `getEffectivePlates(config)` instead of a hardcoded plate set; the PowerBlock input clamps to `powerBlock.minLbs`/`maxLbs`; the pullup-assist input's minimum drops to 0 when `assistedPullupBands === 0`

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
  settings/equipment      -> UserEquipmentConfig
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

**Plate inventory (per side, default):**

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

This is the default inventory (`DEFAULT_EQUIPMENT_CONFIG`), used when a user hasn't customized their [Equipment Inventory](#equipment-inventory-libtypests--libequipment-calculatorts). `getEffectivePlates(config)` derives the actual per-side plate limits from the user's `UserEquipmentConfig` — barbell = `floor(totalOwned/2)`, landmine = `totalOwned`.

**`calculateBarbell(targetWeight, barWeight, config?)`** — subtracts bar, divides by 2, builds greedy plate combination from the effective plate set (largest plates first). If exact match impossible, rounds down in 0.25 lb increments to the nearest achievable weight.

**`calculateLandmine(targetWeight, barWeight, config?)`** — same but uses one-side loading (no ÷2). Triggered when the exercise name contains "landmine" **or** "meadows" (case-insensitive substring match — e.g. "Meadows Row" loads one-sided even though it doesn't say "landmine").

**`nearestPowerBlock(target, config?)`** — clamps to the configured `powerBlock.minLbs`–`maxLbs` range (default 5–50 lbs), rounds to nearest 2.5 lbs.

**`getPowerBlockInstructions(weight)`** — returns `PowerBlockInstructions` with selector dial position and rod configuration for each valid PowerBlock weight (5–50 lbs in 2.5 lb steps).

**`getEquipmentDisplay(exercise, weight)`** — returns the appropriate `EquipmentDisplay` variant:
- `equipmentType === "powerblock"` with `equipmentDetail` or weight < 5 lbs → `{ type: "dumbbell" }` instead
- `equipmentType === "dumbbell"` → `{ type: "dumbbell" }` directly
- `equipmentType === "gripper"` → `{ type: "gripper" }`
- All barbell types check for "landmine" or "meadows" in exercise name → uses `calculateLandmine`

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

#### Week Export (`lib/week-export.ts`)

Formats a week of workouts as clipboard-ready plain text. Two entry points:

- **`formatWeekAsText(programName, week, workouts: Workout[])`** — the *planned* week. Sorts workouts by day-of-week, exercises by `order`, and prints one line per exercise (name, sets x rep range, weight, rest), grouped under an uppercase day header:
  ```
  {programName} — Week {week}

  MONDAY
  1. Bench Press — 3 x 8-10 @ 135 lb (rest 90s)
  2. ...

  TUESDAY
  ...
  ```
  Triggered by the **"Copy Week"** button on the Program Editor (`/programs/[id]`), next to the week tabs. Shows "Copied!" for 2s after a successful copy.

- **`formatSessionsWeekAsText(programName, week, sessions: WorkoutSessionDoc[])`** — the *actual logged* week. Groups each day's completed sets (`completed === true`) by exercise name and prints one line per exercise summarizing all sets:
  ```
  {programName} — Week {week} (completed)

  MONDAY
    Bench Press: 8 @ 135 lb, 8 @ 135 lb, 6 @ 135 lb
    Plank: 0:45

  TUESDAY
    No completed sets
  ```
  Time-based exercises print duration (`formatTimeValue`); sets with `actualWeight === 0` print reps only (no "@ 0 lb"). Triggered by the **"Copy a Logged Week"** card on the History page (`/history`) — program + week selectors, fetches sessions via `getSessionsForWeek()`, then copies.

Both call `navigator.clipboard.writeText()` and swallow clipboard errors silently (`// non-critical`, per the browser-API exception in the error-handling rules).

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

- **Copy a Logged Week** card: program + week `<select>`s, "Copy Week" button — copies that week's actual completed sets to the clipboard via `formatSessionsWeekAsText`. Only shown when the user has programs.
- **Exercise Progress** section: all exercises with a weight PR, sorted alphabetically. Tapping navigates to `/exercise/[name]`
- **Recent Workouts** section: sessions (program, day, week, date, duration). Tapping navigates to `/session/[id]`
- Both list sections paginate at 10 items, expandable

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
- Rename program (keeps history and progress; keyed on stable `programId`, not name)
- Delete session, delete or archive program (keeps history)
- Re-import XLSX to update exercise definitions
- Default rest time: 60/90/120/150/180s
- Timer sound toggle
- "Manage Equipment" link -> `/settings/equipment`
- Account info (email) + sign out
- Version footer: "Workout Tracker v{APP_VERSION}" at the bottom of the page (see [Versioning](#versioning))

#### Equipment Inventory (`/settings/equipment`)

Editor for the user's owned equipment (`UserEquipmentConfig`), composed of one section component per equipment type (`BarbellSection`, `PlatesSection`, `PowerBlockSection`, `KettlebellsSection`, `BandsSection`, `LoopBandsSection`, `FixedDumbbellsSection`, `GripperSection`, `AssistedPullupSection`). Tracks a local `draft` against the loaded `config`, dirty-checked via `JSON.stringify` diff, with a sticky "Save Changes" button that calls `saveConfig(draft)`. Changes here affect plate math, PowerBlock range clamping, and which barbell types appear in `ExerciseEditor`.

#### Program Editor (`/programs/[id]`)

- Week tabs
- "Copy Week" button — copies the week's planned exercises to the clipboard via `formatWeekAsText`
- Exercises listed by day, sorted by exercise order
- Add/Edit/Delete exercises via `ExerciseEditor` modal (equipment options filtered by owned inventory)
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
| `useEquipmentConfig(userId)` | Loads/saves `UserEquipmentConfig` (`{ config, loading, saving, saveConfig }`), merged over `DEFAULT_EQUIPMENT_CONFIG`; optimistic update with revert + `showError` on save failure |
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

Exercises with "landmine" **or** "meadows" in the name (case-insensitive substring match — e.g. "Meadows Row") use single-side plate loading (`calculateLandmine`). Plates are loaded on one end only; achieved weight = bar + plates (not bar + plates x 2).

---

## Versioning

- App version lives in `web/package.json` (`version`), re-exported by `web/src/lib/version.ts` (`APP_VERSION`), and shown at the bottom of the Settings page as "Workout Tracker v{APP_VERSION}".
- `scripts/git-hooks/pre-commit` (enabled via `git config core.hooksPath scripts/git-hooks`) interactively prompts a human committer for a major/minor/patch bump on each commit, runs `npm version <bump> --no-git-tag-version` in `web/`, and stages the updated `package.json`/`package-lock.json` into the commit. It auto-skips when there's no interactive terminal (including commits made by Claude Code) or when `SKIP_VERSION_BUMP=1`.
- Because the hook can't prompt Claude Code, proposed commits should state whether they warrant a major/minor/patch bump so a human (or Claude, with confirmation) can apply it manually.

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
| Equipment inventory (web) | User configures missing plates | Implemented — `/settings/equipment`, `UserEquipmentConfig` stored per-user in Firestore, wired into `ExerciseEditor` and the barbell/PowerBlock/pullup-assist weight inputs |
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
| Landmine detection | Exercise name contains "landmine" | Also matches "meadows" (case-insensitive) — Meadows Row loads one-sided like a landmine attachment |
| Week export | Not specified | Copy a week's planned exercises (Program Editor) or actual logged sets (History) to the clipboard as plain text |
| App versioning | Not specified | `web/package.json` version shown in Settings footer; `pre-commit` git hook interactively prompts a human committer for a semver bump on each commit (auto-skipped for non-interactive commits, e.g. Claude Code) |

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
