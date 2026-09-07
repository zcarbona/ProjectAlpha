import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/naql_api.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common_widgets.dart';
import '../../models/models.dart';

class TripScreen extends StatefulWidget {
  const TripScreen({super.key});

  @override
  State<TripScreen> createState() => _TripScreenState();
}

class _TripScreenState extends State<TripScreen> {
  final _api = NaqlApi();
  late Future<List<JobData>> _jobs;

  @override
  void initState() {
    super.initState();
    _jobs = _loadJobs();
  }

  Future<List<JobData>> _loadJobs() => _api.jobs(context.read<AuthProvider>().token!);

  Future<void> _cancel(int id) async {
    try {
      await _api.cancelJob(context.read<AuthProvider>().token!, id);
      setState(() => _jobs = _loadJobs());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not cancel request')),
        );
      }
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'in_transit':
      case 'driver_arriving':
      case 'arrived':
      case 'delivered':
        return kGreen;
      case 'receiving_offers':
      case 'loading':
        return kAmber;
      case 'completed':
      case 'draft':
        return kUserMuted;
      case 'cancelled':
        return Colors.red;
      default:
        return kBlue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<JobData>>(
      future: _jobs,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(
            child: PrimaryButton(
              label: 'Retry',
              onPressed: () => setState(() => _jobs = _loadJobs()),
            ),
          );
        }

        final jobs = snapshot.data ?? [];
        if (jobs.isEmpty) {
          return Center(
            child: Text('No requests yet.', style: interStyle(size: 16, color: kUserMuted)),
          );
        }

        return RefreshIndicator(
          onRefresh: () async => setState(() => _jobs = _loadJobs()),
          child: ListView.builder(
            padding: const EdgeInsets.all(20),
            itemCount: jobs.length,
            itemBuilder: (context, index) {
              final job = jobs[index];
              final isPending = job.status == 'awaiting_provider_price_approval' ||
                  job.status == 'awaiting_payment';

              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Request #${job.id}',
                            style: outfitStyle(size: 16, weight: FontWeight.w700),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: _statusColor(job.status).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              job.status.replaceAll('_', ' ').toUpperCase(),
                              style: monoStyle(size: 9, color: _statusColor(job.status)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Truck #${job.truckId}',
                        style: interStyle(size: 13, color: kUserTextSub),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Requested: ${job.minPrice.toStringAsFixed(0)}–${job.maxPrice.toStringAsFixed(0)} EGP',
                        style: interStyle(size: 13, color: kUserMuted),
                      ),
                      if (job.approvedPrice != null)
                        Text(
                          'Approved: ${job.approvedPrice} EGP · payment pending',
                          style: interStyle(size: 13, color: kGreen),
                        ),
                      if (isPending) ...[
                        const SizedBox(height: 10),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () => _cancel(job.id),
                            child: const Text('Cancel'),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}