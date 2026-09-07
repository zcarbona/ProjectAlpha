import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/models.dart';

class VehicleTypeData {
  final int id;
  final String code;
  final String label;
  final String description;
  final String emoji;
  final String capacity;
  final String priceRange;
  const VehicleTypeData(
    this.id,
    this.code,
    this.label,
    this.description,
    this.emoji,
    this.capacity,
    this.priceRange,
  );
  factory VehicleTypeData.fromJson(Map<String, dynamic> j) => VehicleTypeData(
        j['id'] as int,
        j['code'] as String,
        j['label'] as String,
        j['description'] as String? ?? '',
        j['emoji'] as String? ?? '',
        j['capacity'] as String? ?? '',
        j['priceRange'] as String? ?? '',
      );
}

class AdminRequestData {
  final String id;
  final String customer;
  final String from;
  final String to;
  final String status;
  final double amount;
  const AdminRequestData(
    this.id,
    this.customer,
    this.from,
    this.to,
    this.status,
    this.amount,
  );
  factory AdminRequestData.fromJson(Map<String, dynamic> j) => AdminRequestData(
        j['id'] as String,
        j['customer'] as String,
        j['from'] as String,
        j['to'] as String,
        j['status'] as String,
        (j['amount'] as num).toDouble(),
      );
}

class AdminDriverData {
  final String name;
  final int trips;
  final double rating;
  final String status;
  final String earnings;
  const AdminDriverData(
    this.name,
    this.trips,
    this.rating,
    this.status,
    this.earnings,
  );
  factory AdminDriverData.fromJson(Map<String, dynamic> j) => AdminDriverData(
        j['name'] as String,
        j['trips'] as int,
        (j['rating'] as num).toDouble(),
        j['status'] as String,
        j['earnings'] as String,
      );
}

class AdminStatsData {
  final int activeUsers;
  final int requestsToday;
  final double revenue;
  final String driverAcceptanceRate;
  const AdminStatsData(
    this.activeUsers,
    this.requestsToday,
    this.revenue,
    this.driverAcceptanceRate,
  );
  factory AdminStatsData.fromJson(Map<String, dynamic> j) => AdminStatsData(
        j['activeUsers'] as int,
        j['requestsToday'] as int,
        (j['revenueEGP'] as num).toDouble(),
        j['driverAcceptanceRate'] as String,
      );
}

class NaqlApi {
  static const _base = '/api/v1';

  Map<String, String> _headers(String token) =>
      {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};

  Future<List<TruckData>> trucks() async {
    final r = await http.get(Uri.parse('$_base/trucks'));
    if (r.statusCode != 200) throw Exception('Could not load available trucks');
    return (json.decode(r.body) as List)
        .map((e) => TruckData.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<VehicleTypeData>> vehicleTypes() async {
    final r = await http.get(Uri.parse('$_base/vehicle-types'));
    if (r.statusCode != 200) throw Exception('Could not load vehicle types');
    return (json.decode(r.body) as List)
        .map((e) => VehicleTypeData.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<JobData>> jobs(String token) async {
    final r = await http.get(Uri.parse('$_base/jobs'), headers: _headers(token));
    if (r.statusCode != 200) throw Exception('Could not load jobs');
    return (json.decode(r.body) as List)
        .map((e) => JobData.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<JobData> createJob(
    String token, {
    required int truckId,
    required String pickup,
    required String dropoff,
    required double pickupLat,
    required double pickupLng,
    required double dropoffLat,
    required double dropoffLng,
    required double min,
    required double max,
  }) async {
    final id = DateTime.now().microsecondsSinceEpoch.toString().padLeft(16, '0');
    final place = (String address, double lat, double lng) => {
          'place_id': 'map-$id-${address.hashCode.abs()}',
          'address': address,
          'lat': lat,
          'lng': lng,
        };

    final r = await http.post(
      Uri.parse('$_base/jobs'),
      headers: _headers(token),
      body: json.encode({
        'truck_id': truckId,
        'pickup': place(pickup, pickupLat, pickupLng),
        'dropoff': place(dropoff, dropoffLat, dropoffLng),
        'requested_min_price': min,
        'requested_max_price': max,
        'idempotency_key': id,
      }),
    );
    if (r.statusCode != 201) throw Exception('Could not submit request: ${r.body}');
    return JobData.fromJson(json.decode(r.body) as Map<String, dynamic>);
  }

  Future<void> cancelJob(String token, int jobId) async {
    final r = await http.post(
      Uri.parse('$_base/jobs/$jobId/cancel'),
      headers: _headers(token),
    );
    if (r.statusCode != 200) throw Exception('Could not cancel request');
  }

  Future<AdminStatsData> adminStats(String token) async {
    final r = await http.get(Uri.parse('$_base/admin/stats'), headers: _headers(token));
    if (r.statusCode != 200) throw Exception('Could not load admin stats');
    return AdminStatsData.fromJson(json.decode(r.body) as Map<String, dynamic>);
  }

  Future<List<AdminRequestData>> adminRequests(String token) async {
    final r = await http.get(Uri.parse('$_base/admin/requests'), headers: _headers(token));
    if (r.statusCode != 200) throw Exception('Could not load admin requests');
    return (json.decode(r.body) as List)
        .map((e) => AdminRequestData.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<AdminDriverData>> adminDrivers(String token) async {
    final r = await http.get(Uri.parse('$_base/admin/drivers'), headers: _headers(token));
    if (r.statusCode != 200) throw Exception('Could not load admin drivers');
    return (json.decode(r.body) as List)
         .map((e) => AdminDriverData.fromJson(e as Map<String, dynamic>))
         .toList();
  }

  Future<Map<String, dynamic>> userStats(String token) async {
    final r = await http.get(Uri.parse('$_base/auth/me/stats'), headers: _headers(token));
    if (r.statusCode != 200) throw Exception('Could not load user stats');
    return json.decode(r.body) as Map<String, dynamic>;
  }
}