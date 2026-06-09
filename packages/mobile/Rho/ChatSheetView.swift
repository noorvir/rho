import SwiftUI

struct ChatSheetView: View {
    let authStore: AuthStore

    @State private var draft = ""
    @State private var messages: [ChatMessage] = []
    @State private var isSending = false
    @State private var errorText: String?

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(messages) { message in
                            ChatBubble(message: message)
                                .id(message.id)
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
                .onChange(of: scrollKey) { _, _ in
                    scrollToLatestMessage(with: proxy)
                }
            }

            Spacer(minLength: 0)
        }
        .background(Color.white.ignoresSafeArea())
        .task {
            await loadHistory()
        }
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

    private func loadHistory() async {
        do {
            let history = try await ChatClient(authStore: authStore).history()
            await MainActor.run {
                messages = history.messages.map { message in
                    ChatMessage(role: message.role.chatRole, text: message.text)
                }
            }
        } catch {
            await MainActor.run {
                errorText = error.localizedDescription
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
                for try await event in ChatClient(authStore: authStore).send(text: text) {
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

    private var scrollKey: String {
        messages.map { "\($0.id.uuidString):\($0.text.count)" }.joined(separator: "|")
    }

    private func scrollToLatestMessage(with proxy: ScrollViewProxy) {
        guard let id = messages.last?.id else { return }
        withAnimation(.easeOut(duration: 0.18)) {
            proxy.scrollTo(id, anchor: .bottom)
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

@MainActor
private final class ChatClient {
    private let authStore: AuthStore

    init(authStore: AuthStore) {
        self.authStore = authStore
    }

    private var baseURL: URL {
        authStore.baseURL
    }

    private var streamEndpoint: URL {
        baseURL.appendingPathComponent("agent/messages:stream")
    }

    private var historyEndpoint: URL {
        baseURL.appendingPathComponent("agent/conversations/mobile-chat/messages")
    }

    func history() async throws -> ChatHistory {
        let data = try await data(for: historyEndpoint)
        return try JSONDecoder().decode(ChatHistory.self, from: data)
    }

    func send(text: String) -> AsyncThrowingStream<ChatEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let bytes = try await bytes(for: streamEndpoint, text: text)

                    var buffer = Data()
                    let separator = Data("\n\n".utf8)

                    for try await byte in bytes {
                        buffer.append(byte)

                        while let range = buffer.range(of: separator) {
                            let frame = buffer.subdata(in: buffer.startIndex..<range.lowerBound)
                            buffer.removeSubrange(buffer.startIndex..<range.upperBound)

                            if let event = parseFrame(frame) {
                                continuation.yield(event)
                            }
                        }
                    }

                    if let event = parseFrame(buffer) {
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

    private func data(for url: URL) async throws -> Data {
        let response = try await dataResponse(for: url)
        if response.status == 401 {
            try await authStore.refresh()
            let refreshed = try await dataResponse(for: url)
            return try checkedData(refreshed, fallback: "Request failed")
        }

        return try checkedData(response, fallback: "Request failed")
    }

    private func dataResponse(for url: URL) async throws -> (data: Data, status: Int) {
        let request = authStore.authorizedRequest(url: url)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChatClientError.server("No HTTP response from \(url.absoluteString)")
        }

        return (data, httpResponse.statusCode)
    }

    private func checkedData(_ response: (data: Data, status: Int), fallback: String) throws -> Data {
        guard (200..<300).contains(response.status) else {
            let body = String(data: response.data, encoding: .utf8) ?? ""
            throw ChatClientError.server("\(fallback) with HTTP \(response.status): \(body)")
        }

        return response.data
    }

    private func bytes(for url: URL, text: String) async throws -> URLSession.AsyncBytes {
        let response = try await bytesResponse(for: url, text: text)
        if response.status == 401 {
            try await authStore.refresh()
            let refreshed = try await bytesResponse(for: url, text: text)
            return try checkedBytes(refreshed, fallback: "Stream failed")
        }

        return try checkedBytes(response, fallback: "Stream failed")
    }

    private func bytesResponse(for url: URL, text: String) async throws -> (bytes: URLSession.AsyncBytes, status: Int) {
        var request = authStore.authorizedRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(ChatRequest(text: text))

        let (bytes, response) = try await URLSession.shared.bytes(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ChatClientError.server("No HTTP response from \(url.absoluteString)")
        }

        return (bytes, httpResponse.statusCode)
    }

    private func checkedBytes(_ response: (bytes: URLSession.AsyncBytes, status: Int), fallback: String) throws -> URLSession.AsyncBytes {
        guard (200..<300).contains(response.status) else {
            throw ChatClientError.server("\(fallback) with HTTP \(response.status) at \(streamEndpoint.absoluteString)")
        }

        return response.bytes
    }

    private func parseFrame(_ frame: Data) -> ChatEvent? {
        guard !frame.isEmpty,
              let text = String(data: frame, encoding: .utf8)
        else {
            return nil
        }

        var eventName: String?
        var dataLines: [String] = []
        for line in text.replacingOccurrences(of: "\r\n", with: "\n").split(separator: "\n", omittingEmptySubsequences: false) {
            if line.hasPrefix("event: ") {
                eventName = String(line.dropFirst(7))
            } else if line.hasPrefix("data: ") {
                dataLines.append(String(line.dropFirst(6)))
            }
        }

        return parseEvent(name: eventName, data: dataLines.joined(separator: "\n"))
    }

    private func parseEvent(name: String?, data: String) -> ChatEvent? {
        if name == "message", let event = decode(StreamPayload.self, from: data)?.chatEvent {
            return event
        }

        switch name {
        case "message.started":
            return .started
        case "message.delta":
            return .delta(decode(TextPayload.self, from: data)?.text ?? "")
        case "message.completed":
            return .completed(decode(TextPayload.self, from: data)?.text ?? "")
        case "message.error":
            return .error(decode(ErrorPayload.self, from: data)?.error ?? "Unknown server error")
        default:
            return nil
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: String) -> T? {
        guard let jsonData = data.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(type, from: jsonData)
    }
}

private struct StreamPayload: Decodable {
    enum Kind: String, Decodable {
        case started
        case delta
        case completed
        case error
    }

    let type: Kind
    let text: String?
    let error: String?

    var chatEvent: ChatEvent {
        switch type {
        case .started:
            return .started
        case .delta:
            return .delta(text ?? "")
        case .completed:
            return .completed(text ?? "")
        case .error:
            return .error(error ?? "Unknown server error")
        }
    }
}

private struct TextPayload: Decodable {
    let text: String
}

private struct ErrorPayload: Decodable {
    let error: String
}

private enum ChatClientError: LocalizedError {
    case server(String)

    var errorDescription: String? {
        switch self {
        case .server(let message):
            return message
        }
    }
}

private struct ChatHistory: Decodable {
    let messages: [ChatHistoryMessage]
}

private struct ChatHistoryMessage: Decodable {
    enum Role: String, Decodable {
        case user
        case assistant

        var chatRole: ChatMessage.Role {
            switch self {
            case .user:
                return .user
            case .assistant:
                return .assistant
            }
        }
    }

    let role: Role
    let text: String
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
    ChatSheetView(authStore: AuthStore())
}
