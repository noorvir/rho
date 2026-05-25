import SwiftUI

enum BottomBarState {
    case root(openChat: () -> Void)
    case pageActions(openChat: () -> Void)
}

struct BottomBar: View {
    let state: BottomBarState

    var body: some View {
        Group {
            switch state {
            case .root(let openChat):
                RootBottomBar(openChat: openChat)
            case .pageActions(let openChat):
                PageActionBottomBar(openChat: openChat)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 14)
        .padding(.bottom, 8)
        .background {
            LinearGradient(
                stops: [
                    Gradient.Stop(color: .white.opacity(0), location: 0),
                    Gradient.Stop(color: .white.opacity(0.96), location: 0.32),
                    Gradient.Stop(color: .white, location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        }
    }
}

private struct RootBottomBar: View {
    let openChat: () -> Void

    @State private var isAppsMenuPresented = false

    var body: some View {
        HStack(spacing: 14) {
            HStack(spacing: 10) {
                RootBarItem(systemName: "house", isSelected: true)
                Button(action: { isAppsMenuPresented.toggle() }) {
                    RootBarItem(systemName: "rectangle.grid.2x2", isSelected: isAppsMenuPresented, hasHighlight: true)
                }
                .buttonStyle(.plain)
                RootBarItem(systemName: "magnifyingglass", isSelected: false)
                RootBarItem(systemName: "gearshape", isSelected: false)
            }
            .padding(6)
            .background(.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .controlBorder(cornerRadius: 16)
            .controlShadow()
            .overlay(alignment: .topLeading) {
                if isAppsMenuPresented {
                    AppsMenuView()
                        .offset(y: -202)
                }
            }

            Button(action: openChat) {
                Image(systemName: "bubble.left")
                    .font(.system(size: 28, weight: .medium))
                    .foregroundStyle(.primary)
                    .frame(width: 60, height: 60)
                    .controlSurface(cornerRadius: 16)
            }
            .buttonStyle(.plain)
        }
    }
}

private struct AppsMenuView: View {
    private let apps: [(String, Color)] = [
        ("Linear", .blue),
        ("GitHub", .purple),
        ("Slack", .green),
    ]

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

            ForEach(apps, id: \.0) { app in
                AppsMenuRow(title: app.0, color: app.1)
            }
        }
        .padding(6)
        .frame(width: 266)
        .background(.white, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .controlBorder(cornerRadius: 16)
        .controlShadow()
    }
}

private struct AppsMenuRow: View {
    let title: String
    let color: Color

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [color.opacity(0.75), color],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 28, height: 28)
                .overlay {
                    Text(String(title.prefix(1)))
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                }
            Text(title)
                .font(.system(size: 16, weight: .semibold))
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
    let isSelected: Bool
    var hasHighlight = false

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: 22, weight: .medium))
            .foregroundStyle(.primary)
            .frame(width: 56, height: 48)
            .background {
                if isSelected {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.black.opacity(0.06))
                }
            }
            .overlay(alignment: .topTrailing) {
                if hasHighlight {
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 9, height: 9)
                        .padding(.top, 6)
                        .padding(.trailing, 12)
                }
            }
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
}

#Preview("Root bar") {
    BottomBar(state: .root(openChat: {}))
}

#Preview("Page action bar") {
    BottomBar(state: .pageActions(openChat: {}))
}
