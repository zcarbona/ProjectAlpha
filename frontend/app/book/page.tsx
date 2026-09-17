'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';
import RoleGuard from '@/components/RoleGuard';
import { VehicleType, City } from '@/lib/types';
import {
  getVehicleTypes,
  getCities,
  getProviders,
  createQuickJob,
  createSelectiveJob,
} from '@/lib/api';

export const dynamic = 'force-dynamic';

const TruckMapWithUser = dynamicImport(() => import('@/components/TruckMap'), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full bg-gray-100 rounded-2xl animate-pulse flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
    </div>
  ),
});

const truckImages: Record<string, string> = {
  small: '/truck-pic/rb3-nq1.jpg',
  medium: '/truck-pic/3byh-nq2.jpg',
  large: '/truck-pic/ns-nq.jpg',
  xl: '/truck-pic/nq3th.webp',
};

const BASE_PRICE: Record<string, number> = {
  small: 250,
  medium: 350,
  large: 700,
  xl: 850,
};

const PER_KM: Record<string, number> = {
  small: 6,
  medium: 8,
  large: 11,
  xl: 15,
};

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimatePrice(vehicleCode: string, fromCity: string, toCity: string, cities: City[]): number {
  if (!vehicleCode) return 0;
  const base = BASE_PRICE[vehicleCode] ?? 250;
  const rate = PER_KM[vehicleCode] ?? 6;
  const from = cities.find((c) => c.name.toLowerCase() === fromCity.toLowerCase());
  const to = cities.find((c) => c.name.toLowerCase() === toCity.toLowerCase());
  let km = 35;
  if (from && to) {
    km = haversine(from.latitude, from.longitude, to.latitude, to.longitude);
  }
  return Math.round(base + km * rate);
}

