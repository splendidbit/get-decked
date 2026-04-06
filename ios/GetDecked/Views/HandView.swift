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
                        .animation(.spring(duration: 0.2), value: selectedCard?.id)
                        .onTapGesture {
                            if selectedCard?.id == card.id {
                                selectedCard = nil
                            } else {
                                selectedCard = card
                            }
                        }
                }
            }
            .padding(.horizontal, 20)
        }
        .frame(height: 150)
    }
}
