import SwiftUI

// MARK: - App Root Coordinator
struct AppCoordinatorView: View {
    @State private var currentFlow = "landing" // landing, login, customer, provider, admin
    @State private var selectedRole = "customer" // customer, provider, admin
    
    // Login Credentials
    @State private var email = ""
    @State private var password = ""
    
    var body: some View {
        ZStack {
            Color.Naql.background.edgesIgnoringSafeArea(.all)
            
            switch currentFlow {
            case "landing":
                landingView
            case "login":
                loginView
            case "customer":
                CustomerFlowView(currentFlow: $currentFlow)
                    .transition(.asymmetric(insertion: .move(edge: .trailing), removal: .opacity))
            case "provider":
                ProviderFlowView(currentFlow: $currentFlow)
                    .transition(.asymmetric(insertion: .move(edge: .trailing), removal: .opacity))
            case "admin":
                AdminFlowView(currentFlow: $currentFlow)
                    .transition(.asymmetric(insertion: .move(edge: .trailing), removal: .opacity))
            default:
                landingView
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: currentFlow)
    }
    
    // MARK: - Beautiful Calming Landing View
    private var landingView: some View {
        VStack(spacing: NaqlMetrics.spaceXL) {
            Spacer()
            
            // Logo Icon & Title
            VStack(spacing: NaqlMetrics.spaceMD) {
                ZStack {
                    Circle()
                        .fill(Color.Naql.primary.opacity(0.1))
                        .frame(width: 100, height: 100)
                    
                    Image(systemName: "truck.box.fill")
                        .font(.system(size: 48))
                        .foregroundColor(Color.Naql.primary)
                }
                
                VStack(spacing: NaqlMetrics.spaceXXS) {
                    Text("Naql")
                        .font(NaqlTypography.headingStyle(size: .large))
                        .foregroundColor(Color.Naql.textPrimary)
                    Text("Calm Logistics System")
                        .font(NaqlTypography.bodyStyle(isRegular: false))
                        .foregroundColor(Color.Naql.textMuted)
                        .tracking(1.2)
                }
            }
            
            Spacer()
            
            // Slogan using friendly calm copy
            VStack(spacing: NaqlMetrics.spaceXS) {
                Text("Logistics, simplified.")
                    .font(NaqlTypography.headingStyle(size: .small))
                    .foregroundColor(Color.Naql.textPrimary)
                Text("Your fleet is ready, your cargo is secured.")
                    .font(NaqlTypography.bodyStyle())
                    .foregroundColor(Color.Naql.textMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, NaqlMetrics.spaceLG)
            
            Spacer()
            
            // Primary Dispatch CTA
            VStack(spacing: NaqlMetrics.spaceMD) {
                NaqlButton(title: "Enter Dashboard Gateway", style: .primary) {
                    currentFlow = "login"
                }
            }
            .padding(.horizontal, NaqlMetrics.spaceLG)
            .padding(.bottom, NaqlMetrics.spaceXXL)
        }
    }
    
    // MARK: - Login / Role Check View
    private var loginView: some View {
        VStack(spacing: NaqlMetrics.spaceLG) {
            // Top Bar
            HStack {
                Button(action: {
                    currentFlow = "landing"
                }) {
                    Image(systemName: "chevron.left")
                        .foregroundColor(Color.Naql.primary)
                        .font(.title3)
                }
                Spacer()
            }
            .padding(.horizontal, NaqlMetrics.spaceLG)
            .padding(.top, NaqlMetrics.spaceMD)
            
            ScrollView {
                VStack(alignment: .leading, spacing: NaqlMetrics.spaceXL) {
                    // Header Copy
                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                        Text("Identity Verification")
                            .font(NaqlTypography.headingStyle(size: .medium))
                            .foregroundColor(Color.Naql.textPrimary)
                        Text("Log into your specialized portal workflow.")
                            .font(NaqlTypography.bodyStyle(isRegular: true))
                            .foregroundColor(Color.Naql.textMuted)
                    }
                    
                    // Role Selector Segmented Style
                    VStack(alignment: .leading, spacing: NaqlMetrics.spaceXS) {
                        Text("Your Platform Access Role")
                            .font(NaqlTypography.bodyStyle(isRegular: false))
                            .foregroundColor(Color.Naql.textMuted)
                        
                        HStack(spacing: NaqlMetrics.spaceXS) {
                            roleTabButton(label: "Customer", role: "customer")
                            roleTabButton(label: "Provider", role: "provider")
                            roleTabButton(label: "Admin", role: "admin")
                        }
                        .padding(4)
                        .background(Color.Naql.background)
                        .cornerRadius(NaqlMetrics.controlRadius)
                    }
                    
                    // Input Form Card
                    VStack(spacing: NaqlMetrics.spaceMD) {
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                            Text("Corporate Email")
                                .font(NaqlTypography.bodyStyle(isRegular: false))
                                .foregroundColor(Color.Naql.textMuted)
                            TextField("email@corporate.com", text: $email)
                                .padding()
                                .background(Color.Naql.background)
                                .cornerRadius(NaqlMetrics.controlRadius)
                                .textInputAutocapitalization(.none)
                        }
                        
                        VStack(alignment: .leading, spacing: NaqlMetrics.spaceXXS) {
                            Text("Access Password")
                                .font(NaqlTypography.bodyStyle(isRegular: false))
                                .foregroundColor(Color.Naql.textMuted)
                            SecureField("••••••••", text: $password)
                                .padding()
                                .background(Color.Naql.background)
                                .cornerRadius(NaqlMetrics.controlRadius)
                        }
                    }
                    .padding(NaqlMetrics.spaceLG)
                    .background(Color.Naql.surface)
                    .cornerRadius(NaqlMetrics.cardRadius)
                    .softShadow()
                    
                    // Verify & Proceed CTA
                    NaqlButton(title: "Verify & Launch Portal", style: .primary) {
                        // Standard bypass for demo
                        currentFlow = selectedRole
                    }
                }
                .padding(.horizontal, NaqlMetrics.spaceLG)
            }
        }
    }
    
    // MARK: - Mini Role Button Helper
    private func roleTabButton(label: String, role: String) -> some View {
        Button(action: {
            selectedRole = role
        }) {
            Text(label)
                .font(NaqlTypography.bodySemiboldStyle(isRegular: false))
                .foregroundColor(selectedRole == role ? .white : Color.Naql.textMuted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, NaqlMetrics.spaceXS + 2)
                .background(selectedRole == role ? Color.Naql.primary : Color.clear)
                .cornerRadius(NaqlMetrics.controlRadius - 2)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - SwiftUI Preview Provider
struct AppCoordinatorView_Previews: PreviewProvider {
    static var previews: some View {
        AppCoordinatorView()
    }
}
