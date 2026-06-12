import CoreLocation
import PhotosUI
import SwiftUI
import UIKit

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
    @State private var pendingImages: [PendingImage] = []
    @State private var isCameraPresented = false
    @State private var isPhotosPresented = false
    @State private var isLocationPresented = false
    @State private var photoSelection: [PhotosPickerItem] = []

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
                    .padding(.bottom, 64)
                }
                .scrollDismissesKeyboard(.interactively)
                .onTapGesture {
                    dismissKeyboard()
                }
                .onChange(of: scrollKey) { _, _ in
                    scrollToLatestMessage(with: proxy)
                }
            }

            Spacer(minLength: 0)
        }
        .background(Color.white.ignoresSafeArea())
        .overlay {
            ComposerOverlay(
                draft: $draft,
                pendingImages: pendingImages,
                isSending: isSending,
                onSend: { sendDraft() },
                onRemoveImage: { id in pendingImages.removeAll { $0.id == id } },
                onAudioRecorded: { audio in sendVoiceMessage(audio) },
                onMediaAction: handleMediaAction
            )
            .ignoresSafeArea()
        }
        .fullScreenCover(isPresented: $isCameraPresented) {
            CameraPicker { image in
                pendingImages.append(PendingImage(image: image))
            }
            .ignoresSafeArea()
        }
        .photosPicker(
            isPresented: $isPhotosPresented,
            selection: $photoSelection,
            maxSelectionCount: 10,
            matching: .images
        )
        .sheet(isPresented: $isLocationPresented) {
            LocationPickerSheet { coordinate in
                sendCurrentLocation(coordinate)
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .onChange(of: photoSelection) { _, items in
            guard !items.isEmpty else { return }
            photoSelection = []
            Task { await loadPickedPhotos(items) }
        }
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

    private func handleMediaAction(_ action: ComposerMediaAction) {
        dismissKeyboard()
        switch action {
        case .camera:
            isCameraPresented = true
        case .photos:
            isPhotosPresented = true
        case .location:
            isLocationPresented = true
        }
    }

    private func sendVoiceMessage(_ audio: PendingAudio) {
        try? FileManager.default.removeItem(at: audio.url)

        let total = Int(audio.duration)
        let duration = String(format: "%d:%02d", total / 60, total % 60)
        send("🎤 Voice message (\(duration))")
    }

    private func sendCurrentLocation(_ coordinate: CLLocationCoordinate2D) {
        let lat = String(format: "%.6f", coordinate.latitude)
        let lng = String(format: "%.6f", coordinate.longitude)
        send("📍 Current location: https://maps.apple.com/?ll=\(lat),\(lng)")
    }

    private func loadPickedPhotos(_ items: [PhotosPickerItem]) async {
        for item in items {
            guard let data = try? await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data)
            else {
                continue
            }

            await MainActor.run {
                pendingImages.append(PendingImage(image: image))
            }
        }
    }

    private func dismissKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    private func sendDraft() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isSending else { return }

        draft = ""
        pendingImages = []
        send(text)
    }

    private func send(_ text: String) {
        guard !isSending else { return }

        let id = conversationID
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
