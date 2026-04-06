import SwiftUI

struct MeltdownOverlay: View {
    let playerName: String
    let isMyTantrum: Bool
    let hand: [Card]
    let validTargets: [(id: String, name: String)]
    @Binding var selectedCard: Card?
    @Binding var selectedTarget: String?
    let onPlayTantrum: () -> Void

    @State private var shakeOffset: CGFloat = 0
    @State private var showContent = false
    @State private var pulseScale: CGFloat = 1.0

    var body: some View {
        ZStack {
            Color.black.opacity(0.7).ignoresSafeArea()
                .onAppear {
                    FeedbackManager.shared.meltdown()
                }

            VStack(spacing: 20) {
                Text("MELTDOWN!")
                    .font(.system(size: 44, weight: .black))
                    .foregroundStyle(.red)
                    .scaleEffect(pulseScale)
                    .offset(x: shakeOffset)
                    .onAppear {
                        // Shake animation
                        withAnimation(.easeInOut(duration: 0.05).repeatCount(8, autoreverses: true)) {
                            shakeOffset = 10
                        }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                            shakeOffset = 0
                        }
                        // Pulse animation
                        withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) {
                            pulseScale = 1.1
                        }
                        withAnimation(.spring(duration: 0.5)) {
                            showContent = true
                        }
                    }

                Text("\(playerName) hit stress 10!")
                    .font(.title3).foregroundStyle(.white)

                if showContent {
                    if isMyTantrum {
                        tantrumControls
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    } else {
                        VStack(spacing: 12) {
                            Text("Waiting for \(playerName)'s tantrum...")
                                .foregroundStyle(.white.opacity(0.7))
                            ProgressView().tint(.white)
                        }
                        .transition(.opacity)
                    }
                }
            }
            .padding()
        }
    }

    private var tantrumControls: some View {
        VStack(spacing: 16) {
            Text("Choose a card for your tantrum")
                .font(.headline).foregroundStyle(.orange)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(hand) { card in
                        CardView(card: card, isSelected: selectedCard?.id == card.id, isSmall: true)
                            .onTapGesture {
                                withAnimation(.spring(duration: 0.2)) {
                                    selectedCard = card
                                    FeedbackManager.shared.cardPlayed()
                                }
                            }
                    }
                }
                .padding(.horizontal)
            }

            if selectedCard != nil {
                Text("Pick your target:").font(.subheadline).foregroundStyle(.white)
                HStack(spacing: 12) {
                    ForEach(validTargets, id: \.id) { target in
                        Button(target.name) {
                            withAnimation(.spring(duration: 0.2)) {
                                selectedTarget = target.id
                            }
                        }
                        .buttonStyle(.bordered)
                        .tint(selectedTarget == target.id ? .red : .white)
                    }
                }
            }

            if selectedCard != nil && selectedTarget != nil {
                let damage = selectedCard!.type == .stress ? selectedCard!.value * 2 : 3
                Text("Tantrum damage: \(damage)")
                    .font(.headline).foregroundStyle(.orange)
                Button("TANTRUM!") {
                    FeedbackManager.shared.tantrum()
                    onPlayTantrum()
                }
                .buttonStyle(.borderedProminent).tint(.red).controlSize(.large)
                .transition(.scale)
            }
        }
    }
}
