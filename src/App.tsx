import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Clustering from './components/Clustering';
import TambahMahasiswa from './components/TambahMahasiswa';
import HasilClustering from './components/HasilClustering';
import Laporan from './components/Laporan';
import ManajemenPeriode from './components/ManajemenPeriode';
import ClusteringPribadi from './components/ClusteringPribadi';
import LengkapiData from './components/LengkapiData';
import GantiPassword from './components/GantiPassword';
import { checkAuth, getCurrentUser } from './lib/auth';
import type { AppUser } from './lib/auth';

function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // First check localStorage for immediate user data
        const localUser = getCurrentUser();
        if (localUser) {
          console.log('Found user in localStorage:', localUser);
          setUser(localUser);
        }
        
        // Then verify with Supabase
        const authenticatedUser = await checkAuth();
        console.log('Auth check result:', authenticatedUser);
        setUser(authenticatedUser);
      } catch (error) {
        console.error('Auth initialization error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('App state - user:', user, 'loading:', loading);
  }, [user, loading]);
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/" element={user ? <Layout user={user} setUser={setUser} /> : <Navigate to="/login" replace />}>

          {/* Admin Routes */}
          {user?.level_user === 1 && (
            <>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="clustering" element={<Clustering />} />
              <Route path="tambah-mahasiswa" element={<TambahMahasiswa />} />
              <Route path="hasil-clustering" element={<HasilClustering />} />
              <Route path="laporan" element={<Laporan />} />
              <Route path="manajemen-periode" element={<ManajemenPeriode />} />
            </>
          )}
          
          {/* Student Routes */}
          {user?.level_user === 0 && (
            <>
              <Route index element={<Navigate to="/clustering-pribadi" replace />} />
              <Route path="clustering-pribadi" element={<ClusteringPribadi />} />
            </>
          )}
          
          {/* Common Routes */}
          <Route path="ganti-password" element={<GantiPassword />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;