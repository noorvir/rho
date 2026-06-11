import SwiftUI

struct ChatSheetView: View {
    let authStore: AuthStore

    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase

    @State private var draft = ""
    @State private var conversationID = ChatConversationStore.currentConversationID()
    @State private var conversations = ChatConversationStore.loadSummaries()
    @State private var messages: [ChatMessage] = []
    @State private var isSending = false
    @State private var isHistoryPresented = false
    @State private var errorText: String?
    @State private var workingTasks: [TaskSummary] = []
    @State private var taskPoller: Task<Void, Never>?

    var body: some View {
        VStack(spacing: 0) {
            ChatHeader(
                title: currentTitle,
                isNewChatDisabled: isSending,
                close: { dismiss() },
                showHistory: { isHistoryPresented = true },
                startNewChat: startNewConversation
            )

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(messages) { message in
                            ChatBubble(message: message)
                                .id(message.id)
                        }

                        ForEach(workingTasks, id: \.id) { task in
                            HStack(spacing: 8) {
                                ProgressView()
                                    .controlSize(.small)
                                Text("Working on: \(task.title)…")
                                    .font(.system(size: 12))
                                    .foregroundStyle(.secondary)
                            }
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
        .task(id: conversationID) {
            await loadHistory(for: conversationID)
            startTaskPolling()
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await loadHistory(for: conversationID) }
            startTaskPolling()
        }
        .onDisappear {
            taskPoller?.cancel()
        }
        .sheet(isPresented: $isHistoryPresented) {
            ChatHistorySheetView(conversations: conversations, currentID: conversationID) { id in
                selectConversation(id)
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
            .presentationCornerRadius(18)
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

    private var currentTitle: String {
        conversations.first(where: { $0.id == conversationID })?.title ?? "Chat"
    }

    private func loadHistory(for id: String) async {
        do {
            let history = try await ChatClient(authStore: authStore, conversationID: id).history()
            let loadedMessages = history.messages.map { message in
                ChatMessage(role: message.role.chatRole, text: message.text)
            }

            await MainActor.run {
                guard id == conversationID else { return }
                messages = loadedMessages
                saveSummary(for: id, messages: loadedMessages)
            }
        } catch {
            await MainActor.run {
                guard id == conversationID else { return }
                errorText = error.localizedDescription
            }
        }
    }

    private func sendDraft() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }

        let id = conversationID
        draft = ""
        errorText = nil
        isSending = true

        let assistantId = UUID()
        messages.append(ChatMessage(role: .user, text: text))
        messages.append(ChatMessage(id: assistantId, role: .assistant, text: ""))
        saveSummary(for: id, messages: messages)

        Task {
            do {
                for try await event in ChatClient(authStore: authStore, conversationID: id).send(text: text) {
                    await MainActor.run {
                        guard conversationID == id else { return }
                        apply(event, to: assistantId)
                    }
                }
            } catch {
                await MainActor.run {
                    guard conversationID == id else { return }
                    errorText = error.localizedDescription
                    removeEmptyAssistantMessage(assistantId)
                }
            }

            await MainActor.run {
                guard conversationID == id else { return }
                isSending = false
                startTaskPolling()
            }
        }
    }

    private func startTaskPolling() {
        taskPoller?.cancel()
        taskPoller = Task { await pollTasks() }
    }

    private func pollTasks() async {
        let id = conversationID
        var hadActiveTask = false

        while !Task.isCancelled {
            guard let tasks = try? await ChatClient(authStore: authStore, conversationID: id).tasks() else {
                return
            }

            let active = tasks.filter { $0.status == "queued" || $0.status == "running" }
            let finished = hadActiveTask && active.isEmpty

            let stale = await MainActor.run { () -> Bool in
                guard id == conversationID else { return true }
                workingTasks = active
                return false
            }
            if stale || Task.isCancelled {
                return
            }

            if active.isEmpty {
                if finished {
                    await loadHistory(for: id)
                }
                return
            }

            hadActiveTask = true
            try? await Task.sleep(for: .seconds(4))
        }
    }

    private func startNewConversation() {
        guard !isSending else { return }

        let id = ChatConversationStore.newConversationID()
        conversationID = id
        ChatConversationStore.saveCurrentConversationID(id)
        draft = ""
        messages = []
        errorText = nil
    }

    private func selectConversation(_ id: String) {
        guard id != conversationID else {
            isHistoryPresented = false
            return
        }

        conversationID = id
        ChatConversationStore.saveCurrentConversationID(id)
        draft = ""
        messages = []
        errorText = nil
        isHistoryPresented = false
    }

    private func saveSummary(for id: String, messages: [ChatMessage]) {
        guard let title = conversationTitle(from: messages) else { return }

        conversations = ChatConversationStore.saveSummary(
            ChatConversationSummary(id: id, title: title, updatedAt: Date())
        )
    }

    private func conversationTitle(from messages: [ChatMessage]) -> String? {
        guard let text = messages.first(where: { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })?.text else {
            return nil
        }

        let title = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if title.count <= 44 {
            return title
        }

        return "\(title.prefix(41))…"
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

private struct ChatHeader: View {
    let title: String
    let isNewChatDisabled: Bool
    let close: () -> Void
    let showHistory: () -> Void
    let startNewChat: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Button(action: close) {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(.primary)
                    .frame(width: 34, height: 34)
                    .chatControlSurface(cornerRadius: 8)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close chat")

            Text(title)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 6) {
                Button(action: showHistory) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(.primary)
                        .frame(width: 34, height: 34)
                        .chatControlSurface(cornerRadius: 8)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Show chat history")

                Button(action: startNewChat) {
                    Image(systemName: "plus")
                        .font(.system(size: 17, weight: .medium))
                        .foregroundStyle(isNewChatDisabled ? .secondary : .primary)
                        .frame(width: 34, height: 34)
                        .chatControlSurface(cornerRadius: 8)
                }
                .buttonStyle(.plain)
                .disabled(isNewChatDisabled)
                .accessibilityLabel("Clear conversation")
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 10)
    }
}

private struct ChatHistorySheetView: View {
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

private struct ChatConversationSummary: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let updatedAt: Date
}

private enum ChatConversationStore {
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

            HStack(spacing: 16) {
                Image(systemName: "paperclip")
                    .font(.system(size: 16, weight: .medium))
                Text("@")
                    .font(.system(size: 17, weight: .medium))
                Spacer()
                Button(action: onSend) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
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
    private let conversationID: String

    init(authStore: AuthStore, conversationID: String) {
        self.authStore = authStore
        self.conversationID = conversationID
    }

    private var baseURL: URL {
        authStore.baseURL
    }

    private var streamEndpoint: URL {
        baseURL.appendingPathComponent("agent/messages:stream")
    }

    private var historyEndpoint: URL {
        baseURL.appendingPathComponent("agent/conversations/\(conversationID)/messages")
    }

    private var tasksEndpoint: URL {
        baseURL.appendingPathComponent("agent/conversations/\(conversationID)/tasks")
    }

    func history() async throws -> ChatHistory {
        let data = try await data(for: historyEndpoint)
        return try JSONDecoder().decode(ChatHistory.self, from: data)
    }

    func tasks() async throws -> [TaskSummary] {
        let data = try await data(for: tasksEndpoint)
        return try JSONDecoder().decode(TaskList.self, from: data).tasks
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
        request.httpBody = try JSONEncoder().encode(ChatRequest(conversationId: conversationID, text: text))

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

private struct TaskSummary: Decodable {
    let id: String
    let title: String
    let status: String
}

private struct TaskList: Decodable {
    let tasks: [TaskSummary]
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
    let conversationId: String
    let sender = ChatSender(id: "mobile-user", name: "Mobile User")
    let text: String
}

private struct ChatSender: Encodable {
    let id: String
    let name: String
}

private extension View {
    func chatControlSurface(cornerRadius: CGFloat) -> some View {
        background(.white, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.black.opacity(0.08), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.035), radius: 10, y: 4)
    }
}

#Preview {
    ChatSheetView(authStore: AuthStore())
}
