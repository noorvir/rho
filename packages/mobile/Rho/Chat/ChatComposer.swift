import SwiftUI
import UIKit

enum ComposerMediaAction {
    case camera
    case photos
    case location
}

struct PendingImage: Identifiable, Equatable {
    let id = UUID()
    let image: UIImage
}

/// Positions the composer bar with UIKit's keyboardLayoutGuide: docked above
/// the bottom safe area when the keyboard is hidden, and attached to the
/// keyboard's animated frame (including interactive dismissal) when visible.
/// Holds no keyboard session, so sheet pull-down keeps working.
struct ComposerOverlay: UIViewRepresentable {
    @Binding var draft: String
    @Binding var isMediaTrayPresented: Bool
    let pendingImages: [PendingImage]
    let isSending: Bool
    let onSend: () -> Void
    let onRemoveImage: (UUID) -> Void
    let onAudioRecorded: (PendingAudio) -> Void
    let onMediaAction: (ComposerMediaAction) -> Void

    func makeUIView(context: Context) -> ComposerOverlayView {
        let hosting = UIHostingController(rootView: rootView)
        hosting.view.backgroundColor = .clear
        hosting.safeAreaRegions = []
        hosting.sizingOptions = [.intrinsicContentSize]
        context.coordinator.hosting = hosting

        let overlay = ComposerOverlayView()
        overlay.install(barView: hosting.view)
        return overlay
    }

    func updateUIView(_ overlay: ComposerOverlayView, context: Context) {
        context.coordinator.hosting?.rootView = rootView
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    private var rootView: AgentInput {
        AgentInput(
            draft: $draft,
            isMediaTrayPresented: $isMediaTrayPresented,
            pendingImages: pendingImages,
            isSending: isSending,
            onSend: onSend,
            onRemoveImage: onRemoveImage,
            onAudioRecorded: onAudioRecorded,
            onMediaAction: onMediaAction
        )
    }

    final class Coordinator {
        var hosting: UIHostingController<AgentInput>?
    }
}

final class ComposerOverlayView: UIView {
    private weak var barView: UIView?

