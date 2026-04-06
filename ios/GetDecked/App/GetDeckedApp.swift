import SwiftUI
import FirebaseCore

@main
struct GetDeckedApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(AuthService.shared)
        }
    }
}
