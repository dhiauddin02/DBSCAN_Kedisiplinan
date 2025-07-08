# Panduan Setup Project Student Clustering DBSCAN

## Prasyarat
- Node.js (versi 18 atau lebih baru)
- npm atau yarn
- Akun Supabase
- Git (opsional)

## Langkah-langkah Setup

### 1. Clone atau Download Project
```bash
git clone <repository-url>
cd student-clustering-dbscan
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Supabase

#### A. Buat Project Supabase
1. Kunjungi [supabase.com](https://supabase.com)
2. Buat akun atau login
3. Klik "New Project"
4. Isi nama project dan password database
5. Tunggu hingga project selesai dibuat

#### B. Dapatkan Credentials
1. Di dashboard Supabase, buka tab "Settings" > "API"
2. Copy `Project URL` dan `anon public` key

#### C. Setup Database
1. Di dashboard Supabase, buka tab "SQL Editor"
2. Copy dan jalankan script dari file `supabase/migrations/20250628185427_floral_rain.sql`
3. Tunggu hingga selesai eksekusi

### 4. Konfigurasi Environment Variables

#### A. Copy file environment
```bash
cp .env.example .env
```

#### B. Edit file .env
```env
# Wajib diisi
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Opsional (untuk fitur clustering)
VITE_CLUSTERING_API_URL=http://127.0.0.1:5000/cluster

# Opsional (untuk notifikasi WhatsApp)
VITE_FONNTE_TOKEN=your-fonnte-token
```

### 5. Jalankan Development Server
```bash
npm run dev
```

Project akan berjalan di `http://localhost:5173`

## Login Default

Setelah setup database, Anda dapat login dengan:
- **Username (NIM)**: `admin`
- **Password**: `admin123`

## Fitur yang Tersedia

### Tanpa API Eksternal
- ✅ Login/Logout
- ✅ Dashboard admin
- ✅ Manajemen periode dan batch
- ✅ Melihat hasil clustering (jika ada data)
- ✅ Ganti password
- ✅ Lengkapi data mahasiswa

### Dengan API Clustering (Opsional)
- ✅ Upload file Excel untuk clustering
- ✅ Proses clustering DBSCAN
- ✅ Simpan hasil clustering

### Dengan API WhatsApp (Opsional)
- ✅ Kirim notifikasi hasil clustering
- ✅ Export laporan via WhatsApp

## Setup API Eksternal (Opsional)

### API Clustering
Jika Anda memiliki server clustering Python Flask:
1. Pastikan server berjalan di `http://127.0.0.1:5000`
2. Tambahkan URL ke file `.env`

### API WhatsApp (Fonnte)
1. Daftar di [fonnte.com](https://fonnte.com)
2. Dapatkan token API
3. Tambahkan token ke file `.env`

## Troubleshooting

### Error "Cannot connect to clustering service"
- Pastikan `VITE_CLUSTERING_API_URL` dikonfigurasi dengan benar
- Pastikan server clustering berjalan
- Atau hapus konfigurasi ini jika tidak diperlukan

### Error login
- Pastikan database sudah disetup dengan benar
- Cek koneksi Supabase di browser console
- Pastikan credentials Supabase benar

### Error "User not found"
- Pastikan migration database sudah dijalankan
- Cek apakah user admin sudah terbuat di tabel `users`

## Build untuk Production

```bash
npm run build
```

File hasil build akan ada di folder `dist/`

## Struktur Database

Project ini menggunakan 4 tabel utama:
- `users` - Data pengguna (admin & mahasiswa)
- `periode` - Periode akademik
- `batch` - Batch clustering
- `hasil_clustering` - Hasil clustering mahasiswa

Semua tabel sudah dikonfigurasi dengan Row Level Security (RLS) untuk keamanan data.