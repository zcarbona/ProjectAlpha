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

struct CustomerFlowView: View {
    @Binding var currentFlow: String // Main navigation control
    @State private var bookingStep = 0
    @State private var isBooking = false
    
    // Booking Form State
    @State private var selectedVehicle: VehicleOption? = nil
    @State private var pickupLocation: String = ""
    @State private var dropoffLocation: String = ""
    @State private var selectedProvider: Provider? = nil
    
    // Active jobs simulation
    @State private var activeJobs: [Job] = [
        Job(id: "NQL-9082", pickup: "Riyadh Dry Port", dropoff: "Al-Malaz Distribution Center", price: 340.00, status: .inProgress, date: "Today, 10:30 AM", vehicleType: "Heavy Container"),
        Job(id: "NQL-7711", pickup: "Jeddah Islamic Port", dropoff: "Sari Warehouse, Riyadh", price: 1250.00, status: .completed, date: "Sep 7, 2026", vehicleType: "Flatbed Truck")
    ]
    @State private var selectedJobForTracking: Job? = nil
    @State private var isDrawerOpen = true
    
    // Predefined Options
    let vehicles = [
        VehicleOption(id: "1", name: "Heavy Container", capacity: "Up to 25 Tons", iconName: "shippingbox.fill", description: "Best for standard maritime shipping containers."),
        VehicleOption(id: "2", name: "Flatbed Truck", capacity: "Up to 15 Tons", iconName: "square.grid.3x3.fill", description: "Ideal for construction materials and heavy machinery."),
        VehicleOption(id: "3", name: "Box Truck", capacity: "Up to 5 Tons", iconName: "car.fill", description: "Perfect for corporate furniture and regional cargo.")
    ]
    
    let providers = [
        Provider(id: "p1", name: "Najdi Logistics", rating: 4.9, eta: "25 min", price: 420.00),
        Provider(id: "p2", name: "Sari' Freight", rating: 4.7, eta: "15 min", price: 480.00),
        Provider(id: "p3", name: "Al-Majd Transport", rating: 4.5, eta: "40 min", price: 380.00)
    ]
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.Naql.background.edgesIgnoringSafeArea(.all)
                
