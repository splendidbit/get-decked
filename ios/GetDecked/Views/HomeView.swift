import SwiftUI
import AuthenticationServices

struct HomeView: View {
    @EnvironmentObject var auth: AuthService
    @StateObject private var vm = HomeViewModel()
    @StateObject private var deepLink = DeepLinkHandler.shared
    @State private var nameInput = ""

    var body: some View {
        NavigationStack {
            if !auth.isSignedIn {
                signInView
            } else if auth.displayName == "Player" || auth.displayName.isEmpty {
                namePromptView
            } else {
                mainMenuView
            }
        }
        .onChange(of: deepLink.pendingGameId) { _, gameId in
            if let gameId { vm.activeGameId = gameId }
        }
    }

    private var signInView: some View {
        VStack(spacing: 24) {
            Text("GET DECKED")
                .font(.system(size: 48, weight: .black))
            Text("The Card Game That Melts Friendships")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [.fullName]
            } onCompletion: { result in
                Task {
                    if case .success(let auth) = result,
                       let credential = auth.credential as? ASAuthorizationAppleIDCredential {
                        try? await self.auth.signInWithApple(credential: credential)
                    }
                }
            }
            .frame(height: 50)
            .padding(.horizontal, 40)
            Button("Play as Guest") {
                Task { try? await auth.signInAnonymously() }
            }
            .font(.headline)
            Spacer()
        }
        .padding()
    }

    private var namePromptView: some View {
        VStack(spacing: 20) {
            Text("What should we call you?")
                .font(.title2.bold())
            TextField("Your name", text: $nameInput)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 40)
            Button("Let's Go") {
                Task { await auth.updateDisplayName(nameInput) }
            }
            .disabled(nameInput.trimmingCharacters(in: .whitespaces).isEmpty)
            .buttonStyle(.borderedProminent)
        }
    }

    private var mainMenuView: some View {
        VStack(spacing: 20) {
            Text("GET DECKED")
                .font(.system(size: 40, weight: .black))
            Text("Hey, \(auth.displayName)")
                .font(.headline)
                .foregroundStyle(.secondary)
            Spacer()
            Button("Create Game") { vm.showCreateGame = true }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            Button("Join Game") { vm.showJoinGame = true }
                .buttonStyle(.bordered)
                .controlSize(.large)
            Spacer()
            if let error = vm.errorMessage {
                Text(error).foregroundStyle(.red).font(.caption)
            }
        }
        .padding()
        .sheet(isPresented: $vm.showCreateGame) {
            CreateGameSheet(vm: vm, displayName: auth.displayName)
        }
        .sheet(isPresented: $vm.showJoinGame) {
            JoinGameSheet(vm: vm, displayName: auth.displayName)
        }
        .navigationDestination(item: $vm.activeGameId) { gameId in
            LobbyView(gameId: gameId)
        }
    }
}

struct CreateGameSheet: View {
    @ObservedObject var vm: HomeViewModel
    let displayName: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("New Game").font(.title2.bold())
                Picker("Mode", selection: $vm.selectedMode) {
                    Text("Real-Time").tag(GameMode.sync)
                    Text("Async").tag(GameMode.async)
                }
                .pickerStyle(.segmented)
                Button("Create") {
                    Task {
                        await vm.createGame(displayName: displayName)
                        dismiss()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.isLoading)
            }
            .padding()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

struct JoinGameSheet: View {
    @ObservedObject var vm: HomeViewModel
    let displayName: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("Join Game").font(.title2.bold())
                TextField("Room Code", text: $vm.joinRoomCode)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.characters)
                    .frame(width: 160)
                    .font(.title.monospaced())
                    .multilineTextAlignment(.center)
                Button("Join") {
                    Task {
                        await vm.joinGame(displayName: displayName)
                        dismiss()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.joinRoomCode.count != 4 || vm.isLoading)
            }
            .padding()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}
