import Foundation

// MARK: - Enums

enum Phase: String, Codable, CaseIterable, Identifiable {
    case warmup, main, finisher, cooldown, mobility

    var id: String { rawValue }

    var displayName: String {
        rawValue.capitalized
    }

    var color: String {
        switch self {
        case .warmup: return "orange"
        case .main: return "blue"
        case .finisher: return "purple"
        case .cooldown: return "teal"
        case .mobility: return "green"
        }
    }
}

enum EquipmentType: String, Codable, CaseIterable {
    case barbell_45, barbell_35, barbell_ez
    case powerblock, band, kettlebell
    case bodyweight, assisted_pullup

    var barWeight: Double? {
        switch self {
        case .barbell_45: return 45
        case .barbell_35: return 35
        case .barbell_ez: return 15
        default: return nil
        }
    }

    var displayName: String {
        switch self {
        case .barbell_45: return "Barbell (45 lb)"
        case .barbell_35: return "Barbell (35 lb)"
        case .barbell_ez: return "EZ Bar (15 lb)"
        case .powerblock: return "PowerBlock"
        case .band: return "Band"
        case .kettlebell: return "Kettlebell"
        case .bodyweight: return "Bodyweight"
        case .assisted_pullup: return "Assisted Pull-up"
        }
    }
}

enum ProgressionRule: String, Codable, CaseIterable {
    case add_5lb
    case add_2_5lb = "add_2.5lb"
    case add_10lb
    case reduce_assistance
    case maintain
    case deload
    case none
    case add_reps
    case add_time
    case progress_gripper

    var weightIncrement: Double? {
        switch self {
        case .add_5lb: return 5
        case .add_2_5lb: return 2.5
        case .add_10lb: return 10
        default: return nil
        }
    }

    var displayName: String {
        switch self {
        case .add_5lb: return "+5 lb"
        case .add_2_5lb: return "+2.5 lb"
        case .add_10lb: return "+10 lb"
        case .reduce_assistance: return "Reduce assistance"
        case .maintain: return "Maintain"
        case .deload: return "Deload"
        case .none: return "None"
        case .add_reps: return "+Reps"
        case .add_time: return "+Time"
        case .progress_gripper: return "Progress gripper"
        }
    }
}

// MARK: - Weight Spec

enum WeightSpec: Codable, Equatable {
    case fixed(Double)
    case progressive

    init(csvValue: String) {
        let trimmed = csvValue.trimmingCharacters(in: .whitespaces)
        if trimmed.lowercased() == "progressive" {
            self = .progressive
        } else {
            self = .fixed(Double(trimmed) ?? 0)
        }
    }

    var isProgressive: Bool {
        if case .progressive = self { return true }
        return false
    }

    var fixedValue: Double? {
        if case .fixed(let v) = self { return v }
        return nil
    }
}

// MARK: - Rep Target

enum RepTarget: Codable, Equatable {
    case count(Int)
    case failure

    init(csvValue: String) {
        let trimmed = csvValue.trimmingCharacters(in: .whitespaces).lowercased()
        if trimmed == "failure" {
            self = .failure
        } else {
            self = .count(Int(trimmed) ?? 0)
        }
    }

    var displayString: String {
        switch self {
        case .count(let n): return "\(n)"
        case .failure: return "Failure"
        }
    }

    var numericValue: Int? {
        if case .count(let n) = self { return n }
        return nil
    }
}

// MARK: - Exercise

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

    var repRangeDisplay: String {
        let maxStr = repMax.displayString
        if repMin == repMax.numericValue ?? -1 {
            return "\(repMin) reps"
        }
        if case .failure = repMax {
            return "To Failure"
        }
        return "\(repMin)-\(maxStr) reps"
    }

    var isTimeBased: Bool {
        repMin >= 30 && progressionRule == .add_time
    }

    var timeDisplay: String? {
        guard isTimeBased || repMin >= 60 else { return nil }
        let min = repMin / 60
        let sec = repMin % 60
        if min > 0 && sec > 0 {
            return "\(min)m \(sec)s"
        } else if min > 0 {
            return "\(min) min"
        } else {
            return "\(sec)s"
        }
    }
}
