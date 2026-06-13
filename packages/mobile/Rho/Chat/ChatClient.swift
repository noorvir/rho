import Foundation

enum ChatEvent {
    case started
    case delta(String)
    case completed(String)
    case error(String)
}

struct ChatHistory: Decodable {
    let messages: [ChatHistoryMessage]
}

struct ChatHistoryMessage: Decodable {
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

    struct Attachment: Decodable {
        let path: String
        let mimeType: String
    }

    let role: Role
    let text: String
    let attachments: [Attachment]?

    var imagePaths: [String] {
        (attachments ?? [])
            .filter { $0.mimeType.hasPrefix("image/") }
            .map(\.path)
    }
}

struct TaskSummary: Decodable {
    let id: String
    let title: String
    let status: String
}

/// Talks to the rho server's agent endpoints for one conversation: message
/// history, background task status, and the SSE message stream.
@MainActor
final class ChatClient {
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

    func uploadImage(data: Data, mimeType: String) async throws -> String {
        let url = baseURL.appendingPathComponent("store/uploads")
        let body = StoreUploadRequest(
            sessionId: conversationID,
            mimeType: mimeType,
            data: data.base64EncodedString()
        )

        let responseData = try await postData(for: url, body: body)
        return try JSONDecoder().decode(StoreUploadResponse.self, from: responseData).path
    }

    func storeData(path: String) async throws -> Data {
        try await data(for: baseURL.appendingPathComponent("store/\(path)"))
    }

    func send(text: String, attachmentPaths: [String] = []) -> AsyncThrowingStream<ChatEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let bytes = try await bytes(for: streamEndpoint, text: text, attachmentPaths: attachmentPaths)

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
        let response = try await dataResponse(for: url, body: nil)
        if response.status == 401 {
            try await authStore.refresh()
            let refreshed = try await dataResponse(for: url, body: nil)
            return try checkedData(refreshed, fallback: "Request failed")
        }

        return try checkedData(response, fallback: "Request failed")
    }

    private func postData<Body: Encodable>(for url: URL, body: Body) async throws -> Data {
        let encoded = try JSONEncoder().encode(body)
        let response = try await dataResponse(for: url, body: encoded)
        if response.status == 401 {
            try await authStore.refresh()
            let refreshed = try await dataResponse(for: url, body: encoded)
            return try checkedData(refreshed, fallback: "Request failed")
        }

        return try checkedData(response, fallback: "Request failed")
    }

    private func dataResponse(for url: URL, body: Data?) async throws -> (data: Data, status: Int) {
        var request = authStore.authorizedRequest(url: url)
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }

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

    private func bytes(for url: URL, text: String, attachmentPaths: [String]) async throws -> URLSession.AsyncBytes {
        let response = try await bytesResponse(for: url, text: text, attachmentPaths: attachmentPaths)
        if response.status == 401 {
            try await authStore.refresh()
            let refreshed = try await bytesResponse(for: url, text: text, attachmentPaths: attachmentPaths)
            return try checkedBytes(refreshed, fallback: "Stream failed")
        }

        return try checkedBytes(response, fallback: "Stream failed")
    }

    private func bytesResponse(
        for url: URL,
        text: String,
        attachmentPaths: [String]
    ) async throws -> (bytes: URLSession.AsyncBytes, status: Int) {
        var request = authStore.authorizedRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            ChatRequest(
                conversationId: conversationID,
                text: text,
                attachments: attachmentPaths.map { ChatRequestAttachment(path: $0) }
            )
        )

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

private struct TaskList: Decodable {
    let tasks: [TaskSummary]
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

private struct ChatRequest: Encodable {
    let conversationId: String
    let sender = ChatSender(id: "mobile-user", name: "Mobile User")
    let text: String
    let attachments: [ChatRequestAttachment]
}

private struct ChatRequestAttachment: Encodable {
    let path: String
}

private struct StoreUploadRequest: Encodable {
    let sessionId: String
    let mimeType: String
    let data: String
}

private struct StoreUploadResponse: Decodable {
    let path: String
}

private struct ChatSender: Encodable {
    let id: String
    let name: String
}
