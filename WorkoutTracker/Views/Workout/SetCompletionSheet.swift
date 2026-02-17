import SwiftUI

struct SetCompletionSheet: View {
    @Environment(WorkoutManager.self) var manager
    @Environment(\.dismiss) var dismiss
    @State private var actualReps: Int = 0
    @State private var actualWeight: Double = 0
    @State private var failed: Bool = false
    @State private var notes: String = ""

    var body: some View {
        guard let session = manager.session else { return AnyView(EmptyView()) }

        let exercise = session.isChecklistMode
            ? (session.checklistExercise ?? session.currentExercise)
            : session.currentExercise
        let weight = session.isChecklistMode
            ? session.checklistWeight(for: exercise)
            : session.currentWeight
        let setNumber = session.isChecklistMode
            ? session.setsCompleted(for: exercise) + 1
            : session.currentSetNumber

        return AnyView(
            NavigationStack {
                Form {
                    Section("Reps Completed") {
                        Stepper(value: $actualReps, in: 0...100) {
                            HStack {
                                Text("Reps:")
                                Spacer()
                                Text("\(actualReps)")
                                    .font(.title2.bold().monospacedDigit())
                            }
                        }
                    }

                    if weight > 0 {
                        Section("Weight Used") {
                            HStack {
                                Text("Weight:")
                                Spacer()
                                TextField("lbs", value: $actualWeight, format: .number)
                                    .keyboardType(.decimalPad)
                                    .multilineTextAlignment(.trailing)
                                    .font(.title2.bold())
                                    .frame(width: 100)
                                Text("lbs")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    Section {
                        Toggle("Failed Set", isOn: $failed)
                            .tint(.red)
                    }

                    Section("Notes (optional)") {
                        TextField("How did it feel?", text: $notes)
                    }
                }
                .navigationTitle(session.isChecklistMode
                    ? "\(exercise.name) - Set \(setNumber)"
                    : "Set \(setNumber)")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            session.checklistExerciseIndex = nil
                            dismiss()
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            if session.isChecklistMode {
                                manager.completeChecklistSet(
                                    exercise: exercise,
                                    actualReps: actualReps,
                                    actualWeight: actualWeight,
                                    failed: failed,
                                    notes: notes.isEmpty ? nil : notes
                                )
                            } else {
                                manager.completeSet(
                                    actualReps: actualReps,
                                    actualWeight: actualWeight,
                                    failed: failed,
                                    notes: notes.isEmpty ? nil : notes
                                )
                            }
                            dismiss()
                        }
                        .bold()
                    }
                }
                .onAppear {
                    actualReps = exercise.repMax.numericValue ?? exercise.repMin
                    actualWeight = weight
                }
            }
            .presentationDetents([.medium])
        )
    }
}
