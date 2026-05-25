import SwiftUI

struct IssueDetailView: View {
    let openChat: () -> Void

    var body: some View {
        Color.white
            .ignoresSafeArea()
            .safeAreaInset(edge: .bottom, spacing: 0) {
                BottomControls(openChat: openChat)
            }
    }
}

private struct BottomControls: View {
    let openChat: () -> Void

    var body: some View {
        CommentBar(openChat: openChat)
            .padding(.horizontal, 20)
            .padding(.top, 14)
            .padding(.bottom, 8)
            .background {
                LinearGradient(
                    stops: [
                        Gradient.Stop(color: .white.opacity(0), location: 0),
                        Gradient.Stop(color: .white.opacity(0.96), location: 0.32),
                        Gradient.Stop(color: .white, location: 1),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
            }
    }
}

private struct CommentBar: View {
    let openChat: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            IconButton(systemName: "tray.full", size: 48)

            HStack(spacing: 14) {
                Image(systemName: "plus")
                    .font(.system(size: 21, weight: .medium))
                Text("Comment")
                    .font(.system(size: 18))
                    .foregroundStyle(.secondary.opacity(0.58))
                    .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 18)
            .frame(height: 48)
            .controlBox()

            Button(action: openChat) {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.primary)
                    .frame(width: 48, height: 48)
                    .controlBox()
            }
            .buttonStyle(.plain)
        }
    }
}

private struct IconButton: View {
    let systemName: String
    let size: CGFloat

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: size * 0.4, weight: .medium))
            .frame(width: size, height: size)
            .controlBox()
    }
}

private extension View {
    func controlBox() -> some View {
        background(.white, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(Color.black.opacity(0.08), lineWidth: 1)
            }
            .shadow(color: .black.opacity(0.035), radius: 10, y: 4)
    }
}

#Preview {
    IssueDetailView(openChat: {})
}
