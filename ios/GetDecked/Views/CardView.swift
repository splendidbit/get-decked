import SwiftUI

struct CardView: View {
    let card: Card
    var isSelected: Bool = false
    var isSmall: Bool = false

    private var width: CGFloat { isSmall ? 60 : 90 }
    private var height: CGFloat { isSmall ? 84 : 126 }

    var body: some View {
        VStack(spacing: 4) {
            if card.isStress {
                Text("+\(card.value)")
                    .font(isSmall ? .caption.bold() : .title3.bold())
                    .foregroundStyle(.white)
            } else if card.isChill {
                Text("-\(card.value)")
                    .font(isSmall ? .caption.bold() : .title3.bold())
                    .foregroundStyle(.white)
            } else {
                Image(systemName: iconName)
                    .font(isSmall ? .caption : .title3)
                    .foregroundStyle(.white)
            }
            Text(card.name)
                .font(.system(size: isSmall ? 7 : 9, weight: .medium))
                .foregroundStyle(.white.opacity(0.9))
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
        .frame(width: width, height: height)
        .background(cardColor.gradient)
        .clipShape(RoundedRectangle(cornerRadius: isSmall ? 8 : 12))
        .overlay(
            RoundedRectangle(cornerRadius: isSmall ? 8 : 12)
                .stroke(isSelected ? .yellow : .clear, lineWidth: 3)
        )
        .shadow(color: isSelected ? .yellow.opacity(0.5) : .black.opacity(0.2), radius: isSelected ? 8 : 4)
    }

    private var cardColor: Color {
        switch card.type {
        case .stress: return .red
        case .chill: return .blue
        case .zen: return .cyan
        case .dump: return .orange
        case .shield: return .gray
        case .deflect: return .purple
        case .snap: return .yellow
        case .chainReaction: return .pink
        case .swap: return .green
        case .peek: return .indigo
        }
    }

    private var iconName: String {
        switch card.type {
        case .zen: return "sparkles"
        case .dump: return "arrow.right"
        case .shield: return "shield.fill"
        case .deflect: return "arrow.uturn.right"
        case .snap: return "bolt.fill"
        case .chainReaction: return "flame.fill"
        case .swap: return "arrow.left.arrow.right"
        case .peek: return "eye.fill"
        default: return "questionmark"
        }
    }
}
