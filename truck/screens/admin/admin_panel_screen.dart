import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/naql_api.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../models/models.dart';

class AdminPanelScreen extends StatefulWidget {
  const AdminPanelScreen({super.key});

  @override
  State<AdminPanelScreen> createState() => _AdminPanelScreenState();
}

class _AdminPanelScreenState extends State<AdminPanelScreen> {
  int _sectionIndex = 0;
  static const _sections = ['Overview', 'Requests', 'Drivers'];

  final _api = NaqlApi();
  late Future<AdminStatsData> _statsFuture;
  late Future<List<AdminRequestData>> _requestsFuture;
  late Future<List<AdminDriverData>> _driversFuture;

  @override
  void initState() {
    super.initState();
    final token = context.read<AuthProvider>().token;
    _statsFuture = _api.adminStats(token!);
    _requestsFuture = _api.adminRequests(token!);
    _driversFuture = _api.adminDrivers(token!);
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: kAdminAmber.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: kAdminAmber.withOpacity(0.3)),
                ),
                child: const Center(child: Text('⚙️', style: TextStyle(fontSize: 16))),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Admin Panel', style: outfitStyle(size: 20, weight: FontWeight.w700, color: kAdminText)),
                  Text('SYSTEM OVERVIEW', style: monoStyle(size: 10, color: kAdminFaint, letterSpacing: 1.2)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          FutureBuilder<AdminStatsData>(
            future: _statsFuture,
            builder: (context, snapshot) {
              if (snapshot.hasData) {
                final stats = snapshot.data!;
                final statsList = [
                  _AdminStat('Active Users', '${stats.activeUsers}', '+12%', true),
                  _AdminStat('Requests Today', '${stats.requestsToday}', '+8%', true),
                  _AdminStat('Revenue (EGP)', '${stats.revenue.toInt()}', '+23%', true),
                  _AdminStat('Driver Accept.', stats.driverAcceptanceRate, '-2%', false),
                ];
                return GridView.count(
                  crossAxisCount: 2,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 1.5,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  children: statsList.map((s) => _StatCard(stat: s)).toList(),
                );
              }
              return const Center(child: CircularProgressIndicator());
            },
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: kAdminMuted,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: _sections.asMap().entries.map((entry) {
                final i = entry.key;
                final label = entry.value;
                final isActive = _sectionIndex == i;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _sectionIndex = i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: isActive ? kAdminSurface : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        label,
                        textAlign: TextAlign.center,
                        style: outfitStyle(
                          size: 12,
                          weight: FontWeight.w600,
                          color: isActive ? kAdminText : kAdminFaint,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),
          if (_sectionIndex == 0) const _OverviewSection(),
          if (_sectionIndex == 1) _RequestsSection(requestsFuture: _requestsFuture),
          if (_sectionIndex == 2) _DriversSection(driversFuture: _driversFuture),
          const SizedBox(height: 30),
        ],
      ),
    );
  }
}

class _AdminStat {
  final String label;
  final String value;
  final String change;
  final bool up;
  const _AdminStat(this.label, this.value, this.change, this.up);
}