function BookPageContent() {
  const router = useRouter();
  const { token } = useAuth();
  const { t } = useLang();

  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState<VehicleType[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType | null>(null);

  const [cities, setCities] = useState<City[]>([]);
  const [pickupCity, setPickupCity] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffCity, setDropoffCity] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');

  const [bookingMode, setBookingMode] = useState<'quick' | 'selective'>('quick');
  const [userPrice, setUserPrice] = useState('');
  const [cargoType, setCargoType] = useState('General Goods');
  const [preferredDate, setPreferredDate] = useState(new Date().toISOString().split('T')[0]);
  const [preferredTime, setPreferredTime] = useState('10:00 AM');

  const [availableProviders, setAvailableProviders] = useState<Array<{ id: number; display_name: string }>>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successJob, setSuccessJob] = useState<any | null>(null);

  // Load vehicles and cities
  useEffect(() => {
    let active = true;
    Promise.all([getVehicleTypes(), getCities()])
      .then(([vList, cList]) => {
        if (active) {
          setVehicles(vList || []);
          if (vList && vList.length > 0 && !selectedVehicle) {
            setSelectedVehicle(vList[0]);
          }
          setCities(cList || []);
        }
      })
      .catch((err) => {
        if (active) setError('Failed to initialize booking data');
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch providers when vehicle changes
  useEffect(() => {
    if (!selectedVehicle) return;
    getProviders(selectedVehicle.code)
      .then((provs) => {
        setAvailableProviders(provs || []);
        if (provs && provs.length > 0) {
          setSelectedProviderId(provs[0].id);
        } else {
          setSelectedProviderId(null);
        }
      })
      .catch(() => {
        setAvailableProviders([]);
        setSelectedProviderId(null);
      });
  }, [selectedVehicle]);

  const estimatedTripPrice = selectedVehicle
    ? estimatePrice(selectedVehicle.code, pickupCity, dropoffCity, cities)
    : 0;

  const canProceed = () => {
    switch (step) {
      case 1:
        return selectedVehicle !== null;
      case 2:
        return (
          pickupCity.trim() !== '' &&
          pickupAddress.trim() !== '' &&
          dropoffCity.trim() !== '' &&
          dropoffAddress.trim() !== ''
        );
      case 3:
        return bookingMode !== null;
      case 4:
        if (bookingMode === 'selective') {
          return selectedProviderId !== null;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    setError('');
    if (step === 2) {
      if (pickupCity === dropoffCity && pickupAddress.trim().toLowerCase() === dropoffAddress.trim().toLowerCase()) {
        setError(t('Pickup and drop-off addresses must be different.', 'يجب أن يكون عنوان الاستلام مختلفاً عن عنوان التسليم.'));
        return;
      }
    }
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setError('');
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!token || !selectedVehicle) {
      setError(t('Please log in to submit your booking.', 'يرجى تسجيل الدخول لتقديم طلبك.'));
      return;
    }

    if (bookingMode === 'selective' && !selectedProviderId) {
      setError(t('Please choose a provider for selective booking.', 'يرجى اختيار مزود خدمة للحجز المخصص.'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const idempotencyKey = `booking-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const priceVal = userPrice ? parseFloat(userPrice) : estimatedTripPrice;

      const commonPayload = {
        vehicle_class: selectedVehicle.code,
        pickup: {
          place_id: null,
          address: pickupAddress.trim(),
          city: pickupCity,
          lat: 0,
          lng: 0,
        },
        dropoff: {
          place_id: null,
          address: dropoffAddress.trim(),
          city: dropoffCity,
          lat: 0,
          lng: 0,
        },
        idempotency_key: idempotencyKey,
        requested_min_price: priceVal ? Math.round(priceVal * 0.9) : undefined,
        requested_max_price: priceVal ? Math.round(priceVal * 1.1) : undefined,
      };

      let createdJob: any;
      if (bookingMode === 'quick') {
        createdJob = await createQuickJob(token, commonPayload);
      } else {
        createdJob = await createSelectiveJob(token, {
          ...commonPayload,
          provider_id: selectedProviderId!,
        });
      }

      setSuccessJob(createdJob);
    } catch (err: any) {
      setError(err?.message || 'Failed to create booking request');
    } finally {
      setLoading(false);
    }
  };

  if (successJob) {
    return (
      <div className="min-h-screen bg-white py-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-20 h-20 mx-auto mb-6 bg-green-50 rounded-full flex items-center justify-center text-4xl text-green-600">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('Booking Confirmed!', 'تم تأكيد الحجز بنجاح!')}
          </h2>
          <p className="text-gray-500 mb-6 text-sm">
            {bookingMode === 'quick'
              ? t('Your quick request # has been dispatched to eligible nearby providers.', 'تم إرسال طلبك السريع إلى مزودي الخدمة المتاحين.')
              : t('Your request has been routed to the selected provider.', 'تم إرسال طلبك إلى المزود المختار.')}
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('Job ID', 'رقم الطلب')}</span>
              <strong className="text-gray-900">#{successJob.id}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('Vehicle Class', 'نوع الشاحنة')}</span>
              <strong className="text-gray-900">{successJob.vehicle_class?.toUpperCase()}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('Status', 'الحالة')}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                {successJob.status}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push('/trip')}
            className="w-full py-4 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
            style={{ background: '#e53935' }}
          >
            {t('Track Shipment in Real-Time', 'تتبع الشحنة مباشرة')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="book-page">
      {/* Step Progress Bar */}
      <div className="progress">
        {[
          { num: 1, label: t('Vehicle', 'المركبة') },
          { num: 2, label: t('Locations', 'المواقع') },
          { num: 3, label: t('Mode & Budget', 'الوضع والميزانية') },
          { num: 4, label: t('Confirm', 'التأكيد') },
        ].map((s) => (
          <React.Fragment key={s.num}>
            <div className={`progress-step ${step === s.num ? 'active' : ''}`}>
              <span>{s.num}</span>
              <strong>{s.label}</strong>
            </div>
            {s.num < 4 && <div className="progress-line" />}
          </React.Fragment>
        ))}
      </div>

      <div className="book-layout">
        {/* Left Interactive Booking Form */}
        <div className="book-left">
          {error && (
            <div
              className="mb-4 p-4 rounded-xl text-sm font-medium"
              style={{ background: '#ffebee', border: '1px solid #ffcdd2', color: '#b91c1c' }}
            >
              {error}
            </div>
          )}

          {/* STEP 1: VEHICLE SELECTION */}
          {step === 1 && (
            <section className="section-card">
              <h1>{t('Select Vehicle Type', 'اختر نوع الشاحنة')}</h1>
              <p className="subtitle">{t('Choose the right truck for your cargo weight and dimensions', 'اختر الشاحنة المناسبة لحجم ووزن شحنتك')}</p>

              <div className="vehicle-list">
                {vehicles.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">{t('Loading vehicles...', 'جارٍ تحميل الشاحنات...')}</div>
                ) : (
                  vehicles.map((v) => (
                    <button
                      key={v.code}
                      type="button"
                      className={`vehicle-option ${selectedVehicle?.code === v.code ? 'selected' : ''}`}
                      onClick={() => setSelectedVehicle(v)}
                    >
                      <div className="vehicle-image">
                        <img
                          src={truckImages[v.code] || truckImages.small}
                          alt={v.label}
                        />
                      </div>
                      <div className="vehicle-info">
                        <strong>{v.label}</strong>
                        <span>{v.capacity || 'Standard capacity'}</span>
                        <small>{v.description || 'Reliable freight hauling'}</small>
                      </div>
                      <div className="vehicle-price-tag">
                        <strong>
                          {estimatePrice(v.code, pickupCity, dropoffCity, cities)} EGP
                        </strong>
                        <small>{t('est. trip rate', 'السعر التقديري')}</small>
                      </div>
                      <span className="radio">{selectedVehicle?.code === v.code ? 'ON' : 'OFF'}</span>
                    </button>
                  ))
                )}
              </div>

              <div className="step-nav">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  {t('Continue to Locations >>', 'المتابعة للمواقع >>')}
                </button>
              </div>
            </section>
          )}

          {/* STEP 2: LOCATIONS & ADDRESSES */}
          {step === 2 && (
            <section className="section-card">
              <h1>{t('Pickup & Drop-off Locations', 'مواقع الاستلام والتسليم')}</h1>
              <p className="subtitle">{t('Specify city and detailed street addresses for precise routing', 'حدد المدينة والعنوان بالتفصيل لضمان مسار دقيق')}</p>

              <div className="location-form">
                {/* Pickup Block */}
                <div className="location-block">
                  <label>
                    <span>{t('Pickup City', 'مدينة الاستلام')}</span>
                  </label>
                  <select
                    value={pickupCity}
                    onChange={(e) => setPickupCity(e.target.value)}
                    className="w-full p-3 border rounded-lg bg-white text-gray-900"
                  >
                    <option value="">{t('Select pickup city', 'اختر مدينة الاستلام')}</option>
                    {cities.map((c) => (
                      <option key={`p-${c.id}`} value={c.name}>
                        {c.name} {c.nameAr ? `(${c.nameAr})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="location-block">
                  <label>
                    <span>{t('Pickup Detailed Address', 'عنوان الاستلام بالتفصيل')}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={t('Street name, building number, landmark', 'اسم الشارع، رقم المبنى، علامة مميزة')}
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                  />
                </div>

                <hr className="location-separator" />

                {/* Dropoff Block */}
                <div className="location-block">
                  <label>
                    <span>{t('Drop-off City', 'مدينة التسليم')}</span>
                  </label>
                  <select
                    value={dropoffCity}
                    onChange={(e) => setDropoffCity(e.target.value)}
                    className="w-full p-3 border rounded-lg bg-white text-gray-900"
                  >
                    <option value="">{t('Select drop-off city', 'اختر مدينة التسليم')}</option>
                    {cities.map((c) => (
                      <option key={`d-${c.id}`} value={c.name}>
                        {c.name} {c.nameAr ? `(${c.nameAr})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="location-block">
                  <label>
                    <span>{t('Drop-off Detailed Address', 'عنوان التسليم بالتفصيل')}</span>
                  </label>
                  <input
                    type="text"
                    placeholder={t('Street name, warehouse number, landmarks', 'اسم الشارع، رقم المستودع، علامات مميزة')}
                    value={dropoffAddress}
                    onChange={(e) => setDropoffAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="step-nav">
                <button type="button" className="ghost-button" onClick={handleBack}>
                  &lt; {t('Back', 'رجوع')}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  {t('Continue to Mode & Budget >>', 'المتابعة للوضع والميزانية >>')}
                </button>
              </div>
            </section>
          )}

          {/* STEP 3: BOOKING MODE & BUDGET */}
          {step === 3 && (
            <section className="section-card">
              <h1>{t('Booking Mode & Details', 'وضع الحجز وتفاصيل الشحنة')}</h1>
              <p className="subtitle">{t('Choose how you want to be matched with providers', 'اختر طريقة مطابقتك مع مزودي الخدمة')}</p>

              {/* Booking Mode Selection */}
              <div className="space-y-3 mb-6">
                <div
                  onClick={() => setBookingMode('quick')}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    bookingMode === 'quick'
                      ? 'border-2 border-red-500 bg-red-50/40 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-gray-900 text-base">
                      ⚡ {t('Quick Request (Automatic Matching)', 'طلب سريع (مطابقة تلقائية)')}
                    </div>
                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        bookingMode === 'quick' ? 'border-red-600 bg-red-600 text-white text-xs' : 'border-gray-300'
                      }`}
                    >
                      {bookingMode === 'quick' ? '✓' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t(
                      'Broadcasts instantly to all available nearby providers. Fastest pickup time.',
                      'يتم الإرسال فوراً لجميع السائقين المتاحين بالقرب منك للحصول على أسرع استجابة.'
                    )}
                  </p>
                </div>

                <div
                  onClick={() => setBookingMode('selective')}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    bookingMode === 'selective'
                      ? 'border-2 border-red-500 bg-red-50/40 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-gray-900 text-base">
                      🎯 {t('Selective Request (Pick Your Provider)', 'طلب مخصص (اختيار المزود بنفسك)')}
                    </div>
                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        bookingMode === 'selective' ? 'border-red-600 bg-red-600 text-white text-xs' : 'border-gray-300'
                      }`}
                    >
                      {bookingMode === 'selective' ? '✓' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t(
                      'Browse and hand-pick an approved provider from our active fleet in Step 4.',
                      'تصفح واختر مزود خدمة معتمد من أسطولنا المتاح في الخطوة القادمة.'
                    )}
                  </p>
                </div>
              </div>

              {/* Price Estimation and Budget Input */}
              <div className="budget-label">
                <div>
                  <strong>{t('Estimated Trip Cost', 'التكلفة التقديرية للرحلة')}</strong>
                </div>
                <small>
                  {selectedVehicle ? `${estimatedTripPrice} EGP` : '—'}
                </small>
              </div>

              <div className="budget-user-input">
                <strong>{t('Offered Price (Optional)', 'السعر المعروض (اختياري)')}</strong>
                <small>{t('Specify the target budget you are willing to pay for this shipment', 'حدد الميزانية المستهدفة التي ترغب في دفعها لهذا الشحن')}</small>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <input
                    type="number"
                    placeholder={estimatedTripPrice ? String(estimatedTripPrice) : '0'}
                    value={userPrice}
                    onChange={(e) => setUserPrice(e.target.value)}
                    style={{
                      width: 150,
                      border: '1px solid #e5e9ef',
                      borderRadius: 8,
                      padding: '12px 14px',
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#e53935',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e53935' }}>EGP</span>
                </div>
              </div>

              {/* Schedule and Cargo */}
              <div className="trip-inputs mt-4">
                <label>
                  <span>{t('Preferred Date', 'التاريخ المفضل')}</span>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                  />
                </label>
                <label>
                  <span>{t('Preferred Time', 'الوقت المفضل')}</span>
                  <select value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)}>
                    <option>08:00 AM</option>
                    <option>10:00 AM</option>
                    <option>12:00 PM</option>
                    <option>02:00 PM</option>
                    <option>04:00 PM</option>
                    <option>06:00 PM</option>
                    <option>08:00 PM</option>
                  </select>
                </label>
                <label>
                  <span>{t('Cargo Classification', 'نوع الحمولة')}</span>
                  <select value={cargoType} onChange={(e) => setCargoType(e.target.value)}>
                    <option>{t('General Goods', 'بضائع عامة')}</option>
                    <option>{t('Furniture & Household', 'أثاث ومقتنيات')}</option>
                    <option>{t('Electronics & Fragile', 'أجهزة إلكترونية ومقتنيات حساسة')}</option>
                    <option>{t('Construction Materials', 'مواد بناء وإنشاءات')}</option>
                    <option>{t('Food & Perishables', 'مواد غذائية')}</option>
                  </select>
                </label>
              </div>

              <div className="step-nav">
                <button type="button" className="ghost-button" onClick={handleBack}>
                  &lt; {t('Back', 'رجوع')}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleNext}
                  disabled={!canProceed()}
                >
                  {t('Continue to Confirmation >>', 'المتابعة للتأكيد >>')}
                </button>
              </div>
            </section>
          )}

          {/* STEP 4: PROVIDER SELECTION & CONFIRMATION */}
          {step === 4 && (
            <section className="section-card">
              <h1>{t('Review & Confirm Booking', 'مراجعة وتأكيد الحجز')}</h1>
              <p className="subtitle">{t('Verify all shipment specifications before finalizing', 'تأكد من جميع مواصفات الشحنة قبل الإرسال')}</p>

              {/* If selective mode, render available provider choices */}
              {bookingMode === 'selective' && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-wider">
                    {t('Select Provider for this Job', 'اختر مزود الخدمة لهذا الطلب')}
                  </h3>
                  {availableProviders.length === 0 ? (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                      {t('No dedicated providers currently available for this vehicle type. You can still proceed with Quick Request.', 'لا يوجد مزودين مخصصين متاحين حالياً لهذا النوع. يمكنك التبديل للطلب السريع.')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableProviders.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProviderId(p.id)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                            selectedProviderId === p.id
                              ? 'border-red-500 bg-red-50/40 text-red-900 font-bold'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">🚚</span>
                            <span>{p.display_name}</span>
                          </div>
                          <span
                            className={`w-4 h-4 rounded-full border ${
                              selectedProviderId === p.id ? 'border-red-600 bg-red-600' : 'border-gray-300'
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Summary Table */}
              <div className="confirm-list">
                <div className="confirm-row">
                  <span>{t('Vehicle Class', 'نوع الشاحنة')}</span>
                  <strong>{selectedVehicle ? selectedVehicle.label : '—'}</strong>
                </div>
                <div className="confirm-row">
                  <span>{t('Pickup Location', 'موقع الاستلام')}</span>
                  <strong>{pickupAddress}, {pickupCity}</strong>
                </div>
                <div className="confirm-row">
                  <span>{t('Drop-off Location', 'موقع التسليم')}</span>
                  <strong>{dropoffAddress}, {dropoffCity}</strong>
                </div>
                <div className="confirm-row">
                  <span>{t('Booking Mode', 'وضع الحجز')}</span>
                  <strong>
                    {bookingMode === 'quick'
                      ? t('Quick Request (Broadcast)', 'طلب سريع (تلقائي)')
                      : t('Selective Request', 'طلب مخصص')}
                  </strong>
                </div>
                {bookingMode === 'selective' && selectedProviderId && (
                  <div className="confirm-row">
                    <span>{t('Selected Provider', 'المزود المختار')}</span>
                    <strong>
                      {availableProviders.find((p) => p.id === selectedProviderId)?.display_name || `#${selectedProviderId}`}
                    </strong>
                  </div>
                )}
                <div className="confirm-row">
                  <span>{t('Schedule', 'الموعد')}</span>
                  <strong>{preferredDate} at {preferredTime}</strong>
                </div>
                <div className="confirm-row">
                  <span>{t('Cargo Type', 'نوع الحمولة')}</span>
                  <strong>{cargoType}</strong>
                </div>
                <div className="confirm-row">
                  <span>{t('Estimated Total', 'السعر التقديري')}</span>
                  <strong>{estimatedTripPrice} EGP</strong>
                </div>
                {userPrice && (
                  <div className="confirm-row">
                    <span>{t('Your Target Price', 'سعرك المستهدف')}</span>
                    <strong style={{ color: '#e53935' }}>{userPrice} EGP</strong>
                  </div>
                )}
              </div>

              <div className="step-nav">
                <button type="button" className="ghost-button" onClick={handleBack} disabled={loading}>
                  &lt; {t('Back', 'رجوع')}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleSubmit}
                  disabled={loading || !canProceed()}
                >
                  {loading ? t('Creating Booking...', 'جارٍ تأكيد الحجز...') : t('Confirm & Dispatch Job', 'تأكيد وإرسال الطلب')}
                </button>
              </div>
            </section>
          )}
        </div>

        {/* Right Interactive Leaflet Map & Reliability Badges */}
        <div className="book-map-section">
          <div className="book-map">
            <TruckMapWithUser vehicleClass={selectedVehicle?.code} />
          </div>
          <div className="security-banner">
            <span>🛡️</span>
            <div>
              <strong>{t('Secure & Monitored Fleet', 'أسطول آمن ومراقب')}</strong>
              <small>
                {t(
                  'Every transporter is vetted with license and background verification. Real-time telemetry included.',
                  'جميع السائقين معتمدون وخاضعون للتحقق. مراقبة حركة الشاحنة وتتبع مباشر متاح للعميل.'
                )}
              </small>
            </div>
            <div className="security-items">
              <span>{t('Live GPS', 'تتبع حي')}</span>
              <span>{t('Instant Dispatch', 'إرسال فوري')}</span>
              <span>{t('Verified Drivers', 'سائقون معتمدون')}</span>
            </div>
          </div>
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