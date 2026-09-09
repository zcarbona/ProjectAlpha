import SwiftUI

// MARK: - Job Status
enum JobStatus: String, CaseIterable, Codable {
    case pending    = "PENDING"
    case inProgress = "IN_PROGRESS"
    case completed  = "COMPLETED"
    case error      = "FAILED"

    var displayName: String {
        switch self {
        case .pending:    return "Pending"
        case .inProgress: return "In Transit"
        case .completed:  return "Delivered"
        case .error:      return "Issue"
        }
    }

    var glassColor: Color {
        switch self {
        case .pending:    return Color.Naql.statusPending
        case .inProgress: return Color.Naql.statusInProgress
        case .completed:  return Color.Naql.statusCompleted
        case .error:      return Color.Naql.statusError
        }
    }

    var icon: String {
        switch self {
        case .pending:    return "clock.fill"
        case .inProgress: return "arrow.triangle.2.circlepath"
        case .completed:  return "checkmark.seal.fill"
        case .error:      return "exclamationmark.triangle.fill"
        }
    }
}

// MARK: - Job Model
struct Job: Identifiable, Codable {
    let id: String
    let pickup: String
    let dropoff: String
    let price: Double
    var status: JobStatus
    let date: String
    let vehicleType: String
}

// MARK: - Status Badge (Glass)
struct StatusBadge: View {
    let status: JobStatus

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: status.icon)
                .font(.system(size: 9, weight: .bold))
            Text(status.displayName.uppercased())
                .font(NaqlTypography.labelStyle())
                .tracking(0.5)
        }
        .foregroundColor(status.glassColor)
        .padding(.horizontal, NaqlMetrics.spaceSM)
        .padding(.vertical, 5)
        .background(
            ZStack {
                Capsule()
                    .fill(status.glassColor.opacity(0.15))
                Capsule()
                    .strokeBorder(status.glassColor.opacity(0.40), lineWidth: 1)
            }
        )
    }
}

// MARK: - Job Card (Glass)
struct JobCard: View {
    let job: Job
    let onSelect: () -> Void
    @State private var isPressed = false

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                // Header row
                HStack {
                    StatusBadge(status: job.status)
                    Spacer()
                    Text("SAR \(String(format: "%.0f", job.price))")
                        .font(NaqlTypography.bodySemiboldStyle())
                        .foregroundColor(Color.Naql.textPrimary)
                }

                // Route visualizer
                HStack(alignment: .center, spacing: NaqlMetrics.spaceMD) {
                    // Dot + line + pin column
                    VStack(spacing: 0) {
                        Circle()
                            .fill(Color.Naql.accentBlue)
                            .frame(width: 9, height: 9)
                            .shadow(color: Color.Naql.accentBlue.opacity(0.6), radius: 4)
                        Rectangle()
                            .fill(Color.white.opacity(0.18))
                            .frame(width: 1.5, height: 22)
                        Image(systemName: "mappin.circle.fill")
                            .font(.system(size: 12))
                            .foregroundColor(Color.Naql.accentGold)
                            .shadow(color: Color.Naql.accentGold.opacity(0.5), radius: 4)
                    }

                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceSM) {
                        Text(job.pickup)
                            .font(NaqlTypography.bodyStyle(isRegular: false))
                            .foregroundColor(Color.Naql.textPrimary)
                            .lineLimit(1)
                        Text(job.dropoff)
                            .font(NaqlTypography.bodyStyle(isRegular: false))
                            .foregroundColor(Color.Naql.textSecondary)
                            .lineLimit(1)
                    }
                }

                // Footer
                HStack {
                    Label(job.id, systemImage: "number")
                        .font(NaqlTypography.captionStyle())
                        .foregroundColor(Color.Naql.textMuted)
                    Spacer()
                    Label(job.date, systemImage: "calendar")
                        .font(NaqlTypography.captionStyle())
                        .foregroundColor(Color.Naql.textMuted)
                }
            }
            .padding(NaqlMetrics.spaceMD)
        }
        .buttonStyle(PlainButtonStyle())
        .glassCard()
        .scaleEffect(isPressed ? 0.97 : 1.0)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: 50,
                            pressing: { pressing in
                                withAnimation(.spring(response: 0.2)) { isPressed = pressing }
                            }, perform: {})
    }
}

