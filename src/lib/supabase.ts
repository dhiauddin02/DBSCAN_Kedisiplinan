import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface User {
  id: string;
  nama: string;
  nim: string;
  email: string;
  nama_wali?: string;
  no_wa_wali?: string;
  nama_dosen_pembimbing?: string;
  no_wa_dosen_pembimbing?: string;
  level_user: number; // 1 = admin, 0 = student
  role: string;
}

export interface Periode {
  id: string;
  nama_periode: string;
  tahun_ajaran: string;
  semester?: string;
}

export interface Batch {
  id: string;
  nama_batch: string;
  tgl_batch: string;
  id_periode: string;
  periode?: Periode;
}

export interface HasilClustering {
  id: string;
  id_user: string;
  id_batch: string;
  nim: string;
  nama_mahasiswa: string;
  tingkat: string;
  kelas: string;
  total_a: number;
  jp: number;
  kedisiplinan: string;
  cluster: string;
  insight: string;
  nilai_matkul: any;
  status_pesan: string;
  user?: User;
  batch?: Batch;
}