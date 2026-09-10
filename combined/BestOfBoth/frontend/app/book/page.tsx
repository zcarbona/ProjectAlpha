'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import RoleGuard from '@/components/RoleGuard';
import { VehicleType, City } from '@/lib/types';
import { getVehicleTypes, createJob, getProviders, getCities } from '@/lib/api';

function BookPageContent() {
  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState<VehicleType[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType | null>(null);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [pickupCity, setPickupCity] = useState('');
  const [dropoffCity, setDropoffCity] = useState('');
  const [availableProviders, setAvailableProviders] = useState<Array<{id: number, display_name: string}>>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jobStatus, setJobStatus] = useState<'idle' | 'success'>('idle');
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    getCities()
      .then(setCities)
      .catch(() => setError('Failed to load cities'));
  }, []);

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
        pickup: { place_id: null, address: pickup, city: pickupCity, lat: 0, lng: 0 },
        dropoff: { place_id: null, address: dropoff, city: dropoffCity, lat: 0, lng: 0 },
        idempotency_key: idempotencyKey,
        provider_id: selectedProviderId,
      });
      setJobStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create job';
      setError(msg);
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return selectedVehicle !== null;
      case 2: return (
        pickupCity !== '' &&
        pickup.trim() !== '' &&
        dropoffCity !== '' &&
        dropoff.trim() !== ''
      );
      case 3: return selectedProviderId !== null;
      default: return true;
    }
  };

  if (jobStatus === 'success') {
    return (
      <div className="min-h-screen bg-white py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center" style={{ border: '1px solid #e5e7eb' }}>
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Booking Successful!</h2>
          <p className="text-gray-600">Your request has been sent to the provider.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-6" style={{ border: '1px solid #e5e7eb' }}>
        <h2 className="text-xl font-bold mb-4 text-gray-900">Request a Truck</h2>

        <div className="mb-6">
          <div className="flex justify-between mb-2">
            {['Vehicle', 'Locations', 'Provider'].map((label, idx) => (
              <div
                key={label}
                className={`text-sm font-medium ${step === idx + 1 ? 'text-brand' : 'text-gray-400'}`}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="h-2 bg-gray-100 rounded-full">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ background: '#e53935', width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#ffebee', border: '1px solid #ffcdd2', color: '#b91c1c' }}>
            {error}
          </div>
        )}

        <div className="py-4">
          {step === 1 && (
            <div className="space-y-3">
              <p className="font-semibold mb-3 text-gray-800">Choose a vehicle</p>
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicle(v)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedVehicle?.id === v.id ? 'border-brand bg-brand-light' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">
                    {v.emoji} {v.label}
                  </div>
                  <div className="text-sm text-gray-500">{v.description}</div>
                  <div className="text-sm text-gray-400">
                    {v.capacity} · {v.priceRange} EGP
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Pickup City</label>
                <select
                  value={pickupCity}
                  onChange={(e) => setPickupCity(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-white text-gray-900 focus:border-brand focus:outline-none"
                  style={{ borderColor: '#e5e7eb' }}
                >
                  <option value="">Select pickup city</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Pickup Address</label>
                <input
                  type="text"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none"
                  style={{ borderColor: '#e5e7eb' }}
                  placeholder="Enter pickup address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Drop-off City</label>
                <select
                  value={dropoffCity}
                  onChange={(e) => setDropoffCity(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-white text-gray-900 focus:border-brand focus:outline-none"
                  style={{ borderColor: '#e5e7eb' }}
                >
                  <option value="">Select drop-off city</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Drop-off Address</label>
                <input
                  type="text"
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  className="w-full p-3 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:border-brand focus:outline-none"
                  style={{ borderColor: '#e5e7eb' }}
                  placeholder="Enter drop-off address"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="font-semibold mb-3 text-gray-800">Choose a provider</p>
              {availableProviders.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedProviderId(p.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedProviderId === p.id ? 'border-brand bg-brand-light' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 text-lg">{p.display_name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 p-4 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={loading || !canProceed()}
            className="flex-1 p-4 text-white rounded-xl font-bold disabled:opacity-50 transition-colors"
            style={{ background: '#e53935' }}
          >
            {loading ? 'Processing...' : step === 3 ? 'Confirm Booking' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <RoleGuard allowedRoles={['customer']}>
      <BookPageContent />
    </RoleGuard>
  );
}
