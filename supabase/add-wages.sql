-- ============================================================
-- TAMBAHAN: tabel Gaji Karyawan untuk project Supabase yang SUDAH ada
-- Jalankan di Supabase Dashboard → SQL Editor → New query → Run
-- Aman dijalankan berulang; tidak menghapus data existing.
-- ============================================================

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

grant select, insert, update, delete on public.wages to anon, authenticated;

alter table public.wages enable row level security;
drop policy if exists app_all on public.wages;
create policy app_all on public.wages for all to anon, authenticated
  using (true) with check (true);

-- Data contoh (10 baris) — hanya diisi jika tabel masih kosong
insert into public.wages (id, date, employee, "dailyWage", "overtimeRate", days, "overtimeHours", notes, "createdAt")
select * from (values
  ('WG001', to_char(current_date - 9, 'YYYY-MM-DD'), 'Rizky Prasetyo',  150000, 25000, 1, 2, 'Lembur finishing kursi', now()::text),
  ('WG002', to_char(current_date - 9, 'YYYY-MM-DD'), 'Sinta Wulandari', 140000, 20000, 1, 0, '', now()::text),
  ('WG003', to_char(current_date - 8, 'YYYY-MM-DD'), 'Agus Saliman',    160000, 25000, 1, 1, 'Lembur perakitan', now()::text),
  ('WG004', to_char(current_date - 7, 'YYYY-MM-DD'), 'Rizky Prasetyo',  150000, 25000, 1, 3, 'Lembur pengiriman', now()::text),
  ('WG005', to_char(current_date - 6, 'YYYY-MM-DD'), 'Sinta Wulandari', 140000, 20000, 1, 1, '', now()::text),
  ('WG006', to_char(current_date - 5, 'YYYY-MM-DD'), 'Agus Saliman',    160000, 25000, 1, 0, '', now()::text),
  ('WG007', to_char(current_date - 3, 'YYYY-MM-DD'), 'Rizky Prasetyo',  150000, 25000, 1, 2, 'Lembur finishing', now()::text),
  ('WG008', to_char(current_date - 2, 'YYYY-MM-DD'), 'Sinta Wulandari', 140000, 20000, 1, 0, '', now()::text),
  ('WG009', to_char(current_date - 1, 'YYYY-MM-DD'), 'Agus Saliman',    160000, 25000, 1, 2, 'Lembur packing', now()::text),
  ('WG010', to_char(current_date,     'YYYY-MM-DD'), 'Rizky Prasetyo',  150000, 25000, 1, 1, 'Masuk hari ini', now()::text)
) as v(id, date, employee, daily_wage, overtime_rate, days, overtime_hours, notes, created_at)
where not exists (select 1 from public.wages);

notify pgrst, 'reload schema';

select count(*) as jumlah_data_gaji from public.wages;
