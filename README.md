# Sistem Stok Furniture — Gudang, Produksi & Pengrajin

Aplikasi web **gratis**, tanpa biaya langganan, tanpa perlu Node/npm/database server.
Data awal sudah terisi: **10 produk** dan **10 pengrajin**, lengkap dengan transaksi contoh untuk simulasi alur stok.

## Cara menjalankan

1. Buka folder ini.
2. Klik dua kali `index.html` (Chrome / Edge).
3. Login dengan salah satu akun demo:

| Username | Password | Role | Akses |
|---|---|---|---|
| admin | admin123 | ADMIN | Semua menu |
| gudang | gudang123 | GUDANG | Barang masuk/keluar, stok, QC |
| purchasing | purchasing123 | PURCHASING | Supplier/barang masuk, laporan |
| produksi | produksi123 | PRODUKSI | Pengrajin, distribusi, penerimaan, SPK |
| manager | manager123 | MANAGER | Dashboard & laporan (lihat saja) |

## Menu yang tersedia

- **Dashboard**: total seluruh stok, barang masuk, barang keluar, stok gudang, stok di pengrajin, menunggu QC, rusak/afkir, barang di borong obat, grafik stok, aktivitas terbaru, pekerjaan terlambat, stok menipis.
- **Database Produk**: SKU, nama, kategori, foto (bisa di-upload), ukuran, status, stok minimum, dan riwayat per produk.
- **Barang Masuk**: tanggal, supplier/pengrajin, produk, jumlah, kondisi, petugas penerima, keterangan.
- **Barang Keluar**: Customer / Borong Obat / Rusak-Afkir, tanggal, produk, jumlah, tujuan, penerima, nomor surat jalan, petugas gudang.
- **Pengrajin**: data lengkap + halaman khusus per pengrajin (diterima, selesai, belum selesai, afkir, terlambat, riwayat pekerjaan).
- **Distribusi ke Pengrajin**: pembagian pekerjaan (contoh Dining Chair 500 pcs ke 4 pengrajin), target, bukti penerimaan, relasi dengan SPK.
- **Barang Kembali & QC**: penerimaan hasil pengrajin (tidak boleh melebihi sisa barang), QC lulus/afkir, dan daftar **barang jadi siap kirim**.
- **SPK**: surat perintah kerja per pengrajin, bisa langsung dibuatkan distribusi.
- **Laporan**: barang masuk, barang keluar, stok keseluruhan, stok per pengrajin; filter tanggal, produk, kategori, pengrajin, status; export **Excel (.xlsx)** dan **PDF**.
- **Pencarian cepat**: SKU, nama produk, pengrajin, tanggal transaksi.
- **Notifikasi otomatis**: deadline terlewat, mendekati deadline, barang perlu QC, pengrajin kirim barang, pekerjaan selesai, stok menipis.
- **Pengguna & Hak Akses**: 5 role dengan username/password dan pembatasan menu.
- **Backup/Pulihkan data** dan **Reset data contoh** (khusus ADMIN, di sidebar).

## Logika stok otomatis

Semua angka dihitung dari transaksi, bukan input manual:

- **Stok gudang** = barang masuk − distribusi ke pengrajin − barang keluar + QC lulus
- **Stok dalam proses pengrajin** = barang didistribusikan − barang kembali dari pengrajin
- **Menunggu QC** = barang kembali yang baik − barang yang sudah diperiksa QC
- **Rusak/afkir** = barang keluar jenis afkir + afkir dari pengrajin + afkir QC
- **Barang jadi siap kirim** = QC lulus − barang terkirim

Validasi otomatis: distribusi/pengiriman tidak boleh melebihi stok gudang; penerimaan dari pengrajin tidak boleh melebihi sisa barang yang masih diproses.

## Cara deploy GRATIS (online)

Folder ini sudah berisi file statis (`index.html`, `styles.css`, folder `js`). Tidak ada build step.

**Opsi 1 — Netlify (paling mudah)**
1. Daftar gratis di `netlify.com`.
2. Buka **Drop** (netlify.com/drop), lalu tarik (drag) seluruh folder project ke halaman tersebut.
3. Situs langsung aktif dengan alamat `https://nama-acak.netlify.app` (bisa diganti).

**Opsi 2 — GitHub Pages (tanpa perlu install Git)**

