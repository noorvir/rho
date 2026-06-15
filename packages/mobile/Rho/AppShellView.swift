import SwiftUI

struct AppShellView<Content: View>: View {
    let bottomBar: BottomBarState
    var bottomBarItemStyle: BottomBarItemStyle = .iconsOnly
    @ViewBuilder let content: Content

    @State private var isBottomMenuPresented = false

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottom) {
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                if isBottomMenuPresented {
                    Color.black.opacity(0.001)
                        .ignoresSafeArea()
                        .contentShape(Rectangle())
                        .onTapGesture {
                            withAnimation(.spring(response: 0.34, dampingFraction: 0.86)) {
                                isBottomMenuPresented = false
                            }
                        }
                }

                BottomBar(
                    state: bottomBar,
                    itemStyle: bottomBarItemStyle,
                    isAppsMenuPresented: $isBottomMenuPresented
                )
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