// MARK: - Booking Progress Tracker (Glass)
struct BookingProgressTracker: View {
    let currentStep: Int
    let steps = ["Vehicle", "Route", "Provider", "Confirm"]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(0..<steps.count, id: \.self) { index in
                VStack(spacing: NaqlMetrics.spaceXXS) {
                    HStack(spacing: 0) {
                        // Step dot
                        ZStack {
                            Circle()
                                .fill(index <= currentStep
                                      ? Color.Naql.accentBlue
                                      : Color.white.opacity(0.12))
                                .frame(width: 28, height: 28)

                            if index < currentStep {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.white)
                            } else if index == currentStep {
                                Circle()
                                    .fill(Color.white)
                                    .frame(width: 9, height: 9)
                            } else {
                                Text("\(index + 1)")
                                    .font(.system(size: 11, weight: .bold, design: .rounded))
                                    .foregroundColor(Color.Naql.textMuted)
                            }
                        }
                        .shadow(color: index <= currentStep
                                ? Color.Naql.accentBlue.opacity(0.5) : .clear,
                                radius: 8)

                        // Connector line (except last)
                        if index < steps.count - 1 {
                            Rectangle()
                                .fill(
                                    LinearGradient(
                                        colors: index < currentStep
                                            ? [Color.Naql.accentBlue, Color.Naql.accentTeal]
                                            : [Color.white.opacity(0.15), Color.white.opacity(0.15)],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(height: 2)
                                .frame(maxWidth: .infinity)
                        }
                    }

                    Text(steps[index])
                        .font(NaqlTypography.captionStyle())
                        .foregroundColor(index <= currentStep ? Color.Naql.textPrimary : Color.Naql.textMuted)
                }
            }
        }
        .padding(.horizontal, NaqlMetrics.spaceLG)
    }
}

// MARK: - Naql Primary Button (Glass)
struct NaqlButton: View {
    let title: String
    var style: ButtonStylePreset = .primary
    var icon: String? = nil
    let action: () -> Void

    enum ButtonStylePreset {
        case primary, secondary, action, ghost
    }

    @State private var isPressed = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: NaqlMetrics.spaceXS) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                }
                Text(title)
                    .font(NaqlTypography.bodySemiboldStyle())
            }
            .foregroundColor(foregroundColor)
            .frame(maxWidth: .infinity)
            .padding(.vertical, NaqlMetrics.spaceMD)
            .glassButton(accent: accentColor, prominent: style == .primary || style == .action)
        }
        .scaleEffect(isPressed ? 0.97 : 1.0)
        .animation(.spring(response: 0.2), value: isPressed)
        .onLongPressGesture(minimumDuration: 0, maximumDistance: 50,
                            pressing: { pressing in isPressed = pressing }, perform: {})
    }

    private var accentColor: Color {
        switch style {
        case .primary:   return Color.Naql.accentBlue
        case .action:    return Color.Naql.accentGold
        case .secondary: return Color.Naql.accentTeal
        case .ghost:     return Color.clear
        }
    }

    private var foregroundColor: Color {
        switch style {
        case .ghost: return Color.Naql.textSecondary
        default:     return Color.Naql.textPrimary
        }
    }
}

// MARK: - Glass Input Field
struct GlassTextField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var icon: String? = nil
    var isSecure: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
            Text(label)
                .font(NaqlTypography.captionStyle())
                .foregroundColor(Color.Naql.textMuted)
                .padding(.leading, 2)

            HStack(spacing: NaqlMetrics.spaceXS) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color.Naql.textMuted)
                        .frame(width: 20)
                }
                if isSecure {
                    SecureField(placeholder, text: $text)
                        .foregroundColor(Color.Naql.textPrimary)
                        .tint(Color.Naql.accentBlue)
                } else {
                    TextField(placeholder, text: $text)
                        .foregroundColor(Color.Naql.textPrimary)
                        .tint(Color.Naql.accentBlue)
                }
            }
            .padding(NaqlMetrics.spaceMD)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius, style: .continuous)
                        .fill(Color.white.opacity(0.08))
                    RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.20), lineWidth: 1)
                }
            )
        }
    }
}