1. **Isi dulu kredensial Supabase** di file `js/config.js`:
   ```js
   window.SUPABASE_CONFIG = {
     url: 'https://xxxxxxx.supabase.co',
     key: 'sb_publishable_...'
   };
   ```
   Simpan file. Dengan ini, semua perangkat yang membuka link nanti otomatis tersambung ke Supabase — tidak perlu input URL/key satu per satu.
   *(Kalau belum mengisi, bisa tetap manual: login `admin` → menu **Pengaturan** → tempel URL + key → **Aktifkan Supabase**.)*

2. Buka **github.com** → login → klik **+ → New repository**.
   - Repository name: misal `stok-furniture`
   - Pilih **Public** (GRATIS. Private butuh GitHub Pro)
   - **Jangan** centang "Add a README" / ".gitignore" / license (biar kosong)
   - Klik **Create repository**.

3. Di halaman repository, klik **uploading an existing file** (atau tombol **Add file → Upload files**).
   - Tarik (drag) **semua isi folder project** ke halaman itu: `index.html`, `styles.css`, `README.md`, folder `js/` (termasuk `config.js`), dan folder `supabase/`.
   - Tunggu sampai selesai upload, lalu klik **Commit changes**.

4. Buka tab **Settings** repository → sidebar **Pages**.
   - **Build and deployment → Source**: pilih **Deploy from a branch**
   - **Branch**: `main` (atau `master`) → folder: **/(root)** → klik **Save**.

5. Tunggu 1–3 menit. Refresh halaman **Pages** sampai muncul alamat:
   ```
   https://USERNAME.github.io/NAMA-REPO/
   ```
   Itulah link aplikasi Anda. Buka di HP/laptop lain untuk memastikan data Supabase tampil sama.

> Setiap kali ada perubahan file (misal mengisi `config.js` atau update aplikasi), upload ulang file yang berubah lalu **Commit changes**. GitHub Pages akan otomatis deploy ulang dalam 1–3 menit. GitHub Pages sudah HTTPS, jadi hash password SHA-256 berfungsi normal.

**Opsi 3 — Vercel**
1. Import repository GitHub tersebut di `vercel.com` (gratis).
2. Framework preset: **Other**, build command kosong, output directory: `.` (root).
3. Deploy.

Catatan: library Excel (`SheetJS`) dan PDF (`jsPDF`) dimuat dari CDN. Jika tidak ada internet, export otomatis memakai **CSV** (bisa dibuka di Excel) dan **Print → Save as PDF**.

## Menghubungkan ke Supabase (database bersama, GRATIS)

Aplikasi sudah mendukung dua mode:

- **Mode lokal** (default): data di browser perangkat ini. Cocok untuk uji coba.
- **Mode Supabase**: data bersama di PostgreSQL, bisa diakses banyak user/perangkat lewat link yang sama.

### Langkah setup (sekali saja)

1. Buat project gratis di **https://supabase.com** (pilih region terdekat, mis. Singapore).
2. Buka **SQL Editor → New query**, salin seluruh isi file **`supabase/schema.sql`**, lalu klik **Run**.
   - Skrip ini membuat 9 tabel, RLS policy, fungsi login `authenticate()`, dan 5 akun demo.
   - Password diverifikasi di server dengan SHA-256 (bukan disimpan plaintext).
3. Ambil kredensialnya (dua cara, pilih salah satu):
   - **Cara cepat:** klik tombol **Connect** di kanan atas halaman project → dialog akan menampilkan **Project URL** dan **publishable key** (`sb_publishable_...`).
   - **Cara lengkap:** sidebar kiri → **Settings → API Keys** (di dashboard terbaru; tutorial lama menyebutnya **Project Settings → API**). Salin **Project URL** dan baris **Publishable key** (`sb_publishable_...`). Pada project lama, barisnya bernama **anon / public** dan nilainya diawali `eyJ...` — itu juga bisa dipakai.
   - **Jangan** memakai **Secret key** (`sb_secret_...`) / `service_role`, karena itu kunci server yang menembus RLS.
4. Di aplikasi, login sebagai **admin**, buka menu **Pengaturan**, tempel **Project URL** + **publishable/anon key**, klik **Aktifkan Supabase**.
   - Jika tabel masih kosong, aplikasi otomatis mengunggah data contoh (10 produk, 10 pengrajin, transaksi) dari mode lokal.
