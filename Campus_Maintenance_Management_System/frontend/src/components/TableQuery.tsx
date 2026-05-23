import React, { useState } from 'react';
import { get, post } from '../api_utils';

interface TableQueryProps {
  canCreate?: boolean;
  canBulkInsert?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const TABLES = [
  { name: 'Staff', label: 'Staff' },
  { name: 'Building', label: 'Building' },
  { name: 'Room', label: 'Room' },
  { name: 'Activity', label: 'Activity' },
  { name: 'Equipment', label: 'Equipment' },
  { name: 'MaintenanceRequest', label: 'Maintenance Request' },
  { name: 'Maintenance_Log', label: 'Maintenance Log' },
  { name: 'Chemical', label: 'Chemical' }
];

// Field options for dropdowns
const getFieldOptions = (table: string, column: string): string[] | null => {
  // Special handling for Staff table Role
  if (table === 'Staff' && column === 'Role') {
    return ['Executive Officer', 'Mid-Level Manager', 'Base-Level Worker'];
  }
  // Special handling for Staff table Status
  if (table === 'Staff' && column === 'Status') {
    return ['Active', 'On Leave', 'Inactive'];
  }
  // Special handling for MaintenanceRequest table Priority
  if (table === 'MaintenanceRequest' && column === 'Priority') {
    return ['Low', 'Medium', 'High', 'Emergency'];
  }
  // Special handling for MaintenanceRequest table Status
  if (table === 'MaintenanceRequest' && column === 'Status') {
    return ['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled'];
  }
  // Special handling for Activity table Type
  if (table === 'Activity' && column === 'Type') {
    return ['Daily Cleaning', 'Maintenance', 'Renovation', 'Window Repair', 'Weather-Related', 'Emergency'];
  }
  // Special handling for Equipment table Status
  if (table === 'Equipment' && column === 'Status') {
    return ['Available', 'In Use', 'Under Maintenance', 'Retired'];
  }
  return null;
};

const initRow = (columns: string[]) =>
  columns.reduce<Record<string, string>>((acc, column) => {
    acc[column] = '';
    return acc;
  }, {});

const sanitizeRow = (row: Record<string, string>) => {
  const cleaned: Record<string, string> = {};
  Object.entries(row).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      cleaned[key] = value;
    }
  });
  return cleaned;
};

