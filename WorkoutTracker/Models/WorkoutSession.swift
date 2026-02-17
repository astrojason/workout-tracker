import Foundation
import SwiftUI

@Observable
class WorkoutSession: Identifiable {
    let id = UUID()
    let workout: Workout
    let resolvedWeights: [UUID: Double] // exerciseID -> resolved weight

    var currentExerciseIndex: Int = 0
    var currentSetNumber: Int = 1
    var completedSets: [CompletedSet] = []
    var isResting: Bool = false
    var restTimeRemaining: Int = 0
    var restEndDate: Date?
    var isActive: Bool = true
    var startTime: Date = Date()
    var prsAchieved: [PersonalRecord] = []
    var showingSetCompletion: Bool = false
    var isChecklistMode: Bool = false
    var checklistExerciseIndex: Int?

    init(workout: Workout, resolvedWeights: [UUID: Double] = [:]) {
        self.workout = workout
        self.resolvedWeights = resolvedWeights
        self.isChecklistMode = workout.isChecklistDefault
    }

    var currentExercise: Exercise {
        workout.exercises[currentExerciseIndex]
    }

    var totalExercises: Int {
        workout.exercises.count
    }

    var progress: Double {
        guard totalExercises > 0 else { return 0 }
        if isChecklistMode {
            return Double(completedExerciseCount) / Double(totalExercises)
        }
        return Double(currentExerciseIndex) / Double(totalExercises)
    }

    var currentWeight: Double {
        resolvedWeights[currentExercise.id] ?? currentExercise.baseWeight.fixedValue ?? 0
    }

    func setsCompleted(for exercise: Exercise) -> Int {
        completedSets.filter { $0.exerciseOrder == exercise.order }.count
    }

    func isExerciseComplete(_ exercise: Exercise) -> Bool {
        setsCompleted(for: exercise) >= exercise.sets
    }

    var completedExerciseCount: Int {
        workout.exercises.filter { isExerciseComplete($0) }.count
    }

    var checklistExercise: Exercise? {
        guard let index = checklistExerciseIndex,
              index < workout.exercises.count else { return nil }
        return workout.exercises[index]
    }

    func checklistWeight(for exercise: Exercise) -> Double {
        resolvedWeights[exercise.id] ?? exercise.baseWeight.fixedValue ?? 0
    }

    var setsCompletedForCurrentExercise: Int {
        completedSets.filter { $0.exerciseOrder == currentExercise.order }.count
    }

    var setsRemainingForCurrentExercise: Int {
        currentExercise.sets - setsCompletedForCurrentExercise
    }

    var isLastSetOfExercise: Bool {
        setsRemainingForCurrentExercise <= 1
    }

    var isLastExercise: Bool {
        currentExerciseIndex >= totalExercises - 1
    }

    var elapsedTime: TimeInterval {
        Date().timeIntervalSince(startTime)
    }

    var elapsedTimeFormatted: String {
        let total = Int(elapsedTime)
        let minutes = total / 60
        let seconds = total % 60
        return String(format: "%d:%02d", minutes, seconds)
    }

    func advanceToNextSet() {
        if setsRemainingForCurrentExercise > 0 {
            currentSetNumber += 1
        } else {
            advanceToNextExercise()
        }
    }

    func advanceToNextExercise() {
        guard currentExerciseIndex < totalExercises - 1 else {
            isActive = false
            return
        }
        currentExerciseIndex += 1
        currentSetNumber = 1
    }
}

struct CompletedSet: Codable, Identifiable {
    let id: UUID
    let exerciseName: String
    let exerciseOrder: Int
    let setNumber: Int
    let targetWeight: Double
    let actualWeight: Double
    let targetReps: Int
    let actualReps: Int
    let completed: Bool
    let timestamp: Date
    let notes: String?

    init(
        exerciseName: String,
        exerciseOrder: Int,
        setNumber: Int,
        targetWeight: Double,
        actualWeight: Double,
        targetReps: Int,
        actualReps: Int,
        completed: Bool = true,
        notes: String? = nil
    ) {
        self.id = UUID()
        self.exerciseName = exerciseName
        self.exerciseOrder = exerciseOrder
        self.setNumber = setNumber
        self.targetWeight = targetWeight
        self.actualWeight = actualWeight
        self.targetReps = targetReps
        self.actualReps = actualReps
        self.completed = completed
        self.timestamp = Date()
        self.notes = notes
    }
}

struct PersonalRecord: Identifiable {
    let id = UUID()
    let exerciseName: String
    let type: PRType
    let value: Double
    let previousBest: Double?

    enum PRType: String {
        case weight = "Weight"
        case estimatedOneRM = "Est. 1RM"
        case volume = "Volume"
    }
}
