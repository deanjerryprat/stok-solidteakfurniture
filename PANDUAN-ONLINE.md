# Panduan Mode Online — Supabase + GitHub

Panduan ini untuk menyambungkan **semua pembaruan terbaru** ke mode online:

- Form **Distribusi & Tugas Borong**: ada **Admin yang Menangani** setelah tanggal.
- Form **Tugas Borong Harian**: ada admin, karyawan yang dipegang (mis. Ulin), dan nama pemborong.
- **Gaji Karyawan**: ada **Jabatan** (`Manager`, `Mandor`, `Angkat Junjung`, `Pemborong Amplas`, `Pemborong Packing`) dan daftar nama karyawan di atas catatan gaji harian.
- Barang kembali dari **Borong Obat / Servis / Pinjaman Sampel** → QC → **Buat Masuk**.
- Panel **Informasi Produksi & Gudang** dan **Pengawasan Harian** di dashboard/borong.

> File SQL di bawah **aman dijalankan berulang** dan **tidak menghapus data**. Jalankan satu file per query di Supabase SQL Editor.

---

## 0. Persiapan

1. **Backup dulu.** Di aplikasi: login → menu **Pengaturan** → tombol **⬇ Backup JSON**. Simpan file backup-nya.
2. Pastikan aplikasi sudah memakai project Supabase yang benar. URL dan publishable key sudah tertanam di `js/config.js`.
3. **Jangan pernah pakai secret key** (`sb_secret_...` / `service_role`). Pakai `sb_publishable_...` atau anon key lama (`eyJ...`).
4. Setelah update, browser wajib **Ctrl + F5** (hard reload) supaya file `?v=25` termuat.

---

## 1. Update Supabase

Buka <https://supabase.com> → pilih project `tbgdavjlonpejifrijgj` → **SQL Editor** → **New query**.

### 1A. Untuk project yang SUDAH ada (project lama)

Jalankan **berurutan**, satu file per query, klik **Run** tiap selesai:

| No | File SQL | Fungsi | Kapan penting |
|----|----------|--------|---------------|
| 1 | `supabase/fix-auth.sql` | Memperbaiki fungsi login `authenticate()` | Error `function digest(text, unknown) does not exist` |
| 2 | `supabase/fix-permission.sql` | GRANT + RLS policy, termasuk tabel `borong` dan `boxes` | Error `permission denied for table ...` |
| 3 | `supabase/add-wages.sql` | Tabel `wages` + kolom `position` + 10 data contoh | Tabel gaji belum ada |
| 4 | `supabase/add-borong.sql` | Tabel `borong`, kolom `price`, `rateAmplas`, `ratePacking` | Error `404 /rest/v1/borong` |
| 5 | `supabase/add-product-price.sql` | Kolom `price` saja | Hanya jika `add-borong.sql` pernah dijalankan sebelum kolom `price` ditambahkan |
| 6 | **`supabase/add-boxes.sql`** | **WAJIB.** Membuat tabel `boxes` untuk menu **Stok Box & Kubikasi**, termasuk relasi `productId`/`productSku`/`productName` | Tanpa ini, menu box online error `404 /rest/v1/boxes` |
| 7 | **`supabase/add-online-updates.sql`** | **WAJIB.** Menambah kolom baru: `handledById`, `handledByName`, `workerName`, `position`, `source`, `partyName`, `inboundId`, kolom box + policy RLS | **Selalu jalankan**, karena field baru pembaruan terakhir belum ada di project lama |
| 8 | `supabase/update-passwords.sql` | Mengganti password bawaan 5 akun ke password baru | Login online masih menolak password baru |

> Urutan penting: jalankan `add-boxes.sql` **sebelum** `add-online-updates.sql`, karena script terakhir menambah kolom box dan policy untuk tabel `boxes`. `add-online-updates.sql` juga tetap harus setelah `add-borong.sql` dan `add-wages.sql`.

### 1B. Untuk project BARU (bersih)

Cukup jalankan:

