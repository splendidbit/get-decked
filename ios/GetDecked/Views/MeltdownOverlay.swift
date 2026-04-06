import SwiftUI

struct MeltdownOverlay: View {
    let playerName: String
    let isMyTantrum: Bool
    let hand: [Card]
    let validTargets: [(id: String, name: String)]
    @Binding var selectedCard: Card?
    @Binding var selectedTarget: String?
    let onPlayTantrum: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.7).ignoresSafeArea()
            VStack(spacing: 20) {
                Text("MELTDOWN!")
                    .font(.system(size: 44, weight: .black))
                    .foregroundStyle(.red)
                Text("\(playerName) hit stress 10!")
                    .font(.title3).foregroundStyle(.white)

                if isMyTantrum {
                    Text("Choose a card for your tantrum")
                        .font(.headline).foregroundStyle(.orange)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(hand) { card in
                                CardView(card: card, isSelected: selectedCard?.id == card.id, isSmall: true)
                                    .onTapGesture { selectedCard = card }
                            }
                        }
                        .padding(.horizontal)
                    }
                    if selectedCard != nil {
                        Text("Pick your target:").font(.subheadline).foregroundStyle(.white)
                        HStack(spacing: 12) {
                            ForEach(validTargets, id: \.id) { target in
                                Button(target.name) { selectedTarget = target.id }
                                    .buttonStyle(.bordered)
                                    .tint(selectedTarget == target.id ? .red : .white)
                            }
                        }
                    }
                    if selectedCard != nil && selectedTarget != nil {
                        let damage = selectedCard!.type == .stress ? selectedCard!.value * 2 : 3
                        Text("Tantrum damage: \(damage)")
                            .font(.headline).foregroundStyle(.orange)
                        Button("TANTRUM!") { onPlayTantrum() }
                            .buttonStyle(.borderedProminent).tint(.red).controlSize(.large)
                    }
                } else {
                    Text("Waiting for \(playerName)'s tantrum...")
                        .foregroundStyle(.white.opacity(0.7))
                    ProgressView().tint(.white)
                }
            }
            .padding()
        }
    }
}
