'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';
import RoleGuard from '@/components/RoleGuard';
import { Job } from '@/lib/types';
import { getJobs, cancelJob, subscribeToEvents } from '@/lib/api';

function TripPageContent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const { token } = useAuth();
  const { t } = useLang();

  const loadJobs = async () => {
    if (!token) return;
    try {
      const data = await getJobs(token);
      setJobs(data || []);
      if (data && data.length > 0 && !selectedJobId) {
        setSelectedJobId(data[0].id);
      }
    } catch {
      setError(t('Failed to load trips', 'تعذر تحميل الرحلات'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [token]);

  // Connect to SSE real-time events stream
  useEffect(() => {
    if (!token) return;

    const unsubscribe = subscribeToEvents(
      token,
      (event) => {
        console.log('[SSE Event received]', event);
        // Reload job state when events are received
        loadJobs();
      },
      (err) => {
        console.warn('[SSE Connection error]', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [token]);

  const handleCancelJob = async (jobId: number) => {
    if (!token) return;
    if (!confirm(t('Are you sure you want to cancel this request?', 'هل أنت متأكد من إلغاء هذا الطلب؟'))) return;
    setCancellingId(jobId);
    try {
      await cancelJob(token, jobId);
      await loadJobs();
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to cancel request');
    } finally {
      setCancellingId(null);
    }
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || jobs[0];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#e53935' }} />
      </div>
    );
  }

  return (
    <div className="trip-page">
      <div className="trip-header">
        <div className="trip-title">
          <span>📦</span>
          <div>
            <h1>{t('My Shipments & Trips', 'شحناتي ورحلاتي')}</h1>
            <p>{t('Track your active deliveries and review completed shipments', 'تتبع شحناتك النشطة وراجع تفاصيل الرحلات السابقة')}</p>
          </div>
        </div>
      </div>

      {error && (
        <div
          className="section-card mb-4 p-4 rounded-xl text-sm font-medium"
          style={{ background: '#ffebee', border: '1px solid #ffcdd2', color: '#b91c1c' }}
        >
          {error}
        </div>
      )}

      {jobs.length > 0 ? (
        <div className="trip-layout">
          {/* Left Column: List of Jobs */}
          <section className="trip-list-card">
            <div className="trip-tabs">
              <button className="active">
                {t('All Trips', 'جميع الرحلات')} ({jobs.length})
              </button>
            </div>
            <div className="trip-list">
              {jobs.map((job) => {
                const isSelected = selectedJob?.id === job.id;
                return (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`trip-item ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="trip-item-image">🚚</div>
                    <div className="trip-item-content">
                      <div className="trip-item-top">
                        <strong>#{job.id}</strong>
                        <span className={`status ${job.status.toLowerCase().replace(/_/g, '-')}`}>
                          {job.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="trip-route text-xs">
                        {job.pickup_address || 'Pickup'} &rarr; {job.dropoff_address || 'Drop-off'}
                      </div>
                      <small className="uppercase font-semibold text-gray-500">
                        {job.vehicle_class} {job.approved_price ? `· ${job.approved_price} EGP` : ''}
                      </small>
                    </div>
                    <span className="trip-arrow">&gt;</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Right Column: Selected Trip Details */}
          {selectedJob && (
            <section className="trip-details-area">
              <div className="trip-map rounded-2xl overflow-hidden shadow-sm border border-gray-200">
                <iframe
                  title="Trip route map"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=31.05%2C29.85%2C31.55%2C30.25&layer=mapnik"
                  style={{ width: '100%', height: '240px', border: 0 }}
                />
              </div>

              <div className="trip-detail-card mt-4">
                <div className="detail-tabs">
                  <button className="active">{t('Trip Overview', 'تفاصيل الشحنة')}</button>
                </div>

                <div className="detail-main">
                  <div className="driver-section">
                    <div className="driver-truck">🚚</div>
                    <div>
                      <strong>
                        {t('Request', 'طلب')} #{selectedJob.id}
                      </strong>
                      <small className="uppercase block font-bold text-gray-600">
                        {selectedJob.vehicle_class} · {selectedJob.truck_plate || t('Truck Assigned', 'شاحنة معتمدة')}
                      </small>
                    </div>
                    <div className="driver-profile">
                      <div className="driver-avatar">
                        {selectedJob.provider_name ? selectedJob.provider_name[0].toUpperCase() : 'P'}
                      </div>
                      <div>
                        <strong>{selectedJob.provider_name || t('Assigned Provider', 'مزود الخدمة')}</strong>
                        <small>{t('Authorized Transporter', 'ناقل معتمد')}</small>
                      </div>
                    </div>
                  </div>

                  <div className="trip-information">
                    <div>
                      <small>{t('Status', 'الحالة')}</small>
                      <strong className="blue-status uppercase">
                        {selectedJob.status.replace(/_/g, ' ')}
                      </strong>
                    </div>
                    <div>
                      <small>{t('Agreed Total', 'المبلغ الإجمالي')}</small>
                      <strong>
                        {selectedJob.approved_price ? `${selectedJob.approved_price} EGP` : t('Pending', 'قيد التأكيد')}
                      </strong>
                    </div>
                  </div>
                </div>

                <aside className="trip-location-card">
                  <div className="location-detail">
                    <span className="green-pin">📍</span>
                    <div>
                      <strong>{t('Pickup Location', 'موقع الاستلام')}</strong>
                      <span>{selectedJob.pickup_address || '—'}</span>
                      <small>{selectedJob.pickup_city || 'Egypt'}</small>
                    </div>
                  </div>

                  <div className="location-vertical-line" />

                  <div className="location-detail">
                    <span className="red-pin">🏁</span>
                    <div>
                      <strong>{t('Drop-off Location', 'موقع التسليم')}</strong>
                      <span>{selectedJob.dropoff_address || '—'}</span>
                      <small>{selectedJob.dropoff_city || 'Egypt'}</small>
                    </div>
                  </div>

                  {selectedJob.status === 'pending' && (
                    <button
                      onClick={() => handleCancelJob(selectedJob.id)}
                      disabled={cancellingId === selectedJob.id}
                      className="w-full mt-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold text-sm hover:bg-red-100 transition-colors"
                    >
                      {cancellingId === selectedJob.id
                        ? t('Cancelling...', 'جارٍ الإلغاء...')
                        : t('Cancel Booking Request', 'إلغاء طلب الحجز')}
                    </button>
                  )}
                </aside>
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="recent-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
          <h3 className="font-bold text-gray-800 text-lg mb-1">{t('No active shipments found', 'لا توجد شحنات حالية')}</h3>
          <p style={{ color: '#8992a2', marginBottom: '20px' }}>
            {t('You have not created any shipment requests yet.', 'لم تقم بإنشاء أي طلبات شحن بعد.')}
          </p>
          <a
            href="/book"
            className="inline-block px-6 py-3 text-white rounded-xl font-bold shadow-md hover:opacity-90 transition-opacity"
            style={{ background: '#e53935' }}
          >
            {t('Book a Truck Now', 'احجز شاحنة الآن')}
          </a>
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