                if isBooking {
                    bookingFlowView
                } else if let job = selectedJobForTracking {
                    trackingView(job: job)
                } else {
                    dashboardView
                }
            }
            .navigationTitle(isBooking ? "Secure Your Transport" : (selectedJobForTracking != nil ? "Live Tracking" : "Naql Logistics"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if isBooking {
                        Button(action: {
                            if bookingStep > 0 {
                                bookingStep -= 1
                            } else {
                                isBooking = false
                            }
                        }) {
                            Image(systemName: "chevron.left")
                                .foregroundColor(Color.Naql.primary)
                        }
                    } else if selectedJobForTracking != nil {
                        Button(action: {
                            selectedJobForTracking = nil
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
                // Friendly Greeting
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                    Text("Your fleet is ready.")
                        .font(NaqlTypography.headingStyle(size: .medium))
                        .foregroundColor(Color.Naql.textPrimary)
                    Text("Where should we dispatch today?")
                        .font(NaqlTypography.bodyStyle(isRegular: true))
                        .foregroundColor(Color.Naql.textMuted)
                }
                .padding(.top, NaqlMetrics.spaceMD)
                
                // Giant Calm CTA Card
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                    HStack {
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
                            Text("Arrange Cargo Dispatch")
                                .font(NaqlTypography.headingStyle(size: .small))
                                .foregroundColor(Color.white)
                            Text("Standardized corporate pricing & verified drivers.")
                                .font(NaqlTypography.bodyStyle(isRegular: false))
                                .foregroundColor(Color.white.opacity(0.8))
                        }
                        Spacer()
                        Image(systemName: "truck.box.fill")
                            .font(.system(size: 40))
                            .foregroundColor(Color.Naql.secondary)
                    }
                    
                    Button(action: {
                        isBooking = true
                        bookingStep = 0
                    }) {
                        Text("Initiate Dispatch Booking")
                            .font(NaqlTypography.bodySemiboldStyle())
                            .foregroundColor(Color.Naql.primary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, NaqlMetrics.spaceMD)
                            .background(Color.white)
                            .cornerRadius(NaqlMetrics.controlRadius)
                    }
                }
                .padding(NaqlMetrics.spaceLG)
                .background(Color.Naql.primary)
                .cornerRadius(NaqlMetrics.cardRadius)
                .softShadow()
                
                // Section Title: Active Trips
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceMD) {
                    Text("Dispatched & Recent Trips")
                        .font(NaqlTypography.headingStyle(size: .small))
                        .foregroundColor(Color.Naql.textPrimary)
                    
                    ForEach(activeJobs) { job in
                        JobCard(job: job) {
                            selectedJobForTracking = job
                        }
                    }
                }
            }
            .padding(.horizontal, NaqlMetrics.spaceMD)
        }
    }
    
    // MARK: - Multi-step Booking Flow View
    private var bookingFlowView: some View {
        VStack {
            // Step tracker indicator
            BookingProgressTracker(currentStep: bookingStep)
                .padding(.top, NaqlMetrics.spaceMD)
                .padding(.bottom, NaqlMetrics.spaceLG)
            
            ScrollView {
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceLG) {
                    switch bookingStep {
                    case 0: // Select Vehicle
                        Text("Select dispatch vehicle")
                            .font(NaqlTypography.headingStyle(size: .small))
                            .foregroundColor(Color.Naql.textPrimary)
                            .padding(.horizontal, NaqlMetrics.spaceMD)
                        
                        ForEach(vehicles) { vehicle in
                            Button(action: {
                                selectedVehicle = vehicle
                            }) {
                                HStack(spacing: NaqlMetrics.spaceMD) {
                                    Image(systemName: vehicle.iconName)
                                        .font(.system(size: 24))
                                        .foregroundColor(selectedVehicle?.id == vehicle.id ? Color.white : Color.Naql.primary)
                                        .frame(width: 48, height: 48)
                                        .background(selectedVehicle?.id == vehicle.id ? Color.Naql.primary : Color.Naql.primary.opacity(0.1))
                                        .cornerRadius(NaqlMetrics.controlRadius)
                                    
                                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                                        Text(vehicle.name)
                                            .font(NaqlTypography.bodySemiboldStyle())
                                            .foregroundColor(selectedVehicle?.id == vehicle.id ? Color.white : Color.Naql.textPrimary)
                                        Text(vehicle.capacity)
                                            .font(NaqlTypography.bodyStyle(isRegular: false))
                                            .foregroundColor(selectedVehicle?.id == vehicle.id ? Color.white.opacity(0.8) : Color.Naql.textMuted)
                                    }
                                    Spacer()
                                    if selectedVehicle?.id == vehicle.id {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundColor(Color.white)
                                    }
                                }
                                .padding(NaqlMetrics.spaceMD)
                                .background(selectedVehicle?.id == vehicle.id ? Color.Naql.primary : Color.Naql.surface)
                                .cornerRadius(NaqlMetrics.cardRadius)
                                .softShadow()
                            }
                            .buttonStyle(PlainButtonStyle())
                            .padding(.horizontal, NaqlMetrics.spaceMD)
                        }
                        
                    case 1: // Locations Input
                        Text("Route Details")
                            .font(NaqlTypography.headingStyle(size: .small))
                            .foregroundColor(Color.Naql.textPrimary)
                            .padding(.horizontal, NaqlMetrics.spaceMD)
                        
                        VStack(spacing: NaqlMetrics.spaceMD) {
                            VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                                Text("Pickup Location")
                                    .font(NaqlTypography.bodyStyle(isRegular: false))
                                    .foregroundColor(Color.Naql.textMuted)
                                TextField("e.g. Riyadh Dry Port", text: $pickupLocation)
                                    .padding()
                                    .background(Color.Naql.background)
                                    .cornerRadius(NaqlMetrics.controlRadius)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius)
                                            .stroke(Color.Naql.textMuted.opacity(0.2), lineWidth: 1)
                                    )
                            }
                            
                            VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                                Text("Dropoff Location")
                                    .font(NaqlTypography.bodyStyle(isRegular: false))
                                    .foregroundColor(Color.Naql.textMuted)
                                TextField("e.g. Al-Malaz Distribution Center", text: $dropoffLocation)
                                    .padding()
                                    .background(Color.Naql.background)
                                    .cornerRadius(NaqlMetrics.controlRadius)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius)
                                            .stroke(Color.Naql.textMuted.opacity(0.2), lineWidth: 1)
                                    )
                            }
                        }
                        .padding(NaqlMetrics.spaceLG)
                        .background(Color.Naql.surface)
                        .cornerRadius(NaqlMetrics.cardRadius)
                        .padding(.horizontal, NaqlMetrics.spaceMD)
                        .softShadow()
                        
                    case 2: // Provider Selection
                        Text("Choose transport provider")
                            .font(NaqlTypography.headingStyle(size: .small))
                            .foregroundColor(Color.Naql.textPrimary)
                            .padding(.horizontal, NaqlMetrics.spaceMD)
                        
                        ForEach(providers) { provider in
                            Button(action: {
                                selectedProvider = provider
                            }) {
                                HStack(spacing: NaqlMetrics.spaceMD) {
                                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                                        Text(provider.name)
                                            .font(NaqlTypography.bodySemiboldStyle())
                                            .foregroundColor(Color.Naql.textPrimary)
                                        HStack(spacing: NaqlMetrics.spaceXS) {
                                            HStack(spacing: 2) {
                                                Image(systemName: "star.fill")
                                                    .foregroundColor(.yellow)
                                                    .font(.caption)
                                                Text(String(format: "%.1f", provider.rating))
                                                    .font(NaqlTypography.bodyStyle(isRegular: false))
                                                    .foregroundColor(Color.Naql.textPrimary)
                                            }
                                            Text("•")
                                                .foregroundColor(Color.Naql.textMuted)
                                            Text("ETA: \(provider.eta)")
                                                .font(NaqlTypography.bodyStyle(isRegular: false))
                                                .foregroundColor(Color.Naql.textMuted)
                                        }
                                    }
                                    Spacer()
                                    VStack(alignment: .trailing, spacing: NaqlMetrics.spaceXXS) {
                                        Text("$\(String(format: "%.2f", provider.price))")
                                            .font(NaqlTypography.bodySemiboldStyle())
                                            .foregroundColor(Color.Naql.primary)
                                    }
                                }
                                .padding(NaqlMetrics.spaceMD)
                                .background(Color.Naql.surface)
                                .overlay(
                                    RoundedRectangle(cornerRadius: NaqlMetrics.cardRadius)
                                        .stroke(Color.Naql.primary, lineWidth: selectedProvider?.id == provider.id ? 2 : 0)
                                )
                                .cornerRadius(NaqlMetrics.cardRadius)
                                .softShadow()
                            }
                            .buttonStyle(PlainButtonStyle())
                            .padding(.horizontal, NaqlMetrics.spaceMD)
                        }
                        
                    case 3: // Confirmation Summary
                        Text("Confirm Cargo Dispatch")
                            .font(NaqlTypography.headingStyle(size: .small))
                            .foregroundColor(Color.Naql.textPrimary)
                            .padding(.horizontal, NaqlMetrics.spaceMD)
                        
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceLG) {
                            HStack {
                                Text("Vehicle Class")
                                    .font(NaqlTypography.bodyStyle(isRegular: false))
                                    .foregroundColor(Color.Naql.textMuted)
                                Spacer()
                                Text(selectedVehicle?.name ?? "-")
                                    .font(NaqlTypography.bodySemiboldStyle())
                                    .foregroundColor(Color.Naql.textPrimary)
                            }
                            
                            Divider()
                            
                            VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
                                Text("Route Details")
                                    .font(NaqlTypography.bodyStyle(isRegular: false))
                                    .foregroundColor(Color.Naql.textMuted)
                                Text("Pickup: \(pickupLocation)")
                                    .font(NaqlTypography.bodyStyle(isRegular: false))
                                    .foregroundColor(Color.Naql.textPrimary)
                                Text("Dropoff: \(dropoffLocation)")
                                    .font(NaqlTypography.bodyStyle(isRegular: false))
                                    .foregroundColor(Color.Naql.textPrimary)
                            }
                            
                            Divider()
                            
                            HStack {
                                Text("Provider Assigned")
                                    .font(NaqlTypography.bodyStyle(isRegular: false))
                                    .foregroundColor(Color.Naql.textMuted)
                                Spacer()
                                Text(selectedProvider?.name ?? "-")
                                    .font(NaqlTypography.bodySemiboldStyle())
                                    .foregroundColor(Color.Naql.textPrimary)
                            }
                            
                            Divider()
                            
                            HStack {
                                Text("Guaranteed Quote")
                                    .font(NaqlTypography.bodyStyle(isRegular: false))
                                    .foregroundColor(Color.Naql.textMuted)
                                Spacer()
                                Text("$\(String(format: "%.2f", selectedProvider?.price ?? 0.0))")
                                    .font(NaqlTypography.headingStyle(size: .small))
                                    .foregroundColor(Color.Naql.primary)
                            }
                        }
                        .padding(NaqlMetrics.spaceLG)
                        .background(Color.Naql.surface)
                        .cornerRadius(NaqlMetrics.cardRadius)
                        .padding(.horizontal, NaqlMetrics.spaceMD)
                        .softShadow()
                        
                    default:
                        EmptyView()
                    }
                }
                .padding(.bottom, 100)
            }
            
            // Step action button
            VStack {
                NaqlButton(title: bookingStep == 3 ? "Secure Truck Now" : "Continue") {
                    if bookingStep < 3 {
                        // Basic validation
                        if bookingStep == 0 && selectedVehicle == nil { return }
                        if bookingStep == 1 && (pickupLocation.isEmpty || dropoffLocation.isEmpty) { return }
                        if bookingStep == 2 && selectedProvider == nil { return }
                        
                        bookingStep += 1
                    } else {
                        // Complete booking, trigger simulator
                        let newJob = Job(
                            id: "NQL-\(Int.random(in: 1000...9999))",
                            pickup: pickupLocation,
                            dropoff: dropoffLocation,
                            price: selectedProvider?.price ?? 340.0,
                            status: .pending,
                            date: "Just Now",
                            vehicleType: selectedVehicle?.name ?? "Heavy Container"
                        )
                        activeJobs.insert(newJob, at: 0)
                        
                        // Clear booking state
                        selectedVehicle = nil
                        pickupLocation = ""
                        dropoffLocation = ""
                        selectedProvider = nil
                        
                        isBooking = false
                    }
                }
                .padding(.horizontal, NaqlMetrics.spaceMD)
                .padding(.bottom, NaqlMetrics.spaceMD)
            }
            .background(Color.Naql.surface)
        }
    }
    
    // MARK: - Live Tracking Map View with Sliding Drawer
    private func trackingView(job: Job) -> some View {
        ZStack {
            // Full-screen map
            NaqlMapView()
            
            // Bottom Sliding Sheet
            SlidingBottomSheet(isOpen: $isDrawerOpen, maxHeight: 320) {
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
                    
                    HStack(spacing: NaqlMetrics.spaceMD) {
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 40))
                            .foregroundColor(Color.Naql.primary)
                        
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                            Text("Ahmed Al-Hassan")
                                .font(NaqlTypography.bodySemiboldStyle())
                                .foregroundColor(Color.Naql.textPrimary)
                            Text("Verified Fleet Driver • 4.9 ★")
                                .font(NaqlTypography.bodyStyle(isRegular: false))
                                .foregroundColor(Color.Naql.textMuted)
                        }
                        Spacer()
                        Button(action: {}) {
                            Image(systemName: "phone.circle.fill")
                                .font(.system(size: 32))
                                .foregroundColor(Color.Naql.primary)
                        }
                    }
                    
                    Divider()
                    
                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
                        Text("Current Step Details")
                            .font(NaqlTypography.bodyStyle(isRegular: false))
                            .foregroundColor(Color.Naql.textMuted)
                        Text(job.status == .inProgress ? "Your cargo is securely locked in transit along Highway 40." : "Deliverable fully transferred.")
                            .font(NaqlTypography.bodyStyle(isRegular: true))
                            .foregroundColor(Color.Naql.textPrimary)
                    }
                    
                    Spacer()
                }
                .padding(NaqlMetrics.spaceLG)
            }
        }
    }
}
