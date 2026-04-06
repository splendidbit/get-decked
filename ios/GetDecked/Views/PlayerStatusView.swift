import SwiftUI

struct PlayerStatusView: View {
    let playerId: String
    let gameState: GameState
    let isCurrentTurn: Bool
    var isCompact: Bool = false
    var avatarId: String = "jello_knight"

    private var isEliminated: Bool { gameState.isEliminated(playerId) }
    private var stress: Int { gameState.stressFor(playerId) }
    private var name: String { gameState.nameFor(playerId) }
    private var character: GameCharacter { GameCharacter.forId(avatarId) }
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
                    .fill(isEliminated ? .gray : (isCurrentTurn ? .yellow : character.color).opacity(0.3))
                    .frame(width: isCompact ? 36 : 48, height: isCompact ? 36 : 48)
                    .overlay(
                        Circle().stroke(isCurrentTurn ? .yellow : .clear, lineWidth: 2)
                    )
                    .scaleEffect(isCurrentTurn ? 1.1 : 1.0)
                    .animation(.spring(duration: 0.3), value: isCurrentTurn)

                Image(systemName: character.icon)
                    .font(isCompact ? .caption : .body)
                    .foregroundStyle(isEliminated ? .secondary : character.color)

                if hasShield {
                    Image(systemName: "shield.fill").font(.caption2).foregroundStyle(.blue)
                        .offset(x: isCompact ? 14 : 20, y: isCompact ? -14 : -20)
                        .transition(.scale)
                }
                if hasDeflect {
                    Image(systemName: "arrow.uturn.right").font(.caption2).foregroundStyle(.purple)
                        .offset(x: isCompact ? -14 : -20, y: isCompact ? -14 : -20)
                        .transition(.scale)
                }
            }

            Text(name)
                .font(isCompact ? .caption2 : .caption)
                .lineLimit(1)

            if !isEliminated {
                StressMeterView(stress: stress, isCompact: isCompact)
            } else {
                Text("OUT")
                    .font(.caption2.bold())
                    .foregroundStyle(.red)
            }
        }
        .opacity(isEliminated ? 0.5 : 1)
    }
}