    func install(barView: UIView) {
        self.barView = barView

        backgroundColor = .clear
        isOpaque = false

        let filler = UIView()
        filler.backgroundColor = .clear
        filler.isOpaque = false
        filler.translatesAutoresizingMaskIntoConstraints = false
        addSubview(filler)

        barView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(barView)

        NSLayoutConstraint.activate([
            barView.leadingAnchor.constraint(equalTo: leadingAnchor),
            barView.trailingAnchor.constraint(equalTo: trailingAnchor),
            barView.bottomAnchor.constraint(
                equalTo: keyboardLayoutGuide.topAnchor,
                constant: -GlassControlMetrics.composerKeyboardSpacing
            ),
            filler.leadingAnchor.constraint(equalTo: leadingAnchor),
            filler.trailingAnchor.constraint(equalTo: trailingAnchor),
            filler.topAnchor.constraint(equalTo: barView.bottomAnchor),
            filler.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        guard let barView else { return false }
        return barView.frame.contains(point)
    }
}

struct AgentInput: View {
    @Binding var draft: String
    @Binding var isMediaTrayPresented: Bool
    let pendingImages: [PendingImage]
    let isSending: Bool
    let onSend: () -> Void
    let onRemoveImage: (UUID) -> Void
    let onAudioRecorded: (PendingAudio) -> Void
    let onMediaAction: (ComposerMediaAction) -> Void

    @State private var recorder = VoiceRecorder()

    private let mediaMenuWidth: CGFloat = 320
    private let mediaMenuHeight: CGFloat = 320

    private var trimmedDraft: String {
        draft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canSend: Bool {
        !isSending && (!trimmedDraft.isEmpty || !pendingImages.isEmpty)
    }

    var body: some View {
        VStack(spacing: 0) {
            if !pendingImages.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(pendingImages) { pending in
                            Image(uiImage: pending.image)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 64, height: 64)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .overlay(alignment: .topTrailing) {
                                    Button {
                                        onRemoveImage(pending.id)
                                    } label: {
                                        Image(systemName: "xmark.circle.fill")
                                            .font(.system(size: 17))
                                            .foregroundStyle(.white, .black.opacity(0.55))
                                    }
                                    .padding(3)
                                }
                        }
                    }
                }
                .padding(.bottom, 10)
            }

            ZStack(alignment: .bottomLeading) {
                Color.clear
                    .frame(height: mediaOverlayHeight)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        setMediaMenuPresented(false)
                    }
                    .allowsHitTesting(isMediaTrayPresented)

                if isMediaTrayPresented {
                    MediaOptionsMenu { action in
                        setMediaMenuPresented(false)
                        onMediaAction(action)
                    }
                    .frame(width: mediaMenuWidth, height: mediaMenuHeight)
                    .padding(.bottom, GlassControlMetrics.chatControlSize + 10)
                }

                ZStack {
                    composerBar
                        .opacity(recorder.state == .idle ? 1 : 0)
                        .allowsHitTesting(recorder.state == .idle)

                    if recorder.state != .idle {
                        recordingBar
                    }
                }
            }
        }
        .padding(.horizontal, 22)
        .padding(.top, 8)
    }

    private var mediaOverlayHeight: CGFloat {
        guard isMediaTrayPresented else {
            return GlassControlMetrics.chatControlSize
        }
        return mediaMenuHeight + GlassControlMetrics.chatControlSize + 10
    }

    private var composerBar: some View {
        HStack(spacing: 10) {
            GlassIconButton(
                systemName: isMediaTrayPresented ? "xmark" : "plus",
                accessibilityLabel: isMediaTrayPresented ? "Hide media options" : "Show media options",
                role: .chat,
                iconWeight: .regular,
                showsShadow: false
            ) {
                setMediaMenuPresented(!isMediaTrayPresented)
            }

            HStack(spacing: 8) {
                ChatTextField(
                    text: $draft,
                    onSend: {
                        if canSend {
                            onSend()
                        }
                    }
                )
                .frame(maxWidth: .infinity)

                composerInlineButton(
                    systemName: canSend ? "arrow.up.circle.fill" : "mic",
                    accessibilityLabel: canSend ? "Send message" : "Record voice message",
                    action: {
                        if canSend {
                            onSend()
                        } else {
                            recorder.start()
                        }
                    }
                )
                .disabled(isSending)
                .opacity(isSending ? 0.5 : 1)
            }
            .padding(.leading, 18)
            .padding(.trailing, 8)
            .frame(height: GlassControlMetrics.chatControlSize)
            .glassSurface(cornerRadius: GlassControlMetrics.chatControlSize / 2, showsShadow: false)
        }
    }

    private func composerInlineButton(
        systemName: String,
        accessibilityLabel: String,
        foregroundColor: Color = .primary,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: GlassControlMetrics.composerInlineIconSize, weight: .regular))
                .foregroundStyle(foregroundColor)
                .frame(
                    width: GlassControlMetrics.composerInlineControlWidth,
                    height: GlassControlMetrics.composerInlineControlHeight
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }

    private func setMediaMenuPresented(_ isPresented: Bool) {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            isMediaTrayPresented = isPresented
        }
    }

    private var recordingBar: some View {
        HStack(spacing: 10) {
            GlassIconButton(
                systemName: "trash",
                accessibilityLabel: "Discard recording",
                role: .chat,
                iconWeight: .regular,
                showsShadow: false
            ) {
                recorder.cancel()
            }

            HStack(spacing: 8) {
                Text(timeString(recorder.elapsed))
                    .font(.system(size: 17).monospacedDigit())
                    .foregroundStyle(.black)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)

                WaveformView(levels: recorder.levels)
                    .frame(maxWidth: .infinity)
                    .frame(height: 20)
                    .clipped()

                composerInlineButton(
                    systemName: recorder.state == .paused ? "record.circle" : "pause.circle",
                    accessibilityLabel: recorder.state == .paused ? "Resume recording" : "Pause recording",
                    foregroundColor: .red
                ) {
                    recorder.togglePause()
                }

                Button {
                    if let audio = recorder.finish() {
                        onAudioRecorded(audio)
                    }
                } label: {
                    ZStack {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 30, height: 30)

                        Image(systemName: "paperplane.fill")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(.white)
                    }
                    .frame(
                        width: GlassControlMetrics.composerInlineControlWidth,
                        height: GlassControlMetrics.composerInlineControlHeight
                    )
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Send voice message")
            }
            .padding(.leading, 18)
            .padding(.trailing, 8)
            .frame(height: GlassControlMetrics.chatControlSize)
            .glassSurface(cornerRadius: GlassControlMetrics.chatControlSize / 2, showsShadow: false)
        }
    }

    private func timeString(_ interval: TimeInterval) -> String {
        let total = Int(interval)
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

private struct WaveformView: View {
    let levels: [Float]

    private let barCount = 28

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<barCount, id: \.self) { index in
                Capsule()
                    .fill(Color.black.opacity(0.45))
                    .frame(width: 2.4, height: barHeight(at: index))
            }
        }
        .animation(.linear(duration: 0.05), value: levels)
    }

    private func barHeight(at index: Int) -> CGFloat {
        let offset = barCount - levels.count
        guard index >= offset else { return 3 }
        return 3 + CGFloat(levels[index - offset]) * 19
    }
}

