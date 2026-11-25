-- ============================================================
-- SCHEMA SUPABASE — Sistem Stok Furniture
-- Jalankan seluruh isi file ini di Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- TABEL ----------
create table if not exists public.products (
  id text primary key,
  sku text,
  name text,
  category text,
  size text,
  status text,
  "minStock" integer default 0,
  photo text,
  notes text,
  "createdAt" text
);

create table if not exists public.artisans (
  id text primary key,
  name text,
  address text,
  phone text,
  specialization text,
  "productTypes" text[] default '{}',
  active boolean default true,
  notes text,
  "createdAt" text
);

create table if not exists public.inbound (
  id text primary key,
  date text,
  supplier text,
  "productId" text,
  sku text,
  "productName" text,
  qty integer default 0,
  condition text,
  notes text,
  receiver text,
  "createdAt" text
);

create table if not exists public.outbound (
  id text primary key,
  date text,
  type text,
  "productId" text,
  sku text,
  "productName" text,
  qty integer default 0,
  destination text,
  "artisanReceiver" text,
  "suratJalan" text,
  staff text,
  notes text,
  "createdAt" text
);

create table if not exists public.distributions (
  id text primary key,
  date text,
  "artisanId" text,
  "artisanName" text,
  "productId" text,
  sku text,
  "productName" text,
  qty integer default 0,
  "targetDate" text,
  proof text,
  "spkId" text,
  notes text,
  "createdAt" text
);

create table if not exists public.returns (
  id text primary key,
  date text,
  "distributionId" text,
  "artisanId" text,
  "artisanName" text,
  "productId" text,
  sku text,
  "productName" text,
  qty integer default 0,
  "afkirQty" integer default 0,
  "goodQty" integer default 0,
  notes text,
  "createdAt" text
);

create table if not exists public.qc (
  id text primary key,
  date text,
  "productId" text,
  sku text,
  "productName" text,
  qty integer default 0,
  "passedQty" integer default 0,
  "rejectedQty" integer default 0,
  status text,
  notes text,
  "createdAt" text
);

create table if not exists public.spk (
  id text primary key,
  no text,
  date text,
  "artisanId" text,
  "productId" text,
  qty integer default 0,
  "targetDate" text,
  status text,
  notes text,
  "createdAt" text
);

create table if not exists public.wages (
  id text primary key,
  date text,
  employee text,
  "dailyWage" numeric default 0,
  "overtimeRate" numeric default 0,
  days numeric default 1,
  "overtimeHours" numeric default 0,
  notes text,
  "createdAt" text
);

create table if not exists public.users (
  id text primary key,
  username text unique not null,
  password text not null,
  name text,
  role text,
  active boolean default true
);

-- ---------- HAK AKSES ROLE anon / authenticated ----------
-- Supabase memakai role anon untuk publishable/anon key. Tanpa GRANT ini,
-- RLS policy saja tidak cukup dan query akan gagal dengan:
-- "permission denied for table users".
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- ---------- ROW LEVEL SECURITY ----------
-- CATATAN: policy di bawah membuka akses penuh untuk demo/internal.
-- Untuk produksi yang benar-benar aman, ganti dengan policy berbasis auth.uid()
-- dan gunakan Supabase Auth. Baca README untuk catatan keamanan.
alter table public.products      enable row level security;
alter table public.artisans      enable row level security;
alter table public.inbound       enable row level security;
alter table public.outbound      enable row level security;
alter table public.distributions enable row level security;
alter table public.returns       enable row level security;
alter table public.qc            enable row level security;
alter table public.spk           enable row level security;
alter table public.wages         enable row level security;
alter table public.users         enable row level security;

drop policy if exists app_all on public.products;
drop policy if exists app_all on public.artisans;
drop policy if exists app_all on public.inbound;
drop policy if exists app_all on public.outbound;
drop policy if exists app_all on public.distributions;
drop policy if exists app_all on public.returns;
drop policy if exists app_all on public.qc;
drop policy if exists app_all on public.spk;
drop policy if exists app_all on public.wages;
drop policy if exists app_all on public.users;

create policy app_all on public.products      for all to anon, authenticated using (true) with check (true);
create policy app_all on public.artisans      for all to anon, authenticated using (true) with check (true);
create policy app_all on public.inbound       for all to anon, authenticated using (true) with check (true);
create policy app_all on public.outbound      for all to anon, authenticated using (true) with check (true);
create policy app_all on public.distributions for all to anon, authenticated using (true) with check (true);
create policy app_all on public.returns       for all to anon, authenticated using (true) with check (true);
create policy app_all on public.qc            for all to anon, authenticated using (true) with check (true);
create policy app_all on public.spk           for all to anon, authenticated using (true) with check (true);
create policy app_all on public.wages         for all to anon, authenticated using (true) with check (true);
create policy app_all on public.users         for all to anon, authenticated using (true) with check (true);

-- ---------- FUNGSI LOGIN ----------
-- Password diverifikasi di server memakai SHA-256 (pgcrypto).
create or replace function public.authenticate(p_username text, p_password text)
returns table(id text, username text, name text, role text, active boolean)
language plpgsql
security definer
-- pgcrypto di Supabase biasanya terpasang di schema "extensions", bukan public.
-- Tanpa schema itu, digest() akan error: "function digest(text, unknown) does not exist".
set search_path = public, extensions
as $$
begin
  return query
  select u.id, u.username, u.name, u.role, u.active
  from public.users u
  where lower(u.username) = lower(p_username)
    and u.active = true
    and u.password = encode(digest('furn|' || p_password, 'sha256'), 'hex');
end;
$$;

grant execute on function public.authenticate(text, text) to anon, authenticated;

-- ---------- AKUN DEMO ----------
insert into public.users (id, username, password, name, role, active) values
  ('U1', 'admin',      encode(digest('furn|admin123', 'sha256'), 'hex'), 'Administrator',      'ADMIN',      true),
  ('U2', 'gudang',     encode(digest('furn|gudang123', 'sha256'), 'hex'), 'Budi (Gudang)',      'GUDANG',     true),
  ('U3', 'purchasing', encode(digest('furn|purchasing123', 'sha256'), 'hex'), 'Sari (Purchasing)', 'PURCHASING', true),
  ('U4', 'produksi',   encode(digest('furn|produksi123', 'sha256'), 'hex'), 'Rangga (Produksi)',  'PRODUKSI',   true),
  ('U5', 'manager',    encode(digest('furn|manager123', 'sha256'), 'hex'), 'Pak Direktur',       'MANAGER',    true)
on conflict (id) do nothing;

-- Selesai. Kembali ke aplikasi → menu Pengaturan → masukkan Project URL dan publishable/anon key → Aktifkan Supabase.
-- Key bisa ditemukan lewat tombol Connect di dashboard project, atau Settings → API Keys.
-- Data contoh (10 produk, 10 pengrajin, transaksi) akan otomatis diunggah dari aplikasi pada koneksi pertama kali.
