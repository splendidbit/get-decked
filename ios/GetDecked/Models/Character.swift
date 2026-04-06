import SwiftUI

struct GameCharacter: Identifiable, Codable {
    let id: String
    let name: String
    let icon: String  // SF Symbol name
    let colorName: String
    let meltdownEmoji: String
    let description: String

    var color: Color {
        switch colorName {
        case "red": return .red
        case "blue": return .blue
        case "green": return .green
        case "purple": return .purple
        case "orange": return .orange
        default: return .gray
        }
    }
}

extension GameCharacter {
    static let allCharacters: [GameCharacter] = [
        GameCharacter(
            id: "jello_knight",
            name: "Jello Knight",
            icon: "shield.lefthalf.filled",
            colorName: "green",
            meltdownEmoji: "🟢",
            description: "A wobbly warrior of questionable structural integrity."
        ),
        GameCharacter(
            id: "tax_return",
            name: "Sentient Tax Return",
            icon: "doc.text.fill",
            colorName: "red",
            meltdownEmoji: "📄",
            description: "Arrived unexpectedly. Demands your attention. Will not leave."
        ),
        GameCharacter(
            id: "existential_avocado",
            name: "Existential Avocado",
            icon: "leaf.fill",
            colorName: "green",
            meltdownEmoji: "🥑",
            description: "Perpetually worried about being ripe enough."
        ),
    ]

    static let defaultCharacter = allCharacters[0]

    static func forId(_ id: String) -> GameCharacter {
        allCharacters.first { $0.id == id } ?? defaultCharacter
    }
}
