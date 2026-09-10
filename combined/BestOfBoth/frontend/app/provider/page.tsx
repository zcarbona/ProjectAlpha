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
  startJob,
  completeJob,
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
  const [showTruckModal, setShowTruckModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<number | 0>(0);
  const { token } = useAuth();

  const occupiedTruckIds = jobs
    .filter((j) => j.status === 'accepted' || j.status === 'in_progress')
    .map((j) => j.truck_id)
    .filter((id): id is number => id != null);

  const loadAll = async () => {
    if (!token) return;
    try {
      const results = await Promise.allSettled([
        getProviderFleet(token),
        getProviderTrucks(token),
        getProviderJobs(token),
        getAvailableRequests(token),
      ]);

      if (results[0].status === 'fulfilled') setFleet(results[0].value);
      if (results[1].status === 'fulfilled') setTrucks(results[1].value);
      if (results[2].status === 'fulfilled') setJobs(results[2].value);
      if (results[3].status === 'fulfilled') setRequests(results[3].value);

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        setError(`Failed to load some data (${failed.length}/${results.length} requests failed)`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (jobId: number) => {
    setSelectedRequestId(jobId);
    setSelectedTruckId(0);
    setShowTruckModal(true);
  };

  const handleConfirmAccept = async () => {
    if (!token || !selectedRequestId || !selectedTruckId) return;
    try {
      await acceptJob(token, selectedRequestId, selectedTruckId);
      setShowTruckModal(false);
      setSelectedRequestId(null);
      setSelectedTruckId(0);
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
    const vehicleClass = (form.elements.namedItem('vehicleClass') as HTMLSelectElement).value;

    try {
      await createProviderTruck(token, { plate_number: plateNumber, vehicle_class: vehicleClass });
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

  const handleApprove = async (jobId: number) => {
    if (!token) return;
    const amount = prompt('Enter approved amount:');
    if (!amount || isNaN(parseFloat(amount))) return;
    try {
      await approvePrice(token, jobId, {
        decision: 'approved',
        approved_amount: parseFloat(amount),
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
        idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        note: 'Rejected via provider dashboard',
      });
      loadAll();
    } catch {
      alert('Failed to reject job');
    }
  };

  const handleStartJob = async (jobId: number) => {
    try {
      await startJob(token!, jobId);
      loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start job');
    }
  };

  const handleCompleteJob = async (jobId: number) => {
    try {
      await completeJob(token!, jobId);
      loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete job');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">Provider Dashboard</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#ffebee', border: '1px solid #ffcdd2', color: '#b91c1c' }}>
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
                tab === t.key ? 'text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-brand'
              }`}
              style={tab === t.key ? { background: '#e53935' } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'fleet' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">My Fleet ({fleet.length})</h2>
            {fleet.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No fleet configured yet.</p>
            ) : (
              <div className="space-y-4">
                {fleet.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {item.emoji} {item.label}
                        </div>
                        <div className="text-sm text-gray-500 font-mono">{item.code}</div>
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
                          className="w-8 h-8 rounded bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-50"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-medium text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateFleet(item.vehicle_type_id, item.quantity + 1)}
                          className="w-8 h-8 rounded bg-white border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-50"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => handleToggleFleet(item.vehicle_type_id, !item.is_active)}
                        className="px-3 py-1 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Available Requests ({requests.length})</h2>
            {requests.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No requests available.</p>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <div key={req.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h3 className="font-bold text-gray-900 mb-2">Request #{req.id}</h3>
                    <div className="space-y-1 text-sm mb-4 text-gray-700">
                      <p><strong>Pickup:</strong> {req.pickup_address}</p>
                      <p><strong>Dropoff:</strong> {req.dropoff_address}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAccept(req.id)} className="px-4 py-2 text-white rounded-lg font-bold hover:opacity-90 transition-colors" style={{ background: '#e53935' }}>Accept</button>
                      <button onClick={() => handleDecline(req.id)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors">Decline</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'trucks' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">My Trucks</h2>
            <form onSubmit={handleCreateTruck} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <input
                name="plateNumber"
                placeholder="Plate number"
                className="p-3 border rounded-lg bg-white text-gray-900 focus:border-brand focus:outline-none"
                style={{ borderColor: '#e5e7eb' }}
                required
              />
              <select
                name="vehicleClass"
                className="p-3 border rounded-lg bg-white text-gray-900 focus:border-brand focus:outline-none"
                style={{ borderColor: '#e5e7eb' }}
                required
              >
                <option value="">Select Size</option>
                <option value="small">small</option>
                <option value="medium">medium</option>
                <option value="large">large</option>
                <option value="xl">xl</option>
              </select>
              <button type="submit" className="p-3 text-white rounded-lg font-bold hover:opacity-90 transition-colors" style={{ background: '#e53935' }}>
                Add Truck
              </button>
            </form>
            {trucks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No trucks yet.</p>
            ) : (
              <div className="space-y-4">
                {trucks.map((truck) => (
                  <div key={truck.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-gray-900">{truck.vehicle_class}</div>
                        <div className="text-sm text-gray-500">Plate: {truck.plate_number}</div>
                        <div className="text-sm text-gray-500">Capacity: {truck.capacity}</div>
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Incoming Jobs ({jobs.length})</h2>
            {jobs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No incoming jobs yet.</p>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div key={job.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900">Job #{job.id}</h3>
                        <p className="text-sm text-gray-500">
                          {job.truck_plate ? `${job.vehicle_class} · ${job.truck_plate}` : job.vehicle_class}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          job.status === 'awaiting_price_approval'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : job.status === 'awaiting_payment'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {job.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm mb-4 text-gray-700">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Pickup</span>
                        <span className="font-medium text-gray-900">{job.pickup_address || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Dropoff</span>
                        <span className="font-medium text-gray-900">{job.dropoff_address || 'Not set'}</span>
                      </div>
                    </div>

                    {job.status === 'awaiting_price_approval' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(job.id)}
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
                    {job.status === 'accepted' && (
                      <button
                        onClick={() => handleStartJob(job.id)}
                        className="w-full p-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                      >
                        Start Trip
                      </button>
                    )}
                    {job.status === 'in_progress' && (
                      <button
                        onClick={() => handleCompleteJob(job.id)}
                        className="w-full p-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        Complete Delivery
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showTruckModal && selectedRequestId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Assign Truck</h3>
            <p className="text-sm text-gray-600 mb-4">Select a truck to assign to request #{selectedRequestId}.</p>
            <select
              value={selectedTruckId}
              onChange={(e) => setSelectedTruckId(Number(e.target.value))}
              className="w-full p-3 border rounded-lg bg-white text-gray-900 focus:border-brand focus:outline-none mb-4"
              style={{ borderColor: '#e5e7eb' }}
              required
            >
              <option value={0}>Select a truck</option>
              {trucks
                .filter((t) => t.is_active && t.vehicle_class === requests.find((r) => r.id === selectedRequestId)?.vehicle_class && !occupiedTruckIds.includes(t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.plate_number || `Truck #${t.id}`} — {t.vehicle_class}
                  </option>
                ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowTruckModal(false); setSelectedRequestId(null); setSelectedTruckId(0); }}
                className="flex-1 p-3 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAccept}
                disabled={!selectedTruckId}
                className="flex-1 p-3 text-white rounded-lg font-bold disabled:opacity-50 hover:opacity-90 transition-colors"
                style={{ background: '#e53935' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
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
