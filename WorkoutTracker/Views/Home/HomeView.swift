import SwiftUI

struct HomeView: View {
    @Environment(WorkoutManager.self) var manager
    @State private var showingWorkoutSelection = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Date Header
                    dateHeader

                    // Suggested Workouts
                    ForEach(manager.programs) { program in
                        programCard(program)
                    }

                    // Choose Different Workout
                    Button {
                        showingWorkoutSelection = true
                    } label: {
                        Label("Choose Different Workout", systemImage: "list.bullet")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(.ultraThinMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(.horizontal)
                }
                .padding(.vertical)
            }
            .navigationTitle("Workout Tracker")
            .sheet(isPresented: $showingWorkoutSelection) {
                WorkoutSelectionSheet()
            }
        }
    }

    // MARK: - Date Header

    private var dateHeader: some View {
        VStack(spacing: 4) {
            Text(Date(), format: .dateTime.weekday(.wide))
                .font(.title2.bold())
            Text(Date(), format: .dateTime.month(.wide).day())
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
    }

    // MARK: - Program Card

    private func programCard(_ program: Program) -> some View {
        VStack(spacing: 16) {
            // Program Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(program.name)
                        .font(.title3.bold())
                    Text("Week \(program.currentWeek) of \(program.totalWeeks)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }

            // Weekly Overview
            WeeklyOverview(program: program)

            // Today's Workout Button
            if let workout = program.todaysWorkout() {
                let completedDays = manager.completedDays(for: program)
                let isCompleted = completedDays.contains(workout.dayOfWeek)

                Button {
                    manager.startWorkout(workout)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Start \(workout.dayOfWeek)")
                                .font(.headline)
                            Text("\(workout.exercises.count) exercises")
                                .font(.subheadline)
                                .opacity(0.8)
                        }
                        Spacer()
                        Image(systemName: isCompleted ? "checkmark.circle.fill" : "play.circle.fill")
                            .font(.title)
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(isCompleted ? Color.green.opacity(0.8) : Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal)
    }
}
