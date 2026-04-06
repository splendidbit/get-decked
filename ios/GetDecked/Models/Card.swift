import Foundation

enum CardType: String, Codable, CaseIterable {
    case stress
    case chill
    case zen
    case dump
    case shield
    case deflect
    case snap
    case chainReaction
    case swap
    case peek
}

struct Card: Identifiable, Codable, Equatable {
    let id: String
    let type: CardType
    let name: String
    let description: String
    let value: Int

    var isStress: Bool { type == .stress }
    var isChill: Bool { type == .chill }
    var isSpecial: Bool { !isStress && !isChill }
    var requiresTarget: Bool {
        [.stress, .dump, .chainReaction, .swap, .peek].contains(type)
    }
    var requiresRedirectTarget: Bool { type == .deflect }
    var requiresSplashTarget: Bool { type == .chainReaction }
    var requiresFollowUp: Bool { type == .snap }
}
