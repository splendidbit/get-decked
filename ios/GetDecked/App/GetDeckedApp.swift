import SwiftUI
import FirebaseCore

@main
struct GetDeckedApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate

    var body: some Scene {
        WindowGroup {
            HomeView()
                .environmentObject(AuthService.shared)
                .onOpenURL { url in
                    if url.scheme == "getdecked",
                       url.host == "join",
                       let roomCode = url.pathComponents.last, roomCode.count == 4 {
                        DeepLinkHandler.shared.handleGameDeepLink(gameId: roomCode)
                    }
                }
        }
    }
}
