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
  const [darkMode, setDarkMode] = useState(false);
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const { token } = useAuth();

  useEffect(() => {
    getCities()
      .then(setCities)
      .catch(() => setError('Failed to load cities'));
  }, []);

  useEffect(() => {
    const storedDark = localStorage.getItem('darkMode');
    if (storedDark === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    const storedLang = localStorage.getItem('lang');
    if (storedLang === 'ar') {
      setLang('ar');
      document.documentElement.lang = 'ar';
      document.documentElement.dir = 'rtl';
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

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

  const t = lang === 'ar' ? {
    title: 'طلب شاحنة',
    vehicle: 'مركبة',
    locations: 'المواقع',
    provider: 'مزود الخدمة',
    chooseVehicle: 'اختر مركبة',
    pickupCity: 'مدينة الاستلام',
    pickupAddress: 'عنوان الاستلام',
    dropoffCity: 'مدينة التسليم',
    dropoffAddress: 'عنوان التسليم',
    selectPickupCity: 'اختر مدينة الاستلام',
    selectDropoffCity: 'اختر مدينة التسليم',
    chooseProvider: 'اختر مزود الخدمة',
    back: 'رجوع',
    next: 'التالي',
    confirmBooking: 'تأكيد الحجز',
    processing: 'جاري المعالجة...',
    success: 'تم الحجز بنجاح!',
    successMessage: 'تم إرسال طلبك إلى مزود الخدمة.',
  } : {
    title: 'Request a Truck',
    vehicle: 'Vehicle',
    locations: 'Locations',
    provider: 'Provider',
    chooseVehicle: 'Choose a vehicle',
    pickupCity: 'Pickup City',
    pickupAddress: 'Pickup Address',
    dropoffCity: 'Drop-off City',
    dropoffAddress: 'Drop-off Address',
    selectPickupCity: 'Select pickup city',
    selectDropoffCity: 'Select drop-off city',
    chooseProvider: 'Choose a provider',
    back: 'Back',
    next: 'Next',
    confirmBooking: 'Confirm Booking',
    processing: 'Processing...',
    success: 'Booking Successful!',
    successMessage: 'Your request has been sent to the provider.',
  };

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
        pickup: { address: pickup, city: pickupCity },
        dropoff: { address: dropoff, city: dropoffCity },
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

  const cityLabel = (city: City) => {
    if (lang === 'ar') return city.nameAr || city.name;
    return city.name;
  };

  if (jobStatus === 'success') {
    return (
      <div className="min-h-screen book-bg py-12 px-4 flex items-center justify-center">
        <div className="book-success-card max-w-md w-full book-card p-8 rounded-2xl shadow-sm border text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold book-text mb-2">{t.success}</h2>
          <p className="book-muted">{t.successMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .dark .book-bg { background-color: #1e293b; }
        .dark .book-card { background-color: #334155; border-color: #475569; }
        .dark .book-text { color: #f8fafc; }
        .dark .book-muted { color: #94a3b8; }
        .dark .book-input { background-color: #0f172a; border-color: #475569; color: #f8fafc; }
        .dark .book-input::placeholder { color: #64748b; }
        .dark .book-error { background-color: #450a0a; border-color: #991b1b; color: #fca5a5; }
        .dark .book-progress-track { background-color: #334155; }
        .dark .book-select { background-color: #0f172a; border-color: #475569; color: #f8fafc; }
        .dark .book-select option { background-color: #1e293b; color: #f8fafc; }
        .dark .book-success-card { background-color: #334155; border-color: #475569; }
        .dark .book-label { color: #cbd5e1; }
        .dark .book-hover:hover { background-color: #475569; }
        .dark .book-selected { background-color: #78350f; }
      `}</style>
      <div className={`min-h-screen book-bg py-8 px-4 ${darkMode ? 'dark' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="max-w-2xl mx-auto book-card rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold book-text">{t.title}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                className="px-3 py-1 text-sm font-medium border border-slate-300 rounded-lg book-text hover:bg-slate-100 book-hover transition-colors"
              >
                {lang === 'en' ? 'عربي' : 'EN'}
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="px-3 py-1 text-sm font-medium border border-slate-300 rounded-lg book-text hover:bg-slate-100 book-hover transition-colors"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>

          {/* Progress Tracker - Updated to 3 steps */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              {[t.vehicle, t.locations, t.provider].map((label, idx) => (
                <div key={label} className={`text-sm font-medium ${step === idx + 1 ? 'text-amber-600' : 'book-muted'}`}>
                  {label}
                </div>
              ))}
            </div>
            <div className="h-2 book-progress-track rounded-full">
              <div className="h-2 bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
            </div>
          </div>

          {error && <div className="mb-6 p-4 book-error rounded-lg text-sm">{error}</div>}

          <div className="py-2">
            {step === 1 && (
              <div className="space-y-3">
                <p className="font-semibold mb-3 book-text">{t.chooseVehicle}</p>
                {vehicles.map((v) => (
                  <div key={v.id} onClick={() => setSelectedVehicle(v)} className={`p-4 border rounded-xl cursor-pointer transition-colors ${selectedVehicle?.id === v.id ? 'border-amber-500 bg-amber-50 book-selected' : 'border-slate-200 hover:border-slate-300 book-hover'}`}>
                    <div className="font-semibold book-text text-lg">{v.emoji} {v.label}</div>
                    <div className="text-sm book-muted">{v.description}</div>
                    <div className="text-sm book-muted font-medium">{v.capacity} · {v.priceRange} EGP</div>
                  </div>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 book-label">{t.pickupCity}</label>
                  <select
                    value={pickupCity}
                    onChange={(e) => setPickupCity(e.target.value)}
                    className="book-select w-full p-3 border rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">{t.selectPickupCity}</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.name}>
                        {cityLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 book-label">{t.pickupAddress}</label>
                  <input
                    type="text"
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                    className="book-input w-full p-3 border rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    placeholder={t.pickupAddress}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 book-label">{t.dropoffCity}</label>
                  <select
                    value={dropoffCity}
                    onChange={(e) => setDropoffCity(e.target.value)}
                    className="book-select w-full p-3 border rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">{t.selectDropoffCity}</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.name}>
                        {cityLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 book-label">{t.dropoffAddress}</label>
                  <input
                    type="text"
                    value={dropoff}
                    onChange={(e) => setDropoff(e.target.value)}
                    className="book-input w-full p-3 border rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    placeholder={t.dropoffAddress}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="font-semibold mb-3 book-text">{t.chooseProvider}</p>
                {availableProviders.map((p) => (
                  <div key={p.id} onClick={() => setSelectedProviderId(p.id)} className={`p-4 border rounded-xl cursor-pointer transition-colors ${selectedProviderId === p.id ? 'border-amber-500 bg-amber-50 book-selected' : 'border-slate-200 hover:border-slate-300 book-hover'}`}>
                    <div className="font-semibold book-text text-lg">{p.display_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4 mt-8">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 p-4 border border-slate-300 book-text rounded-xl font-bold hover:bg-slate-100 book-hover transition-colors"
              >
                {t.back}
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={loading || !canProceed()}
              className="flex-1 p-4 bg-amber-500 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-amber-600 transition-colors"
            >
              {loading ? t.processing : step === 3 ? t.confirmBooking : t.next}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function BookPage() {
  return <RoleGuard allowedRoles={['customer']}><BookPageContent /></RoleGuard>;
}