import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AppUser {
  id: string;
  email: string;
  nama?: string;
  nim?: string;
  role?: string;
  level_user?: number;
  nama_wali?: string;
  no_wa_wali?: string;
  nama_dosen_pembimbing?: string;
  no_wa_dosen_pembimbing?: string;
}

export const login = async (nim: string, password: string): Promise<AppUser | null> => {
  try {
    console.log('Starting login process for NIM:', nim);
    
    // First, find the user by NIM to get their email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('nim', nim.trim())
      .maybeSingle();

    if (userError) {
      console.error('Error finding user:', userError);
      return null;
    }

    if (!userData) {
      console.log('User not found with NIM:', nim);
      return null;
    }

    console.log('User found:', userData);

    // Try to sign in with the user's email and provided password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password: password.trim(),
    });

    if (authError) {
      console.error('Authentication failed:', authError);
      return null;
    }

    if (!authData.user) {
      console.error('No user returned from auth');
      return null;
    }

    console.log('Authentication successful:', authData.user);

    // Create AppUser object
    const appUser: AppUser = {
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

    // Store user data in localStorage for easy access
    localStorage.setItem('user', JSON.stringify(appUser));
    console.log('User data stored in localStorage:', appUser);
    
    return appUser;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
};

export const logout = async () => {
  try {
    await supabase.auth.signOut();
    localStorage.removeItem('user');
  } catch (error) {
    console.error('Logout error:', error);
    localStorage.removeItem('user');
  }
};

export const getCurrentUser = (): AppUser | null => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const getCurrentAuthUser = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const updatePassword = async (newPassword: string): Promise<boolean> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Update password error:', error);
    return false;
  }
};

// Function to save user profile data to public.users
export const saveUserProfile = async (profileData: {
  nama: string;
  nim: string;
  nama_wali?: string;
  no_wa_wali?: string;
  nama_dosen_pembimbing?: string;
  no_wa_dosen_pembimbing?: string;
}): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user found');
    }

    // Check if user profile already exists
    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    // Check if NIM is already used by another user
    const { data: nimCheck } = await supabase
      .from('users')
      .select('id')
      .eq('nim', profileData.nim)
      .neq('id', user.id)
      .maybeSingle();

    if (nimCheck) {
      throw new Error('NIM sudah digunakan oleh pengguna lain');
    }

    const userData = {
      id: user.id,
      email: user.email!,
      nama: profileData.nama,
      nim: profileData.nim,
      role: 'mahasiswa',
      level_user: 0,
      nama_wali: profileData.nama_wali,
      no_wa_wali: profileData.no_wa_wali,
      nama_dosen_pembimbing: profileData.nama_dosen_pembimbing,
      no_wa_dosen_pembimbing: profileData.no_wa_dosen_pembimbing,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from('users')
        .update(userData)
        .eq('id', user.id);

      if (error) throw error;
    } else {
      // Insert new profile
      const { error } = await supabase
        .from('users')
        .insert(userData);

      if (error) throw error;
    }

    // Update localStorage with complete user data
    const updatedUser: AppUser = {
      id: user.id,
      email: user.email!,
      ...profileData,
      role: 'mahasiswa',
      level_user: 0,
    };
    localStorage.setItem('user', JSON.stringify(updatedUser));

    return true;
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
  }
};

// Check if user is authenticated
export const checkAuth = async (): Promise<AppUser | null> => {
  try {
    console.log('checkAuth - starting auth check');
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.log('checkAuth - no auth user found, clearing localStorage');
      localStorage.removeItem('user');
      return null;
    }

    console.log('checkAuth - auth user found:', user.id);
    // Try to get user data from our custom table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    console.log('checkAuth - userData from database:', userData);
    // Create AppUser object (userData might be null if profile not completed)
    const appUser: AppUser = {
      id: user.id,
      email: user.email!,
      nama: userData?.nama || undefined,
      nim: userData?.nim || undefined,
      role: userData?.role || undefined,
      level_user: userData?.level_user || undefined,
      nama_wali: userData?.nama_wali || undefined,
      no_wa_wali: userData?.no_wa_wali || undefined,
      nama_dosen_pembimbing: userData?.nama_dosen_pembimbing || undefined,
      no_wa_dosen_pembimbing: userData?.no_wa_dosen_pembimbing || undefined,
    };

    console.log('checkAuth - final appUser:', appUser);
    localStorage.setItem('user', JSON.stringify(appUser));
    return appUser;
  } catch (error) {
    console.error('Auth check error:', error);
    localStorage.removeItem('user');
    return null;
  }
};