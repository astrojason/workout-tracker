import Foundation

struct Program: Identifiable, Codable {
    let id: UUID
    let name: String
    let totalWeeks: Int
    var currentWeek: Int
    let workoutsByWeekAndDay: [Int: [String: Workout]]

    static let dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Daily"]

    func workout(week: Int, day: String) -> Workout? {
        workoutsByWeekAndDay[week]?[day]
    }

    var availableDays: [String] {
        guard let weekWorkouts = workoutsByWeekAndDay[1] else { return [] }
        return Self.dayOrder.filter { weekWorkouts[$0] != nil }
    }

    func todaysWorkout() -> Workout? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateFormat = "EEEE"
        let today = formatter.string(from: Date())

        if let workout = workout(week: currentWeek, day: today) {
            return workout
        }
        // Check for "Daily" programs
        return workout(week: 1, day: "Daily")
    }
}

struct Workout: Identifiable, Codable {
    let id: UUID
    let programName: String
    let week: Int
    let dayOfWeek: String
    let exercises: [Exercise]

    var phases: [Phase] {
        var seen = Set<Phase>()
        return exercises.compactMap { ex in
            if seen.contains(ex.phase) { return nil }
            seen.insert(ex.phase)
            return ex.phase
        }
    }

    func exercises(for phase: Phase) -> [Exercise] {
        exercises.filter { $0.phase == phase }
    }

    var totalSets: Int {
        exercises.reduce(0) { $0 + $1.sets }
    }

    var isChecklistDefault: Bool {
        dayOfWeek == "Daily"
    }

    var dayDisplayName: String {
        switch dayOfWeek {
        case "Monday": return "Monday (Push)"
        case "Tuesday": return "Tuesday (Pull)"
        case "Wednesday": return "Wednesday (Legs)"
        case "Thursday": return "Thursday (Conditioning)"
        case "Friday": return "Friday (Shoulders)"
        case "Saturday": return "Saturday (Pull + Arms)"
        case "Sunday": return "Sunday (Recovery)"
        default: return dayOfWeek
        }
    }
}
