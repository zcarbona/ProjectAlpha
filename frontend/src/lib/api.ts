import type {
  User,
  VehicleType,
  City,
  Company,
  Truck,
  Place,
  Job,
  FleetItem,
  AdminStats,
  AdminRequest,
  AdminDriver,
} from './types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 204) return null as T;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = (data as any).detail || (data as any).message || 'Request failed';
    const msg = Array.isArray(detail)
      ? detail.map((e: any) => (typeof e === 'object' && e && 'msg' in e ? (e as any).msg : JSON.stringify(e))).join('\n')
      : typeof detail === 'object'
        ? JSON.stringify(detail)
        : detail;
    throw new Error(msg);
  }

  return data as T;
}

export async function login(identifier: string, password: string) {
  const form = new URLSearchParams();
  form.set('username', identifier);
  form.set('password', password);

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error((data as any).detail || (data as any).message || 'Login failed');
  return data as { access_token: string; refresh_token: string; token_type: string };
}

export async function register(username: string, email: string, password: string, role: 'customer' | 'provider') {
  return request<{ id: number; username: string | null; email: string | null; phone_number: string | null; role: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, role }),
  });
}

export async function getCurrentUser(token: string) {
  return request<User>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateUser(
  token: string,
  payload: { username?: string; email?: string; password?: string; phone_number?: string }
) {
  return request<User>('/auth/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function getVehicleTypes() {
  return request<VehicleType[]>('/vehicle-types');
}

export async function getCities() {
  return request<City[]>('/cities');
}

export async function getCompany() {
  return request<Company>('/company');
}

export async function getTrucks() {
  return request<Truck[]>('/trucks');
}

export type BookingMode = 'request' | 'provider_selection';

export async function createJob(token: string, payload: {
  vehicle_class: string;
  pickup: Place;
  dropoff: Place;
  idempotency_key: string;
  provider_id: number;
}) {
  return request<Job>('/jobs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function getProviders(vehicleClass: string) {
  return request<Array<{id: number, display_name: string}>>(`/providers?vehicle_class=${vehicleClass}`);
}

export async function getJobs(token: string) {
  return request<Job[]>('/jobs', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function cancelJob(token: string, jobId: number) {
  return request<Job>(`/jobs/${jobId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getProviderJobs(token: string) {
  return request<Job[]>('/provider/jobs', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAvailableRequests(token: string) {
  return request<Job[]>('/provider/requests', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function startJob(token: string, jobId: number) {
  return request<Job>(`/provider/jobs/${jobId}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function completeJob(token: string, jobId: number) {
  return request<Job>(`/provider/jobs/${jobId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function acceptJob(token: string, jobId: number, truckId: number) {
  return request<Job>(`/jobs/${jobId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ truck_id: truckId }),
  });
}

export async function declineJob(token: string, jobId: number) {
  return request<{success: boolean}>(`/jobs/${jobId}/decline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}


export async function approvePrice(token: string, jobId: number, payload: {
  decision: 'approved' | 'rejected';
  approved_amount: number;
  idempotency_key: string;
  note?: string;
}) {
  return request<Job>(`/provider/jobs/${jobId}/price-approval`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function getProviderTrucks(token: string) {
  return request<Truck[]>('/provider/trucks', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createProviderTruck(token: string, payload: { plate_number: string; vehicle_class: string; is_active?: boolean }) {
  return request<Truck>('/provider/trucks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function updateProviderTruck(token: string, truckId: number, payload: { plate_number?: string; vehicle_class?: string; capacity?: string; is_active?: boolean }) {
  return request<Truck>(`/provider/trucks/${truckId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function deleteProviderTruck(token: string, truckId: number) {
  return request<void>(`/provider/trucks/${truckId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getProviderFleet(token: string) {
  return request<FleetItem[]>('/provider/fleet', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateProviderFleet(token: string, vehicleTypeId: number, payload: { quantity: number; is_active: boolean }) {
  return request<FleetItem>(`/provider/fleet/${vehicleTypeId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function getAdminStats(token: string) {
  return request<AdminStats>('/admin/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminRequests(token: string) {
  return request<AdminRequest[]>('/admin/requests', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminDrivers(token: string) {
  return request<AdminDriver[]>('/admin/drivers', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export const AuthAPI = {
  login,
  register,
  getCurrentUser,
  updateUser,
};

export const JobsAPI = {
  getVehicleTypes,
  getCities,
  getCompany,
  getTrucks,
  createJob,
  getJobs,
  cancelJob,
  acceptJob,
  declineJob,
};

export const ProviderAPI = {
  getProviders,
  getProviderJobs,
  getAvailableRequests,
  startJob,
  completeJob,
  approvePrice,
  getProviderTrucks,
  createProviderTruck,
  updateProviderTruck,
  deleteProviderTruck,
  getProviderFleet,
  updateProviderFleet,
};

export const AdminAPI = {
  getAdminStats,
  getAdminRequests,
  getAdminDrivers,
};
