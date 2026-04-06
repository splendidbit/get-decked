import SwiftUI

struct HandView: View {
    let cards: [Card]
    @Binding var selectedCard: Card?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: -20) {
                ForEach(Array(cards.enumerated()), id: \.element.id) { index, card in
                    CardView(card: card, isSelected: selectedCard?.id == card.id)
                        .zIndex(selectedCard?.id == card.id ? 10 : Double(index))
                        .offset(y: selectedCard?.id == card.id ? -20 : 0)
                        .rotationEffect(.degrees(Double(index - cards.count / 2) * 2))
                        .animation(.spring(duration: 0.25, bounce: 0.3), value: selectedCard?.id)
                        .onTapGesture {
                            withAnimation(.spring(duration: 0.2)) {
                                if selectedCard?.id == card.id {
                                    selectedCard = nil
                                } else {
                                    selectedCard = card
                                    FeedbackManager.shared.turnStart()
                                }
                            }
                        }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
        }
        .frame(height: 160)
    }
}
