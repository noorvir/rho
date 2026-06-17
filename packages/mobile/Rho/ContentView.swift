import ObjectiveC
import Security
import SwiftUI
import UIKit
import WebKit

enum RootScreen {
    case home
    case app(InstalledApp, path: String)
    case search
    case settings
}

struct InstalledApp: Identifiable, Equatable {
    let id: String
    let name: String
    let color: Color
    let url: URL
}

/// Captures the app content currently on screen. Call `refresh()` just before
/// presenting the chat overlay so the image reflects the screen underneath and
/// excludes the chat sheet (which is not yet presented).
@MainActor
final class ContentSnapshotService {
    static let shared = ContentSnapshotService()

    private(set) var latest: UIImage?

    @discardableResult
    func refresh() -> UIImage? {
        latest = render()
        return latest
    }

    private func render() -> UIImage? {
        guard let window = Self.keyWindow(), window.bounds.width > 0, window.bounds.height > 0 else {
            return nil
        }
        let format = UIGraphicsImageRendererFormat.default()
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(bounds: window.bounds, format: format)
        return renderer.image { context in
            if !window.drawHierarchy(in: window.bounds, afterScreenUpdates: false) {
                window.layer.render(in: context.cgContext)
            }
        }
    }

    private static func keyWindow() -> UIWindow? {
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
        return windows.first { $0.isKeyWindow } ?? windows.first
    }
}

