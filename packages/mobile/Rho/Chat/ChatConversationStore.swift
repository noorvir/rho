import Foundation

struct ChatConversationSummary: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let updatedAt: Date
}

/// Persists the current conversation id and recent conversation summaries in
/// user defaults so chat history survives app restarts.
enum ChatConversationStore {
    private static let currentIDKey = "dev.rho.mobile.currentConversationID"
    private static let summariesKey = "dev.rho.mobile.conversationSummaries"
    private static let defaultID = "mobile-chat"

    static func currentConversationID() -> String {
        UserDefaults.standard.string(forKey: currentIDKey) ?? defaultID
    }

    static func saveCurrentConversationID(_ id: String) {
        UserDefaults.standard.set(id, forKey: currentIDKey)
    }

    static func newConversationID() -> String {
        "mobile-chat-\(UUID().uuidString)"
    }

    static func loadSummaries() -> [ChatConversationSummary] {
        guard let data = UserDefaults.standard.data(forKey: summariesKey) else {
            return []
        }

        return (try? JSONDecoder().decode([ChatConversationSummary].self, from: data)) ?? []
    }

    static func saveSummary(_ summary: ChatConversationSummary) -> [ChatConversationSummary] {
        var summaries = loadSummaries().filter { $0.id != summary.id }
        summaries.insert(summary, at: 0)
        saveSummaries(summaries)
        return summaries
    }

    private static func saveSummaries(_ summaries: [ChatConversationSummary]) {
        guard let data = try? JSONEncoder().encode(summaries) else { return }
        UserDefaults.standard.set(data, forKey: summariesKey)
    }
}
