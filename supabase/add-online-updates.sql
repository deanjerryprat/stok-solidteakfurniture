-- ============================================================
-- PEMBARUAN ONLINE TERBARU (aman dijalankan berulang)
-- Tambah kolom untuk: Admin yang Menangani, Karyawan yang Dipegang,
-- Jabatan karyawan, barang kembali borong/servis/sampel, dan QC -> barang masuk.
--
-- Jalankan di Supabase Dashboard -> SQL Editor -> New query -> Run
-- pada project yang SUDAH ada. Tidak menghapus data apa pun.
-- ============================================================

-- 1. Distribusi: admin yang menangani (mis. admin gudang yang memegang Ulin)
alter table public.distributions add column if not exists "handledById" text;
alter table public.distributions add column if not exists "handledByName" text;

-- 2. Borong: admin, karyawan yang dipegang, dan pemborong
alter table public.borong add column if not exists "handledById" text;
alter table public.borong add column if not exists "handledByName" text;
alter table public.borong add column if not exists "workerName" text;

-- 3. Gaji karyawan: jabatan dalam perusahaan
alter table public.wages add column if not exists "position" text;

-- 4. Barang kembali dari borong obat / servis / pinjaman sampel
alter table public.returns add column if not exists "source" text;
alter table public.returns add column if not exists "partyName" text;

-- 5. QC yang sudah dibuatkan barang masuk (mencegah stok dobel)
alter table public.qc add column if not exists "inboundId" text;

-- Pastikan role anon/authenticated tetap punya akses ke semua tabel,
-- termasuk tabel borong yang mungkin baru dibuat.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- Pastikan RLS + policy aktif untuk semua tabel aplikasi (termasuk borong)
do $$
declare t text;
begin
  foreach t in array array[
    'products','artisans','inbound','outbound','distributions','returns',
    'qc','spk','wages','borong','users'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists app_all on public.%I', t);
    execute format('create policy app_all on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Isi jabatan untuk data gaji lama yang belum punya jabatan
update public.wages set "position" = 'Manager/Mandor/Angkat Junjung'
  where ("position" is null or "position" = '') and employee = 'Rizky Prasetyo';
update public.wages set "position" = 'Pemborong Amplas'
  where ("position" is null or "position" = '') and employee = 'Sinta Wulandari';
update public.wages set "position" = 'Pemborong Packing'
  where ("position" is null or "position" = '') and employee = 'Agus Saliman';

-- Data lama returns dianggap berasal dari pengrajin
update public.returns set "source" = 'Pengrajin'
  where "source" is null or "source" = '';

notify pgrst, 'reload schema';

-- Verifikasi: kolom harus muncul
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'distributions' and column_name in ('handledById','handledByName'))
    or (table_name = 'borong' and column_name in ('handledById','handledByName','workerName'))
    or (table_name = 'wages' and column_name = 'position')
    or (table_name = 'returns' and column_name in ('source','partyName'))
    or (table_name = 'qc' and column_name = 'inboundId'))
order by table_name, column_name;
