import SwiftUI

struct ContentView: View {
    @State private var isChatPresented = false

    var body: some View {
        AppShellView(bottomBar: .root(openChat: { isChatPresented = true }))
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

#Preview {
    ContentView()
}
