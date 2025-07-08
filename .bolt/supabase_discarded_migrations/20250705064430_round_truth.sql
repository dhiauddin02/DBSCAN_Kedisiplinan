/*
  # Setup Admin User dan Database

  1. Tables
    - `users` - Data pengguna (admin & mahasiswa)
    - `periode` - Periode akademik  
    - `batch` - Batch clustering
    - `hasil_clustering` - Hasil clustering mahasiswa

  2. Security
    - Enable RLS pada semua tabel
    - Policies untuk akses data

  3. Admin User
    - Buat user admin default dengan NIM: admin, Password: admin123
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  nim text UNIQUE,
  nama text,
  nama_wali text,
  no_wa_wali text,
  nama_dosen_pembimbing text,
  no_wa_dosen_pembimbing text,
  role text DEFAULT 'mahasiswa',
  level_user integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create periode table
CREATE TABLE IF NOT EXISTS periode (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_periode text NOT NULL,
  tahun_ajaran text,
  semester text,
  created_at timestamptz DEFAULT now()
);

-- Create batch table
CREATE TABLE IF NOT EXISTS batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_batch text NOT NULL,
  tgl_batch date DEFAULT CURRENT_DATE,
  id_periode uuid REFERENCES periode(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create hasil_clustering table
CREATE TABLE IF NOT EXISTS hasil_clustering (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_user uuid REFERENCES users(id) ON DELETE CASCADE,
  id_batch uuid REFERENCES batch(id) ON DELETE CASCADE,
  nim text,
  nama_mahasiswa text,
  tingkat text,
  kelas text,
  total_a integer DEFAULT 0,
  jp integer DEFAULT 0,
  kedisiplinan text,
  cluster text,
  insight text,
  nilai_matkul jsonb,
  status_pesan text DEFAULT 'belum terkirim',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE periode ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE hasil_clustering ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin can read all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND level_user = 1
    )
  );

CREATE POLICY "Admin can insert users" ON users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND level_user = 1
    )
  );

CREATE POLICY "Admin can update all users" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND level_user = 1
    )
  );

CREATE POLICY "Admin can delete users" ON users
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND level_user = 1
    )
  );

-- RLS Policies for periode table
CREATE POLICY "Admin can manage periode" ON periode
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND level_user = 1
    )
  );

CREATE POLICY "Users can read periode" ON periode
  FOR SELECT USING (true);

-- RLS Policies for batch table
CREATE POLICY "Admin can manage batch" ON batch
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND level_user = 1
    )
  );

CREATE POLICY "Users can read batch" ON batch
  FOR SELECT USING (true);

-- RLS Policies for hasil_clustering table
CREATE POLICY "Admin can manage clustering results" ON hasil_clustering
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND level_user = 1
    )
  );

CREATE POLICY "Users can read own clustering results" ON hasil_clustering
  FOR SELECT USING (id_user = auth.uid());

-- Insert admin user
-- First, we need to create the auth user, then insert into our users table
-- Note: In production, you should change the admin password

DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Check if admin user already exists
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@pnl.ac.id';
  
  IF admin_user_id IS NULL THEN
    -- Create admin user in auth.users (this is a simplified approach)
    -- In real implementation, you'd use Supabase dashboard or API
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@pnl.ac.id',
      crypt('admin123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      false,
      '',
      '',
      '',
      ''
    ) RETURNING id INTO admin_user_id;
  END IF;

  -- Insert or update admin user in public.users
  INSERT INTO users (
    id,
    email,
    nim,
    nama,
    role,
    level_user,
    created_at,
    updated_at
  ) VALUES (
    admin_user_id,
    'admin@pnl.ac.id',
    'admin',
    'Administrator',
    'admin',
    1,
    now(),
    now()
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nim = EXCLUDED.nim,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    level_user = EXCLUDED.level_user,
    updated_at = now();

EXCEPTION WHEN OTHERS THEN
  -- If the above doesn't work (auth.users might not be accessible), 
  -- we'll create a placeholder that can be updated later
  INSERT INTO users (
    id,
    email,
    nim,
    nama,
    role,
    level_user,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@pnl.ac.id',
    'admin',
    'Administrator',
    'admin',
    1,
    now(),
    now()
  ) ON CONFLICT (nim) DO UPDATE SET
    email = EXCLUDED.email,
    nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    level_user = EXCLUDED.level_user,
    updated_at = now();
END $$;

-- Create some sample data
INSERT INTO periode (nama_periode, tahun_ajaran, semester) VALUES
  ('Ganjil 2024/2025', '2024/2025', 'Ganjil'),
  ('Genap 2023/2024', '2023/2024', 'Genap')
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_nim ON users(nim);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_level ON users(level_user);
CREATE INDEX IF NOT EXISTS idx_hasil_clustering_user ON hasil_clustering(id_user);
CREATE INDEX IF NOT EXISTS idx_hasil_clustering_batch ON hasil_clustering(id_batch);