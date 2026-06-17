import SwiftUI

enum BottomBarItemStyle {
    case iconsOnly
    case iconsAndLabels
}

enum BottomBarState {
    case root(
        screen: RootScreen,
        apps: [InstalledApp],
        selectScreen: (RootScreen) -> Void,
        openChat: () -> Void,
        refreshApps: () -> Void
    )
    case pageActions(openChat: () -> Void)
}

struct BottomBar: View {
    let state: BottomBarState
    var itemStyle: BottomBarItemStyle = .iconsOnly

    @Binding private var isAppsMenuPresented: Bool

    init(
        state: BottomBarState,
        itemStyle: BottomBarItemStyle = .iconsOnly,
        isAppsMenuPresented: Binding<Bool> = .constant(false)
    ) {
        self.state = state
        self.itemStyle = itemStyle
        self._isAppsMenuPresented = isAppsMenuPresented
    }

    var body: some View {
        Group {
            switch state {
            case .root(let screen, let apps, let selectScreen, let openChat, let refreshApps):
                RootBottomBar(
                    screen: screen,
                    apps: apps,
                    selectScreen: selectScreen,
                    openChat: openChat,
                    refreshApps: refreshApps,
                    itemStyle: itemStyle,
                    isAppsMenuPresented: $isAppsMenuPresented
                )
            case .pageActions(let openChat):
                PageActionBottomBar(openChat: openChat)
            }
        }
        .padding(.horizontal, GlassControlMetrics.bottomBarHorizontalPadding)
        .padding(.top, GlassControlMetrics.bottomBarTopPadding)
        .padding(.bottom, GlassControlMetrics.bottomBarBottomPadding)
    }
}

private struct RootBottomBar: View {
    let screen: RootScreen
    let apps: [InstalledApp]
    let selectScreen: (RootScreen) -> Void
    let openChat: () -> Void
    let refreshApps: () -> Void
    let itemStyle: BottomBarItemStyle

    @Binding var isAppsMenuPresented: Bool

    private var isAppsSelected: Bool {
        if case .app = screen { return true }
        return isAppsMenuPresented
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            GlassReplacementMenu(isPresented: isAppsMenuPresented, placement: .bottom, alignment: .bottomLeading) {
                rootNavigationPill
            } replacement: {
                AppsMenuView(apps: apps, width: rootNavigationPillWidth) { app in
                    selectScreen(.app(app, path: "/"))
                    withAnimation(.spring(response: 0.34, dampingFraction: 0.86)) {
                        isAppsMenuPresented = false
                    }
                }
            }

            GlassIconButton(
                systemName: "bubble.left",
                accessibilityLabel: "Open chat",
                role: .bottomBar,
                action: openChat
            )
        }
    }

    private var rootNavigationPill: some View {
        HStack(spacing: 2) {
            Button(action: { selectRootScreen(.home) }) {
                RootBarItem(systemName: "house", title: "Home", isSelected: isHomeSelected, style: itemStyle)
            }
            .buttonStyle(.plain)

            Button(action: toggleAppsMenu) {
                RootBarItem(systemName: "rectangle.grid.2x2", title: "Apps", isSelected: isAppsSelected, style: itemStyle, hasHighlight: true)
            }
            .buttonStyle(.plain)

            Button(action: { selectRootScreen(.search) }) {
                RootBarItem(systemName: "magnifyingglass", title: "Search", isSelected: isSearchSelected, style: itemStyle)
            }
            .buttonStyle(.plain)

            Button(action: { selectRootScreen(.settings) }) {
                RootBarItem(systemName: "gearshape", title: "Settings", isSelected: isSettingsSelected, style: itemStyle)
            }
            .buttonStyle(.plain)
        }
        .padding(6)
    }

    private var rootNavigationPillWidth: CGFloat {
        let itemWidth: CGFloat
        switch itemStyle {
        case .iconsOnly:
            itemWidth = 68
        case .iconsAndLabels:
            itemWidth = 72
        }

        return itemWidth * 4 + 2 * 3 + 6 * 2
    }

    private func toggleAppsMenu() {
        if !isAppsMenuPresented {
            refreshApps()
        }

        withAnimation(.spring(response: 0.34, dampingFraction: 0.86)) {
            isAppsMenuPresented.toggle()
        }
    }

    private func selectRootScreen(_ rootScreen: RootScreen) {
        withAnimation(.spring(response: 0.34, dampingFraction: 0.86)) {
            isAppsMenuPresented = false
        }
        selectScreen(rootScreen)
    }

    private var isHomeSelected: Bool {
        if case .home = screen { return true }
        return false
    }

    private var isSearchSelected: Bool {
        if case .search = screen { return true }
        return false
    }

    private var isSettingsSelected: Bool {
        if case .settings = screen { return true }
        return false
    }
}

