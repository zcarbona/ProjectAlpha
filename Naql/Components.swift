import SwiftUI

// MARK: - Status Enum & Badge
enum JobStatus: String, CaseIterable, Codable {
    case pending = "PENDING"
    case inProgress = "IN_PROGRESS"
    case completed = "COMPLETED"
    case error = "FAILED"
    
    var displayName: String {
        switch self {
        case .pending: return "Pending"
        case .inProgress: return "Your truck is on its way"
        case .completed: return "Delivery completed"
        case .error: return "Issue reported"
        }
    }
    
    var color: Color {
        switch self {
        case .pending: return Color.Naql.pending
        case .inProgress: return Color.Naql.inProgress
        case .completed: return Color.Naql.completed
        case .error: return Color.Naql.error
        }
    }
    
    var textColor: Color {
        switch self {
        case .pending: return Color(hex: "7B341E")
        case .inProgress: return Color(hex: "1A365D")
        case .completed: return Color(hex: "22543D")
        case .error: return Color(hex: "742A2A")
        }
    }
}

struct StatusBadge: View {
    let status: JobStatus
    
    var body: some View {
        Text(status.displayName.uppercased())
            .font(NaqlTypography.labelStyle())
            .tracking(0.6)
            .padding(.horizontal, NaqlMetrics.spaceSM)
            .padding(.vertical, NaqlMetrics.spaceXXS + 2)
            .background(status.color.opacity(0.6))
            .foregroundColor(.white)
            .cornerRadius(NaqlMetrics.controlRadius)
    }
}

// MARK: - Job Model & Component
struct Job: Identifiable, Codable {
    let id: String
    let pickup: String
    let dropoff: String
    let price: Double
    var status: JobStatus
    let date: String
    let vehicleType: String
}

struct JobCard: View {
    let job: Job
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                HStack {
                    StatusBadge(status: job.status)
                    Spacer()
                    Text("$\(String(format: "%.2f", job.price))")
                        .font(NaqlTypography.bodySemiboldStyle())
                        .foregroundColor(Color.Naql.textPrimary)
                }
                
                HStack(spacing: NaqlMetrics.spaceMD) {
                    VStack(spacing: 0) {
                        Image(systemName: "circle.fill")
                            .font(.system(size: 8))
                            .foregroundColor(Color.Naql.primary)
                        
                        Rectangle()
                            .fill(Color.Naql.textMuted.opacity(0.3))
                            .frame(width: 1.5, height: 24)
                        
                        Image(systemName: "mappin.circle.fill")
                            .font(.system(size: 10))
                            .foregroundColor(Color.Naql.action)
                    }
                    
                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceSM) {
                        Text(job.pickup)
                            .font(NaqlTypography.bodyStyle(isRegular: false))
                            .foregroundColor(Color.Naql.textPrimary)
                            .lineLimit(1)
                        
                        Text(job.dropoff)
                            .font(NaqlTypography.bodyStyle(isRegular: false))
                            .foregroundColor(Color.Naql.textPrimary)
                            .lineLimit(1)
                    }
                }
                
                HStack {
                    Text("ID: \(job.id)")
                        .font(NaqlTypography.bodyStyle(isRegular: false))
                        .foregroundColor(Color.Naql.textMuted)
                    Spacer()
                    Text(job.date)
                        .font(NaqlTypography.bodyStyle(isRegular: false))
                        .foregroundColor(Color.Naql.textMuted)
                }
            }
            .padding(NaqlMetrics.spaceMD)
            .glassCard()
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Booking Progress Tracker
struct BookingProgressTracker: View {
    let currentStep: Int // 0 to 3
    let steps = ["Vehicle", "Route", "Provider", "Confirm"]
    
