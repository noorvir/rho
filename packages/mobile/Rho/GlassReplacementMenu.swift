import SwiftUI

enum GlassReplacementMenuPlacement {
    case top
    case bottom

    var defaultAlignment: Alignment {
        switch self {
        case .top:
            return .top
        case .bottom:
            return .bottom
        }
    }
}

struct GlassReplacementMenu<Source: View, Replacement: View>: View {
    let isPresented: Bool
    var alignment: Alignment
    var cornerRadius: CGFloat = 30
    var spacing: CGFloat = 44

    private let source: () -> Source
    private let replacement: () -> Replacement

    @Namespace private var glassNamespace

    init(
        isPresented: Bool,
        placement: GlassReplacementMenuPlacement = .bottom,
        alignment: Alignment? = nil,
        cornerRadius: CGFloat = 30,
        spacing: CGFloat = 44,
        @ViewBuilder source: @escaping () -> Source,
        @ViewBuilder replacement: @escaping () -> Replacement
    ) {
        self.isPresented = isPresented
        self.alignment = alignment ?? placement.defaultAlignment
        self.cornerRadius = cornerRadius
        self.spacing = spacing
        self.source = source
        self.replacement = replacement
    }

    var body: some View {
        Group {
            if #available(iOS 26.0, *) {
                GlassEffectContainer(spacing: spacing) {
                    menuContent
                }
            } else {
                menuContent
            }
        }
    }

    @ViewBuilder
    private var menuContent: some View {
        ZStack(alignment: alignment) {
            if isPresented {
                glassMorphSurface(replacement())
            } else {
                glassMorphSurface(source())
            }
        }
    }

    @ViewBuilder
    private func glassMorphSurface<Surface: View>(_ surface: Surface) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        if #available(iOS 26.0, *) {
            surface
                .glassEffect(.regular, in: shape)
                .glassEffectID("replacement-menu-surface", in: glassNamespace)
                .glassEffectTransition(.matchedGeometry)
                .controlBorder(cornerRadius: cornerRadius)
                .shadow(color: .black.opacity(0.08), radius: 28, y: 12)
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
        } else {
            surface
                .glassSurface(cornerRadius: cornerRadius)
                .transition(.opacity)
        }
    }
}

extension View {
    func controlSurface(cornerRadius: CGFloat) -> some View {
        background(.white, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .controlBorder(cornerRadius: cornerRadius)
            .controlShadow()
    }

    func controlBorder(cornerRadius: CGFloat) -> some View {
        overlay {
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .stroke(Color.black.opacity(0.08), lineWidth: 1)
        }
    }

    func controlShadow() -> some View {
        shadow(color: .black.opacity(0.035), radius: 10, y: 4)
    }

    @ViewBuilder
    func glassSurface(cornerRadius: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

        if #available(iOS 26.0, *) {
            glassEffect(.regular, in: shape)
                .controlBorder(cornerRadius: cornerRadius)
                .shadow(color: .black.opacity(0.08), radius: 28, y: 12)
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
        } else {
            background(.regularMaterial, in: shape)
                .background(.white.opacity(0.72), in: shape)
                .controlBorder(cornerRadius: cornerRadius)
                .shadow(color: .black.opacity(0.08), radius: 28, y: 12)
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
        }
    }
}
