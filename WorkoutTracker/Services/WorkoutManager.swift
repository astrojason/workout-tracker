import Foundation
import SwiftUI
import Combine

@Observable
class WorkoutManager {
    var programs: [Program] = []
    var session: WorkoutSession?
    var isWorkoutActive: Bool { session?.isActive ?? false }

    // Settings
    var defaultRestSeconds: Int {
        get { UserDefaults.standard.integer(forKey: "defaultRestSeconds").nonZero ?? 120 }
        set { UserDefaults.standard.set(newValue, forKey: "defaultRestSeconds") }
    }
    var soundEnabled: Bool {
        get { UserDefaults.standard.object(forKey: "soundEnabled") as? Bool ?? true }
        set {
            UserDefaults.standard.set(newValue, forKey: "soundEnabled")
            SoundManager.shared.soundEnabled = newValue
        }
    }

    let calculator = EquipmentCalculator()
    let coreData = CoreDataStack.shared
    private var timer: Timer?
    private var progressionService: ProgressionService {
        ProgressionService(calculator: calculator, coreData: coreData)
    }

    // MARK: - Program Management

    func loadPrograms() {
        programs = CSVParser.loadBundled()
        loadSavedWeeks()
    }

    func importProgram(from url: URL) throws {
        let newPrograms = try CSVParser.loadFromURL(url)
        for program in newPrograms {
            if let existing = programs.firstIndex(where: { $0.name == program.name }) {
                programs[existing] = program
            } else {
                programs.append(program)
            }
        }
    }

    // MARK: - Week Management

    func setCurrentWeek(_ week: Int, for programName: String) {
        guard let index = programs.firstIndex(where: { $0.name == programName }) else { return }
        programs[index].currentWeek = min(week, programs[index].totalWeeks)
        UserDefaults.standard.set(programs[index].currentWeek, forKey: "week_\(programName)")
    }

    private func loadSavedWeeks() {
        for i in programs.indices {
            let saved = UserDefaults.standard.integer(forKey: "week_\(programs[i].name)")
            if saved > 0 {
                programs[i].currentWeek = min(saved, programs[i].totalWeeks)
            }
        }
    }

    // MARK: - Workout Suggestions

    func suggestedWorkouts() -> [(program: Program, workout: Workout)] {
        var suggestions: [(Program, Workout)] = []
        for program in programs {
            if let workout = program.todaysWorkout() {
                suggestions.append((program, workout))
            }
        }
        return suggestions
    }

    func completedDays(for program: Program) -> Set<String> {
        coreData.fetchCompletedDays(programName: program.name, week: program.currentWeek)
    }

    // MARK: - Start Workout

    func startWorkout(_ workout: Workout) {
        // Resolve all progressive weights
        var resolvedWeights: [UUID: Double] = [:]
        for exercise in workout.exercises {
            let weight = progressionService.resolveWeight(for: exercise)
            resolvedWeights[exercise.id] = weight
        }

        session = WorkoutSession(workout: workout, resolvedWeights: resolvedWeights)
        UIApplication.shared.isIdleTimerDisabled = true
        SoundManager.shared.configureAudioSession()
    }

    // MARK: - Set Completion

    func completeSet(actualReps: Int, actualWeight: Double, failed: Bool, notes: String?) {
        guard let session else { return }

        let exercise = session.currentExercise
        let targetReps = exercise.repMax.numericValue ?? exercise.repMin

        let completed = CompletedSet(
            exerciseName: exercise.name,
            exerciseOrder: exercise.order,
            setNumber: session.currentSetNumber,
            targetWeight: session.currentWeight,
            actualWeight: actualWeight,
            targetReps: targetReps,
            actualReps: actualReps,
            completed: !failed,
            notes: notes
        )

        session.completedSets.append(completed)
        session.showingSetCompletion = false

        SoundManager.shared.playSetComplete()

        // Check if more sets remain for this exercise
        let setsRemaining = exercise.sets - session.setsCompletedForCurrentExercise

        if setsRemaining > 0 {
            // More sets of same exercise - start rest timer
            if exercise.restSeconds > 0 {
                startRestTimer(seconds: exercise.restSeconds)
            } else {
                session.currentSetNumber += 1
            }
        } else if !session.isLastExercise {
            // Move to next exercise
            let currentRest = exercise.restSeconds
            if currentRest > 0 {
                startRestTimer(seconds: currentRest)
            } else {
                session.advanceToNextExercise()
            }
        } else {
            // Workout complete
            endWorkout()
        }
    }

    // MARK: - Checklist Mode

