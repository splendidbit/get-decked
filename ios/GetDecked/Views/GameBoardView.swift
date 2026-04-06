import SwiftUI

struct GameBoardView: View {
    @StateObject private var vm: GameViewModel
    @EnvironmentObject var auth: AuthService

    init(gameId: String, myId: String) {
        _vm = StateObject(wrappedValue: GameViewModel(gameId: gameId, myId: myId))
    }

    var body: some View {
        ZStack {
            if let gs = vm.gameState {
                VStack(spacing: 0) {
                    opponentsBar(gs).padding(.top, 8)
                    Spacer()
                    turnLogView(gs)
                    Spacer()
                    statusBar(gs).padding(.horizontal)
                    HandView(cards: vm.hand, selectedCard: $vm.selectedCard)
                    actionBar(gs).padding(.bottom, 8)
                }
                .animation(.default, value: vm.gameState?.stressLevels)

                if vm.showMeltdownOverlay, let mpId = vm.meltdownPlayerId {
                    MeltdownOverlay(
                        playerName: gs.nameFor(mpId),
                        isMyTantrum: vm.isMyTantrum,
                        hand: vm.isMyTantrum ? vm.hand : [],
                        validTargets: vm.validTargets.map { (id: $0, name: gs.nameFor($0)) },
                        selectedCard: $vm.selectedCard,
                        selectedTarget: $vm.selectedTarget,
                        onPlayTantrum: { Task { await vm.playTantrum() } }
                    )
                }

                if vm.showPeekOverlay {
                    PeekOverlay(
                        playerName: vm.peekedPlayerName,
                        cards: vm.peekedCards,
                        onDismiss: { vm.dismissPeek() }
                    )
                }

                if gs.status == .roundEnd || gs.status == .gameEnd {
                    GameEndView(gameState: gs, myId: vm.myId) {
                        Task { await vm.startNextRound() }
                    }
                }
            } else {
                ProgressView("Loading game...")
            }
        }
        .navigationBarBackButtonHidden(true)
        .alert("Error", isPresented: .init(
            get: { vm.errorMessage != nil },
            set: { if !$0 { vm.errorMessage = nil } }
        )) {
            Button("OK") { vm.errorMessage = nil }
        } message: {
            Text(vm.errorMessage ?? "")
        }
    }

    private func opponentsBar(_ gs: GameState) -> some View {
        HStack(spacing: 16) {
            ForEach(vm.opponents, id: \.self) { pid in
                PlayerStatusView(
                    playerId: pid, gameState: gs,
                    isCurrentTurn: gs.currentPlayerId == pid,
                    isCompact: vm.opponents.count > 2
                )
                .onTapGesture {
                    guard vm.selectedCard != nil, vm.validTargets.contains(pid) else { return }
                    // If we're in Snap follow-up mode and the follow-up needs a target
                    if vm.selectedCard?.type == .snap, let followUp = vm.snapFollowUpCard, followUp.requiresTarget {
                        vm.snapFollowUpTarget = pid
                    } else if vm.selectedCard?.type == .chainReaction, vm.selectedTarget != nil {
                        // Second tap sets splash target
                        if pid != vm.selectedTarget {
                            vm.splashTarget = pid
                        }
                    } else {
                        vm.selectedTarget = pid
                    }
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(vm.selectedTarget == pid ? .yellow : .clear, lineWidth: 2)
                )
            }
        }
        .padding(.horizontal)
    }

