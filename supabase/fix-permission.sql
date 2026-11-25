-- ============================================================
-- PERBAIKAN CEPAT: "permission denied for table users"
-- Jalankan di Supabase Dashboard → SQL Editor → New query → Run
-- Aman dijalankan berulang kali.
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- Pastikan RLS + policy aktif untuk semua tabel aplikasi
do $$
declare t text;
begin
  foreach t in array array[
    'products','artisans','inbound','outbound','distributions','returns','qc','spk','wages','borong','users'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists app_all on public.%I', t);
    execute format('create policy app_all on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Uji: harus mengembalikan 5 baris akun demo
select id, username, role, active from public.users order by id;
