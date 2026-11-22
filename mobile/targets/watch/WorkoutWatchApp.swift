import SwiftUI

@main
struct WorkoutWatchApp: App {
    @StateObject private var model = WorkoutMirror()

    var body: some Scene {
        WindowGroup {
            ContentView().environmentObject(model)
        }
    }
}
