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

// ProgressionRule is stored as a raw String to support free-form values
// (band color e.g. "Blue", band count e.g. "2 bands") alongside keyword rules.
struct ProgressionRule: RawRepresentable, Codable, Hashable, CustomStringConvertible {
    let rawValue: String

    init(rawValue: String) { self.rawValue = rawValue }
    init(_ value: String) { self.rawValue = value }

    // Known keyword constants
    static let add_5lb      = ProgressionRule("add_5lb")
    static let add_2_5lb    = ProgressionRule("add_2.5lb")
    static let add_10lb     = ProgressionRule("add_10lb")
    static let add_reps     = ProgressionRule("add_reps")
    static let add_time     = ProgressionRule("add_time")
    static let add_rounds   = ProgressionRule("add_rounds")
    static let maintain     = ProgressionRule("maintain")
    static let deload       = ProgressionRule("deload")
    static let progress_gripper = ProgressionRule("progress_gripper")
    static let none         = ProgressionRule("none")

    var description: String { rawValue }

    var weightIncrement: Double? {
        switch self {
        case .add_5lb:   return 5
        case .add_2_5lb: return 2.5
        case .add_10lb:  return 10
        default:         return nil
        }
    }

    var displayName: String {
        switch self {
        case .add_5lb:           return "+5 lb"
        case .add_2_5lb:         return "+2.5 lb"
        case .add_10lb:          return "+10 lb"
        case .add_reps:          return "+Reps"
        case .add_time:          return "+Time"
        case .add_rounds:        return "+Rounds"
        case .maintain:          return "Maintain"
        case .deload:            return "Deload"
        case .progress_gripper:  return "Progress gripper"
        case .none:              return "None"
        default:                 return rawValue // free-form (e.g. "Blue", "2 bands")
        }
    }
}

extension ProgressionRule: Equatable {
    static func == (lhs: ProgressionRule, rhs: ProgressionRule) -> Bool {
        lhs.rawValue == rhs.rawValue
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

// rest_after from XLSX: nil = use restSeconds; false = no rest timer; Int = override seconds
enum RestAfterSpec: Codable, Equatable {
    case noRest          // FALSE in XLSX
    case seconds(Int)    // explicit duration

    var effectiveSeconds: Int {
        switch self {
        case .noRest:       return 0
        case .seconds(let s): return s
        }
    }
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
    // XLSX-only fields
    let totalWeight: Double?        // seeds progressive starting weight if no history
    let lastSetAmrap: Bool          // final set is AMRAP regardless of repMax
    let restAfter: RestAfterSpec?   // nil = use restSeconds; .noRest = skip timer

    init(id: UUID = UUID(), order: Int, name: String, phase: Phase,
         equipmentType: EquipmentType, equipmentDetail: String? = nil,
         baseWeight: WeightSpec, sets: Int, repMin: Int, repMax: RepTarget,
         restSeconds: Int, progressionRule: ProgressionRule,
         isUnilateral: Bool, notes: String? = nil,
         totalWeight: Double? = nil, lastSetAmrap: Bool = false,
         restAfter: RestAfterSpec? = nil) {
        self.id = id
        self.order = order
        self.name = name
        self.phase = phase
        self.equipmentType = equipmentType
        self.equipmentDetail = equipmentDetail
        self.baseWeight = baseWeight
        self.sets = sets
        self.repMin = repMin
        self.repMax = repMax
        self.restSeconds = restSeconds
        self.progressionRule = progressionRule
        self.isUnilateral = isUnilateral
        self.notes = notes
        self.totalWeight = totalWeight
        self.lastSetAmrap = lastSetAmrap
        self.restAfter = restAfter
    }

    /// Effective rest duration: restAfter overrides restSeconds when present
    var effectiveRestSeconds: Int {
        restAfter?.effectiveSeconds ?? restSeconds
    }

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

    /// True when the user is about to perform the last set and lastSetAmrap is active
    func isAmrapSet(currentSetNumber: Int) -> Bool {
        lastSetAmrap && currentSetNumber == sets
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
