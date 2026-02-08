import SwiftUI

struct HistoryView: View {
    @Environment(WorkoutManager.self) var manager
    @State private var sessions: [SessionDisplay] = []

    var body: some View {
        NavigationStack {
            Group {
                if sessions.isEmpty {
                    ContentUnavailableView(
                        "No Workouts Yet",
                        systemImage: "figure.strengthtraining.traditional",
                        description: Text("Complete a workout to see your history here.")
                    )
                } else {
                    List {
                        // Exercise Progress Section
                        Section {
                            NavigationLink {
                                ExerciseProgressView()
                            } label: {
                                Label("Exercise Progress", systemImage: "chart.line.uptrend.xyaxis")
                            }
                        }

                        // Session History
                        Section("Recent Workouts") {
                            ForEach(sessions) { session in
                                sessionRow(session)
                            }
                        }
                    }
                }
            }
            .navigationTitle("History")
            .onAppear { loadSessions() }
        }
    }

    private func sessionRow(_ session: SessionDisplay) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(session.programName)
                    .font(.headline)
                HStack(spacing: 8) {
                    Text(session.dayOfWeek)
                    Text("Week \(session.week)")
                        .foregroundStyle(.secondary)
                }
                .font(.subheadline)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(session.date, format: .dateTime.month(.abbreviated).day())
                    .font(.subheadline)
                Text(formatDuration(session.durationSeconds))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if session.completed {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            }
        }
    }

    private func loadSessions() {
        let fetched = manager.coreData.fetchSessions(limit: 50)
        sessions = fetched.map { obj in
            SessionDisplay(
                id: obj.value(forKey: "id") as? UUID ?? UUID(),
                programName: obj.value(forKey: "programName") as? String ?? "",
                week: Int(obj.value(forKey: "week") as? Int16 ?? 0),
                dayOfWeek: obj.value(forKey: "dayOfWeek") as? String ?? "",
                date: obj.value(forKey: "date") as? Date ?? Date(),
                completed: obj.value(forKey: "completed") as? Bool ?? false,
                durationSeconds: Int(obj.value(forKey: "durationSeconds") as? Int32 ?? 0)
            )
        }
    }

    private func formatDuration(_ seconds: Int) -> String {
        let min = seconds / 60
        if min < 60 { return "\(min) min" }
        let hours = min / 60
        let remainingMin = min % 60
        return "\(hours)h \(remainingMin)m"
    }
}

struct SessionDisplay: Identifiable {
    let id: UUID
    let programName: String
    let week: Int
    let dayOfWeek: String
    let date: Date
    let completed: Bool
    let durationSeconds: Int
}