// MARK: - Glassmorphic Map View
struct NaqlMapView: View {
    @State private var pulse = false
    @State private var truckOffset: CGFloat = 0

    var body: some View {
        ZStack {
            // Deep navy map background
            Color(hex: "050C1A").ignoresSafeArea()

            GeometryReader { geo in
                // Road grid
                Canvas { context, size in
                    // Horizontal streets
                    for y in stride(from: 0, to: size.height, by: 56) {
                        var path = Path()
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: size.width, y: y))
                        context.stroke(path, with: .color(Color.white.opacity(0.06)), lineWidth: 1)
                    }
                    // Vertical streets
                    for x in stride(from: 0, to: size.width, by: 72) {
                        var path = Path()
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x, y: size.height))
                        context.stroke(path, with: .color(Color.white.opacity(0.06)), lineWidth: 1)
                    }
                }

                // Diagonal highway glow
                Path { path in
                    path.move(to: CGPoint(x: 0, y: geo.size.height * 0.25))
                    path.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height * 0.75))
                }
                .stroke(
                    LinearGradient(
                        colors: [Color.Naql.accentBlue.opacity(0.4), Color.Naql.accentTeal.opacity(0.3)],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    style: StrokeStyle(lineWidth: 8, lineCap: .round)
                )

                // Glowing route line
                Path { path in
                    path.move(to: CGPoint(x: geo.size.width * 0.28, y: geo.size.height * 0.42))
                    path.addLine(to: CGPoint(x: geo.size.width * 0.72, y: geo.size.height * 0.60))
                }
                .stroke(Color.Naql.accentBlue.opacity(0.35), style: StrokeStyle(lineWidth: 3, lineCap: .round, dash: [6, 4]))

                // Pickup pin with pulse ring
                ZStack {
                    ForEach(0..<2) { i in
                        Circle()
                            .stroke(Color.Naql.accentBlue.opacity(pulse ? 0 : 0.5), lineWidth: 2)
                            .frame(width: pulse ? CGFloat(36 + i * 20) : 16, height: pulse ? CGFloat(36 + i * 20) : 16)
                            .animation(.easeOut(duration: 1.8).repeatForever().delay(Double(i) * 0.5), value: pulse)
                    }
                    Circle()
                        .fill(Color.Naql.accentBlue)
                        .frame(width: 14, height: 14)
                        .overlay(Circle().fill(Color.white).frame(width: 5, height: 5))
                        .shadow(color: Color.Naql.accentBlue.opacity(0.8), radius: 8)
                }
                .position(x: geo.size.width * 0.28, y: geo.size.height * 0.42)

                // Truck icon (animated along route)
                Image(systemName: "truck.box.fill")
                    .font(.system(size: 20))
                    .foregroundColor(Color.Naql.accentTeal)
                    .shadow(color: Color.Naql.accentTeal.opacity(0.7), radius: 10)
                    .position(
                        x: geo.size.width * 0.28 + (geo.size.width * 0.44) * truckOffset,
                        y: geo.size.height * 0.42 + (geo.size.height * 0.18) * truckOffset
                    )
                    .animation(.easeInOut(duration: 4).repeatForever(autoreverses: true), value: truckOffset)

                // Destination pin
                VStack(spacing: 2) {
                    ZStack {
                        Circle()
                            .fill(Color.Naql.accentGold.opacity(0.2))
                            .frame(width: 36, height: 36)
                        Image(systemName: "mappin.circle.fill")
                            .font(.system(size: 26))
                            .foregroundColor(Color.Naql.accentGold)
                            .shadow(color: Color.Naql.accentGold.opacity(0.7), radius: 10)
                    }
                }
                .position(x: geo.size.width * 0.72, y: geo.size.height * 0.58)
            }
        }
        .onAppear {
            pulse = true
            truckOffset = 1
        }
    }
}

