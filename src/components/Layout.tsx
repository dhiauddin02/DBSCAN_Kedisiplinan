import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, Home, BarChart3, Upload, FileText, Users, Key, UserCheck, UserPlus, Settings } from 'lucide-react';
import { logout } from '../lib/auth';
import type { AppUser } from '../lib/auth';

interface LayoutProps {
  user: AppUser;
  setUser: (user: AppUser | null) => void;
}

export default function Layout({ user, setUser }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();

  // Debug logging
  useEffect(() => {
    console.log('Layout - user:', user);
  }, [user]);
  if (!user) {
    console.log('Layout - no user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    await logout();
    setUser(null);
    navigate('/login');
    setShowLogoutModal(false);
  };

  const menuItems = [
    ...(user.level_user === 1 ? [
      { icon: Home, label: 'Dashboard', path: '/dashboard' },
      { icon: Settings, label: 'Manajemen Periode', path: '/manajemen-periode' },
      { icon: UserPlus, label: 'Tambah Mahasiswa', path: '/tambah-mahasiswa' },
      { icon: Upload, label: 'Clustering', path: '/clustering' },
      { icon: BarChart3, label: 'Hasil Clustering', path: '/hasil-clustering' },
      { icon: FileText, label: 'Laporan', path: '/laporan' },
     
    ] : []),
    ...(user.level_user === 0 ? [
      { icon: UserCheck, label: 'Clustering Pribadi', path: '/clustering-pribadi' },
    ] : []),
    { icon: Key, label: 'Ganti Password', path: '/ganti-password' },
  ];

  console.log('Layout - menuItems:', menuItems);
  console.log('Layout - user.level_user:', user.level_user);
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-800">DBSCAN Clustering</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors duration-150"
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-200">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">{user.nama || 'User'}</p>
              <p className="text-xs text-gray-500">{user.level_user === 1 ? 'Admin' : 'Mahasiswa'}</p>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-700 rounded-lg hover:bg-red-50 transition-colors duration-150"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">DBSCAN Clustering</h1>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Konfirmasi Logout</h3>
            <p className="text-gray-600 mb-6">Apakah anda yakin ingin logout?</p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
              >
                Tidak
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors duration-150"
              >
                Ya, Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}