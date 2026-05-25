import SwiftUI

struct AppShellView: View {
    let bottomBar: BottomBarState

    var body: some View {
        Color.white
            .ignoresSafeArea()
            .safeAreaInset(edge: .bottom, spacing: 0) {
                BottomBar(state: bottomBar)
            }
    }
}

#Preview("Root") {
    AppShellView(bottomBar: .root(openChat: {}))
}

#Preview("Page actions") {
    AppShellView(bottomBar: .pageActions(openChat: {}))
}
