import Foundation
import FirebaseAuth
import FirebaseFirestore
import AuthenticationServices

@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var userId: String?
    @Published var displayName: String = ""
    @Published var isSignedIn: Bool = false
    @Published var profile: UserProfile?

    private let db = Firestore.firestore()

    private init() {
        if let user = Auth.auth().currentUser {
            self.userId = user.uid
            self.isSignedIn = true
            Task { await loadProfile() }
        }
    }

    func signInAnonymously() async throws {
        let result = try await Auth.auth().signInAnonymously()
        self.userId = result.user.uid
        self.isSignedIn = true
        await createProfileIfNeeded()
    }

    func signInWithApple(credential: ASAuthorizationAppleIDCredential) async throws {
        guard let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else {
            throw NSError(domain: "auth", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid token"])
        }
        let oauthCredential = OAuthProvider.appleCredential(
            withIDToken: token,
            rawNonce: nil,
            fullName: credential.fullName
        )
        let result = try await Auth.auth().signIn(with: oauthCredential)
        self.userId = result.user.uid
        self.isSignedIn = true

        if let fullName = credential.fullName {
            let name = [fullName.givenName, fullName.familyName]
                .compactMap { $0 }
                .joined(separator: " ")
            if !name.isEmpty { self.displayName = name }
        }

        await createProfileIfNeeded()
    }

    func updateFCMToken(_ token: String) async {
        guard let uid = userId else { return }
        try? await db.collection("users").document(uid).updateData([
            "fcmToken": token
        ])
    }

    private func createProfileIfNeeded() async {
        guard let uid = userId else { return }
        let doc = db.collection("users").document(uid)
        let snapshot = try? await doc.getDocument()

        if snapshot?.exists != true {
            let newProfile = UserProfile(
                displayName: displayName.isEmpty ? "Player" : displayName,
                avatarId: "default",
                cardBackId: "default",
                meltdownEffectId: "default",
                stats: .empty,
                coins: 0,
                ownedCosmetics: ["default"],
                fcmToken: nil
            )
            try? await doc.setData(try Firestore.Encoder().encode(newProfile))
            self.profile = newProfile
        } else {
            await loadProfile()
        }
    }

    func loadProfile() async {
        guard let uid = userId else { return }
        let doc = try? await db.collection("users").document(uid).getDocument()
        self.profile = try? doc?.data(as: UserProfile.self)
        self.displayName = profile?.displayName ?? "Player"
    }

    func updateDisplayName(_ name: String) async {
        guard let uid = userId else { return }
        self.displayName = name
        try? await db.collection("users").document(uid).updateData([
            "displayName": name
        ])
    }
}
