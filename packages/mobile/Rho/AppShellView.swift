import SwiftUI

struct AppShellView<Content: View>: View {
    let bottomBar: BottomBarState
    @ViewBuilder let content: Content

    var body: some View {
        ZStack {
            Color.white.ignoresSafeArea()
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            BottomBar(state: bottomBar)
        }
    }
}

#Preview("Root") {
    AppShellView(
        bottomBar: .root(screen: .home, apps: InstalledApp.examples, selectScreen: { _ in }, openChat: {})
    ) {
        Color.white
    }
}

#Preview("Page actions") {
    AppShellView(bottomBar: .pageActions(openChat: {})) {
        Color.white
    }
}
