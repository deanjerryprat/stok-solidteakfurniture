-- ============================================================
-- RESET STRUKTUR PENUH (tabel + fungsi login dihapus)
-- ============================================================
-- PERINGATAN: ini menghapus SEMUA tabel dan data di project Supabase.
-- Backup dulu: aplikasi -> Pengaturan -> ⬇ Backup JSON.
--
-- Cara pakai:
-- 1. Jalankan file ini di SQL Editor -> Run.
-- 2. Jalankan supabase/schema.sql (membuat semua tabel + akun bawaan).
-- 3. Jalankan supabase/add-online-updates.sql (verifikasi kolom terbaru).
-- 4. Di aplikasi: Pengaturan -> Kembali ke mode lokal -> Aktifkan Supabase
--    agar data lokal di-upload ke project yang sudah bersih.
-- ============================================================

drop table if exists
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
  public.users
  cascade;

drop function if exists public.authenticate(text, text) cascade;

notify pgrst, 'reload schema';

select 'tabel tersisa' as info, count(*) as jumlah
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'products','artisans','inbound','outbound','distributions','returns',
    'qc','spk','wages','borong','boxes','users'
  );
