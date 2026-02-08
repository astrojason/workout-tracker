import SwiftUI

struct ExerciseProgressView: View {
    @Environment(WorkoutManager.self) var manager
    @State private var exerciseNames: [String] = []
    @State private var searchText: String = ""

    var filteredExercises: [String] {
        if searchText.isEmpty { return exerciseNames }
        return exerciseNames.filter { $0.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        List {
            ForEach(filteredExercises, id: \.self) { name in
                NavigationLink {
                    ProgressionChartView(exerciseName: name)
                } label: {
                    Text(name)
                }
            }
        }
        .searchable(text: $searchText, prompt: "Search exercises")
        .navigationTitle("Exercise Progress")
        .onAppear {
            exerciseNames = manager.coreData.fetchAllExerciseNames()
        }
    }
}
