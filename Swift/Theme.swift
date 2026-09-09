import SwiftUI

// MARK: - Hex Color Initializer
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 255, 255, 255)
        }
        self.init(.sRGB,
                  red: Double(r) / 255,
                  green: Double(g) / 255,
                  blue: Double(b) / 255,
                  opacity: Double(a) / 255)
    }
}

// MARK: - Naql Liquid Glass Color Palette
extension Color {
    struct Naql {
        // ── Deep space gradient bases ──────────────────────────────────────
        static let gradientTop    = Color(hex: "0A0E1A")   // near-black indigo
        static let gradientMid    = Color(hex: "0D1B3E")   // deep navy
        static let gradientBottom = Color(hex: "091428")   // dark ocean

        // ── Glass surface layers ──────────────────────────────────────────
        /// Primary card/sheet glass fill
        static let glassFill      = Color.white.opacity(0.10)
        /// Elevated glass (modals, popovers)
        static let glassElevated  = Color.white.opacity(0.16)
        /// Pressed / active state
        static let glassActive    = Color.white.opacity(0.22)
        /// Specular rim highlight (top-left edge)
        static let glassSpecular  = Color.white.opacity(0.55)
        /// Glass border / stroke
        static let glassBorder    = Color.white.opacity(0.20)
        /// Dark glass tint (for overlays)
        static let glassDark      = Color.black.opacity(0.30)

        // ── Brand accents ─────────────────────────────────────────────────
        static let accentBlue     = Color(hex: "3D8EF0")   // iOS system blue-ish
        static let accentTeal     = Color(hex: "30D5C8")   // liquid teal
        static let accentGold     = Color(hex: "F5C842")   // warm amber
        static let accentCoral    = Color(hex: "FF6B6B")   // error/danger

        // ── Text on glass ─────────────────────────────────────────────────
        static let textPrimary    = Color.white
        static let textSecondary  = Color.white.opacity(0.75)
        static let textMuted      = Color.white.opacity(0.45)
        static let textOnAccent   = Color.white

        // ── Semantic status tints (glass-friendly) ────────────────────────
        static let statusPending    = Color(hex: "F5C842").opacity(0.85)
        static let statusInProgress = Color(hex: "3D8EF0").opacity(0.85)
        static let statusCompleted  = Color(hex: "30D5C8").opacity(0.85)
        static let statusError      = Color(hex: "FF6B6B").opacity(0.85)

        // ── Legacy bridge (used internally by status badges) ──────────────
        static let pending    = statusPending
        static let inProgress = statusInProgress
        static let completed  = statusCompleted
        static let error      = statusError

        // ── Kept for backward compat ──────────────────────────────────────
        static let primary   = accentBlue
        static let secondary = accentTeal
        static let action    = accentGold
        static let background  = gradientTop
        static let surface     = glassFill
        static let textMutedLegacy = textMuted
    }
}

// MARK: - Spacing & Corner Radii
struct NaqlMetrics {
    static let spaceXXS: CGFloat = 4
    static let spaceXS:  CGFloat = 8
    static let spaceSM:  CGFloat = 12
    static let spaceMD:  CGFloat = 16
    static let spaceLG:  CGFloat = 24
    static let spaceXL:  CGFloat = 32
    static let spaceXXL: CGFloat = 48

    static let cardRadius:    CGFloat = 24   // softer large glass card
    static let sheetRadius:   CGFloat = 32   // bottom sheets / modals
    static let controlRadius: CGFloat = 14   // buttons, inputs
    static let badgeRadius:   CGFloat = 10
    static let pillRadius:    CGFloat = 100  // fully-rounded pill
}

// MARK: - Typography
struct NaqlTypography {
    enum HeadingSize { case large, medium, small }

    static func headingStyle(size: HeadingSize) -> Font {
        switch size {
        case .large:  return .system(size: 34, weight: .bold,     design: .rounded)
        case .medium: return .system(size: 26, weight: .semibold, design: .rounded)
        case .small:  return .system(size: 20, weight: .semibold, design: .rounded)
        }
    }

    static func bodyStyle(isRegular: Bool = true) -> Font {
        .system(size: isRegular ? 16 : 14, weight: .regular, design: .rounded)
    }

    static func bodySemiboldStyle(isRegular: Bool = true) -> Font {
        .system(size: isRegular ? 16 : 14, weight: .semibold, design: .rounded)
    }

    static func labelStyle() -> Font {
        .system(size: 11, weight: .bold, design: .rounded)
    }

    static func captionStyle() -> Font {
        .system(size: 12, weight: .medium, design: .rounded)
    }
}

// MARK: - Full-Screen Animated Gradient Background
struct NaqlGradientBackground: View {
    @State private var animate = false

