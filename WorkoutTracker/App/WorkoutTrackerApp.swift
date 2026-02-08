import SwiftUI

@main
struct WorkoutTrackerApp: App {
    @State private var workoutManager = WorkoutManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(workoutManager)
                .onAppear {
                    workoutManager.loadPrograms()
                }
        }
    }
}
