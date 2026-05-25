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
    @State private var screen: RootScreen = .home
    @State private var isChatPresented = false

    var body: some View {
        AppShellView(
            bottomBar: .root(
                screen: screen,
                apps: InstalledApp.examples,
                selectScreen: { screen = $0 },
                openChat: { isChatPresented = true }
            )
        ) {
            RootScreenView(screen: screen)
        }
        .sheet(isPresented: $isChatPresented) {
            ChatSheetView()
                .presentationDetents([.large])
                .presentationDragIndicator(.hidden)
                .presentationCornerRadius(18)
        }
        .dynamicTypeSize(.medium)
        .preferredColorScheme(.light)
    }
}

private struct RootScreenView: View {
    let screen: RootScreen

    var body: some View {
        switch screen {
        case .home:
            PlaceholderScreen(title: "Home", subtitle: "Your rho workspace")
        case .app(let app):
            AppWebView(app: app)
        case .search:
            PlaceholderScreen(title: "Search", subtitle: "Find apps, sessions, and saved work")
        case .settings:
            PlaceholderScreen(title: "Settings", subtitle: "Configurable rho preferences")
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

#Preview {
    ContentView()
}
