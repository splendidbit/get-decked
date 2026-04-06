import SwiftUI

struct LaunchScreenView: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 1, green: 0.23, blue: 0.19), Color(red: 1, green: 0.42, blue: 0.21)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 8) {
                Text("GET")
                    .font(.system(size: 56, weight: .black))
                    .foregroundStyle(.white)
                Text("DECKED")
                    .font(.system(size: 56, weight: .black))
                    .foregroundStyle(.yellow)
            }
        }
    }
}
