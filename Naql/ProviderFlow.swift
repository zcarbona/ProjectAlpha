import SwiftUI

// MARK: - Truck Model
struct Truck: Identifiable, Hashable {
    let id: String
    let plateNumber: String
    let model: String
    let type: String
    var status: String // "Available", "On Duty"
}

struct ProviderFlowView: View {
    @Binding var currentFlow: String
    
    // Fleet simulation
    @State private var fleet = [
        Truck(id: "t1", plateNumber: "د ص ح ١ ٠ ٩ ٢", model: "Mercedes Actros 2024", type: "Heavy Container", status: "Available"),
        Truck(id: "t2", plateNumber: "ب ر ق ٨ ٨ ٢ ٢", model: "Volvo FH16", type: "Flatbed Truck", status: "Available"),
        Truck(id: "t3", plateNumber: "ط ي ر ٥ ٥ ٣ ٣", model: "Scania R500", type: "Box Truck", status: "On Duty")
    ]
    
    // Requested jobs simulation
    @State private var requestJobs = [
        Job(id: "NQL-5511", pickup: "King Khalid Airport Cargo Terminal", dropoff: "Al-Olaya Central Storage", price: 420.00, status: .pending, date: "Today, 11:15 AM", vehicleType: "Box Truck"),
        Job(id: "NQL-2234", pickup: "Dammam Port Terminals", dropoff: "Riyadh Industrial City 2", price: 1800.00, status: .pending, date: "Tomorrow, 8:00 AM", vehicleType: "Heavy Container")
    ]
    
    @State private var activeJobs = [
        Job(id: "NQL-1102", pickup: "Riyadh Dry Port", dropoff: "KAFD Logistics Dock", price: 390.00, status: .inProgress, date: "Today, 9:00 AM", vehicleType: "Heavy Container")
    ]
    
    // Navigation / Overlay State
    @State private var selectedJobToAccept: Job? = nil
    @State private var selectedTruckToAssign: Truck? = nil
    @State private var isAssigningTruck = false
    @State private var activeTrackingJob: Job? = nil
    @State private var isDrawerOpen = true
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.Naql.background.edgesIgnoringSafeArea(.all)
                
                if let trackingJob = activeTrackingJob {
                    providerTrackingView(job: trackingJob)
                } else {
                    dashboardView
                }
                
