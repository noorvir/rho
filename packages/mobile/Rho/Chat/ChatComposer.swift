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
    let pendingImages: [PendingImage]
    let isSending: Bool
    let onSend: () -> Void
    let onRemoveImage: (UUID) -> Void
    let onMediaAction: (ComposerMediaAction) -> Void

    func makeUIView(context: Context) -> ComposerOverlayView {
        let hosting = UIHostingController(rootView: rootView)
        hosting.view.backgroundColor = .white
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
            pendingImages: pendingImages,
            isSending: isSending,
            onSend: onSend,
            onRemoveImage: onRemoveImage,
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

        let filler = UIView()
        filler.backgroundColor = .white
        filler.translatesAutoresizingMaskIntoConstraints = false
        addSubview(filler)

        barView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(barView)

        NSLayoutConstraint.activate([
            barView.leadingAnchor.constraint(equalTo: leadingAnchor),
            barView.trailingAnchor.constraint(equalTo: trailingAnchor),
            barView.bottomAnchor.constraint(equalTo: keyboardLayoutGuide.topAnchor),
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
    let pendingImages: [PendingImage]
    let isSending: Bool
    let onSend: () -> Void
    let onRemoveImage: (UUID) -> Void
    let onMediaAction: (ComposerMediaAction) -> Void

    @State private var isMediaTrayPresented = false

    private var trimmedDraft: String {
        draft.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var canSend: Bool {
        !isSending && !trimmedDraft.isEmpty
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

            HStack(spacing: 10) {
                Button {
                    isMediaTrayPresented.toggle()
                } label: {
                    Image(systemName: isMediaTrayPresented ? "keyboard" : "plus")
                        .font(.system(size: 22, weight: .regular))
                        .foregroundStyle(.black)
                        .frame(width: 32, height: 32)
                        .contentTransition(.identity)
                        .transaction { transaction in
                            transaction.animation = nil
                        }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isMediaTrayPresented ? "Hide media options" : "Show media options")

                HStack(spacing: 8) {
                    ChatTextField(
                        text: $draft,
                        isMediaTrayPresented: $isMediaTrayPresented,
                        onSend: {
                            if canSend {
                                onSend()
                            }
                        },
                        onMediaAction: onMediaAction
                    )

                    Image(systemName: "sticker")
                        .font(.system(size: 21, weight: .regular))
                        .foregroundStyle(.black)
                }
                .padding(.horizontal, 14)
                .frame(height: 38)
                .background(.white, in: Capsule())
                .overlay {
                    Capsule()
                        .stroke(Color.black.opacity(0.18), lineWidth: 1)
                }

                Button {
                    onMediaAction(.camera)
                } label: {
                    Image(systemName: "camera")
                        .font(.system(size: 23, weight: .regular))
                        .foregroundStyle(.black)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Camera")

                Button {
                    if canSend {
                        onSend()
                    }
                } label: {
                    Image(systemName: canSend ? "arrow.up.circle.fill" : "mic")
                        .font(.system(size: canSend ? 29 : 24, weight: .regular))
                        .foregroundStyle(canSend ? .black : .black)
                        .frame(width: 32, height: 32)
                }
                .disabled(isSending)
                .buttonStyle(.plain)
                .accessibilityLabel(canSend ? "Send message" : "Voice message")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }
}

/// WhatsApp-style composer field: the media tray replaces the keyboard in place
/// by swapping the text field's `inputView`, so the composer bar never moves.
private struct ChatTextField: UIViewRepresentable {
    @Binding var text: String
    @Binding var isMediaTrayPresented: Bool
    let onSend: () -> Void
    let onMediaAction: (ComposerMediaAction) -> Void

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

        let hasTray = field.inputView != nil
        if isMediaTrayPresented != hasTray {
            field.inputView = isMediaTrayPresented ? context.coordinator.trayView() : nil
            DispatchQueue.main.async {
                if field.isFirstResponder {
                    field.reloadInputViews()
                } else {
                    field.becomeFirstResponder()
                }
            }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: ChatTextField
        private var trayContainer: UIInputView?
        private var trayController: UIHostingController<MediaOptionsGrid>?

        init(parent: ChatTextField) {
            self.parent = parent
        }

        func trayView() -> UIView {
            if let trayContainer {
                return trayContainer
            }

            let grid = MediaOptionsGrid { [weak self] action in
                self?.parent.onMediaAction(action)
            }
            let controller = UIHostingController(rootView: grid)
            controller.view.backgroundColor = .clear
            controller.safeAreaRegions = []
            trayController = controller

            let container = UIInputView(
                frame: CGRect(x: 0, y: 0, width: 0, height: 336),
                inputViewStyle: .default
            )
            container.allowsSelfSizing = true
            container.backgroundColor = .white
            container.translatesAutoresizingMaskIntoConstraints = false
            container.heightAnchor.constraint(equalToConstant: 336).isActive = true

            let trayView = controller.view!
            trayView.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(trayView)
            NSLayoutConstraint.activate([
                trayView.topAnchor.constraint(equalTo: container.topAnchor),
                trayView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
                trayView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
                trayView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            ])

            trayContainer = container
            return container
        }

        @objc func textChanged(_ field: UITextField) {
            parent.text = field.text ?? ""
        }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            parent.onSend()
            return false
        }

        func textFieldDidEndEditing(_ textField: UITextField) {
            if parent.isMediaTrayPresented {
                textField.inputView = nil
                DispatchQueue.main.async {
                    self.parent.isMediaTrayPresented = false
                }
            }
        }
    }
}

private struct MediaOptionsGrid: View {
    let onSelect: (ComposerMediaAction) -> Void

    private let options = [
        MediaOption(title: "Photos", icon: "photo.on.rectangle.angled", color: .blue, action: .photos),
        MediaOption(title: "Camera", icon: "camera.fill", color: .black.opacity(0.82), action: .camera),
        MediaOption(title: "Location", icon: "mappin", color: .green, action: .location),
        MediaOption(title: "Contact", icon: "person.crop.circle", color: .black.opacity(0.56), action: nil),
        MediaOption(title: "Document", icon: "doc.fill", color: .cyan, action: nil),
        MediaOption(title: "AI images", icon: "sparkles", color: .blue, action: nil),
    ]

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 18), count: 3)

    var body: some View {
        LazyVGrid(columns: columns, spacing: 32) {
            ForEach(options) { option in
                Button {
                    if let action = option.action {
                        onSelect(action)
                    }
                } label: {
                    VStack(spacing: 9) {
                        ZStack {
                            Circle()
                                .fill(Color.black.opacity(0.035))
                                .frame(width: 72, height: 72)

                            Image(systemName: option.icon)
                                .font(.system(size: 29, weight: .semibold))
                                .foregroundStyle(option.color)
                        }

                        Text(option.title)
                            .font(.system(size: 13))
                            .foregroundStyle(.black)
                            .lineLimit(1)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 22)
        .padding(.top, 28)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Color.white)
    }
}

private struct MediaOption: Identifiable {
    let title: String
    let icon: String
    let color: Color
    let action: ComposerMediaAction?

    var id: String { title }
}