// MARK: - Glass Bottom Sheet
struct SlidingBottomSheet<Content: View>: View {
    @Binding var isOpen: Bool
    let maxHeight: CGFloat
    let content: () -> Content

    @GestureState private var translation: CGFloat = 0

    private var offset: CGFloat {
        isOpen ? 0 : maxHeight - 110
    }

    var body: some View {
        GeometryReader { _ in
            VStack(spacing: 0) {
                // Grab handle
                GlassGrabber()
                    .frame(height: 36)
                    .background(Color.clear)
                    .gesture(
                        DragGesture()
                            .updating($translation) { value, state, _ in
                                state = value.translation.height
                            }
                            .onEnded { value in
                                let snap = maxHeight * 0.18
                                if value.translation.height > snap { isOpen = false }
                                else if value.translation.height < -snap { isOpen = true }
                            }
                    )

                content()
                    .frame(height: maxHeight - 36)
            }
            .background(
                ZStack {
                    // Blur base
                    BlurView(style: .systemUltraThinMaterialDark)
                    // Glass tint
                    Color.Naql.glassElevated
                    // Specular top rim
                    LinearGradient(
                        colors: [Color.Naql.glassSpecular.opacity(0.5), Color.clear],
                        startPoint: .top,
                        endPoint: .init(x: 0.5, y: 0.2)
                    )
                }
            )
            .cornerRadius(NaqlMetrics.sheetRadius, corners: [.topLeft, .topRight])
            .overlay(
                // Top rim border
                RoundedRectangle(cornerRadius: NaqlMetrics.sheetRadius, style: .continuous)
                    .trim(from: 0, to: 0.5)
                    .stroke(Color.white.opacity(0.22), lineWidth: 1)
                    .padding(.horizontal, 0.5)
            )
            .shadow(color: Color.black.opacity(0.5), radius: 40, x: 0, y: -10)
            .frame(height: maxHeight, alignment: .bottom)
            .offset(y: max(self.offset + self.translation, 0))
            .animation(.interactiveSpring(response: 0.4, dampingFraction: 0.8), value: isOpen)
            .animation(.interactiveSpring(response: 0.4, dampingFraction: 0.8), value: translation)
        }
    }
}

struct GlassGrabber: View {
    var body: some View {
        VStack(spacing: 0) {
            Spacer()
            RoundedRectangle(cornerRadius: 3)
                .fill(Color.white.opacity(0.30))
                .frame(width: 36, height: 4)
            Spacer()
        }
    }
}

// MARK: - Glass Stat Card
struct GlassStatCard: View {
    let title: String
    let value: String
    let icon: String
    let accentColor: Color

    var body: some View {
        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(accentColor.opacity(0.20))
                        .frame(width: 32, height: 32)
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(accentColor)
                }
                Spacer()
            }
            Text(value)
                .font(NaqlTypography.headingStyle(size: .small))
                .foregroundColor(Color.Naql.textPrimary)
            Text(title)
                .font(NaqlTypography.captionStyle())
                .foregroundColor(Color.Naql.textMuted)
        }
        .padding(NaqlMetrics.spaceMD)
        .frame(maxWidth: .infinity)
        .glassCard()
    }
}

// MARK: - Glass Section Header
struct GlassSectionHeader: View {
    let title: String
    var count: Int? = nil

    var body: some View {
        HStack {
            Text(title)
                .font(NaqlTypography.headingStyle(size: .small))
                .foregroundColor(Color.Naql.textPrimary)
            if let count = count {
                Text("\(count)")
                    .font(NaqlTypography.labelStyle())
                    .foregroundColor(Color.Naql.accentBlue)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Color.Naql.accentBlue.opacity(0.18)))
            }
            Spacer()
        }
    }
}

// MARK: - Glass Divider
struct GlassDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color.white.opacity(0.10))
            .frame(height: 1)
    }
}
