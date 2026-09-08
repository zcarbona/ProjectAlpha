'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import RoleGuard from '@/components/RoleGuard';
import { FleetItem, Job, Truck } from '@/lib/types';
import {
  getProviderFleet,
  updateProviderFleet,
  getProviderJobs,
  approvePrice,
  getProviderTrucks,
  createProviderTruck,
  updateProviderTruck,
  deleteProviderTruck,
  getAvailableRequests,
  acceptJob,
  declineJob,
} from '@/lib/api';

type Tab = 'fleet' | 'trucks' | 'jobs' | 'requests';

function ProviderDashboard() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'fleet');
  const [fleet, setFleet] = useState<FleetItem[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [requests, setRequests] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAuth();

  const loadAll = async () => {
    if (!token) return;
    try {
      const [f, t, j, r] = await Promise.all([
        getProviderFleet(token),
        getProviderTrucks(token),
        getProviderJobs(token),
        getAvailableRequests(token),
      ]);
      setFleet(f);
      setTrucks(t);
      setJobs(j);
      setRequests(r);
    } catch {
      setError('Failed to load provider data');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (jobId: number) => {
    if (!token) return;
    try {
      await acceptJob(token, jobId);
      loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to accept job');
    }
  };

  const handleDecline = async (jobId: number) => {
    if (!token) return;
    try {
      await declineJob(token, jobId);
      loadAll();
    } catch {
      alert('Failed to decline job');
    }
  };


  useEffect(() => {
    loadAll();
  }, [token]);

  const handleUpdateFleet = async (vehicleTypeId: number, quantity: number) => {
    if (!token) return;
    try {
      await updateProviderFleet(token, vehicleTypeId, { quantity, is_active: quantity > 0 });
      loadAll();
    } catch {
      alert('Failed to update fleet');
    }
  };

  const handleToggleFleet = async (vehicleTypeId: number, isActive: boolean) => {
    if (!token) return;
    try {
      const item = fleet.find((f) => f.vehicle_type_id === vehicleTypeId);
      await updateProviderFleet(token, vehicleTypeId, { quantity: item?.quantity || 0, is_active: isActive });
      loadAll();
    } catch {
      alert('Failed to update fleet');
    }
  };

  const handleCreateTruck = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    const form = e.currentTarget;
    const plateNumber = (form.elements.namedItem('plateNumber') as HTMLInputElement).value;
    const vehicleClass = (form.elements.namedItem('vehicleClass') as HTMLInputElement).value;
    const capacity = (form.elements.namedItem('capacity') as HTMLInputElement).value;

    try {
      await createProviderTruck(token, { plate_number: plateNumber, vehicle_class: vehicleClass, capacity });
      form.reset();
      loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create truck');
    }
  };

  const handleUpdateTruck = async (truckId: number, payload: { is_active?: boolean }) => {
    if (!token) return;
    try {
      await updateProviderTruck(token, truckId, payload);
      loadAll();
    } catch {
      alert('Failed to update truck');
    }
  };

  const handleDeleteTruck = async (truckId: number) => {
    if (!token || !confirm('Delete this truck?')) return;
    try {
      await deleteProviderTruck(token, truckId);
      loadAll();
    } catch {
      alert('Failed to delete truck');
    }
  };

  const handleApprove = async (jobId: number, approvedAmount: number) => {
    if (!token) return;
    try {
      await approvePrice(token, jobId, {
        decision: 'approved',
        approved_amount: approvedAmount,
        idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        note: 'Approved via provider dashboard',
      });
      loadAll();
    } catch {
      alert('Failed to approve job');
    }
  };

  const handleReject = async (jobId: number) => {
    if (!token) return;
    try {
      await approvePrice(token, jobId, {
        decision: 'rejected',
        approved_amount: 0,
        idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        note: 'Rejected via provider dashboard',
      });
      loadAll();
    } catch {
      alert('Failed to reject job');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-white">Provider Dashboard</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { key: 'fleet', label: 'My Fleet' },
            { key: 'trucks', label: 'Trucks' },
            { key: 'jobs', label: 'Incoming Jobs' },
            { key: 'requests', label: 'Available Requests' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
                tab === t.key ? 'bg-amber-500 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:border-amber-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'fleet' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-900">My Fleet ({fleet.length})</h2>
            {fleet.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No fleet configured yet.</p>
            ) : (
              <div className="space-y-4">
                {fleet.map((item) => (
                  <div key={item.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {item.emoji} {item.label}
                        </div>
                        <div className="text-sm text-slate-500 font-mono">{item.code}</div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateFleet(item.vehicle_type_id, item.quantity - 1)}
                          className="w-8 h-8 rounded bg-white border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-50"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-medium text-slate-900">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateFleet(item.vehicle_type_id, item.quantity + 1)}
                          className="w-8 h-8 rounded bg-white border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-50"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => handleToggleFleet(item.vehicle_type_id, !item.is_active)}
                        className="px-3 py-1 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                      >
                        {item.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'requests' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-900">Available Requests ({requests.length})</h2>
            {requests.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No requests available.</p>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <div key={req.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <h3 className="font-bold text-slate-900 mb-2">Request #{req.id}</h3>
                    <div className="space-y-1 text-sm mb-4 text-slate-700">
                      <p><strong>Pickup:</strong> {req.pickup_address}</p>
                      <p><strong>Dropoff:</strong> {req.dropoff_address}</p>
                      <p><strong>Budget:</strong> {req.requested_min_price}–{req.requested_max_price} EGP</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAccept(req.id)} className="px-4 py-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 transition-colors">Accept</button>
                      <button onClick={() => handleDecline(req.id)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300 transition-colors">Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        {tab === 'trucks' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-900">My Trucks</h2>
            <form onSubmit={handleCreateTruck} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <input
                name="plateNumber"
                placeholder="Plate number"
                className="p-3 border rounded-lg bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                required
              />
              <input
                name="vehicleClass"
                placeholder="Vehicle class"
                className="p-3 border rounded-lg bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                required
              />
              <input
                name="capacity"
                placeholder="Capacity"
                className="p-3 border rounded-lg bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                required
              />
              <button type="submit" className="p-3 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 transition-colors">
                Add Truck
              </button>
            </form>
            {trucks.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No trucks yet.</p>
            ) : (
              <div className="space-y-4">
                {trucks.map((truck) => (
                  <div key={truck.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-slate-900">{truck.vehicle_class}</div>
                        <div className="text-sm text-slate-500">Plate: {truck.plate_number}</div>
                        <div className="text-sm text-slate-500">Capacity: {truck.capacity}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateTruck(truck.id, { is_active: !truck.is_active })}
                          className={`px-3 py-1 rounded-lg text-sm ${
                            truck.is_active ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {truck.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDeleteTruck(truck.id)}
                          className="px-3 py-1 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'jobs' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-900">Incoming Jobs ({jobs.length})</h2>
            {jobs.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No incoming jobs yet.</p>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div key={job.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-slate-900">Job #{job.id}</h3>
                        <p className="text-sm text-slate-500">
                          {job.truck_plate ? `${job.vehicle_class} · ${job.truck_plate}` : job.vehicle_class}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          job.status === 'awaiting_provider_price_approval'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : job.status === 'awaiting_payment'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {job.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm mb-4 text-slate-700">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Pickup</span>
                        <span className="font-medium text-slate-900">{job.pickup_address || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Dropoff</span>
                        <span className="font-medium text-slate-900">{job.dropoff_address || 'Not set'}</span>
                      </div>
                    </div>

                    {job.status === 'awaiting_provider_price_approval' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(job.id, job.requested_max_price)}
                          className="flex-1 p-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(job.id)}
                          className="flex-1 p-2 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProviderPage() {
  return (
    <RoleGuard allowedRoles={['provider']}>
      <ProviderDashboard />
    </RoleGuard>
  );
}
