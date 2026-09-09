import SwiftUI

// MARK: - Naql Calm-Corporate Color Palette
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 1)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    struct Naql {
        // Base
        static let background = Color(hex: "F7F9FC")
        static let textPrimary = Color(hex: "1A202C")
        static let textMuted = Color(hex: "718096")
        
        // Accents
        static let primary = Color(hex: "2B6CB0")
        static let secondary = Color(hex: "81E6D9")
        static let action = Color(hex: "ED8936")
        
        // Semantic Statuses
        static let pending = Color(hex: "FBD38D")
        static let inProgress = Color(hex: "63B3ED")
        static let completed = Color(hex: "68D391")
        static let error = Color(hex: "FC8181")
    }
}

// MARK: - Spacing & Corner Radii Rules
struct NaqlMetrics {
    // 8px Grid System
    static let spaceXXS: CGFloat = 4
    static let spaceXS: CGFloat = 8
    static let spaceSM: CGFloat = 12
    static let spaceMD: CGFloat = 16
    static let spaceLG: CGFloat = 24
    static let spaceXL: CGFloat = 32
    static let spaceXXL: CGFloat = 48
    
    // Corners
    static let cardRadius: CGFloat = 24
    static let controlRadius: CGFloat = 12
}

// MARK: - Typography & Fonts
struct NaqlTypography {
    static func headingStyle(size: HeadingSize) -> Font {
        switch size {
        case .large:
            return .system(size: 32, weight: .bold, design: .rounded)
        case .medium:
            return .system(size: 24, weight: .semibold, design: .rounded)
        case .small:
            return .system(size: 20, weight: .semibold, design: .rounded)
        }
    }
    
    enum HeadingSize {
        case large, medium, small
    }
    
    static func bodyStyle(isRegular: Bool = true) -> Font {
        return .system(size: isRegular ? 16 : 14, weight: .regular, design: .rounded)
    }
    
    static func bodySemiboldStyle(isRegular: Bool = true) -> Font {
        return .system(size: isRegular ? 16 : 14, weight: .semibold, design: .rounded)
    }
    
    static func labelStyle() -> Font {
        return .system(size: 12, weight: .bold, design: .rounded)
    }
}

// MARK: - Vision Glass Modifier
struct GlassModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial)
            .cornerRadius(NaqlMetrics.cardRadius)
            .overlay(
                RoundedRectangle(cornerRadius: NaqlMetrics.cardRadius)
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 5)
    }
}

extension View {
    func glassCard() -> some View {
        self.modifier(GlassModifier())
    }
}
