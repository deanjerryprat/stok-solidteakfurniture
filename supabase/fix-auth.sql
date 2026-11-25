-- ============================================================
-- PERBAIKAN LOGIN: "function digest(text, unknown) does not exist"
-- Jalankan di Supabase Dashboard → SQL Editor → New query → Run
-- Aman dijalankan berulang kali; tidak menghapus data.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

create or replace function public.authenticate(p_username text, p_password text)
returns table(id text, username text, name text, role text, active boolean)
language plpgsql
security definer
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

-- PostgREST perlu memuat ulang daftar fungsi setelah CREATE OR REPLACE FUNCTION
notify pgrst, 'reload schema';

-- Uji: harus mengembalikan 1 baris ADMIN (tanpa error digest)
select id, username, role, active
from public.authenticate('admin', 'admin123');
