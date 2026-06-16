import ObjectiveC
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
}

struct ContentView: View {
    @StateObject private var authStore = AuthStore()
    @State private var screen: RootScreen = .home
    @State private var isChatPresented = false
    @State private var apps: [InstalledApp] = []

    var body: some View {
        Group {
            if authStore.isAuthenticated {
                AppShellView(
                    bottomBar: .root(
                        screen: screen,
                        apps: apps,
                        selectScreen: { screen = $0 },
                        openChat: { isChatPresented = true },
                        refreshApps: { refreshApps() }
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
                .task(id: authStore.isAuthenticated) {
                    do {
                        apps = try await AppsClient(authStore: authStore).installedApps()
                    } catch {
                        authStore.clearSession()
                    }
                }
            } else {
                LoginView(authStore: authStore)
            }
        }
        .dynamicTypeSize(.medium)
        .preferredColorScheme(.light)
    }

    private func refreshApps() {
        Task {
            do {
                apps = try await AppsClient(authStore: authStore).installedApps()
            } catch {
                authStore.clearSession()
            }
        }
    }
}

@MainActor
final class AppsClient {
    private static let palette: [Color] = [.blue, .purple, .green, .orange, .pink, .teal]

    private let authStore: AuthStore

    init(authStore: AuthStore) {
        self.authStore = authStore
    }

    func installedApps() async throws -> [InstalledApp] {
        let data = try await authorizedData(url: authStore.baseURL.appendingPathComponent("apps.json"), method: "GET")
        let response = try JSONDecoder().decode(AppsResponse.self, from: data)

        return response.apps.enumerated().map { index, app in
            InstalledApp(
                id: app.slug,
                name: app.name,
                color: Self.palette[index % Self.palette.count],
                url: authStore.baseURL.appendingPathComponent("embed/apps/\(app.slug)")
            )
        }
    }

    /// Exchanges the bearer token for a browser session cookie so the web UI
    /// inside a WKWebView is authenticated.
    func webSessionCookie() async throws -> HTTPCookie? {
        let data = try await authorizedData(
            url: authStore.baseURL.appendingPathComponent("api/auth/web-session"),
            method: "POST"
        )
        let session = try JSONDecoder().decode(WebSessionResponse.self, from: data)

        guard let host = authStore.baseURL.host else {
            return nil
        }

        return HTTPCookie(properties: [
            .name: session.cookieName,
            .value: session.token,
            .domain: host,
            .path: "/",
        ])
    }

    private func authorizedData(url: URL, method: String) async throws -> Data {
        let response = try await send(url: url, method: method)
        if response.status == 401 {
            try await authStore.refresh()
            let retried = try await send(url: url, method: method)
            guard (200..<300).contains(retried.status) else {
                throw URLError(.userAuthenticationRequired)
            }
            return retried.data
        }

        guard (200..<300).contains(response.status) else {
            throw URLError(.badServerResponse)
        }

        return response.data
    }

    private func send(url: URL, method: String) async throws -> (data: Data, status: Int) {
        var request = authStore.authorizedRequest(url: url)
        request.httpMethod = method
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        return (data, httpResponse.statusCode)
    }

    private struct AppsResponse: Decodable {
        struct AppSummary: Decodable {
            let slug: String
            let name: String
        }

        let apps: [AppSummary]
    }

    private struct WebSessionResponse: Decodable {
        let cookieName: String
        let token: String
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
            HomeScreen()
        case .app(let app):
            AppWebView(app: app, authStore: authStore)
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

private struct HomeScreen: View {
    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 22) {
                header
                notificationsSection
                remindersSection
                quickActions
                // widgetsSection
            }
            .padding(.horizontal, 22)
            .padding(.top, 6)
            .padding(.bottom, 120)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("Home")
                .font(.system(size: 34, weight: .bold))
                .foregroundStyle(.primary)

            Spacer(minLength: 12)

            Text("Tue, 16 Jun")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var notificationsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HomeSectionTitle(title: "Notifications")
            NotificationCard()
        }
    }

    private var remindersSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HomeSectionTitle(title: "Reminders")

            VStack(spacing: 6) {
                ReminderCard(icon: "leaf", title: "Water fiddle leaf fig", time: "Today, 5:00 PM", tint: Color.green)
                ReminderCard(icon: "cart", title: "Review grocery list", time: "Today, 6:30 PM", tint: RhoTheme.primaryColor)
                ReminderCard(icon: "creditcard", title: "Pay invoice", time: "Tomorrow, 9:00 AM", tint: Color.orange)

                Button {
                } label: {
                    Text("View all 6")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(RhoTheme.primaryColor)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            HomeSectionTitle(title: "Quick actions")

            HStack(spacing: 10) {
                QuickActionCard(icon: "plus", title: "New todo")
                QuickActionCard(icon: "leaf", title: "Log plant")
                QuickActionCard(icon: "creditcard", title: "Expense")
            }
        }
    }

    private var widgetsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HomeSectionTitle(title: "Pinned widgets")

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                HomeWidgetCard(
                    title: "Todo List",
                    subtitle: "Today",
                    value: "3",
                    detail: "open items",
                    icon: "checkmark.circle",
                    tint: RhoTheme.primaryColor
                )

                HomeWidgetCard(
                    title: "Plants",
                    subtitle: "Care",
                    value: "2",
                    detail: "need water",
                    icon: "leaf",
                    tint: .green
                )

                HomeWidgetCard(
                    title: "Expenses",
                    subtitle: "This week",
                    value: "$128",
                    detail: "tracked",
                    icon: "chart.pie",
                    tint: .purple
                )

                HomeWidgetCard(
                    title: "Bookmarks",
                    subtitle: "Saved",
                    value: "7",
                    detail: "new links",
                    icon: "bookmark",
                    tint: .orange
                )
            }
        }
    }
}