class _StatCard extends StatelessWidget {
  final _AdminStat stat;
  const _StatCard({super.key, required this.stat});

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      dark: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(stat.label, style: interStyle(size: 12, color: kAdminFaint)),
          const SizedBox(height: 8),
          Text(stat.value, style: outfitStyle(size: 24, weight: FontWeight.w700, color: kAdminText)),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(
                stat.up ? Icons.arrow_upward : Icons.arrow_downward,
                size: 12,
                color: stat.up ? kTeal : Colors.red[400],
              ),
              const SizedBox(width: 4),
              Text(
                stat.change,
                style: monoStyle(size: 11, color: stat.up ? kTeal : Colors.red[400]!),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OverviewSection extends StatelessWidget {
  const _OverviewSection();

  final _rules = const [
    _Rule('Platform commission', '15%', true),
    _Rule('Min bid allowed', '50 EGP', false),
    _Rule('Max bid allowed', '2,000 EGP', false),
    _Rule('Bid closing window', '2h before', false),
  ];

  final _statuses = const [
    'DRAFT', 'PUBLISHED', 'RECEIVING OFFERS', 'OFFER ACCEPTED',
    'CONFIRMED', 'DRIVER ARRIVING', 'ARRIVED', 'LOADING',
    'IN TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED',
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SectionCard(
          dark: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Business Rules', style: outfitStyle(size: 14, weight: FontWeight.w600, color: kAdminText)),
              const SizedBox(height: 12),
              ..._rules.asMap().entries.map((entry) {
                final i = entry.key;
                final rule = entry.value;
                return Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(rule.label, style: interStyle(size: 14, color: kAdminSub)),
                          Text(
                            rule.value,
                            style: monoStyle(
                              size: 13,
                              color: rule.accent ? kTeal : kAdminText,
                              weight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (i < _rules.length - 1)
                      Divider(height: 1, color: Colors.white.withOpacity(0.05)),
                  ],
                );
              }),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SectionCard(
          dark: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Request Lifecycle', style: outfitStyle(size: 14, weight: FontWeight.w600, color: kAdminText)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _statuses.map((s) {
                  Color bg, fg;
                  if (s == 'COMPLETED' || s == 'DRAFT') {
                    bg = kAdminMuted;
                    fg = kAdminFaint;
                  } else if (s == 'CANCELLED') {
                    bg = Colors.red.withOpacity(0.1);
                    fg = Colors.red[400]!;
                  } else if (s.contains('OFFER') || s == 'CONFIRMED') {
                    bg = Colors.purple.withOpacity(0.1);
                    fg = Colors.purple[300]!;
                  } else if (s == 'PUBLISHED' || s == 'RECEIVING OFFERS' || s == 'LOADING') {
                    bg = kAdminAmber.withOpacity(0.1);
                    fg = kAdminAmber;
                  } else {
                    bg = kTeal.withOpacity(0.1);
                    fg = kTeal;
                  }
                  return StatusBadge(label: s, bg: bg, fg: fg);
                }).toList(),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Rule {
  final String label;
  final String value;
  final bool accent;
  const _Rule(this.label, this.value, this.accent);
}

class _RequestsSection extends StatelessWidget {
  final Future<List<AdminRequestData>> requestsFuture;
  const _RequestsSection({required this.requestsFuture});

  Color _statusBg(RequestStatus s) {
    switch (s) {
      case RequestStatus.inTransit:
      case RequestStatus.driverArriving:
      case RequestStatus.arrived:
      case RequestStatus.delivered:
        return kTeal.withOpacity(0.1);
      case RequestStatus.receivingOffers:
      case RequestStatus.loading:
        return kAdminAmber.withOpacity(0.1);
      case RequestStatus.completed:
      case RequestStatus.draft:
        return kAdminMuted;
      case RequestStatus.cancelled:
        return Colors.red.withOpacity(0.1);
      default:
        return Colors.blue.withOpacity(0.1);
    }
  }

  Color _statusFg(RequestStatus s) {
    switch (s) {
      case RequestStatus.inTransit:
      case RequestStatus.driverArriving:
      case RequestStatus.arrived:
      case RequestStatus.delivered:
        return kTeal;
      case RequestStatus.receivingOffers:
      case RequestStatus.loading:
        return kAdminAmber;
      case RequestStatus.completed:
      case RequestStatus.draft:
        return kAdminFaint;
      case RequestStatus.cancelled:
        return Colors.red[400]!;
      default:
        return Colors.blue[400]!;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      dark: true,
      padding: EdgeInsets.zero,
      child: FutureBuilder<List<AdminRequestData>>(
        future: requestsFuture,
        builder: (context, snapshot) {
          if (snapshot.hasData) {
            final requests = snapshot.data!;
            if (requests.isEmpty) {
              return const Padding(
                padding: EdgeInsets.all(16),
                child: Text('No requests yet.', style: TextStyle(color: kAdminFaint)),
              );
            }
            return Column(
              children: requests.asMap().entries.map((entry) {
                final i = entry.key;
                final r = entry.value;
                final statusEnum = RequestStatus.values.firstWhere(
                  (e) => e.name == r.status.toUpperCase(),
                  orElse: () => RequestStatus.draft,
                );
                return Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Row(
                        children: [
                          Text(r.id, style: monoStyle(size: 11, color: kAdminFaint)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(r.customer, style: interStyle(size: 12, weight: FontWeight.w500, color: kAdminText)),
                                Text('${r.from} → ${r.to}', style: interStyle(size: 11, color: kAdminFaint)),
                              ],
                            ),
                          ),
                          StatusBadge(
                            label: r.status.replaceAll('_', ' ').toUpperCase(),
                            bg: _statusBg(statusEnum),
                            fg: _statusFg(statusEnum),
                          ),
                          const SizedBox(width: 8),
                          SizedBox(
                            width: 44,
                            child: Text(
                              r.amount > 0 ? '${r.amount.toInt()}' : '—',
                              style: monoStyle(size: 11, color: kTeal),
                              textAlign: TextAlign.right,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (i < requests.length - 1)
                      Divider(height: 1, color: Colors.white.withOpacity(0.05)),
                  ],
                );
              }).toList(),
            );
          }
          return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()));
        },
      ),
    );
  }
}

class _DriversSection extends StatelessWidget {
  final Future<List<AdminDriverData>> driversFuture;
  const _DriversSection({required this.driversFuture});

  Color _statusColor(String s) {
    switch (s) {
      case 'online':
        return kTeal;
      case 'pending':
        return kAdminAmber;
      default:
        return kAdminFaint;
    }
  }

  Color _statusBg(String s) {
    switch (s) {
      case 'online':
        return kTeal.withOpacity(0.1);
      case 'pending':
        return kAdminAmber.withOpacity(0.1);
      default:
        return Colors.white.withOpacity(0.05);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<AdminDriverData>>(
      future: driversFuture,
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          final drivers = snapshot.data!;
          if (drivers.isEmpty) {
            return const Center(child: Padding(padding: EdgeInsets.all(16), child: Text('No drivers found.', style: TextStyle(color: kAdminFaint))));
          }
          return Column(
            children: drivers.map((d) {
              final initials = d.name.split(' ').map((n) => n[0]).take(2).join();
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: SectionCard(
                  dark: true,
                  child: Row(
                    children: [
                      AvatarCircle(initials: initials, size: 36, dark: true),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(d.name, style: interStyle(size: 13, weight: FontWeight.w500, color: kAdminText)),
                            Row(
                              children: [
                                const Text('★', style: TextStyle(color: kAmber, fontSize: 11)),
                                const SizedBox(width: 4),
                                Text('${d.rating}', style: interStyle(size: 11, color: kAdminFaint)),
                                const SizedBox(width: 6),
                                Text('· ${d.trips} trips', style: interStyle(size: 11, color: kAdminFaint)),
                              ],
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(d.earnings, style: monoStyle(size: 12, color: kTeal, weight: FontWeight.w500)),
                          const SizedBox(height: 4),
                          StatusBadge(
                            label: d.status.toUpperCase(),
                            bg: _statusBg(d.status),
                            fg: _statusColor(d.status),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          );
        }
        return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()));
      },
    );
  }
}