-- ============================================================
-- TAMBAHAN: Gaji Borong Amplas & Packing
-- Jalankan di Supabase Dashboard → SQL Editor → New query → Run
-- Aman dijalankan berulang; tidak menghapus data existing.
-- ============================================================

-- Harga barang & tarif borong per pcs (diisi satu per satu lewat menu Database Produk)
alter table public.products add column if not exists "price" numeric default 0;
alter table public.products add column if not exists "rateAmplas" numeric default 0;
alter table public.products add column if not exists "ratePacking" numeric default 0;

-- Catatan gaji borong per orang. items = array of
-- { productId, sku, name, qty, rate, overtime }
create table if not exists public.borong (
  id text primary key,
  date text,
  employee text,
  "handledById" text,
  "handledByName" text,
  "workerName" text,
  type text,
  items jsonb default '[]'::jsonb,
  "overtimeExtra" numeric default 0,
  notes text,
  "createdAt" text
);

-- Project lama: tabel borong sudah ada sebelum kolom admin/karyawan ditambahkan.
alter table public.borong add column if not exists "handledById" text;
alter table public.borong add column if not exists "handledByName" text;
alter table public.borong add column if not exists "workerName" text;

grant select, insert, update, delete on public.borong to anon, authenticated;
grant select, insert, update, delete on public.products to anon, authenticated;

alter table public.borong enable row level security;
drop policy if exists app_all on public.borong;
create policy app_all on public.borong for all to anon, authenticated
  using (true) with check (true);

notify pgrst, 'reload schema';

select count(*) as jumlah_data_borong from public.borong;
