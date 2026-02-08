# Workout Tracker iOS App - Complete Specification

## Overview
Native iOS app with Apple Watch companion for progressive overload strength training. Imports workout programs from CSV, guides user through exercises with automatic rest timers, tracks performance history, and provides strength progression analytics.

## Project Setup
- **Platform**: iOS 17+ (iPhone and Apple Watch)
- **Framework**: SwiftUI + WatchKit
- **Language**: Swift 5.9+
- **Persistence**: Core Data for workout history, UserDefaults for current program state
- **Target**: iPhone app with WatchOS companion app

## Core Features

### 1. Program Management
- Import workout programs from CSV files (via Files app or AirDrop)
- Support multiple programs (e.g., "Reacher Build", "Daily Mobility", future programs)
- Automatic workout selection based on current day of week
- Manual workout selection from available programs
- Track current week in program (1-4 for Reacher Build)

### 2. CSV Import & Parsing
**Format**: 16 columns as specified
```
program_name,week,day_of_week,phase,exercise_order,exercise_name,equipment_type,equipment_detail,base_weight,sets,rep_min,rep_max,rest_seconds,progression_rule,unilateral,notes
```

**Equipment Types**:
- `barbell_45`: 45lb Olympic bar
- `barbell_35`: 35lb bar  
- `barbell_ez`: 15lb EZ curl bar
- `powerblock`: PowerBlock Elite EXP (5-50lb in 2.5lb increments)
- `band`: Serious Steel resistance bands (#0-#5, specified in equipment_detail)
- `kettlebell`: Fixed weight kettlebells
- `bodyweight`: No equipment
- `assisted_pullup`: Pull-up assist machine (up to 200lb assistance in 50lb increments)

**Progression Rules**:
- `add_5lb`: Add 5lbs when all sets completed in rep range
- `add_2.5lb`: Add 2.5lbs when all sets completed in rep range
- `reduce_assistance`: Reduce assistance by 10lb when all sets completed
- `maintain`: No progression
- `deload`: Reduce weight
- `none`: No tracking/progression

### 3. Equipment Calculator

#### Barbell Plate Calculator
**Available plates** (pairs): 45, 35, 25, 10, 5, 2.5, 1, 0.75, 0.5

**Logic**:
1. Subtract bar weight from target
2. Divide remainder by 2 (per side)
3. Build combination using available plates
4. If exact match impossible, round UP to next achievable weight
5. Display as: "Add to each side: 1×25 + 1×10 + 1×2.5"

**Examples**:
- Target: 185lb on 45lb bar → 70lb per side → "1×45 + 1×25"
- Target: 137lb on 45lb bar → 46lb per side → Round to 47.5 → "1×45 + 1×2.5"

#### PowerBlock Calculator
Range: 5-50lb in 2.5lb increments
Display: "Set PowerBlocks to: 32.5 lbs" (with visual of selector pin position)

#### Band Selection
Display band name and resistance range: "Orange Band (2-12 lbs)"

#### Assisted Pull-up Calculator
Range: 50-200lb in 50lb increments
When reducing assistance, decrease by 10lb (round to nearest 50lb increment)

### 4. Workout Flow UI

#### Home Screen
- Current date and suggested workout
- "Start [Program Name] - [Day]" button
- "Choose Different Workout" button (shows all programs/days)
- Weekly overview showing completed workouts (checkmarks)
- Quick stats: "Week 2 of 4", "3/6 workouts this week"

#### Workout Screen
- **Header**: Program name, phase (warmup/main/finisher), timer
- **Current Exercise Card**:
  - Exercise name (large text)
  - Set number: "Set 2 of 4"
  - Target: "8-10 reps"
  - Equipment setup: "PowerBlock: 35 lbs" or "Add to bar: 1×25 + 2×10"
  - Notes (if any)
  - If weight changed from last set: "⚠️ ADD 5 lbs to each side"
- **Action Buttons**:
  - "Complete Set" (green, primary)
  - "Skip Set" (gray, secondary)
  - "End Workout" (red, tertiary)
- **Progress Bar**: Shows exercise position in workout

#### Rest Timer
Triggered after "Complete Set" is pressed:
- **Full-screen overlay** (dim background)
- **Large countdown timer**: "1:45" (mm:ss format)
- **Next exercise preview**: "Next: Barbell Row (85 lbs)"
- If weight needs adjustment: **"⚠️ Add 10 lbs to each side"** in yellow
- **Pause/Resume buttons**
- **Skip Rest button**
- **At 0:00**:
  - Play sound (3 short beeps)
  - Trigger Apple Watch haptic (strong notification pattern)
  - Auto-advance to next exercise after 5 seconds
  - Show "Starting next exercise..." with countdown

#### Exercise History Input
After each set, capture:
- Actual reps completed (default to rep_max)
- Actual weight used (default to calculated weight)
- Optional: "Failed set" toggle if couldn't complete
- Optional: Quick notes

### 5. Progressive Overload Logic

**For each exercise with progression rule**:
1. Check last completed workout for this exercise
2. Did user complete ALL sets within rep range? 
   - YES: Apply progression rule (add weight or reduce assistance)
   - NO: Maintain current weight
3. Calculate new target weight
4. Run through equipment calculator to get achievable weight
5. Store new target for next workout

**Example**:
- Last workout: Barbell Row, 3 sets of 8, 8, 10 reps at 135 lbs → ALL sets in 8-10 range
- Progression rule: `add_5lb`
- New target: 140 lbs
- Calculator: 140 - 45 (bar) = 95 / 2 = 47.5 per side
- Achievable: 1×45 + 1×2.5 = 47.5 ✓
- Display: "Add to bar: 1×45 + 1×2.5 (140 lbs total)"

### 6. Workout History & Analytics

#### History Storage (Core Data)
```swift
WorkoutSession:
- id: UUID
- programName: String
- week: Int
- dayOfWeek: String
- date: Date
- completed: Bool
- exercises: [ExerciseSet]

ExerciseSet:
- exerciseName: String
- setNumber: Int
- targetWeight: Double
- actualWeight: Double
- targetReps: Int
- actualReps: Int
- completed: Bool
- timestamp: Date
- notes: String?
```

#### PR Detection
Track personal records per exercise:
- Highest weight × reps (1RM calculator)
- Volume PR (weight × total reps in workout)
- Display badge when PR is achieved: "🏆 New PR!"

#### Strength Progression Graphs
**Charts** (using Swift Charts):
1. **Weight over time** for each tracked exercise
2. **Volume over time** (weight × reps)
3. **Weekly workout completion** (6/6 target for Reacher Build)

**UI**:
- Tap exercise name anywhere in app → See its progression graph
- Last 12 weeks by default
- Toggle between weight/volume/frequency views

### 7. Apple Watch Companion

#### Watch App Features
- Mirror current exercise from phone
- Display set number, reps, weight
- Large "Complete" button
- Rest timer with haptic at 0:00
- Progress ring showing workout completion

#### Communication
- Use WatchConnectivity framework
- Phone → Watch: Current exercise state, timer updates
- Watch → Phone: Set completion, skip commands
- Keep watch display active during workout (prevent sleep)

### 8. Screen Lock Prevention
- Enable `UIApplication.shared.isIdleTimerDisabled = true` when workout starts
- Disable when workout ends or app backgrounds
- Show indicator in UI: "Screen lock disabled"

### 9. Settings & Configuration

#### User Settings
- Default rest time: 120 seconds (allow 60/90/120/150/180)
- Sound enabled/disabled
- Watch notifications enabled/disabled
- Week auto-advancement (manual vs automatic)

#### Equipment Inventory
- Allow user to mark which plates they DON'T have
- Adjust calculator accordingly
- Default: Full inventory from Gym_Equipment.md

### 10. Data Import Flow

1. User taps "Import Program"
2. System file picker appears
3. User selects CSV file
4. App validates format (check headers match spec)
5. Parse CSV into Program object
6. Show preview: "Found [X] exercises across [Y] days"
7. User confirms import
8. Program added to available programs list
9. If week 1 of new program, set as current week

## Technical Architecture

### Data Models

```swift
struct Program {
    let name: String
    let weeks: Int
    var currentWeek: Int
    let workouts: [Workout]
}

struct Workout {
    let programName: String
    let week: Int
    let dayOfWeek: String
    let exercises: [Exercise]
}

struct Exercise {
    let order: Int
    let name: String
    let phase: Phase
    let equipmentType: EquipmentType
    let equipmentDetail: String?
    let baseWeight: Double
    let sets: Int
    let repMin: Int
    let repMax: Int
    let restSeconds: Int
    let progressionRule: ProgressionRule
    let isUnilateral: Bool
    let notes: String?
}

enum Phase: String {
    case warmup, main, finisher, cooldown, mobility
}

enum EquipmentType: String {
    case barbell_45, barbell_35, barbell_ez
    case powerblock, band, kettlebell
    case bodyweight, assisted_pullup
}

enum ProgressionRule: String {
    case add_5lb, add_2_5lb, reduce_assistance
    case maintain, deload, none
}
```

### Equipment Calculator Service

```swift
class EquipmentCalculator {
    // Barbell plate combinations
    func calculateBarbell(targetWeight: Double, barWeight: Double) -> PlateConfiguration
    
    // PowerBlock validation
    func nearestPowerBlockWeight(_ target: Double) -> Double
    
    // Band selection
    func selectBand(detail: String) -> BandInfo
    
    // Assisted pullup
    func calculateAssistance(current: Double, reduce: Bool) -> Double
}

struct PlateConfiguration {
    let achievedWeight: Double
    let perSide: [(plate: Double, count: Int)]
    let displayString: String // "1×45 + 1×25"
}
```

### Progressive Overload Service

```swift
class ProgressionCalculator {
    func calculateNextWeight(
        exercise: Exercise,
        lastWorkout: [ExerciseSet],
        equipment: EquipmentCalculator
    ) -> Double
    
    func didCompleteAllSets(sets: [ExerciseSet], exercise: Exercise) -> Bool
}
```

## UI/UX Requirements

### Design Principles
- Large, finger-friendly buttons (60pt minimum)
- High contrast for outdoor visibility
- Clear visual hierarchy
- Minimal navigation during workout
- Swipe gestures for quick actions

### Color Scheme
- Primary: Blue/Purple (energy, focus)
- Success: Green (completed sets)
- Warning: Yellow (weight changes)
- Danger: Red (end workout)
- Background: Dark mode friendly

### Typography
- Exercise names: SF Pro Display, Bold, 24pt
- Set/rep info: SF Pro Text, Regular, 18pt
- Timer: SF Pro Display, Bold, 72pt
- Notes: SF Pro Text, Regular, 14pt

### Accessibility
- VoiceOver support for all UI elements
- Dynamic Type support
- Haptic feedback for button presses
- Clear error messages

## Testing Checklist

### CSV Import
- [ ] Valid CSV imports successfully
- [ ] Invalid CSV shows clear error
- [ ] Multiple programs coexist
- [ ] Week progression works

### Equipment Calculator
- [ ] Barbell: Exact weights achievable
- [ ] Barbell: Round up when exact impossible
- [ ] PowerBlock: Validate 2.5lb increments
- [ ] Bands: Display correct resistance
- [ ] Assisted pullups: 50lb increments

### Workout Flow
- [ ] Exercise order correct
- [ ] Rest timer counts down
- [ ] Sound plays at 0:00
- [ ] Watch receives notification
- [ ] Screen stays on during workout
- [ ] Weight changes displayed when needed

### Progressive Overload
- [ ] Adds weight when all sets completed
- [ ] Maintains weight when sets missed
- [ ] Respects equipment limitations
- [ ] Tracks progression over weeks

### History & Analytics
- [ ] All sets recorded correctly
- [ ] PRs detected accurately
- [ ] Graphs display data correctly
- [ ] Can view individual exercise history

## File Structure

```
WorkoutTracker/
├── App/
│   ├── WorkoutTrackerApp.swift
│   └── ContentView.swift
├── Models/
│   ├── Program.swift
│   ├── Workout.swift
│   ├── Exercise.swift
│   └── WorkoutHistory.swift
├── Services/
│   ├── CSVParser.swift
│   ├── EquipmentCalculator.swift
│   ├── ProgressionCalculator.swift
│   └── WorkoutManager.swift
├── Views/
│   ├── Home/
│   │   ├── HomeView.swift
│   │   └── WorkoutSelectionView.swift
│   ├── Workout/
│   │   ├── WorkoutView.swift
│   │   ├── ExerciseCard.swift
│   │   └── RestTimerView.swift
│   ├── History/
│   │   ├── HistoryView.swift
│   │   └── ExerciseDetailView.swift
│   └── Settings/
│       └── SettingsView.swift
├── Watch/
│   ├── WorkoutTrackerWatch.swift
│   └── WatchWorkoutView.swift
└── Resources/
    ├── Sounds/
    │   └── timer_complete.wav
    └── Assets.xcassets/
```

## Implementation Notes

1. **Start with CSV parsing and data models** - get the foundation right
2. **Build equipment calculator next** - critical for accurate weight displays
3. **Create workout flow UI** - core user experience
4. **Add persistence** - Core Data for history tracking
5. **Implement progression logic** - the "smart" part
6. **Add Watch app** - companion experience
7. **Polish with graphs and analytics** - data visualization

## Sample Data Files to Include

Include Jason's two CSV files:
- `reacher_build_workout.csv`
- `daily_mobility.csv`

These serve as examples and initial data for testing.

## Future Enhancements (Post-MVP)

- Exercise video links/demos
- Custom exercise creation
- Workout templates
- Rest day suggestions based on volume
- Deload week recommendations
- Export workout history (CSV/PDF)
- Share workouts with others
- Integration with Apple Health
- Warm-up auto-generation based on working weight
- Voice commands for hands-free operation

---

## Getting Started for Claude Code

1. Create new iOS app project with Watch companion
2. Import the two CSV files into Resources/
3. Create all model objects matching CSV structure
4. Build CSVParser service
5. Implement EquipmentCalculator with plate math
6. Create basic workout flow UI
7. Add Core Data persistence
8. Implement progressive overload logic
9. Build Watch app
10. Add rest timer with notifications
11. Create history tracking
12. Build progression graphs

**Priority**: Get basic workout flow working first (steps 1-6), then add intelligence and companion features.
