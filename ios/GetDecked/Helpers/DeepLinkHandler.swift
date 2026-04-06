import Foundation

@MainActor
class DeepLinkHandler: ObservableObject {
    static let shared = DeepLinkHandler()

    @Published var pendingGameId: String?

    func handleGameDeepLink(gameId: String) {
        pendingGameId = gameId
    }

    func consumePendingGame() -> String? {
        let id = pendingGameId
        pendingGameId = nil
        return id
    }
}
