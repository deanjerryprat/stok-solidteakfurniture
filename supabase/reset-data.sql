-- ============================================================
-- RESET DATA SAJA (struktur, kolom, policy, dan fungsi tetap ada)
-- ============================================================
-- Gunakan ini kalau ingin mengulang dari data kosong tanpa
-- menghapus tabel/hak akses. Password bawaan akan dibuat lagi
-- oleh schema.sql / update-passwords.sql.
--
-- PERINGATAN: menghapus SEMUA baris di tabel aplikasi.
-- Backup dulu: aplikasi -> Pengaturan -> ⬇ Backup JSON.
-- ============================================================

truncate table
  public.inbound,
  public.outbound,
  public.distributions,
  public.returns,
  public.qc,
  public.spk,
  public.wages,
  public.borong,
  public.boxes,
  public.products,
  public.artisans,
  public.users;

-- Setelah query ini selesai, jalankan supabase/schema.sql secara terpisah
-- di SQL Editor untuk mengembalikan 5 akun bawaan.
notify pgrst, 'reload schema';

select 'products' tabel, count(*) from public.products
union all select 'artisans', count(*) from public.artisans
union all select 'users', count(*) from public.users
union all select 'wages', count(*) from public.wages
union all select 'borong', count(*) from public.borong
union all select 'boxes', count(*) from public.boxes;