struct ContentView: View {
    @StateObject private var authStore = AuthStore()
    @StateObject private var appHost = WebAppHost()
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
                        openChat: {
                            ContentSnapshotService.shared.refresh()
                            isChatPresented = true
                        },
                        refreshApps: { refreshApps() }
                    )
                ) {
                    RootScreenView(screen: screen, authStore: authStore, host: appHost)
                }
                .sheet(isPresented: $isChatPresented) {
                    ChatSheetView(authStore: authStore) { slug, path in
                        navigateToApp(slug: slug, path: path)
                    }
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
        .onChange(of: authStore.isAuthenticated) { _, isAuthenticated in
            // Drop the persistent web view's loaded page on logout so a later
            // login (even to the same server) never reuses a stale session.
            if !isAuthenticated {
                appHost.reset()
            }
        }
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

    private func navigateToApp(slug: String, path: String) {
        guard let app = apps.first(where: { $0.id == slug }) else { return }
        isChatPresented = false
        screen = .app(app, path: path)
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
        if let cookie = authStore.webCookieCache, let expiry = authStore.webCookieExpiry, expiry > Date() {
            return cookie
        }

        let data = try await authorizedData(
            url: authStore.baseURL.appendingPathComponent("api/auth/web-session"),
            method: "POST"
        )
        let session = try JSONDecoder().decode(WebSessionResponse.self, from: data)

        guard let host = authStore.baseURL.host else {
            return nil
        }

        let cookie = HTTPCookie(properties: [
            .name: session.cookieName,
            .value: session.token,
            .domain: host,
            .path: "/",
        ])
        authStore.webCookieCache = cookie
        authStore.webCookieExpiry = Date().addingTimeInterval(300)
        return cookie
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

struct ModelRole: Codable, Equatable {
    var provider: String
    var modelId: String
    var thinking: String

    var key: String { "\(provider)/\(modelId)" }
}

struct ModelChoice: Codable, Identifiable, Equatable {
    var provider: String
    var modelId: String
    var label: String
    var id: String { "\(provider)/\(modelId)" }
}

struct ModelSettings: Codable, Equatable {
    var chat: ModelRole
    var task: ModelRole
    var timezone: String
    var choices: [ModelChoice]
    var thinkingLevels: [String]
    var timezones: [String]
}

@MainActor
final class ModelSettingsClient {
    private let authStore: AuthStore
    init(authStore: AuthStore) { self.authStore = authStore }

    func load() async throws -> ModelSettings {
        let data = try await request(method: "GET", body: nil)
        return try JSONDecoder().decode(ModelSettings.self, from: data)
    }

    struct SaveBody: Encodable { let chat: ModelRole; let task: ModelRole; let timezone: String }

    func save(chat: ModelRole, task: ModelRole, timezone: String) async throws -> ModelSettings {
        let body = try JSONEncoder().encode(SaveBody(chat: chat, task: task, timezone: timezone))
        let data = try await request(method: "POST", body: body)
        return try JSONDecoder().decode(ModelSettings.self, from: data)
    }

    private func request(method: String, body: Data?) async throws -> Data {
        let url = authStore.baseURL.appendingPathComponent("agent/model-settings")
        func send() async throws -> (Data, Int) {
            var req = authStore.authorizedRequest(url: url)
            req.httpMethod = method
            if let body {
                req.setValue("application/json", forHTTPHeaderField: "Content-Type")
                req.httpBody = body
            }
            let (data, response) = try await URLSession.shared.data(for: req)
            return (data, (response as? HTTPURLResponse)?.statusCode ?? 0)
        }
        var (data, status) = try await send()
        if status == 401 {
            try await authStore.refresh()
            (data, status) = try await send()
        }
        guard (200..<300).contains(status) else { throw URLError(.badServerResponse) }
        return data
    }
}

/// Decoded notification from `GET /agent/notifications`.
private struct HomeNotification: Identifiable, Decodable {
    let id: String
    let defId: String
    let title: String
    let body: String
    let level: String
    let icon: String?
    let readAt: String?

    var isUnread: Bool { readAt == nil }
    var sourceLabel: String { defId }
}

/// Decoded reminder cron from `GET /agent/reminders`.
private struct HomeReminder: Decodable {
    let id: String
    let title: String
    let nextRunAt: String
    let icon: String?

    var reminderItem: ReminderItem {
        ReminderItem(
            id: id,
            title: title,
            time: HomeReminder.formatTime(nextRunAt),
            icon: icon,
            tint: HomeReminder.proximityColor(nextRunAt)
        )
    }

    /// Color signals urgency by how soon the reminder is due. The change is
    /// dramatic inside a day (red↔amber, warm hues only), then jumps to a calm
    /// blue that fades to light gray over the following week.
    static func proximityColor(_ iso: String) -> Color {
        guard let date = isoParsers.lazy.compactMap({ $0.date(from: iso) }).first else {
            return .gray
        }
        return urgencyColor(hoursUntilDue: date.timeIntervalSinceNow / 3600)
    }

    private static let isoParsers: [ISO8601DateFormatter] = {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return [withFraction, plain]
    }()

    static func formatTime(_ iso: String) -> String {
        guard let date = isoParsers.lazy.compactMap({ $0.date(from: iso) }).first else {
            return iso
        }

        let time = DateFormatter()
        time.dateFormat = "h:mm a"
        let clock = time.string(from: date)

        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Today, \(clock)" }
        if calendar.isDateInTomorrow(date) { return "Tomorrow, \(clock)" }

        let day = DateFormatter()
        day.dateFormat = "EEE"
        return "\(day.string(from: date)), \(clock)"
    }
}

/// Loads the Home screen's notification and reminder content from the rho
/// server's agent endpoints, using the same auth/refresh flow as the rest of
/// the app.
@MainActor
private struct HomeClient {
    let authStore: AuthStore

    func notifications() async throws -> [HomeNotification] {
        let data = try await authorizedData(url: authStore.baseURL.appendingPathComponent("agent/notifications"))
        return try JSONDecoder().decode(NotificationsResponse.self, from: data).notifications
    }

    func reminders() async throws -> [HomeReminder] {
        let data = try await authorizedData(url: authStore.baseURL.appendingPathComponent("agent/reminders"))
        return try JSONDecoder().decode(RemindersResponse.self, from: data).reminders
    }

    func dismissNotification(id: String) async throws {
        try await post(url: authStore.baseURL.appendingPathComponent("agent/notifications/\(id)/dismiss"), body: nil)
    }

    func dismissReminder(id: String) async throws {
        try await post(url: authStore.baseURL.appendingPathComponent("agent/reminders/\(id)/dismiss"), body: nil)
    }

    func snoozeReminder(id: String, minutes: Int) async throws {
        let body = try JSONEncoder().encode(["minutes": minutes])
        try await post(url: authStore.baseURL.appendingPathComponent("agent/reminders/\(id)/snooze"), body: body)
    }

    private func post(url: URL, body: Data?) async throws {
        let response = try await sendPost(url: url, body: body)
        if response.status == 401 {
            try await authStore.refresh()
            let retried = try await sendPost(url: url, body: body)
            guard (200..<300).contains(retried.status) else { throw URLError(.userAuthenticationRequired) }
            return
        }
        guard (200..<300).contains(response.status) else { throw URLError(.badServerResponse) }
    }

    private func sendPost(url: URL, body: Data?) async throws -> (data: Data, status: Int) {
        var request = authStore.authorizedRequest(url: url)
        request.httpMethod = "POST"
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        return (data, httpResponse.statusCode)
    }

    private func authorizedData(url: URL) async throws -> Data {
        let response = try await send(url: url)
        if response.status == 401 {
            try await authStore.refresh()
            let retried = try await send(url: url)
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

    private func send(url: URL) async throws -> (data: Data, status: Int) {
        var request = authStore.authorizedRequest(url: url)
        request.httpMethod = "GET"
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        return (data, httpResponse.statusCode)
    }

    private struct NotificationsResponse: Decodable {
        let notifications: [HomeNotification]
    }

    private struct RemindersResponse: Decodable {
        let reminders: [HomeReminder]
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
    let host: WebAppHost

    var body: some View {
        switch screen {
        case .home:
            HomeScreen(authStore: authStore)
        case .app(let app, let path):
            AppWebView(app: app, path: path, authStore: authStore, host: host)
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
    let authStore: AuthStore

    @State private var isShowingReminders = false
    @State private var isShowingNotifications = false
    @State private var notifications: [HomeNotification] = []
    @State private var reminders: [ReminderItem] = []

    var body: some View {
        List {
            header.homeRow(top: 6, bottom: 0)
            quickActions.homeRow(top: 18, bottom: 0)

            if !notifications.isEmpty {
                HomeSectionTitle(title: "Notifications").homeRow(top: 20, bottom: 8)
                ForEach(Array(notifications.prefix(2))) { notification in
                    NotificationCard(notification: notification)
                        .homeRow(top: 3, bottom: 3)
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                dismissNotification(notification.id)
                            } label: {
                                Label("Dismiss", systemImage: "trash")
                            }
                        }
                }
                if notifications.count > 2 {
                    notificationsViewAll.homeRow(top: 4, bottom: 0)
                }
            }

            HomeSectionTitle(title: "Reminders").homeRow(top: 20, bottom: 8)
            ForEach(Array(reminders.prefix(3))) { reminder in
                ReminderCard(reminder: reminder)
                    .homeRow(top: 3, bottom: 3)
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            dismissReminder(reminder.id)
                        } label: {
                            Label("Dismiss", systemImage: "trash")
                        }
                        Button {
                            snoozeReminder(reminder.id)
                        } label: {
                            Label("Snooze", systemImage: "clock")
                        }
                        .tint(.orange)
                    }
            }
            if reminders.count > 3 {
                remindersViewAll.homeRow(top: 4, bottom: 0)
            }

            Color.clear
                .frame(height: 90)
                .homeRow(top: 0, bottom: 0)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .environment(\.defaultMinListRowHeight, 0)
        .background(Color.white)
        .refreshable {
            await load()
        }
        .sheet(isPresented: $isShowingReminders) {
            ReminderListSheet(authStore: authStore, reminders: reminders) {
                Task { await load() }
            }
        }
        .sheet(isPresented: $isShowingNotifications) {
            NotificationListSheet(authStore: authStore, notifications: notifications) {
                Task { await load() }
            }
        }
        .task {
            await load()
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                await load()
            }
        }
    }

    private func load() async {
        let client = HomeClient(authStore: authStore)
        async let notificationsResult = client.notifications()
        async let remindersResult = client.reminders()
        notifications = (try? await notificationsResult) ?? []
        reminders = ((try? await remindersResult) ?? []).map(\.reminderItem)
    }

    private func dismissNotification(_ id: String) {
        notifications.removeAll { $0.id == id }
        Task { try? await HomeClient(authStore: authStore).dismissNotification(id: id) }
    }

    private func dismissReminder(_ id: String) {
        reminders.removeAll { $0.id == id }
        Task { try? await HomeClient(authStore: authStore).dismissReminder(id: id) }
    }

    private func snoozeReminder(_ id: String) {
        reminders.removeAll { $0.id == id }
        Task {
            try? await HomeClient(authStore: authStore).snoozeReminder(id: id, minutes: 60)
            await load()
        }
    }

    private var header: some View {
        Text("Home")
            .font(.system(size: 34, weight: .bold))
            .foregroundStyle(.primary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var notificationsViewAll: some View {
        Button {
            isShowingNotifications = true
        } label: {
            HStack(spacing: 10) {
                Spacer(minLength: 0)
                OverlappingIcons(badges: notificationBadges(notifications))
                Text(hiddenNotificationsLabel)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(RhoTheme.primaryColor)
                Spacer(minLength: 0)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }

    private var hiddenNotificationsLabel: String {
        let hidden = max(0, notifications.count - 2)
        return "+\(hidden) more notification\(hidden == 1 ? "" : "s")"
    }

    private var remindersViewAll: some View {
        let hidden = max(0, reminders.count - 3)
        return Button {
            isShowingReminders = true
        } label: {
            HStack(spacing: 10) {
                Spacer(minLength: 0)
                OverlappingIcons(badges: reminderBadges(reminders))
                Text("+\(hidden) more reminder\(hidden == 1 ? "" : "s")")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(RhoTheme.primaryColor)
                Spacer(minLength: 0)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
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
    let notification: HomeNotification

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            IconAvatar(
                systemName: safeSymbol(notification.icon, fallback: "bell.badge"),
                color: notificationLevelColor(notification.level),
                size: 36
            )

            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(notification.sourceLabel)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.secondary)
                    if notification.isUnread {
                        Text("New")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(RhoTheme.primaryColor)
                    }
                }

                Text(notification.title)
                    .font(.system(size: 17, weight: .semibold))

                Text(notification.body)
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

private struct NotificationListSheet: View {
    let authStore: AuthStore
    let onChanged: () -> Void
    @State private var notifications: [HomeNotification]

    init(authStore: AuthStore, notifications: [HomeNotification], onChanged: @escaping () -> Void) {
        self.authStore = authStore
        self.onChanged = onChanged
        _notifications = State(initialValue: notifications)
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(notifications) { notification in
                    NotificationCard(notification: notification)
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 3, leading: 12, bottom: 3, trailing: 12))
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                dismiss(notification)
                            } label: {
                                Label("Dismiss", systemImage: "trash")
                            }
                        }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color.white)
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.fraction(0.68), .large])
        .presentationDragIndicator(.visible)
    }

    private func dismiss(_ notification: HomeNotification) {
        let id = notification.id
        notifications.removeAll { $0.id == id }
        onChanged()
        Task { try? await HomeClient(authStore: authStore).dismissNotification(id: id) }
    }
}

private struct ReminderListSheet: View {
    let authStore: AuthStore
    let onChanged: () -> Void
    @State private var reminders: [ReminderItem]

    init(authStore: AuthStore, reminders: [ReminderItem], onChanged: @escaping () -> Void) {
        self.authStore = authStore
        self.onChanged = onChanged
        _reminders = State(initialValue: reminders)
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(reminders) { reminder in
                    ReminderCard(reminder: reminder)
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 3, leading: 12, bottom: 3, trailing: 12))
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            Button(role: .destructive) {
                                dismiss(reminder)
                            } label: {
                                Label("Dismiss", systemImage: "trash")
                            }
                            Button {
                                snooze(reminder)
                            } label: {
                                Label("Snooze", systemImage: "clock")
                            }
                            .tint(.orange)
                        }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color.white)
            .navigationTitle("Reminders")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.fraction(0.68), .large])
        .presentationDragIndicator(.visible)
    }

    private func dismiss(_ reminder: ReminderItem) {
        let id = reminder.id
        reminders.removeAll { $0.id == id }
        onChanged()
        Task { try? await HomeClient(authStore: authStore).dismissReminder(id: id) }
    }

    private func snooze(_ reminder: ReminderItem) {
        let id = reminder.id
        reminders.removeAll { $0.id == id }
        onChanged()
        Task {
            try? await HomeClient(authStore: authStore).snoozeReminder(id: id, minutes: 60)
            await refresh()
        }
    }

    private func refresh() async {
        let updated = (try? await HomeClient(authStore: authStore).reminders())?.map(\.reminderItem)
        if let updated { reminders = updated }
        onChanged()
    }
}

