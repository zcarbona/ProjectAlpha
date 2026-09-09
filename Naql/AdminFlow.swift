import SwiftUI

// MARK: - Audit Log Model
struct AuditLog: Identifiable {
    let id: String
    let timestamp: String
    let action: String
    let status: String // "SUCCESS", "WARNING", "ALERT"
}

struct AdminFlowView: View {
    @Binding var currentFlow: String
    
    @State private var platformStatus = "OPERATIONAL"
    @State private var loadFactor = 42 // percentage
    @State private var totalEarnings = 148200.00
    @State private var totalDeliveries = 1042
    
    @State private var logs = [
        AuditLog(id: "L-110", timestamp: "11:32 AM", action: "User NQL-9082 placed container dispatch.", status: "SUCCESS"),
        AuditLog(id: "L-109", timestamp: "11:20 AM", action: "Driver assigned to plate 'د ص ح ١ ٠ ٩ ٢'.", status: "SUCCESS"),
        AuditLog(id: "L-108", timestamp: "10:55 AM", action: "Platform simulated latency spike detected.", status: "WARNING"),
        AuditLog(id: "L-107", timestamp: "10:01 AM", action: "Admin cleared database query locks.", status: "SUCCESS")
    ]
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.Naql.background.edgesIgnoringSafeArea(.all)
                
                ScrollView {
                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceLG) {
                        // Header Greeting & Status Pill
                        HStack {
                            VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                                Text("Platform Overseer")
                                    .font(NaqlTypography.headingStyle(size: .medium))
                                    .foregroundColor(Color.Naql.textPrimary)
                                Text("System metrics & platform integrity.")
                                    .font(NaqlTypography.bodyStyle(isRegular: false))
                                    .foregroundColor(Color.Naql.textMuted)
                            }
                            Spacer()
                            statusPill
                        }
                        .padding(.top, NaqlMetrics.spaceMD)
                        
                        // Performance KPI Row
                        HStack(spacing: NaqlMetrics.spaceMD) {
                            kpiCard(title: "Gross Volume", value: "$\(Int(totalEarnings))", detail: "+12.4% this week")
                            kpiCard(title: "Dispatch Cycles", value: "\(totalDeliveries)", detail: "99.2% success rate")
                        }
                        
                        // System Load Gauge
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                            HStack {
                                Text("Platform Load Factor")
                                    .font(NaqlTypography.bodySemiboldStyle())
                                    .foregroundColor(Color.Naql.textPrimary)
                                Spacer()
                                Text("\(loadFactor)%")
                                    .font(NaqlTypography.bodySemiboldStyle())
                                    .foregroundColor(Color.Naql.primary)
                            }
                            
                            ProgressView(value: Double(loadFactor), total: 100)
                                .accentColor(Color.Naql.primary)
                                .scaleEffect(x: 1, y: 2, anchor: .center)
                            
                            Text("Optimal threshold is under 75% load.")
                                .font(.caption)
                                .foregroundColor(Color.Naql.textMuted)
                        }
                        .padding(NaqlMetrics.spaceLG)
                        .background(Color.Naql.surface)
                        .cornerRadius(NaqlMetrics.cardRadius)
                        .softShadow()
                        
                        // Administrative Actions Panel
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                            Text("System Control Desk")
                                .font(NaqlTypography.headingStyle(size: .small))
                                .foregroundColor(Color.Naql.textPrimary)
                            
                            HStack(spacing: NaqlMetrics.spaceMD) {
                                Button(action: {
                                    withAnimation {
                                        platformStatus = "ALERT SPIKE"
                                        loadFactor = 88
                                        logs.insert(AuditLog(id: "L-\(logs.count+110)", timestamp: "Just Now", action: "Load factor simulated alert raised.", status: "ALERT"), at: 0)
                                    }
                                }) {
                                    VStack(spacing: NaqlMetrics.spaceXS) {
                                        Image(systemName: "exclamationmark.triangle.fill")
                                            .foregroundColor(Color.Naql.error)
                                            .font(.title2)
                                        Text("Simulate Spike")
                                            .font(.caption2)
                                            .bold()
                                            .foregroundColor(Color.Naql.textPrimary)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.Naql.background)
                                    .cornerRadius(NaqlMetrics.controlRadius)
                                }
                                
                                Button(action: {
                                    withAnimation {
                                        platformStatus = "OPERATIONAL"
                                        loadFactor = 32
                                        logs.insert(AuditLog(id: "L-\(logs.count+110)", timestamp: "Just Now", action: "Admin optimized system load factors.", status: "SUCCESS"), at: 0)
                                    }
                                }) {
                                    VStack(spacing: NaqlMetrics.spaceXS) {
                                        Image(systemName: "bolt.shield.fill")
                                            .foregroundColor(Color.Naql.completed)
                                            .font(.title2)
                                        Text("Optimize Node")
                                            .font(.caption2)
                                            .bold()
                                            .foregroundColor(Color.Naql.textPrimary)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.Naql.background)
                                    .cornerRadius(NaqlMetrics.controlRadius)
                                }
                            }
                        }
                        .padding(NaqlMetrics.spaceLG)
                        .background(Color.Naql.surface)
                        .cornerRadius(NaqlMetrics.cardRadius)
                        .softShadow()
                        
                        // System Logs / Auditing
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                            Text("Audit Ledger Activity")
                                .font(NaqlTypography.headingStyle(size: .small))
                                .foregroundColor(Color.Naql.textPrimary)
                            
                            ForEach(logs) { log in
                                HStack {
                                    Circle()
                                        .fill(log.status == "SUCCESS" ? Color.Naql.completed : (log.status == "WARNING" ? Color.Naql.pending : Color.Naql.error))
                                        .frame(width: 8, height: 8)
                                    
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(log.action)
                                            .font(NaqlTypography.bodyStyle(isRegular: false))
                                            .foregroundColor(Color.Naql.textPrimary)
                                        Text(log.timestamp)
                                            .font(.caption2)
                                            .foregroundColor(Color.Naql.textMuted)
                                    }
                                    Spacer()
                                }
                                .padding()
                                .background(Color.Naql.surface)
                                .cornerRadius(NaqlMetrics.controlRadius)
                                .softShadow()
                            }
                        }
                    }
                    .padding(.horizontal, NaqlMetrics.spaceMD)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: {
                        currentFlow = "landing"
                    }) {
                        Text("Logout")
                            .font(NaqlTypography.bodyStyle(isRegular: false))
                            .foregroundColor(Color.Naql.textMuted)
                    }
                }
            }
        }
    }
    
    // MARK: - Platform Status Pill
    private var statusPill: some View {
        Text(platformStatus)
            .font(NaqlTypography.labelStyle())
            .padding(.horizontal, NaqlMetrics.spaceSM)
            .padding(.vertical, 6)
            .background(platformStatus == "OPERATIONAL" ? Color.Naql.completed.opacity(0.15) : Color.Naql.error.opacity(0.15))
            .foregroundColor(platformStatus == "OPERATIONAL" ? Color.Naql.completed : Color.Naql.error)
            .cornerRadius(12)
    }
    
    // MARK: - KPI Helper
    private func kpiCard(title: String, value: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color.Naql.textMuted)
            Text(value)
                .font(NaqlTypography.headingStyle(size: .medium))
                .foregroundColor(Color.Naql.textPrimary)
            Text(detail)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(Color.Naql.completed)
        }
        .padding(NaqlMetrics.spaceLG)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.Naql.surface)
        .cornerRadius(NaqlMetrics.cardRadius)
        .softShadow()
    }
}