const TableQuery: React.FC<TableQueryProps> = ({
  canCreate = true,
  canBulkInsert = true,
  canEdit = true,
  canDelete = true
}) => {
  const [table, setTable] = useState<string>('');
  const [term, setTerm] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cols, setCols] = useState<string[]>([]);
  const [pks, setPks] = useState<string[]>([]);
  const [availCols, setAvailCols] = useState<string[]>([]);
  const [col, setCol] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [edit, setEdit] = useState<any>({});
  const [delConfirm, setDelConfirm] = useState<{ index: number; row: any } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [bulkRows, setBulkRows] = useState<Record<string, string>[]>([]);

  const resetForms = (columns: string[], primaryKeys: string[]) => {
    const baseRow = initRow(columns);
    setAvailCols(columns);
    setPks(primaryKeys);
    setNewRow(baseRow);
    setBulkRows(columns.length ? [baseRow] : []);
  };

  const handleSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const applyQueryResponse = (res: any) => {
    if (res?.data && res.data.length > 0) {
      setData(res.data);
      setCols(res.columns || Object.keys(res.data[0]));
      setPks(res.primaryKeys || []);
      setAvailCols(res.columns || []);
    } else {
      setData([]);
      setCols([]);
      setPks([]);
    }
  };

  const getPk = (row: any): any => {
    const pk: any = {};
    pks.forEach(pkCol => {
      pk[pkCol] = row[pkCol];
    });
    return pk;
  };

  const loadMeta = async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await get<any>(`/query-table?table=${t}&metaOnly=true`);
      if (res?.columns) {
        resetForms(res.columns || [], res.primaryKeys || []);
      } else {
        setError('Invalid response from server');
        resetForms([], []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load metadata');
      resetForms([], []);
    } finally {
      setLoading(false);
    }
  };

  const selectTable = async (t: string) => {
    setTable(t);
    setData([]);
    setCols([]);
    setTerm('');
    setCol('');
    setEditIdx(null);
    setEdit({});
    setDelConfirm(null);
    setError(null);
    setSuccess(null);
    resetForms([], []);
    await loadMeta(t);
  };

  const search = async () => {
    if (!table || !term.trim()) {
      alert('Please select a table and enter a search keyword');
      return;
    }
    if (!col) {
      alert('Please select an attribute to search');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await get<any>(
        `/query-table?table=${table}&column=${encodeURIComponent(col)}&search=${encodeURIComponent(term)}`
      );
      applyQueryResponse(res);
    } catch (err: any) {
      setError(err.message || 'Search failed');
      setData([]);
      setCols([]);
      setPks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async () => {
    if (!table) {
      alert('Please select a table first');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await get<any>(`/query-table?table=${table}`);
      applyQueryResponse(res);
    } catch (err: any) {
      setError(err.message || 'Load failed');
      setData([]);
      setCols([]);
      setPks([]);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (idx: number) => {
    if (!canEdit) {
      alert('You do not have permission to edit records.');
      return;
    }
    setEditIdx(idx);
    setEdit({ ...data[idx] });
    setError(null);
    setSuccess(null);
  };

  const save = async () => {
    if (editIdx === null || !canEdit) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const row = data[editIdx];
      const pk = getPk(row);
      const update = { ...edit };
      pks.forEach(pkCol => {
        delete update[pkCol];
      });

      const res = await post('/table-update', {
        table: table,
        data: update,
        primaryKey: pk
      });

      handleSuccess(res.message || 'Update successful');
      setEditIdx(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const clickDelete = (idx: number) => {
    if (!canDelete) {
      alert('You do not have permission to delete records.');
      return;
    }
    setDelConfirm({ index: idx, row: data[idx] });
  };

  const confirmDelete = async () => {
    if (!delConfirm || !canDelete) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const pk = getPk(delConfirm.row);

      const res = await post('/table-delete', {
        table: table,
        primaryKey: pk
      });

      handleSuccess(res.message || 'Delete successful');
      setDelConfirm(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
      setDelConfirm(null);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setData([]);
    setCols([]);
    setTerm('');
    setCol('');
    setEditIdx(null);
    setEdit({});
    setDelConfirm(null);
    setError(null);
    setSuccess(null);
    resetForms([], []);
  };

  const handleAddRow = async () => {
    if (!canCreate) {
      alert('You do not have permission to create new records.');
      return;
    }
    if (!table) {
      alert('Please select a table first');
      return;
    }
    const cleaned = sanitizeRow(newRow);
    if (Object.keys(cleaned).length === 0) {
      alert('Please provide at least one field');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await post('/table-insert', { table, rows: [cleaned] });
      handleSuccess(response.message || 'Record inserted');
      await loadAll();
      setNewRow(initRow(availCols));
    } catch (err: any) {
      setError(err.message || 'Insert failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkInsert = async () => {
    if (!canBulkInsert) {
      alert('You do not have permission to perform bulk insert.');
      return;
    }
    if (!table) {
      alert('Please select a table first');
      return;
    }
    const rows = bulkRows
      .map(sanitizeRow)
      .filter((row) => Object.keys(row).length > 0);
    if (rows.length === 0) {
      alert('Please fill in at least one value in any row');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await post('/table-insert', { table, rows });
      handleSuccess(response.message || 'Bulk insert completed');
      setBulkRows([initRow(availCols)]);
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Bulk insert failed');
    } finally {
      setLoading(false);
    }
  };

  const updateBulkRowValue = (rowIndex: number, column: string, value: string) => {
    setBulkRows((prev) =>
      prev.map((row, idx) => (idx === rowIndex ? { ...row, [column]: value } : row))
    );
  };

  const addBulkRow = () => {
    setBulkRows((prev) => [...prev, initRow(availCols)]);
  };

  const removeBulkRow = (index: number) => {
    setBulkRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-gray-900">Table Query</h2>
        <p className="text-sm text-gray-500">Search, edit, and batch-insert database records.</p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Table
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TABLES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => selectTable(t.name)}
                  className={`p-3 rounded border text-sm transition-colors ${
                    table === t.name
                      ? 'bg-blue-100 border-blue-200 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {table && (
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:space-x-3 space-y-3 md:space-y-0">
                <select
                  value={col}
                  onChange={(e) => setCol(e.target.value)}
                  disabled={loading || availCols.length === 0}
                  className="md:w-56 w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-800 focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {loading ? 'Loading...' : availCols.length === 0 ? 'No columns' : 'Select column'}
                  </option>
                  {availCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && search()}
                  className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-gray-800 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={search}
                  disabled={loading || !term.trim() || !col}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
                <button
                  onClick={loadAll}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                >
                  Load All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {table && availCols.length > 0 && canCreate && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Add Record</h3>
            <p className="text-sm text-gray-500">
              Fill in any fields you want to set. Empty values will use database defaults.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {availCols.map((column) => {
                const options = getFieldOptions(table, column);
                return (
                  <div key={column}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      {column} {pks.includes(column) && <span className="text-amber-600">(PK)</span>}
                    </label>
                    {options ? (
                      <select
                        value={newRow[column] ?? ''}
                        onChange={(e) => setNewRow((prev) => ({ ...prev, [column]: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="">-- Select {column} --</option>
                        {options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={newRow[column] ?? ''}
                        onChange={(e) => setNewRow((prev) => ({ ...prev, [column]: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleAddRow}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Add Record'}
              </button>
            </div>
          </div>

          {canBulkInsert && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">Bulk Insert</h3>
            <p className="text-sm text-gray-500">
              Use the list below to stage multiple records. Only filled fields will be submitted.
            </p>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {bulkRows.map((row, rowIdx) => (
                <div key={rowIdx} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Row {rowIdx + 1}</span>
                    {bulkRows.length > 1 && (
                      <button
                        onClick={() => removeBulkRow(rowIdx)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {availCols.map((column) => {
                      const options = getFieldOptions(table, column);
                      return (
                        <div key={`${rowIdx}-${column}`}>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                            {column}
                          </label>
                          {options ? (
                            <select
                              value={row[column] ?? ''}
                              onChange={(e) => updateBulkRowValue(rowIdx, column, e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 bg-white"
                            >
                              <option value="">-- Select {column} --</option>
                              {options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={row[column] ?? ''}
                              onChange={(e) => updateBulkRowValue(rowIdx, column, e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={addBulkRow}
                className="text-sm text-blue-600 hover:underline"
              >
                + Add another row
              </button>
              <button
                onClick={handleBulkInsert}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Insert Records'}
              </button>
            </div>
            </div>
          )}
        </div>
      )}

      {table && availCols.length > 0 && !canCreate && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          This role is read-only and cannot create or bulk import data.
        </div>
      )}

      {data.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between text-sm text-gray-600">
            <span>
              {TABLES.find(t => t.name === table)?.label} ({data.length} results)
            </span>
            <button
              onClick={clear}
              className="text-blue-600 hover:underline text-sm"
            >
              Clear
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {cols.map((c) => (
                    <th
                      key={c}
                      className={`px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase ${
                        pks.includes(c) ? 'text-amber-600' : ''
                      }`}
                    >
                      {c}
                      {pks.includes(c) && (
                        <span className="ml-1 text-[10px]">(PK)</span>
                      )}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-gray-50 ${
                      editIdx === idx ? 'bg-blue-50' : ''
                    }`}
                  >
                    {cols.map((c) => (
                      <td
                        key={c}
                        className="px-4 py-2 text-sm text-gray-800"
                      >
                        {editIdx === idx && !pks.includes(c) ? (
                          (() => {
                            const options = getFieldOptions(table, c);
                            return options ? (
                              <select
                                value={edit[c] !== null && edit[c] !== undefined ? String(edit[c]) : ''}
                                onChange={(e) => setEdit({ ...edit, [c]: e.target.value })}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 bg-white"
                              >
                                <option value="">-- Select {c} --</option>
                                {options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={edit[c] !== null && edit[c] !== undefined ? String(edit[c]) : ''}
                                onChange={(e) => setEdit({ ...edit, [c]: e.target.value })}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                              />
                            );
                          })()
                        ) : (
                          <span className={pks.includes(c) ? 'font-mono font-semibold text-amber-600' : ''}>
                            {row[c] !== null && row[c] !== undefined
                              ? String(row[c])
                              : 'N/A'}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2">
                      <div className="flex items-center space-x-3 text-sm">
                        {editIdx === idx ? (
                          <>
                            <button
                              onClick={save}
                              disabled={loading || !canEdit}
                              className="text-blue-600 hover:underline disabled:text-gray-400"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditIdx(null);
                                setEdit({});
                                setError(null);
                              }}
                              className="text-gray-600 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {canEdit ? (
                              <button
                                onClick={() => startEdit(idx)}
                                disabled={loading || editIdx !== null}
                                className="text-blue-600 hover:underline disabled:text-gray-400"
                              >
                                Edit
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">No edit permission</span>
                            )}
                            {canDelete ? (
                              <button
                                onClick={() => clickDelete(idx)}
                                disabled={loading || editIdx !== null}
                                className="text-red-600 hover:underline disabled:text-gray-400"
                              >
                                Delete
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">No delete permission</span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {table && data.length === 0 && !loading && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No results found. Try a different search term or load all records.
        </div>
      )}

      {delConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this record? This action cannot be undone.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Record Information:</p>
              <div className="space-y-1">
                {pks.map((pkCol) => (
                  <div key={pkCol} className="flex items-center space-x-2">
                    <span className="text-xs text-amber-600 font-mono">{pkCol}:</span>
                    <span className="text-sm text-gray-800 font-mono">{delConfirm.row[pkCol]}</span>
                  </div>
                ))}
                {cols.slice(0, 3).filter(c => !pks.includes(c)).map((c) => (
                  <div key={c} className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">{c}:</span>
                    <span className="text-sm text-gray-800">
                      {delConfirm.row[c] !== null && delConfirm.row[c] !== undefined
                        ? String(delConfirm.row[c])
                        : 'N/A'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDelConfirm(null)}
                disabled={loading}
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={loading}
                className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableQuery;
