import React, { useEffect, useState } from 'react';
import { get } from '../api_utils';

interface DashboardStats {
  activeStaff: number;
  pendingRequests: number;
  overdueEquipment: number;
}

interface MaintenanceLog {
  LogID: number | string;
  Description: string;
  Date: string;
  NextMaintenanceDate?: string | null;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({ 
    activeStaff: 0, 
    pendingRequests: 0, 
    overdueEquipment: 0 
  });
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const [data, logData] = await Promise.all([
          get<DashboardStats>('/dashboard'),
          get<MaintenanceLog[]>('/logs')
        ]);
        setStats(data);
        setLogs(logData);
      } catch (err) {
        console.error('Failed to load:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500">Overview of campus operations</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Active Staff', value: stats.activeStaff },
          { label: 'Pending Requests', value: stats.pendingRequests },
          { label: 'Maintenance Due', value: stats.overdueEquipment }
        ].map((item) => (
          <div key={item.label} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <p className="text-sm text-gray-500">{item.label}</p>
            <p className="text-3xl font-semibold text-gray-900 mt-2">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Logs</h3>
        <div className="space-y-4">
          {logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.LogID} className="flex items-center justify-between p-3 rounded border border-gray-200 bg-white">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-medium text-gray-900 truncate">{log.Description}</p>
                  <p className="text-xs text-gray-500">{log.Date}</p>
                </div>
                <span className="text-xs font-medium text-gray-500">
                  Next: {log.NextMaintenanceDate || 'Not scheduled'}
                </span>
              </div>
            ))
          ) : (
            <div className="text-gray-500 text-sm">No logs available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
