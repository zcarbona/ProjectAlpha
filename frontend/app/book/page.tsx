'use client';

import React, { useEffect, useState } from 'react';
import { getVehicleTypes, getCities } from '@/lib/api';
import dynamicImport from 'next/dynamic';

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

// Pricing formula: base + distance * rate per vehicle class
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

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Cairo: { lat: 30.0444, lng: 31.2357 },
  Giza: { lat: 30.0131, lng: 31.2089 },
  Alexandria: { lat: 31.2001, lng: 29.9187 },
  Luxor: { lat: 25.6872, lng: 32.6396 },
  Aswan: { lat: 24.0889, lng: 32.8998 },
  'Port Said': { lat: 31.2653, lng: 32.3019 },
  'Nasr City': { lat: 30.0561, lng: 31.3431 },
  Maadi: { lat: 29.9647, lng: 31.2114 },
  Heliopolis: { lat: 30.1219, lng: 31.3167 },
  'New Cairo': { lat: 30.0131, lng: 31.4044 },
  Shorouk: { lat: 30.0833, lng: 31.3167 },
  Madinetaty: { lat: 30.0000, lng: 31.4167 },
  Badr: { lat: 30.1000, lng: 31.5833 },
  'Ain Shams': { lat: 30.1167, lng: 31.2667 },
  'Zahraa El Maadi': { lat: 29.9500, lng: 31.2000 },
  Mokattam: { lat: 30.0167, lng: 31.2667 },
  Helwan: { lat: 29.8667, lng: 31.2333 },
  Obour: { lat: 30.1167, lng: 31.4000 },
  'El Marg': { lat: 30.1500, lng: 31.3333 },
  Qalyubia: { lat: 30.2167, lng: 31.1667 },
  '6th October City': { lat: 29.9667, lng: 31.0333 },
  Haram: { lat: 29.9833, lng: 31.1667 },
  'Sheikh Zayed': { lat: 29.9833, lng: 31.0333 },
  Dokki: { lat: 30.0167, lng: 31.2000 },
  Agouza: { lat: 30.0167, lng: 31.1833 },
  Mohandiseen: { lat: 30.0167, lng: 31.1333 },
  Imbaba: { lat: 30.0333, lng: 31.1333 },
  Warraq: { lat: 30.0333, lng: 31.1000 },
  'Al Amiriya': { lat: 30.0333, lng: 31.0833 },
  'El Mansouriya': { lat: 30.0333, lng: 31.0667 },
  'Saqia El Gharbeya': { lat: 30.0333, lng: 31.0500 },
};

function toRad(v: number) { return (v * Math.PI) / 180; }

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cityCoords(name: string, cities: any[]): { lat: number; lng: number } | null {
  const c = cities.find((x) => x.name === name);
  if (c) return { lat: c.latitude, lng: c.longitude };
  return CITY_COORDS[name] || null;
}

function estimatePrice(vehicleCode: string, pickup: string, dropoff: string, cities: any[]): number {
  if (!vehicleCode) return 0;
  const base = BASE_PRICE[vehicleCode] ?? 250;
  const rate = PER_KM[vehicleCode] ?? 6;
  const from = cityCoords(pickup, cities);
  const to = cityCoords(dropoff, cities);
  let km = 0;
  if (from && to) {
    km = haversine(from.lat, from.lng, to.lat, to.lng);
  } else if (pickup && dropoff && pickup !== dropoff) {
    km = 40;
  }
  return Math.round(base + km * rate);
}

function priceBreakdown(vehicleCode: string, pickup: string, dropoff: string, cities: any[]) {
  if (!vehicleCode) return null;
  const base = BASE_PRICE[vehicleCode] ?? 250;
  const rate = PER_KM[vehicleCode] ?? 6;
  const from = cityCoords(pickup, cities);
  const to = cityCoords(dropoff, cities);
  const km = from && to ? haversine(from.lat, from.lng, to.lat, to.lng) : 0;
  return { base, rate, km, total: Math.round(base + km * rate) };
}

