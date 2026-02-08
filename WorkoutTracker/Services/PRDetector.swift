import Foundation

struct PRDetector {
    static func checkForPRs(
        exerciseName: String,
        newSets: [CompletedSet],
        coreData: CoreDataStack = .shared
    ) -> [PersonalRecord] {
        var prs: [PersonalRecord] = []

        // Only check exercises with weight
        let weightedSets = newSets.filter { $0.actualWeight > 0 && $0.completed }
        guard !weightedSets.isEmpty else { return prs }

        // 1. Max weight PR
        if let maxWeight = weightedSets.map({ $0.actualWeight }).max() {
            let previousBest = coreData.fetchPR(exerciseName: exerciseName, type: "weight")
            if previousBest == nil || maxWeight > previousBest! {
                prs.append(PersonalRecord(
                    exerciseName: exerciseName,
                    type: .weight,
                    value: maxWeight,
                    previousBest: previousBest
                ))
                coreData.savePR(exerciseName: exerciseName, type: "weight", value: maxWeight)
            }
        }

        // 2. Estimated 1RM PR (Epley formula: weight * (1 + reps/30))
        let best1RM = weightedSets.map { set -> Double in
            if set.actualReps == 1 { return set.actualWeight }
            return set.actualWeight * (1.0 + Double(set.actualReps) / 30.0)
        }.max() ?? 0

        if best1RM > 0 {
            let previousBest = coreData.fetchPR(exerciseName: exerciseName, type: "estimated1RM")
            if previousBest == nil || best1RM > previousBest! {
                prs.append(PersonalRecord(
                    exerciseName: exerciseName,
                    type: .estimatedOneRM,
                    value: best1RM,
                    previousBest: previousBest
                ))
                coreData.savePR(exerciseName: exerciseName, type: "estimated1RM", value: best1RM)
            }
        }

        // 3. Volume PR (total weight x reps for this exercise in one session)
        let totalVolume = weightedSets.reduce(0.0) { $0 + $1.actualWeight * Double($1.actualReps) }
        if totalVolume > 0 {
            let previousBest = coreData.fetchPR(exerciseName: exerciseName, type: "volume")
            if previousBest == nil || totalVolume > previousBest! {
                prs.append(PersonalRecord(
                    exerciseName: exerciseName,
                    type: .volume,
                    value: totalVolume,
                    previousBest: previousBest
                ))
                coreData.savePR(exerciseName: exerciseName, type: "volume", value: totalVolume)
            }
        }

        return prs
    }
}
