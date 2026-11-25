# Sistem Stok Furniture — Gudang, Produksi & Pengrajin

Aplikasi web **gratis**, tanpa biaya langganan, tanpa perlu Node/npm/database server.
Data awal sudah terisi: **10 produk** dan **10 pengrajin**, lengkap dengan transaksi contoh untuk simulasi alur stok.

## Cara menjalankan

1. Buka folder ini.
2. Klik dua kali `index.html` (Chrome / Edge). Ini **halaman login saja** — dashboard tidak ikut tampil di bawahnya.
3. Setelah login berhasil, aplikasi otomatis berpindah ke `app.html` (dashboard). Tombol **Keluar** kembali ke `index.html`.
4. Masuk memakai akun yang diberikan administrator. Kredensial sengaja **tidak ditampilkan** di halaman login maupun dokumentasi publik.

## Menu yang tersedia

- **Dashboard**: total seluruh stok, barang masuk, barang keluar, stok gudang, stok di pengrajin, menunggu QC, rusak/afkir, barang di borong obat, grafik stok, aktivitas terbaru, pekerjaan terlambat, stok menipis, ringkasan gaji. Panel **Informasi Produksi & Gudang** menampilkan barang sedang dikerjakan produksi, barang sedang dikontrol gudang (QC), **total barang di luar gudang** (kecuali afkir/rusak), rincian barang di gudang / dibawa pengrajin, pinjaman sampel, borong obat, servis, barang kembali, dan barang masuk setelah QC lulus. Panel **Pengawasan Harian** di menu borong menampilkan berapa pcs pengrajin dan pemborong selesai per hari.
- **Database Produk**: SKU, nama, kategori, foto (bisa di-upload), ukuran, status, stok minimum, **Harga Barang (Rp/pcs)**, upah borong amplas/packing, dan riwayat per produk. Harga barang diisi sendiri satu per satu dan otomatis tampil di SPK beserta nilainya (`qty × harga`). Tabel dan dropdown produk diurutkan otomatis berdasarkan **nomor SKU** (`ST-2` sebelum `ST-10`). Kategori bisa dibuat lewat tombol **🏷️ Kelola Kategori** atau cukup diketik langsung pada kolom Kategori saat tambah/edit produk.
- **Barang Masuk**: tanggal, supplier/pengrajin, produk, jumlah, kondisi, petugas penerima, keterangan. Tabel punya kolom **Tandai** dengan centang **Pilih Semua** dan tombol **Hapus Terpilih** untuk menghapus banyak transaksi sekaligus (stok otomatis disesuaikan).
- **Barang Keluar** (admin gudang): Customer / Borong Obat / **Servis (diambil pengrajin)** / **Pinjaman Sampel** / Rusak-Afkir, tanggal, produk, jumlah, tujuan, penerima, nomor surat jalan, petugas gudang. Juga punya kolom **Tandai** + **Hapus Terpilih**. Barang borong obat, servis, dan sampel bisa diterima kembali lewat tombol **Terima Kembali**, lalu masuk antrean QC gudang.
- **Pengrajin**: bisa **ditambah manual** lewat tombol **+ Tambah Pengrajin** (ID boleh diisi sendiri, mis. `PN011`), diedit, atau dihapus. Data lengkap + halaman khusus per pengrajin (diterima, selesai, belum selesai, afkir, terlambat, riwayat pekerjaan). Daftar pengrajin diurutkan **A–Z berdasarkan nama**; tombol **Hapus** tersedia di kartu dan halaman detail (riwayat transaksi tetap tersimpan).
- **Distribusi & Tugas Borong**: setelah tanggal, form memuat **Admin yang Menangani** (mis. admin gudang yang memegang karyawan Ulin), lalu **Karyawan/Pengrajin Penerima**, produk, target, bukti penerimaan, dan relasi SPK. Tombol **🧹 Tugas Borong Harian** membuka form berisi **Admin yang Menangani**, **Karyawan yang Dipegang** (opsional, mis. Ulin), **Nama Pemborong**, dan **daftar barang yang dikerjakan** (target & realisasi per produk) untuk amplas/packing. Tabel dan export menampilkan admin, karyawan, dan pemborong.
- **Barang Kembali & QC** (admin gudang): penerimaan hasil pengrajin (tidak boleh melebihi sisa barang), penerimaan kembali dari pemborong obat / servis / pinjaman sampel, QC lulus/afkir, tombol **Buat Masuk** untuk menjadikan barang lulus QC sebagai **barang masuk**, dan daftar **barang jadi siap kirim**.
- **SPK**: surat perintah kerja per pengrajin, bisa langsung dibuatkan distribusi. Tombol **Cetak** pada setiap SPK menghasilkan SPK siap cetak/Save as PDF untuk diserahkan ke pengrajin (lengkap dengan alamat & telepon pengrajin, SKU, ukuran, qty, harga barang, nilai pekerjaan, catatan, dan kolom tanda tangan).
- **Gaji Karyawan Harian**: tanggal, **Nama Karyawan**, **Jabatan dalam Perusahaan** (`Manager`, `Mandor`, `Angkat Junjung`, `Pemborong Amplas`, `Pemborong Packing`), gaji harian, upah lembur per jam, jumlah masuk (hari), jam lembur, catatan; **Daftar Nama Karyawan** ditampilkan di atas tabel catatan gaji; total harian otomatis; filter tanggal/karyawan/jabatan; export Excel & PDF; akses edit untuk ADMIN/MANAGER, lihat untuk role lain. Tombol **Cetak** menghasilkan **Bukti Gaji Harian** yang memuat nama dan jabatan.
- **Slip Gaji Mingguan**: pilih karyawan + minggu (Senin–Minggu), rincian kehadiran & lembur, input **bonus**, **total bon/hutang**, dan **potongan telat masuk**, hitung **gaji bersih**, lalu **Cetak Slip Gaji** (jendela print / Save as PDF). Slip menampilkan **nama karyawan dan jabatan**.
- **Tugas & Gaji Borong (Amplas & Packing)**: tarif per pcs diisi sendiri di menu **Database Produk** (kolom **Upah Amplas** / **Upah Packing**). Form berisi **nama pemborong**, jenis pekerjaan, daftar barang yang dikerjakan, kolom **Target** (rencana admin produksi) dan **Selesai** (realisasi; dipakai hitung upah), tarif, **lembur per item**, dan **tambahan lembur**. Tersedia **Pengawasan Harian** untuk owner/manager, filter, export Excel/PDF, dan **Cetak Slip Borong** per orang.
- **Import Excel / CSV**: upload file `.xlsx/.xls/.csv`, pilih sheet & baris header, mapping kolom, preview, lalu impor. Mode **Workbook Stok Lengkap** otomatis membaca sheet `DAFTAR PRODUK`, `PRODUK MASUK`, `PRODUK KELUAR`: membuat produk, transaksi **Saldo Awal** dari `STOCK AWAL`, mengisi tanggal/supplier kosong dari baris sebelumnya, dan menandai baris `#N/A` tanpa SKU sebagai produk **SKU TIDAK DIKETAHUI (CEK EXCEL)**. Mode **Otomatis** membuat produk baru bila SKU belum ada dan memisahkan transaksi **Masuk/Keluar** dari kolom Jenis; mode lain: masuk saja, keluar saja, atau produk saja. Ada tombol **Unduh Template** dan opsi **Lewati duplikat**. Akses import: ADMIN, GUDANG, PURCHASING (MANAGER hanya lihat).
- **Laporan**: barang masuk, barang keluar, stok keseluruhan, stok per pengrajin; filter tanggal, produk, kategori, pengrajin, status; export **Excel (.xlsx)** dan **PDF**.
- **Pencarian cepat**: SKU, nama produk, pengrajin, tanggal transaksi.
- **Notifikasi otomatis**: deadline terlewat, mendekati deadline, barang perlu QC, pengrajin kirim barang, pekerjaan selesai, stok menipis.
- **Pengguna & Hak Akses**: 5 role dengan username/password dan pembatasan menu.
- **Backup/Pulihkan data** dan **Reset data contoh** (khusus ADMIN, di sidebar).

