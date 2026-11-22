import Foundation
import WatchConnectivity
import WatchKit

/// Receives the workout state the iPhone app mirrors over WatchConnectivity.
final class WorkoutMirror: NSObject, ObservableObject, WCSessionDelegate {
    @Published var exercise = ""
    @Published var set = 0
    @Published var sets = 0
    @Published var weight = 0.0
    @Published var restEndsAt: Date?
    @Published var nextLabel = ""
    @Published var nextDetail = ""
    @Published var active = false
    @Published var errorMessage: String?

    private var restTask: Task<Void, Never>?

    override init() {
        super.init()
        guard WCSession.isSupported() else {
            errorMessage = "WatchConnectivity is not supported on this device."
            return
        }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        if let error {
            DispatchQueue.main.async { self.errorMessage = "Watch connection failed: \(error.localizedDescription)" }
            return
        }
        // Pick up whatever the phone sent while this app wasn't running.
        let context = session.receivedApplicationContext
        if !context.isEmpty { apply(context) }
    }

    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        apply(context)
    }

    private func apply(_ context: [String: Any]) {
        DispatchQueue.main.async {
            if context["ended"] as? Bool == true {
                self.active = false
                self.restEndsAt = nil
                self.restTask?.cancel()
                return
            }
            guard let exercise = context["exercise"] as? String,
                  let set = context["set"] as? Int,
                  let sets = context["sets"] as? Int else {
                self.errorMessage = "Unexpected workout data from iPhone: \(context)"
                return
            }
            self.errorMessage = nil
            self.exercise = exercise
            self.set = set
            self.sets = sets
            self.weight = (context["weight"] as? Double) ?? 0
            self.nextLabel = (context["nextLabel"] as? String) ?? ""
            self.nextDetail = (context["nextDetail"] as? String) ?? ""
            self.active = true
            if let ms = context["restEndsAt"] as? Double {
                self.restEndsAt = Date(timeIntervalSince1970: ms / 1000)
                self.scheduleRestHaptic()
            } else {
                self.restEndsAt = nil
                self.restTask?.cancel()
            }
        }
    }

    /// Taps the wrist when rest ends while this app is on screen; when it isn't, the
    /// iPhone's rest-complete notification is mirrored to the watch by iOS instead.
    private func scheduleRestHaptic() {
        restTask?.cancel()
        guard let end = restEndsAt else { return }
        restTask = Task { @MainActor in
            let delay = end.timeIntervalSinceNow
            guard delay > 0 else { return }
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            if Task.isCancelled { return }
            WKInterfaceDevice.current().play(.notification)
            self.restEndsAt = nil
        }
    }
}
