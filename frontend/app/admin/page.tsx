'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import RoleGuard from '@/components/RoleGuard';
import { AdminStats, AdminRequest, AdminDriver } from '@/lib/types';
import { getAdminStats, getAdminRequests, getAdminDrivers } from '@/lib/api';

function AdminPageContent() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;
    Promise.all([getAdminStats(token), getAdminRequests(token), getAdminDrivers(token)])
      .then(([s, r, d]) => {
        setStats(s);
        setRequests(r);
        setDrivers(d);
      })
      .catch(() => setError('Failed to load admin data'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-white">Admin Dashboard</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Active Users</div>
              <div className="text-3xl font-bold text-white">{stats.activeUsers}</div>
            </div>
            <div className="bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Requests Today</div>
              <div className="text-3xl font-bold text-white">{stats.requestsToday}</div>
            </div>
            <div className="bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Revenue (EGP)</div>
              <div className="text-3xl font-bold text-white">{stats.revenueEGP.toFixed(0)}</div>
            </div>
            <div className="bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-700">
              <div className="text-sm text-slate-400 mb-1">Acceptance Rate</div>
              <div className="text-3xl font-bold text-white">{stats.driverAcceptanceRate}</div>
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-2xl shadow-lg p-6 mb-8 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 text-white">Recent Requests</h2>
          {requests.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No requests found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 text-slate-300">ID</th>
                    <th className="text-left py-2 text-slate-300">Customer</th>
                    <th className="text-left py-2 text-slate-300">From</th>
                    <th className="text-left py-2 text-slate-300">To</th>
                    <th className="text-left py-2 text-slate-300">Status</th>
                    <th className="text-right py-2 text-slate-300">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-b border-slate-700">
                      <td className="py-2 text-slate-200">{req.id}</td>
                      <td className="py-2 text-slate-200">{req.customer}</td>
                      <td className="py-2 text-slate-200">{req.from}</td>
                      <td className="py-2 text-slate-200">{req.to}</td>
                      <td className="py-2">
                        <span className="px-2 py-1 rounded-full bg-blue-900/50 text-blue-300 text-xs border border-blue-700">
                          {req.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 text-right text-slate-200">{req.amount.toFixed(0)} EGP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4 text-white">Drivers</h2>
          {drivers.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No drivers found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 text-slate-300">Name</th>
                    <th className="text-left py-2 text-slate-300">Trips</th>
                    <th className="text-left py-2 text-slate-300">Rating</th>
                    <th className="text-left py-2 text-slate-300">Status</th>
                    <th className="text-right py-2 text-slate-300">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver) => (
                    <tr key={driver.name} className="border-b border-slate-700">
                      <td className="py-2 text-slate-200">{driver.name}</td>
                      <td className="py-2 text-slate-200">{driver.trips}</td>
                      <td className="py-2 text-slate-200">{driver.rating} ⭐</td>
                      <td className="py-2 text-slate-200">{driver.status}</td>
                      <td className="py-2 text-right text-slate-200">{driver.earnings} EGP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <AdminPageContent />
    </RoleGuard>
  );
}
