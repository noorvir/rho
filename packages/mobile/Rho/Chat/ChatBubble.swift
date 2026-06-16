import SwiftUI

struct ChatMessage: Identifiable {
    enum Role {
        case user
        case assistant
    }

    let id: UUID
    let role: Role
    var text: String
    var imagePaths: [String]

    init(id: UUID = UUID(), role: Role, text: String, imagePaths: [String] = []) {
        self.id = id
        self.role = role
        self.text = text
        self.imagePaths = imagePaths
    }
}

struct ChatBubble: View {
    let message: ChatMessage
    let authStore: AuthStore

    var body: some View {
        HStack {
            if message.role == .user {
                Spacer(minLength: 36)
            }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 6) {
                ForEach(message.imagePaths, id: \.self) { path in
                    StoreImageView(path: path, authStore: authStore)
                        .frame(maxWidth: 220, maxHeight: 280)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }

                if !message.text.isEmpty || message.imagePaths.isEmpty {
                    Text(message.text.isEmpty ? "…" : message.text)
                        .font(.system(size: GlassControlMetrics.chatTextFontSize))
                        .foregroundStyle(.black.opacity(message.role == .user ? 0.9 : 0.78))
                        .textSelection(.enabled)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .background(backgroundColor, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .stroke(Color.black.opacity(0.07), lineWidth: 1)
                        }
                }
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

/// Renders an image from the rho store, fetching through the authenticated
/// client and caching decoded images for the lifetime of the app.
struct StoreImageView: View {
    let path: String
    let authStore: AuthStore

    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color.black.opacity(0.05))
                    .frame(width: 220, height: 160)
                    .overlay {
                        ProgressView()
                            .controlSize(.small)
                    }
            }
        }
        .task(id: path) {
            if let cached = StoreImageCache.shared.image(for: path) {
                image = cached
                return
            }

            let client = ChatClient(authStore: authStore, conversationID: "store")
            guard let data = try? await client.storeData(path: path),
                  let fetched = UIImage(data: data)
            else {
                return
            }

            StoreImageCache.shared.set(fetched, for: path)
            image = fetched
        }
    }
}

@MainActor
final class StoreImageCache {
    static let shared = StoreImageCache()

    private var images: [String: UIImage] = [:]

    func image(for path: String) -> UIImage? {
        images[path]
    }

    func set(_ image: UIImage, for path: String) {
        images[path] = image
    }
}
