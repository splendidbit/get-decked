import SwiftUI

struct TurnTimerView: View {
    let deadline: Double
    let isSync: Bool
    @State private var timeRemaining: Int = 0

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        if isSync && timeRemaining >= 0 {
            HStack(spacing: 4) {
                Image(systemName: "clock.fill")
                    .font(.caption2)
                Text("\(timeRemaining)s")
                    .font(.caption.bold().monospacedDigit())
            }
            .foregroundStyle(timeRemaining <= 5 ? .red : .orange)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(timeRemaining <= 5 ? .red.opacity(0.15) : .orange.opacity(0.1))
            .clipShape(Capsule())
            .scaleEffect(timeRemaining <= 3 ? 1.1 : 1.0)
            .animation(.easeInOut(duration: 0.3), value: timeRemaining)
            .onReceive(timer) { _ in
                let remaining = Int((deadline - Date().timeIntervalSince1970 * 1000) / 1000)
                timeRemaining = max(0, remaining)
                if timeRemaining <= 3 && timeRemaining > 0 {
                    FeedbackManager.shared.turnStart()
                }
            }
            .onAppear {
                let remaining = Int((deadline - Date().timeIntervalSince1970 * 1000) / 1000)
                timeRemaining = max(0, remaining)
            }
        }
    }
}
