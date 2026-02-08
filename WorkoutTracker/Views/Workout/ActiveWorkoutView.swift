import SwiftUI

struct ActiveWorkoutView: View {
    @Environment(WorkoutManager.self) var manager
    @Environment(\.scenePhase) var scenePhase
    @State private var showingEndConfirmation = false

    var body: some View {
        guard let session = manager.session else { return AnyView(EmptyView()) }

        return AnyView(
            ZStack {
                VStack(spacing: 0) {
                    // Header
                    workoutHeader(session)

                    // Progress Bar
                    progressBar(session)

                    // Exercise Card
                    ScrollView {
                        ExerciseCardView(
                            exercise: session.currentExercise,
                            setNumber: session.currentSetNumber,
                            weight: session.currentWeight,
                            equipmentDisplay: manager.equipmentDisplay(for: session.currentExercise)
                        )
                        .padding()
                    }

                    Spacer()

                    // Action Buttons
                    actionButtons(session)
                }

                // Rest Timer Overlay
                if session.isResting {
                    RestTimerView()
                }
            }
            .background(Color(.systemBackground))
            .alert("End Workout?", isPresented: $showingEndConfirmation) {
                Button("End Workout", role: .destructive) {
                    manager.endWorkout()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Your progress will be saved.")
            }
            .sheet(isPresented: Binding(
                get: { session.showingSetCompletion },
                set: { session.showingSetCompletion = $0 }
            )) {
                SetCompletionSheet()
            }
            .statusBarHidden(false)
        )
    }

    // MARK: - Header

    private func workoutHeader(_ session: WorkoutSession) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(session.workout.programName)
                    .font(.headline)
                Text(session.workout.dayOfWeek)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Phase Badge
            Text(session.currentExercise.phase.displayName)
                .font(.caption.bold())
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(phaseColor(session.currentExercise.phase))
                .foregroundStyle(.white)
                .clipShape(Capsule())

            // Timer
            Text(session.elapsedTimeFormatted)
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.secondary)
        }
        .padding()
    }

    // MARK: - Progress Bar

    private func progressBar(_ session: WorkoutSession) -> some View {
        VStack(spacing: 4) {
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Color.secondary.opacity(0.2))
                        .frame(height: 4)

                    Rectangle()
                        .fill(Color.accentColor)
                        .frame(width: geometry.size.width * session.progress, height: 4)
                        .animation(.easeInOut, value: session.progress)
                }
            }
            .frame(height: 4)

            Text("Exercise \(session.currentExerciseIndex + 1) of \(session.totalExercises)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal)
    }

    // MARK: - Action Buttons

    private func actionButtons(_ session: WorkoutSession) -> some View {
        VStack(spacing: 12) {
            // Screen lock indicator
            HStack(spacing: 4) {
                Image(systemName: "lock.open.fill")
                    .font(.caption2)
                Text("Screen lock disabled")
                    .font(.caption2)
            }
            .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                // Skip Set
                Button {
                    manager.skipSet()
                } label: {
                    Text("Skip")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 60)
                        .background(Color.secondary.opacity(0.2))
                        .foregroundStyle(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }

                // Complete Set
                Button {
                    session.showingSetCompletion = true
                } label: {
                    Text("Complete Set")
                        .font(.headline.bold())
                        .frame(maxWidth: .infinity)
                        .frame(height: 60)
                        .background(Color.green)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
            }

            // End Workout
            Button {
                showingEndConfirmation = true
            } label: {
                Text("End Workout")
                    .font(.subheadline)
                    .foregroundStyle(.red)
            }
        }
        .padding()
    }

    private func phaseColor(_ phase: Phase) -> Color {
        switch phase {
        case .warmup: return .orange
        case .main: return .blue
        case .finisher: return .purple
        case .cooldown: return .teal
        case .mobility: return .green
        }
    }
}
