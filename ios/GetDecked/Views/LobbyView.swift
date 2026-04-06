import SwiftUI

struct LobbyView: View {
    @StateObject private var vm: LobbyViewModel
    @EnvironmentObject var auth: AuthService

    init(gameId: String) {
        _vm = StateObject(wrappedValue: LobbyViewModel(gameId: gameId))
    }

    var body: some View {
        VStack(spacing: 24) {
            if let gs = vm.gameState {
                Text("LOBBY").font(.title.bold())

                VStack(spacing: 4) {
                    Text("Room Code").font(.caption).foregroundStyle(.secondary)
                    Text(gs.roomCode)
                        .font(.system(size: 48, weight: .black, design: .monospaced))
                }

                Text(gs.mode == .sync ? "Real-Time" : "Async")
                    .font(.caption)
                    .padding(.horizontal, 12).padding(.vertical, 4)
                    .background(.secondary.opacity(0.2))
                    .clipShape(Capsule())

                VStack(spacing: 12) {
                    ForEach(gs.players, id: \.self) { pid in
                        HStack {
                            Image(systemName: "person.fill")
                            Text(gs.nameFor(pid)).font(.headline)
                            Spacer()
                            if pid == gs.hostId {
                                Text("HOST").font(.caption2.bold())
                                    .padding(.horizontal, 8).padding(.vertical, 2)
                                    .background(.orange).foregroundStyle(.white)
                                    .clipShape(Capsule())
                            }
                        }
                        .padding()
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(.horizontal)

                Text("\(gs.players.count)/4 players").foregroundStyle(.secondary)
                Spacer()

                Button {
                    ShareHelper.shareGameInvite(roomCode: gs.roomCode, gameId: gs.id)
                } label: {
                    Label("Invite Friends", systemImage: "square.and.arrow.up")
                }

                if gs.hostId == auth.userId {
                    Button("Start Game") {
                        Task { await vm.startGame() }
                    }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                    .disabled(gs.players.count < 2 || vm.isStarting)
                } else {
                    Text("Waiting for host to start...").foregroundStyle(.secondary)
                }
            } else {
                ProgressView("Loading...")
            }
        }
        .padding()
        .navigationDestination(isPresented: $vm.navigateToGame) {
            if let gs = vm.gameState, let myId = auth.userId {
                GameBoardView(gameId: gs.id, myId: myId)
            }
        }
    }
}