1. `supabase/schema.sql` — sudah memuat semua tabel, kolom terbaru, policy, fungsi login, dan akun bawaan dengan password baru.
2. `supabase/add-boxes.sql` — opsional untuk project baru karena `schema.sql` sudah memuat tabel `boxes`; aman dijalankan ulang.
3. `supabase/add-online-updates.sql` — opsional, sebagai verifikasi kolom (aman dijalankan ulang).

Tidak perlu menjalankan `update-passwords.sql` pada project baru karena `schema.sql` sudah memakai password baru.

### 1C. Verifikasi Supabase

Setelah semua script dijalankan, jalankan query ini di SQL Editor:

```sql
select 'users' t, count(*) from public.users
union all select 'products', count(*) from public.products
union all select 'wages', count(*) from public.wages
union all select 'borong', count(*) from public.borong
union all select 'boxes', count(*) from public.boxes;
```

Kemudian uji login bawaan (harus mengembalikan **5 baris**):

```sql
select 'admin' akun, id, username, role from public.authenticate('admin', 'PASSWORD_ADMIN')
union all
select 'gudang', id, username, role from public.authenticate('gudang', 'PASSWORD_GUDANG')
union all
select 'purchasing', id, username, role from public.authenticate('purchasing', 'PASSWORD_PURCHASING')
union all
select 'produksi', id, username, role from public.authenticate('produksi', 'PASSWORD_PRODUKSI')
union all
select 'manager', id, username, role from public.authenticate('manager', 'PASSWORD_MANAGER');
```

> Isi `PASSWORD_*` dengan password yang diberikan administrator. Di `supabase/update-passwords.sql`, query verifikasi di bagian bawah sudah memakai password baru, jadi Anda hanya perlu melihat hasilnya (5 baris).

Terakhir, cek kolom baru dengan menjalankan isi `supabase/add-online-updates.sql` lagi. Bagian `select ... from information_schema.columns` harus menampilkan:

- `distributions`: `handledById`, `handledByName`
- `borong`: `handledById`, `handledByName`, `workerName`
- `wages`: `position`
- `returns`: `source`, `partyName`
- `qc`: `inboundId`
- `boxes`: `productId`, `productSku`, `productName`, `code`, `sizeDetail`, `volumeM3`, `qty`, `minQty`

### 1D. Tabel error → solusi

| Error di browser / console | Penyebab | Solusi |
|----------------------------|----------|--------|
| `404` pada `/rest/v1/borong?select=*` | Tabel `borong` belum ada | Jalankan `add-borong.sql` atau `schema.sql` |
| `400` / `column handledById does not exist` | Kolom admin belum ada | Jalankan `add-online-updates.sql` |
| `42703` / `column "position" of relation "wages" does not exist` saat menjalankan `add-wages.sql` | Tabel `wages` lama belum punya kolom jabatan | **Jalankan ulang `add-wages.sql` yang sudah diperbaiki** (sekarang ada `alter table ... add column if not exists "position"`), lalu lanjut ke `add-online-updates.sql` |
| `400` / `column position does not exist` di aplikasi | Kolom jabatan belum ada di database | Jalankan `add-online-updates.sql` |
| `400` / `column price does not exist` | Kolom harga belum ada | Jalankan `add-product-price.sql` |
| `400` / `column source does not exist` | Kolom barang kembali belum ada | Jalankan `add-online-updates.sql` |
| `404` pada `/rest/v1/boxes?select=*` | Tabel box belum ada | Jalankan `add-boxes.sql` |
| `permission denied for table users` | GRANT/RLS belum benar | Jalankan `fix-permission.sql` |
| `function digest(text, unknown) does not exist` | Fungsi login lama | Jalankan `fix-auth.sql` |
| Username/password benar tapi login ditolak | Password server belum diubah | Jalankan `update-passwords.sql` |
| `Key ditolak` / `jwt` | Key salah atau secret key | Pakai publishable/anon key di `js/config.js` |

---

