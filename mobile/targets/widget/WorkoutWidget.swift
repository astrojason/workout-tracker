import SwiftUI
import WidgetKit

private let appGroup = "group.com.astrojason.workout"
private let summaryKey = "homeSummary"

struct ProgramLine: Decodable, Hashable {
    let programName: String
    let dayLabel: String?
    let exerciseCount: Int
    let done: Bool
}

struct HomeSummary: Decodable {
    let date: String // local yyyy-MM-dd the app built this for
    let programs: [ProgramLine]
    let completedThisWeek: Int
    let plannedThisWeek: Int
}

enum SummaryState {
    case summary(HomeSummary)
    case notOpenedYet            // the app has never sent a summary
    case failed(String)          // stored data couldn't be read; shown, never hidden
}

struct WorkoutEntry: TimelineEntry {
    let date: Date
    let state: SummaryState
}

private func todayKey(_ date: Date) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
}

private func loadState() -> SummaryState {
    guard let defaults = UserDefaults(suiteName: appGroup) else {
        return .failed("Shared storage \(appGroup) is unavailable.")
    }
    guard let json = defaults.string(forKey: summaryKey) else { return .notOpenedYet }
    do {
        return .summary(try JSONDecoder().decode(HomeSummary.self, from: Data(json.utf8)))
    } catch {
        return .failed("Couldn't read workout data: \(error.localizedDescription)")
    }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WorkoutEntry {
        WorkoutEntry(date: Date(), state: .summary(HomeSummary(
            date: todayKey(Date()),
            programs: [ProgramLine(programName: "Workout", dayLabel: "Today", exerciseCount: 6, done: false)],
            completedThisWeek: 2, plannedThisWeek: 4)))
    }

    func getSnapshot(in context: Context, completion: @escaping (WorkoutEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : WorkoutEntry(date: Date(), state: loadState()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WorkoutEntry>) -> Void) {
        let now = Date()
        // Refresh just after midnight so yesterday's summary is recognised as out of date.
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: now)) ?? now.addingTimeInterval(3600)
        completion(Timeline(entries: [WorkoutEntry(date: now, state: loadState())], policy: .after(tomorrow)))
    }
}

struct WorkoutWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WorkoutEntry

    var body: some View {
        content
            .containerBackground(for: .widget) { Color("$widgetBackground") }
    }

    @ViewBuilder private var content: some View {
        switch entry.state {
        case .failed(let message):
            Text(message).font(.caption2).foregroundStyle(.red)
        case .notOpenedYet:
            message("Open Workout to set up this widget.")
        case .summary(let summary):
            if summary.date != todayKey(entry.date) {
                message("Open Workout to refresh today's plan.")
            } else {
                summaryView(summary)
            }
        }
    }

    private func message(_ text: String) -> some View {
        Text(text).font(family == .accessoryInline ? .body : .footnote).foregroundStyle(.secondary)
    }

    @ViewBuilder private func summaryView(_ s: HomeSummary) -> some View {
        let week = "\(s.completedThisWeek)/\(s.plannedThisWeek) this week"
        switch family {
        case .accessoryInline:
            Text(s.programs.first.map { line in line.dayLabel == nil ? "Rest day" : (line.done ? "Done today" : "\(line.programName) today") } ?? week)
        case .accessoryRectangular:
            VStack(alignment: .leading) {
                Text(s.programs.first?.programName ?? "Workout").font(.headline).lineLimit(1)
                Text(status(s.programs.first)).font(.caption)
                Text(week).font(.caption2).foregroundStyle(.secondary)
            }
        case .systemSmall:
            VStack(alignment: .leading, spacing: 4) {
                Text(s.programs.first?.programName ?? "Workout").font(.headline).lineLimit(2)
                Text(status(s.programs.first)).font(.subheadline).foregroundStyle(.secondary)
                Spacer()
                weekBar(s)
            }
        default:
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(s.programs.enumerated()), id: \.offset) { _, line in
                    HStack {
                        Image(systemName: line.done ? "checkmark.circle.fill" : (line.dayLabel == nil ? "moon.zzz" : "circle"))
                            .foregroundStyle(line.done ? Color.green : Color.accentColor)
                        VStack(alignment: .leading) {
                            Text(line.programName).font(.subheadline.bold()).lineLimit(1)
                            Text(status(line)).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                Spacer(minLength: 0)
                weekBar(s)
            }
        }
    }

    private func status(_ line: ProgramLine?) -> String {
        guard let line else { return "No programs yet" }
        guard let day = line.dayLabel else { return "Rest day" }
        return line.done ? "Done for today" : "\(day) · \(line.exerciseCount) exercises"
    }

    private func weekBar(_ s: HomeSummary) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            ProgressView(value: Double(s.completedThisWeek), total: Double(max(s.plannedThisWeek, 1)))
                .tint(Color.accentColor)
            Text("\(s.completedThisWeek)/\(s.plannedThisWeek) this week").font(.caption2).foregroundStyle(.secondary)
        }
    }
}

struct WorkoutWidget: Widget {
    let kind = "WorkoutWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            WorkoutWidgetView(entry: entry)
        }
        .configurationDisplayName("Today's workout")
        .description("Today's workout for each program and how your week is going.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}
