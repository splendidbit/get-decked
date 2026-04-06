import Foundation

@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()

    func updateFCMToken(_ token: String) async {}
}
