import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(WorkoutManager.self) var manager
    @State private var showingImporter = false
    @State private var importError: String?
    @State private var showingImportError = false

    var body: some View {
        NavigationStack {
            Form {
                // Program Management
                Section("Programs") {
                    ForEach(manager.programs) { program in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(program.name)
                                    .font(.headline)
                                Text("\(program.totalWeeks) weeks, \(program.availableDays.count) days/week")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Picker("Week", selection: Binding(
                                get: { program.currentWeek },
                                set: { manager.setCurrentWeek($0, for: program.name) }
                            )) {
                                ForEach(1...program.totalWeeks, id: \.self) { week in
                                    Text("Week \(week)").tag(week)
                                }
                            }
                            .pickerStyle(.menu)
                        }
                    }

                    Button {
                        showingImporter = true
                    } label: {
                        Label("Import CSV Program", systemImage: "doc.badge.plus")
                    }
                }

                // Rest Timer
                Section("Rest Timer") {
                    Picker("Default Rest Time", selection: Binding(
                        get: { manager.defaultRestSeconds },
                        set: { manager.defaultRestSeconds = $0 }
                    )) {
                        Text("60s").tag(60)
                        Text("90s").tag(90)
                        Text("120s").tag(120)
                        Text("150s").tag(150)
                        Text("180s").tag(180)
                    }
                }

                // Sound
                Section("Notifications") {
                    Toggle("Timer Sound", isOn: Binding(
                        get: { manager.soundEnabled },
                        set: { manager.soundEnabled = $0 }
                    ))
                }

                // Equipment
                Section("Equipment") {
                    NavigationLink("Equipment Inventory") {
                        EquipmentInventoryView()
                    }
                }

                // About
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .fileImporter(
                isPresented: $showingImporter,
                allowedContentTypes: [UTType.commaSeparatedText],
                allowsMultipleSelection: false
            ) { result in
                handleImport(result)
            }
            .alert("Import Error", isPresented: $showingImportError) {
                Button("OK") {}
            } message: {
                Text(importError ?? "Unknown error")
            }
        }
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            do {
                try manager.importProgram(from: url)
            } catch {
                importError = error.localizedDescription
                showingImportError = true
            }
        case .failure(let error):
            importError = error.localizedDescription
            showingImportError = true
        }
    }
}
