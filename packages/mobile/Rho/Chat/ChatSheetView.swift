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
    @State private var isMediaTrayPresented = false
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
                            ChatBubble(message: message, authStore: authStore)
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
                    isMediaTrayPresented = false
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
                isMediaTrayPresented: $isMediaTrayPresented,
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
                ChatMessage(role: message.role.chatRole, text: message.text, imagePaths: message.imagePaths)
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
        isMediaTrayPresented = false
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
        let images = pendingImages
        guard !isSending, !text.isEmpty || !images.isEmpty else { return }

        draft = ""
        pendingImages = []
        send(text, images: images.map(\.image))
    }

    private func send(_ text: String, images: [UIImage] = []) {
        guard !isSending else { return }

        let id = conversationID
        errorText = nil
        isSending = true

        let assistantId = UUID()
        let userId = UUID()
        messages.append(ChatMessage(id: userId, role: .user, text: text))
        messages.append(ChatMessage(id: assistantId, role: .assistant, text: ""))
        saveSummary(for: id, messages: messages)

        Task {
            let client = ChatClient(authStore: authStore, conversationID: id)

            do {
                let paths = try await uploadImages(images, with: client)
                await MainActor.run {
                    guard conversationID == id else { return }
                    setUserImagePaths(userId, paths: paths)
                }

                for try await event in client.send(text: text, attachmentPaths: paths) {
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

    private func uploadImages(_ images: [UIImage], with client: ChatClient) async throws -> [String] {
        var paths: [String] = []

        for image in images {
            guard let data = uploadJPEGData(for: image) else { continue }
            let path = try await client.uploadImage(data: data, mimeType: "image/jpeg")
            await StoreImageCache.shared.set(image, for: path)
            paths.append(path)
        }

        return paths
    }

    private func setUserImagePaths(_ id: UUID, paths: [String]) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        messages[index].imagePaths = paths
    }

    private func uploadJPEGData(for image: UIImage, maxDimension: CGFloat = 2048) -> Data? {
        let largestSide = max(image.size.width, image.size.height)
        guard largestSide > maxDimension else {
            return image.jpegData(compressionQuality: 0.8)
        }

        let scale = maxDimension / largestSide
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let resized = UIGraphicsImageRenderer(size: size).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        return resized.jpegData(compressionQuality: 0.8)
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
        HStack(spacing: 14) {
            GlassIconButton(
                systemName: "xmark",
                accessibilityLabel: "Close chat",
                role: .chat,
                showsShadow: false,
                action: close
            )

            Text(title)
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 10) {
                GlassIconButton(
                    systemName: "clock.arrow.circlepath",
                    accessibilityLabel: "Show chat history",
                    role: .chat,
                    showsShadow: false,
                    action: showHistory
                )

                GlassIconButton(
                    systemName: "plus",
                    accessibilityLabel: "Start new chat",
                    role: .chat,
                    foregroundColor: isNewChatDisabled ? .secondary : .primary,
                    isDisabled: isNewChatDisabled,
                    showsShadow: false,
                    action: startNewChat
                )
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 20)
        .padding(.bottom, 12)
    }
}

#Preview {
    ChatSheetView(authStore: AuthStore())
}
