import SwiftUI

struct TutorialView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var step = 0

    private let steps: [(title: String, body: String)] = [
        (
            "Welcome to Get Decked!",
            "Push your friends' stress to 10 — when someone melts down, they get one explosive tantrum for revenge. Last player calm wins!"
        ),
        (
            "Your Turn",
            "Draw 1 card, then play 1 card. Red stress cards attack opponents. Blue chill cards reduce your own stress."
        ),
        (
            "Special Cards",
            "Shield blocks the next attack. Deflect redirects it. Dump transfers your stress to someone else. Snap lets you play two cards!"
        ),
        (
            "The Meltdown",
            "Hit stress 10 and you MELT DOWN — you're eliminated from the round. But you get a Meltdown Tantrum: one last card at double power!"
        ),
        (
            "The Zen Card",
            "Only 2 in the deck. Resets your stress to 0. The ultimate comeback card. Use it wisely."
        ),
        (
            "Winning",
            "Last player standing wins the round. Win best of 3 rounds to win the game. That's it — go melt some friendships!"
        ),
    ]

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Text(steps[step].title)
                .font(.title.bold())
                .multilineTextAlignment(.center)
            Text(steps[step].body)
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 32)
            HStack(spacing: 8) {
                ForEach(0..<steps.count, id: \.self) { i in
                    Circle()
                        .fill(i == step ? Color.primary : Color.secondary.opacity(0.3))
                        .frame(width: 8, height: 8)
                }
            }
            Spacer()
            HStack {
                if step > 0 {
                    Button("Back") { withAnimation { step -= 1 } }
                        .buttonStyle(.bordered)
                }
                Spacer()
                if step < steps.count - 1 {
                    Button("Next") { withAnimation { step += 1 } }
                        .buttonStyle(.borderedProminent)
                } else {
                    Button("Let's Play!") { dismiss() }
                        .buttonStyle(.borderedProminent)
                }
            }
            .padding(.horizontal, 32)
            .padding(.bottom)
        }
        .padding()
    }
}
