import SwiftUI

struct ChatMessage: Identifiable {
    enum Role {
        case user
        case assistant
    }

    let id: UUID
    let role: Role
    var text: String

    init(id: UUID = UUID(), role: Role, text: String) {
        self.id = id
        self.role = role
        self.text = text
    }
}

struct ChatBubble: View {
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.role == .user {
                Spacer(minLength: 36)
            }

            Text(message.text.isEmpty ? "…" : message.text)
                .font(.system(size: 14))
                .foregroundStyle(.black.opacity(message.role == .user ? 0.9 : 0.78))
                .padding(.horizontal, 10)
                .padding(.vertical, 7)
                .background(backgroundColor, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(Color.black.opacity(0.07), lineWidth: 1)
                }

            if message.role == .assistant {
                Spacer(minLength: 36)
            }
        }
    }

    private var backgroundColor: Color {
        message.role == .user ? Color.black.opacity(0.055) : Color.white
    }
}