    func completeChecklistSet(exercise: Exercise, actualReps: Int, actualWeight: Double, failed: Bool, notes: String?) {
        guard let session else { return }

        let setsAlreadyDone = session.setsCompleted(for: exercise)
        let setNumber = setsAlreadyDone + 1
        let targetReps = exercise.repMax.numericValue ?? exercise.repMin
        let weight = session.checklistWeight(for: exercise)

        let completed = CompletedSet(
            exerciseName: exercise.name,
            exerciseOrder: exercise.order,
            setNumber: setNumber,
            targetWeight: weight,
            actualWeight: actualWeight,
            targetReps: targetReps,
            actualReps: actualReps,
            completed: !failed,
            notes: notes
        )

        session.completedSets.append(completed)
        session.showingSetCompletion = false
        session.checklistExerciseIndex = nil

        SoundManager.shared.playSetComplete()

        // Auto-end if all exercises complete
        if session.completedExerciseCount >= session.totalExercises {
            endWorkout()
        }
    }

    func skipChecklistExercise(_ exercise: Exercise) {
        guard let session else { return }

        let setsAlreadyDone = session.setsCompleted(for: exercise)
        let targetReps = exercise.repMax.numericValue ?? exercise.repMin
        let weight = session.checklistWeight(for: exercise)

        for setNum in (setsAlreadyDone + 1)...exercise.sets {
            let skipped = CompletedSet(
                exerciseName: exercise.name,
                exerciseOrder: exercise.order,
                setNumber: setNum,
                targetWeight: weight,
                actualWeight: 0,
                targetReps: targetReps,
                actualReps: 0,
                completed: false,
                notes: "Skipped"
            )
            session.completedSets.append(skipped)
        }

        if session.completedExerciseCount >= session.totalExercises {
            endWorkout()
        }
    }

    func skipSet() {
        guard let session else { return }

        let exercise = session.currentExercise
        let targetReps = exercise.repMax.numericValue ?? exercise.repMin

        let skipped = CompletedSet(
            exerciseName: exercise.name,
            exerciseOrder: exercise.order,
            setNumber: session.currentSetNumber,
            targetWeight: session.currentWeight,
            actualWeight: 0,
            targetReps: targetReps,
            actualReps: 0,
            completed: false,
            notes: "Skipped"
        )

        session.completedSets.append(skipped)

        let setsRemaining = exercise.sets - session.setsCompletedForCurrentExercise
        if setsRemaining > 0 {
            session.currentSetNumber += 1
        } else {
            session.advanceToNextExercise()
        }
    }

    // MARK: - Rest Timer

    func startRestTimer(seconds: Int) {
        guard let session else { return }

        session.isResting = true
        session.restTimeRemaining = seconds
        session.restEndDate = Date().addingTimeInterval(TimeInterval(seconds))

        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.timerTick()
        }
    }

    private func timerTick() {
        guard let session else {
            timer?.invalidate()
            return
        }

        if let endDate = session.restEndDate {
            let remaining = Int(endDate.timeIntervalSinceNow)
            session.restTimeRemaining = max(0, remaining)

            if remaining <= 0 {
                timerComplete()
            }
        }
    }

    private func timerComplete() {
        timer?.invalidate()
        timer = nil

        SoundManager.shared.playTimerComplete()

        guard let session else { return }
        session.isResting = false
        session.restEndDate = nil

        // Advance to next set or exercise
        let setsRemaining = session.currentExercise.sets - session.setsCompletedForCurrentExercise
        if setsRemaining > 0 {
            session.currentSetNumber += 1
        } else {
            session.advanceToNextExercise()
        }
    }

    func skipRest() {
        timer?.invalidate()
        timer = nil

        guard let session else { return }
        session.isResting = false
        session.restEndDate = nil

        let setsRemaining = session.currentExercise.sets - session.setsCompletedForCurrentExercise
        if setsRemaining > 0 {
            session.currentSetNumber += 1
        } else {
            session.advanceToNextExercise()
        }
    }

    // MARK: - End Workout

    func endWorkout() {
        guard let session else { return }

        let duration = Int(session.elapsedTime)

        // Check for PRs
        let exerciseNames = Set(session.completedSets.map { $0.exerciseName })
        var allPRs: [PersonalRecord] = []
        for name in exerciseNames {
            let setsForExercise = session.completedSets.filter { $0.exerciseName == name }
            let prs = PRDetector.checkForPRs(exerciseName: name, newSets: setsForExercise)
            allPRs.append(contentsOf: prs)
        }
        session.prsAchieved = allPRs

        // Save to Core Data
        coreData.saveWorkoutSession(
            programName: session.workout.programName,
            week: session.workout.week,
            dayOfWeek: session.workout.dayOfWeek,
            completed: true,
            durationSeconds: duration,
            sets: session.completedSets
        )

        session.isActive = false
        UIApplication.shared.isIdleTimerDisabled = false
    }

    func dismissWorkout() {
        timer?.invalidate()
        timer = nil
        session = nil
        UIApplication.shared.isIdleTimerDisabled = false
    }

    // MARK: - Equipment Display

    func equipmentDisplay(for exercise: Exercise) -> EquipmentDisplay {
        let weight = session?.resolvedWeights[exercise.id] ?? exercise.baseWeight.fixedValue ?? 0
        return calculator.display(for: exercise, weight: weight)
    }
}

// MARK: - Helpers

private extension Int {
    var nonZero: Int? {
        self == 0 ? nil : self
    }
}
