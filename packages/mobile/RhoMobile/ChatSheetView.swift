import SwiftUI

struct ChatSheetView: View {
    @State private var draft = ""
    @State private var messages: [ChatMessage] = []
    @State private var isSending = false
    @State private var errorText: String?

    private let chatClient = ChatClient()

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(messages) { message in
                        ChatBubble(message: message)
                    }

                    if let errorText {
                        Text(errorText)
                            .font(.system(size: 12))
                            .foregroundStyle(.red)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 12)
            }

            Spacer(minLength: 0)
        }
        .background(Color.white.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            AgentInput(draft: $draft, isSending: isSending) {
                sendDraft()
            }
            .padding(.horizontal, 20)
            .padding(.top, 14)
            .padding(.bottom, 8)
            .background {
                LinearGradient(
                    stops: [
                        Gradient.Stop(color: .white.opacity(0), location: 0),
                        Gradient.Stop(color: .white.opacity(0.96), location: 0.25),
                        Gradient.Stop(color: .white, location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
            }
        }
    }

    private func sendDraft() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }

        draft = ""
        errorText = nil
        isSending = true

        let assistantId = UUID()
        messages.append(ChatMessage(role: .user, text: text))
        messages.append(ChatMessage(id: assistantId, role: .assistant, text: ""))

        Task {
            do {
                for try await event in chatClient.send(text: text) {
                    await MainActor.run {
                        apply(event, to: assistantId)
                    }
                }
            } catch {
                await MainActor.run {
                    errorText = error.localizedDescription
                    removeEmptyAssistantMessage(assistantId)
                }
            }

            await MainActor.run {
                isSending = false
            }
        }
    }

    private func apply(_ event: ChatEvent, to assistantId: UUID) {
        switch event {
        case .started:
            break
        case .delta(let text):
            updateAssistantMessage(assistantId) { $0 += text }
        case .completed(let text):
            updateAssistantMessage(assistantId) { current in
                if current.isEmpty {
                    current = text
                }
            }
        case .error(let message):
            errorText = message
            removeEmptyAssistantMessage(assistantId)
        }
    }

    private func updateAssistantMessage(_ id: UUID, update: (inout String) -> Void) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        update(&messages[index].text)
    }

    private func removeEmptyAssistantMessage(_ id: UUID) {
        messages.removeAll { $0.id == id && $0.text.isEmpty }
    }
}

private struct ChatMessage: Identifiable {
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

private struct ChatBubble: View {
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

private struct AgentInput: View {
    @Binding var draft: String
    let isSending: Bool
    let onSend: () -> Void

    private var isSendDisabled: Bool {
        isSending || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            TextField("Ask rho...", text: $draft, axis: .vertical)
                .font(.system(size: 16))
                .textFieldStyle(.plain)
                .lineLimit(1...5)

            HStack(spacing: 22) {
                Image(systemName: "paperclip")
                    .font(.system(size: 20, weight: .medium))
                Text("@")
                    .font(.system(size: 21, weight: .medium))
                Spacer()
                Button(action: onSend) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 38, height: 38)
                        .background(isSendDisabled ? Color.black.opacity(0.1) : Color.black, in: Circle())
                }
                .disabled(isSendDisabled)
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 20)
        .padding(.bottom, 16)
        .background(.white, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.black.opacity(0.08), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.035), radius: 10, y: 4)
    }
}

private enum ChatEvent {
    case started
    case delta(String)
    case completed(String)
    case error(String)
}

private final class ChatClient {
    private let endpoint = URL(string: "http://localhost:7331/channels/http/messages")!

    func send(text: String) -> AsyncThrowingStream<ChatEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    var request = URLRequest(url: endpoint)
                    request.httpMethod = "POST"
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.httpBody = try JSONEncoder().encode(ChatRequest(text: text))

                    let (data, response) = try await URLSession.shared.data(for: request)
                    guard let httpResponse = response as? HTTPURLResponse,
                          (200..<300).contains(httpResponse.statusCode)
                    else {
                        throw URLError(.badServerResponse)
                    }

                    let body = String(decoding: data, as: UTF8.self)
                    for event in parseEvents(body) {
                        continuation.yield(event)
                    }

                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }

            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private func parseEvents(_ body: String) -> [ChatEvent] {
        body
            .components(separatedBy: "\n\n")
            .compactMap { block in
                let lines = block.split(separator: "\n", omittingEmptySubsequences: false)
                let eventName = lines.first { $0.hasPrefix("event: ") }?.dropFirst(7)
                let data = lines
                    .filter { $0.hasPrefix("data: ") }
                    .map { String($0.dropFirst(6)) }
                    .joined(separator: "\n")

                switch eventName {
                case "message.started":
                    return .started
                case "message.delta":
                    return .delta(decode(data, field: "text") ?? "")
                case "message.completed":
                    return .completed(decode(data, field: "text") ?? "")
                case "message.error":
                    return .error(decode(data, field: "error") ?? "Unknown server error")
                default:
                    return nil
                }
            }
    }

    private func decode(_ data: String, field: String) -> String? {
        guard let jsonData = data.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any]
        else { return nil }

        return object[field] as? String
    }
}

private struct ChatRequest: Encodable {
    let conversationId = "mobile-chat"
    let sender = ChatSender(id: "mobile-user", name: "Mobile User")
    let text: String
}

private struct ChatSender: Encodable {
    let id: String
    let name: String
}

#Preview {
    ChatSheetView()
}
