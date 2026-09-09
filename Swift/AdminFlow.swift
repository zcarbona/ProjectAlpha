import SwiftUI

// MARK: - Audit Log Model
struct AuditLog: Identifiable {
    let id: String
    let timestamp: String
    let action: String
    let status: AuditStatus

    enum AuditStatus: String {
        case success = "SUCCESS"
        case warning = "WARNING"
        case alert   = "ALERT"

        var color: Color {
            switch self {
            case .success: return Color.Naql.accentTeal
            case .warning: return Color.Naql.accentGold
            case .alert:   return Color.Naql.accentCoral
            }
        }

        var icon: String {
            switch self {
            case .success: return "checkmark.circle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .alert:   return "exclamationmark.octagon.fill"
            }
        }
    }
}

// MARK: - Admin Flow Root
struct AdminFlowView: View {
    @Binding var currentFlow: String

    @State private var platformStatus = "OPERATIONAL"
    @State private var loadFactor: Double = 42
    @State private var totalEarnings:   Double = 148_200
    @State private var totalDeliveries: Int    = 1_042
    @State private var animateKPI = false

    @State private var logs: [AuditLog] = [
        AuditLog(id: "L-110", timestamp: "11:32 AM", action: "User NQL-9082 placed container dispatch.",         status: .success),
        AuditLog(id: "L-109", timestamp: "11:20 AM", action: "Driver assigned to plate 'د ص ح ١٠٩٢'.",           status: .success),
        AuditLog(id: "L-108", timestamp: "10:55 AM", action: "Platform simulated latency spike detected.",        status: .warning),
        AuditLog(id: "L-107", timestamp: "10:01 AM", action: "Admin cleared database query locks.",               status: .success)
    ]

    private var isOperational: Bool { platformStatus == "OPERATIONAL" }

