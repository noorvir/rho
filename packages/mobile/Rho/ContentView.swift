import Security
import SwiftUI
import WebKit

enum RootScreen {
    case home
    case app(InstalledApp)
    case search
    case settings
}

struct InstalledApp: Identifiable, Equatable {
    let id: String
    let name: String
    let color: Color
    let url: URL

    static let examples = [
        InstalledApp(id: "workout", name: "Workout tracker", color: .blue, url: URL(string: "https://example.com")!),
        InstalledApp(id: "german", name: "German lessons", color: .purple, url: URL(string: "https://example.com")!),
        InstalledApp(id: "email", name: "Email management", color: .green, url: URL(string: "https://example.com")!),
        InstalledApp(id: "agent", name: "Coding agent", color: .orange, url: URL(string: "https://example.com")!),
    ]
}

struct ContentView: View {
    @StateObject private var authStore = AuthStore()
    @State private var screen: RootScreen = .home
    @State private var isChatPresented = false

    var body: some View {
        Group {
            if authStore.isAuthenticated {
                AppShellView(
                    bottomBar: .root(
                        screen: screen,
                        apps: InstalledApp.examples,
                        selectScreen: { screen = $0 },
                        openChat: { isChatPresented = true }
                    )
                ) {
                    RootScreenView(screen: screen, authStore: authStore)
                }
                .sheet(isPresented: $isChatPresented) {
                    ChatSheetView(authStore: authStore)
                        .presentationDetents([.large])
                        .presentationDragIndicator(.hidden)
                        .presentationCornerRadius(18)
                }
            } else {
                LoginView(authStore: authStore)
            }
        }
        .dynamicTypeSize(.medium)
        .preferredColorScheme(.light)
    }
}

private struct LoginView: View {
    @ObservedObject var authStore: AuthStore
    @State private var password = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Spacer(minLength: 0)

            Text("rho")
                .font(.system(size: 13, weight: .medium))
                .textCase(.uppercase)
                .tracking(4)
                .foregroundStyle(.secondary)

            Text("Connect to your workspace")
                .font(.system(size: 28, weight: .semibold))

