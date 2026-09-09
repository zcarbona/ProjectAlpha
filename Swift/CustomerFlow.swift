import SwiftUI

// MARK: - Vehicle Option Model
struct VehicleOption: Identifiable {
    let id: String
    let name: String
    let capacity: String
    let iconName: String
    let description: String
}

// MARK: - Provider Model
struct Provider: Identifiable {
    let id: String
    let name: String
    let rating: Double
    let eta: String
    let price: Double
}

// MARK: - Customer Flow Root
struct CustomerFlowView: View {
    @Binding var currentFlow: String
    @State private var bookingStep = 0
    @State private var isBooking   = false
    @State private var selectedJobForTracking: Job? = nil
    @State private var isDrawerOpen = true

    // Booking form state
    @State private var selectedVehicle:  VehicleOption? = nil
    @State private var pickupLocation:   String = ""
    @State private var dropoffLocation:  String = ""
    @State private var selectedProvider: Provider? = nil

    @State private var activeJobs: [Job] = [
        Job(id: "NQL-9082", pickup: "Riyadh Dry Port",    dropoff: "Al-Malaz Distribution Center",
            price: 340, status: .inProgress, date: "Today, 10:30 AM", vehicleType: "Heavy Container"),
        Job(id: "NQL-7711", pickup: "Jeddah Islamic Port", dropoff: "Sari Warehouse, Riyadh",
            price: 1250, status: .completed,  date: "Sep 7, 2026",    vehicleType: "Flatbed Truck")
    ]

    let vehicles = [
        VehicleOption(id: "1", name: "Heavy Container", capacity: "Up to 25 Tons",
                      iconName: "shippingbox.fill",    description: "Best for standard maritime containers."),
        VehicleOption(id: "2", name: "Flatbed Truck",   capacity: "Up to 15 Tons",
                      iconName: "square.grid.3x3.fill", description: "Ideal for heavy machinery and steel."),
        VehicleOption(id: "3", name: "Box Truck",       capacity: "Up to 5 Tons",
                      iconName: "car.fill",             description: "Perfect for corporate cargo.")
    ]

    let providers = [
        Provider(id: "p1", name: "Najdi Logistics",   rating: 4.9, eta: "25 min", price: 420),
        Provider(id: "p2", name: "Sari' Freight",      rating: 4.7, eta: "15 min", price: 480),
        Provider(id: "p3", name: "Al-Majd Transport",  rating: 4.5, eta: "40 min", price: 380)
    ]