## Pembagian tugas

- **Admin Produksi (`PRODUKSI`)**: mengatur pekerjaan **dalam 1 hari** — barang mana yang diamplas/dipacking, nama pemborong, target & realisasi; membuat distribusi ke pengrajin dan SPK. Tidak menginput barang masuk/keluar gudang.
- **Admin Gudang (`GUDANG`)**: QC barang kembali, mencatat **barang masuk** (termasuk hasil QC yang lolos) dan **barang keluar** (customer, borong obat, servis/pengrajin, sampel, afkir), menerima pengembalian, serta dapat menugaskan borong amplas/packing untuk karyawan yang dipegangnya (mis. Ulin → pemborong).
- **Owner / Admin Utama (`ADMIN`) dan Manager (`MANAGER`)**: mengawasi dashboard dan **Pengawasan Harian** berapa barang yang diselesaikan produksi/pemborong per orang per hari; tidak perlu mencatat transaksi harian.
- **Purchasing (`PURCHASING`)**: mencatat barang masuk dan melihat laporan.
- **Backup Cloud**: salinan otomatis/manual ke **Google Sheet + Google Drive + Gmail** lewat Apps Script gratis, selain database Supabase.

## Logika stok otomatis

Semua angka dihitung dari transaksi, bukan input manual:

