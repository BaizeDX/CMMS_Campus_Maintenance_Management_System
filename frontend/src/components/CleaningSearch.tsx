import React, { useEffect, useState } from 'react';
import { get, post } from '../api_utils';

interface Building {
  BuildingID: number;
  Name: string;
}

interface CleaningResult {
  ActivityID: number;
  Description: string;
  Type: string;
  StartDate: string;
  EndDate: string;
  BuildingID: number;
  BuildingName: string;
  RoomNumber: string | null;
  AreaType: string;
  AreaLabel: string | null;
  AffectedArea: string;
  IsUsableDuringActivity: number;
  ImpactLevel: string;
  ImpactNotes: string | null;
  HarmfulChemicals: string | null;
}

const CleaningSearch: React.FC = () => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [results, setResults] = useState<CleaningResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBuildings = async () => {
      try {
        const response = await get<any>('/query-table?table=Building');
        if (response?.data) {
          setBuildings(
            response.data.map((row: any) => ({
              BuildingID: Number(row.BuildingID),
              Name: row.Name
            }))
          );
        }
      } catch (err: any) {
        console.error('Failed to load buildings:', err);
      }
    };
    loadBuildings();
  }, []);

  const toggleBuilding = (id: number) => {
    setSelectedBuildings((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      alert('Start date must be before end date');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        startDate,
        endDate,
        buildings: selectedBuildings
      };
      const response = await post<CleaningResult[]>('/cleaning/find', payload);
      setResults(response || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load cleaning schedule');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date (e.g. 2025-11-25)</label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date (e.g. 2025-11-28)</label>
              <input
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Buildings</label>
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            {buildings.length === 0 && (
              <p className="text-sm text-gray-500">No buildings available.</p>
            )}
            {buildings.map((building) => (
              <label key={building.BuildingID} className="flex items-center space-x-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedBuildings.includes(building.BuildingID)}
                  onChange={() => toggleBuilding(building.BuildingID)}
                />
                <span>{building.Name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">Leave empty to include all buildings.</p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search Cleaning Schedule'}
          </button>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Scheduled Cleaning Activities</h3>
        {results.length === 0 ? (
          <p className="text-sm text-gray-500">No cleaning activities found for the selected criteria.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-600 font-semibold">Building</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-semibold">Affected Area</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-semibold">Dates</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-semibold">Cleaning Activity</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-semibold">Area Status</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-semibold">Harmful Chemicals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((row) => (
                  <tr key={`${row.ActivityID}-${row.AffectedArea}`}>
                    <td className="px-4 py-2 text-gray-900">{row.BuildingName}</td>
                    <td className="px-4 py-2 text-gray-700">
                      <div className="font-medium text-gray-900">{row.AffectedArea}</div>
                      <div className="text-xs text-gray-500">{row.AreaType}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      <div>{row.StartDate}</div>
                      <div className="text-xs text-gray-500">to {row.EndDate}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-800">
                      <div className="font-medium">{row.Description}</div>
                      <div className="text-xs text-gray-500">{row.Type}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      <div className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                        row.IsUsableDuringActivity
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {row.IsUsableDuringActivity ? 'Usable during cleaning' : 'Temporarily unusable'}
                      </div>
                      <div className="mt-2 text-xs text-gray-600">{row.ImpactLevel}</div>
                      {row.ImpactNotes && (
                        <div className="mt-1 text-xs text-gray-500">{row.ImpactNotes}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {row.HarmfulChemicals ? (
                        <div>
                          <div className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 mb-2">
                            Harmful chemicals used
                          </div>
                          <div>{row.HarmfulChemicals}</div>
                        </div>
                      ) : (
                        'No harmful chemicals reported'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CleaningSearch;
