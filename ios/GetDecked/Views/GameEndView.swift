import SwiftUI

struct GameEndView: View {
    let gameState: GameState
    let myId: String
    let onNextRound: () -> Void

    private var winnerId: String? { gameState.activePlayers.first }
    private var isGameOver: Bool { gameState.status == .gameEnd }

    var body: some View {
        ZStack {
            Color.black.opacity(0.7).ignoresSafeArea()
            VStack(spacing: 20) {
                if isGameOver {
                    Text("GAME OVER")
                        .font(.system(size: 40, weight: .black)).foregroundStyle(.yellow)
                } else {
                    Text("ROUND \(gameState.round) OVER")
                        .font(.system(size: 32, weight: .black)).foregroundStyle(.yellow)
                }
                if let wid = winnerId {
                    Text("\(gameState.nameFor(wid)) wins!")
                        .font(.title).foregroundStyle(.white)
                }
                VStack(spacing: 8) {
                    ForEach(gameState.players, id: \.self) { pid in
                        HStack {
                            Text(gameState.nameFor(pid)).foregroundStyle(.white)
                            Spacer()
                            Text("\(gameState.roundWins[pid] ?? 0) / \(gameState.roundsToWin)")
                                .font(.headline)
                                .foregroundStyle(pid == winnerId ? .yellow : .white.opacity(0.7))
                        }
                        .padding(.horizontal, 40)
                    }
                }
                if isGameOver {
                    Button("Rematch") { onNextRound() }
                        .buttonStyle(.borderedProminent).controlSize(.large)
                    Button("Share Result") {
                        let message = ShareHelper.shareGameResult(gameState: gameState, events: [])
                        let av = UIActivityViewController(activityItems: [message], applicationActivities: nil)
                        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                           let root = scene.windows.first?.rootViewController {
                            root.present(av, animated: true)
                        }
                    }
                    .buttonStyle(.bordered).tint(.white)
                } else {
                    Button("Next Round") { onNextRound() }
                        .buttonStyle(.borderedProminent).controlSize(.large)
                }
            }
        }
    }
}
