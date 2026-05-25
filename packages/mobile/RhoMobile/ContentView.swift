import SwiftUI

struct ContentView: View {
    @State private var isChatPresented = false

    var body: some View {
        IssueDetailView(openChat: { isChatPresented = true })
            .sheet(isPresented: $isChatPresented) {
                LinearAgentChatView()
                    .presentationDetents([.large])
                    .presentationDragIndicator(.hidden)
                    .presentationCornerRadius(28)
            }
            .dynamicTypeSize(.medium)
            .preferredColorScheme(.light)
    }
}

#Preview {
    ContentView()
}
