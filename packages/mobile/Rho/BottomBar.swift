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
                    itemStyle: itemStyle
                )
            case .pageActions(let openChat):
                PageActionBottomBar(openChat: openChat)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 20 + 5 / UIScreen.main.scale)
    }
}

private struct RootBottomBar: View {
    let screen: RootScreen
    let apps: [InstalledApp]
    let selectScreen: (RootScreen) -> Void
    let openChat: () -> Void
    let refreshApps: () -> Void
    let itemStyle: BottomBarItemStyle

    @State private var isAppsMenuPresented = false

    private var isAppsSelected: Bool {
        if case .app = screen { return true }
        return isAppsMenuPresented
    }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            HStack(spacing: 2) {
                Button(action: {
                    isAppsMenuPresented = false
                    selectScreen(.home)
                }) {
                    RootBarItem(systemName: "house", title: "Home", isSelected: isHomeSelected, style: itemStyle)
                }
                .buttonStyle(.plain)

                Button(action: {
                    if !isAppsMenuPresented {
                        refreshApps()
                    }
                    isAppsMenuPresented.toggle()
                }) {
                    RootBarItem(systemName: "rectangle.grid.2x2", title: "Apps", isSelected: isAppsSelected, style: itemStyle, hasHighlight: true)
                }
                .buttonStyle(.plain)

                Button(action: {
                    isAppsMenuPresented = false
                    selectScreen(.search)
                }) {
                    RootBarItem(systemName: "magnifyingglass", title: "Search", isSelected: isSearchSelected, style: itemStyle)
                }
                .buttonStyle(.plain)

                Button(action: {
                    isAppsMenuPresented = false
                    selectScreen(.settings)
                }) {
                    RootBarItem(systemName: "gearshape", title: "Settings", isSelected: isSettingsSelected, style: itemStyle)
                }
                .buttonStyle(.plain)
            }
            .padding(6)
            .glassSurface(cornerRadius: 30)
            .overlay {
                if isAppsMenuPresented {
                    Color.black.opacity(0.001)
                        .frame(width: UIScreen.main.bounds.width, height: UIScreen.main.bounds.height)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            isAppsMenuPresented = false
                        }
                }
            }
            .overlay(alignment: .bottomLeading) {
                if isAppsMenuPresented {
                    AppsMenuView(apps: apps) { app in
                        selectScreen(.app(app))
                        isAppsMenuPresented = false
                    }
                    .offset(y: -72)
                }
            }

            Button(action: openChat) {
                Image(systemName: "bubble.left")
                    .font(.system(size: 26, weight: .medium))
                    .foregroundStyle(.primary)
                    .frame(width: 60, height: 60)
                    .glassSurface(cornerRadius: 30)
            }
            .buttonStyle(.plain)
        }
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
        .frame(width: 266)
        .glassSurface(cornerRadius: 20)
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
        .foregroundStyle(isSelected ? Color.blue : Color.primary)
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
                    .fill(Color.blue)
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

private extension View {
    func controlSurface(cornerRadius: CGFloat) -> some View {
        background(.white, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .controlBorder(cornerRadius: cornerRadius)
            .controlShadow()
    }

    func controlBorder(cornerRadius: CGFloat) -> some View {
        overlay {
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .stroke(Color.black.opacity(0.08), lineWidth: 1)
        }
    }

    func controlShadow() -> some View {
        shadow(color: .black.opacity(0.035), radius: 10, y: 4)
    }

    @ViewBuilder
    func glassSurface(cornerRadius: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        if #available(iOS 26.0, *) {
            glassEffect(.regular, in: shape)
                .controlBorder(cornerRadius: cornerRadius)
                .shadow(color: .black.opacity(0.08), radius: 28, y: 12)
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
        } else {
            background(.regularMaterial, in: shape)
                .background(.white.opacity(0.72), in: shape)
                .controlBorder(cornerRadius: cornerRadius)
                .shadow(color: .black.opacity(0.08), radius: 28, y: 12)
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
        }
    }
}

#Preview("Root bar") {
    BottomBar(state: .root(screen: .home, apps: [], selectScreen: { _ in }, openChat: {}, refreshApps: {}))
}

#Preview("Page action bar") {
    BottomBar(state: .pageActions(openChat: {}))
}
