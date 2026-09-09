import SwiftUI

// MARK: - Truck Model
struct Truck: Identifiable, Hashable {
    let id: String
    let plateNumber: String
    let model: String
    let type: String
    var status: String // "Available" | "On Duty"
}

// MARK: - Provider Flow Root
struct ProviderFlowView: View {
    @Binding var currentFlow: String

    @State private var fleet = [
        Truck(id: "t1", plateNumber: "د ص ح ١٠٩٢", model: "Mercedes Actros 2024", type: "Heavy Container", status: "Available"),
        Truck(id: "t2", plateNumber: "ب ر ق ٨٨٢٢",  model: "Volvo FH16",           type: "Flatbed Truck",  status: "Available"),
        Truck(id: "t3", plateNumber: "ط ي ر ٥٥٣٣",  model: "Scania R500",          type: "Box Truck",      status: "On Duty")
    ]

    @State private var requestJobs = [
        Job(id: "NQL-5511", pickup: "King Khalid Airport Cargo",  dropoff: "Al-Olaya Central Storage",   price: 420,  status: .pending, date: "Today, 11:15 AM",   vehicleType: "Box Truck"),
        Job(id: "NQL-2234", pickup: "Dammam Port Terminals",      dropoff: "Riyadh Industrial City 2",   price: 1800, status: .pending, date: "Tomorrow, 8:00 AM", vehicleType: "Heavy Container")
    ]

    @State private var activeJobs = [
        Job(id: "NQL-1102", pickup: "Riyadh Dry Port", dropoff: "KAFD Logistics Dock", price: 390, status: .inProgress, date: "Today, 9:00 AM", vehicleType: "Heavy Container")
    ]

    @State private var selectedJobToAccept:   Job?   = nil
    @State private var selectedTruckToAssign: Truck? = nil
    @State private var isAssigningTruck = false
    @State private var activeTrackingJob: Job? = nil
    @State private var isDrawerOpen = true

