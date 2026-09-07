import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/naql_api.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common_widgets.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _api = NaqlApi();
  late Future<Map<String, dynamic>> _statsFuture;

  @override
  void initState() {
    super.initState();
    final token = context.read<AuthProvider>().token;
    _statsFuture = _api.userStats(token!);
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    if (user == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final displayName = user.username ?? user.email ?? 'Naql customer';
    final menuItems = [
      _MenuItem(icon: '💳', label: 'Payment Methods', sub: 'Visa ···· 4242 + Cash'),
      _MenuItem(icon: '📍', label: 'Saved Addresses', sub: 'Home, Office'),
      _MenuItem(icon: '🔔', label: 'Notifications', sub: 'All enabled'),
      _MenuItem(icon: '🌐', label: 'Language', sub: 'English'),
      _MenuItem(icon: '🛡', label: 'Privacy & Security', sub: ''),
    ];

    return SingleChildScrollView(
      child: Column(
        children: [
          const SizedBox(height: 16),
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: kGreenLight,
              shape: BoxShape.circle,
              border: Border.all(color: kGreenBorder, width: 3),
            ),
            child: Center(
              child: Text(
                'MS',
                style: outfitStyle(size: 26, weight: FontWeight.w800, color: kGreen),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(displayName, style: outfitStyle(size: 20, weight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(
            user.phoneNumber ?? user.email ?? 'Contact information unavailable',
            style: interStyle(size: 14, color: kUserMuted),
          ),
          const SizedBox(height: 20),
          FutureBuilder<Map<String, dynamic>>(
            future: _statsFuture,
            builder: (context, snapshot) {
              final trips = snapshot.data?['trips'] ?? '0';
              final rating = snapshot.data?['rating'] ?? '0.0';
              final saved = snapshot.data?['savedEGP'] ?? '0';
              return Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _stat('$trips', 'Trips'),
                  _divider(),
                  _stat('$rating ⭐', 'Rating'),
                  _divider(),
                  _stat('$saved EGP', 'Saved'),
                ],
              );
            },
          ),
          const SizedBox(height: 24),
          SectionCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: menuItems.asMap().entries.map((entry) {
                final i = entry.key;
                final item = entry.value;
                return Column(
                  children: [
                    InkWell(
                      onTap: () {},
                      borderRadius: BorderRadius.circular(0),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        child: Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: kUserSubtle,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Center(
                                child: Text(item.icon, style: const TextStyle(fontSize: 16)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.label, style: interStyle(size: 14, weight: FontWeight.w500)),
                                  if (item.sub.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(item.sub, style: interStyle(size: 12, color: kUserMuted)),
                                  ],
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right, color: Color(0xFFD1D5DB), size: 20),
                          ],
                        ),
                      ),
                    ),
                    if (i < menuItems.length - 1)
                      const Divider(height: 1, indent: 64, color: Color(0xFFF9FAFB)),
                  ],
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => context.read<AuthProvider>().logout(),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red,
                side: const BorderSide(color: Color(0xFFFEE2E2)),
                backgroundColor: const Color(0xFFFFF1F2),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              ),
              child: Text('Sign Out', style: outfitStyle(size: 15, weight: FontWeight.w600, color: Colors.red)),
            ),
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  Widget _stat(String value, String label) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          Text(value, style: outfitStyle(size: 15, weight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(label, style: interStyle(size: 12, color: kUserMuted)),
        ],
      ),
    );
  }

  Widget _divider() {
    return Container(width: 1, height: 28, color: kUserBorder);
  }
}

class _MenuItem {
  final String icon;
  final String label;
  final String sub;
  const _MenuItem({required this.icon, required this.label, required this.sub});
}