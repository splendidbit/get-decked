import Foundation
import UserNotifications

class NotificationService {
    static func handleNotification(_ userInfo: [AnyHashable: Any]) {
        guard let gameId = userInfo["gameId"] as? String else { return }
        Task { @MainActor in
            DeepLinkHandler.shared.handleGameDeepLink(gameId: gameId)
        }
    }

    static func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        do {
            return try await center.requestAuthorization(options: [.alert, .badge, .sound])
        } catch {
            return false
        }
    }
}
