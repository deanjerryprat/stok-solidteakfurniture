-- ============================================================
-- TAMBAHAN: Stok Box & Kubikasi
-- Jalankan di Supabase Dashboard -> SQL Editor -> New query -> Run
-- Aman dijalankan berulang; tidak menghapus data existing.
-- ============================================================

create table if not exists public.boxes (
  id text primary key,
  "productId" text,
  "productSku" text,
  "productName" text,
  code text,
  name text,
  "sizeDetail" text,
  "lengthCm" numeric default 0,
  "widthCm" numeric default 0,
  "heightCm" numeric default 0,
  "volumeM3" numeric default 0,
  qty numeric default 0,
  "minQty" numeric default 0,
  location text,
  notes text,
  "createdAt" text
);

-- Aman jika tabel boxes sudah ada dari versi sebelumnya.
alter table public.boxes add column if not exists "productId" text;
alter table public.boxes add column if not exists "productSku" text;
alter table public.boxes add column if not exists "productName" text;

grant select, insert, update, delete on public.boxes to anon, authenticated;
grant usage on schema public to anon, authenticated;

alter table public.boxes enable row level security;
drop policy if exists app_all on public.boxes;
create policy app_all on public.boxes for all to anon, authenticated
  using (true) with check (true);

notify pgrst, 'reload schema';

-- Verifikasi
select count(*) as jumlah_box from public.boxes;
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'boxes'
  and column_name in ('productId','productSku','productName')
order by column_name;
