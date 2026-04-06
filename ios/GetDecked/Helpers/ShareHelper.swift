import UIKit

struct ShareHelper {
    static func shareGameInvite(roomCode: String, gameId: String) {
        let message = "Join my Get Decked game! Room code: \(roomCode)\n\ngetdecked://join/\(roomCode)"
        let av = UIActivityViewController(activityItems: [message], applicationActivities: nil)
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let root = scene.windows.first?.rootViewController {
            root.present(av, animated: true)
        }
    }

    static func shareGameResult(gameState: GameState, events: [String]) -> String {
        guard let winnerId = gameState.activePlayers.first else { return "" }
        let winnerName = gameState.nameFor(winnerId)
        let standings = gameState.players.map { pid in
            "\(gameState.nameFor(pid)): \(gameState.roundWins[pid] ?? 0) wins"
        }.joined(separator: ", ")
        return "Get Decked Round \(gameState.round): \(winnerName) wins! \(standings)"
    }
}
