import React, { useState, useMemo } from 'react';
import TableQuery from './TableQuery';
import SqlTerminal from './SqlTerminal';
import CleaningSearch from './CleaningSearch';
import ReportsPanel from './ReportsPanel';
import { RoleDefinition } from '../roles';

interface DataConsoleProps {
  role: RoleDefinition;
}

const TAB_DICT: Record<
  'tables' | 'cleaning' | 'sql' | 'reports',
  { label: string }
> = {
  tables: { label: 'Table Manager' },
  cleaning: { label: 'Activity Search' },
  sql: { label: 'SQL Runner' },
  reports: { label: 'Reports' }
};

const DataConsole: React.FC<DataConsoleProps> = ({ role }) => {
  const allowedTabs = role.dataConsoleTabs;
  const firstTab = useMemo(() => allowedTabs[0] ?? null, [allowedTabs]);
  const [activeTab, setActiveTab] = useState<string | null>(firstTab);

  if (!allowedTabs.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
        This role has no access to the Data Console. Please contact an administrator.
      </div>
    );
  }

  const renderActiveTab = () => {
    if (!activeTab) return null;

    if (activeTab === 'tables') {
      if (!role.permissions.canViewTableManager) {
        return (
          <div className="text-sm text-gray-600">
            This role can only consume curated reports and cannot open the Table Manager. Switch to a higher-privileged persona to continue.
          </div>
        );
      }
      return (
        <TableQuery
          canCreate={role.permissions.canCreateRecord}
          canBulkInsert={role.permissions.canBulkInsert}
          canEdit={role.permissions.canEditRecord}
          canDelete={role.permissions.canDeleteRecord}
        />
      );
    }
    if (activeTab === 'cleaning') {
      return <CleaningSearch />;
    }
    if (activeTab === 'reports') {
      return <ReportsPanel />;
    }
    if (activeTab === 'sql') {
      if (!role.permissions.canRunSql) {
        return (
          <div className="text-sm text-red-600">
            SQL Runner is restricted to administrators. Please use the guided Table Manager or request elevated access.
          </div>
        );
      }
      return <SqlTerminal />;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-gray-900">Data Console</h2>
        <p className="text-sm text-gray-500">
          Available modules are automatically tailored to the <span className="font-semibold">{role.label}</span> role.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {allowedTabs.map((tabId) => {
          const tab = TAB_DICT[tabId];
          return (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                activeTab === tabId
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        {renderActiveTab()}
      </div>
    </div>
  );
};

export default DataConsole;
