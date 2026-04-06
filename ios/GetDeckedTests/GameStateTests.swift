import XCTest
@testable import GetDecked

final class GameStateTests: XCTestCase {
    func testActivePlayersExcludesEliminated() {
        let state = GameState(
            id: "test", players: ["p1", "p2", "p3"],
            playerNames: ["p1": "A", "p2": "B", "p3": "C"],
            stressLevels: ["p1": 3, "p2": 3, "p3": 3],
            currentTurnIndex: 0, round: 1,
            roundWins: [:], roundsToWin: 3,
            status: .active, mode: .sync,
            eliminatedPlayers: ["p2"],
            activeEffects: [:], turnLog: [],
            hostId: "p1", roomCode: "ABCD",
            isPressurePhase: false, turnDeadline: nil,
            meltdownPlayerId: nil,
            createdAt: 0, updatedAt: 0
        )
        XCTAssertEqual(state.activePlayers, ["p1", "p3"])
        XCTAssertTrue(state.isEliminated("p2"))
    }
}
