import SwiftUI
import Charts

enum ChartMode: String, CaseIterable {
    case weight = "Weight"
    case volume = "Volume"
}

struct ProgressionChartView: View {
    let exerciseName: String
    @Environment(WorkoutManager.self) var manager
    @State private var history: [(date: Date, weight: Double, reps: Int, volume: Double)] = []
    @State private var chartMode: ChartMode = .weight

    var body: some View {
        VStack(spacing: 16) {
            // Mode Picker
            Picker("View", selection: $chartMode) {
                ForEach(ChartMode.allCases, id: \.self) { mode in
                    Text(mode.rawValue).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)

            if history.isEmpty {
                ContentUnavailableView(
                    "No Data Yet",
                    systemImage: "chart.line.uptrend.xyaxis",
                    description: Text("Complete workouts with this exercise to see progression.")
                )
            } else {
                // Chart
                Chart {
                    ForEach(Array(history.enumerated()), id: \.offset) { _, entry in
                        let yValue = chartMode == .weight ? entry.weight : entry.volume

                        LineMark(
                            x: .value("Date", entry.date),
                            y: .value(chartMode.rawValue, yValue)
                        )
                        .foregroundStyle(Color.accentColor)

                        PointMark(
                            x: .value("Date", entry.date),
                            y: .value(chartMode.rawValue, yValue)
                        )
                        .foregroundStyle(Color.accentColor)
                    }
                }
                .chartYScale(domain: .automatic(includesZero: false))
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 5)) { value in
                        AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                        AxisGridLine()
                    }
                }
                .frame(height: 250)
                .padding()

                // Stats
                if let maxWeight = history.map({ $0.weight }).max(),
                   let maxVolume = history.map({ $0.volume }).max() {
                    HStack(spacing: 20) {
                        statView(label: "Max Weight", value: "\(maxWeight.cleanWeight) lbs")
                        statView(label: "Max Volume", value: "\(maxVolume.cleanWeight)")
                        statView(label: "Sessions", value: "\(history.count)")
                    }
                    .padding(.horizontal)
                }

                // Recent History
                List {
                    Section("Recent Sets") {
                        ForEach(Array(history.suffix(20).reversed().enumerated()), id: \.offset) { _, entry in
                            HStack {
                                Text(entry.date, format: .dateTime.month(.abbreviated).day())
                                    .font(.subheadline)
                                Spacer()
                                Text("\(entry.weight.cleanWeight) lbs x \(entry.reps)")
                                    .font(.subheadline.bold())
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(exerciseName)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            history = manager.coreData.fetchExerciseHistory(name: exerciseName)
        }
    }

    private func statView(label: String, value: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.headline)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}
