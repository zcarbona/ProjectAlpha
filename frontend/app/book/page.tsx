'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import RoleGuard from '@/components/RoleGuard';
import { VehicleType } from '@/lib/types';
import { getVehicleTypes, createJob, getProviders } from '@/lib/api';

function BookPageContent() {
  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState<VehicleType[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType | null>(null);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  // Budget is removed from UI flow, we will use VehicleType defaults
  const [availableProviders, setAvailableProviders] = useState<Array<{id: number, display_name: string}>>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jobStatus, setJobStatus] = useState<'idle' | 'success'>('idle');
  const { token } = useAuth();

  useEffect(() => {
    getVehicleTypes()
      .then(setVehicles)
      .catch(() => setError('Failed to load vehicles'));
  }, []);

  useEffect(() => {
    if (selectedVehicle) {
      getProviders(selectedVehicle.code)
        .then(setAvailableProviders)
        .catch(() => setError('Failed to load providers'));
    }
  }, [selectedVehicle]);

  const handleNext = async () => {
    if (step === 3) {
      await handleSubmit();
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    if (!token || !selectedVehicle || !selectedProviderId) return;

    setLoading(true);
    setError('');

    try {
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      
      await createJob(token, {
        vehicle_class: selectedVehicle.code,
        pickup: { address: pickup },
        dropoff: { address: dropoff },
        idempotency_key: idempotencyKey,
        provider_id: selectedProviderId!,
      });
      setJobStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return selectedVehicle !== null;
      case 2: return pickup.trim() !== '' && dropoff.trim() !== '';
      case 3: return selectedProviderId !== null;
      default: return true;
    }
  };

  if (jobStatus === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center animate-bounce">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Booking Successful!</h2>
          <p className="text-slate-600">Your request has been sent to the provider.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold mb-6 text-slate-900">Request a Truck</h2>

        {/* Progress Tracker - Updated to 3 steps */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {['Vehicle', 'Locations', 'Provider'].map((label, idx) => (
              <div key={label} className={`text-sm font-medium ${step === idx + 1 ? 'text-amber-600' : 'text-slate-500'}`}>
                {label}
              </div>
            ))}
          </div>
          <div className="h-2 bg-slate-100 rounded-full">
            <div className="h-2 bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

        <div className="py-2">
          {step === 1 && (
            <div className="space-y-3">
              <p className="font-semibold mb-3 text-slate-900">Choose a vehicle</p>
              {vehicles.map((v) => (
                <div key={v.id} onClick={() => setSelectedVehicle(v)} className={`p-4 border rounded-xl cursor-pointer transition-colors ${selectedVehicle?.id === v.id ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="font-semibold text-slate-900 text-lg">{v.emoji} {v.label}</div>
                  <div className="text-sm text-slate-600">{v.description}</div>
                  <div className="text-sm text-slate-500 font-medium">{v.capacity} · {v.priceRange} EGP</div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Pickup Address</label>
                <input type="text" value={pickup} onChange={(e) => setPickup(e.target.value)} className="w-full p-3 border rounded-lg bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none" placeholder="Enter pickup address" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Dropoff Address</label>
                <input type="text" value={dropoff} onChange={(e) => setDropoff(e.target.value)} className="w-full p-3 border rounded-lg bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none" placeholder="Enter dropoff address" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="font-semibold mb-3 text-slate-900">Choose a provider</p>
              {availableProviders.map((p) => (
                <div key={p.id} onClick={() => setSelectedProviderId(p.id)} className={`p-4 border rounded-xl cursor-pointer transition-colors ${selectedProviderId === p.id ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="font-semibold text-slate-900 text-lg">{p.display_name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-8">
          {step > 1 && <button onClick={() => setStep((s) => s - 1)} className="flex-1 p-4 border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors">Back</button>}
          <button onClick={handleNext} disabled={loading || !canProceed()} className="flex-1 p-4 bg-amber-500 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-amber-600 transition-colors">
            {loading ? 'Processing...' : step === 3 ? 'Confirm Booking' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BookPage() {
  return <RoleGuard allowedRoles={['customer']}><BookPageContent /></RoleGuard>;
}