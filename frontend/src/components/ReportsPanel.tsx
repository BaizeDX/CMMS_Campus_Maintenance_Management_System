import React, { useEffect, useState } from 'react';
import { get } from '../api_utils';

interface StaffRoleCount {
  role: string;
  count: number;
}

interface StaffSummary {
  total: number;
  active: number;
  byRole: StaffRoleCount[];
}

interface BuildingUtilizationItem {
  BuildingID: number;
  BuildingName: string;
  RoomCount: number;
  TotalCapacity: number;
}

interface BuildingUtilization {
  buildings: number;
  rooms: number;
  totalCapacity: number;
  byBuilding: BuildingUtilizationItem[];
}

interface ChemicalSummary {
  total: number;
  hazardous: number;
}

interface ActivityByTypeItem {
  ActivityType: string;
  Count: number;
}

interface ActivityByBuildingItem {
  BuildingID: number;
  BuildingName: string;
  ActivityCount: number;
}

interface ActivitySummary {
  total: number;
  inProgress: number;
  upcoming: number;
  byType: ActivityByTypeItem[];
  byBuilding: ActivityByBuildingItem[];
}

interface WorkforceAllocationItem {
  BuildingID: number;
  BuildingName: string;
  ActivityType: string;
  WorkerCount: number;
}

interface PriorityDistributionItem {
  Priority: string;
  RequestCount: number;
}

interface OverdueEquipmentItem {
  EquipmentType: string;
  OverdueCount: number;
}

interface StaffListItem {
  StaffID: number;
  Name: string;
  Role: string;
  Building: string;
}

interface ReportState {
  staff: StaffSummary;
  buildings: BuildingUtilization;
  chemicals: ChemicalSummary;
  activities: ActivitySummary;
  workforceAllocation: WorkforceAllocationItem[];
  requestPriorityDistribution: PriorityDistributionItem[];
  overdueEquipmentByType: OverdueEquipmentItem[];
}

const defaultState: ReportState = {
  staff: { total: 0, active: 0, byRole: [] },
  buildings: { buildings: 0, rooms: 0, totalCapacity: 0, byBuilding: [] },
  chemicals: { total: 0, hazardous: 0 },
  activities: { total: 0, inProgress: 0, upcoming: 0, byType: [], byBuilding: [] },
  workforceAllocation: [],
  requestPriorityDistribution: [],
  overdueEquipmentByType: []
};

const ReportsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportState>(defaultState);
  const [showStaffList, setShowStaffList] = useState(false);
  const [staffList, setStaffList] = useState<StaffListItem[]>([]);
  const [loadingStaffList, setLoadingStaffList] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          staffSummary,
          buildingUtilization,
          chemicalSummary,
          activitySummary,
          workforceAllocation,
          requestPriorityDistribution,
          overdueEquipmentByType
        ] = await Promise.all([
          get<StaffSummary>('/reports/staff-summary'),
          get<BuildingUtilization>('/reports/building-utilization'),
          get<ChemicalSummary>('/reports/chemical-summary'),
          get<ActivitySummary>('/reports/activity-summary'),
          get<WorkforceAllocationItem[]>('/reports/workforce-allocation'),
          get<PriorityDistributionItem[]>('/reports/request-priority-distribution'),
          get<OverdueEquipmentItem[]>('/reports/overdue-equipment-by-type')
        ]);

        setReports({
          staff: staffSummary,
          buildings: buildingUtilization,
          chemicals: chemicalSummary,
          activities: activitySummary,
          workforceAllocation,
          requestPriorityDistribution,
          overdueEquipmentByType
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load reports';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-500">
        Loading reports...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Staff Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Total Staff</p>
            <p className="text-3xl font-semibold text-gray-900 mt-1">{reports.staff.total}</p>
            <p className="text-sm text-gray-500 mt-2">Active: {reports.staff.active}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm col-span-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase text-gray-500">Headcount by Role</p>
              <button
                onClick={async () => {
                  if (!showStaffList) {
                    setLoadingStaffList(true);
                    try {
                      const data = await get<StaffListItem[]>('/staff/with-building');
                      setStaffList(data || []);
                      setShowStaffList(true);
                    } catch (err) {
                      const errorMessage = err instanceof Error ? err.message : 'Failed to load staff list';
                      setError(errorMessage);
                    } finally {
                      setLoadingStaffList(false);
                    }
                  } else {
                    setShowStaffList(false);
                  }
                }}
                disabled={loadingStaffList}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline disabled:text-gray-400"
              >
                {loadingStaffList ? 'Loading...' : showStaffList ? 'Hide Staff List' : 'View Staff List'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {reports.staff.byRole.map((item) => (
                <div
                  key={item.role}
                  className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium"
                >
                  {item.role}: {item.count}
                </div>
              ))}
              {reports.staff.byRole.length === 0 && (
                <span className="text-sm text-gray-500">No staff data available.</span>
              )}
            </div>
          </div>
        </div>
        {showStaffList && (
          <div className="mt-4 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900">Staff List</h4>
              <p className="text-xs text-gray-500 mt-1">Read-only view of all staff members</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Building</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {staffList.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                        No staff data available.
                      </td>
                    </tr>
                  ) : (
                    staffList.map((staff) => (
                      <tr key={staff.StaffID} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{staff.Name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{staff.Role}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{staff.Building}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Facilities Snapshot</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Buildings</p>
            <p className="text-3xl font-semibold text-gray-900 mt-2">{reports.buildings.buildings}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Rooms</p>
            <p className="text-3xl font-semibold text-gray-900 mt-2">{reports.buildings.rooms}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Total Capacity</p>
            <p className="text-3xl font-semibold text-gray-900 mt-2">{reports.buildings.totalCapacity}</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Chemical Safety</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Catalogued Chemicals</p>
            <p className="text-3xl font-semibold text-gray-900 mt-2">{reports.chemicals.total}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Flagged as Hazardous</p>
            <p className="text-3xl font-semibold text-red-600 mt-2">{reports.chemicals.hazardous}</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Activity Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Total</p>
            <p className="text-3xl font-semibold text-gray-900 mt-2">{reports.activities.total}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">In Progress</p>
            <p className="text-3xl font-semibold text-amber-600 mt-2">{reports.activities.inProgress}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Upcoming</p>
            <p className="text-3xl font-semibold text-blue-600 mt-2">{reports.activities.upcoming}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {reports.activities.byType.map((item) => (
            <div key={item.ActivityType} className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium">
              {item.ActivityType}: {item.Count}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">SQL-driven Report Highlights</h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900">Maintenance Request Priority Distribution</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Priority</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reports.requestPriorityDistribution.map((item) => (
                    <tr key={item.Priority}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.Priority}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{item.RequestCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900">Overdue Equipment by Type</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Equipment Type</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reports.overdueEquipmentByType.map((item) => (
                    <tr key={item.EquipmentType}>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.EquipmentType}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{item.OverdueCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Activity Coverage by Building</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Building</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Activity Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.activities.byBuilding.map((item) => (
                  <tr key={item.BuildingID}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.BuildingName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{item.ActivityCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Workforce Allocation Analysis</h3>
        <p className="text-sm text-gray-600 mb-4">
          Counts the number of staff assigned to each activity type across campus locations.
        </p>
        {reports.workforceAllocation.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
            No workforce allocation data available. Workers must be assigned to activities via the Performs table.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Building</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Activity Type</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Worker Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reports.workforceAllocation.map((item, index) => (
                    <tr key={`${item.BuildingID}-${item.ActivityType}-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.BuildingName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{item.ActivityType}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{item.WorkerCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default ReportsPanel;