## 1E. Reset Supabase (opsional, kalau query sudah terlalu banyak)

Tidak perlu panik kalau sudah berkali-kali menjalankan query. Script di project **idempotent**, artinya aman diulang:

- `create table if not exists` → tidak membuat tabel dobel.
- `alter table ... add column if not exists` → tidak membuat kolom dobel.
- `drop policy if exists app_all` lalu `create policy app_all` → policy tidak menumpuk.
- `create or replace function authenticate(...)` → fungsi ditimpa, bukan dobel.
- `insert ... on conflict (id) do nothing` → akun bawaan tidak dobel.
- `add-wages.sql` hanya mengisi contoh **jika tabel kosong**.

Jadi **double query tidak merusak struktur**. Yang perlu diwaspadai hanyalah script lama yang gagal di tengah (seperti error `column "position" ... does not exist`); cukup jalankan ulang file yang sudah diperbaiki.

Kalau tetap ingin mulai bersih, ada dua pilihan:

### Opsi A — Reset data saja (disarankan)

1. Backup dulu lewat aplikasi: **Pengaturan → ⬇ Backup JSON**.
2. Jalankan `supabase/reset-data.sql`. Ini mengosongkan semua baris tetapi **tabel, kolom, GRANT, RLS, dan fungsi tetap ada**.
3. Jalankan `supabase/schema.sql` untuk mengembalikan 5 akun bawaan.
4. Di aplikasi, buka **Pengaturan → Kembali ke mode lokal → Aktifkan Supabase**. Data lokal yang Anda simpan akan otomatis di-upload ke Supabase yang sudah kosong.

### Opsi B — Reset struktur penuh

1. Backup dulu.
2. Jalankan `supabase/reset-all.sql` (menghapus seluruh tabel dan fungsi login).
3. Jalankan `supabase/schema.sql`.
4. Jalankan `supabase/add-online-updates.sql` sebagai verifikasi kolom.
5. Di aplikasi: **Pengaturan → Kembali ke mode lokal → Aktifkan Supabase** untuk mengirim data lokal ke project baru.

> Setelah reset, jangan lupa **Ctrl + F5** dan cek Console browser tidak ada error.

---

## 2. Update GitHub

Repo: `deanjerryprat/stok-solidteakfurniture`
Situs: <https://deanjerryprat.github.io/stok-solidteakfurniture/>

**Tidak perlu reset atau hapus repo GitHub.** File di GitHub hanyalah kode/web statis; datanya ada di Supabase. Cukup upload ulang file yang berubah sebagai commit baru. Riwayat commit lama tidak masalah dan bisa dijadikan cadangan.

Folder lokal saat ini **bukan git repo**, jadi cara paling mudah adalah lewat website GitHub.

### 2A. Cara lewat website GitHub (disarankan)

1. Buka <https://github.com/deanjerryprat/stok-solidteakfurniture>.
2. Masuk ke folder yang bersangkutan, klik **Add file → Upload files**.
3. Upload/drag file yang berubah:
   - `index.html`, `app.html`, `styles.css`
   - `js/app.js`, `js/store.js`, `js/views.js`, `js/views2.js`, `js/ui.js`, `js/utils.js`, `js/login.js`, `js/config.js`
   - `README.md`, `PANDUAN-ONLINE.md`
   - seluruh isi folder `supabase/` (termasuk **`add-online-updates.sql`** yang baru)
   - `google-apps-script/Code.gs` dan `assets/solid-teak-logo.png` bila belum ada di repo
4. Isi commit message, misalnya:

   ```text
   Update mode online: admin borong, jabatan gaji, QC ke barang masuk
   ```

5. Klik **Commit changes** langsung ke branch `main`.
6. Buka **Settings → Pages**. Pastikan:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / `/ (root)`
7. Tunggu 1–3 menit sampai deployment selesai (centang hijau di tab **Actions**).
8. Buka situs, tekan **Ctrl + F5**.

### 2B. Cara lewat Git CLI (opsional)