- **Stok gudang** = barang masuk − distribusi ke pengrajin − **semua** barang keluar + QC lulus yang **belum dibuatkan barang masuk**. Barang yang kembali dari borong/servis/sampel **belum** menambah stok gudang sampai lolos QC dan dibuatkan **barang masuk**.
- **Stok dalam proses pengrajin** = barang didistribusikan − barang kembali dari pengrajin
- **Menunggu QC** = barang kembali yang baik (pengrajin / pemborong obat / servis / sampel) − barang yang sudah diperiksa QC
- **Rusak/afkir** = barang keluar jenis afkir + afkir dari pengrajin + afkir QC (tidak masuk "di luar gudang")
- **Barang jadi siap kirim** = QC lulus − barang terkirim / dipinjam; barang pinjaman yang kembali dan lolos QC dihitung lagi sebagai QC lulus
- **Barang di luar gudang** = proses produksi + menunggu QC + pinjaman sampel + borong obat + servis

Validasi otomatis: distribusi/pengiriman tidak boleh melebihi stok gudang; penerimaan dari pengrajin tidak boleh melebihi sisa barang yang masih diproses; penerimaan borong/servis/sampel tidak boleh melebihi barang yang masih dipinjam; QC tidak boleh melebihi barang yang menunggu. **Barang masuk dari QC hanya dihitung sekali** (saat QC atau saat tombol **Buat Masuk**).

## Cara deploy GRATIS (online)

Folder ini sudah berisi file statis (`index.html`, `styles.css`, folder `js`). Tidak ada build step.

