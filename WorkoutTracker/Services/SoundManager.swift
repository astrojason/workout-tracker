import AVFoundation
import UIKit

class SoundManager {
    static let shared = SoundManager()

    private var audioPlayer: AVAudioPlayer?
    var soundEnabled: Bool = true

    func configureAudioSession() {
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: .mixWithOthers)
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    func playTimerComplete() {
        guard soundEnabled else { return }

        // Play 3 short beeps using system sounds
        for i in 0..<3 {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.3) {
                AudioServicesPlaySystemSound(1057) // Short beep
            }
        }

        // Haptic feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }

    func playButtonTap() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
    }

    func playSetComplete() {
        guard soundEnabled else { return }
        AudioServicesPlaySystemSound(1004) // Subtle confirmation
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }
}
