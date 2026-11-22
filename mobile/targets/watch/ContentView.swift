import SwiftUI

struct ContentView: View {
    @EnvironmentObject var model: WorkoutMirror

    var body: some View {
        VStack(spacing: 6) {
            if let message = model.errorMessage {
                Text(message).font(.footnote).foregroundStyle(.red)
            }
            if !model.active {
                Text("No active workout")
                    .font(.headline)
                Text("Start one on your iPhone.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else if let end = model.restEndsAt, end > Date() {
                Text("REST").font(.caption).foregroundStyle(.secondary)
                Text(timerInterval: Date()...end, countsDown: true)
                    .font(.system(size: 44, weight: .bold, design: .monospaced))
                    .minimumScaleFactor(0.6)
                if !model.nextDetail.isEmpty {
                    Text(model.nextLabel).font(.caption2).foregroundStyle(.secondary)
                    Text(model.nextDetail).font(.footnote).multilineTextAlignment(.center)
                }
            } else {
                Text(model.exercise).font(.headline).multilineTextAlignment(.center)
                Text("Set \(model.set) of \(model.sets)").font(.title3)
                if model.weight > 0 {
                    Text("\(model.weight, specifier: "%g") lb").foregroundStyle(.secondary)
                }
            }
        }
        .padding()
    }
}
