import SwiftUI

struct ChatSheetView: View {
    @State private var draft = ""

    var body: some View {
        Color.white
            .ignoresSafeArea()
            .safeAreaInset(edge: .bottom, spacing: 0) {
                AgentInput(draft: $draft)
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
}

private struct AgentInput: View {
    @Binding var draft: String

    private var isSendDisabled: Bool {
        draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
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
                Button(action: {}) {
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

#Preview {
    ChatSheetView()
}