    var body: some View {
        NavigationView {
            ZStack {
                NaqlGradientBackground()

                if let trackingJob = activeTrackingJob {
                    providerTrackingView(job: trackingJob)
                } else {
                    dashboardView
                }

                // Assign Truck Modal
                if isAssigningTruck, let job = selectedJobToAccept {
                    assignTruckModal(job: job)
                        .transition(.opacity.combined(with: .scale(scale: 0.96)))
                }
            }
            .navigationTitle(activeTrackingJob != nil ? "Route Coordination" : "Fleet Dashboard")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if activeTrackingJob != nil {
                        Button(action: { activeTrackingJob = nil }) {
                            HStack(spacing: 4) {
                                Image(systemName: "chevron.left").font(.system(size: 14, weight: .semibold))
                                Text("Back").font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                            }
                            .foregroundColor(Color.Naql.textSecondary)
                        }
                    } else {
                        Button(action: { currentFlow = "landing" }) {
                            HStack(spacing: 4) {
                                Image(systemName: "rectangle.portrait.and.arrow.right").font(.system(size: 13))
                                Text("Logout").font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                            }
                            .foregroundColor(Color.Naql.textMuted)
                        }
                    }
                }
            }
            .animation(.spring(response: 0.4, dampingFraction: 0.82), value: isAssigningTruck)
        }
        .navigationViewStyle(.stack)
    }

    // MARK: - Dashboard
    private var dashboardView: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: NaqlMetrics.spaceLG) {
                // Fleet stats row
                HStack(spacing: NaqlMetrics.spaceMD) {
                    GlassStatCard(
                        title: "Active Fleet",
                        value: "\(fleet.count)",
                        icon: "truck.box.fill",
                        accentColor: Color.Naql.accentBlue
                    )
                    GlassStatCard(
                        title: "Available",
                        value: "\(fleet.filter { $0.status == "Available" }.count)",
                        icon: "checkmark.shield.fill",
                        accentColor: Color.Naql.accentTeal
                    )
                    GlassStatCard(
                        title: "On Duty",
                        value: "\(fleet.filter { $0.status == "On Duty" }.count)",
                        icon: "map.fill",
                        accentColor: Color.Naql.accentGold
                    )
                }
                .padding(.top, NaqlMetrics.spaceLG)

                // Incoming Requests
                GlassSectionHeader(title: "Incoming Requests", count: requestJobs.count)

                if requestJobs.isEmpty {
                    HStack {
                        Spacer()
                        VStack(spacing: NaqlMetrics.spaceXS) {
                            Image(systemName: "tray.fill")
                                .font(.system(size: 28))
                                .foregroundColor(Color.Naql.textMuted)
                            Text("No pending requests")
                                .font(NaqlTypography.bodyStyle())
                                .foregroundColor(Color.Naql.textMuted)
                        }
                        Spacer()
                    }
                    .padding(NaqlMetrics.spaceXL)
                    .glassCard()
                } else {
                    ForEach(requestJobs) { job in
                        VStack(spacing: NaqlMetrics.spaceXS) {
                            JobCard(job: job) {}

                            HStack(spacing: NaqlMetrics.spaceMD) {
                                Button(action: { declineJob(job) }) {
                                    HStack(spacing: 6) {
                                        Image(systemName: "xmark.circle.fill")
                                            .font(.system(size: 14))
                                        Text("Decline")
                                            .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                                    }
                                    .foregroundColor(Color.Naql.accentCoral)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, NaqlMetrics.spaceXS + 2)
                                    .glassCard(cornerRadius: NaqlMetrics.controlRadius)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius, style: .continuous)
                                            .strokeBorder(Color.Naql.accentCoral.opacity(0.35), lineWidth: 1)
                                    )
                                }
                                .buttonStyle(PlainButtonStyle())

                                Button(action: { openAssignModal(for: job) }) {
                                    HStack(spacing: 6) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .font(.system(size: 14))
                                        Text("Accept")
                                            .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                                    }
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, NaqlMetrics.spaceXS + 2)
                                    .glassButton(accent: Color.Naql.accentBlue, prominent: true)
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                    }
                }

                // Active Operations
                GlassSectionHeader(title: "Active Cargo Operations", count: activeJobs.count)

                ForEach(activeJobs) { job in
                    JobCard(job: job) {
                        activeTrackingJob = job
                    }
                }

                // Fleet roster
                GlassSectionHeader(title: "Fleet Roster")

                VStack(spacing: 0) {
                    ForEach(fleet) { truck in
                        HStack(spacing: NaqlMetrics.spaceMD) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(truck.status == "Available"
                                          ? Color.Naql.accentTeal.opacity(0.15)
                                          : Color.Naql.accentGold.opacity(0.15))
                                    .frame(width: 40, height: 40)
                                Image(systemName: "truck.box.fill")
                                    .font(.system(size: 16))
                                    .foregroundColor(truck.status == "Available" ? Color.Naql.accentTeal : Color.Naql.accentGold)
                            }

                            VStack(alignment: .leading, spacing: 2) {
                                Text(truck.model)
                                    .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                                    .foregroundColor(Color.Naql.textPrimary)
                                Text(truck.plateNumber)
                                    .font(NaqlTypography.captionStyle())
                                    .foregroundColor(Color.Naql.textMuted)
                            }

                            Spacer()

                            Text(truck.status)
                                .font(NaqlTypography.labelStyle())
                                .foregroundColor(truck.status == "Available" ? Color.Naql.accentTeal : Color.Naql.accentGold)
                                .padding(.horizontal, NaqlMetrics.spaceSM)
                                .padding(.vertical, 4)
                                .background(
                                    Capsule()
                                        .fill(truck.status == "Available"
                                              ? Color.Naql.accentTeal.opacity(0.15)
                                              : Color.Naql.accentGold.opacity(0.15))
                                )
                        }
                        .padding(NaqlMetrics.spaceMD)

                        if truck.id != fleet.last?.id {
                            GlassDivider().padding(.horizontal, NaqlMetrics.spaceMD)
                        }
                    }
                }
                .glassCard()
            }
            .padding(.horizontal, NaqlMetrics.spaceMD)
            .padding(.bottom, NaqlMetrics.spaceXXL)
        }
    }

    // MARK: - Assign Truck Modal
    private func assignTruckModal(job: Job) -> some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .onTapGesture { isAssigningTruck = false }

            VStack(alignment: .leading, spacing: NaqlMetrics.spaceLG) {
                // Header
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                    Text("Assign Fleet Vehicle")
                        .font(NaqlTypography.headingStyle(size: .small))
                        .foregroundColor(Color.Naql.textPrimary)
                    Text("Match: \(job.vehicleType)")
                        .font(NaqlTypography.captionStyle())
                        .foregroundColor(Color.Naql.textMuted)
                }

                // Available trucks list
                let available = fleet.filter { $0.status == "Available" }

                if available.isEmpty {
                    Text("No available trucks at this time.")
                        .font(NaqlTypography.bodyStyle())
                        .foregroundColor(Color.Naql.textMuted)
                        .padding()
                } else {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: NaqlMetrics.spaceXS) {
                            ForEach(available) { truck in
                                let selected = selectedTruckToAssign?.id == truck.id
                                Button(action: { selectedTruckToAssign = truck }) {
                                    HStack(spacing: NaqlMetrics.spaceMD) {
                                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                                            Text(truck.model)
                                                .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                                                .foregroundColor(Color.Naql.textPrimary)
                                            Text(truck.plateNumber)
                                                .font(NaqlTypography.captionStyle())
                                                .foregroundColor(Color.Naql.textMuted)
                                        }
                                        Spacer()
                                        Text(truck.type)
                                            .font(NaqlTypography.labelStyle())
                                            .foregroundColor(Color.Naql.accentBlue)
                                            .padding(.horizontal, NaqlMetrics.spaceXS)
                                            .padding(.vertical, 4)
                                            .background(Capsule().fill(Color.Naql.accentBlue.opacity(0.15)))

                                        if selected {
                                            Image(systemName: "checkmark.circle.fill")
                                                .foregroundColor(Color.Naql.accentTeal)
                                                .font(.system(size: 18))
                                        }
                                    }
                                    .padding(NaqlMetrics.spaceMD)
                                    .glassCard(elevated: selected)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: NaqlMetrics.cardRadius, style: .continuous)
                                            .strokeBorder(selected ? Color.Naql.accentBlue.opacity(0.6) : Color.clear, lineWidth: 1.5)
                                    )
                                }
                                .buttonStyle(PlainButtonStyle())
                            }
                        }
                    }
                    .frame(maxHeight: 220)
                }

                // Actions
                HStack(spacing: NaqlMetrics.spaceMD) {
                    Button(action: { isAssigningTruck = false }) {
                        Text("Cancel")
                            .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                            .foregroundColor(Color.Naql.textMuted)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, NaqlMetrics.spaceMD)
                            .glassCard(cornerRadius: NaqlMetrics.controlRadius)
                    }
                    .buttonStyle(PlainButtonStyle())

                    Button(action: { confirmAssignment(job: job) }) {
                        Text("Assign & Confirm")
                            .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, NaqlMetrics.spaceMD)
                            .glassButton(accent: Color.Naql.accentBlue, prominent: true)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .disabled(selectedTruckToAssign == nil)
                }
            }
            .padding(NaqlMetrics.spaceLG)
            .background(
                ZStack {
                    BlurView(style: .systemUltraThinMaterialDark)
                    Color.Naql.glassElevated
                }
                .clipShape(RoundedRectangle(cornerRadius: NaqlMetrics.sheetRadius, style: .continuous))
            )
            .overlay(
                RoundedRectangle(cornerRadius: NaqlMetrics.sheetRadius, style: .continuous)
                    .strokeBorder(Color.Naql.glassBorder, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.5), radius: 40)
            .padding(.horizontal, NaqlMetrics.spaceLG)
        }
    }

    // MARK: - Provider Tracking View
    private func providerTrackingView(job: Job) -> some View {
        ZStack {
            NaqlMapView()

            SlidingBottomSheet(isOpen: $isDrawerOpen, maxHeight: 380) {
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                    HStack {
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                            Text(job.id)
                                .font(NaqlTypography.headingStyle(size: .small))
                                .foregroundColor(Color.Naql.textPrimary)
                            Text(job.vehicleType)
                                .font(NaqlTypography.captionStyle())
                                .foregroundColor(Color.Naql.textMuted)
                        }
                        Spacer()
                        StatusBadge(status: job.status)
                    }

                    GlassDivider()

                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                        Text("Active Route")
                            .font(NaqlTypography.captionStyle())
                            .foregroundColor(Color.Naql.textMuted)
                        Text("\(job.pickup) → \(job.dropoff)")
                            .font(NaqlTypography.bodySemiboldStyle())
                            .foregroundColor(Color.Naql.textPrimary)
                            .lineLimit(2)
                    }

                    GlassDivider()

                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
                        Text("Dispatch Control")
                            .font(NaqlTypography.captionStyle())
                            .foregroundColor(Color.Naql.textMuted)

                        if job.status == .inProgress {
                            NaqlButton(title: "Complete Delivery", icon: "checkmark.circle.fill", style: .action) {
                                completeDelivery(job: job)
                            }
                        } else {
                            HStack(spacing: NaqlMetrics.spaceXS) {
                                Image(systemName: "checkmark.seal.fill")
                                    .foregroundColor(Color.Naql.accentTeal)
                                    .font(.system(size: 20))
                                Text("Delivery cycle completed. Truck released.")
                                    .font(NaqlTypography.bodyStyle(isRegular: false))
                                    .foregroundColor(Color.Naql.textSecondary)
                            }
                            .padding(NaqlMetrics.spaceMD)
                            .glassCard()
                        }
                    }

                    Spacer()
                }
                .padding(NaqlMetrics.spaceLG)
            }
        }
    }

    // MARK: - Actions
    private func declineJob(_ job: Job) {
        withAnimation {
            requestJobs.removeAll { $0.id == job.id }
        }
    }

    private func openAssignModal(for job: Job) {
        selectedJobToAccept = job
        selectedTruckToAssign = fleet.first { $0.status == "Available" && $0.type == job.vehicleType }
            ?? fleet.first { $0.status == "Available" }
        withAnimation { isAssigningTruck = true }
    }

    private func confirmAssignment(job: Job) {
        guard let truck = selectedTruckToAssign else { return }
        withAnimation {
            if let idx = requestJobs.firstIndex(where: { $0.id == job.id }) {
                var accepted = requestJobs.remove(at: idx)
                accepted.status = .inProgress
                activeJobs.insert(accepted, at: 0)
            }
            if let tIdx = fleet.firstIndex(where: { $0.id == truck.id }) {
                fleet[tIdx].status = "On Duty"
            }
            isAssigningTruck = false
            selectedJobToAccept = nil
        }
    }

    private func completeDelivery(job: Job) {
        if let idx = activeJobs.firstIndex(where: { $0.id == job.id }) {
            activeJobs[idx].status = .completed
        }
        activeTrackingJob?.status = .completed
    }
}
