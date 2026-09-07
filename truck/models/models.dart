import 'package:flutter/material.dart';

enum AppMode { user, admin }

enum RequestStatus {
  draft,
  published,
  receivingOffers,
  offerAccepted,
  confirmed,
  driverArriving,
  arrived,
  loading,
  inTransit,
  delivered,
  completed,
  cancelled,
}

enum PaymentMethod { cash, visa }

enum CarSize { small, medium, large, xl }

enum BookingStep { vehicle, locations, schedule, budget, payment, confirm }

class CarSizeOption {
  final CarSize id;
  final String label;
  final String emoji;
  final String description;
  final String capacity;
  final String priceRange;

  const CarSizeOption({
    required this.id,
    required this.label,
    required this.emoji,
    required this.description,
    required this.capacity,
    required this.priceRange,
  });
}

class DriverOffer {
  final String id;
  final String driverName;
  final String avatarInitials;
  final double rating;
  final int trips;
  final int price;
  final String eta;
  final String message;
  final String vehicleType;

  const DriverOffer({
    required this.id,
    required this.driverName,
    required this.avatarInitials,
    required this.rating,
    required this.trips,
    required this.price,
    required this.eta,
    required this.message,
    required this.vehicleType,
  });
}

class ChatMessage {
  final int id;
  final bool fromDriver;
  final String text;
  final String time;

  const ChatMessage({
    required this.id,
    required this.fromDriver,
    required this.text,
    required this.time,
  });
}

class TruckData {
  final int id;
  final String vehicleClass;
  final String capacity;

  const TruckData(this.id, this.vehicleClass, this.capacity);

  factory TruckData.fromJson(Map<String, dynamic> json) => TruckData(
        json['id'] as int,
        json['vehicle_class'] as String,
        json['capacity'] as String,
      );
}

class JobData {
  final int id;
  final int truckId;
  final String status;
  final String paymentStatus;
  final double minPrice;
  final double maxPrice;
  final double? approvedPrice;

  const JobData(
    this.id,
    this.truckId,
    this.status,
    this.paymentStatus,
    this.minPrice,
    this.maxPrice,
    this.approvedPrice,
  );

  factory JobData.fromJson(Map<String, dynamic> json) => JobData(
        json['id'] as int,
        json['truck_id'] as int,
        json['status'] as String,
        json['payment_status'] as String,
        (json['requested_min_price'] as num).toDouble(),
        (json['requested_max_price'] as num).toDouble(),
        (json['approved_price'] as num?)?.toDouble(),
      );
}

class ApiUser {
  final int id;
  final String? username;
  final String? email;
  final String? phoneNumber;
  final String role;
  final bool isVerified;

  const ApiUser({
    required this.id,
    this.username,
    this.email,
    this.phoneNumber,
    required this.role,
    required this.isVerified,
  });

  factory ApiUser.fromJson(Map<String, dynamic> json) => ApiUser(
        id: json['id'] as int,
        username: json['username'] as String?,
        email: json['email'] as String?,
        phoneNumber: json['phone_number'] as String?,
        role: json['role'] as String,
        isVerified: json['is_verified'] as bool,
      );
}

const List<ChatMessage> sampleMessages = [
  ChatMessage(id: 1, fromDriver: true, text: 'Hello! I can be at your location in 8 minutes.', time: '9:32 AM'),
  ChatMessage(id: 2, fromDriver: false, text: 'Great, I have 3 large boxes and a sofa.', time: '9:33 AM'),
  ChatMessage(id: 3, fromDriver: true, text: 'No problem, I have helpers available. Do you need packing material?', time: '9:33 AM'),
  ChatMessage(id: 4, fromDriver: false, text: 'No thanks, everything is ready.', time: '9:34 AM'),
  ChatMessage(id: 5, fromDriver: true, text: 'Perfect, I am on my way! 🚛', time: '9:35 AM'),
];

extension RequestStatusLabel on RequestStatus {
  String get label {
    switch (this) {
      case RequestStatus.draft:
        return 'DRAFT';
      case RequestStatus.published:
        return 'PUBLISHED';
      case RequestStatus.receivingOffers:
        return 'RECEIVING OFFERS';
      case RequestStatus.offerAccepted:
        return 'OFFER ACCEPTED';
      case RequestStatus.confirmed:
        return 'CONFIRMED';
      case RequestStatus.driverArriving:
        return 'DRIVER ARRIVING';
      case RequestStatus.arrived:
        return 'ARRIVED';
      case RequestStatus.loading:
        return 'LOADING';
      case RequestStatus.inTransit:
        return 'IN TRANSIT';
      case RequestStatus.delivered:
        return 'DELIVERED';
      case RequestStatus.completed:
        return 'COMPLETED';
      case RequestStatus.cancelled:
        return 'CANCELLED';
    }
  }
}

extension BookingStepLabel on BookingStep {
  String get label {
    switch (this) {
      case BookingStep.vehicle:
        return 'Vehicle';
      case BookingStep.locations:
        return 'Locations';
      case BookingStep.schedule:
        return 'Schedule';
      case BookingStep.budget:
        return 'Budget';
      case BookingStep.payment:
        return 'Payment';
      case BookingStep.confirm:
        return 'Confirm';
    }
  }
}