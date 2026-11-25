-- ============================================================
-- GANTI PASSWORD BAWAAN (5 AKUN) DI PROJECT SUPABASE YANG SUDAH ADA
-- Jalankan di Supabase Dashboard → SQL Editor → New query → Run
-- Aman untuk project lama: hanya mengubah akun bawaan yang masih
-- memakai password lama. Password yang sudah diubah manual tidak
-- akan ditimpa. Tidak menghapus data stok/transaksi.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- admin
update public.users
set password = encode(extensions.digest('furn|Jati2026!Admin', 'sha256'), 'hex')
where id = 'U1'
  and password = encode(extensions.digest('furn|admin123', 'sha256'), 'hex');

-- gudang
update public.users
set password = encode(extensions.digest('furn|Jati2026!Gudang', 'sha256'), 'hex')
where id = 'U2'
  and password = encode(extensions.digest('furn|gudang123', 'sha256'), 'hex');

-- purchasing
update public.users
set password = encode(extensions.digest('furn|Jati2026!Purchasing', 'sha256'), 'hex')
where id = 'U3'
  and password = encode(extensions.digest('furn|purchasing123', 'sha256'), 'hex');

-- produksi
update public.users
set password = encode(extensions.digest('furn|Jati2026!Produksi', 'sha256'), 'hex')
where id = 'U4'
  and password = encode(extensions.digest('furn|produksi123', 'sha256'), 'hex');

-- manager
update public.users
set password = encode(extensions.digest('furn|Jati2026!Manager', 'sha256'), 'hex')
where id = 'U5'
  and password = encode(extensions.digest('furn|manager123', 'sha256'), 'hex');

notify pgrst, 'reload schema';

-- Verifikasi: kelima query di bawah harus mengembalikan 1 baris.
select 'admin' as akun, id, username, role from public.authenticate('admin', 'Jati2026!Admin')
union all
select 'gudang', id, username, role from public.authenticate('gudang', 'Jati2026!Gudang')
union all
select 'purchasing', id, username, role from public.authenticate('purchasing', 'Jati2026!Purchasing')
union all
select 'produksi', id, username, role from public.authenticate('produksi', 'Jati2026!Produksi')
union all
select 'manager', id, username, role from public.authenticate('manager', 'Jati2026!Manager');
