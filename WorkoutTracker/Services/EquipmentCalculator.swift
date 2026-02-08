import Foundation

struct PlateConfiguration {
    let targetWeight: Double
    let barWeight: Double
    let achievedWeight: Double
    let perSide: [(plate: Double, count: Int)]

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
        if achievedWeight != targetWeight {
            return "Each side: \(plateStr) (\(achievedWeight.cleanWeight) lbs total)"
        }
        return "Each side: \(plateStr) (\(achievedWeight.cleanWeight) lbs)"
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

    // MARK: - PowerBlock Calculator

    func nearestPowerBlock(target: Double) -> Double {
        let clamped = max(5, min(50, target))
        return (clamped / 2.5).rounded() * 2.5
    }

    // MARK: - Equipment Display

    func display(for exercise: Exercise, weight: Double) -> EquipmentDisplay {
        switch exercise.equipmentType {
        case .barbell_45:
            if weight <= 0 || weight <= 45 {
                return .barbell(PlateConfiguration(targetWeight: 45, barWeight: 45, achievedWeight: 45, perSide: []))
            }
            return .barbell(calculateBarbell(targetWeight: weight, barWeight: 45))

        case .barbell_35:
            if weight <= 0 || weight <= 35 {
                return .barbell(PlateConfiguration(targetWeight: 35, barWeight: 35, achievedWeight: 35, perSide: []))
            }
            return .barbell(calculateBarbell(targetWeight: weight, barWeight: 35))

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
        let prevPerSide = (previousWeight - barWeight) / 2.0
        let currPerSide = (currentWeight - barWeight) / 2.0
        let diff = currPerSide - prevPerSide

        if abs(diff) < 0.001 { return nil }

        if diff > 0 {
            return "ADD \(diff.cleanWeight) lbs to each side"
        } else {
            return "REMOVE \(abs(diff).cleanWeight) lbs from each side"
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
