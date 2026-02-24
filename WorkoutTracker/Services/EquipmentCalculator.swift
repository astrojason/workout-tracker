import Foundation

struct PlateConfiguration {
    let targetWeight: Double
    let barWeight: Double
    let achievedWeight: Double
    let perSide: [(plate: Double, count: Int)]
    let isLandmine: Bool

    init(targetWeight: Double, barWeight: Double, achievedWeight: Double,
         perSide: [(plate: Double, count: Int)], isLandmine: Bool = false) {
        self.targetWeight = targetWeight
        self.barWeight = barWeight
        self.achievedWeight = achievedWeight
        self.perSide = perSide
        self.isLandmine = isLandmine
    }

    var displayString: String {
        if perSide.isEmpty {
            return "Bar only (\(barWeight.cleanWeight) lbs)"
        }
        let parts = perSide.map { "\($0.count)x\($0.plate.cleanWeight)" }
        return parts.joined(separator: " + ")
    }

    var fullDisplayString: String {
        if perSide.isEmpty {
            return "Bar only (\(barWeight.cleanWeight) lbs)"
        }
        let plateStr = displayString
        let label = isLandmine ? "One side" : "Each side"
        if achievedWeight != targetWeight {
            return "\(label): \(plateStr) (\(achievedWeight.cleanWeight) lbs total)"
        }
        return "\(label): \(plateStr) (\(achievedWeight.cleanWeight) lbs)"
    }

    var weightChanged: Bool {
        achievedWeight != targetWeight
    }
}

enum EquipmentDisplay {
    case barbell(PlateConfiguration)
    case powerblock(Double)
    case dumbbell(Double)
    case band(name: String, range: String)
    case bodyweight(detail: String?)
    case assisted(weight: Double, detail: String?)
    case kettlebell(Double)

    var text: String {
        switch self {
        case .barbell(let config):
            return config.fullDisplayString
        case .powerblock(let weight):
            return "PowerBlock: \(weight.cleanWeight) lbs"
        case .dumbbell(let weight):
            return "Dumbbell: \(weight.cleanWeight) lbs"
        case .band(let name, let range):
            return "\(name) Band (\(range))"
        case .bodyweight(let detail):
            if let detail, !detail.isEmpty {
                return detail
            }
            return "Bodyweight"
        case .assisted(let weight, let detail):
            if weight > 0 {
                if let detail {
                    return "\(detail) (~\(weight.cleanWeight) lb assistance)"
                }
                return "\(weight.cleanWeight) lb assistance"
            }
            return detail ?? "Assisted"
        case .kettlebell(let weight):
            return "Kettlebell: \(weight.cleanWeight) lbs"
        }
    }

    var shortText: String {
        switch self {
        case .barbell(let config):
            return "\(config.achievedWeight.cleanWeight) lbs"
        case .powerblock(let w), .dumbbell(let w), .kettlebell(let w):
            return "\(w.cleanWeight) lbs"
        case .band(let name, _):
            return "\(name) Band"
        case .bodyweight:
            return "BW"
        case .assisted(let weight, _):
            return weight > 0 ? "\(weight.cleanWeight) lb assist" : "Assisted"
        }
    }
}

struct EquipmentCalculator {
    // Available plates per side (weight, max count per side)
    var availablePlates: [(weight: Double, maxPerSide: Int)] = [
        (45, 1),
        (35, 1),
        (25, 2),
        (10, 2),
        (5, 1),
        (2.5, 1),
        (1, 1),
        (0.75, 1),
        (0.5, 1)
    ]

    static let bandInfo: [String: (name: String, range: String)] = [
        "Orange": (name: "Orange", range: "2-12 lbs"),
        "Purple": (name: "Purple", range: "5-35 lbs"),
        "Red": (name: "Red", range: "10-50 lbs"),
        "Blue": (name: "Blue", range: "20-80 lbs"),
    ]

    // MARK: - Barbell Plate Calculator

    func calculateBarbell(targetWeight: Double, barWeight: Double) -> PlateConfiguration {
        let perSideNeeded = (targetWeight - barWeight) / 2.0

        if perSideNeeded <= 0 {
            return PlateConfiguration(
                targetWeight: targetWeight,
                barWeight: barWeight,
                achievedWeight: barWeight,
                perSide: []
            )
        }

        // Try exact match first
        if let exact = findPlates(target: perSideNeeded) {
            let achieved = barWeight + exact.totalPerSide * 2
            return PlateConfiguration(
                targetWeight: targetWeight,
                barWeight: barWeight,
                achievedWeight: achieved,
                perSide: exact.plates
            )
        }

        // Round up: try incrementally higher weights until we find one
        var attempt = perSideNeeded
        let increment = 0.25 // smallest meaningful increment
        while attempt < perSideNeeded + 50 {
            attempt += increment
            if let found = findPlates(target: attempt) {
                let achieved = barWeight + found.totalPerSide * 2
                return PlateConfiguration(
                    targetWeight: targetWeight,
                    barWeight: barWeight,
                    achievedWeight: achieved,
                    perSide: found.plates
                )
            }
        }

        // Fallback: just the bar
        return PlateConfiguration(
            targetWeight: targetWeight,
            barWeight: barWeight,
            achievedWeight: barWeight,
            perSide: []
        )
    }

    private func findPlates(target: Double) -> (plates: [(plate: Double, count: Int)], totalPerSide: Double)? {
        var remaining = target
        var result: [(plate: Double, count: Int)] = []
        let epsilon = 0.001

        for plate in availablePlates {
            if remaining < plate.weight - epsilon { continue }

            let maxCount = min(plate.maxPerSide, Int(remaining / plate.weight))
            if maxCount > 0 {
                result.append((plate.weight, maxCount))
                remaining -= Double(maxCount) * plate.weight
            }
        }

        if abs(remaining) < epsilon {
            let total = result.reduce(0.0) { $0 + Double($1.count) * $1.plate }
            return (result, total)
        }

        return nil
    }

