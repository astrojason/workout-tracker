import Foundation

struct ProgressionService {
    let calculator: EquipmentCalculator
    let coreData: CoreDataStack

    init(calculator: EquipmentCalculator = EquipmentCalculator(), coreData: CoreDataStack = .shared) {
        self.calculator = calculator
        self.coreData = coreData
    }

    /// Calculate the effective weight for an exercise, considering progression history
    func resolveWeight(for exercise: Exercise) -> Double {
        switch exercise.baseWeight {
        case .fixed(let weight):
            return weight

        case .progressive:
            return calculateProgressiveWeight(for: exercise)
        }
    }

    /// Check last completed session and apply progression rule if appropriate
    private func calculateProgressiveWeight(for exercise: Exercise) -> Double {
        let lastSets = coreData.fetchLastSetsForExercise(name: exercise.name)

        guard !lastSets.isEmpty else {
            // No history - return 0 to trigger first-time weight prompt
            return 0
        }

        let lastWeight = lastSets.first.flatMap { $0.value(forKey: "actualWeight") as? Double } ?? 0
        let allCompleted = checkAllSetsCompleted(lastSets, exercise: exercise)

        guard allCompleted else {
            return lastWeight // Keep same weight if didn't complete all sets
        }

        // Apply progression rule
        return applyProgression(currentWeight: lastWeight, exercise: exercise)
    }

    /// Check if all sets from last session were completed within rep range
    private func checkAllSetsCompleted(_ sets: [NSObject], exercise: Exercise) -> Bool {
        for set in sets {
            let completed = set.value(forKey: "completed") as? Bool ?? false
            let actualReps = set.value(forKey: "actualReps") as? Int16 ?? 0

            if !completed { return false }
            if actualReps < exercise.repMin { return false }

            // If repMax is a count, check upper bound too
            if let maxReps = exercise.repMax.numericValue {
                // We don't penalize for exceeding max reps
                _ = maxReps
            }
        }
        return true
    }

    /// Apply the progression rule to get the new target weight
    func applyProgression(currentWeight: Double, exercise: Exercise) -> Double {
        guard let increment = exercise.progressionRule.weightIncrement else {
            switch exercise.progressionRule {
            case .reduce_assistance:
                return max(0, currentWeight - 10)
            case .maintain, .none, .deload, .add_reps, .add_time, .progress_gripper:
                return currentWeight
            default:
                return currentWeight
            }
        }

        let newWeight = currentWeight + increment
        return adjustForEquipment(newWeight, exercise: exercise)
    }

    /// Ensure the weight is achievable with available equipment
    private func adjustForEquipment(_ target: Double, exercise: Exercise) -> Double {
        if let barWeight = exercise.equipmentType.barWeight {
            let config = calculator.calculateBarbell(targetWeight: target, barWeight: barWeight)
            return config.achievedWeight
        }

        if exercise.equipmentType == .powerblock {
            return calculator.nearestPowerBlock(target: target)
        }

        return target
    }
}
