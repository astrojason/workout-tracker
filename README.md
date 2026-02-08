# Workout Tracker - Implementation Package for Claude Code

This package contains everything needed to build a native iOS workout tracking app with Apple Watch companion.

## What's Included

### Documentation
- **`workout_tracker_spec.md`** - Complete technical specification with all requirements, data models, UI/UX guidelines, and implementation roadmap

### Data Files
- **`reacher_build_workout.csv`** - 6-day strength training program (Weeks 1-4)
- **`daily_mobility.csv`** - Daily mobility routine (separate from main program)
- **`Gym_Equipment.md`** - Complete equipment inventory for weight calculations

## Quick Start for Claude Code

```bash
# Review the spec
cat workout_tracker_spec.md

# Check the CSV format
head -5 reacher_build_workout.csv

# Start implementation
# Create new Xcode project, then follow the "Getting Started" section in the spec
```

## Key Implementation Priorities

1. **CSV Parser** - Validate and import workout programs
2. **Equipment Calculator** - Smart barbell plate math (critical!)
3. **Workout Flow** - Exercise → Rest Timer → Next Exercise
4. **Progressive Overload** - Auto-calculate weight increases
5. **Watch App** - Companion controls and notifications
6. **History Tracking** - Record all sets for progression graphs

## Critical Features

### Must Have (MVP)
- ✅ CSV import
- ✅ Equipment-aware weight calculations
- ✅ Rest timer with sound + watch haptic
- ✅ Screen lock prevention during workout
- ✅ Progressive overload tracking
- ✅ Exercise history storage
- ✅ PR detection
- ✅ Strength progression graphs

### Nice to Have (Post-MVP)
- Exercise videos
- Voice commands
- Apple Health integration
- Workout sharing

## Equipment Constraints

The app must respect Jason's actual equipment:

### Barbells
- 45lb, 35lb, 15lb (EZ bar)

### Plates (in pairs)
- 45, 35, 25 (×2), 10 (×2), 5, 2.5, 1, 0.75, 0.5

### PowerBlock Elite EXP
- Range: 5-50 lbs
- Increment: 2.5 lbs
- Display selector pin position

### Example Weight Calculations
```
Target: 185 lbs (barbell exercise)
→ Bar: 45 lbs
→ Per side needed: (185-45)/2 = 70 lbs
→ Configuration: 1×45 + 1×25
→ Display: "Add to each side: 1×45 + 1×25"

Target: 137 lbs (impossible exact)
→ Per side needed: 46 lbs
→ Round UP to: 47.5 lbs (1×45 + 1×2.5)
→ Actual total: 140 lbs
→ Display: "Add to each side: 1×45 + 1×2.5 (140 lbs total)"
```

## Progressive Overload Rules

From CSV `progression_rule` column:

- **`add_5lb`** - Add 5 lbs when all sets completed in rep range (compounds)
- **`add_2.5lb`** - Add 2.5 lbs when all sets completed (isolation)
- **`reduce_assistance`** - Reduce assisted pullup weight by 10 lbs
- **`maintain`** - Keep same weight
- **`none`** - No progression tracking

## Workout Flow Example

```
User opens app on Tuesday
→ App suggests: "Reacher Build - Tuesday (Pull Day)"
→ User taps "Start Workout"

Exercise 1: External Rotations (Orange Band)
→ Display: "Set 1 of 2 | 12 reps | Orange Band (2-12 lbs)"
→ User completes, taps "Complete"
→ Rest timer: 60 seconds
→ Sound + haptic at 0:00
→ Auto-advance to Set 2

Exercise 5: Assisted Pull-ups (240 lb assistance)
→ Set 1-3: 3-5 reps at 240 lbs
→ Set 4: "FAILURE" (max reps)
→ If all sets completed in range: Next week reduces to 230 lbs

Exercise 6: Barbell Row (Progressive)
→ Last week: 135 lbs, completed all sets
→ This week: 140 lbs (added 5 lbs)
→ Display: "Add to bar: 1×45 + 1×2.5 per side (140 lbs total)"
→ Between sets shows: "⚠️ No weight change needed"

Workout Complete
→ Save all exercise data
→ Check for PRs
→ Show completion screen
→ Unlock screen (allow sleep)
```

## Data Flow

```
CSV File 
  ↓
CSVParser 
  ↓
Program object (stored in memory)
  ↓
WorkoutManager (selects today's workout)
  ↓
EquipmentCalculator (computes weights)
  ↓
WorkoutView (displays exercise)
  ↓
User completes set
  ↓
Core Data (save history)
  ↓
ProgressionCalculator (determine next week's weight)
```

## Testing with Sample Data

Both CSV files are production-ready:
- **Reacher Build**: 6 days × 4 weeks = 24 unique workouts
- **Daily Mobility**: 18 exercises, performed independently

Load these on first launch to demonstrate functionality.

## Questions to Resolve During Build

1. How should the app handle "week advancement"? 
   - Auto-advance after 6 workouts?
   - Manual "Start Week 2" button?
   - **Suggestion**: Manual with progress indicator

2. What if user can't complete all reps?
   - Mark set as "incomplete" → no progression next week
   - Record actual reps → weight stays same

3. Multiple programs same day?
   - Daily Mobility + Reacher Build on same day
   - Track separately, different completion times

4. Rest timer interruptions?
   - Phone call, notification, etc.
   - Pause timer, resume when returning to app

## Success Criteria

App is ready when:
- [ ] Can import both CSVs
- [ ] Correctly suggests workout based on day of week
- [ ] Calculates barbell plates accurately (within equipment constraints)
- [ ] Rest timer triggers sound and watch haptic
- [ ] Screen stays on during workout
- [ ] Records all sets to Core Data
- [ ] Shows progression graphs for exercises
- [ ] Detects and displays PRs
- [ ] Watch app mirrors phone state
- [ ] Can control workout from watch

---

**Ready for Claude Code implementation!**

All specs, data, and requirements are complete. Follow the implementation roadmap in `workout_tracker_spec.md` for step-by-step guidance.
