import React from 'react';
import { RoleDefinition } from '../roles';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  allowedViews: string[];
  roleDefinition: RoleDefinition;
  onLogout: () => void;
}

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'data-console', label: 'Data Console' }
];

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  allowedViews,
  roleDefinition,
  onLogout
}) => {
  const visibleItems = MENU_ITEMS.filter((item) => allowedViews.includes(item.id));

  return (
    <div className="w-56 h-screen bg-white border-r border-gray-200 flex flex-col fixed left-0 top-0 z-40">
      <div className="p-5 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">CMMS</h1>
      </div>

      <div className="px-4 py-3 border-b border-gray-200 space-y-1">
        <p className="text-xs uppercase text-gray-500 tracking-wide">Current role</p>
        <p className="text-sm font-semibold text-gray-900">{roleDefinition.label}</p>
        <p className="text-xs text-gray-500">{roleDefinition.summary}</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-3">
        {visibleItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : 'text-gray-700 border-transparent hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-4 pb-4 space-y-3 border-t border-gray-200">
        <button
          onClick={onLogout}
          className="w-full text-center px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
        >
          Logout
        </button>
        <p className="text-[11px] text-gray-400 text-center">CMMS Management Console</p>
      </div>
    </div>
  );
};

export default Sidebar;