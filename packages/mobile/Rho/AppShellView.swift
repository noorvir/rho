import SwiftUI

struct AppShellView<Content: View>: View {
    let bottomBar: BottomBarState
    var bottomBarItemStyle: BottomBarItemStyle = .iconsOnly
    @ViewBuilder let content: Content

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottom) {
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                BottomBar(state: bottomBar, itemStyle: bottomBarItemStyle)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, -geometry.safeAreaInsets.bottom)
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
        }
    }
}

#Preview("Root") {
    AppShellView(
        bottomBar: .root(screen: .home, apps: [], selectScreen: { _ in }, openChat: {}, refreshApps: {})
    ) {
        Color.white
    }
}

#Preview("Page actions") {
    AppShellView(bottomBar: .pageActions(openChat: {})) {
        Color.white
    }
}
