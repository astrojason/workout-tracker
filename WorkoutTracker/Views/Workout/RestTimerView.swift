import SwiftUI

struct RestTimerView: View {
    @Environment(WorkoutManager.self) var manager

    var body: some View {
        guard let session = manager.session else { return AnyView(EmptyView()) }

        return AnyView(
            ZStack {
                Color.black.opacity(0.85)
                    .ignoresSafeArea()

                VStack(spacing: 32) {
                    Text("REST")
                        .font(.title3.bold())
                        .foregroundStyle(.secondary)

                    // Countdown Timer
                    Text(formatTime(session.restTimeRemaining))
                        .font(.system(size: 72, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white)
                        .contentTransition(.numericText())
                        .animation(.easeInOut(duration: 0.3), value: session.restTimeRemaining)

                    // Progress Ring
                    ZStack {
                        Circle()
                            .stroke(Color.white.opacity(0.2), lineWidth: 6)
                        Circle()
                            .trim(from: 0, to: timerProgress(session))
                            .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                            .animation(.linear(duration: 1), value: session.restTimeRemaining)
                    }
                    .frame(width: 120, height: 120)

                    // Next Exercise Preview
                    if !session.isLastExercise {
                        let setsRemaining = session.currentExercise.sets - session.setsCompletedForCurrentExercise
                        if setsRemaining > 0 {
                            nextPreview(
                                title: "Next Set",
                                subtitle: "\(session.currentExercise.name) - Set \(session.currentSetNumber + 1)"
                            )
                        } else {
                            let nextIndex = session.currentExerciseIndex + 1
                            if nextIndex < session.workout.exercises.count {
                                let next = session.workout.exercises[nextIndex]
                                let weight = session.resolvedWeights[next.id] ?? next.baseWeight.fixedValue ?? 0
                                nextPreview(
                                    title: "Up Next",
                                    subtitle: next.name,
                                    weight: weight > 0 ? "\(weight.cleanWeight) lbs" : nil
                                )
                            }
                        }
                    }

                    // Skip Button
                    Button {
                        manager.skipRest()
                    } label: {
                        Text("Skip Rest")
                            .font(.headline)
                            .padding(.horizontal, 32)
                            .padding(.vertical, 14)
                            .background(.ultraThinMaterial)
                            .clipShape(Capsule())
                    }
                    .foregroundStyle(.white)
                }
                .padding()
            }
        )
    }

    private func nextPreview(title: String, subtitle: String, weight: String? = nil) -> some View {
        VStack(spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(subtitle)
                .font(.headline)
                .foregroundStyle(.white)
            if let weight {
                Text(weight)
                    .font(.subheadline)
                    .foregroundStyle(.accentColor)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func formatTime(_ seconds: Int) -> String {
        let min = seconds / 60
        let sec = seconds % 60
        return String(format: "%d:%02d", min, sec)
    }

    private func timerProgress(_ session: WorkoutSession) -> CGFloat {
        let total = session.currentExercise.restSeconds
        guard total > 0 else { return 0 }
        return CGFloat(session.restTimeRemaining) / CGFloat(total)
    }
}