export default function BookPage() {
  const [selected, setSelected] = useState(0);
  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [pickupGov, setPickupGov] = useState('');
  const [pickupCity, setPickupCity] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffGov, setDropoffGov] = useState('');
  const [dropoffCity, setDropoffCity] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [userPrice, setUserPrice] = useState('');
  const [preferredDate, setPreferredDate] = useState('2025-03-15');
  const [preferredTime, setPreferredTime] = useState('10:00 AM');
  const [cargoType, setCargoType] = useState('General Goods');

  useEffect(() => {
    let active = true;
    Promise.all([getVehicleTypes(), getCities()])
      .then(([v, c]) => {
        if (active) {
          setVehicles(v || []);
          setCities(c || []);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const truck = vehicles[selected];

  const handleNext = () => {
    if (step === 1 && !truck) return;
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const avgPrice = (range?: string | null) => {
    if (!range) return '—';
    const parts = range.split(/[–-]/).map((p) => parseInt(p.trim(), 10));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return Math.round((parts[0] + parts[1]) / 2);
    }
    return parts[0] || '—';
  };

  const totalBudget = truck
    ? estimatePrice(truck.code, pickupCity || pickupGov, dropoffCity || dropoffGov, cities)
    : 0;

  return (
    <div className="book-page">
      <div className="progress">
        {[
          { num: 1, label: 'Vehicle' },
          { num: 2, label: 'Locations' },
          { num: 3, label: 'Budget' },
          { num: 4, label: 'Confirm' },
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
        <div className="book-left">
          {step === 1 && (
            <section className="section-card">
              <h1>Select Vehicle Type</h1>
              <p className="subtitle">Choose the right truck for your cargo needs</p>
              <div className="vehicle-list">
                {vehicles.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">Loading vehicles...</div>
                ) : (
                  vehicles.map((vehicle, index) => (
                    <button
                      key={vehicle.code}
                      className={`vehicle-option ${selected === index ? 'selected' : ''}`}
                      onClick={() => setSelected(index)}
                    >
                      <div className="vehicle-image">
                        <img src={truckImages[vehicle.code] || truckImages.small} alt={vehicle.label} />
                      </div>
                      <div className="vehicle-info">
                        <strong>{vehicle.label}</strong>
                        <span>{vehicle.capacity || 'Standard capacity'}</span>
                        <small>truck {vehicle.description || 'Available'}</small>
                      </div>
                      <div className="vehicle-price-tag">
                        <strong>{estimatePrice(vehicle.code, pickupCity || pickupGov, dropoffCity || dropoffGov, cities)} EGP</strong>
                        <small>est. per trip</small>
                      </div>
                      <span className="radio">{selected === index ? 'ON' : 'OFF'}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="step-nav">
                <button className="primary-button" onClick={handleNext} disabled={!truck}>
                  Next &gt;&gt;
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="section-card">
              <h1>Pickup &amp; Drop-off Locations</h1>
              <p className="subtitle">Select the government and city for pickup and drop-off</p>
              <div className="location-form">
                <div className="location-block">
                  <label><span>Pickup Government</span></label>
                  <select value={pickupGov} onChange={(e) => { setPickupGov(e.target.value); setPickupCity(''); }}>
                    <option value="">Select government</option>
                    <option value="Cairo">Cairo</option>
                    <option value="Giza">Giza</option>
                    <option value="Alexandria">Alexandria</option>
                    <option value="Port Said">Port Said</option>
                    <option value="Aswan">Aswan</option>
                    <option value="Luxor">Luxor</option>
                  </select>
                </div>
                <div className="location-block">
                  <label><span>Pickup City</span></label>
                  <select value={pickupCity} onChange={(e) => setPickupCity(e.target.value)}>
                    <option value="">Select city</option>
                    {pickupGov === 'Cairo' && (
                      <>
                        <option value="Cairo">Cairo</option>
                        <option value="Nasr City">Nasr City</option>
                        <option value="Maadi">Maadi</option>
                        <option value="Heliopolis">Heliopolis</option>
                        <option value="New Cairo">New Cairo</option>
                        <option value="Shorouk">Shorouk</option>
                        <option value="Madinetaty">Madinetaty</option>
                        <option value="Badr">Badr</option>
                        <option value="Ain Shams">Ain Shams</option>
                        <option value="Zahraa El Maadi">Zahraa El Maadi</option>
                        <option value="Mokattam">Mokattam</option>
                        <option value="Helwan">Helwan</option>
                        <option value="6th October City">6th October City</option>
                        <option value="Obour">Obour</option>
                        <option value="El Marg">El Marg</option>
                        <option value="Qalyubia">Qalyubia</option>
                      </>
                    )}
                    {pickupGov === 'Giza' && (
                      <>
                        <option value="Giza">Giza</option>
                        <option value="6th October City">6th October City</option>
                        <option value="Haram">Haram</option>
                        <option value="Sheikh Zayed">Sheikh Zayed</option>
                        <option value="Dokki">Dokki</option>
                        <option value="Agouza">Agouza</option>
                        <option value="Mohandiseen">Mohandiseen</option>
                        <option value="Imbaba">Imbaba</option>
                        <option value="Warraq">Warraq</option>
                        <option value="Al Amiriya">Al Amiriya</option>
                        <option value="El Mansouriya">El Mansouriya</option>
                        <option value="Saqia El Gharbeya">Saqia El Gharbeya</option>
                      </>
                    )}
                    {cities
                      .filter((c) => c.name === pickupGov)
                      .map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                  </select>
                </div>
                <div className="location-block">
                  <label><span>Pickup Address Details</span></label>
                  <input
                    type="text"
                    placeholder="Street name, building number, landmarks"
value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                />
              </div>

              <hr className="location-separator" />

              <div className="location-block">
                  <label><span>Drop-off Government</span></label>
                  <select value={dropoffGov} onChange={(e) => { setDropoffGov(e.target.value); setDropoffCity(''); }}>
                    <option value="">Select government</option>
                    <option value="Cairo">Cairo</option>
                    <option value="Giza">Giza</option>
                    <option value="Alexandria">Alexandria</option>
                    <option value="Port Said">Port Said</option>
                    <option value="Aswan">Aswan</option>
                    <option value="Luxor">Luxor</option>
                  </select>
                </div>
                <div className="location-block">
                  <label><span>Drop-off City</span></label>
                  <select value={dropoffCity} onChange={(e) => setDropoffCity(e.target.value)}>
                    <option value="">Select city</option>
                    {dropoffGov === 'Cairo' && (
                      <>
                        <option value="Cairo">Cairo</option>
                        <option value="Nasr City">Nasr City</option>
                        <option value="Maadi">Maadi</option>
                        <option value="Heliopolis">Heliopolis</option>
                        <option value="New Cairo">New Cairo</option>
                        <option value="Shorouk">Shorouk</option>
                        <option value="Madinetaty">Madinetaty</option>
                        <option value="Badr">Badr</option>
                        <option value="Ain Shams">Ain Shams</option>
                        <option value="Zahraa El Maadi">Zahraa El Maadi</option>
                        <option value="Mokattam">Mokattam</option>
                        <option value="Helwan">Helwan</option>
                        <option value="Obour">Obour</option>
                        <option value="El Marg">El Marg</option>
                      </>
                    )}
                    {dropoffGov === 'Giza' && (
                      <>
                        <option value="Giza">Giza</option>
                        <option value="6th October City">6th October City</option>
                        <option value="Haram">Haram</option>
                        <option value="Sheikh Zayed">Sheikh Zayed</option>
                        <option value="Dokki">Dokki</option>
                        <option value="Agouza">Agouza</option>
                        <option value="Mohandiseen">Mohandiseen</option>
                        <option value="Imbaba">Imbaba</option>
                        <option value="Warraq">Warraq</option>
                        <option value="Al Amiriya">Al Amiriya</option>
                      </>
                    )}
                    {cities
                      .filter((c) => c.name === dropoffGov)
                      .map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                  </select>
                </div>
                <div className="location-block">
                  <label><span>Drop-off Address Details</span></label>
                  <input
                    type="text"
                    placeholder="Street name, building number, landmarks"
                    value={dropoffAddress}
                    onChange={(e) => setDropoffAddress(e.target.value)}
                  />
                </div>
              </div>
              <div className="step-nav">
                <button className="ghost-button" onClick={handleBack}>&lt; Back</button>
                <button className="primary-button" onClick={handleNext}>Next &gt;&gt;</button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="section-card">
              <h1>Budget &amp; Schedule</h1>
              <p className="subtitle">Set your preferred date, time and cargo details</p>
              <div className="budget-label">
                <div>
                  <strong>Estimated Amount to Pay</strong>
                </div>
                <small>You will pay: {truck ? `${totalBudget} EGP` : '—'}</small>
              </div>
              <div className="budget-user-input">
                <strong>How much will you pay?</strong>
                <small>Enter the amount you are willing to pay for this trip</small>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <input
                    type="number"
                    placeholder="0"
                    value={userPrice}
                    onChange={(e) => setUserPrice(e.target.value)}
                    style={{
                      width: 140,
                      border: '1px solid #e5e9ef',
                      borderRadius: 8,
                      padding: '12px 14px',
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#ed1c24',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#ed1c24' }}>EGP</span>
                </div>
              </div>
              <div className="trip-inputs">
                <label><span>Preferred Date</span><input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} /></label>
                <label><span>Preferred Time</span><select value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)}><option>08:00 AM</option><option>09:00 AM</option><option>10:00 AM</option><option>11:00 AM</option><option>12:00 PM</option><option>01:00 PM</option><option>02:00 PM</option><option>03:00 PM</option><option>04:00 PM</option><option>05:00 PM</option><option>06:00 PM</option><option>07:00 PM</option><option>08:00 PM</option></select></label>
                <label><span>Cargo Type</span><select value={cargoType} onChange={(e) => setCargoType(e.target.value)}><option>General Goods</option><option>Furniture</option><option>Electronics</option><option>Construction</option></select></label>
              </div>
              <div className="step-nav">
                <button className="ghost-button" onClick={handleBack}>&lt; Back</button>
                <button className="primary-button" onClick={handleNext}>Next &gt;&gt;</button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="section-card">
              <h1>Confirm Booking</h1>
              <p className="subtitle">Review your booking details</p>
              <div className="confirm-list">
                <div className="confirm-row"><span>Vehicle</span><strong>{truck ? truck.label : '—'}</strong></div>
                <div className="confirm-row"><span>Pickup City</span><strong>{pickupCity || pickupGov || '—'}</strong></div>
                <div className="confirm-row"><span>Pickup Address</span><strong>{pickupAddress || '—'}</strong></div>
                <div className="confirm-row"><span>Drop-off City</span><strong>{dropoffCity || dropoffGov || '—'}</strong></div>
                <div className="confirm-row"><span>Drop-off Address</span><strong>{dropoffAddress || '—'}</strong></div>
                <div className="confirm-row"><span>Preferred Date</span><strong>{preferredDate || '—'}</strong></div>
                <div className="confirm-row"><span>Preferred Time</span><strong>{preferredTime || '—'}</strong></div>
                <div className="confirm-row"><span>Cargo Type</span><strong>{cargoType || '—'}</strong></div>
                <div className="confirm-row"><span>Total Budget</span><strong>{truck ? `${totalBudget} EGP` : '—'}</strong></div>
                {userPrice && (
                  <div className="confirm-row"><span>You Will Pay</span><strong>{userPrice} EGP</strong></div>
                )}
              </div>
              <div className="step-nav">
                <button className="ghost-button" onClick={handleBack}>&lt; Back</button>
                <button className="primary-button" onClick={() => {}}>Confirm</button>
              </div>
            </section>
          )}
        </div>

        <div className="book-map-section">
          <div className="book-map">
            <TruckMapWithUser vehicleClass={truck?.code} />
          </div>
          <div className="security-banner">
            <span>V</span>
            <div><strong>Secure &amp; Reliable</strong><small>All drivers are verified and tracked in real-time for your safety.</small></div>
            <div className="security-items"><span>Live Tracking</span><span>24/7 Support</span><span>Insurance Coverage</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}