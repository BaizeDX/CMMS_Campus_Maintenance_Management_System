import React, { useEffect, useState } from 'react';
import Sidebar from './src/components/Sidebar';
import Dashboard from './src/components/Dashboard';
import DataConsole from './src/components/DataConsole';
import { get, post } from './src/api_utils';
import { ROLE_MAP, RoleDefinition, RoleKey } from './src/roles';

type ViewId = 'dashboard' | 'data-console';

interface AuthUser {
  userId: number;
  username: string;
  role: RoleKey;
  roleLabel: string;
  displayName: string;
  staffId?: number | null;
}

interface AuthMeResponse {
  authenticated: boolean;
  user?: AuthUser;
}

interface LoginResponse {
  success: boolean;
  user: AuthUser;
}

const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'System Administrator' },
  { username: 'manager', password: 'manager123', role: 'Mid-level Manager' },
  { username: 'executive', password: 'executive123', role: 'Executive Officer' },
  { username: 'worker', password: 'worker123', role: 'Base-level Worker' }
];

const LoginScreen: React.FC<{
  loading: boolean;
  onLogin: (username: string, password: string) => Promise<void>;
}> = ({ loading, onLogin }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await onLogin(username, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6">
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-5">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-blue-500">CMMS Access</p>
            <h1 className="text-3xl font-semibold text-gray-900">Campus Maintenance and Management System</h1>
            <p className="text-sm text-gray-600 max-w-2xl">
              This portfolio version uses a lightweight session-based login so role access is not enforced by the UI alone.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </section>

        <aside className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Seeded Demo Accounts</h2>
            <p className="text-sm text-gray-600 mt-2">
              Passwords are demo credentials seeded for review. They are hashed in the database and are not intended for production use.
            </p>
          </div>

          <div className="space-y-3">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.username}
                type="button"
                onClick={() => {
                  setUsername(account.username);
                  setPassword(account.password);
                }}
                className="w-full text-left border border-gray-200 rounded-xl p-4 hover:border-blue-200 hover:bg-blue-50 transition"
              >
                <p className="text-sm font-semibold text-gray-900">{account.role}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {account.username} / {account.password}
                </p>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [submittingLogin, setSubmittingLogin] = useState(false);

  const roleDefinition: RoleDefinition | null = currentUser ? ROLE_MAP[currentUser.role] : null;

  useEffect(() => {
    const loadCurrentUser = async () => {
      setAuthLoading(true);
      try {
        const response = await get<AuthMeResponse>('/auth/me');
        if (response.authenticated && response.user) {
          setCurrentUser(response.user);
        } else {
          setCurrentUser(null);
        }
      } catch {
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (roleDefinition && !roleDefinition.allowedViews.includes(currentView)) {
      setCurrentView(roleDefinition.allowedViews[0]);
    }
  }, [roleDefinition, currentView]);

  const handleLogin = async (username: string, password: string) => {
    setSubmittingLogin(true);
    try {
      const response = await post<LoginResponse>('/auth/login', { username, password });
      setCurrentUser(response.user);
      setCurrentView('dashboard');
    } finally {
      setSubmittingLogin(false);
    }
  };

  const handleLogout = async () => {
    try {
      await post('/auth/logout', {});
    } finally {
      setCurrentUser(null);
      setCurrentView('dashboard');
    }
  };

  const renderView = () => {
    if (!roleDefinition) {
      return null;
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'data-console':
        return <DataConsole role={roleDefinition} />;
      default:
        return <Dashboard />;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        Checking session...
      </div>
    );
  }

  if (!roleDefinition || !currentUser) {
    return <LoginScreen loading={submittingLogin} onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        allowedViews={roleDefinition.allowedViews}
        roleDefinition={roleDefinition}
        onLogout={handleLogout}
      />

      <main className="flex-1 ml-56 p-8 overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="bg-white border border-blue-100 rounded-xl p-5 shadow-sm flex flex-col gap-1">
            <div className="text-sm text-blue-600 font-semibold uppercase tracking-wide">
              Signed in as {currentUser.displayName}
            </div>
            <p className="text-gray-800 text-base">{roleDefinition.summary}</p>
            <p className="text-sm text-gray-500">
              Username: {currentUser.username} · Role: {roleDefinition.label}
            </p>
          </div>
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;