private struct HomeSectionTitle: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
            .tracking(0.4)
    }
}

private struct NotificationCard: View {
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "envelope.badge")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(RhoTheme.primaryColor)
                .frame(width: 36, height: 36)
                .background(RhoTheme.primaryColor.opacity(0.12), in: Circle())

            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("Email triage")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.secondary)
                    Text("New")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(RhoTheme.primaryColor)
                }

                Text("Important email from Sam")
                    .font(.system(size: 17, weight: .semibold))

                Text("Looks like it needs a reply today. Rho marked it as high priority.")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Spacer(minLength: 0)
        }
        .padding(15)
        .background(.white, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .controlBorder(cornerRadius: 20)
        .controlShadow()
    }
}

private struct ReminderCard: View {
    let icon: String
    let title: String
    let time: String
    let tint: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 32, height: 32)
                .background(tint.opacity(0.12), in: Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                Text(time)
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .controlBorder(cornerRadius: 18)
        .controlShadow()
    }
}

private struct QuickActionCard: View {
    let icon: String
    let title: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(RhoTheme.primaryColor)
                .frame(width: 38, height: 38)
                .background(RhoTheme.primaryColor.opacity(0.1), in: Circle())

            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .controlBorder(cornerRadius: 18)
        .controlShadow()
    }
}

private struct HomeWidgetCard: View {
    let title: String
    let subtitle: String
    let value: String
    let detail: String
    let icon: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(tint)
                Spacer(minLength: 0)
                Text(subtitle)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)

            Text(value)
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(.primary)
            Text(detail)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
        }
        .frame(height: 150)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.white, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .controlBorder(cornerRadius: 22)
        .controlShadow()
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
    @ObservedObject var authStore: AuthStore
    @StateObject private var backSwipe = WebViewBackSwipeBridge()
    @State private var cookie: HTTPCookie?
    @State private var isReady = false

    var body: some View {
        ZStack {
            Group {
                if isReady {
                    WebView(url: app.url, cookie: cookie, reloadToken: 0, backSwipe: backSwipe)
                } else {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .ignoresSafeArea(.container, edges: [.top, .bottom])

            HStack(spacing: 0) {
                Color.clear
                    .frame(width: 28)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 12)
                            .onChanged { value in
                                let horizontal = max(0, value.translation.width)
                                let vertical = abs(value.translation.height)
                                if horizontal > vertical {
                                    backSwipe.update(offset: horizontal)
                                }
                            }
                            .onEnded { value in
                                let horizontal = value.translation.width
                                let vertical = abs(value.translation.height)
                                if horizontal > 80 && vertical < 80 {
                                    backSwipe.finish()
                                } else {
                                    backSwipe.cancel()
                                }
                            }
                    )
                Spacer(minLength: 0)
            }
            .ignoresSafeArea()
        }
        .task(id: app.id) {
            cookie = try? await AppsClient(authStore: authStore).webSessionCookie()
            isReady = true
        }
    }
}

@MainActor
private final class WebViewBackSwipeBridge: ObservableObject {
    weak var webView: WKWebView?

    func update(offset: CGFloat) {
        send(phase: "change", offset: offset)
    }

    func finish() {
        send(phase: "finish", offset: nil)
    }

    func cancel() {
        send(phase: "cancel", offset: nil)
    }

    private func send(phase: String, offset: CGFloat?) {
        let offsetValue = offset.map(String.init) ?? "null"
        let script = """
        window.dispatchEvent(new CustomEvent('rho:back-swipe', {
          detail: { phase: '\(phase)', offset: \(offsetValue) }
        }));
        """
        webView?.evaluateJavaScript(script)
    }
}

