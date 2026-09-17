'use client';

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

let _refreshAuth: (() => Promise<string | null>) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function registerAuthRefresh(callback: () => Promise<string | null>) {
  _refreshAuth = callback;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const baseHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const execute = async (authHeader?: string): Promise<Response> => {
    const headers: HeadersInit = authHeader
      ? { ...baseHeaders, Authorization: `Bearer ${authHeader}` }
      : baseHeaders;
    return fetch(url, { ...options, headers });
  };

  let res = await execute();

  if (res.status === 401 && _refreshAuth) {
    if (!refreshPromise) {
      refreshPromise = _refreshAuth();
    }
    const newToken = await refreshPromise;
    refreshPromise = null;
    if (newToken) {
      const retry = await execute(newToken);
      if (retry.status !== 401) {
        return handleResponse(retry);
      }
    }
  }

  return handleResponse(res);

  async function handleResponse(response: Response): Promise<T> {
    if (response.status === 204) return null as T;

    let data: any = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const detail = data?.detail || data?.message || 'Request failed';
      const msg = Array.isArray(detail)
        ? detail
            .map((e: any) => (typeof e === 'object' && e && 'msg' in e ? e.msg : JSON.stringify(e)))
            .join('\n')
        : typeof detail === 'object'
          ? JSON.stringify(detail)
          : detail;
      throw new Error(msg);
    }

    return data as T;
  }
}

// -------------------------------------------------------------
// Authentication APIs
// -------------------------------------------------------------

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
  if (!res.ok) throw new Error(data?.detail || data?.message || 'Login failed');
  return data as { access_token: string; refresh_token: string; token_type: string };
}

export async function register(
  username: string,
  email: string,
  password: string,
  role: 'customer' | 'provider',
  phoneNumber?: string
) {
  return request<{ message: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username,
      email,
      password,
      role,
      phone_number: phoneNumber || undefined,
    }),
  });
}

export async function sendRegistrationOtp(email: string) {
  const res = await fetch(`${API_BASE}/auth/register/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detail || data?.message || 'Failed to send verification code');
  }
  return data;
}

export async function verifyRegistrationOtp(email: string, code: string) {
  const res = await fetch(`${API_BASE}/auth/register/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detail || data?.message || 'Invalid verification code');
  }
  return data as User;
}

export async function resendRegistrationOtp(email: string) {
  const res = await fetch(`${API_BASE}/auth/register/resend-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detail || data?.message || 'Resend failed');
  }
  return data;
}

export async function refreshToken(refresh_token: string) {
  return request<{ access_token: string; refresh_token: string; token_type: string }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token }),
  });
}

export async function getCurrentUser(token: string) {
  return request<User>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getUserStats(token: string) {
  return request<{ trips: number; rating: number; savedEGP: number }>('/auth/me/stats', {
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

export async function updateUserLocation(token: string, lat: number, lng: number) {
  return request<User>('/auth/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ current_lat: lat, current_lng: lng }),
  });
}

// -------------------------------------------------------------
// Catalog & Public Data APIs
// -------------------------------------------------------------

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

export async function getProviders(vehicleClass: string) {
  return request<Array<{ id: number; display_name: string }>>(`/providers?vehicle_class=${encodeURIComponent(vehicleClass)}`);
}

// -------------------------------------------------------------
// Job Booking & Customer APIs
// -------------------------------------------------------------

export async function createJob(
  token: string,
  payload: {
    vehicle_class: string;
    pickup: Place;
    dropoff: Place;
    idempotency_key: string;
    provider_id?: number | null;
    requested_min_price?: number;
    requested_max_price?: number;
    booking_mode?: 'request' | 'provider_selection';
  }
) {
  return request<Job>('/jobs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function createQuickJob(
  token: string,
  payload: {
    vehicle_class: string;
    pickup: Place;
    dropoff: Place;
    idempotency_key: string;
    requested_min_price?: number;
    requested_max_price?: number;
  }
) {
  return request<Job>('/jobs/quick_request', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function createSelectiveJob(
  token: string,
  payload: {
    vehicle_class: string;
    pickup: Place;
    dropoff: Place;
    provider_id: number;
    idempotency_key: string;
    requested_min_price?: number;
    requested_max_price?: number;
  }
) {
  return request<Job>('/jobs/selective', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
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

// -------------------------------------------------------------
// Provider Action APIs
// -------------------------------------------------------------

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

export async function acceptJob(token: string, jobId: number, truckId: number) {
  return request<Job>(`/jobs/${jobId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ truck_id: truckId }),
  });
}

export async function declineJob(token: string, jobId: number) {
  return request<{ message: string; job_id: number }>(`/jobs/${jobId}/decline`, {
    method: 'POST',
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

export async function approvePrice(
  token: string,
  jobId: number,
  payload: {
    decision: 'approved' | 'rejected';
    approved_amount?: number;
    idempotency_key: string;
    note?: string;
  }
) {
  return request<Job>(`/provider/jobs/${jobId}/price-approval`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function updateProviderAvailability(token: string, isAvailable: boolean) {
  return request<{ is_available: boolean }>('/provider/availability', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ is_available: isAvailable }),
  });
}

export async function getProviderTrucks(token: string) {
  return request<Truck[]>('/provider/trucks', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createProviderTruck(
  token: string,
  payload: { plate_number: string; vehicle_class: string; capacity?: string; is_active?: boolean }
) {
  return request<Truck>('/provider/trucks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function updateProviderTruck(
  token: string,
  truckId: number,
  payload: { plate_number?: string; vehicle_class?: string; capacity?: string; is_active?: boolean }
) {
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

export async function updateProviderFleet(
  token: string,
  vehicleTypeId: number,
  payload: { quantity: number; is_active: boolean }
) {
  return request<FleetItem>(`/provider/fleet/${vehicleTypeId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

// -------------------------------------------------------------
// Admin APIs
// -------------------------------------------------------------

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

// -------------------------------------------------------------
// Real-Time Server-Sent Events (SSE)
// -------------------------------------------------------------

export function subscribeToEvents(
  token: string,
  onEvent: (event: any) => void,
  onError?: (err: any) => void
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/events/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`SSE stream connection failed: ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            try {
              const data = JSON.parse(trimmed.slice(5).trim());
              onEvent(data);
            } catch (parseErr) {
              console.warn('[SSE] JSON parse error:', parseErr);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[SSE] Connection error:', err);
        onError?.(err);
      }
    }
  })();

  return () => {
    controller.abort();
  };
}

export const AuthAPI = {
  login,
  register,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  getCurrentUser,
  refreshToken,
  updateUser,
  updateUserLocation,
};

export const JobsAPI = {
  getVehicleTypes,
  getCities,
  getCompany,
  getTrucks,
  getProviders,
  createJob,
  createQuickJob,
  createSelectiveJob,
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
  updateProviderAvailability,
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
