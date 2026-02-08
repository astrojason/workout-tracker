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

        let exercise = session.currentExercise

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

                    if session.currentWeight > 0 {
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
                .navigationTitle("Set \(session.currentSetNumber)")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            manager.completeSet(
                                actualReps: actualReps,
                                actualWeight: actualWeight,
                                failed: failed,
                                notes: notes.isEmpty ? nil : notes
                            )
                            dismiss()
                        }
                        .bold()
                    }
                }
                .onAppear {
                    actualReps = exercise.repMax.numericValue ?? exercise.repMin
                    actualWeight = session.currentWeight
                }
            }
            .presentationDetents([.medium])
        )
    }
}
