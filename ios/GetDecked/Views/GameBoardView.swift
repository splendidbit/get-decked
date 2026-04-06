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
                    if vm.selectedCard != nil && vm.validTargets.contains(pid) {
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
            if vm.isMyTurn {
                Text("YOUR TURN").font(.caption.bold()).foregroundStyle(.green)
            } else {
                Text("\(gs.nameFor(gs.currentPlayerId))'s turn")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func actionBar(_ gs: GameState) -> some View {
        if vm.isMyTurn, let card = vm.selectedCard {
            HStack(spacing: 12) {
                Button("Cancel") { vm.clearSelection() }.buttonStyle(.bordered)
                if card.requiresTarget && vm.selectedTarget == nil {
                    Text("Tap an opponent").font(.caption).foregroundStyle(.orange)
                } else if card.requiresRedirectTarget && vm.deflectTarget == nil {
                    Menu("Deflect to...") {
                        ForEach(vm.validTargets, id: \.self) { pid in
                            Button(gs.nameFor(pid)) { vm.deflectTarget = pid }
                        }
                    }
                } else {
                    Button("Play") {
                        Task { await vm.playSelectedCard() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(vm.isPlayingCard || (card.requiresTarget && vm.selectedTarget == nil))
                }
            }
            .padding(.horizontal)
        }
    }
}
