import Foundation

/// Game balance values that can be tuned server-side via Firebase Remote Config.
/// For MVP, these are hardcoded defaults. When Firebase Remote Config is integrated,
/// the `fetch()` method will pull live values.
@MainActor
class ConfigService: ObservableObject {
    static let shared = ConfigService()

    // Starting conditions
    var startingStress: Int = 3
    var roundsToWin3Plus: Int = 3
    var roundsToWin2Player: Int = 5

    // Card balance
    var dumpTransferAmount: Int = 2
    var chainReactionDamage: Int = 2
    var chainReactionSplash: Int = 2

    // Tantrum
    var tantrumStressMultiplier: Int = 2
    var tantrumFlatDamage: Int = 3

    // Pressure
    var pressureStressPerCycle: Int = 1

    // Timers
    var syncTurnSeconds: Int = 15
    var asyncTurnHours: Int = 24
    var reminderAfterHours: Int = 4

    private init() {}

    /// Placeholder for Firebase Remote Config fetch.
    /// Replace this body with actual Remote Config calls when ready.
    func fetch() async {
        // TODO: Integrate Firebase Remote Config SDK
        // let remoteConfig = RemoteConfig.remoteConfig()
        // try? await remoteConfig.fetchAndActivate()
        // startingStress = remoteConfig["starting_stress"].numberValue.intValue
        // ... etc
    }
}
