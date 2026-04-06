import UIKit
import AVFoundation

@MainActor
class FeedbackManager {
    static let shared = FeedbackManager()

    private let impactLight = UIImpactFeedbackGenerator(style: .light)
    private let impactMedium = UIImpactFeedbackGenerator(style: .medium)
    private let impactHeavy = UIImpactFeedbackGenerator(style: .heavy)
    private let notification = UINotificationFeedbackGenerator()
    private let sound = SoundEngine.shared

    private init() {
        impactLight.prepare()
        impactMedium.prepare()
        impactHeavy.prepare()
    }

    func cardPlayed() {
        impactMedium.impactOccurred()
        sound.cardPlay()
    }

    func stressReceived() {
        impactHeavy.impactOccurred()
        sound.stressHit()
    }

    func chillPlayed() {
        impactLight.impactOccurred()
        sound.chillSound()
    }

    func meltdown() {
        notification.notificationOccurred(.error)
        sound.meltdownSound()
        // Triple haptic for drama
        Task {
            try? await Task.sleep(for: .milliseconds(100))
            impactHeavy.impactOccurred()
            try? await Task.sleep(for: .milliseconds(100))
            impactHeavy.impactOccurred()
        }
    }

    func tantrum() {
        notification.notificationOccurred(.warning)
        sound.tantrumSound()
    }

    func zenPlayed() {
        notification.notificationOccurred(.success)
        sound.zenSound()
    }

    func roundWon() {
        notification.notificationOccurred(.success)
        sound.victorySound()
    }

    func turnStart() {
        impactLight.impactOccurred()
        sound.turnPing()
    }
}