    var body: some View {
        HStack(spacing: 0) {
            ForEach(0..<steps.count, id: \.self) { index in
                HStack(spacing: 0) {
                    // Dot
                    Circle()
                        .fill(index <= currentStep ? Color.Naql.primary : Color.Naql.textMuted.opacity(0.3))
                        .frame(width: 12, height: 12)
                        .overlay(
                            Circle()
                                .stroke(Color.Naql.primary.opacity(0.2), lineWidth: index == currentStep ? 6 : 0)
                        )
                    
                    // Line (except last)
                    if index < steps.count - 1 {
                        Rectangle()
                            .fill(index < currentStep ? Color.Naql.primary : Color.Naql.textMuted.opacity(0.3))
                            .frame(height: 2)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .padding(.horizontal, NaqlMetrics.spaceLG)
    }
}

// MARK: - Custom Button
struct NaqlButton: View {
    let title: String
    var style: ButtonStylePreset = .primary
    let action: () -> Void
    
    enum ButtonStylePreset {
        case primary, secondary, action
    }
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(NaqlTypography.bodySemiboldStyle())
                .foregroundColor(textColor)
                .frame(maxWidth: .infinity)
                .padding(.vertical, NaqlMetrics.spaceMD)
                .background(backgroundColor)
                .cornerRadius(NaqlMetrics.controlRadius)
                .overlay(
                    RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius)
                        .stroke(Color.white.opacity(0.2), lineWidth: 1)
                )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var backgroundColor: Color {
        switch style {
        case .primary: return Color.Naql.primary
        case .secondary: return Color.Naql.secondary.opacity(0.5)
        case .action: return Color.Naql.action
        }
    }
    
    private var textColor: Color {
        switch style {
        case .primary: return Color.white
        case .secondary: return Color.Naql.textPrimary
        case .action: return Color.white
        }
    }
}

// MARK: - Stylized Map Grid View
struct NaqlMapView: View {
    @State private var pulse = false
    
    var body: some View {
        ZStack {
            // Calming abstract blue-gray background map grid
            Color(hex: "EBF1F6")
                .edgesIgnoringSafeArea(.all)
            
            // Stylized grid paths
            GeometryReader { geo in
                Path { path in
                    // Horizontal streets
                    for y in stride(from: 0, to: geo.size.height, by: 60) {
                        path.move(to: CGPoint(x: 0, y: y))
                        path.addLine(to: CGPoint(x: geo.size.width, y: y))
                    }
                    // Vertical streets
                    for x in stride(from: 0, to: geo.size.width, by: 80) {
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x, y: geo.size.height))
                    }
                }
                .stroke(Color.white, lineWidth: 6)
                
                // Abstract diagonal highway
                Path { path in
                    path.move(to: CGPoint(x: 0, y: geo.size.height * 0.2))
                    path.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height * 0.8))
                }
                .stroke(Color(hex: "DFE6ED"), lineWidth: 12)
                
                // Pickup Pin
                Circle()
                    .fill(Color.Naql.primary)
                    .frame(width: 14, height: 14)
                    .position(x: geo.size.width * 0.3, y: geo.size.height * 0.45)
                    .overlay(
                        Circle()
                            .stroke(Color.Naql.primary.opacity(0.3), lineWidth: pulse ? 12 : 2)
                            .position(x: geo.size.width * 0.3, y: geo.size.height * 0.45)
                            .scaleEffect(pulse ? 1.5 : 1.0)
                            .opacity(pulse ? 0.0 : 1.0)
                    )
                
                // Destination Pin
                VStack(spacing: 0) {
                    Image(systemName: "mappin.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(Color.Naql.action)
                }
                .position(x: geo.size.width * 0.7, y: geo.size.height * 0.6)
            }
        }
        .onAppear {
            withAnimation(Animation.easeOut(duration: 1.5).repeatForever(autoreverses: false)) {
                pulse = true
            }
        }
    }
}

// MARK: - Sliding Bottom Sheet
struct SlidingBottomSheet<Content: View>: View {
    @Binding var isOpen: Bool
    let maxHeight: CGFloat
    let content: () -> Content
    
    @GestureState private var translation: CGFloat = 0
    
    private var offset: CGFloat {
        isOpen ? 0 : maxHeight - 100
    }
    
    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                // Drag Handle Bar
                Grabber()
                    .frame(height: 30)
                    .gesture(
                        DragGesture().updating(self.$translation) { value, state, _ in
                            state = value.translation.height
                        }.onEnded { value in
                            let snapDistance = maxHeight * 0.2
                            if value.translation.height > snapDistance {
                                self.isOpen = false
                            } else if value.translation.height < -snapDistance {
                                self.isOpen = true
                            }
                        }
                    )
                
                // Drawer Content
                content()
                    .frame(height: maxHeight - 30)
            }
            .glassCard()
            .cornerRadius(24, corners: [.topLeft, .topRight])
            .frame(height: maxHeight, alignment: .bottom)
            .offset(y: max(self.offset + self.translation, 0))
            .animation(.interactiveSpring(), value: isOpen)
            .animation(.interactiveSpring(), value: translation)
        }
    }
}

struct Grabber: View {
    var body: some View {
        VStack {
            Spacer()
            RoundedRectangle(cornerRadius: 3)
                .fill(Color.white.opacity(0.4))
                .frame(width: 40, height: 5)
            Spacer()
        }
    }
}

// Corner helper
struct CornerRadiusShape: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(roundedRect: rect, byRoundingCorners: corners, cornerRadii: CGSize(width: radius, height: radius))
        return Path(path.cgPath)
    }
}

extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(CornerRadiusShape(radius: radius, corners: corners))
    }
}