private struct AppsMenuView: View {
    let apps: [InstalledApp]
    let width: CGFloat
    let selectApp: (InstalledApp) -> Void

    private var appListHeight: CGFloat {
        min(CGFloat(apps.count) * 44, 300)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Button(action: {}) {
                HStack(spacing: 10) {
                    Image(systemName: "plus")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(width: 28, height: 28)
                        .background(Color.black.opacity(0.06), in: Circle())
                    Text("Create new")
                        .font(.system(size: 16, weight: .semibold))
                    Spacer(minLength: 0)
                }
                .foregroundStyle(.primary)
                .padding(.horizontal, 10)
                .frame(height: 44)
            }
            .buttonStyle(.plain)

            Divider()
                .padding(.horizontal, 10)
                .padding(.vertical, 3)

            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(apps) { app in
                        Button(action: { selectApp(app) }) {
                            AppsMenuRow(app: app)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(height: appListHeight)
        }
        .padding(6)
        .frame(width: width)
    }
}

private struct AppsMenuRow: View {
    let app: InstalledApp

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [app.color.opacity(0.75), app.color],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 28, height: 28)
                .overlay {
                    Text(String(app.name.prefix(1)))
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                }
            Text(app.name)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .frame(height: 42)
    }
}

private struct PageActionBottomBar: View {
    let openChat: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            IconButton(systemName: "tray.full", size: 48)

            HStack(spacing: 14) {
                Image(systemName: "plus")
                    .font(.system(size: 21, weight: .medium))
                Text("Comment")
                    .font(.system(size: 18))
                    .foregroundStyle(.secondary.opacity(0.58))
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 18)
            .frame(height: 48)
            .controlSurface(cornerRadius: 10)

            Button(action: openChat) {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.primary)
                    .frame(width: 48, height: 48)
                    .controlSurface(cornerRadius: 10)
            }
            .buttonStyle(.plain)
        }
    }
}

private struct RootBarItem: View {
    let systemName: String
    let title: String
    let isSelected: Bool
    let style: BottomBarItemStyle
    var hasHighlight = false

    var body: some View {
        VStack(spacing: showsLabel ? 2 : 0) {
            Image(systemName: systemName)
                .font(.system(size: showsLabel ? 21 : 22, weight: .medium))

            if showsLabel {
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
                    .lineLimit(1)
            }
        }
        .foregroundStyle(isSelected ? RhoTheme.primaryColor : Color.primary)
        .frame(width: itemWidth, height: 54)
        .background {
            if isSelected {
                Capsule(style: .continuous)
                    .fill(Color.black.opacity(0.06))
            }
        }
        .overlay(alignment: .topTrailing) {
            if hasHighlight {
                Circle()
                    .fill(RhoTheme.primaryColor)
                    .frame(width: 9, height: 9)
                    .padding(.top, showsLabel ? 5 : 6)
                    .padding(.trailing, showsLabel ? 10 : 12)
            }
        }
    }

    private var showsLabel: Bool {
        if case .iconsAndLabels = style {
            return true
        }
        return false
    }

    private var itemWidth: CGFloat {
        showsLabel ? 72 : 68
    }
}

private struct IconButton: View {
    let systemName: String
    let size: CGFloat

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: size * 0.4, weight: .medium))
            .frame(width: size, height: size)
            .controlSurface(cornerRadius: 10)
    }
}

#Preview("Root bar") {
    BottomBar(state: .root(screen: .home, apps: [], selectScreen: { _ in }, openChat: {}, refreshApps: {}))
}

#Preview("Page action bar") {
    BottomBar(state: .pageActions(openChat: {}))
}
