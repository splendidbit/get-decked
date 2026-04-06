import Foundation

struct UserProfile: Codable {
    var displayName: String
    var avatarId: String
    var cardBackId: String
    var meltdownEffectId: String
    var stats: PlayerStats
    var coins: Int
    var ownedCosmetics: [String]
    var fcmToken: String?
}

struct PlayerStats: Codable {
    var gamesPlayed: Int
    var wins: Int
    var meltdownsCaused: Int
    var tantrums: Int

    static let empty = PlayerStats(gamesPlayed: 0, wins: 0, meltdownsCaused: 0, tantrums: 0)
}