    func calculateLandmine(targetWeight: Double, barWeight: Double) -> PlateConfiguration {
        let oneSideNeeded = targetWeight - barWeight

        if oneSideNeeded <= 0 {
            return PlateConfiguration(targetWeight: targetWeight, barWeight: barWeight,
                                      achievedWeight: barWeight, perSide: [], isLandmine: true)
        }

        if let exact = findPlates(target: oneSideNeeded) {
            let achieved = barWeight + exact.totalPerSide
            return PlateConfiguration(targetWeight: targetWeight, barWeight: barWeight,
                                      achievedWeight: achieved, perSide: exact.plates, isLandmine: true)
        }

        var attempt = oneSideNeeded
        let increment = 0.25
        while attempt < oneSideNeeded + 50 {
            attempt += increment
            if let found = findPlates(target: attempt) {
                let achieved = barWeight + found.totalPerSide
                return PlateConfiguration(targetWeight: targetWeight, barWeight: barWeight,
                                          achievedWeight: achieved, perSide: found.plates, isLandmine: true)
            }
        }

        return PlateConfiguration(targetWeight: targetWeight, barWeight: barWeight,
                                  achievedWeight: barWeight, perSide: [], isLandmine: true)
    }

    private func isLandmine(_ exercise: Exercise) -> Bool {
        exercise.name.lowercased().contains("landmine")
    }

    // MARK: - PowerBlock Calculator

    func nearestPowerBlock(target: Double) -> Double {
        let clamped = max(5, min(50, target))
        return (clamped / 2.5).rounded() * 2.5
    }

    // MARK: - Equipment Display

    func display(for exercise: Exercise, weight: Double) -> EquipmentDisplay {
        switch exercise.equipmentType {
        case .barbell_45:
            let landmine45 = isLandmine(exercise)
            if weight <= 0 || weight <= 45 {
                return .barbell(PlateConfiguration(targetWeight: 45, barWeight: 45, achievedWeight: 45, perSide: [], isLandmine: landmine45))
            }
            return .barbell(landmine45 ? calculateLandmine(targetWeight: weight, barWeight: 45)
                                       : calculateBarbell(targetWeight: weight, barWeight: 45))

        case .barbell_35:
            let landmine35 = isLandmine(exercise)
            if weight <= 0 || weight <= 35 {
                return .barbell(PlateConfiguration(targetWeight: 35, barWeight: 35, achievedWeight: 35, perSide: [], isLandmine: landmine35))
            }
            return .barbell(landmine35 ? calculateLandmine(targetWeight: weight, barWeight: 35)
                                       : calculateBarbell(targetWeight: weight, barWeight: 35))

        case .barbell_ez:
            if weight <= 0 || weight <= 15 {
                return .barbell(PlateConfiguration(targetWeight: 15, barWeight: 15, achievedWeight: 15, perSide: []))
            }
            return .barbell(calculateBarbell(targetWeight: weight, barWeight: 15))

        case .powerblock:
            // Check if this is a regular dumbbell (below PowerBlock range)
            if let detail = exercise.equipmentDetail,
               let dbWeight = parseWeight(from: detail), dbWeight < 5 {
                return .dumbbell(dbWeight)
            }
            if weight > 0 && weight < 5 {
                return .dumbbell(weight)
            }
            return .powerblock(weight > 0 ? nearestPowerBlock(target: weight) : 0)

        case .band:
            let bandName = exercise.equipmentDetail ?? "Unknown"
            let info = Self.bandInfo[bandName]
            return .band(name: info?.name ?? bandName, range: info?.range ?? "")

        case .bodyweight:
            return .bodyweight(detail: exercise.equipmentDetail)

        case .assisted_pullup:
            return .assisted(weight: weight, detail: exercise.equipmentDetail)

        case .kettlebell:
            return .kettlebell(weight)
        }
    }

    /// Difference display between two exercises (for weight change alerts)
    func weightChangeDisplay(from previousWeight: Double, to currentWeight: Double, exercise: Exercise) -> String? {
        guard let barWeight = exercise.equipmentType.barWeight else { return nil }
        let landmine = isLandmine(exercise)
        let divisor = landmine ? 1.0 : 2.0
        let prevSide = (previousWeight - barWeight) / divisor
        let currSide = (currentWeight - barWeight) / divisor
        let diff = currSide - prevSide

        if abs(diff) < 0.001 { return nil }

        let sideLabel = landmine ? "one side" : "each side"
        if diff > 0 {
            return "ADD \(diff.cleanWeight) lbs to \(sideLabel)"
        } else {
            return "REMOVE \(abs(diff).cleanWeight) lbs from \(sideLabel)"
        }
    }

    private func parseWeight(from detail: String) -> Double? {
        let cleaned = detail.replacingOccurrences(of: "lb", with: "")
            .replacingOccurrences(of: "s", with: "")
            .trimmingCharacters(in: .whitespaces)
        return Double(cleaned)
    }
}

// MARK: - Double Extension

extension Double {
    var cleanWeight: String {
        if self == self.rounded() {
            return String(format: "%.0f", self)
        }
        // Remove trailing zeros but keep necessary decimals
        let formatted = String(format: "%.2f", self)
        var result = formatted
        while result.hasSuffix("0") { result.removeLast() }
        if result.hasSuffix(".") { result.removeLast() }
        return result
    }
}
