import SwiftUI

struct ChatHistorySheetView: View {
    let conversations: [ChatConversationSummary]
    let currentID: String
    let selectConversation: (String) -> Void

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(Color.black.opacity(0.22))
                .frame(width: 48, height: 6)
                .padding(.top, 14)
                .padding(.bottom, 36)

            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    ForEach(sections) { section in
                        VStack(alignment: .leading, spacing: 18) {
                            SectionHeader(title: section.title)

                            VStack(spacing: 20) {
                                ForEach(section.conversations) { conversation in
                                    Button(action: { selectConversation(conversation.id) }) {
                                        ChatHistoryRow(
                                            conversation: conversation,
                                            isCurrent: conversation.id == currentID
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    if conversations.isEmpty {
                        Text("No chat history yet")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.top, 32)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 24)
            }
        }
        .background(Color.white.ignoresSafeArea())
    }

    private var sections: [ChatHistorySection] {
        let sorted = conversations.sorted { $0.updatedAt > $1.updatedAt }
        let recent = sorted.filter { Calendar.current.dateComponents([.day], from: $0.updatedAt, to: Date()).day ?? 0 < 7 }
        let older = sorted.filter { !recent.contains($0) }

        var sections: [ChatHistorySection] = []
        if !recent.isEmpty {
            sections.append(ChatHistorySection(title: "Past week", conversations: recent))
        }
        if !older.isEmpty {
            sections.append(ChatHistorySection(title: "Older", conversations: older))
        }
        return sections
    }
}

private struct ChatHistorySection: Identifiable {
    let title: String
    let conversations: [ChatConversationSummary]

    var id: String { title }
}

private struct SectionHeader: View {
    let title: String

    var body: some View {
        HStack(spacing: 16) {
            Text(title)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(.secondary)

            Rectangle()
                .fill(Color.black.opacity(0.07))
                .frame(height: 1)
        }
    }
}

private struct ChatHistoryRow: View {
    let conversation: ChatConversationSummary
    let isCurrent: Bool

    var body: some View {
        HStack(spacing: 12) {
            Text(conversation.title)
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(isCurrent ? Color.primary : Color.primary.opacity(0.74))
                .lineLimit(1)

            Spacer(minLength: 0)

            Text(relativeAge)
                .font(.system(size: 20, weight: .regular))
                .foregroundStyle(.secondary)
        }
    }

    private var relativeAge: String {
        let days = Calendar.current.dateComponents([.day], from: conversation.updatedAt, to: Date()).day ?? 0
        if days <= 0 {
            return "Now"
        }
        if days < 14 {
            return "\(days)d"
        }
        return "\(max(1, days / 7))w"
    }
}
