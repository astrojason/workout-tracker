import SwiftUI

struct ExerciseCardView: View {
    let exercise: Exercise
    let setNumber: Int
    let weight: Double
    let equipmentDisplay: EquipmentDisplay

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Exercise Name
            Text(exercise.name)
                .font(.system(size: 24, weight: .bold))

            // Set / Rep Info
            HStack(spacing: 16) {
                InfoBadge(
                    icon: "number",
                    label: "Set",
                    value: "\(setNumber) of \(exercise.sets)"
                )

                InfoBadge(
                    icon: "repeat",
                    label: "Reps",
                    value: exercise.repRangeDisplay
                )

                if exercise.restSeconds > 0 {
                    InfoBadge(
                        icon: "timer",
                        label: "Rest",
                        value: formatRestTime(exercise.restSeconds)
                    )
                }
            }

            // Equipment Display
            HStack(spacing: 8) {
                Image(systemName: equipmentIcon)
                    .font(.title3)
                    .foregroundStyle(.accentColor)

                VStack(alignment: .leading, spacing: 2) {
                    Text(equipmentDisplay.text)
                        .font(.headline)

                    if weight > 0 {
                        Text(equipmentDisplay.shortText)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.accentColor.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 12))

            // Unilateral indicator
            if exercise.isUnilateral {
                Label("Each Side", systemImage: "arrow.left.arrow.right")
                    .font(.subheadline.bold())
                    .foregroundStyle(.orange)
            }

            // Time-based display
            if let timeDisplay = exercise.timeDisplay {
                Label(timeDisplay, systemImage: "clock")
                    .font(.headline)
                    .foregroundStyle(.blue)
            }

            // Notes
            if let notes = exercise.notes, !notes.isEmpty {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "note.text")
                        .foregroundStyle(.secondary)
                    Text(notes)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.secondary.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            // Progression Rule
            if exercise.progressionRule != .none && exercise.progressionRule != .maintain {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.up.right")
                        .font(.caption)
                    Text("Progression: \(exercise.progressionRule.displayName)")
                        .font(.caption)
                }
                .foregroundStyle(.green)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var equipmentIcon: String {
        switch exercise.equipmentType {
        case .barbell_45, .barbell_35, .barbell_ez: return "figure.strengthtraining.traditional"
        case .powerblock: return "dumbbell.fill"
        case .band: return "circle.and.line.horizontal"
        case .kettlebell: return "figure.strengthtraining.functional"
        case .bodyweight: return "figure.walk"
        case .assisted_pullup: return "figure.climbing"
        }
    }

    private func formatRestTime(_ seconds: Int) -> String {
        if seconds >= 60 {
            let min = seconds / 60
            let sec = seconds % 60
            if sec == 0 { return "\(min)m" }
            return "\(min):\(String(format: "%02d", sec))"
        }
        return "\(seconds)s"
    }
}

struct InfoBadge: View {
    let icon: String
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.bold())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color.secondary.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
