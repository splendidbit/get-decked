import Foundation
import FirebaseFirestore

@MainActor
class LobbyViewModel: ObservableObject {
    @Published var gameState: GameState?
    @Published var isStarting = false
    @Published var navigateToGame = false

    let gameId: String
    private let service = GameService.shared
    private var listener: ListenerRegistration?

    init(gameId: String) {
        self.gameId = gameId
        listener = service.listenToGame(gameId: gameId) { [weak self] state in
            self?.gameState = state
            if state.status == .active || state.status == .meltdownPending {
                self?.navigateToGame = true
            }
        }
    }

    func startGame() async {
        isStarting = true
        try? await service.startGame(gameId: gameId)
        isStarting = false
    }

    deinit { listener?.remove() }
}
