import Foundation
import FirebaseFirestore
import FirebaseFunctions

@MainActor
class GameService: ObservableObject {
    static let shared = GameService()

    private let db = Firestore.firestore()
    private let functions = Functions.functions()

    func createGame(mode: GameMode, displayName: String) async throws -> (gameId: String, roomCode: String) {
        let result = try await functions.httpsCallable("createGameFn").call([
            "mode": mode.rawValue,
            "displayName": displayName,
        ])
        let data = result.data as! [String: Any]
        return (data["gameId"] as! String, data["roomCode"] as! String)
    }

    func joinGame(roomCode: String, displayName: String) async throws -> String {
        let result = try await functions.httpsCallable("joinGameFn").call([
            "roomCode": roomCode,
            "displayName": displayName,
        ])
        let data = result.data as! [String: Any]
        return data["gameId"] as! String
    }

    func startGame(gameId: String) async throws {
        _ = try await functions.httpsCallable("startGameFn").call([
            "gameId": gameId,
        ])
    }

    func playCard(
        gameId: String,
        cardId: String,
        targetId: String? = nil,
        deflectRedirectTargetId: String? = nil,
        chainReactionSplashTargetId: String? = nil,
        snapFollowUp: [String: Any]? = nil
    ) async throws {
        var data: [String: Any] = ["gameId": gameId, "cardId": cardId]
        if let t = targetId { data["targetId"] = t }
        if let d = deflectRedirectTargetId { data["deflectRedirectTargetId"] = d }
        if let c = chainReactionSplashTargetId { data["chainReactionSplashTargetId"] = c }
        if let s = snapFollowUp { data["snapFollowUp"] = s }
        _ = try await functions.httpsCallable("playCardFn").call(data)
    }

    func playTantrum(gameId: String, cardId: String, targetId: String) async throws {
        _ = try await functions.httpsCallable("playTantrumFn").call([
            "gameId": gameId,
            "cardId": cardId,
            "targetId": targetId,
        ])
    }

    func startNextRound(gameId: String) async throws {
        _ = try await functions.httpsCallable("startNextRoundFn").call([
            "gameId": gameId,
        ])
    }

    func listenToGame(gameId: String, onChange: @escaping (GameState) -> Void) -> ListenerRegistration {
        return db.collection("games").document(gameId).addSnapshotListener { snapshot, error in
            guard let data = snapshot?.data() else { return }
            if let state = try? Firestore.Decoder().decode(GameState.self, from: data) {
                onChange(state)
            }
        }
    }

    func listenToHand(gameId: String, playerId: String, onChange: @escaping ([Card]) -> Void) -> ListenerRegistration {
        return db.collection("games").document(gameId)
            .collection("hands").document(playerId)
            .addSnapshotListener { snapshot, error in
                guard let data = snapshot?.data(),
                      let cards = try? Firestore.Decoder().decode([String: [Card]].self, from: data) else {
                    return
                }
                onChange(cards["cards"] ?? [])
            }
    }
}
