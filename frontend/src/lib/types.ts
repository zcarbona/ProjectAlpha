export type UserRole = 'admin' | 'customer' | 'provider';

export interface User {
  id: number;
  username: string | null;
  email: string | null;
  phone_number: string | null;
  role: UserRole;
  is_verified: boolean;
  current_lat?: number | null;
  current_lng?: number | null;
}

export interface VehicleType {
  id: number;
  code: string;
  label: string;
  description: string | null;
  emoji: string | null;
  capacity: string | null;
  priceRange: string | null;
}

export interface Place {
  place_id?: string | null;
  address: string;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
}

export interface Job {
  id: number;
  customer_id?: number;
  truck_id: number | null;
  vehicle_class: string;
  truck_plate: string | null;
  provider_id: number | null;
  provider_name: string | null;
  status: string;
  payment_status: string;
  requested_min_price: number | null;
  requested_max_price: number | null;
  approved_price: number | null;
  lock_expires_at: string | null;
  pickup_address: string | null;
  pickup_city?: string | null;
  dropoff_address: string | null;
  dropoff_city?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Truck {
  id: number;
  plate_number: string | null;
  vehicle_class: string;
  capacity: string;
  is_active: boolean;
  is_available?: boolean;
}

export interface FleetItem {
  id: number;
  vehicle_type_id: number;
  code: string;
  label: string;
  emoji: string;
  quantity: number;
  is_active: boolean;
}

export interface Company {
  name: string;
  legal_name: string;
  contact_email: string;
  contact_phone: string;
}

export interface City {
  id: number;
  name: string;
  nameAr: string | null;
  latitude: number;
  longitude: number;
}

export interface AdminStats {
  activeUsers: number;
  requestsToday: number;
  revenueEGP: number;
  driverAcceptanceRate: string;
}

export interface AdminRequest {
  id: string;
  customer: string;
  from: string;
  to: string;
  status: string;
  amount: number;
}

export interface AdminDriver {
  name: string;
  trips: number;
  rating: number;
  status: string;
  earnings: string;
}
