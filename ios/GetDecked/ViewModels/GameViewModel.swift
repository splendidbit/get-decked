import Foundation
import FirebaseFirestore

@MainActor
class GameViewModel: ObservableObject {
    @Published var gameState: GameState?
    @Published var hand: [Card] = []
    @Published var selectedCard: Card?
    @Published var selectedTarget: String?
    @Published var deflectTarget: String?
    @Published var splashTarget: String?
    @Published var snapFollowUpCard: Card?
    @Published var snapFollowUpTarget: String?
    @Published var showMeltdownOverlay = false
    @Published var meltdownPlayerId: String?
    @Published var isPlayingCard = false
    @Published var errorMessage: String?

    let gameId: String
    let myId: String
    private let service = GameService.shared
    private var gameListener: ListenerRegistration?
    private var handListener: ListenerRegistration?

    var isMyTurn: Bool {
        guard let gs = gameState else { return false }
        return gs.status == .active && gs.currentPlayerId == myId
    }

    var isMyTantrum: Bool {
        guard let gs = gameState else { return false }
        return gs.status == .meltdownPending && gs.meltdownPlayerId == myId
    }

    var opponents: [String] {
        guard let gs = gameState else { return [] }
        return gs.players.filter { $0 != myId }
    }

    var validTargets: [String] {
        guard let gs = gameState else { return [] }
        return gs.activePlayers.filter { $0 != myId }
    }

    init(gameId: String, myId: String) {
        self.gameId = gameId
        self.myId = myId
        startListening()
    }

    func startListening() {
        gameListener = service.listenToGame(gameId: gameId) { [weak self] state in
            let oldState = self?.gameState
            self?.gameState = state

            // Trigger haptics based on state changes
            if state.status == .meltdownPending {
                self?.showMeltdownOverlay = true
                self?.meltdownPlayerId = state.meltdownPlayerId
            } else {
                if oldState?.status == .meltdownPending {
                    // Meltdown just resolved
                    self?.showMeltdownOverlay = false
                }
                self?.showMeltdownOverlay = false
            }

            // Haptic for turn change
            if let myId = self?.myId {
                if state.status == .active && state.currentPlayerId == myId && oldState?.currentPlayerId != myId {
                    FeedbackManager.shared.turnStart()
                }
                // Haptic for stress change
                if let oldStress = oldState?.stressLevels[myId], let newStress = state.stressLevels[myId] {
                    if newStress > oldStress {
                        FeedbackManager.shared.stressReceived()
                    } else if newStress < oldStress {
                        FeedbackManager.shared.chillPlayed()
                    }
                    if newStress == 0 && oldStress > 0 {
                        FeedbackManager.shared.zenPlayed()
                    }
                }
            }

            // Haptic for round/game end
            if state.status == .roundEnd || state.status == .gameEnd {
                FeedbackManager.shared.roundWon()
            }
        }
        handListener = service.listenToHand(gameId: gameId, playerId: myId) { [weak self] cards in
            self?.hand = cards
        }
    }

    func playSelectedCard() async {
        guard let card = selectedCard else { return }
        isPlayingCard = true
        errorMessage = nil
        do {
            var snapFollowUp: [String: Any]?
            if card.type == .snap, let followUp = snapFollowUpCard {
                var fu: [String: Any] = ["cardId": followUp.id]
                if let t = snapFollowUpTarget { fu["targetId"] = t }
                snapFollowUp = fu
            }
            try await service.playCard(
                gameId: gameId,
                cardId: card.id,
                targetId: selectedTarget,
                deflectRedirectTargetId: deflectTarget,
                chainReactionSplashTargetId: splashTarget,
                snapFollowUp: snapFollowUp
            )
            clearSelection()
        } catch {
            errorMessage = error.localizedDescription
        }
        isPlayingCard = false
    }

    func playTantrum() async {
        guard let card = selectedCard, let target = selectedTarget else { return }
        isPlayingCard = true
        do {
            try await service.playTantrum(gameId: gameId, cardId: card.id, targetId: target)
            clearSelection()
        } catch {
            errorMessage = error.localizedDescription
        }
        isPlayingCard = false
    }

    func startNextRound() async {
        try? await service.startNextRound(gameId: gameId)
    }

    func clearSelection() {
        selectedCard = nil
        selectedTarget = nil
        deflectTarget = nil
        splashTarget = nil
        snapFollowUpCard = nil
        snapFollowUpTarget = nil
    }

    deinit {
        gameListener?.remove()
        handListener?.remove()
    }
}
