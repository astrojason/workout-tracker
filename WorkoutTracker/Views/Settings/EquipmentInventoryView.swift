import SwiftUI

struct EquipmentInventoryView: View {
    @Environment(WorkoutManager.self) var manager

    // Default plate inventory
    private let allPlates: [(weight: Double, defaultPairs: Int)] = [
        (45, 1), (35, 1), (25, 2), (10, 2), (5, 1), (2.5, 1), (1, 1), (0.75, 1), (0.5, 1)
    ]

    var body: some View {
        Form {
            Section {
                Text("Your equipment is pre-configured based on your home gym inventory. Toggle plates off if they become unavailable.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Barbells") {
                equipmentRow(name: "Olympic Bar", detail: "45 lbs")
                equipmentRow(name: "Standard Bar", detail: "35 lbs")
                equipmentRow(name: "EZ Curl Bar", detail: "15 lbs")
            }

            Section("Plates (pairs)") {
                ForEach(allPlates, id: \.weight) { plate in
                    HStack {
                        Text("\(plate.weight.cleanWeight) lb plates")
                        Spacer()
                        Text("\(plate.defaultPairs) pair\(plate.defaultPairs > 1 ? "s" : "")")
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Section("PowerBlock Elite EXP") {
                equipmentRow(name: "Range", detail: "5-50 lbs")
                equipmentRow(name: "Increment", detail: "2.5 lbs")
            }

            Section("Bands (Serious Steel)") {
                bandRow(name: "Orange #0", range: "2-12 lbs")
                bandRow(name: "Purple #1", range: "5-35 lbs")
                bandRow(name: "Red #2", range: "10-50 lbs")
                bandRow(name: "Blue #3", range: "20-80 lbs")
            }

            Section("Kettlebells") {
                equipmentRow(name: "Heavy", detail: "45 lbs")
                equipmentRow(name: "Medium", detail: "25 lbs")
                equipmentRow(name: "Light", detail: "15 lbs")
            }
        }
        .navigationTitle("Equipment")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func equipmentRow(name: String, detail: String) -> some View {
        HStack {
            Text(name)
            Spacer()
            Text(detail)
                .foregroundStyle(.secondary)
        }
    }

    private func bandRow(name: String, range: String) -> some View {
        HStack {
            Circle()
                .fill(bandColor(name))
                .frame(width: 12, height: 12)
            Text(name)
            Spacer()
            Text(range)
                .foregroundStyle(.secondary)
        }
    }

    private func bandColor(_ name: String) -> Color {
        if name.contains("Orange") { return .orange }
        if name.contains("Purple") { return .purple }
        if name.contains("Red") { return .red }
        if name.contains("Blue") { return .blue }
        return .gray
    }
}
