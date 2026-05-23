import React, { useState } from 'react';
import { post } from '../api_utils';

interface QueryResult {
  data?: Record<string, unknown>[];
  columns?: string[];
  message?: string;
  rows_affected?: number;
  error?: string;
}

interface QueryResponse {
  message?: string;
  rows_affected?: number;
}

const SqlTerminal: React.FC = () => {
  const [sql, setSql] = useState('SELECT * FROM MaintenanceRequest WHERE Status = "Pending";');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [unsafeMode, setUnsafeMode] = useState(false);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await post<Record<string, unknown>[] | QueryResponse>(
        '/query',
        { sql: sql },
        {
          headers: unsafeMode ? { 'X-CMMS-Unsafe-SQL': '1' } : undefined
        }
      );
      
      if (Array.isArray(res)) {
        if (res.length > 0) {
          const cols = Object.keys(res[0]);
          setResult({ data: res, columns: cols });
        } else {
          setResult({ 
            data: [], 
            columns: [], 
            message: 'Query executed successfully. No rows returned.' 
          });
        }
      } else {
        const queryRes = res as QueryResponse;
        if (queryRes.rows_affected !== undefined) {
          setResult({ 
            message: queryRes.message || `Query executed successfully. ${queryRes.rows_affected} row(s) affected.` 
          });
        } else {
          setResult({ data: [res as Record<string, unknown>], message: 'Query executed successfully.' });
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setResult({ error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-gray-900">SQL Interface</h2>
        <p className="text-sm text-gray-500">Run SQL queries directly against the database.</p>
      </header>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 shadow-sm">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
          SQL Runner is a coursework/demo feature. Public mode allows read-only queries by default. Unsafe SQL requires administrator access and explicit backend opt-in.
        </div>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          className="w-full h-40 border border-gray-300 rounded px-3 py-2 font-mono text-sm text-gray-800 focus:outline-none focus:border-blue-500"
          spellCheck={false}
        />
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={unsafeMode}
            onChange={(e) => setUnsafeMode(e.target.checked)}
          />
          Request unsafe administrator mode
        </label>
        <div className="flex justify-end space-x-3">
          <button
            onClick={() => { setSql(''); setResult(null); }}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded"
          >
            Clear
          </button>
          <button
            onClick={run}
            disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Run Query'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          {result.error ? (
            <div className="text-sm text-red-600">{result.error}</div>
          ) : result.data && result.data.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs text-gray-500">
                {result.data.length} row(s) returned
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 rounded">
                  <thead>
                    <tr className="bg-gray-50">
                      {result.columns?.map((col, idx) => (
                        <th key={idx} className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-gray-200">
                        {result.columns?.map((col, colIdx) => (
                          <td key={colIdx} className="px-3 py-2 text-gray-800">
                            {row[col] !== null && row[col] !== undefined ? String(row[col]) : 'NULL'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              {result.message || 'Query executed successfully.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SqlTerminal;
