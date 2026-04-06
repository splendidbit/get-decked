import SwiftUI

struct StatsView: View {
    @EnvironmentObject var auth: AuthService

    private var stats: PlayerStats { auth.profile?.stats ?? .empty }

    var body: some View {
        List {
            Section("Your Stats") {
                StatRow(label: "Games Played", value: "\(stats.gamesPlayed)")
                StatRow(label: "Wins", value: "\(stats.wins)")
                StatRow(label: "Win Rate", value: stats.gamesPlayed > 0
                    ? "\(Int(Double(stats.wins) / Double(stats.gamesPlayed) * 100))%"
                    : "—")
                StatRow(label: "Meltdowns Caused", value: "\(stats.meltdownsCaused)")
                StatRow(label: "Tantrums Thrown", value: "\(stats.tantrums)")
            }
        }
        .navigationTitle("Stats")
    }
}

struct StatRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
            Spacer()
            Text(value).font(.headline).foregroundStyle(.secondary)
        }
    }
}
