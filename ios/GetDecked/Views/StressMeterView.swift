import SwiftUI

struct StressMeterView: View {
    let stress: Int
    let maxStress: Int = 10
    var isCompact: Bool = false

    private var fillRatio: CGFloat { CGFloat(min(stress, maxStress)) / CGFloat(maxStress) }

    private var meterColor: Color {
        switch stress {
        case 0...3: return .green
        case 4...6: return .yellow
        case 7...8: return .orange
        default: return .red
        }
    }

    var body: some View {
        VStack(spacing: 2) {
            Text("\(stress)")
                .font(isCompact ? .caption.bold() : .title2.bold())
                .foregroundStyle(stress >= 8 ? .red : .primary)
                .contentTransition(.numericText())
                .animation(.spring(duration: 0.3), value: stress)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(.secondary.opacity(0.2))
                    RoundedRectangle(cornerRadius: 4)
                        .fill(meterColor.gradient)
                        .frame(width: geo.size.width * fillRatio)
                        .animation(.spring(duration: 0.5, bounce: 0.2), value: stress)
                }
            }
            .frame(height: isCompact ? 6 : 10)
        }
        .frame(width: isCompact ? 40 : 60)
    }
}
