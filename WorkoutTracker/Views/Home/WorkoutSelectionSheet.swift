import SwiftUI

struct WorkoutSelectionSheet: View {
    @Environment(WorkoutManager.self) var manager
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(manager.programs) { program in
                    Section(program.name) {
                        ForEach(program.availableDays, id: \.self) { day in
                            if let workout = program.workout(week: program.currentWeek, day: day) {
                                Button {
                                    manager.startWorkout(workout)
                                    dismiss()
                                } label: {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(day)
                                                .font(.headline)
                                            Text("\(workout.exercises.count) exercises")
                                                .font(.subheadline)
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        Image(systemName: "play.circle")
                                            .font(.title2)
                                            .foregroundStyle(.accentColor)
                                    }
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Choose Workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