5. Deploy folder aplikasi ke hosting gratis (Netlify/GitHub Pages/Vercel). Semua perangkat yang membuka link akan memakai database Supabase yang sama.

Menu **Pengaturan** juga menyediakan tombol **Tarik data terbaru** dan **Kembali ke mode lokal**. Setiap perubahan (tambah/edit/hapus) langsung disimpan ke Supabase; jika gagal, aplikasi menampilkan notifikasi error dan menarik ulang data.

> Mode Supabase sebaiknya dipakai lewat **hosting HTTPS** (Netlify/Vercel/GitHub Pages), bukan dengan membuka `index.html` langsung dari komputer. Browser hanya menyediakan `crypto.subtle` (untuk hash password SHA-256) di HTTPS/localhost.

### Kalau koneksi gagal

Pesan error sekarang akan menunjukkan penyebabnya. Cek berurutan:

1. **Refresh halaman dengan Ctrl+F5** (abaikan cache) agar library Supabase versi terbaru termuat, lalu klik **Aktifkan Supabase** lagi.
2. Pastikan **schema.sql di-Run sampai selesai tanpa error** di project yang sama dengan URL/key yang dipakai. Cek di **Table Editor** harus ada tabel `users`, `products`, `artisans`, `inbound`, `outbound`, `distributions`, `returns`, `qc`, `spk`.
3. Key harus **Publishable** (`sb_publishable_...`) atau anon lama (`eyJ...`). Kalau terlanjur memakai **secret key** (`sb_secret_...`), aplikasi akan menolak dengan pesan khusus.
4. Kalau pesannya menyebut **`relation "public.users" does not exist`** → SQL belum jalan / salah project. Kalau **`invalid API key`/`JWT`** → key salah. Kalau **`permission denied for table ...`** → role `anon` belum mendapat `GRANT`. Jalankan file **`supabase/fix-permission.sql`** di SQL Editor → Run (aman dijalankan berulang), lalu klik **Aktifkan Supabase** lagi. `schema.sql` terbaru sudah memuat GRANT ini untuk project baru.
5. Jika sudah deploy, **deploy ulang** folder aplikasi setelah memperbarui `index.html`.

### Akun demo Supabase

Sama seperti mode lokal: `admin/admin123`, `gudang/gudang123`, `purchasing/purchasing123`, `produksi/produksi123`, `manager/manager123`. Bisa diubah di menu **Pengguna** (password akan di-hash SHA-256 otomatis oleh aplikasi sebelum dikirim ke Supabase).

### Catatan keamanan

`schema.sql` memakai RLS policy akses penuh (`using (true)`) supaya aplikasi langsung berfungsi tanpa konfigurasi Auth yang rumit. Untuk pemakaian publik/serius, sebaiknya:

- aktifkan **Supabase Auth** dan ganti policy dengan pemeriksaan `auth.uid()`;
- jangan menyimpan anon key di perangkat yang tidak dipercaya;
- batasi hak tulis per role di server (saat ini pembatasan role dilakukan di sisi aplikasi).

Untuk memindahkan data manual: **Backup data (.json)** di sidebar, lalu **Pulihkan data** di perangkat/hosting tujuan (khusus ADMIN). Saat dalam mode Supabase, akun pengguna tidak ikut ditimpa saat pulihkan/reset.

## Struktur file

```
index.html      kerangka aplikasi + layar login
styles.css      seluruh tampilan & responsive
js/config.js    Project URL + publishable key untuk deploy (isi sebelum upload)
js/utils.js     helper tanggal, format, export Excel/PDF
js/store.js     database (lokal/Supabase), data contoh, kalkulasi stok, auth & role
js/ui.js        modal, form, tabel, notifikasi toast
js/views.js     dashboard, produk, barang masuk/keluar, pengrajin
js/views2.js    distribusi, barang kembali/QC, SPK, laporan, pencarian, notifikasi, user, pengaturan
js/app.js       login, router hash, navigasi, hak akses
supabase/schema.sql        tabel + GRANT + RLS + fungsi login + akun demo
supabase/fix-permission.sql  perbaikan cepat error "permission denied" pada project lama
```