    var body: some View {
        ZStack {
            // Deep base
            LinearGradient(
                colors: [Color.Naql.gradientTop, Color.Naql.gradientMid, Color.Naql.gradientBottom],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            // Slow-moving aurora orbs
            Circle()
                .fill(Color.Naql.accentBlue.opacity(0.18))
                .frame(width: 420, height: 420)
                .blur(radius: 80)
                .offset(x: animate ? -60 : 60, y: animate ? -120 : -60)
                .animation(.easeInOut(duration: 8).repeatForever(autoreverses: true), value: animate)

            Circle()
                .fill(Color.Naql.accentTeal.opacity(0.12))
                .frame(width: 360, height: 360)
                .blur(radius: 90)
                .offset(x: animate ? 80 : -40, y: animate ? 160 : 80)
                .animation(.easeInOut(duration: 11).repeatForever(autoreverses: true), value: animate)

            Circle()
                .fill(Color.Naql.accentGold.opacity(0.07))
                .frame(width: 280, height: 280)
                .blur(radius: 70)
                .offset(x: animate ? 40 : -80, y: animate ? -40 : 120)
                .animation(.easeInOut(duration: 9).repeatForever(autoreverses: true), value: animate)
        }
        .ignoresSafeArea()
        .onAppear { animate = true }
    }
}

// MARK: - Glass Card Modifier
/// Applies the full frosted-glass look: blur fill + specular rim + shadow
struct GlassCardModifier: ViewModifier {
    var elevated: Bool = false
    var cornerRadius: CGFloat = NaqlMetrics.cardRadius

    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    // Frosted translucent fill
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(elevated ? Color.Naql.glassElevated : Color.Naql.glassFill)

                    // Subtle inner gradient top-to-bottom
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Color.white.opacity(0.12), Color.clear],
                                startPoint: .top,
                                endPoint: .center
                            )
                        )

                    // Specular top-left rim highlight
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .strokeBorder(
                            LinearGradient(
                                colors: [Color.Naql.glassSpecular, Color.Naql.glassBorder, Color.clear],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                }
                .shadow(color: Color.black.opacity(0.35), radius: 24, x: 0, y: 12)
                .shadow(color: Color.Naql.accentBlue.opacity(0.10), radius: 12, x: 0, y: 4)
            )
    }
}

extension View {
    func glassCard(elevated: Bool = false, cornerRadius: CGFloat = NaqlMetrics.cardRadius) -> some View {
        self.modifier(GlassCardModifier(elevated: elevated, cornerRadius: cornerRadius))
    }
}

// MARK: - Glass Button Modifier
struct GlassButtonModifier: ViewModifier {
    var accent: Color = Color.Naql.accentBlue
    var isProminent: Bool = false

    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius, style: .continuous)
                        .fill(isProminent
                              ? accent.opacity(0.85)
                              : Color.white.opacity(0.13))

                    if isProminent {
                        // Gloss sweep on prominent button
                        RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius, style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [Color.white.opacity(0.28), Color.clear],
                                    startPoint: .top,
                                    endPoint: .center
                                )
                            )
                    }

                    RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius, style: .continuous)
                        .strokeBorder(
                            isProminent
                            ? Color.white.opacity(0.30)
                            : Color.white.opacity(0.18),
                            lineWidth: 1
                        )
                }
                .shadow(color: isProminent ? accent.opacity(0.45) : Color.black.opacity(0.20),
                        radius: isProminent ? 16 : 8, x: 0, y: isProminent ? 6 : 3)
            )
    }
}

extension View {
    func glassButton(accent: Color = Color.Naql.accentBlue, prominent: Bool = false) -> some View {
        self.modifier(GlassButtonModifier(accent: accent, isProminent: prominent))
    }
}

// MARK: - Liquid Shadow
struct LiquidShadowModifier: ViewModifier {
    var color: Color = Color.black
    var radius: CGFloat = 20
    var y: CGFloat = 8

    func body(content: Content) -> some View {
        content
            .shadow(color: color.opacity(0.40), radius: radius, x: 0, y: y)
            .shadow(color: color.opacity(0.15), radius: radius / 2, x: 0, y: y / 2)
    }
}

extension View {
    func liquidShadow(color: Color = .black, radius: CGFloat = 20, y: CGFloat = 8) -> some View {
        self.modifier(LiquidShadowModifier(color: color, radius: radius, y: y))
    }

    // Legacy compat
    func softShadow() -> some View {
        self.liquidShadow()
    }
}

// MARK: - Blur Background (UIKit bridge)
struct BlurView: UIViewRepresentable {
    var style: UIBlurEffect.Style = .systemUltraThinMaterialDark

    func makeUIView(context: Context) -> UIVisualEffectView {
        UIVisualEffectView(effect: UIBlurEffect(style: style))
    }
    func updateUIView(_ uiView: UIVisualEffectView, context: Context) {}
}

// MARK: - Corner Radius Shape Helper
struct CornerRadiusShape: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(CornerRadiusShape(radius: radius, corners: corners))
    }
}
