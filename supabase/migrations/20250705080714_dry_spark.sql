/*
  # Auto Delete Auth User Migration

  1. Fungsi dan Trigger
    - Membuat fungsi `handle_delete_user_from_auth()` untuk menghapus user dari auth.users
    - Membuat trigger `on_public_users_delete` yang akan dijalankan sebelum DELETE pada public.users
    - Fungsi menggunakan SECURITY DEFINER untuk akses ke auth.users

  2. Keamanan
    - Trigger hanya berjalan pada operasi DELETE
    - Menggunakan OLD.id untuk memastikan ID yang benar dihapus
    - SECURITY DEFINER memungkinkan akses ke tabel auth.users

  3. Catatan
    - Trigger akan berjalan BEFORE DELETE untuk memastikan data auth masih ada saat dihapus
    - Fungsi akan mengembalikan OLD untuk melanjutkan operasi DELETE normal
*/

-- Buat fungsi untuk menghapus user dari auth.users
CREATE OR REPLACE FUNCTION public.handle_delete_user_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Log untuk debugging (opsional)
  RAISE LOG 'Deleting user from auth.users with id: %', OLD.id;
  
  -- Hapus pengguna dari tabel auth.users menggunakan ID dari baris yang dihapus di public.users
  DELETE FROM auth.users WHERE id = OLD.id;
  
  -- Log konfirmasi (opsional)
  RAISE LOG 'User deleted from auth.users with id: %', OLD.id;
  
  -- Kembalikan OLD untuk melanjutkan operasi DELETE normal
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Buat trigger yang akan memanggil fungsi saat DELETE pada public.users
DROP TRIGGER IF EXISTS on_public_users_delete ON public.users;

CREATE TRIGGER on_public_users_delete
  BEFORE DELETE ON public.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_delete_user_from_auth();

-- Berikan komentar pada fungsi untuk dokumentasi
COMMENT ON FUNCTION public.handle_delete_user_from_auth() IS 
'Fungsi yang secara otomatis menghapus user dari auth.users ketika user dihapus dari public.users';

-- Berikan komentar pada trigger untuk dokumentasi
COMMENT ON TRIGGER on_public_users_delete ON public.users IS 
'Trigger yang menjalankan penghapusan otomatis dari auth.users saat user dihapus dari public.users';