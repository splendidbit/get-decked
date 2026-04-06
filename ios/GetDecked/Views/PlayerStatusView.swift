import SwiftUI

struct PlayerStatusView: View {
    let playerId: String
    let gameState: GameState
    let isCurrentTurn: Bool
    var isCompact: Bool = false

    private var isEliminated: Bool { gameState.isEliminated(playerId) }
    private var stress: Int { gameState.stressFor(playerId) }
    private var name: String { gameState.nameFor(playerId) }
    private var hasShield: Bool {
        (gameState.activeEffects[playerId] ?? []).contains { $0.type == "shield" }
    }
    private var hasDeflect: Bool {
        (gameState.activeEffects[playerId] ?? []).contains { $0.type == "deflect" }
    }

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle()
                    .fill(isEliminated ? .gray : (isCurrentTurn ? .yellow : .secondary).opacity(0.3))
                    .frame(width: isCompact ? 36 : 48, height: isCompact ? 36 : 48)
                Text(String(name.prefix(1)).uppercased())
                    .font(isCompact ? .caption.bold() : .headline)
                    .foregroundStyle(isEliminated ? .secondary : .primary)
                if hasShield {
                    Image(systemName: "shield.fill").font(.caption2).foregroundStyle(.blue)
                        .offset(x: isCompact ? 14 : 20, y: isCompact ? -14 : -20)
                }
                if hasDeflect {
                    Image(systemName: "arrow.uturn.right").font(.caption2).foregroundStyle(.purple)
                        .offset(x: isCompact ? -14 : -20, y: isCompact ? -14 : -20)
                }
            }
            Text(name).font(isCompact ? .caption2 : .caption).lineLimit(1)
            if !isEliminated {
                StressMeterView(stress: stress, isCompact: isCompact)
            } else {
                Text("OUT").font(.caption2.bold()).foregroundStyle(.red)
            }
        }
        .opacity(isEliminated ? 0.5 : 1)
    }
}
