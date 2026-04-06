import UIKit
import AVFoundation

@MainActor
class FeedbackManager {
    static let shared = FeedbackManager()

    private let impactLight = UIImpactFeedbackGenerator(style: .light)
    private let impactMedium = UIImpactFeedbackGenerator(style: .medium)
    private let impactHeavy = UIImpactFeedbackGenerator(style: .heavy)
    private let notification = UINotificationFeedbackGenerator()

    private init() {
        impactLight.prepare()
        impactMedium.prepare()
        impactHeavy.prepare()
    }

    func cardPlayed() {
        impactMedium.impactOccurred()
    }

    func stressReceived() {
        impactHeavy.impactOccurred()
    }

    func chillPlayed() {
        impactLight.impactOccurred()
    }

    func meltdown() {
        notification.notificationOccurred(.error)
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
    }

    func zenPlayed() {
        notification.notificationOccurred(.success)
    }

    func roundWon() {
        notification.notificationOccurred(.success)
    }

    func turnStart() {
        impactLight.impactOccurred()
    }
}