    var body: some View {
        NavigationView {
            ZStack {
                NaqlGradientBackground()

                if isBooking {
                    bookingFlowView
                } else if let job = selectedJobForTracking {
                    trackingView(job: job)
                } else {
                    dashboardView
                }
            }
            .navigationTitle(isBooking ? "New Booking" : (selectedJobForTracking != nil ? "Live Tracking" : ""))
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if isBooking {
                        backButton {
                            if bookingStep > 0 { bookingStep -= 1 } else { isBooking = false }
                        }
                    } else if selectedJobForTracking != nil {
                        backButton { selectedJobForTracking = nil }
                    } else {
                        logoutButton
                    }
                }
            }
        }
        .navigationViewStyle(.stack)
    }

    private func backButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 14, weight: .semibold))
                Text("Back")
                    .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
            }
            .foregroundColor(Color.Naql.textSecondary)
        }
    }

    private var logoutButton: some View {
        Button(action: { currentFlow = "landing" }) {
            HStack(spacing: 4) {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                    .font(.system(size: 13))
                Text("Logout")
                    .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
            }
            .foregroundColor(Color.Naql.textMuted)
        }
    }

    // MARK: - Dashboard
    private var dashboardView: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: NaqlMetrics.spaceLG) {
                // Greeting header
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                    Text("Your fleet is ready.")
                        .font(NaqlTypography.headingStyle(size: .medium))
                        .foregroundColor(Color.Naql.textPrimary)
                    Text("Where should we dispatch today?")
                        .font(NaqlTypography.bodyStyle())
                        .foregroundColor(Color.Naql.textMuted)
                }
                .padding(.top, NaqlMetrics.spaceLG)

                // CTA Hero Card
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
                            Text("Arrange Cargo Dispatch")
                                .font(NaqlTypography.headingStyle(size: .small))
                                .foregroundColor(Color.Naql.textPrimary)
                            Text("Corporate pricing · Verified drivers.")
                                .font(NaqlTypography.bodyStyle(isRegular: false))
                                .foregroundColor(Color.Naql.textSecondary)
                        }
                        Spacer()
                        Image(systemName: "truck.box.fill")
                            .font(.system(size: 36))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [Color.Naql.accentBlue, Color.Naql.accentTeal],
                                    startPoint: .topLeading, endPoint: .bottomTrailing))
                            .shadow(color: Color.Naql.accentBlue.opacity(0.5), radius: 12)
                    }

                    NaqlButton(title: "Initiate Dispatch Booking", icon: "plus.circle.fill", style: .primary) {
                        isBooking = true
                        bookingStep = 0
                    }
                }
                .padding(NaqlMetrics.spaceLG)
                .glassCard(elevated: true)

                // Quick stats
                HStack(spacing: NaqlMetrics.spaceMD) {
                    GlassStatCard(title: "Active",    value: "\(activeJobs.filter { $0.status == .inProgress }.count)", icon: "arrow.triangle.2.circlepath", accentColor: Color.Naql.accentBlue)
                    GlassStatCard(title: "Completed", value: "\(activeJobs.filter { $0.status == .completed }.count)",  icon: "checkmark.seal.fill",          accentColor: Color.Naql.accentTeal)
                    GlassStatCard(title: "Total",     value: "\(activeJobs.count)",                                      icon: "list.bullet.rectangle.fill",   accentColor: Color.Naql.accentGold)
                }

                // Jobs list
                GlassSectionHeader(title: "Dispatches & Recent Trips", count: activeJobs.count)

                ForEach(activeJobs) { job in
                    JobCard(job: job) {
                        selectedJobForTracking = job
                    }
                }
            }
            .padding(.horizontal, NaqlMetrics.spaceMD)
            .padding(.bottom, NaqlMetrics.spaceXXL)
        }
    }

    // MARK: - Booking Flow
    private var bookingFlowView: some View {
        VStack(spacing: 0) {
            BookingProgressTracker(currentStep: bookingStep)
                .padding(.vertical, NaqlMetrics.spaceLG)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceLG) {
                    switch bookingStep {
                    case 0: vehicleSelectionStep
                    case 1: routeInputStep
                    case 2: providerSelectionStep
                    case 3: confirmationStep
                    default: EmptyView()
                    }
                }
                .padding(.horizontal, NaqlMetrics.spaceMD)
                .padding(.bottom, 120)
            }

            // Sticky CTA
            VStack {
                NaqlButton(
                    title: bookingStep == 3 ? "Confirm & Secure Truck" : "Continue",
                    icon:  bookingStep == 3 ? "checkmark.circle.fill" : "arrow.right.circle.fill",
                    style: .primary
                ) {
                    handleBookingNext()
                }
                .padding(.horizontal, NaqlMetrics.spaceMD)
                .padding(.vertical, NaqlMetrics.spaceMD)
            }
            .background(
                ZStack {
                    BlurView(style: .systemUltraThinMaterialDark)
                    Color.Naql.glassDark
                }
                .ignoresSafeArea()
            )
        }
    }

    private var vehicleSelectionStep: some View {
        VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
            GlassSectionHeader(title: "Select Vehicle Class")

            ForEach(vehicles) { vehicle in
                let selected = selectedVehicle?.id == vehicle.id
                Button(action: { selectedVehicle = vehicle }) {
                    HStack(spacing: NaqlMetrics.spaceMD) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(selected ? Color.Naql.accentBlue : Color.white.opacity(0.10))
                                .frame(width: 52, height: 52)
                            Image(systemName: vehicle.iconName)
                                .font(.system(size: 22, weight: .medium))
                                .foregroundColor(selected ? .white : Color.Naql.accentBlue)
                        }
                        .shadow(color: selected ? Color.Naql.accentBlue.opacity(0.5) : .clear, radius: 8)

                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                            Text(vehicle.name)
                                .font(NaqlTypography.bodySemiboldStyle())
                                .foregroundColor(Color.Naql.textPrimary)
                            Text(vehicle.capacity)
                                .font(NaqlTypography.captionStyle())
                                .foregroundColor(Color.Naql.textMuted)
                            Text(vehicle.description)
                                .font(NaqlTypography.captionStyle())
                                .foregroundColor(Color.Naql.textMuted)
                                .lineLimit(1)
                        }
                        Spacer()
                        if selected {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(Color.Naql.accentTeal)
                                .font(.system(size: 20))
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

    private var routeInputStep: some View {
        VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
            GlassSectionHeader(title: "Route Details")

            VStack(spacing: NaqlMetrics.spaceMD) {
                GlassTextField(
                    label: "Pickup Location",
                    placeholder: "e.g. Riyadh Dry Port",
                    text: $pickupLocation,
                    icon: "circle.fill"
                )
                GlassDivider()
                GlassTextField(
                    label: "Dropoff Location",
                    placeholder: "e.g. Al-Malaz Distribution Center",
                    text: $dropoffLocation,
                    icon: "mappin.circle.fill"
                )
            }
            .padding(NaqlMetrics.spaceLG)
            .glassCard(elevated: true)
        }
    }

    private var providerSelectionStep: some View {
        VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
            GlassSectionHeader(title: "Choose Provider")

            ForEach(providers) { provider in
                let selected = selectedProvider?.id == provider.id
                Button(action: { selectedProvider = provider }) {
                    HStack(spacing: NaqlMetrics.spaceMD) {
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
                            Text(provider.name)
                                .font(NaqlTypography.bodySemiboldStyle())
                                .foregroundColor(Color.Naql.textPrimary)
                            HStack(spacing: NaqlMetrics.spaceXS) {
                                Image(systemName: "star.fill")
                                    .foregroundColor(Color.Naql.accentGold)
                                    .font(.system(size: 11))
                                Text(String(format: "%.1f", provider.rating))
                                    .font(NaqlTypography.captionStyle())
                                    .foregroundColor(Color.Naql.textSecondary)
                                Text("·")
                                    .foregroundColor(Color.Naql.textMuted)
                                Image(systemName: "clock.fill")
                                    .font(.system(size: 10))
                                    .foregroundColor(Color.Naql.textMuted)
                                Text("ETA \(provider.eta)")
                                    .font(NaqlTypography.captionStyle())
                                    .foregroundColor(Color.Naql.textMuted)
                            }
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text("SAR \(String(format: "%.0f", provider.price))")
                                .font(NaqlTypography.bodySemiboldStyle())
                                .foregroundColor(Color.Naql.accentBlue)
                            if selected {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(Color.Naql.accentTeal)
                                    .font(.system(size: 18))
                            }
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

    private var confirmationStep: some View {
        VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
            GlassSectionHeader(title: "Confirm Dispatch")

            VStack(spacing: 0) {
                confirmRow(label: "Vehicle Class",    value: selectedVehicle?.name  ?? "—")
                GlassDivider().padding(.horizontal, NaqlMetrics.spaceMD)
                confirmRow(label: "Pickup",           value: pickupLocation.isEmpty  ? "—" : pickupLocation)
                GlassDivider().padding(.horizontal, NaqlMetrics.spaceMD)
                confirmRow(label: "Dropoff",          value: dropoffLocation.isEmpty ? "—" : dropoffLocation)
                GlassDivider().padding(.horizontal, NaqlMetrics.spaceMD)
                confirmRow(label: "Provider",         value: selectedProvider?.name ?? "—")
                GlassDivider().padding(.horizontal, NaqlMetrics.spaceMD)

                HStack {
                    Text("Guaranteed Quote")
                        .font(NaqlTypography.bodyStyle(isRegular: false))
                        .foregroundColor(Color.Naql.textMuted)
                    Spacer()
                    Text("SAR \(String(format: "%.0f", selectedProvider?.price ?? 0))")
                        .font(NaqlTypography.headingStyle(size: .small))
                        .foregroundStyle(LinearGradient(
                            colors: [Color.Naql.accentBlue, Color.Naql.accentTeal],
                            startPoint: .leading, endPoint: .trailing))
                }
                .padding(NaqlMetrics.spaceMD)
            }
            .glassCard(elevated: true)
        }
    }

    private func confirmRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(NaqlTypography.bodyStyle(isRegular: false))
                .foregroundColor(Color.Naql.textMuted)
            Spacer()
            Text(value)
                .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                .foregroundColor(Color.Naql.textPrimary)
                .lineLimit(1)
        }
        .padding(NaqlMetrics.spaceMD)
    }

    private func handleBookingNext() {
        if bookingStep == 0 && selectedVehicle  == nil { return }
        if bookingStep == 1 && (pickupLocation.isEmpty || dropoffLocation.isEmpty) { return }
        if bookingStep == 2 && selectedProvider == nil { return }

        if bookingStep < 3 {
            withAnimation { bookingStep += 1 }
        } else {
            let newJob = Job(
                id: "NQL-\(Int.random(in: 1000...9999))",
                pickup: pickupLocation,
                dropoff: dropoffLocation,
                price: selectedProvider?.price ?? 340,
                status: .pending,
                date: "Just Now",
                vehicleType: selectedVehicle?.name ?? "Heavy Container"
            )
            activeJobs.insert(newJob, at: 0)
            selectedVehicle  = nil
            pickupLocation   = ""
            dropoffLocation  = ""
            selectedProvider = nil
            bookingStep = 0
            withAnimation { isBooking = false }
        }
    }

    // MARK: - Live Tracking View
    private func trackingView(job: Job) -> some View {
        ZStack {
            NaqlMapView()

            SlidingBottomSheet(isOpen: $isDrawerOpen, maxHeight: 340) {
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

                    // Driver row
                    HStack(spacing: NaqlMetrics.spaceMD) {
                        ZStack {
                            Circle()
                                .fill(Color.Naql.accentBlue.opacity(0.2))
                                .frame(width: 48, height: 48)
                            Image(systemName: "person.fill")
                                .font(.system(size: 22))
                                .foregroundColor(Color.Naql.accentBlue)
                        }
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                            Text("Ahmed Al-Hassan")
                                .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                                .foregroundColor(Color.Naql.textPrimary)
                            HStack(spacing: 3) {
                                Image(systemName: "star.fill")
                                    .foregroundColor(Color.Naql.accentGold)
                                    .font(.system(size: 10))
                                Text("4.9 · Verified Driver")
                                    .font(NaqlTypography.captionStyle())
                                    .foregroundColor(Color.Naql.textMuted)
                            }
                        }
                        Spacer()
                        Button(action: {}) {
                            ZStack {
                                Circle()
                                    .fill(Color.Naql.accentBlue.opacity(0.2))
                                    .frame(width: 40, height: 40)
                                Image(systemName: "phone.fill")
                                    .font(.system(size: 16))
                                    .foregroundColor(Color.Naql.accentBlue)
                            }
                        }
                    }

                    GlassDivider()

                    // Status detail
                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                        Text("Status Update")
                            .font(NaqlTypography.captionStyle())
                            .foregroundColor(Color.Naql.textMuted)
                        Text(job.status == .inProgress
                             ? "Your cargo is securely in transit on Highway 40."
                             : "Delivery fully completed and confirmed.")
                            .font(NaqlTypography.bodyStyle())
                            .foregroundColor(Color.Naql.textPrimary)
                    }

                    Spacer()
                }
                .padding(NaqlMetrics.spaceLG)
            }
        }
    }
}
