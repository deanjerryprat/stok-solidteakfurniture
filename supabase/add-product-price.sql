-- ============================================================
-- TAMBAHAN: kolom Harga Barang pada tabel products
-- Jalankan di Supabase Dashboard → SQL Editor → New query → Run
-- Aman dijalankan berulang; data existing tidak dihapus.
-- Perlu dijalankan hanya jika supabase/add-borong.sql sudah pernah dijalankan.
-- ============================================================

alter table public.products add column if not exists "price" numeric default 0;

grant select, insert, update, delete on public.products to anon, authenticated;

notify pgrst, 'reload schema';

select count(*) as jumlah_produk from public.products;
