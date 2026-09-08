'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import RoleGuard from '@/components/RoleGuard';
import { VehicleType } from '@/lib/types';
import { getVehicleTypes, createJob, getProviders, sendVerificationEmail, verifyEmail } from '@/lib/api';

type BookingMode = 'request' | 'provider_selection';

function BookPageContent() {
  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState<VehicleType[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType | null>(null);
  const [bookingMode, setBookingMode] = useState<BookingMode>('request');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [availableProviders, setAvailableProviders] = useState<Array<{id: number, display_name: string}>>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jobStatus, setJobStatus] = useState<'idle' | 'pending' | 'accepted'>('idle');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const userStr = localStorage.getItem('naql_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (!user.is_verified) {
          setNeedsVerification(true);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    getVehicleTypes()
      .then(setVehicles)
      .catch(() => setError('Failed to load vehicles'));
  }, []);

  useEffect(() => {
    if (bookingMode === 'provider_selection' && selectedVehicle) {
      getProviders(selectedVehicle.code)
        .then(setAvailableProviders)
        .catch(() => setError('Failed to load providers'));
    }
  }, [bookingMode, selectedVehicle]);

  const handleSendVerification = async () => {
    if (!token) return;
    try {
      await sendVerificationEmail(token);
      setVerificationSent(true);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification email');
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !verificationToken.trim()) return;
    setVerifying(true);
    setError('');
    try {
      await verifyEmail(token, verificationToken.trim());
      setNeedsVerification(false);
      const userStr = localStorage.getItem('naql_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.is_verified = true;
        localStorage.setItem('naql_user', JSON.stringify(user));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleNext = async () => {
    if (step === 4) {
      if (bookingMode === 'provider_selection') {
        setStep(5);
      } else {
        await handleSubmit();
      }
      return;
    }
    if (step === 5) {
      await handleSubmit();
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    if (!token || !selectedVehicle) return;

    setLoading(true);
    setError('');

    try {
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      await createJob(token, {
        vehicle_class: selectedVehicle.code,
        pickup: { address: pickup },
        dropoff: { address: dropoff },
        requested_min_price: parseFloat(budgetMin),
        requested_max_price: parseFloat(budgetMax),
        idempotency_key: idempotencyKey,
        booking_mode: bookingMode,
        provider_id: bookingMode === 'provider_selection' ? selectedProviderId || undefined : undefined,
      });
      setJobStatus('pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return selectedVehicle !== null;
      case 2: return pickup.trim() !== '' && dropoff.trim() !== '';
      case 3: return budgetMin !== '' && budgetMax !== '' && parseFloat(budgetMin) <= parseFloat(budgetMax);
      case 4: return bookingMode !== null;
      case 5: return selectedProviderId !== null;
      default: return true;
    }
  };

  if (jobStatus === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Finding a Provider...</h2>
          <p className="text-slate-600">Your request has been sent to available providers. Searching...</p>
        </div>
      </div>
    );
  }

  if (needsVerification) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-center mb-6">
            <div className="text-4xl mb-4">📧</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Verify Your Email</h2>
            <p className="text-sm text-slate-600">You need to verify your email before booking a truck.</p>
          </div>

          {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          {!verificationSent ? (
            <div className="space-y-4">
              <button
                onClick={handleSendVerification}
                className="w-full p-4 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors"
              >
                Send Verification Email
              </button>
              <p className="text-xs text-slate-500 text-center">We&apos;ll send a verification link to your email address.</p>
            </div>
          ) : (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Verification Token</label>
                <input
                  type="text"
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value)}
                  placeholder="Enter the verification token"
                  className="w-full p-3 border rounded-lg bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={verifying}
                className="w-full p-4 bg-amber-500 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-amber-600 transition-colors"
              >
                {verifying ? 'Verifying...' : 'Verify Email'}
              </button>
              <p className="text-xs text-slate-500 text-center">Check the API response for your verification token.</p>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold mb-6 text-slate-900">Request a Truck</h2>

        {/* Progress Tracker */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {['Vehicle', 'Locations', 'Budget', 'Mode', 'Provider'].map((label, idx) => (
              <div key={label} className={`text-sm font-medium ${step === idx + 1 ? 'text-amber-600' : 'text-slate-500'}`}>
                {label}
              </div>
            ))}
          </div>
          <div className="h-2 bg-slate-100 rounded-full">
            <div className="h-2 bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${(step / 5) * 100}%` }} />
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
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Min Budget (EGP)</label>
                <input type="number" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} className="w-full p-3 border rounded-lg bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Max Budget (EGP)</label>
                <input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className="w-full p-3 border rounded-lg bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none" />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="font-semibold text-slate-900">How would you like to book?</p>
              <div className="grid grid-cols-1 gap-4">
                <button type="button" onClick={() => setBookingMode('request')} className={`p-4 rounded-xl border-2 text-left ${bookingMode === 'request' ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}>
                  <div className="font-bold text-slate-900">⚡ Quick Request</div>
                  <div className="text-sm text-slate-600">Fastest way to find a provider.</div>
                </button>
                <button type="button" onClick={() => setBookingMode('provider_selection')} className={`p-4 rounded-xl border-2 text-left ${bookingMode === 'provider_selection' ? 'border-amber-500 bg-amber-50' : 'border-slate-200'}`}>
                  <div className="font-bold text-slate-900">👤 Choose a Provider</div>
                  <div className="text-sm text-slate-600">Compare ratings and prices.</div>
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
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
            {loading ? 'Processing...' : step === 4 && bookingMode === 'request' ? 'Confirm Booking' : step === 5 ? 'Confirm Booking' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BookPage() {
  return <RoleGuard allowedRoles={['customer']}><BookPageContent /></RoleGuard>;
}