> **Pembaruan online terbaru:** ikuti **`PANDUAN-ONLINE.md`** untuk urutan lengkap update Supabase (termasuk `add-online-updates.sql` dan `add-boxes.sql`) dan upload ke GitHub Pages.

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
   - Tarik (drag) **semua isi folder project** ke halaman itu: `index.html` (halaman login), `app.html` (dashboard), `styles.css`, `README.md`, folder `js/` (termasuk `config.js` dan `login.js`), dan folder `supabase/`.
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
   - Skrip ini membuat 10 tabel (termasuk `wages` untuk gaji karyawan), RLS policy, fungsi login `authenticate()`, dan 5 akun bawaan.
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
5. Kalau koneksi tabel berhasil tapi **login gagal** dengan pesan **`function digest(text, unknown) does not exist`**, jalankan file **`supabase/fix-auth.sql`** di SQL Editor → Run. File itu memperbaiki `search_path` fungsi `authenticate()` agar menemukan `pgcrypto` di schema `extensions`, lalu memuat ulang cache PostgREST. Setelah itu refresh aplikasi.
6. **Project Supabase yang sudah ada:** untuk menambah tabel gaji tanpa menghapus data lama, jalankan **`supabase/add-wages.sql`** di SQL Editor → Run. File ini membuat tabel `wages`, policy, dan 10 data contoh gaji. (`schema.sql` terbaru juga sudah memuat tabel ini untuk project baru.)
7. **Gaji borong & harga barang:** jalankan **`supabase/add-borong.sql`** di SQL Editor → Run (membuat tabel `borong` dan kolom `price`, `rateAmplas`, `ratePacking` pada `products`). Kalau file itu sudah pernah dijalankan sebelum kolom `price` ditambahkan, cukup jalankan **`supabase/add-product-price.sql`**. Keduanya aman dijalankan berulang. Tanpa migrasi ini, mode online akan error saat memuat data borong/produk.
8. **Project Supabase lama:** password bawaan sudah diganti. Jalankan **`supabase/update-passwords.sql`** di SQL Editor → Run sekali untuk menyamakan 5 akun bawaan. File ini hanya mengubah akun yang masih memakai password lama dan tidak menghapus data. Simpan kredensial baru di tempat aman (tidak dicantumkan di sini).
9. Jika sudah deploy, **deploy ulang** folder aplikasi setelah memperbarui file.

### Akun bawaan Supabase

Sama seperti mode lokal, lima akun bawaan dibuat oleh `schema.sql` dengan password baru. Kredensialnya tidak dicantumkan di dokumentasi publik — simpan sendiri di tempat aman. Untuk project lama, jalankan `supabase/update-passwords.sql` sekali. Setelah login sebagai **ADMIN**, akun bisa dikelola di menu **Pengguna** (password di-hash SHA-256 otomatis oleh aplikasi sebelum dikirim ke Supabase).

### Catatan keamanan

`schema.sql` memakai RLS policy akses penuh (`using (true)`) supaya aplikasi langsung berfungsi tanpa konfigurasi Auth yang rumit. Untuk pemakaian publik/serius, sebaiknya:

- aktifkan **Supabase Auth** dan ganti policy dengan pemeriksaan `auth.uid()`;
- jangan menyimpan anon key di perangkat yang tidak dipercaya;
- batasi hak tulis per role di server (saat ini pembatasan role dilakukan di sisi aplikasi).

Untuk memindahkan data manual: **Backup data (.json)** di sidebar, lalu **Pulihkan data** di perangkat/hosting tujuan (khusus ADMIN). Saat dalam mode Supabase, akun pengguna tidak ikut ditimpa saat pulihkan/reset.

## Backup cadangan ke Google Sheet + Gmail (gratis)

Selain Supabase (database bersama otomatis), aplikasi bisa mengirim **salinan seluruh tabel** ke Google Sheet, menyimpan file JSON di Google Drive, dan mengirim email ke Gmail. Ini melindungi data jika website/hosting bermasalah.

### Persiapan sekali saja
1. Buat satu **Google Sheet kosong**. Dari URL-nya, salin **Sheet ID** (bagian antara `/d/` dan `/edit`).
2. Buka sheet itu → **Extensions → Apps Script**. Hapus kode default, lalu tempel seluruh isi file **`google-apps-script/Code.gs`**.
3. **Project Settings → Script Properties**, tambahkan:
   - `SHEET_ID` = Sheet ID dari langkah 1
   - `BACKUP_TOKEN` = token bebas, misalnya `solidteak2026`
   - `BACKUP_EMAIL` = alamat Gmail penerima (opsional, bisa diisi di aplikasi)
4. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy**, lalu salin **Web App URL** (`.../exec`).
5. Di aplikasi buka **Pengaturan → Backup ke Google Sheet + Gmail**. Isi Web App URL, email Gmail, dan token yang sama. Klik **Simpan Pengaturan**, lalu **Backup Sekarang**.

### Yang terjadi saat backup
- Setiap tabel (`products`, `inbound`, `outbound`, `wages`, dll.) dibuat menjadi **tab tersendiri** di Google Sheet dan ditimpa dengan data terbaru.
- File **JSON mentah** disimpan di Google Drive dan **dilampirkan ke email Gmail**.
- Tab `_BACKUP_INFO` berisi waktu backup dan jumlah baris.
- Jika centang **Backup otomatis**, aplikasi mengirim salinan 20 detik setelah ada perubahan data (masih dibatasi quota Apps Script).

> **Keamanan:** siapa pun yang mengetahui Web App URL **dan** token bisa menimpa sheet. Simpan token baik-baik. Untuk email, akun Gmail pribadi punya batas kuota pengiriman harian; untuk pemakaian harian berat, sebaiknya pakai Google Workspace.

> **CORS:** `TextOutput` Apps Script **tidak mendukung** `setHeader()`. Jangan menambahkan kode tersebut (membuat `doGet/doPost` berstatus **Failed** di menu **Executions**). Aplikasi sudah mengirim POST dengan `Content-Type: text/plain`, sehingga tidak perlu preflight. Kalau browser tetap memblokir pembacaan jawaban, aplikasi otomatis mengirim ulang dengan mode `no-cors`; data tetap masuk, hanya notifikasi jumlah baris yang tidak terbaca — cek Sheet/email untuk memastikan.

## Struktur file

```
index.html      kerangka aplikasi + layar login
styles.css      seluruh tampilan & responsive
js/config.js    Project URL + publishable key untuk deploy (isi sebelum upload)
js/utils.js     helper tanggal, format, export Excel/PDF
js/store.js     database (lokal/Supabase), data contoh, kalkulasi stok, ringkasan operasional harian, auth & role
js/ui.js        modal, form, tabel, notifikasi toast
js/views.js     dashboard, produk, barang masuk/keluar, pengrajin
js/views2.js    distribusi & tugas borong, barang kembali/QC (termasuk borong/servis/sampel), SPK, import Excel/CSV, laporan, gaji karyawan & slip mingguan, pengawasan harian, pencarian, notifikasi, user, pengaturan + backup sheet/gmail
js/app.js       login, router hash, navigasi, hak akses
supabase/schema.sql        tabel + GRANT + RLS + fungsi login + akun bawaan
supabase/fix-permission.sql  perbaikan cepat error "permission denied" pada project lama
supabase/fix-auth.sql        perbaikan cepat error login "digest does not exist" / fungsi authenticate
supabase/add-wages.sql       tambah tabel wages ke project Supabase yang sudah ada
supabase/add-borong.sql      tambah tabel borong + kolom price/rateAmplas/ratePacking pada products
supabase/add-product-price.sql  tambah kolom price saja (bila add-borong.sql sudah pernah dijalankan)
supabase/add-online-updates.sql  WAJIB: kolom admin borong, jabatan gaji, sumber barang kembali, inboundId QC + policy borong
supabase/add-boxes.sql          WAJIB: tabel boxes + relasi produk untuk menu Stok Box & Kubikasi
supabase/update-passwords.sql  ganti password bawaan 5 akun di project Supabase yang sudah ada
supabase/reset-data.sql         kosongkan semua data tanpa menghapus struktur tabel
supabase/reset-all.sql          reset struktur penuh (tabel + fungsi login)
PANDUAN-ONLINE.md       tutorial lengkap update Supabase + upload GitHub Pages
google-apps-script/Code.gs   endpoint backup ke Google Sheet, Drive, dan Gmail
js/login.js     logika halaman masuk, lalu alihkan ke app.html
```