private struct WebView: UIViewRepresentable {
    let url: URL
    let cookie: HTTPCookie?
    let reloadToken: Int
    let backSwipe: WebViewBackSwipeBridge

    /// Makes embedded pages behave like native app surfaces: pins the layout
    /// to the device width, suppresses the focus auto-zoom (iOS zooms any
    /// focused input with a font under 16px), and removes web-only tells
    /// like tap-highlight flashes and double-tap zoom.
    private static let nativeFeelScript = """
    (() => {
      let meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
      }
      meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

      const style = document.createElement('style');
      style.textContent = `
        input, textarea, select { font-size: max(16px, 1em) !important; }
        html { -webkit-text-size-adjust: 100%; }
        * { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      `;
      document.head.appendChild(style);
    })();
    """

    func makeCoordinator() -> Coordinator {
        Coordinator(allowedHost: url.host, allowedPort: url.port)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.addUserScript(
            WKUserScript(source: Self.nativeFeelScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsLinkPreview = false
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.bouncesZoom = false
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        // Let the page own the full height and report true safe-area insets via
        // env(safe-area-inset-*); otherwise WebKit adds its own top inset and
        // fixed overlays (back button) sit too low.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        backSwipe.webView = webView

        hideInputAccessoryBar(in: webView)
        return webView
    }

    /// Removes the up/down/done bar WKWebView shows above the keyboard by
    /// swapping the content view's class for a runtime subclass whose
    /// `inputAccessoryView` is nil — the standard approach, since WebKit has
    /// no public switch for it.
    private func hideInputAccessoryBar(in webView: WKWebView) {
        guard let contentView = webView.scrollView.subviews.first(where: {
            String(describing: type(of: $0)).hasPrefix("WKContent")
        }) else {
            return
        }

        let subclassName = "WKContentView_RhoNoAccessory"
        if let subclass = NSClassFromString(subclassName) {
            object_setClass(contentView, subclass)
            return
        }

        guard let contentClass = object_getClass(contentView),
              let subclass = objc_allocateClassPair(contentClass, subclassName, 0)
        else {
            return
        }

        let selector = #selector(getter: UIResponder.inputAccessoryView)
        if let method = class_getInstanceMethod(contentClass, selector) {
            let returnNil: @convention(block) (AnyObject) -> UIView? = { _ in nil }
            class_addMethod(subclass, selector, imp_implementationWithBlock(returnNil), method_getTypeEncoding(method))
        }

        objc_registerClassPair(subclass)
        object_setClass(contentView, subclass)
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if context.coordinator.requestedURL == url {
            if context.coordinator.reloadToken != reloadToken {
                context.coordinator.reloadToken = reloadToken
                webView.reloadFromOrigin()
            }
            return
        }

        context.coordinator.requestedURL = url
        context.coordinator.reloadToken = reloadToken

        let request = URLRequest(url: url)
        if let cookie {
            webView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) {
                webView.load(request)
            }
        } else {
            webView.load(request)
        }
    }

    /// Locks the WebView to the rho server's embed surface: same host only,
    /// and main-frame navigation never leaves /embed/.
    final class Coordinator: NSObject, WKNavigationDelegate {
        /// Last URL this view asked the web view to load; app switches change it.
        var requestedURL: URL?
        /// Last seen reload token; the reload button increments it.
        var reloadToken = 0

        private let allowedHost: String?
        private let allowedPort: Int?

        init(allowedHost: String?, allowedPort: Int?) {
            self.allowedHost = allowedHost
            self.allowedPort = allowedPort
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url,
                  url.host == allowedHost,
                  url.port == allowedPort
            else {
                decisionHandler(.cancel)
                return
            }

            let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true
            if isMainFrame && !url.path.hasPrefix("/embed/") {
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
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
        serverURLText = AuthStore.usableBaseURL(storedBaseURL) ?? defaultBaseURL
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
        clearSession()

        guard let token else {
            return
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("api/auth/token/logout"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(RefreshRequest(refreshToken: token))
        _ = try? await URLSession.shared.data(for: request)
    }

    /// A stored localhost URL can never be reached from a physical device
    /// (it would point at the phone itself), so treat it as stale there.
    private static func usableBaseURL(_ stored: String?) -> String? {
        #if targetEnvironment(simulator)
        return stored
        #else
        guard let stored else { return nil }
        let isLocalhost = stored.contains("127.0.0.1") || stored.contains("localhost")
        return isLocalhost ? nil : stored
        #endif
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

    func clearSession() {
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