                // Assign Truck Modal Overlay
                if isAssigningTruck, let job = selectedJobToAccept {
                    assignTruckModalView(job: job)
                }
            }
            .navigationTitle(activeTrackingJob != nil ? "Route Coordination" : "Fleet Dashboard")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if activeTrackingJob != nil {
                        Button(action: {
                            activeTrackingJob = nil
                        }) {
                            Image(systemName: "chevron.left")
                                .foregroundColor(Color.Naql.primary)
                        }
                    } else {
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
    }
    
    // MARK: - Dashboard View
    private var dashboardView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NaqlMetrics.spaceLG) {
                // Fleet overview stats row
                HStack(spacing: NaqlMetrics.spaceMD) {
                    statCard(title: "Active Fleet", value: "\(fleet.count)", icon: "truck.box", color: Color.Naql.primary)
                    statCard(title: "Available", value: "\(fleet.filter { $0.status == "Available" }.count)", icon: "checkmark.shield", color: Color.Naql.completed)
                    statCard(title: "On Duty", value: "\(fleet.filter { $0.status == "On Duty" }.count)", icon: "map", color: Color.Naql.inProgress)
                }
                .padding(.top, NaqlMetrics.spaceMD)
                
                // Section: Incoming Job Requests
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                    Text("Incoming Dispatch Requests (\(requestJobs.count))")
                        .font(NaqlTypography.headingStyle(size: .small))
                        .foregroundColor(Color.Naql.textPrimary)
                    
                    if requestJobs.isEmpty {
                        Text("No pending dispatch requests.")
                            .font(NaqlTypography.bodyStyle())
                            .foregroundColor(Color.Naql.textMuted)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .center)
                            .background(Color.Naql.surface)
                            .cornerRadius(NaqlMetrics.cardRadius)
                    } else {
                        ForEach(requestJobs) { job in
                            VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                                JobCard(job: job) {}
                                
                                HStack(spacing: NaqlMetrics.spaceMD) {
                                    Button(action: {
                                        if let index = requestJobs.firstIndex(where: { $0.id == job.id }) {
                                            requestJobs.remove(at: index)
                                        }
                                    }) {
                                        Text("Decline")
                                            .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                                            .foregroundColor(Color.Naql.error)
                                            .padding(.vertical, 10)
                                            .frame(maxWidth: .infinity)
                                            .background(Color.Naql.error.opacity(0.1))
                                            .cornerRadius(NaqlMetrics.controlRadius)
                                    }
                                    
                                    Button(action: {
                                        selectedJobToAccept = job
                                        selectedTruckToAssign = fleet.first(where: { $0.status == "Available" && $0.type == job.vehicleType }) ?? fleet.first(where: { $0.status == "Available" })
                                        isAssigningTruck = true
                                    }) {
                                        Text("Accept Request")
                                            .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                                            .foregroundColor(.white)
                                            .padding(.vertical, 10)
                                            .frame(maxWidth: .infinity)
                                            .background(Color.Naql.primary)
                                            .cornerRadius(NaqlMetrics.controlRadius)
                                    }
                                }
                            }
                            .padding(.bottom, NaqlMetrics.spaceXS)
                        }
                    }
                }
                
                // Section: Active Fleet Trips
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                    Text("Active Cargo Operations")
                        .font(NaqlTypography.headingStyle(size: .small))
                        .foregroundColor(Color.Naql.textPrimary)
                    
                    ForEach(activeJobs) { job in
                        JobCard(job: job) {
                            activeTrackingJob = job
                        }
                    }
                }
            }
            .padding(.horizontal, NaqlMetrics.spaceMD)
        }
    }
    
    // MARK: - Assign Truck Modal View (overlay)
    private func assignTruckModalView(job: Job) -> some View {
        ZStack {
            Color.black.opacity(0.4)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture {
                    isAssigningTruck = false
                }
            
            VStack(alignment: .leading, spacing: NaqlMetrics.spaceLG) {
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                    Text("Coordinate Fleet Vehicle")
                        .font(NaqlTypography.headingStyle(size: .small))
                        .foregroundColor(Color.Naql.textPrimary)
                    Text("Select a truck matching: \(job.vehicleType)")
                        .font(NaqlTypography.bodyStyle(isRegular: false))
                        .foregroundColor(Color.Naql.textMuted)
                }
                
                ScrollView {
                    VStack(spacing: NaqlMetrics.spaceMD) {
                        ForEach(fleet.filter { $0.status == "Available" }) { truck in
                            Button(action: {
                                selectedTruckToAssign = truck
                            }) {
                                HStack {
                                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                                        Text(truck.model)
                                            .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                                            .foregroundColor(Color.Naql.textPrimary)
                                        Text(truck.plateNumber)
                                            .font(NaqlTypography.bodyStyle(isRegular: false))
                                            .foregroundColor(Color.Naql.textMuted)
                                    }
                                    Spacer()
                                    Text(truck.type)
                                        .font(NaqlTypography.labelStyle())
                                        .padding(.horizontal, NaqlMetrics.spaceSM)
                                        .padding(.vertical, 4)
                                        .background(Color.Naql.primary.opacity(0.1))
                                        .foregroundColor(Color.Naql.primary)
                                        .cornerRadius(4)
                                }
                                .padding()
                                .background(Color.Naql.background)
                                .overlay(
                                    RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius)
                                        .stroke(Color.Naql.primary, lineWidth: selectedTruckToAssign?.id == truck.id ? 2 : 0)
                                )
                                .cornerRadius(NaqlMetrics.controlRadius)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                }
                
                HStack(spacing: NaqlMetrics.spaceMD) {
                    Button("Cancel") {
                        isAssigningTruck = false
                    }
                    .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                    .foregroundColor(Color.Naql.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .overlay(
                        RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius)
                            .stroke(Color.Naql.textMuted.opacity(0.3), lineWidth: 1)
                    )
                    
                    Button("Assign & Confirm") {
                        guard let truck = selectedTruckToAssign else { return }
                        
                        // Move job from requestJobs to activeJobs, changing status to IN_PROGRESS
                        if let index = requestJobs.firstIndex(where: { $0.id == job.id }) {
                            var acceptedJob = requestJobs.remove(at: index)
                            acceptedJob.status = .inProgress
                            activeJobs.insert(acceptedJob, at: 0)
                        }
                        
                        // Set truck status to On Duty
                        if let tIndex = fleet.firstIndex(where: { $0.id == truck.id }) {
                            fleet[tIndex].status = "On Duty"
                        }
                        
                        isAssigningTruck = false
                        selectedJobToAccept = nil
                    }
                    .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.Naql.primary)
                    .cornerRadius(NaqlMetrics.controlRadius)
                }
            }
            .padding(NaqlMetrics.spaceLG)
            .background(Color.Naql.surface)
            .cornerRadius(NaqlMetrics.cardRadius)
            .padding(.horizontal, NaqlMetrics.spaceLG)
            .softShadow()
        }
    }
    
    // MARK: - Provider Route Tracking & Simulation View
    private func providerTrackingView(job: Job) -> some View {
        ZStack {
            NaqlMapView()
            
            SlidingBottomSheet(isOpen: $isDrawerOpen, maxHeight: 350) {
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                    HStack {
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                            Text(job.id)
                                .font(NaqlTypography.headingStyle(size: .small))
                                .foregroundColor(Color.Naql.textPrimary)
                            Text(job.vehicleType)
                                .font(NaqlTypography.bodyStyle(isRegular: false))
                                .foregroundColor(Color.Naql.textMuted)
                        }
                        Spacer()
                        StatusBadge(status: job.status)
                    }
                    
                    Divider()
                    
                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                        Text("Active Route")
                            .font(NaqlTypography.bodyStyle(isRegular: false))
                            .foregroundColor(Color.Naql.textMuted)
                        Text("\(job.pickup) → \(job.dropoff)")
                            .font(NaqlTypography.bodySemiboldStyle())
                            .foregroundColor(Color.Naql.textPrimary)
                            .lineLimit(1)
                    }
                    
                    Divider()
                    
                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
                        Text("Dispatch Simulation Control")
                            .font(NaqlTypography.bodyStyle(isRegular: false))
                            .foregroundColor(Color.Naql.textMuted)
                        
                        if job.status == .inProgress {
                            NaqlButton(title: "Complete Trip Delivery", style: .action) {
                                // Simulate completion
                                if let index = activeJobs.firstIndex(where: { $0.id == job.id }) {
                                    activeJobs[index].status = .completed
                                }
                                activeTrackingJob?.status = .completed
                            }
                        } else {
                            HStack {
                                Image(systemName: "checkmark.seal.fill")
                                    .foregroundColor(Color.Naql.completed)
                                    .font(.title)
                                Text("Delivery cycle completed. Fleet truck released.")
                                    .font(NaqlTypography.bodyStyle())
                                    .foregroundColor(Color.Naql.textPrimary)
                            }
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.Naql.completed.opacity(0.1))
                            .cornerRadius(NaqlMetrics.controlRadius)
                        }
                    }
                    
                    Spacer()
                }
                .padding(NaqlMetrics.spaceLG)
            }
        }
    }
    
    // MARK: - Mini Stat Helper
    private func statCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.subheadline)
                Spacer()
            }
            Text(value)
                .font(NaqlTypography.headingStyle(size: .small))
                .foregroundColor(Color.Naql.textPrimary)
            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(Color.Naql.textMuted)
        }
        .padding(NaqlMetrics.spaceMD)
        .frame(maxWidth: .infinity)
        .background(Color.Naql.surface)
        .cornerRadius(NaqlMetrics.cardRadius)
        .softShadow()
    }
}