    var body: some View {
        NavigationView {
            ZStack {
                NaqlGradientBackground()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceLG) {
                        headerSection
                        kpiSection
                        loadGaugeSection
                        controlDeskSection
                        auditLogSection
                    }
                    .padding(.horizontal, NaqlMetrics.spaceMD)
                    .padding(.bottom, NaqlMetrics.spaceXXL)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: { currentFlow = "landing" }) {
                        HStack(spacing: 4) {
                            Image(systemName: "rectangle.portrait.and.arrow.right").font(.system(size: 13))
                            Text("Logout").font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                        }
                        .foregroundColor(Color.Naql.textMuted)
                    }
                }
                ToolbarItem(placement: .principal) {
                    Text("Platform Overseer")
                        .font(NaqlTypography.bodySemiboldStyle())
                        .foregroundColor(Color.Naql.textPrimary)
                }
            }
            .onAppear {
                withAnimation(.easeOut(duration: 0.8).delay(0.2)) {
                    animateKPI = true
                }
            }
        }
        .navigationViewStyle(.stack)
    }

    // MARK: - Header Section
    private var headerSection: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                Text("Good morning, Admin")
                    .font(NaqlTypography.headingStyle(size: .medium))
                    .foregroundColor(Color.Naql.textPrimary)
                Text("Platform metrics & integrity.")
                    .font(NaqlTypography.bodyStyle())
                    .foregroundColor(Color.Naql.textMuted)
            }
            Spacer()
            platformStatusBadge
        }
        .padding(.top, NaqlMetrics.spaceLG)
    }

    private var platformStatusBadge: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(isOperational ? Color.Naql.accentTeal : Color.Naql.accentCoral)
                .frame(width: 8, height: 8)
                .shadow(color: (isOperational ? Color.Naql.accentTeal : Color.Naql.accentCoral).opacity(0.8), radius: 4)
            Text(platformStatus)
                .font(NaqlTypography.labelStyle())
                .foregroundColor(isOperational ? Color.Naql.accentTeal : Color.Naql.accentCoral)
        }
        .padding(.horizontal, NaqlMetrics.spaceSM)
        .padding(.vertical, 7)
        .background(
            ZStack {
                Capsule()
                    .fill((isOperational ? Color.Naql.accentTeal : Color.Naql.accentCoral).opacity(0.12))
                Capsule()
                    .strokeBorder((isOperational ? Color.Naql.accentTeal : Color.Naql.accentCoral).opacity(0.35), lineWidth: 1)
            }
        )
    }

    // MARK: - KPI Section
    private var kpiSection: some View {
        HStack(spacing: NaqlMetrics.spaceMD) {
            kpiCard(
                title: "Gross Volume",
                value: "SAR \(Int(totalEarnings))",
                detail: "+12.4% this week",
                icon: "chart.line.uptrend.xyaxis.circle.fill",
                accent: Color.Naql.accentBlue
            )
            kpiCard(
                title: "Dispatch Cycles",
                value: "\(totalDeliveries)",
                detail: "99.2% success rate",
                icon: "checkmark.seal.fill",
                accent: Color.Naql.accentTeal
            )
        }
    }

    private func kpiCard(title: String, value: String, detail: String, icon: String, accent: Color) -> some View {
        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
            HStack {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(accent.opacity(0.20))
                        .frame(width: 36, height: 36)
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(accent)
                }
                Spacer()
            }

            Text(animateKPI ? value : "—")
                .font(NaqlTypography.headingStyle(size: .medium))
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color.Naql.textPrimary, accent.opacity(0.8)],
                        startPoint: .leading, endPoint: .trailing)
                )
                .animation(.easeOut(duration: 0.6), value: animateKPI)

            Text(title)
                .font(NaqlTypography.captionStyle())
                .foregroundColor(Color.Naql.textMuted)

            HStack(spacing: 4) {
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(accent)
                Text(detail)
                    .font(NaqlTypography.captionStyle())
                    .foregroundColor(accent)
            }
        }
        .padding(NaqlMetrics.spaceLG)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard(elevated: true)
    }

    // MARK: - Load Gauge Section
    private var loadGaugeSection: some View {
        VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
            HStack {
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                    Text("Platform Load Factor")
                        .font(NaqlTypography.bodySemiboldStyle())
                        .foregroundColor(Color.Naql.textPrimary)
                    Text("Optimal threshold under 75%")
                        .font(NaqlTypography.captionStyle())
                        .foregroundColor(Color.Naql.textMuted)
                }
                Spacer()
                // Circular gauge badge
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.10), lineWidth: 5)
                        .frame(width: 56, height: 56)
                    Circle()
                        .trim(from: 0, to: CGFloat(loadFactor / 100))
                        .stroke(
                            loadFactor > 75 ? Color.Naql.accentCoral : Color.Naql.accentBlue,
                            style: StrokeStyle(lineWidth: 5, lineCap: .round)
                        )
                        .frame(width: 56, height: 56)
                        .rotationEffect(.degrees(-90))
                        .animation(.easeOut(duration: 0.6), value: loadFactor)
                    Text("\(Int(loadFactor))%")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(loadFactor > 75 ? Color.Naql.accentCoral : Color.Naql.textPrimary)
                }
            }

            // Linear bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(Color.white.opacity(0.08))
                        .frame(height: 8)

                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: loadFactor > 75
                                    ? [Color.Naql.accentGold, Color.Naql.accentCoral]
                                    : [Color.Naql.accentBlue, Color.Naql.accentTeal],
                                startPoint: .leading, endPoint: .trailing
                            )
                        )
                        .frame(width: geo.size.width * CGFloat(loadFactor / 100), height: 8)
                        .animation(.easeOut(duration: 0.6), value: loadFactor)
                }
            }
            .frame(height: 8)
        }
        .padding(NaqlMetrics.spaceLG)
        .glassCard(elevated: true)
    }

    // MARK: - Control Desk Section
    private var controlDeskSection: some View {
        VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
            GlassSectionHeader(title: "System Control Desk")

            HStack(spacing: NaqlMetrics.spaceMD) {
                controlButton(
                    icon:    "exclamationmark.triangle.fill",
                    label:   "Simulate Spike",
                    accent:  Color.Naql.accentCoral
                ) {
                    withAnimation(.spring(response: 0.4)) {
                        platformStatus = "ALERT SPIKE"
                        loadFactor = 88
                        appendLog(action: "Load factor simulated alert raised.", status: .alert)
                    }
                }

                controlButton(
                    icon:    "bolt.shield.fill",
                    label:   "Optimize Node",
                    accent:  Color.Naql.accentTeal
                ) {
                    withAnimation(.spring(response: 0.4)) {
                        platformStatus = "OPERATIONAL"
                        loadFactor = 32
                        appendLog(action: "Admin optimized system load factors.", status: .success)
                    }
                }

                controlButton(
                    icon:    "arrow.counterclockwise.circle.fill",
                    label:   "Reset Metrics",
                    accent:  Color.Naql.accentBlue
                ) {
                    withAnimation(.spring(response: 0.4)) {
                        platformStatus = "OPERATIONAL"
                        loadFactor = 42
                        totalDeliveries += 1
                        appendLog(action: "Metrics reset by admin.", status: .success)
                    }
                }
            }
        }
        .padding(NaqlMetrics.spaceLG)
        .glassCard(elevated: true)
    }

    private func controlButton(icon: String, label: String, accent: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: NaqlMetrics.spaceXS) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(accent.opacity(0.18))
                        .frame(width: 48, height: 48)
                    Image(systemName: icon)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(accent)
                }
                .shadow(color: accent.opacity(0.3), radius: 8)

                Text(label)
                    .font(NaqlTypography.captionStyle())
                    .foregroundColor(Color.Naql.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, NaqlMetrics.spaceSM)
            .glassCard(cornerRadius: NaqlMetrics.controlRadius)
        }
        .buttonStyle(PlainButtonStyle())
    }

    // MARK: - Audit Log Section
    private var auditLogSection: some View {
        VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
            GlassSectionHeader(title: "Audit Ledger", count: logs.count)

            VStack(spacing: 0) {
                ForEach(logs) { log in
                    HStack(spacing: NaqlMetrics.spaceMD) {
                        // Status icon
                        ZStack {
                            Circle()
                                .fill(log.status.color.opacity(0.15))
                                .frame(width: 36, height: 36)
                            Image(systemName: log.status.icon)
                                .font(.system(size: 14))
                                .foregroundColor(log.status.color)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text(log.action)
                                .font(NaqlTypography.bodyStyle(isRegular: false))
                                .foregroundColor(Color.Naql.textPrimary)
                                .fixedSize(horizontal: false, vertical: true)
                            HStack(spacing: 6) {
                                Text(log.id)
                                    .font(NaqlTypography.captionStyle())
                                    .foregroundColor(Color.Naql.textMuted)
                                Text("·")
                                    .foregroundColor(Color.Naql.textMuted)
                                Text(log.timestamp)
                                    .font(NaqlTypography.captionStyle())
                                    .foregroundColor(Color.Naql.textMuted)
                            }
                        }

                        Spacer()
                    }
                    .padding(NaqlMetrics.spaceMD)

                    if log.id != logs.last?.id {
                        GlassDivider().padding(.horizontal, NaqlMetrics.spaceMD)
                    }
                }
            }
            .glassCard()
        }
    }

    // MARK: - Helper
    private func appendLog(action: String, status: AuditLog.AuditStatus) {
        let newLog = AuditLog(
            id:        "L-\(110 + logs.count)",
            timestamp: "Just Now",
            action:    action,
            status:    status
        )
        withAnimation { logs.insert(newLog, at: 0) }
    }
}
