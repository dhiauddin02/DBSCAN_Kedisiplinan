# Student Discipline Clustering System

Sistem Pengelompokan Kedisiplinan Mahasiswa menggunakan algoritma DBSCAN untuk Politeknik Negeri Lhokseumawe.

## Fitur Utama

- **Clustering DBSCAN**: Pengelompokan mahasiswa berdasarkan tingkat kedisiplinan
- **Dashboard Admin**: Monitoring dan analisis data clustering
- **Notifikasi WhatsApp**: Pengiriman otomatis hasil clustering ke wali dan dosen pembimbing
- **Laporan Komprehensif**: Generate laporan detail hasil clustering
- **Manajemen User**: Sistem login untuk admin dan mahasiswa

## Teknologi yang Digunakan

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (Database + Authentication)
- **API Clustering**: Python Flask (eksternal)
- **WhatsApp API**: Fonnte
- **Icons**: Lucide React

## Instalasi dan Setup

1. Clone repository ini
2. Install dependencies: `npm install`
3. Setup environment variables di file `.env`
4. Jalankan development server: `npm run dev`

## Environment Variables

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_CLUSTERING_API_URL=http://127.0.0.1:5000/cluster
VITE_FONNTE_TOKEN=your_fonnte_token
```

## Login Default

- **Admin**: NIM: `admin`, Password: `admin123`

---

*Sistem ini dikembangkan untuk mendukung monitoring kedisiplinan mahasiswa di Politeknik Negeri Lhokseumawe.*

<!-- Test comment untuk sinkronisasi GitHub - 2025-01-28 -->"# DBSCAN_Kedisiplinan" 
"# disiplinpnl" 
