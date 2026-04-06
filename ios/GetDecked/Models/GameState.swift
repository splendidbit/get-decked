import Foundation

enum GameStatus: String, Codable {
    case waiting
    case active
    case meltdownPending
    case roundEnd
    case gameEnd
}

enum GameMode: String, Codable {
    case sync
    case async
}

struct ActiveEffect: Codable, Equatable {
    let type: String
    let redirectTargetId: String?
    let expiresAfterTurnOf: String
}

struct TurnLogEntry: Codable, Identifiable {
    var id: String { "\(playerId)_\(cardName)_\(description.hashValue)" }
    let playerId: String
    let cardName: String
    let cardType: CardType
    let targetId: String?
    let stressChange: Int?
    let description: String
}

struct GameState: Codable, Identifiable {
    let id: String
    var players: [String]
    var playerNames: [String: String]
    var stressLevels: [String: Int]
    var currentTurnIndex: Int
    var round: Int
    var roundWins: [String: Int]
    var roundsToWin: Int
    var status: GameStatus
    var mode: GameMode
    var eliminatedPlayers: [String]
    var activeEffects: [String: [ActiveEffect]]
    var turnLog: [TurnLogEntry]
    var hostId: String
    var roomCode: String
    var isPressurePhase: Bool
    var turnDeadline: Double?
    var meltdownPlayerId: String?
    var createdAt: Double
    var updatedAt: Double

    var currentPlayerId: String {
        players[currentTurnIndex]
    }

    var activePlayers: [String] {
        players.filter { !eliminatedPlayers.contains($0) }
    }

    func isEliminated(_ playerId: String) -> Bool {
        eliminatedPlayers.contains(playerId)
    }

    func stressFor(_ playerId: String) -> Int {
        stressLevels[playerId] ?? 0
    }

    func nameFor(_ playerId: String) -> String {
        playerNames[playerId] ?? "Unknown"
    }
}
