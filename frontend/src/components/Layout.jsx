import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊', admin: false },
  { path: '/users', label: 'Users', icon: '👥', admin: true },
  { path: '/departments', label: 'Departments', icon: '🏢', admin: false, module: 'employees' },
  { path: '/inventory', label: 'Inventory', icon: '📦', admin: false, module: 'inventory' },
  { path: '/gate', label: 'Gate Security', icon: '🚧', admin: false, module: 'gate' },
  { path: '/ambulance', label: 'Ambulance', icon: '🚑', admin: false, module: 'ambulance' },
  { path: '/tasks', label: 'Tasks', icon: '✅', admin: false, module: 'tasks' },
  { path: '/patients', label: 'Patients', icon: '👨‍⚕️', admin: false, module: 'patients' },
  { path: '/complaints', label: 'Complaints', icon: '📝', admin: false, module: 'complaints' },
  { path: '/rooms', label: 'Room Checklist', icon: '🏠', admin: false, module: 'rooms' },
  { path: '/lost-found', label: 'Lost & Found', icon: '🔍', admin: false, module: 'lostfound' },
  { path: '/projects', label: 'Projects', icon: '📋', admin: false, module: 'projects' },
  { path: '/problems', label: 'Problems', icon: '⚠️', admin: false, module: 'problems' },
  { path: '/floor-checklist', label: 'Floor Checklist', icon: '📋', admin: false, module: 'floorChecklist' },
  { path: '/reports', label: 'Reports', icon: '📊', admin: true }
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isAdmin, hasModuleAccess } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out overflow-y-auto`}>
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-blue-600">🏥 HMS</h1>
          <p className="text-xs text-gray-500 mt-0.5">Hospital Management</p>
        </div>
        <nav className="p-3 space-y-1">
          {navItems.filter(item => (!item.admin || isAdmin) && (!item.module || isAdmin || hasModuleAccess(item.module))).map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : 'text-gray-600'}`}
              onClick={() => setSidebarOpen(false)}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="hidden lg:block text-sm text-gray-500">Welcome, <span className="font-medium text-gray-700">{user?.name}</span></div>
          <div className="flex items-center gap-3 ml-auto">
            <span className="badge-blue text-xs">{user?.role?.toUpperCase()}</span>
            <button onClick={handleLogout} className="btn-secondary text-xs">Logout</button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
