import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, LogIn, UserCheck, AlertCircle, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AppUser } from '../lib/auth';

interface LoginProps {
  setUser: (user: AppUser | null) => void;
}

export default function Login({ setUser }: LoginProps) {
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const navigate = useNavigate();


  const createAdminUser = async () => {
    try {
      setLoading(true);
      setError('');

      // Create admin user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: 'admin@pnl.ac.id',
        password: 'admin123',
        options: {
          data: {
            nama: 'Administrator',
            nim: 'admin',
            role: 'admin'
          }
        }
      });

      if (authError) {
        // If user already exists, try to sign in
        if (authError.message.includes('already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: 'admin@pnl.ac.id',
            password: 'admin123'
          });

          if (signInError) {
            throw signInError;
          }

          if (signInData.user) {
            // Insert/update in public.users table
            await supabase
              .from('users')
              .upsert({
                id: signInData.user.id,
                email: 'admin@pnl.ac.id',
                nim: 'admin',
                nama: 'Administrator',
                role: 'admin',
                level_user: 1
              });
          }
        } else {
          throw authError;
        }
      } else if (authData.user) {
        // Insert into public.users table
        await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: 'admin@pnl.ac.id',
            nim: 'admin',
            nama: 'Administrator',
            role: 'admin',
            level_user: 1
          });
      }

      setShowSetupModal(false);
      alert('Admin user berhasil dibuat! Silakan login dengan NIM: admin dan Password: admin123');
    } catch (error) {
      console.error('Error creating admin user:', error);
      setError('Gagal membuat user admin: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Attempting login with NIM:', nim);
      
      // First, find the user by NIM to get their email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('nim', nim.trim())
        .maybeSingle();

      if (userError) {
        console.error('Error finding user:', userError);
        setError('Terjadi kesalahan saat mencari data pengguna');
        return;
      }

      if (!userData) {
        console.log('User not found with NIM:', nim);
        setError('NIM tidak ditemukan. Pastikan NIM yang Anda masukkan benar atau hubungi administrator.');
        return;
      }

      console.log('User found:', userData);

      // Try to sign in with the user's email and provided password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: password.trim(),
      });

      if (authError) {
        console.error('Authentication failed:', authError);
        if (authError.message.includes('Invalid login credentials')) {
          setError('NIM atau password salah');
        } else {
          setError('Terjadi kesalahan saat login: ' + authError.message);
        }
        return;
      }

      if (!authData.user) {
        console.error('No user returned from auth');
        setError('Login gagal');
        return;
      }

      console.log('Login successful:', authData.user);

      // Store user data in localStorage for easy access
      const appUser = {
        id: authData.user.id,
        email: authData.user.email!,
        nama: userData.nama || undefined,
        nim: userData.nim || undefined,
        role: userData.role || undefined,
        level_user: userData.level_user || undefined,
        nama_wali: userData.nama_wali || undefined,
        no_wa_wali: userData.no_wa_wali || undefined,
        nama_dosen_pembimbing: userData.nama_dosen_pembimbing || undefined,
        no_wa_dosen_pembimbing: userData.no_wa_dosen_pembimbing || undefined,
      };

      localStorage.setItem('user', JSON.stringify(appUser));
      console.log('User data stored in localStorage:', appUser);

      // Update user state immediately
      setUser(appUser);
      
      // Small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      // Navigate based on user type
      if (userData.level_user === 1) {
        console.log('Navigating to admin dashboard');
        navigate('/dashboard');
      } else {
        console.log('Navigating to student clustering page');
        navigate('/clustering-pribadi');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Terjadi kesalahan saat login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">DBSCAN Clustering</h1>
          <p className="text-gray-600 mt-2">Sistem Pengelompokan Kedisiplinan Mahasiswa</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              NIM / Username
            </label>
            <div className="relative">
              <UserCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={nim}
                onChange={(e) => setNim(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150"
                placeholder="Masukkan NIM Anda"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150"
                placeholder="Masukkan password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm">{error}</span>
                {error.includes('NIM tidak ditemukan') && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowSetupModal(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Setup Admin User
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Login
              </>
            )}
          </button>
        </form>

        <div className="mt-8 space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-3">
              Informasi Login:
            </p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Untuk Mahasiswa:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Username:</strong> NIM Anda</li>
              <li>• <strong>Password:</strong> NIM Anda (default)</li>
              <li>• Contoh: NIM 2023001, maka username dan password adalah 2023001</li>
              <li>• Password dapat diubah setelah login pertama</li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">Untuk Admin:</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• <strong>Username:</strong> admin</li>
              <li>• <strong>Password:</strong> admin123</li>
            </ul>
          </div>

          <div className="text-center">
            <button
              onClick={() => setShowSetupModal(true)}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center justify-center mx-auto"
            >
              <Settings className="w-4 h-4 mr-1" />
              Setup Database
            </button>
          </div>
        </div>
      </div>

      {/* Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Setup Database</h3>
            <p className="text-gray-600 mb-6">
              Klik tombol di bawah untuk membuat user admin dan setup database awal.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowSetupModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors duration-150"
              >
                Batal
              </button>
              <button
                onClick={createAdminUser}
                disabled={loading}
                className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-150 disabled:opacity-50"
              >
                {loading ? 'Setup...' : 'Setup Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}