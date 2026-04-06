import SwiftUI

struct PeekOverlay: View {
    let playerName: String
    let cards: [Card]
    let onDismiss: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
                .onTapGesture { onDismiss() }

            VStack(spacing: 16) {
                HStack {
                    Image(systemName: "eye.fill")
                        .foregroundStyle(.indigo)
                    Text("\(playerName)'s Hand")
                        .font(.title2.bold())
                }

                if cards.isEmpty {
                    Text("Peek played! Full hand reveal requires server sync.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding()
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(cards) { card in
                                CardView(card: card, isSmall: false)
                            }
                        }
                        .padding(.horizontal)
                    }
                }

                Button("Got it") { onDismiss() }
                    .buttonStyle(.borderedProminent)
                    .tint(.indigo)
            }
            .padding(24)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 20))
            .padding(32)
        }
    }
}