private struct ChatTextField: UIViewRepresentable {
    @Binding var text: String
    let onSend: () -> Void

    func makeUIView(context: Context) -> UITextField {
        let field = UITextField()
        field.placeholder = "Ask rho..."
        field.font = .systemFont(ofSize: 17)
        field.returnKeyType = .send
        field.autocorrectionType = .default
        field.delegate = context.coordinator
        field.addTarget(context.coordinator, action: #selector(Coordinator.textChanged), for: .editingChanged)
        field.setContentHuggingPriority(.defaultLow, for: .horizontal)
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return field
    }

    func updateUIView(_ field: UITextField, context: Context) {
        context.coordinator.parent = self

        if field.text != text {
            field.text = text
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: ChatTextField

        init(parent: ChatTextField) {
            self.parent = parent
        }

        @objc func textChanged(_ field: UITextField) {
            parent.text = field.text ?? ""
        }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            parent.onSend()
            return false
        }
    }
}

private struct MediaOptionsMenu: View {
    let onSelect: (ComposerMediaAction) -> Void

    private let options = [
        MediaOption(title: "Photos", icon: "photo.on.rectangle", color: .blue, action: .photos),
        MediaOption(title: "Camera", icon: "camera", color: .black.opacity(0.82), action: .camera),
        MediaOption(title: "Location", icon: "location", color: .green, action: .location),
        MediaOption(title: "Contact", icon: "person.crop.circle", color: .black.opacity(0.56), action: nil),
        MediaOption(title: "Document", icon: "doc", color: .cyan, action: nil),
        MediaOption(title: "AI images", icon: "sparkles", color: .blue, action: nil),
    ]

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(spacing: 0) {
                ForEach(options) { option in
                    optionRow(option)
                }
            }
            .padding(.vertical, 10)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .glassSurface(cornerRadius: 34, showsShadow: true)
    }

    private func optionRow(_ option: MediaOption) -> some View {
        Button {
            if let action = option.action {
                onSelect(action)
            }
        } label: {
            HStack(spacing: 18) {
                ZStack {
                    Circle()
                        .fill(option.color.opacity(0.14))
                        .frame(width: 44, height: 44)

                    Image(systemName: option.icon)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(option.color)
                }

                Text(option.title)
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(.black)

                Spacer(minLength: 0)
            }
            .frame(height: 56)
            .padding(.horizontal, 24)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct MediaOption: Identifiable {
    let title: String
    let icon: String
    let color: Color
    let action: ComposerMediaAction?

    var id: String { title }
}
