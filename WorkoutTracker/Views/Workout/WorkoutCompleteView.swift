import SwiftUI

struct WorkoutCompleteView: View {
    @Environment(WorkoutManager.self) var manager

    var body: some View {
        guard let session = manager.session else { return AnyView(EmptyView()) }

        return AnyView(
            NavigationStack {
                ScrollView {
                    VStack(spacing: 24) {
                        // Celebration
                        VStack(spacing: 12) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 64))
                                .foregroundStyle(.green)

                            Text("Workout Complete!")
                                .font(.title.bold())

                            Text(session.workout.programName + " - " + session.workout.dayOfWeek)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.top, 40)

                        // Stats
                        HStack(spacing: 20) {
                            statCard(
                                icon: "clock",
                                value: session.elapsedTimeFormatted,
                                label: "Duration"
                            )
                            statCard(
                                icon: "flame.fill",
                                value: "\(session.completedSets.filter { $0.completed }.count)",
                                label: "Sets"
                            )
                            statCard(
                                icon: "figure.strengthtraining.traditional",
                                value: "\(Set(session.completedSets.map { $0.exerciseName }).count)",
                                label: "Exercises"
                            )
                        }
                        .padding(.horizontal)

                        // PRs
                        if !session.prsAchieved.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Label("Personal Records!", systemImage: "trophy.fill")
                                    .font(.title3.bold())
                                    .foregroundStyle(.yellow)

                                ForEach(session.prsAchieved) { pr in
                                    HStack {
                                        Image(systemName: "star.fill")
                                            .foregroundStyle(.yellow)
                                        VStack(alignment: .leading) {
                                            Text(pr.exerciseName)
                                                .font(.headline)
                                            Text("\(pr.type.rawValue): \(pr.value.cleanWeight)")
                                                .font(.subheadline)
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        if let prev = pr.previousBest {
                                            Text("was \(prev.cleanWeight)")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        } else {
                                            Text("First!")
                                                .font(.caption.bold())
                                                .foregroundStyle(.green)
                                        }
                                    }
                                    .padding()
                                    .background(Color.yellow.opacity(0.1))
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                }
                            }
                            .padding()
                        }

                        // Set Summary
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Summary")
                                .font(.headline)
                                .padding(.horizontal)

                            ForEach(groupedSets(session), id: \.exerciseName) { group in
                                HStack {
                                    Text(group.exerciseName)
                                        .font(.subheadline)
                                    Spacer()
                                    Text(group.summary)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.horizontal)
                                .padding(.vertical, 4)
                            }
                        }

                        // Done Button
                        Button {
                            manager.dismissWorkout()
                        } label: {
                            Text("Done")
                                .font(.headline.bold())
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                                .background(Color.accentColor)
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                        .padding()
                    }
                }
                .navigationBarBackButtonHidden(true)
            }
        )
    }

    private func statCard(icon: String, value: String, label: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(.accentColor)
            Text(value)
                .font(.title3.bold())
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private struct ExerciseGroup {
        let exerciseName: String
        let summary: String
    }

    private func groupedSets(_ session: WorkoutSession) -> [ExerciseGroup] {
        var groups: [String: [CompletedSet]] = [:]
        var order: [String] = []

        for set in session.completedSets {
            if groups[set.exerciseName] == nil {
                order.append(set.exerciseName)
            }
            groups[set.exerciseName, default: []].append(set)
        }

        return order.compactMap { name in
            guard let sets = groups[name] else { return nil }
            let completed = sets.filter { $0.completed }
            let reps = completed.map { "\($0.actualReps)" }.joined(separator: ", ")
            let weight = completed.first?.actualWeight ?? 0
            let weightStr = weight > 0 ? " @ \(weight.cleanWeight) lbs" : ""
            return ExerciseGroup(
                exerciseName: name,
                summary: "\(completed.count)/\(sets.count) sets [\(reps)]\(weightStr)"
            )
        }
    }
}
