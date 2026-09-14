'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import RoleGuard from '@/components/RoleGuard';
import { Job } from '@/lib/types';
import { getJobs, cancelJob } from '@/lib/api';

function TripPageContent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAuth();

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const data = await getJobs(token);
        if (active) setJobs(data);
      } catch {
        if (active) setError('Failed to load jobs');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="trip-page">
      <div className="trip-header">
        <div className="trip-title">
          <span>O</span>
          <div>
            <h1>My Trips</h1>
            <p>Track your shipments and view trip details</p>
          </div>
        </div>
      </div>

      {error && <div className="section-card" style={{ background: '#ffebee', border: '1px solid #ffcdd2', color: '#b91c1c', padding: '12px', borderRadius: '10px', marginBottom: '18px' }}>{error}</div>}

      {jobs.length > 0 ? (
        <div className="trip-layout">
          <section className="trip-list-card">
            <div className="trip-tabs">
              <button className="active">All Trips ({jobs.length})</button>
            </div>
            <div className="trip-list">
              {jobs.map((job) => (
                <button className="trip-item selected" key={job.id}>
                  <div className="trip-item-image">🚚</div>
                  <div className="trip-item-content">
                    <div className="trip-item-top">
                      <strong>#{job.id}</strong>
                      <span className={`status ${job.status.toLowerCase().replace(/_/g, '-')}`}>{job.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="trip-route">A {job.pickup_address || 'Pickup'}&gt;A {job.dropoff_address || 'Drop-off'}</div>
                    <small>T {job.vehicle_class || 'Truck'}</small>
                  </div>
                  <span className="trip-arrow">&gt;</span>
                </button>
              ))}
            </div>
          </section>
          <section className="trip-details-area">
            <div className="trip-map">
              <iframe title="Trip route map" src="https://www.openstreetmap.org/export/embed.html?bbox=31.05%2C29.85%2C31.55%2C30.25&layer=mapnik" />
            </div>
            <div className="trip-detail-card">
              <div className="detail-tabs"><button className="active">Trip Details</button></div>
              <div className="detail-main">
                <div className="driver-section">
                  <div className="driver-truck">🚚</div>
                  <div><strong>Request #{jobs[0].id}</strong><small>{jobs[0].vehicle_class || 'Truck'}</small></div>
                  <div className="driver-profile"><div className="driver-avatar">U</div><div><strong>Customer</strong><small>Driver</small></div><button>CALL</button></div>
                </div>
                <div className="trip-information">
                  <div><small>Status</small><strong className="blue-status">{jobs[0].status.replace(/_/g, ' ')}</strong></div>
                  <div><small>Estimated Arrival</small><strong>-</strong></div>
                </div>
              </div>
              <aside className="trip-location-card">
                <div className="location-detail"><span className="green-pin">G</span><div><strong>Pickup Location</strong><span>{jobs[0].pickup_address || '-'}</span><small>Cairo Governorate, Egypt</small></div></div>
                <div className="location-vertical-line" />
                <div className="location-detail"><span className="red-pin">R</span><div><strong>Drop-off Location</strong><span>{jobs[0].dropoff_address || '-'}</span><small>Giza Governorate, Egypt</small></div></div>
                <button className="contact-driver">Contact Driver</button>
              </aside>
            </div>
          </section>
        </div>
      ) : (
        <div className="recent-card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>BOX</div>
          <p style={{ color: '#8992a2' }}>No requests yet.</p>
        </div>
      )}
    </div>
  );
}

export default function TripPage() {
  return (
    <RoleGuard allowedRoles={['customer']}>
      <TripPageContent />
    </RoleGuard>
  );
}