    private func turnLogView(_ gs: GameState) -> some View {
        VStack(spacing: 4) {
            ForEach(gs.turnLog.suffix(3)) { entry in
                Text(entry.description)
                    .font(.caption).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal)
    }

    private func statusBar(_ gs: GameState) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Your Stress").font(.caption2).foregroundStyle(.secondary)
                StressMeterView(stress: gs.stressFor(vm.myId))
            }
            Spacer()
            VStack(spacing: 2) {
                Text("Round \(gs.round)").font(.caption.bold())
                if gs.isPressurePhase {
                    Text("PRESSURE").font(.caption2.bold()).foregroundStyle(.red)
                }
            }
            Spacer()
            VStack(spacing: 2) {
                if vm.isMyTurn {
                    Text("YOUR TURN")
                        .font(.caption.bold())
                        .foregroundStyle(.green)
                } else {
                    Text("\(gs.nameFor(gs.currentPlayerId))'s turn")
                        .font(.caption).foregroundStyle(.secondary)
                }
                if let deadline = gs.turnDeadline {
                    TurnTimerView(deadline: deadline, isSync: gs.mode == .sync)
                }
            }
        }
    }

    @ViewBuilder
    private func actionBar(_ gs: GameState) -> some View {
        if vm.isMyTurn, let card = vm.selectedCard {
            HStack(spacing: 12) {
                Button("Cancel") { vm.clearSelection() }.buttonStyle(.bordered)

                if card.type == .snap {
                    snapActionBar(gs, snapCard: card)
                } else if card.type == .chainReaction {
                    chainReactionActionBar(gs, card: card)
                } else if card.type == .deflect {
                    deflectActionBar(gs, card: card)
                } else if card.requiresTarget && vm.selectedTarget == nil {
                    Text("Tap an opponent").font(.caption).foregroundStyle(.orange)
                } else {
                    Button("Play") {
                        FeedbackManager.shared.cardPlayed()
                        Task { await vm.playSelectedCard() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(vm.isPlayingCard || (card.requiresTarget && vm.selectedTarget == nil))
                }
            }
            .padding(.horizontal)
        }
    }

    @ViewBuilder
    private func snapActionBar(_ gs: GameState, snapCard: Card) -> some View {
        if vm.snapFollowUpCard == nil {
            // Step 1: Select follow-up card
            VStack(spacing: 8) {
                Text("Pick a follow-up card").font(.caption).foregroundStyle(.orange)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        ForEach(vm.hand.filter({ $0.id != snapCard.id && $0.type != .snap })) { followUp in
                            CardView(card: followUp, isSelected: false, isSmall: true)
                                .onTapGesture {
                                    vm.snapFollowUpCard = followUp
                                }
                        }
                    }
                }
            }
        } else if vm.snapFollowUpCard!.requiresTarget && vm.snapFollowUpTarget == nil {
            // Step 2: Select target for follow-up
            Text("Tap target for \(vm.snapFollowUpCard!.name)").font(.caption).foregroundStyle(.orange)
        } else {
            // Ready to play
            VStack(spacing: 4) {
                Text("Snap → \(vm.snapFollowUpCard!.name)").font(.caption).foregroundStyle(.secondary)
                Button("Play") {
                    FeedbackManager.shared.cardPlayed()
                    Task { await vm.playSelectedCard() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.isPlayingCard)
            }
        }
    }

    @ViewBuilder
    private func chainReactionActionBar(_ gs: GameState, card: Card) -> some View {
        if vm.selectedTarget == nil {
            Text("Tap primary target").font(.caption).foregroundStyle(.orange)
        } else if vm.splashTarget == nil {
            VStack(spacing: 8) {
                Text("Primary: \(gs.nameFor(vm.selectedTarget!))").font(.caption).foregroundStyle(.secondary)
                Text("Tap splash target").font(.caption).foregroundStyle(.orange)
                HStack(spacing: 8) {
                    ForEach(vm.validTargets.filter({ $0 != vm.selectedTarget }), id: \.self) { pid in
                        Button(gs.nameFor(pid)) {
                            vm.splashTarget = pid
                        }
                        .buttonStyle(.bordered)
                        .tint(vm.splashTarget == pid ? .pink : nil)
                    }
                }
            }
        } else {
            VStack(spacing: 4) {
                Text("Target: \(gs.nameFor(vm.selectedTarget!)), Splash: \(gs.nameFor(vm.splashTarget!))").font(.caption).foregroundStyle(.secondary)
                Button("Play") {
                    FeedbackManager.shared.cardPlayed()
                    Task { await vm.playSelectedCard() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.isPlayingCard)
            }
        }
    }

    @ViewBuilder
    private func deflectActionBar(_ gs: GameState, card: Card) -> some View {
        if vm.deflectTarget == nil {
            VStack(spacing: 8) {
                Text("Redirect attacks to:").font(.caption).foregroundStyle(.orange)
                HStack(spacing: 8) {
                    ForEach(vm.validTargets, id: \.self) { pid in
                        Button(gs.nameFor(pid)) {
                            vm.deflectTarget = pid
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
        } else {
            VStack(spacing: 4) {
                Text("Deflect to \(gs.nameFor(vm.deflectTarget!))").font(.caption).foregroundStyle(.secondary)
                Button("Play") {
                    FeedbackManager.shared.cardPlayed()
                    Task { await vm.playSelectedCard() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.isPlayingCard)
            }
        }
    }
}