private struct ReminderCard: View {
    let reminder: ReminderItem

    var body: some View {
        HStack(spacing: 12) {
            IconAvatar(
                systemName: safeSymbol(reminder.icon, fallback: "bell"),
                color: reminder.tint,
                size: 32
            )

            VStack(alignment: .leading, spacing: 3) {
                Text(reminder.title)
                    .font(.system(size: 16, weight: .semibold))
                Text(reminder.time)
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

private struct ReminderItem: Identifiable {
    let id: String
    let title: String
    let time: String
    let icon: String?
    let tint: Color
}

/// App-list-style avatar: a gradient circle holding an SF Symbol, where color
/// signals urgency. The symbol name is validated by the caller so a bad name
/// falls back to a safe default rather than rendering blank.
private struct IconAvatar: View {
    let systemName: String
    let color: Color
    let size: CGFloat

    var body: some View {
        Circle()
            .fill(Color.white)
            .overlay(
                Circle().fill(
                    LinearGradient(
                        colors: [color.opacity(0.78), color],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            )
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: systemName)
                    .font(.system(size: size * 0.46, weight: .semibold))
                    .foregroundStyle(.white)
            }
    }
}

/// Returns `name` only if it is a real SF Symbol; otherwise the fallback. This
/// keeps an agent-hallucinated icon from rendering as an empty glyph.
private func safeSymbol(_ name: String?, fallback: String) -> String {
    guard let name, !name.isEmpty, UIImage(systemName: name) != nil else { return fallback }
    return name
}

private func notificationLevelColor(_ level: String) -> Color {
    switch level {
    case "urgent": return .red
    case "attention": return Color(red: 0.96, green: 0.66, blue: 0.0)
    default: return .blue
    }
}

/// Picks up to three notifications for the cluster, spanning urgency: one of
/// each level when all three are present; otherwise two of the higher level
/// plus one of the next; otherwise up to three of the single level present.
private func notificationSample(_ notifications: [HomeNotification]) -> [HomeNotification] {
    let urgent = notifications.filter { $0.level == "urgent" }
    let attention = notifications.filter { $0.level == "attention" }
    let info = notifications.filter { $0.level != "urgent" && $0.level != "attention" }
    let groups = [urgent, attention, info].filter { !$0.isEmpty }

    if groups.count >= 3 {
        return [urgent[0], attention[0], info[0]]
    }
    if groups.count == 2 {
        var picked = Array(groups[0].prefix(2))
        picked += Array(groups[1].prefix(3 - picked.count))
        return picked
    }
    return Array((groups.first ?? []).prefix(3))
}

/// Shared row styling for the Home `List`: no separators, clear background,
/// and horizontal page insets with caller-controlled vertical spacing.
private extension View {
    func homeRow(top: CGFloat, bottom: CGFloat) -> some View {
        self
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: top, leading: 22, bottom: bottom, trailing: 22))
    }
}

/// An icon plus its urgency color, used by the overlapping cluster.
private struct IconBadge: Identifiable {
    let id = UUID()
    let systemName: String
    let color: Color
}

/// A row of overlapping icons, mirroring an avatar cluster.
private struct OverlappingIcons: View {
    let badges: [IconBadge]
    var size: CGFloat = 26

    var body: some View {
        HStack(spacing: -size * 0.34) {
            ForEach(badges) { badge in
                IconAvatar(systemName: badge.systemName, color: badge.color, size: size)
                    .overlay(Circle().stroke(Color.white, lineWidth: 2))
            }
        }
    }
}

private func notificationBadges(_ notifications: [HomeNotification]) -> [IconBadge] {
    notificationSample(notifications).map {
        IconBadge(systemName: safeSymbol($0.icon, fallback: "bell.badge"), color: notificationLevelColor($0.level))
    }
}

private func reminderBadges(_ reminders: [ReminderItem]) -> [IconBadge] {
    reminderSample(reminders).map {
        IconBadge(systemName: safeSymbol($0.icon, fallback: "bell"), color: $0.tint)
    }
}

/// Picks up to three reminders spread across the time range (soonest, middle,
/// latest) so the cluster spans the urgency colors present.
private func reminderSample(_ reminders: [ReminderItem]) -> [ReminderItem] {
    if reminders.count <= 3 {
        return reminders
    }
    return [reminders[0], reminders[reminders.count / 2], reminders[reminders.count - 1]]
}

/// Maps hours-until-due to an urgency color. Warm band (within a day) blends
/// red→amber only; cool band (after a day) blends blue→gray→light gray. The
/// two bands never mix, so there is no muddy brown in between.
private func urgencyColor(hoursUntilDue hours: Double) -> Color {
    let red = Color(red: 0.90, green: 0.13, blue: 0.13)
    let amber = Color(red: 0.98, green: 0.72, blue: 0.0)
    let gray = Color(white: 0.55)
    let lightGray = Color(white: 0.80)

    if hours <= 0 {
        return red
    }
    if hours <= 24 {
        return blend(red, amber, CGFloat(hours / 24))
    }

    let coolness = max(0, min(1, CGFloat((hours - 24) / (168 - 24))))
    if coolness < 0.5 {
        return blend(.blue, gray, coolness / 0.5)
    }
    return blend(gray, lightGray, (coolness - 0.5) / 0.5)
}

private func blend(_ a: Color, _ b: Color, _ fraction: CGFloat) -> Color {
    let f = max(0, min(1, fraction))
    var ar: CGFloat = 0, ag: CGFloat = 0, ab: CGFloat = 0, aa: CGFloat = 0
    var br: CGFloat = 0, bg: CGFloat = 0, bb: CGFloat = 0, ba: CGFloat = 0
    UIColor(a).getRed(&ar, green: &ag, blue: &ab, alpha: &aa)
    UIColor(b).getRed(&br, green: &bg, blue: &bb, alpha: &ba)
    return Color(
        red: Double(ar + (br - ar) * f),
        green: Double(ag + (bg - ag) * f),
        blue: Double(ab + (bb - ab) * f)
    )
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
    @State private var models: ModelSettings?

    var body: some View {
        NavigationStack {
            Form {
                if let models {
                    Section("Chat") {
                        modelRow(role: models.chat, settings: models) { save(chat: $0, task: models.task, timezone: models.timezone) }
                        reasoningRow(role: models.chat, settings: models) { save(chat: $0, task: models.task, timezone: models.timezone) }
                    }
                    Section("Background Agent") {
                        modelRow(role: models.task, settings: models) { save(chat: models.chat, task: $0, timezone: models.timezone) }
                        reasoningRow(role: models.task, settings: models) { save(chat: models.chat, task: $0, timezone: models.timezone) }
                    }
                    Section("Time Zone") {
                        NavigationLink {
                            SettingsSelectionList(
                                title: "Time Zone",
                                options: models.timezones.map { SettingsOption(id: $0, label: $0) },
                                selectedId: models.timezone
                            ) { tz in
                                save(chat: models.chat, task: models.task, timezone: tz)
                            }
                        } label: {
                            LabeledContent("Time Zone", value: models.timezone)
                        }
                    }
                }

                Section("Connection") {
                    LabeledContent("Endpoint", value: authStore.baseURL.absoluteString)
                    LabeledContent("Version", value: MobileBuildInfo.version)
                }

                Section {
                    Button("Log Out", role: .destructive) {
                        Task { await authStore.logout() }
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
        }
        .task {
            models = try? await ModelSettingsClient(authStore: authStore).load()
        }
    }

    private func save(chat: ModelRole, task: ModelRole, timezone: String) {
        models?.chat = chat
        models?.task = task
        models?.timezone = timezone
        Task {
            if let saved = try? await ModelSettingsClient(authStore: authStore).save(chat: chat, task: task, timezone: timezone) {
                models = saved
            }
        }
    }

    @ViewBuilder
    private func modelRow(role: ModelRole, settings: ModelSettings, onChange: @escaping (ModelRole) -> Void) -> some View {
        NavigationLink {
            SettingsSelectionList(
                title: "Model",
                options: settings.choices.map { SettingsOption(id: $0.id, label: $0.label) },
                selectedId: role.key
            ) { id in
                if let choice = settings.choices.first(where: { $0.id == id }) {
                    onChange(ModelRole(provider: choice.provider, modelId: choice.modelId, thinking: role.thinking))
                }
            }
        } label: {
            LabeledContent("Model", value: modelLabel(role, settings.choices))
        }
    }

    @ViewBuilder
    private func reasoningRow(role: ModelRole, settings: ModelSettings, onChange: @escaping (ModelRole) -> Void) -> some View {
        NavigationLink {
            SettingsSelectionList(
                title: "Reasoning",
                options: settings.thinkingLevels.map { SettingsOption(id: $0, label: $0.capitalized) },
                selectedId: role.thinking
            ) { level in
                onChange(ModelRole(provider: role.provider, modelId: role.modelId, thinking: level))
            }
        } label: {
            LabeledContent("Reasoning", value: role.thinking.capitalized)
        }
    }

    private func modelLabel(_ role: ModelRole, _ choices: [ModelChoice]) -> String {
        choices.first { $0.provider == role.provider && $0.modelId == role.modelId }?.label
            ?? "\(role.provider)/\(role.modelId)"
    }
}

private struct SettingsOption: Identifiable {
    let id: String
    let label: String
}

/// Apple-style selection sub-page: a grouped list with a checkmark on the
/// current value; tapping a row selects it and pops back.
private struct SettingsSelectionList: View {
    let title: String
    let options: [SettingsOption]
    let selectedId: String
    let onSelect: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            ForEach(options) { option in
                Button {
                    onSelect(option.id)
                    dismiss()
                } label: {
                    HStack {
                        Text(option.label).foregroundStyle(.primary)
                        Spacer()
                        if option.id == selectedId {
                            Image(systemName: "checkmark")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(Color.accentColor)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
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
    let path: String
    @ObservedObject var authStore: AuthStore
    let host: WebAppHost

    var body: some View {
        ZStack {
            AppHostContainer(host: host)
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
                                    host.backSwipe.update(offset: horizontal)
                                }
                            }
                            .onEnded { value in
                                let horizontal = value.translation.width
                                let vertical = abs(value.translation.height)
                                if horizontal > 80 && vertical < 80 {
                                    host.backSwipe.finish()
                                } else {
                                    host.backSwipe.cancel()
                                }
                            }
                    )
                Spacer(minLength: 0)
            }
            .ignoresSafeArea()
        }
        .task(id: "\(app.id):\(path)") {
            let cookie = try? await AppsClient(authStore: authStore).webSessionCookie()
            host.activate(slug: app.id, path: path, baseURL: authStore.baseURL, cookie: cookie)
        }
    }
}

/// Hosts the single persistent app web view, reparenting it into whichever
/// container is currently on screen.
private struct AppHostContainer: UIViewRepresentable {
    let host: WebAppHost

    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        attach(host.webView, to: container)
        return container
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        if host.webView.superview !== uiView {
            attach(host.webView, to: uiView)
        }
    }

    private func attach(_ webView: WKWebView, to container: UIView) {
        webView.removeFromSuperview()
        webView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
        ])
    }
}

/// Owns one `WKWebView` for the whole session. The first app open does a real
/// document load; later switches navigate client-side via the embed's
/// `__rhoNavigate` hook, so the shell and JS module cache stay warm.
private final class WebAppHost: NSObject, ObservableObject, WKNavigationDelegate, WKScriptMessageHandler {
    let webView: WKWebView
    let backSwipe = WebViewBackSwipeBridge()

    private var allowedHost: String?
    private var allowedPort: Int?
    /// Origin (scheme://host:port) currently loaded in the web view. When the
    /// active server changes, the document is reloaded instead of client-
    /// navigating inside a stale origin.
    private var loadedOrigin: String?
    private var isReady = false
    private var pendingPath: String?
    private var loadingOverlay: UIView?
    private weak var refreshControl: UIRefreshControl?

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

    override init() {
        let configuration = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.addUserScript(
            WKUserScript(source: WebAppHost.nativeFeelScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        )
        configuration.userContentController = controller
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        controller.add(self, name: "rho")
        configure()
    }

    private func configure() {
        webView.navigationDelegate = self
        webView.allowsLinkPreview = false
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.bouncesZoom = false
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.alwaysBounceVertical = true
        backSwipe.webView = webView

        let refresh = UIRefreshControl()
        refresh.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        webView.scrollView.refreshControl = refresh
        refreshControl = refresh

        hideInputAccessoryBar(in: webView)
    }

    /// Shows the given app: a real document load the first time, then
    /// client-side navigation for every later switch.
    func activate(slug: String, path: String = "/", baseURL: URL, cookie: HTTPCookie?) {
        allowedHost = baseURL.host
        allowedPort = baseURL.port
        let origin = Self.originKey(baseURL)
        let route = appRoute(slug: slug, path: path)

        // Same server already loaded: switch apps client-side (warm, instant).
        if loadedOrigin == origin {
            navigate(toPath: route)
            return
        }

        // First load, or the active server changed (e.g. login to a different
        // server): load the document fresh so the web view reflects the active
        // server and session, never stale content from a prior origin.
        loadedOrigin = origin
        isReady = false
        pendingPath = nil
        presentNeutralCover()
        let url = baseURL.appendingPathComponent(route.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        let request = URLRequest(url: url)
        if let cookie {
            webView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) { [weak self] in
                self?.webView.load(request)
            }
        } else {
            webView.load(request)
        }
    }

    /// Drops the loaded page so the next activate reloads from scratch. Call on
    /// logout/session change so a different user never sees the prior session.
    func reset() {
        loadedOrigin = nil
        isReady = false
        pendingPath = nil
        if let blank = URL(string: "about:blank") {
            webView.load(URLRequest(url: blank))
        }
    }

    private static func originKey(_ url: URL) -> String {
        let scheme = url.scheme ?? ""
        let host = url.host ?? ""
        let port = url.port.map { ":\($0)" } ?? ""
        return "\(scheme)://\(host)\(port)"
    }

    private func appRoute(slug: String, path: String) -> String {
        let cleanPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if cleanPath.isEmpty {
            return "/embed/apps/\(slug)"
        }
        return "/embed/apps/\(slug)/\(cleanPath)"
    }

    private func navigate(toPath path: String) {
        guard isReady else {
            pendingPath = path
            return
        }
        let escaped = path.replacingOccurrences(of: "'", with: "\\'")
        webView.evaluateJavaScript("window.__rhoNavigate && window.__rhoNavigate('\(escaped)')")
    }

    @objc private func handleRefresh() {
        // Refresh the app's data in place via the SDK hook instead of reloading
        // the document. A reload remounts the SPA and repaints its empty state
        // before data returns (a flash); invalidateQueries keeps the current
        // content on screen while it refetches. The spinner ends when the
        // refetch settles. Falls back to a reload if the hook is missing.
        let script = """
        if (window.__rhoRefresh) { await window.__rhoRefresh(); return true; }
        return false;
        """
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { [weak self] result in
            guard let self else { return }
            self.refreshControl?.endRefreshing()
            if case let .success(value) = result, (value as? Bool) == false {
                self.presentFreezeOverlay()
                self.webView.reload()
            }
        }
    }

    // MARK: Overlays

    private func presentNeutralCover() {
        let cover = UIView()
        cover.backgroundColor = .white
        install(overlay: cover)
    }

    private func presentFreezeOverlay() {
        let overlay = webView.snapshotView(afterScreenUpdates: false) ?? {
            let view = UIView()
            view.backgroundColor = .white
            return view
        }()
        install(overlay: overlay)
    }

    private func install(overlay: UIView) {
        loadingOverlay?.removeFromSuperview()
        // Cover synchronously: a freeze snapshot on pull-to-refresh must hide the
        // page the instant reload() starts, before the next layout pass. The
        // constraints are a backstop and also cover the fresh-load case where
        // the web view has no bounds yet (frame would be zero).
        overlay.frame = webView.bounds
        overlay.translatesAutoresizingMaskIntoConstraints = false
        webView.addSubview(overlay)
        NSLayoutConstraint.activate([
            overlay.topAnchor.constraint(equalTo: webView.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: webView.bottomAnchor),
            overlay.leadingAnchor.constraint(equalTo: webView.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: webView.trailingAnchor),
        ])
        loadingOverlay = overlay
    }

    private func removeOverlay() {
        guard let overlay = loadingOverlay else { return }
        loadingOverlay = nil
        UIView.animate(withDuration: 0.18, animations: { overlay.alpha = 0 }) { _ in
            overlay.removeFromSuperview()
        }
    }

    // MARK: WKScriptMessageHandler

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], body["type"] as? String == "ready" else {
            return
        }
        isReady = true
        if let path = pendingPath {
            pendingPath = nil
            navigate(toPath: path)
        }
    }

    // MARK: WKNavigationDelegate

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        if !isMainFrame {
            decisionHandler(.allow)
            return
        }
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.host == allowedHost,
           url.port == allowedPort,
           url.path.hasPrefix("/embed/") {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        UIApplication.shared.open(url)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshControl?.endRefreshing()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            self?.removeOverlay()
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        refreshControl?.endRefreshing()
        removeOverlay()
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        refreshControl?.endRefreshing()
        removeOverlay()
        loadedOrigin = nil
    }

    /// Removes the up/down/done bar WKWebView shows above the keyboard by
    /// swapping the content view's class for a runtime subclass whose
    /// `inputAccessoryView` is nil.
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

@MainActor
final class AuthStore: ObservableObject {
    @Published var serverURLText: String
    @Published private(set) var isAuthenticated: Bool
    @Published private(set) var isLoggingIn = false
    @Published var errorText: String?

    private var accessToken: String?
    private var refreshToken: String?
    /// Cached web-session cookie so opening an app doesn't pay a round-trip to
    /// mint one every time. Reset when the session changes.
    var webCookieCache: HTTPCookie?
    var webCookieExpiry: Date?

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
        webCookieCache = nil
        webCookieExpiry = nil
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
