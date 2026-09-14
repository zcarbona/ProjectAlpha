'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getTrucks, getUserStats, getJobs } from '@/lib/api';
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

export default function HomePage() {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [trucks, setTrucks] = useState<any[]>([]);
  const [stats, setStats] = useState<{ trips: number; rating: number; savedEGP: number } | null>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user) router.push('/login');
      else if (user.role === 'provider') router.push('/provider');
      else if (user.role === 'admin') router.push('/admin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const load = async () => {
      try {
        const [truckData, statsData, jobData] = await Promise.all([
          getTrucks(),
          getUserStats(token).catch(() => null),
          getJobs(token).catch(() => []),
        ]);
        if (active) {
          setTrucks(truckData || []);
          setStats(statsData);
          setRecentJobs((jobData || []).slice(0, 4));
        }
      } catch {
        // ignore
      } finally {
        if (active) setDataLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [token]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <div className="hero-brand">
            <span className="hero-logo">N</span>
            <span>Naql</span>
          </div>
          <h1>Your Truck. Our Network.</h1>
          <p>
            Quick, safe and reliable truck transportation
            <br />
            for your business and personal needs.
          </p>
          <a href="/book" className="primary-button">Book a Truck &gt;</a>
        </div>
        <div className="hero-truck">🚚</div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🚚</div>
          <div><strong>{trucks.length}</strong><span>Active Trucks</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👤</div>
          <div><strong>{stats?.trips ?? 0}</strong><span>Your Trips</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✓</div>
          <div><strong>{stats?.rating ?? 0} ★</strong><span>Your Rating</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">★</div>
          <div><strong>{stats?.savedEGP ?? 0} EGP</strong><span>Saved</span></div>
        </div>
      </section>

      <div className="home-grid">
        <div>
          <section className="section-card">
            <div className="section-header">
              <div>
                <h2>Available Trucks</h2>
                <p>Choose the right truck for your cargo</p>
              </div>
              <a href="/book">View All &gt;</a>
            </div>
            <div className="truck-grid">
              {dataLoading ? (
                <div className="text-center py-10 text-gray-400 col-span-4">Loading trucks...</div>
              ) : trucks.length === 0 ? (
                <div className="text-center py-10 text-gray-400 col-span-4">No trucks available</div>
              ) : (
                trucks.map((truck) => (
                  <div className="truck-card" key={truck.id}>
                    <div className="truck-image">
                      <img src={truckImages[truck.vehicle_class] || truckImages.small} alt={truck.vehicle_class} />
                    </div>
                    <h3>{truck.vehicle_class.toUpperCase()} Truck</h3>
                    <p className="capacity">{truck.capacity || 'Standard'}</p>
                    <p className="truck-type">Plate: {truck.plate_number || 'N/A'}</p>
                    <a href="/book" className="truck-button">Book Now</a>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="features-card">
            <div className="feature"><span>V</span><div><strong>Safe &amp; Secure</strong><small>Verified drivers and vehicles</small></div></div>
            <div className="feature"><span>C</span><div><strong>Real-Time Tracking</strong><small>Track your truck live</small></div></div>
            <div className="feature"><span>H</span><div><strong>24/7 Support</strong><small>We are here to help</small></div></div>
            <div className="feature"><span>R</span><div><strong>Flexible Payments</strong><small>Multiple payment methods</small></div></div>
          </section>
        </div>

        <aside className="home-right">
          <section className="map-card">
            <div className="section-header">
              <h2>Live Truck Tracking</h2>
              <span className="online">{trucks.length} trucks online</span>
            </div>
            <div className="home-map">
              <TruckMapWithUser />
            </div>
          </section>

          <section className="recent-card">
            <div className="section-header">
              <h2>Recent Bookings</h2>
              <a href="/trip">View All &gt;</a>
            </div>
            {recentJobs.length === 0 ? (
              <p className="text-center text-gray-400 py-4">No bookings yet</p>
            ) : (
              recentJobs.map((job) => (
                <a href="/trip" className="booking-row" key={job.id}>
                  <span className="booking-icon"><img src={truckImages[job.vehicle_class] || truckImages.small} alt={job.vehicle_class} /></span>
                  <div className="booking-info"><strong>#{job.id} {job.vehicle_class}</strong><small>{job.pickup_address || 'Pickup'} - {job.dropoff_address || 'Dropoff'}</small></div>
                  <span className={`status ${job.status.toLowerCase().replace(/_/g, '-')}`}>{job.status.replace(/_/g, ' ')}</span>
                  <small>Just now</small>
                  <span>&gt;</span>
                </a>
              ))
            )}
          </section>
        </aside>
      </div>

      <section className="driver-cta">
        <div>
          <span>🚚</span>
          <div><strong>Become a Driver</strong><small>Join our network and start earning today</small></div>
        </div>
        <a href="/register"><button>&gt;</button></a>
      </section>
    </div>
  );
}