Kalau komputer sudah punya git dan folder sudah pernah di-clone:

```powershell
cd "C:\Users\USER\Documents\Default Project"
git add .
git commit -m "Update mode online: admin borong, jabatan gaji, QC ke barang masuk"
git push origin main
```

Kalau folder belum pernah di-clone/git init:

```powershell
cd "C:\Users\USER\Documents\Default Project"
git init
git remote add origin https://github.com/deanjerryprat/stok-solidteakfurniture.git
git add .
git commit -m "Update mode online: admin borong, jabatan gaji, QC ke barang masuk"
git branch -M main
git push -u origin main
```

> Jangan commit file backup JSON atau file yang berisi password pribadi. Publishable key di `js/config.js` boleh tetap publik karena keamanan dijaga RLS, bukan kerahasiaan key.

---

## 3. Cek setelah online

1. Buka <https://deanjerryprat.github.io/stok-solidteakfurniture/> → halaman **login** muncul.
2. Login memakai password baru (case-sensitive, tanda `!` wajib).
3. Menu **Pengaturan** harus berstatus **● MODE SUPABASE**. Kalau masih lokal, masukkan Project URL + publishable key → **Aktifkan Supabase**, lalu **🔄 Tarik data terbaru**.
4. Tekan **Ctrl + F5**, lalu cek:
   - Dashboard menampilkan panel **Informasi Produksi & Gudang**.
   - Menu **Distribusi & Tugas Borong** → form ada **Admin yang Menangani**.
   - Tombol **🧹 Tugas Borong Harian** → form ada admin, karyawan, pemborong, Target/Selesai.
   - Menu **Gaji Karyawan** → tabel ada kolom **Jabatan**.
   - Menu **Barang Kembali & QC** → tab **Kembali Borong / Sampel** dan aksi **Buat Masuk** tersedia.
   - Menu **Stok Box & Kubikasi** → bisa memilih barang dari Database Produk, mengisi ukuran sendiri, dan melihat total kubikasi.
5. Buka **DevTools → Console** (F12). Tidak boleh ada error `404`, `400`, atau `permission denied`.

---

## 4. Alur pemakaian singkat

- **Admin Gudang** (`GUDANG`): QC, barang masuk, barang keluar, terima kembali borong/servis/sampel, dan menugaskan borong untuk karyawan yang dipegangnya (mis. Ulin).
- **Admin Produksi** (`PRODUKSI`): mengatur barang yang diamplas/dipacking per hari, target & realisasi, distribusi, dan SPK.
- **Manager / Owner**: melihat **Pengawasan Harian** berapa barang selesai per orang per hari; tidak perlu input transaksi.
- **Barang kembali** belum menambah stok gudang sampai lolos QC dan dibuatkan **barang masuk** lewat tombol **Buat Masuk**.
- **Database Produk** tetap dipakai sebagai daftar barang yang akan dimuat ke dalam box; setiap box wajib memilih salah satu produk. Ukuran box diisi manual di menu **Stok Box & Kubikasi**; kubikasi bisa dihitung otomatis dari Panjang × Lebar × Tinggi (cm) atau diisi sendiri.

---

## 5. Backup cloud opsional

Jika ingin backup otomatis ke Google Sheet/Drive/Gmail:

1. Buka `google-apps-script/Code.gs`.
2. Ikuti petunjuk di dalam file: buat Google Sheet, Extensions → Apps Script, tempel kode, deploy sebagai **Web app** (Execute as: **Me**, Who has access: **Anyone**).
3. Di aplikasi: **Pengaturan → Backup ke Google Sheet + Gmail**, isi Web App URL + token, lalu **Backup Sekarang**.
4. Izin Gmail baru aktif setelah **Review permissions → Allow** saat eksekusi pertama.

> Jika email gagal dengan pesan izin `script.send_mail`, buka Apps Script → **Services**/`OAuth` lalu setujui izin kirim email, atau jalankan fungsi sekali dari editor Apps Script dan klik **Allow**.
