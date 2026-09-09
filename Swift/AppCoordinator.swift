import SwiftUI

// MARK: - App Root Coordinator
struct AppCoordinatorView: View {
    @State private var currentFlow  = "landing"
    @State private var selectedRole = "customer"
    @State private var email        = ""
    @State private var password     = ""
    @State private var loginError   = false

    var body: some View {
        ZStack {
            // Persistent aurora background
            NaqlGradientBackground()

            switch currentFlow {
            case "landing":
                landingView
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .scale(scale: 1.04)),
                        removal:   .opacity.combined(with: .scale(scale: 0.96))))
            case "login":
                loginView
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom).combined(with: .opacity),
                        removal:   .opacity))
            case "customer":
                CustomerFlowView(currentFlow: $currentFlow)
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal:   .opacity))
            case "provider":
                ProviderFlowView(currentFlow: $currentFlow)
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal:   .opacity))
            case "admin":
                AdminFlowView(currentFlow: $currentFlow)
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal:   .opacity))
            default:
                landingView
            }
        }
        .animation(.spring(response: 0.5, dampingFraction: 0.82), value: currentFlow)
    }

    // MARK: - Landing View
    private var landingView: some View {
        VStack(spacing: 0) {
            Spacer()

            // Hero Icon
            ZStack {
                // Outer glow ring
                Circle()
                    .stroke(
                        LinearGradient(
                            colors: [Color.Naql.accentBlue.opacity(0.6), Color.Naql.accentTeal.opacity(0.3)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 2
                    )
                    .frame(width: 120, height: 120)

                // Inner glass circle
                Circle()
                    .fill(Color.Naql.glassFill)
                    .frame(width: 108, height: 108)
                    .overlay(
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [Color.white.opacity(0.22), Color.clear],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 108, height: 108)
                    )
                    .shadow(color: Color.Naql.accentBlue.opacity(0.4), radius: 30, x: 0, y: 10)

                Image(systemName: "truck.box.fill")
                    .font(.system(size: 46))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.Naql.accentBlue, Color.Naql.accentTeal],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .shadow(color: Color.Naql.accentBlue.opacity(0.5), radius: 16)
            }
            .padding(.bottom, NaqlMetrics.spaceXL)

            // Brand title
            VStack(spacing: NaqlMetrics.spaceXS) {
                Text("Naql")
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.white, Color.Naql.accentTeal.opacity(0.8)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .shadow(color: Color.Naql.accentBlue.opacity(0.3), radius: 20)

                Text("Smart Logistics Platform")
                    .font(NaqlTypography.bodyStyle(isRegular: false))
                    .foregroundColor(Color.Naql.textMuted)
                    .tracking(1.8)
            }

            Spacer()

            // Tagline glass card
            VStack(spacing: NaqlMetrics.spaceXS) {
                Text("Logistics, simplified.")
                    .font(NaqlTypography.headingStyle(size: .small))
                    .foregroundColor(Color.Naql.textPrimary)
                Text("Your fleet is ready. Your cargo is secured.")
                    .font(NaqlTypography.bodyStyle())
                    .foregroundColor(Color.Naql.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(NaqlMetrics.spaceLG)
            .frame(maxWidth: .infinity)
            .glassCard()
            .padding(.horizontal, NaqlMetrics.spaceLG)

            Spacer()

            // CTA
            VStack(spacing: NaqlMetrics.spaceMD) {
                NaqlButton(title: "Enter Dashboard", icon: "arrow.right.circle.fill", style: .primary) {
                    currentFlow = "login"
                }

                // Feature pills row
                HStack(spacing: NaqlMetrics.spaceXS) {
                    featurePill(icon: "lock.shield.fill", label: "Secure")
                    featurePill(icon: "bolt.fill", label: "Real-time")
                    featurePill(icon: "star.fill", label: "Verified")
                }
            }
            .padding(.horizontal, NaqlMetrics.spaceLG)
            .padding(.bottom, NaqlMetrics.spaceXXL)
        }
    }

    private func featurePill(icon: String, label: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(Color.Naql.accentTeal)
            Text(label)
                .font(NaqlTypography.captionStyle())
                .foregroundColor(Color.Naql.textSecondary)
        }
        .padding(.horizontal, NaqlMetrics.spaceSM)
        .padding(.vertical, 6)
        .glassCard(cornerRadius: NaqlMetrics.pillRadius)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Login View
    private var loginView: some View {
        VStack(spacing: 0) {
            // Nav bar
            HStack {
                Button(action: { currentFlow = "landing" }) {
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 14, weight: .semibold))
                        Text("Back")
                            .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                    }
                    .foregroundColor(Color.Naql.textSecondary)
                    .padding(.horizontal, NaqlMetrics.spaceMD)
                    .padding(.vertical, NaqlMetrics.spaceXS)
                    .glassCard(cornerRadius: NaqlMetrics.pillRadius)
                }
                Spacer()
            }
            .padding(.horizontal, NaqlMetrics.spaceLG)
            .padding(.top, NaqlMetrics.spaceLG)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceXL) {
                    // Header
                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
                        Text("Welcome Back")
                            .font(NaqlTypography.headingStyle(size: .large))
                            .foregroundColor(Color.Naql.textPrimary)
                        Text("Sign in to your Naql portal.")
                            .font(NaqlTypography.bodyStyle())
                            .foregroundColor(Color.Naql.textMuted)
                    }
                    .padding(.top, NaqlMetrics.spaceLG)

                    // Role Selector
                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
                        Text("Access Role")
                            .font(NaqlTypography.captionStyle())
                            .foregroundColor(Color.Naql.textMuted)

                        HStack(spacing: NaqlMetrics.spaceXS) {
                            roleTab(label: "Customer", icon: "person.fill",    role: "customer")
                            roleTab(label: "Provider", icon: "truck.box.fill",  role: "provider")
                            roleTab(label: "Admin",    icon: "shield.fill",    role: "admin")
                        }
                        .padding(5)
                        .glassCard(cornerRadius: NaqlMetrics.controlRadius)
                    }

                    // Form card
                    VStack(spacing: NaqlMetrics.spaceMD) {
                        GlassTextField(
                            label: "Corporate Email",
                            placeholder: "email@company.com",
                            text: $email,
                            icon: "envelope.fill"
                        )
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)

                        GlassTextField(
                            label: "Password",
                            placeholder: "••••••••",
                            text: $password,
                            icon: "lock.fill",
                            isSecure: true
                        )

                        if loginError {
                            HStack(spacing: NaqlMetrics.spaceXS) {
                                Image(systemName: "exclamationmark.circle.fill")
                                Text("Please fill in all fields.")
                            }
                            .font(NaqlTypography.captionStyle())
                            .foregroundColor(Color.Naql.accentCoral)
                        }
                    }
                    .padding(NaqlMetrics.spaceLG)
                    .glassCard(elevated: true)

                    // Sign in CTA
                    NaqlButton(title: "Verify & Launch Portal", icon: "arrow.right.circle.fill", style: .primary) {
                        if email.isEmpty || password.isEmpty {
                            withAnimation { loginError = true }
                            return
                        }
                        loginError = false
                        currentFlow = selectedRole
                    }

                    // Demo hint
                    Text("Demo: fill any email & password to continue.")
                        .font(NaqlTypography.captionStyle())
                        .foregroundColor(Color.Naql.textMuted)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.bottom, NaqlMetrics.spaceXXL)
                }
                .padding(.horizontal, NaqlMetrics.spaceLG)
            }
        }
    }

    private func roleTab(label: String, icon: String, role: String) -> some View {
        let selected = selectedRole == role
        return Button(action: { selectedRole = role }) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                Text(label)
                    .font(NaqlTypography.captionStyle())
            }
            .foregroundColor(selected ? Color.Naql.textPrimary : Color.Naql.textMuted)
            .frame(maxWidth: .infinity)
            .padding(.vertical, NaqlMetrics.spaceXS)
            .background(
                Group {
                    if selected {
                        RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius - 2, style: .continuous)
                            .fill(Color.Naql.accentBlue.opacity(0.70))
                            .overlay(
                                RoundedRectangle(cornerRadius: NaqlMetrics.controlRadius - 2, style: .continuous)
                                    .fill(LinearGradient(
                                        colors: [Color.white.opacity(0.25), Color.clear],
                                        startPoint: .top, endPoint: .center))
                            )
                            .shadow(color: Color.Naql.accentBlue.opacity(0.5), radius: 8)
                    } else {
                        Color.clear
                    }
                }
            )
        }
        .buttonStyle(PlainButtonStyle())
        .animation(.spring(response: 0.3), value: selectedRole)
    }
}

// MARK: - Preview
struct AppCoordinatorView_Previews: PreviewProvider {
    static var previews: some View {
        AppCoordinatorView()
            .preferredColorScheme(.dark)
    }
}
