import Foundation

@MainActor
class HomeViewModel: ObservableObject {
    @Published var showCreateGame = false
    @Published var showJoinGame = false
    @Published var joinRoomCode = ""
    @Published var selectedMode: GameMode = .sync
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var activeGameId: String?

    private let gameService = GameService.shared

    func createGame(displayName: String) async {
        isLoading = true
        errorMessage = nil
        do {
            let result = try await gameService.createGame(mode: selectedMode, displayName: displayName)
            activeGameId = result.gameId
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func joinGame(displayName: String) async {
        isLoading = true
        errorMessage = nil
        do {
            let gameId = try await gameService.joinGame(roomCode: joinRoomCode, displayName: displayName)
            activeGameId = gameId
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
