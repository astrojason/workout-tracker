import SwiftUI

struct ChecklistExerciseRow: View {
    let exercise: Exercise
    let setsCompleted: Int
    let isComplete: Bool
    let weight: Double
    let onTap: () -> Void
    let onSkip: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Completion indicator
                Image(systemName: isComplete ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(isComplete ? .green : .secondary)

                VStack(alignment: .leading, spacing: 3) {
                    Text(exercise.name)
                        .font(.headline)
                        .foregroundStyle(isComplete ? .secondary : .primary)

                    HStack(spacing: 8) {
                        if let timeDisplay = exercise.timeDisplay {
                            Label(timeDisplay, systemImage: "clock")
                                .font(.caption)
                                .foregroundStyle(.blue)
                        } else {
                            Text(exercise.repRangeDisplay)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        if exercise.isUnilateral {
                            Text("Each Side")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }
                    }

                    if let notes = exercise.notes, !notes.isEmpty {
                        Text(notes)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // Set progress
                Text("\(setsCompleted)/\(exercise.sets)")
                    .font(.subheadline.monospacedDigit().bold())
                    .foregroundStyle(isComplete ? .green : .secondary)
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 14)
            .background(isComplete ? Color.green.opacity(0.08) : Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .disabled(isComplete)
        .contextMenu {
            if !isComplete {
                Button(role: .destructive) {
                    onSkip()
                } label: {
                    Label("Skip Exercise", systemImage: "forward.fill")
                }
            }
        }
    }
}
