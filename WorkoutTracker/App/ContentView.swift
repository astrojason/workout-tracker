import SwiftUI

struct ContentView: View {
    @Environment(WorkoutManager.self) var manager

    var body: some View {
        TabView {
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }

            HistoryView()
                .tabItem {
                    Label("History", systemImage: "chart.bar.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
        }
        .tint(.accentColor)
        .fullScreenCover(item: Binding(
            get: { manager.session },
            set: { _ in }
        )) { session in
            if session.isActive {
                ActiveWorkoutView()
                    .environment(manager)
            } else {
                WorkoutCompleteView()
                    .environment(manager)
            }
        }
    }
}
