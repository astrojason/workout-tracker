import SwiftUI

struct WeeklyOverview: View {
    let program: Program
    @Environment(WorkoutManager.self) var manager

    private let days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    private let fullDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    var body: some View {
        let completedDays = manager.completedDays(for: program)
        let todayIndex = currentDayIndex()

        HStack(spacing: 8) {
            ForEach(Array(days.enumerated()), id: \.offset) { index, day in
                let fullDay = fullDays[index]
                let isAvailable = program.availableDays.contains(fullDay)
                let isCompleted = completedDays.contains(fullDay)
                let isToday = index == todayIndex

                VStack(spacing: 4) {
                    Text(day)
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    ZStack {
                        Circle()
                            .fill(circleColor(isCompleted: isCompleted, isToday: isToday, isAvailable: isAvailable))
                            .frame(width: 32, height: 32)

                        if isCompleted {
                            Image(systemName: "checkmark")
                                .font(.caption.bold())
                                .foregroundStyle(.white)
                        } else if isToday {
                            Circle()
                                .strokeBorder(.white, lineWidth: 2)
                                .frame(width: 32, height: 32)
                        }
                    }
                }
            }
        }
    }

    private func circleColor(isCompleted: Bool, isToday: Bool, isAvailable: Bool) -> Color {
        if isCompleted { return .green }
        if isToday { return .accentColor }
        if isAvailable { return .secondary.opacity(0.3) }
        return .secondary.opacity(0.1)
    }

    private func currentDayIndex() -> Int {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.dateFormat = "EEEE"
        let today = formatter.string(from: Date())
        return fullDays.firstIndex(of: today) ?? 0
    }
}