            Text("Use the owner password you set on the web dashboard. Tokens are stored in Keychain on this device.")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 12) {
                TextField("Server URL", text: $authStore.serverURLText)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                    .textFieldStyle(.plain)
                    .padding(14)
                    .background(Color.black.opacity(0.035), in: RoundedRectangle(cornerRadius: 10, style: .continuous))

                SecureField("Owner password", text: $password)
                    .textFieldStyle(.plain)
                    .padding(14)
                    .background(Color.black.opacity(0.035), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            if let errorText = authStore.errorText {
                Text(errorText)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button {
                let password = password
                Task {
                    await authStore.login(password: password)
                }
            } label: {
                HStack {
                    Spacer()
                    if authStore.isLoggingIn {
                        ProgressView()
                    } else {
                        Text("Log in")
                            .font(.system(size: 16, weight: .semibold))
                    }
                    Spacer()
                }
                .frame(height: 48)
                .foregroundStyle(.white)
                .background(Color.black, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(authStore.isLoggingIn || password.isEmpty || authStore.serverURLText.isEmpty)

            Spacer(minLength: 0)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(Color.white.ignoresSafeArea())
    }
}

private struct RootScreenView: View {
    let screen: RootScreen
    @ObservedObject var authStore: AuthStore

    var body: some View {
        switch screen {
        case .home:
            PlaceholderScreen(title: "Home", subtitle: "Your rho workspace")
        case .app(let app):
            AppWebView(app: app)
        case .search:
            PlaceholderScreen(title: "Search", subtitle: "Find apps, sessions, and saved work")
        case .settings:
            SettingsScreen(authStore: authStore)
        }
    }
}

private struct PlaceholderScreen: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .frame(maxWidth: .infinity)

            Text(subtitle)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(.secondary)
                .padding(.top, 28)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
        .padding(.top, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct SettingsScreen: View {
    @ObservedObject var authStore: AuthStore

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Settings")
                .font(.system(size: 17, weight: .semibold))
                .frame(maxWidth: .infinity)

            VStack(alignment: .leading, spacing: 12) {
                SettingsRow(label: "Chat environment", value: MobileBuildInfo.chatEnvironment)
                SettingsRow(label: "Chat endpoint", value: authStore.baseURL.absoluteString)
                SettingsRow(label: "Version", value: MobileBuildInfo.version)
                SettingsRow(label: "Bundle", value: MobileBuildInfo.bundleIdentifier)
            }
            .padding(16)
            .background(Color.black.opacity(0.035), in: RoundedRectangle(cornerRadius: 12, style: .continuous))

            Button("Log out") {
                Task {
                    await authStore.logout()
                }
            }
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.red)
            .buttonStyle(.plain)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24)
        .padding(.top, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct SettingsRow: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(.primary)
                .textSelection(.enabled)
        }
    }
}

private struct AppWebView: View {
    let app: InstalledApp

    var body: some View {
        VStack(spacing: 0) {
            Text(app.name)
                .font(.system(size: 17, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.top, 20)
                .padding(.bottom, 12)

            WebView(url: app.url)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(Color.black.opacity(0.08), lineWidth: 1)
                }
                .padding(.horizontal, 20)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

private struct WebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        WKWebView()
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if webView.url != url {
            webView.load(URLRequest(url: url))
        }
    }
}

@MainActor
final class AuthStore: ObservableObject {
    @Published var serverURLText: String
    @Published private(set) var isAuthenticated: Bool
    @Published private(set) var isLoggingIn = false
    @Published var errorText: String?

    private var accessToken: String?
    private var refreshToken: String?

    var baseURL: URL {
        normalizedBaseURL(serverURLText) ?? MobileBuildInfo.chatBaseURL
    }

    init() {
        let storedBaseURL = KeychainStore.read("baseURL")
        let defaultBaseURL = MobileBuildInfo.chatBaseURL.absoluteString
        serverURLText = storedBaseURL ?? defaultBaseURL
        accessToken = KeychainStore.read("accessToken")
        refreshToken = KeychainStore.read("refreshToken")
        isAuthenticated = accessToken != nil && refreshToken != nil
    }

    func login(password: String) async {
        guard let baseURL = normalizedBaseURL(serverURLText) else {
            errorText = "Enter a valid server URL"
            return
        }

        isLoggingIn = true
        errorText = nil

        do {
            let session = try await requestSession(
                url: baseURL.appendingPathComponent("api/auth/token/login"),
                body: LoginRequest(password: password)
            )
            save(session: session, baseURL: baseURL)
        } catch {
            errorText = error.localizedDescription
        }

        isLoggingIn = false
    }

    func logout() async {
        let token = refreshToken
        clear()

        guard let token else {
            return
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("api/auth/token/logout"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(RefreshRequest(refreshToken: token))
        _ = try? await URLSession.shared.data(for: request)
    }

    func authorizedRequest(url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    func refresh() async throws {
        guard let refreshToken else {
            throw AuthError.notLoggedIn
        }

        let session = try await requestSession(
            url: baseURL.appendingPathComponent("api/auth/token/refresh"),
            body: RefreshRequest(refreshToken: refreshToken)
        )
        save(session: session, baseURL: baseURL)
    }

    private func requestSession<T: Encodable>(url: URL, body: T) async throws -> TokenSessionResponse {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthError.server("No HTTP response from \(url.absoluteString)")
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw AuthError.server("Login failed with HTTP \(httpResponse.statusCode): \(body)")
        }

        return try JSONDecoder().decode(TokenSessionResponse.self, from: data)
    }

    private func save(session: TokenSessionResponse, baseURL: URL) {
        accessToken = session.accessToken
        refreshToken = session.refreshToken
        serverURLText = baseURL.absoluteString
        isAuthenticated = true
        KeychainStore.write(baseURL.absoluteString, key: "baseURL")
        KeychainStore.write(session.accessToken, key: "accessToken")
        KeychainStore.write(session.refreshToken, key: "refreshToken")
    }

    private func clear() {
        accessToken = nil
        refreshToken = nil
        isAuthenticated = false
        KeychainStore.delete("accessToken")
        KeychainStore.delete("refreshToken")
    }

    private func normalizedBaseURL(_ value: String) -> URL? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed), url.scheme != nil, url.host != nil else {
            return nil
        }

        return url
    }
}

private struct LoginRequest: Encodable {
    let password: String
}

private struct RefreshRequest: Encodable {
    let refreshToken: String
}

private struct TokenSessionResponse: Decodable {
    let accessToken: String
    let refreshToken: String
}

private enum AuthError: LocalizedError {
    case notLoggedIn
    case server(String)

    var errorDescription: String? {
        switch self {
        case .notLoggedIn:
            return "Log in to rho first"
        case .server(let message):
            return message
        }
    }
}

private enum KeychainStore {
    private static let service = "dev.rho.auth"

    static func read(_ key: String) -> String? {
        var query = baseQuery(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else {
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    static func write(_ value: String, key: String) {
        delete(key)

        var query = baseQuery(key)
        query[kSecValueData as String] = Data(value.utf8)
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(query as CFDictionary, nil)
    }

    static func delete(_ key: String) {
        let query = baseQuery(key)
        SecItemDelete(query as CFDictionary)
    }

    private static func baseQuery(_ key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }
}

#Preview {
    ContentView()
}
