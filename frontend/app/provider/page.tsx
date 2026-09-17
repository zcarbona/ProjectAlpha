'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';
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
  updateProviderAvailability,
} from '@/lib/api';

type Tab = 'requests' | 'active_jobs' | 'trucks' | 'fleet';

function ProviderDashboard() {
  const [tab, setTab] = useState<Tab>('requests');
  const [fleet, setFleet] = useState<FleetItem[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [requests, setRequests] = useState<Job[]>([]);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Modal for truck assignment during acceptance
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<number | 0>(0);
  const [showTruckModal, setShowTruckModal] = useState(false);

  const { token, user } = useAuth();
  const { t } = useLang();

  const loadAll = async () => {
    if (!token) return;
    try {
      const results = await Promise.allSettled([
        getProviderFleet(token),
        getProviderTrucks(token),
        getProviderJobs(token),
        getAvailableRequests(token),
      ]);

      if (results[0].status === 'fulfilled') setFleet(results[0].value || []);
      if (results[1].status === 'fulfilled') setTrucks(results[1].value || []);
      if (results[2].status === 'fulfilled') setJobs(results[2].value || []);
      if (results[3].status === 'fulfilled') setRequests(results[3].value || []);
    } catch {
      setError('Failed to load some provider data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [token]);

  const handleToggleAvailability = async () => {
    if (!token) return;
    const nextVal = !isAvailable;
    try {
      await updateProviderAvailability(token, nextVal);
      setIsAvailable(nextVal);
    } catch (err) {
      alert('Failed to update availability');
    }
  };

  const handleAcceptClick = (jobId: number) => {
    setSelectedRequestId(jobId);
    // Auto select first eligible and active truck
    const eligibleTruck = trucks.find((trk) => trk.is_active);
    setSelectedTruckId(eligibleTruck ? eligibleTruck.id : 0);
    setShowTruckModal(true);
  };

  const handleConfirmAccept = async () => {
    if (!token || !selectedRequestId || !selectedTruckId) {
      alert(t('Please select a truck to accept this job.', 'يرجى اختيار شاحنة لقبول هذا الطلب.'));
      return;
    }
    setActionLoading(true);
    try {
      await acceptJob(token, selectedRequestId, selectedTruckId);
      setShowTruckModal(false);
      setSelectedRequestId(null);
      setSelectedTruckId(0);
      await loadAll();
      setTab('active_jobs');
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to accept job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async (jobId: number) => {
    if (!token) return;
    if (!confirm(t('Are you sure you want to decline this job?', 'هل أنت متأكد من رفض هذا الطلب؟'))) return;
    try {
      await declineJob(token, jobId);
      await loadAll();
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to decline job');
    }
  };

  const handleStartTrip = async (jobId: number) => {
    if (!token) return;
    setActionLoading(true);
    try {
      await startJob(token, jobId);
      await loadAll();
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to start trip');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTrip = async (jobId: number) => {
    if (!token) return;
    if (!confirm(t('Confirm shipment delivery and complete trip?', 'تأكيد تسليم الشحنة وإنهاء الرحلة؟'))) return;
    setActionLoading(true);
    try {
      await completeJob(token, jobId);
      await loadAll();
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to complete trip');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTruck = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    const form = e.currentTarget;
    const plateNumber = (form.elements.namedItem('plateNumber') as HTMLInputElement).value;
    const vehicleClass = (form.elements.namedItem('vehicleClass') as HTMLSelectElement).value;
    const capacity = (form.elements.namedItem('capacity') as HTMLInputElement).value;

    try {
      await createProviderTruck(token, { plate_number: plateNumber, vehicle_class: vehicleClass, capacity });
      form.reset();
      loadAll();
    } catch (err: any) {
      alert(err instanceof Error ? err.message : 'Failed to create truck');
    }
  };

  const handleToggleTruckActive = async (truckId: number, isActive: boolean) => {
    if (!token) return;
    try {
      await updateProviderTruck(token, truckId, { is_active: isActive });
      loadAll();
    } catch {
      alert('Failed to update truck status');
    }
  };

  const handleDeleteTruck = async (truckId: number) => {
    if (!token || !confirm(t('Delete this truck?', 'هل تريد حذف هذه الشاحنة؟'))) return;
    try {
      await deleteProviderTruck(token, truckId);
      loadAll();
    } catch {
      alert('Failed to delete truck');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#e53935' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header with Title and Availability Toggle */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('Provider Operations Dashboard', 'لوحة تحكم مزود الخدمة')}</h1>
            <p className="text-sm text-gray-500">
              {t('Manage incoming freight requests, active hauling jobs, and your truck fleet', 'إدارة طلبات الشحن الواردة، والرحلات النشطة، وأسطول الشاحنات')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              {isAvailable ? t('Online & Accepting Jobs', 'متاح لاستقبال الطلبات') : t('Offline', 'غير متاح')}
            </span>
            <button
              onClick={handleToggleAvailability}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                isAvailable
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-300'
              }`}
            >
              {isAvailable ? '🟢 Online' : '⚪ Offline'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl text-sm font-medium bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        )}

        {/* Dashboard Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto border-b border-gray-200 pb-2">
          {[
            { key: 'requests', label: `${t('Incoming Requests', 'طلبات واردة')} (${requests.length})`, icon: '📥' },
            { key: 'active_jobs', label: `${t('Active Trips', 'رحلات نشطة')} (${jobs.length})`, icon: '🚚' },
            { key: 'trucks', label: `${t('My Trucks', 'شاحناتي')} (${trucks.length})`, icon: '🚛' },
            { key: 'fleet', label: t('Fleet Overview', 'نظرة عامة على الأسطول'), icon: '📊' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as Tab)}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
                tab === item.key
                  ? 'text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
              style={tab === item.key ? { background: '#e53935' } : {}}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: INCOMING REQUESTS */}
        {tab === 'requests' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('Available Requests for Bidding', 'الطلبات المتاحة للقبول')}</h2>
            {requests.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">📭</div>
                <p>{t('No pending freight requests matching your fleet right now.', 'لا توجد طلبات شحن معلقة مطابقة لأسطولك حالياً.')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <div key={req.id} className="border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-gray-900">#{req.id}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                            {req.vehicle_class}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {t('Route:', 'المسار:')} <strong>{req.pickup_address || 'Pickup'}</strong> &rarr; <strong>{req.dropoff_address || 'Drop-off'}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleAcceptClick(req.id)}
                          className="px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-sm hover:opacity-95 transition-opacity"
                          style={{ background: '#e53935' }}
                        >
                          {t('Accept Job', 'قبول الطلب')}
                        </button>
                        <button
                          onClick={() => handleDecline(req.id)}
                          className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"
                        >
                          {t('Decline', 'رفض')}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 rounded-lg p-3 text-xs">
                      <div>
                        <span className="text-gray-500 block">{t('Pickup Location', 'الاستلام')}</span>
                        <strong className="text-gray-800">{req.pickup_address}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">{t('Drop-off Location', 'التسليم')}</span>
                        <strong className="text-gray-800">{req.dropoff_address}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">{t('Price Budget', 'الميزانية')}</span>
                        <strong className="text-gray-800">
                          {req.requested_max_price ? `${req.requested_max_price} EGP` : 'Negotiable'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">{t('Status', 'الحالة')}</span>
                        <strong className="text-blue-600 font-semibold">{req.status}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ACTIVE & IN-PROGRESS JOBS */}
        {tab === 'active_jobs' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('Active Trips & History', 'الرحلات النشطة وسجل العمليات')}</h2>
            {jobs.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">🚚</div>
                <p>{t('No accepted or active jobs currently assigned.', 'لا توجد رحلات نشطة أو مقبولة حالياً.')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div key={job.id} className="border border-gray-200 rounded-xl p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-gray-900">#{job.id}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                            job.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : job.status === 'accepted'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {job.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {job.pickup_address} &rarr; {job.dropoff_address}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {job.status === 'accepted' && (
                          <button
                            onClick={() => handleStartTrip(job.id)}
                            disabled={actionLoading}
                            className="px-5 py-2.5 rounded-xl text-white font-bold text-sm transition-colors shadow-sm"
                            style={{ background: '#2563eb' }}
                          >
                            🚀 {t('Start Trip', 'بدء الرحلة')}
                          </button>
                        )}
                        {job.status === 'in_progress' && (
                          <button
                            onClick={() => handleCompleteTrip(job.id)}
                            disabled={actionLoading}
                            className="px-5 py-2.5 rounded-xl text-white font-bold text-sm transition-colors shadow-sm"
                            style={{ background: '#16a34a' }}
                          >
                            🏁 {t('Complete Trip', 'إنهاء الرحلة')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 rounded-lg p-3 text-xs">
                      <div>
                        <span className="text-gray-500 block">{t('Assigned Truck Plate', 'لوحة الشاحنة')}</span>
                        <strong className="text-gray-800">{job.truck_plate || 'Assigned'}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">{t('Agreed Price', 'السعر المتفق عليه')}</span>
                        <strong className="text-gray-800">{job.approved_price ? `${job.approved_price} EGP` : '—'}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">{t('Payment Status', 'حالة الدفع')}</span>
                        <strong className="text-gray-800">{job.payment_status}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500 block">{t('Vehicle Class', 'فئة الشاحنة')}</span>
                        <strong className="text-gray-800 uppercase">{job.vehicle_class}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TRUCKS MANAGEMENT */}
        {tab === 'trucks' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('Manage Truck Fleet', 'إدارة شاحنات الأسطول')}</h2>

            {/* Add Truck Form */}
            <form onSubmit={handleCreateTruck} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <input
                name="plateNumber"
                placeholder={t('License Plate (e.g. أ ب ج 1234)', 'رقم اللوحة')}
                className="p-3 border rounded-lg bg-white text-gray-900 text-sm focus:outline-none"
                style={{ borderColor: '#e5e7eb' }}
                required
              />
              <select
                name="vehicleClass"
                className="p-3 border rounded-lg bg-white text-gray-900 text-sm focus:outline-none"
                style={{ borderColor: '#e5e7eb' }}
                required
              >
                <option value="small">{t('Small (Pickup - 500kg)', 'صغيرة (نصف نقل - ٥٠٠ كجم)')}</option>
                <option value="medium">{t('Medium (Flatbed - 1.5t)', 'متوسطة (جامبو - ١.٥ طن)')}</option>
                <option value="large">{t('Large (Box Truck - 3.5t)', 'كبيرة (صندوق مغلق - ٣.٥ طن)')}</option>
                <option value="xl">{t('Extra Large (Trailer - 10t+)', 'تريلا ونقل ثقيل')}</option>
              </select>
              <input
                name="capacity"
                placeholder={t('Capacity (e.g. 1500kg)', 'الحمولة القصوى')}
                className="p-3 border rounded-lg bg-white text-gray-900 text-sm focus:outline-none"
                style={{ borderColor: '#e5e7eb' }}
                required
              />
              <button
                type="submit"
                className="p-3 text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
                style={{ background: '#e53935' }}
              >
                + {t('Add Truck', 'إضافة شاحنة')}
              </button>
            </form>

            {/* Trucks List */}
            {trucks.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>{t('No trucks added to your account yet.', 'لم تقم بإضافة شاحنات إلى حسابك بعد.')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trucks.map((truck) => (
                  <div key={truck.id} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900 flex items-center gap-2">
                        <span>🚛</span>
                        <span>{truck.plate_number}</span>
                        <span className="text-xs uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {truck.vehicle_class}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {t('Capacity:', 'الحمولة:')} {truck.capacity}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleTruckActive(truck.id, !truck.is_active)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                          truck.is_active
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}
                      >
                        {truck.is_active ? t('Active', 'مفعل') : t('Inactive', 'معطل')}
                      </button>
                      <button
                        onClick={() => handleDeleteTruck(truck.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        {t('Delete', 'حذف')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: FLEET OVERVIEW */}
        {tab === 'fleet' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('Fleet Capacity Overview', 'نظرة عامة على الأسطول')}</h2>
            {fleet.length === 0 ? (
              <p className="text-gray-400 text-center py-8">{t('Fleet overview not available.', 'نظرة الأسطول غير متوفرة.')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fleet.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-900">
                        {item.emoji} {item.label}
                      </div>
                      <span className="text-xs text-gray-500 uppercase">{item.code}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold" style={{ color: '#e53935' }}>
                        {item.quantity}
                      </span>
                      <span className="text-xs text-gray-500 block">{t('Trucks in fleet', 'شاحنة في الأسطول')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal for Truck Selection on Acceptance */}
        {showTruckModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {t('Assign Truck to Job', 'تعيين شاحنة للطلب')} #{selectedRequestId}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {t('Select which active truck from your fleet will haul this shipment:', 'اختر الشاحنة المتاحة من أسطولك لتنفيذ هذا الشحن:')}
              </p>

              <div className="space-y-2 mb-6">
                {trucks
                  .filter((t) => t.is_active)
                  .map((truck) => (
                    <div
                      key={truck.id}
                      onClick={() => setSelectedTruckId(truck.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                        selectedTruckId === truck.id
                          ? 'border-red-500 bg-red-50 text-red-900 font-bold'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div>
                        <strong>{truck.plate_number}</strong>
                        <span className="text-xs text-gray-500 ml-2 uppercase">({truck.vehicle_class} - {truck.capacity})</span>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border ${
                          selectedTruckId === truck.id ? 'border-red-600 bg-red-600' : 'border-gray-300'
                        }`}
                      />
                    </div>
                  ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowTruckModal(false)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50"
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAccept}
                  disabled={actionLoading || selectedTruckId === 0}
                  className="flex-1 py-3 text-white rounded-xl font-bold text-sm disabled:opacity-50"
                  style={{ background: '#e53935' }}
                >
                  {actionLoading ? t('Accepting...', 'جارٍ القبول...') : t('Confirm Acceptance', 'تأكيد القبول')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
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
