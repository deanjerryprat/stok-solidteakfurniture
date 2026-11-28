/* store.js - database localStorage + mode Supabase (database bersama) */
window.DB = (function () {
  const KEY = 'furniture_stock_db_v1';
  const SESSION_KEY = 'furniture_session_v1';
  const CONFIG_KEY = 'furniture_supabase_config';
  const MODE_KEY = 'furniture_db_mode';
  const DISABLE_KEY = 'furniture_supabase_disabled';
  const BACKUP_KEY = 'furniture_backup_config';
  const CAT_KEY = 'furniture_categories';
  const PAYROLL_EMP_KEY = 'furniture_payroll_employees';
  const PAYROLL_ADJ_KEY = 'furniture_payroll_adjustments';
  const TABLES = ['products', 'artisans', 'inbound', 'outbound', 'distributions', 'returns', 'qc', 'spk', 'wages', 'borong', 'boxes', 'users'];
  const JOB_TITLES = ['Manager', 'Mandor', 'Angkat Junjung', 'Pemborong Amplas', 'Pemborong Packing'];
  const WAGE_POSITIONS = {
    'Rizky Prasetyo': 'Mandor', 'Sinta Wulandari': 'Pemborong Amplas', 'Agus Saliman': 'Pemborong Packing'
  };
  const OLD_PASSWORDS = {
    U1: 'admin123', U2: 'gudang123', U3: 'purchasing123', U4: 'produksi123', U5: 'manager123'
  };
  const NEW_PASSWORDS = {
    U1: 'Jati2026!Admin', U2: 'Jati2026!Gudang', U3: 'Jati2026!Purchasing',
    U4: 'Jati2026!Produksi', U5: 'Jati2026!Manager'
  };
  // Hash SHA-256 lama/baru ("furn|" + password), dipakai saat cache berasal dari Supabase.
  const OLD_SHA = {
    U1: '0ba547a93cd2b092f6f191b019f5e51cb63b26e8f5be718721aa9e2031810bf0',
    U2: '2d73a2eb3f1fe0f7db6f8e8a24a97fa29875f519fa89563817e745d84eb4b88e',
    U3: '41c5196709e684d22aa92a6e920ea82b488f85695ca52932e09519739d5db7ae',
    U4: '9a0c50dea694e830a480ab3735d33b50b7cb4f4842ef45341cb412ff1d0646cb',
    U5: '8fbedfee8dc9b408e28859011d400bce096e4a6a205788770550d8258753b256'
  };
  const NEW_SHA = {
    U1: 'a68dc3ac82c2d6dc15fea1ec9e3249e13c697c128021c50865641396e44a168a',
    U2: 'c314f60e66cef245f997cd1d5fcce58ed1d4582821333b2b2ddee1d9ddb06826',
    U3: '8ae357c073b5153b282ff5c246ae959e7b10af40f81a839e9c8260c142b43f44',
    U4: 'd8e1dca75f1b89d79b655458324123e33b7b5c934c436a6dbe4b384c965f0ac6',
    U5: '95dc3ac173677f5be8d84b995d5e02537fb3613c901da503bb4b4081d4c7f84a'
  };
  let cache = null;
  let mode = localStorage.getItem(MODE_KEY) || 'local';
  let sb = null;
  let slimCacheWarned = false;

  function svgPhoto(label, color) {
    const bg = color || '#f1f5f9';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">' +
      '<rect width="160" height="120" fill="' + bg + '"/>' +
      '<g fill="none" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="52" y="22" width="56" height="34" rx="4"/>' +
      '<path d="M48 62h64v12H48z"/>' +
      '<path d="M56 74v28M104 74v28"/>' +
      '<path d="M48 88h64"/>' +
      '</g></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function hash(str) {
    let h = 2166136261;
    const s = 'furn|' + str;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }
  async function hashAsync(str) {
    if (window.crypto && window.crypto.subtle) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('furn|' + str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) { /* file:// atau browser lama: pakai hash lokal */ }
    }
    return hash(str);
  }

  function seed() {
    const t = U.today();
    const d = n => U.shiftDays(n);
    const products = [
      ['ST001', 'Meja Makan Jati', 'Meja', '180 x 90 x 75 cm', 'Gudang', 10, 'Kursi', '#dbeafe'],
      ['ST002', 'Kursi Makan Jati', 'Kursi', '45 x 50 x 90 cm', 'Gudang', 20, 'Kursi', '#dcfce7'],
      ['ST003', 'Lemari Pakaian 3 Pintu', 'Lemari', '120 x 60 x 200 cm', 'Gudang', 5, 'Pintu', '#fef3c7'],
      ['ST004', 'Sofa Minimalis 3 Seat', 'Sofa', '200 x 85 x 80 cm', 'Proses Obat', 5, 'Sofa', '#ede9fe'],
      ['ST005', 'Dining Chair', 'Kursi', '48 x 52 x 85 cm', 'Proses Obat', 30, 'Kursi', '#ffe4e6'],
      ['ST006', 'Meja Kerja Kayu', 'Meja', '140 x 70 x 75 cm', 'Gudang', 10, 'Kayu', '#e0f2fe'],
      ['ST007', 'Rak Buku Susun', 'Rak', '90 x 35 x 180 cm', 'Gudang', 10, 'Buku', '#f1f5f9'],
      ['ST008', 'Tempat Tidur Queen', 'Tempat Tidur', '160 x 200 x 90 cm', 'Proses Obat', 5, 'Tempat Tidur', '#fae8ff'],
      ['ST009', 'Kursi Bar Jati', 'Kursi', '40 x 45 x 100 cm', 'Gudang', 15, 'Kursi', '#ccfbf1'],
      ['ST010', 'Meja Lipat Portable', 'Meja', '120 x 60 x 75 cm', 'Barang Jadi', 10, 'Produk', '#fef9c3']
    ].map((p, i) => ({
      id: 'P' + String(i + 1).padStart(3, '0'), sku: p[0], name: p[1], category: p[2], size: p[3],
      status: p[4], minStock: p[5], photo: svgPhoto(p[6], p[7]), notes: '',
      price: 0, rateAmplas: 0, ratePacking: 0, createdAt: t
    }));

    const artisans = [
      ['PN001', 'Pak Suryono', 'Jl. Mawar No. 12, Jepara', '0812-3456-1001', 'Finishing & ukir', 'Kursi, Meja', true, 'Spesialis finishing jati.'],
      ['PN002', 'Bu Ratna Wijayanti', 'Dukuh Krajan RT 04, Jepara', '0812-3456-1002', 'Anyaman & rattan', 'Sofa, Kursi', true, 'Sangat rapi untuk detail anyaman.'],
      ['PN003', 'Pak Bambang Sutejo', 'Jl. Kenanga No. 45, Jepara', '0812-3456-1003', 'Pembubutan kayu', 'Meja, Lemari', true, 'Kapasitas 200 pcs/bulan.'],
      ['PN004', 'Pak Agus Purnomo', 'Desa Plajan, Jepara', '0812-3456-1004', 'Perakitan furnitur', 'Kursi, Tempat Tidur', true, 'Leader tim perakitan.'],
      ['PN005', 'Bu Siti Aminah', 'Jl. Flamboyan No. 8, Jepara', '0812-3456-1005', 'Pengamplasan', 'Semua produk', true, 'QC internal bagus.'],
      ['PN006', 'Pak Dwi Haryanto', 'Dukuh Ngabul, Jepara', '0812-3456-1006', 'Cat & coating', 'Meja, Rak', true, 'Warna sesuai sampel.'],
      ['PN007', 'Pak Slamet Riyadi', 'Jl. Pandan No. 21, Jepara', '0812-3456-1007', 'Ukir manual', 'Lemari, Sofa', true, 'Ukiran motif klasik.'],
      ['PN008', 'Bu Endang Sri Wahyuni', 'Kec. Tahunan, Jepara', '0812-3456-1008', 'Finishing water based', 'Kursi, Rak', true, 'Ramah lingkungan.'],
      ['PN009', 'Pak Joko Susilo', 'Jl. Merdeka No. 33, Jepara', '0812-3456-1009', 'Perakitan & packing', 'Semua produk', false, 'Sedang cuti produksi.'],
      ['PN010', 'Bu Yuli Handayani', 'Desa Bringin, Jepara', '0812-3456-1010', 'Quality control', 'Semua produk', true, 'Ahli QC kayu.']
    ].map(a => ({
      id: a[0], name: a[1], address: a[2], phone: a[3], specialization: a[4],
      productTypes: a[5].split(', '), active: a[6], notes: a[7], createdAt: t
    }));

    const inbound = [
      ['P001', 180, 'CV Jati Utama', 'Baik', 'Gudang A', 'Budi', -40],
      ['P002', 240, 'UD Kayu Lestari', 'Baik', 'Gudang A', 'Budi', -38],
      ['P003', 60, 'CV Jati Utama', 'Baik', 'Gudang B', 'Sari', -35],
      ['P004', 90, 'CV Mebel Indah', 'Baik', 'Gudang B', 'Budi', -33],
      ['P005', 600, 'UD Sinar Jati', 'Baik', 'Gudang A', 'Sari', -30],
      ['P006', 150, 'CV Jati Utama', 'Baik', 'Gudang A', 'Budi', -28],
      ['P007', 120, 'UD Kayu Lestari', 'Baik', 'Gudang B', 'Sari', -25],
      ['P008', 70, 'CV Mebel Indah', 'Baik', 'Gudang B', 'Budi', -22],
      ['P009', 200, 'UD Sinar Jati', 'Baik', 'Gudang A', 'Sari', -20],
      ['P010', 110, 'CV Jati Utama', 'Baik', 'Gudang A', 'Budi', -18],
      ['P005', 100, 'UD Sinar Jati', 'Baik', 'Gudang A', 'Budi', -12]
    ].map((x, i) => {
      const p = products.find(z => z.id === x[0]);
      return {
        id: 'IN' + String(i + 1).padStart(3, '0'), date: d(x[6]), supplier: x[2],
        productId: p.id, sku: p.sku, productName: p.name, qty: x[1], condition: x[3],
        notes: x[4], receiver: x[5], createdAt: new Date().toISOString()
      };
    });

    const spkRows = [
      ['P005', 'PN001', 100, -26, -6, 'Selesai'],
      ['P005', 'PN002', 150, -26, -4, 'Selesai'],
      ['P005', 'PN003', 100, -26, 3, 'Proses'],
      ['P005', 'PN004', 150, -26, 5, 'Proses'],
      ['P002', 'PN005', 120, -18, 2, 'Proses'],
      ['P001', 'PN006', 80, -15, -1, 'Terlambat']
    ];
    const spk = spkRows.map((s, i) => ({
      id: 'SPK' + String(i + 1).padStart(3, '0'),
      no: 'SPK/26/' + String(i + 1).padStart(4, '0'),
      date: d(s[3]), productId: s[0], artisanId: s[1], qty: s[2], targetDate: d(s[4]),
      status: s[5], notes: 'Produksi sesuai SPK.', createdAt: new Date().toISOString()
    }));

    const distributions = spkRows.map((s, i) => {
      const p = products.find(z => z.id === s[0]);
      const a = artisans.find(z => z.id === s[1]);
      return {
        id: 'DIST' + String(i + 1).padStart(3, '0'), date: d(s[3]), artisanId: a.id, artisanName: a.name,
        productId: p.id, sku: p.sku, productName: p.name, qty: s[2], targetDate: d(s[4]),
        proof: 'Bukti terima ' + a.id, spkId: spk[i].id, notes: '', createdAt: new Date().toISOString()
      };
    });

    const returns = [
      ['DIST001', 98, 2, -10, 'Sesuai pesanan'],
      ['DIST002', 148, 2, -8, 'Ada 2 pcs cacat finish'],
      ['DIST005', 70, 0, -5, 'Selesai lebih awal']
    ].map((r, i) => {
      const dist = distributions.find(x => x.id === r[0]);
      return {
        id: 'RET' + String(i + 1).padStart(3, '0'), date: d(r[3]), distributionId: dist.id,
        artisanId: dist.artisanId, artisanName: dist.artisanName, productId: dist.productId,
        sku: dist.sku, productName: dist.productName, qty: r[1], afkirQty: r[2],
        goodQty: r[1] - r[2], notes: r[4], createdAt: new Date().toISOString()
      };
    });

    const qc = [
      ['P005', 90, 88, 2, -9, 'Lulus', 'Siap kirim'],
      ['P005', 146, 143, 3, -7, 'Lulus', 'Siap kirim'],
      ['P002', 60, 58, 2, -4, 'Lulus', 'Siap kirim']
    ].map((q, i) => {
      const p = products.find(z => z.id === q[0]);
      return {
        id: 'QC' + String(i + 1).padStart(3, '0'), date: d(q[4]), productId: p.id, sku: p.sku,
        productName: p.name, qty: q[1], passedQty: q[2], rejectedQty: q[3], status: q[5],
        notes: q[6], createdAt: new Date().toISOString()
      };
    });

    const outbound = [
      ['P001', 40, 'Customer', 'Toko Furniture Nusantara', '-', 'SJ/2026/00101', 'Budi', -16, 'Pesanan retail'],
      ['P005', 60, 'Customer', 'CV Interiors', '-', 'SJ/2026/00102', 'Sari', -5, 'Dining chair finish'],
      ['P002', 30, 'Borong Obat', 'Borong Obat Jepara', 'Pak Suryono', 'SJ/2026/00103', 'Budi', -3, 'Borongan'],
      ['P005', 10, 'Rusak/Afkir', 'Gudang Afkir', '-', '-', 'Sari', -2, 'Afkir QC']
    ].map((o, i) => {
      const p = products.find(z => z.id === o[0]);
      return {
        id: 'OUT' + String(i + 1).padStart(3, '0'), date: d(o[7]), type: o[2], productId: p.id,
        sku: p.sku, productName: p.name, qty: o[1], destination: o[3], artisanReceiver: o[4],
        suratJalan: o[5], staff: o[6], notes: o[8], createdAt: new Date().toISOString()
      };
    });

    const wages = [
      ['Rizky Prasetyo', 150000, 25000, 1, 2, -9, 'Lembur finishing kursi', 'Mandor'],
      ['Sinta Wulandari', 140000, 20000, 1, 0, -9, '', 'Pemborong Amplas'],
      ['Agus Saliman', 160000, 25000, 1, 1, -8, 'Lembur perakitan', 'Pemborong Packing'],
      ['Rizky Prasetyo', 150000, 25000, 1, 3, -7, 'Lembur pengiriman', 'Mandor'],
      ['Sinta Wulandari', 140000, 20000, 1, 1, -6, '', 'Pemborong Amplas'],
      ['Agus Saliman', 160000, 25000, 1, 0, -5, '', 'Pemborong Packing'],
      ['Rizky Prasetyo', 150000, 25000, 1, 2, -3, 'Lembur finishing', 'Mandor'],
      ['Sinta Wulandari', 140000, 20000, 1, 0, -2, '', 'Pemborong Amplas'],
      ['Agus Saliman', 160000, 25000, 1, 2, -1, 'Lembur packing', 'Pemborong Packing'],
      ['Rizky Prasetyo', 150000, 25000, 1, 1, 0, 'Masuk hari ini', 'Mandor']
    ].map((w, i) => ({
      id: 'WG' + String(i + 1).padStart(3, '0'), date: d(w[5]), employee: w[0],
      dailyWage: w[1], overtimeRate: w[2], days: w[3], overtimeHours: w[4],
      position: w[7], notes: w[6], createdAt: new Date().toISOString()
    }));

    return {
      version: 1, products, artisans, inbound, outbound, distributions, returns, qc, spk, wages,
      borong: [],
      users: [
        { id: 'U1', username: 'admin', password: hash(NEW_PASSWORDS.U1), name: 'Administrator', role: 'ADMIN', active: true },
        { id: 'U2', username: 'gudang', password: hash(NEW_PASSWORDS.U2), name: 'Budi (Gudang)', role: 'GUDANG', active: true },
        { id: 'U3', username: 'purchasing', password: hash(NEW_PASSWORDS.U3), name: 'Sari (Purchasing)', role: 'PURCHASING', active: true },
        { id: 'U4', username: 'produksi', password: hash(NEW_PASSWORDS.U4), name: 'Rangga (Produksi)', role: 'PRODUKSI', active: true },
        { id: 'U5', username: 'manager', password: hash(NEW_PASSWORDS.U5), name: 'Pak Direktur', role: 'MANAGER', active: true }
      ],
      settings: { company: 'CV Furniture Jati', seededAt: new Date().toISOString() }
    };
  }

  /* ---------- Penyimpanan ---------- */
  // Naikkan password bawaan lama di data lokal yang sudah tersimpan,
  // tanpa menghapus stok/transaksi dan tanpa menimpa password custom.
  function migratePasswords() {
    if (!Array.isArray(cache.users)) return;
    let changed = false;
    cache.users.forEach(u => {
      const old = OLD_PASSWORDS[u.id];
      const next = NEW_PASSWORDS[u.id];
      if (!old || !next) return;
      if (u.password === hash(old)) {
        u.password = hash(next);
        changed = true;
      } else if (u.password === OLD_SHA[u.id]) {
        u.password = NEW_SHA[u.id];
        changed = true;
      }
    });
    // Data lama belum punya jabatan / masih memakai jabatan gabungan.
    if (Array.isArray(cache.wages)) {
      cache.wages.forEach(w => {
        if (!w.position && WAGE_POSITIONS[w.employee]) { w.position = WAGE_POSITIONS[w.employee]; changed = true; }
        if (w.position === 'Manager/Mandor/Angkat Junjung') {
          w.position = WAGE_POSITIONS[w.employee] || 'Mandor';
          changed = true;
        }
      });
    }
    if (changed) {
      try { localStorage.setItem(KEY, JSON.stringify(cache)); }
      catch (e) { console.warn('Gagal menyimpan migrasi data lokal', e); }
    }
  }

  function load() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        cache = JSON.parse(raw);
        TABLES.forEach(k => { if (!Array.isArray(cache[k])) cache[k] = []; });
        migratePasswords();
        return cache;
      }
    } catch (e) { console.warn('DB load gagal, reset:', e); }
    cache = seed(); save(); return cache;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); }
    catch (e) {
      // Foto produk bisa membuat cache melebihi kuota localStorage (±5 MB).
      // Simpan semua data teks; foto besar dibuang hanya dari cache lokal.
      // Data foto tetap aman di Supabase dan akan tertarik lagi saat online.
      let savedSlim = false;
      try {
        const slim = JSON.parse(JSON.stringify(cache));
        (slim.products || []).forEach(p => {
          if (typeof p.photo === 'string' && p.photo.length > 1000) delete p.photo;
        });
        localStorage.setItem(KEY, JSON.stringify(slim));
        savedSlim = true;
      } catch (e2) { /* benar-benar penuh, tetap lanjut ke Supabase */ }
      if (window.UI && typeof UI.toast === 'function') {
        if (savedSlim && !slimCacheWarned) {
          UI.toast('Penyimpanan browser penuh. Foto tetap tersimpan di Supabase, tetapi tidak disimpan di cache lokal.', 'warning');
          slimCacheWarned = true;
        } else if (!savedSlim) {
          UI.toast('Gagal menyimpan data ke browser (penyimpanan penuh)', 'error');
        }
      }
    }
    scheduleBackup();
  }

  /* ---------- Kategori produk (semua dibuat & dikelola manual) ---------- */
  // Tidak ada kategori bawaan. Kategori lama yang masih dipakai produk
  // diangkat sekali ke daftar kelolaan agar tetap bisa diubah/dihapus.
  function getCategories() {
    let extra = [];
    try { extra = JSON.parse(localStorage.getItem(CAT_KEY) || '[]') || []; } catch (e) { extra = []; }
    const used = all('products').map(p => String(p.category || '').trim()).filter(Boolean);
    const merged = Array.from(new Set(extra.concat(used)));
    if (merged.length !== extra.length) {
      try { localStorage.setItem(CAT_KEY, JSON.stringify(merged)); } catch (e) {}
    }
    return merged.sort(U.natCompare);
  }
  function saveCategories(list) {
    const clean = Array.from(new Set((list || []).map(c => String(c).trim()).filter(Boolean)));
    try { localStorage.setItem(CAT_KEY, JSON.stringify(clean)); }
    catch (e) {
      if (window.UI && typeof UI.toast === 'function') UI.toast('Gagal menyimpan kategori (penyimpanan penuh)', 'error');
    }
    return getCategories();
  }

  /* ---------- Daftar karyawan gaji & tarif tetap ---------- */
  // Master karyawan disimpan di browser (seperti kategori). Pertama kali
  // dibuka, daftar diisi otomatis dari catatan gaji yang sudah ada.
  function getPayrollEmployees() {
    const raw = localStorage.getItem(PAYROLL_EMP_KEY);
    let list = [];
    if (raw === null) {
      const latest = {};
      all('wages').forEach(w => {
        const name = String(w.employee || '').trim();
        if (!name) return;
        if (!latest[name] || String(w.createdAt || '') >= String(latest[name].createdAt || '')) latest[name] = w;
      });
      list = Object.keys(latest).map(name => ({
        id: name, name, position: latest[name].position || '',
        dailyWage: U.num(latest[name].dailyWage), overtimeRate: U.num(latest[name].overtimeRate),
        createdAt: latest[name].createdAt || new Date().toISOString()
      }));
      if (list.length) {
        try { localStorage.setItem(PAYROLL_EMP_KEY, JSON.stringify(list)); } catch (e) {}
      }
      return list;
    }
    try { list = JSON.parse(raw) || []; } catch (e) { list = []; }
    return list.filter(e => e && e.name).map(e => ({
      id: String(e.id || e.name), name: String(e.name).trim(), position: String(e.position || ''),
      dailyWage: U.num(e.dailyWage), overtimeRate: U.num(e.overtimeRate), createdAt: e.createdAt || ''
    }));
  }
  function savePayrollEmployees(list) {
    const clean = (list || []).filter(e => e && String(e.name || '').trim()).map(e => ({
      id: String(e.id || e.name).trim(), name: String(e.name).trim(), position: String(e.position || ''),
      dailyWage: U.num(e.dailyWage), overtimeRate: U.num(e.overtimeRate), createdAt: e.createdAt || new Date().toISOString()
    }));
    try { localStorage.setItem(PAYROLL_EMP_KEY, JSON.stringify(clean)); }
    catch (e) {
      if (window.UI && typeof UI.toast === 'function') UI.toast('Gagal menyimpan daftar karyawan (penyimpanan penuh)', 'error');
    }
    return clean;
  }
  function addPayrollEmployee(d) {
    const name = String((d || {}).name || '').trim();
    if (!name || getPayrollEmployees().some(e => e.name.toLowerCase() === name.toLowerCase())) return null;
    const list = getPayrollEmployees();
    const row = {
      id: name, name, position: String(d.position || ''),
      dailyWage: U.num(d.dailyWage), overtimeRate: U.num(d.overtimeRate), createdAt: new Date().toISOString()
    };
    list.push(row); savePayrollEmployees(list); return row;
  }
  function updatePayrollEmployee(id, d) {
    const list = getPayrollEmployees(), i = list.findIndex(e => e.id === id);
    if (i < 0) return null;
    const name = String((d || {}).name || list[i].name || '').trim();
    if (!name || list.some((e, j) => j !== i && e.name.toLowerCase() === name.toLowerCase())) return null;
    const oldName = list[i].name;
    list[i] = Object.assign({}, list[i], {
      name, id: name, position: String(d.position || ''),
      dailyWage: U.num(d.dailyWage), overtimeRate: U.num(d.overtimeRate)
    });
    savePayrollEmployees(list);
    if (oldName !== name) renamePayrollAdjustments(oldName, name);
    return list[i];
  }
  function deletePayrollEmployee(id) {
    savePayrollEmployees(getPayrollEmployees().filter(e => e.id !== id));
    return true;
  }

  /* ---------- Bonus / bon per karyawan dan per pekan ---------- */
  function adjustmentKey(employee, week) { return String(employee || '') + '|' + String(week || ''); }
  function getPayrollAdjustment(employee, week) {
    let map = {};
    try { map = JSON.parse(localStorage.getItem(PAYROLL_ADJ_KEY) || '{}') || {}; } catch (e) { map = {}; }
    return map[adjustmentKey(employee, week)] || { bonus: 0, debt: 0, late: 0 };
  }
  function savePayrollAdjustment(employee, week, patch) {
    if (!employee || !week) return;
    let map = {};
    try { map = JSON.parse(localStorage.getItem(PAYROLL_ADJ_KEY) || '{}') || {}; } catch (e) { map = {}; }
    const key = adjustmentKey(employee, week);
    map[key] = Object.assign({ bonus: 0, debt: 0, late: 0 }, map[key] || {}, patch || {});
    try { localStorage.setItem(PAYROLL_ADJ_KEY, JSON.stringify(map)); }
    catch (e) {
      if (window.UI && typeof UI.toast === 'function') UI.toast('Gagal menyimpan bonus/bon karyawan (penyimpanan penuh)', 'error');
    }
  }
  function renamePayrollAdjustments(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
    let map = {};
    try { map = JSON.parse(localStorage.getItem(PAYROLL_ADJ_KEY) || '{}') || {}; } catch (e) { map = {}; }
    const prefix = oldName + '|';
    let changed = false;
    Object.keys(map).forEach(k => {
      if (k.indexOf(prefix) !== 0) return;
      const nk = newName + k.slice(prefix.length);
      map[nk] = Object.assign({}, map[nk] || {}, map[k]);
      delete map[k]; changed = true;
    });
    if (changed) {
      try { localStorage.setItem(PAYROLL_ADJ_KEY, JSON.stringify(map)); } catch (e) {}
    }
  }
  function addCategory(name) {
    const clean = String(name || '').trim();
    if (!clean) return false;
    if (getCategories().some(c => c.toLowerCase() === clean.toLowerCase())) return false;
    saveCategories(getCategories().concat(clean));
    return true;
  }
  function renameCategory(oldName, newName) {
    const clean = String(newName || '').trim();
    if (!clean || !oldName || clean === oldName) return false;
    if (getCategories().some(c => c !== oldName && c.toLowerCase() === clean.toLowerCase())) return false;
    const ids = all('products').filter(p => p.category === oldName).map(p => p.id);
    if (ids.length) updateMany('products', ids, { category: clean });
    saveCategories(getCategories().filter(c => c !== oldName).concat(clean));
    return true;
  }
  // name = kategori yang dihapus; replacement = kategori tujuan bila masih dipakai produk.
  function deleteCategory(name, replacement) {
    const clean = String(name || '').trim();
    if (!clean) return false;
    const next = String(replacement || '').trim();
    const ids = all('products').filter(p => p.category === clean).map(p => p.id);
    if (ids.length && !next) return false;
    if (next && next !== clean) {
      if (!getCategories().some(c => c.toLowerCase() === next.toLowerCase())) return false;
      updateMany('products', ids, { category: next });
    }
    saveCategories(getCategories().filter(c => c !== clean));
    return true;
  }

  /* ---------- Backup ke Google Sheet / Gmail via Apps Script ---------- */
  let backupTimer = null;
  function getBackupConfig() {
    try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function saveBackupConfig(cfg) {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(cfg || {}));
    return getBackupConfig();
  }
  async function pushBackup(silent) {
    const cfg = getBackupConfig();
    if (!cfg.url) throw new Error('Web App URL backup belum diisi di menu Pengaturan.');
    const payload = {
      token: cfg.token || '', email: cfg.email || '',
      timestamp: new Date().toISOString(), app: 'Stok Solidteak Furniture',
      tables: load()
    };
    let res = null, text = '', opaque = false;
    try {
      res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
      text = await res.text();
    } catch (e) {
      // Beberapa browser memblokir pembacaan response lintas origin.
      // Fallback: kirim tetap jalan (simple request), hasil dicek di Sheet/email.
      try {
        await fetch(cfg.url, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        opaque = true;
      } catch (e2) {
        throw new Error('Gagal menghubungi Google Apps Script: ' + e2.message + '. Cek URL dan koneksi internet.');
      }
    }
    let out;
    if (opaque) {
      const rows = Object.keys(payload.tables).reduce((n, k) => n + (Array.isArray(payload.tables[k]) ? payload.tables[k].length : 0), 0);
      out = { ok: true, rows: rows, tables: Object.keys(payload.tables).length, emailSent: null, opaque: true };
    } else {
      try { out = JSON.parse(text); }
      catch (e) { throw new Error('Balasan backup tidak dikenali: ' + String(text || '').slice(0, 120)); }
      if (!res.ok || out.ok === false) throw new Error(out.error || ('HTTP ' + res.status));
    }
    cfg.lastBackup = new Date().toISOString();
    cfg.sheetUrl = out.sheetUrl || cfg.sheetUrl;
    saveBackupConfig(cfg);
    if (!silent) return out;
    return out;
  }
  function scheduleBackup() {
    const cfg = getBackupConfig();
    if (!cfg.auto || !cfg.url) return;
    clearTimeout(backupTimer);
    backupTimer = setTimeout(() => { pushBackup(true).catch(() => {}); }, 20000);
  }

  /* ---------- Konfigurasi Supabase ---------- */
  function getConfig() {
    try {
      const local = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
      if (local && local.url && local.key) return local;
    } catch (e) { /* abaikan */ }
    const baked = window.SUPABASE_CONFIG;
    return (baked && baked.url && baked.key) ? baked : null;
  }
  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    localStorage.removeItem(DISABLE_KEY);
  }
  function isSupabase() { return mode === 'supabase' && !!sb; }
  function isConfigured() { return !!getConfig(); }
  function autoConnectEnabled() { return !localStorage.getItem(DISABLE_KEY); }
  function disableAutoConnect() { localStorage.setItem(DISABLE_KEY, '1'); }

  async function connectSupabase(cfg) {
    if (!cfg || !cfg.url || !cfg.key) throw new Error('Project URL dan publishable/anon key wajib diisi');
    const url = cfg.url.trim(), key = cfg.key.trim();
    if (/^sb_secret_|service_role/i.test(key)) throw new Error('Anda memakai SECRET key. Gunakan Publishable key (sb_publishable_...) atau anon key (eyJ...).');
    if (!window.supabase || !window.supabase.createClient) throw new Error('Library Supabase belum termuat. Periksa internet lalu Refresh (Ctrl+F5).');
    let client;
    try { client = window.supabase.createClient(url, key); }
    catch (e) { throw new Error('Key tidak dikenali library: ' + e.message + '. Refresh halaman (Ctrl+F5) lalu coba lagi.'); }

    const test = await client.from('users').select('id').limit(1);
    if (test.error) {
      const raw = String(test.error.message || test.error.hint || test.error.details || JSON.stringify(test.error));
      const code = test.error.code;
      let msg = raw;
      if (code === '42P01' || /does not exist|relation/i.test(raw)) {
        msg = 'Tabel belum ada di project ini. Jalankan seluruh isi supabase/schema.sql di SQL Editor, pada project yang sama dengan URL/key yang dipakai. Detail: ' + raw;
      } else if (/jwt|apikey|unauthorized|401|invalid/i.test(raw)) {
        msg = 'Key ditolak. Pakai Publishable key (sb_publishable_...) atau anon key lama (eyJ...), bukan secret key. Detail: ' + raw;
      } else if (/permission denied for table/i.test(raw)) {
        msg = 'Role anon belum punya hak akses tabel. Buka Supabase -> SQL Editor -> jalankan isi supabase/fix-permission.sql -> Run, lalu coba lagi. Atau jalankan ulang schema.sql terbaru yang sudah memuat GRANT. Detail: ' + raw;
      } else if (/permission|42501|rls|row-level/i.test(raw)) {
        msg = 'Akses ditolak RLS/policy. Jalankan seluruh isi supabase/schema.sql sampai selesai, lalu coba lagi. Detail: ' + raw;
      }
      throw new Error('Gagal terhubung: ' + msg);
    }

    // Pastikan fungsi login di server benar-benar bisa dipanggil
    const authTest = await client.rpc('authenticate', { p_username: '__cek__', p_password: '__cek__' });
    if (authTest.error) {
      const raw = String(authTest.error.message || JSON.stringify(authTest.error));
      let msg = raw;
      if (/digest/i.test(raw)) {
        msg = 'Fungsilogin di Supabase error (digest tidak ditemukan). Jalankan isi supabase/fix-auth.sql di SQL Editor -> Run. Detail: ' + raw;
      } else if (/does not exist|42883|404/i.test(raw)) {
        msg = 'Fungsi authenticate() belum ada. Jalankan seluruh isi supabase/schema.sql atau supabase/fix-auth.sql di SQL Editor -> Run. Detail: ' + raw;
      }
      throw new Error('Koneksi berhasil, tapi login belum siap: ' + msg);
    }

    const snapshot = JSON.parse(JSON.stringify(load()));
    sb = client; mode = 'supabase';
    localStorage.setItem(MODE_KEY, 'supabase'); saveConfig(cfg);
    await pull();

    // Isi data contoh ke Supabase pada koneksi pertama kali (kecuali users, sudah dibuat schema.sql)
    if (!cache.products.length) {
      for (const name of TABLES.filter(n => n !== 'users')) {
        if (snapshot[name] && snapshot[name].length) {
          const { error } = await sb.from(name).insert(snapshot[name]);
          if (error) throw new Error('Gagal mengunggah data contoh (' + name + '): ' + error.message);
        }
      }
      await pull();
    }
    return true;
  }

  function useLocal() {
    sb = null; mode = 'local'; localStorage.setItem(MODE_KEY, 'local');
    disableAutoConnect();
    UI.toast('Berpindah ke mode lokal (data di browser ini)', 'success');
  }

  async function pull() {
    if (!sb) return cache;
    const out = {};
    for (const name of TABLES) {
      const { data, error } = await sb.from(name).select('*');
      if (error) {
        const raw = String(error.message || error.hint || error.details || '');
        // Tabel box baru: jangan sampai seluruh aplikasi gagal login sebelum migrasi dijalankan.
        if (name === 'boxes' && (error.code === '42P01' || /does not exist|relation/i.test(raw))) {
          console.warn('Tabel boxes belum ada. Jalankan supabase/add-boxes.sql di SQL Editor.');
          out[name] = [];
          continue;
        }
        throw new Error('Gagal memuat ' + name + ': ' + error.message +
          (name === 'wages' ? '. Jalankan supabase/add-wages.sql di SQL Editor untuk membuat tabel gaji.' :
           name === 'borong' ? '. Jalankan supabase/add-borong.sql di SQL Editor untuk membuat tabel gaji borong.' :
           name === 'boxes' ? '. Jalankan supabase/add-boxes.sql di SQL Editor untuk membuat tabel box.' : ''));
      }
      out[name] = data || [];
    }
    cache = out; migratePasswords(); save(); return cache;
  }

  async function syncNow() {
    if (!isSupabase()) return false;
    await pull(); return true;
  }

  async function queue(fn, label) {
    try {
      const { error } = await fn();
      if (error) throw error;
      return { ok: true };
    } catch (e) {
      UI.toast('Gagal sinkron ke Supabase (' + label + '): ' + e.message, 'error');
      try { await pull(); } catch (ignore) {}
      if (window.App) App.refresh();
      return { ok: false, error: e };
    }
  }

  async function reset() {
    const fresh = seed();
    if (isSupabase()) {
      const keepUsers = (load().users || []).slice();
      fresh.users = keepUsers;
      for (const name of TABLES.filter(n => n !== 'users')) {
        const { error } = await sb.from(name).delete().neq('id', '');
        if (error) throw new Error('Gagal mengosongkan ' + name + ': ' + error.message);
      }
      cache = fresh;
      for (const name of TABLES.filter(n => n !== 'users')) {
        const { error } = await sb.from(name).insert(cache[name]);
        if (error) throw new Error('Gagal mengisi ' + name + ': ' + error.message);
      }
      migratePasswords(); save(); return cache;
    }
    cache = fresh; migratePasswords(); save(); return cache;
  }

  async function replace(obj) {
    if (!obj || !Array.isArray(obj.products) || !Array.isArray(obj.artisans)) return false;
    TABLES.forEach(k => { if (!Array.isArray(obj[k])) obj[k] = []; });
    if (isSupabase()) {
      const keepUsers = (load().users || []).slice();
      for (const name of TABLES.filter(n => n !== 'users')) {
        const { error } = await sb.from(name).delete().neq('id', '');
        if (error) throw new Error('Gagal memulihkan ' + name + ': ' + error.message);
      }
      obj.users = keepUsers; // akun & hash password tetap dari Supabase
      for (const name of TABLES.filter(n => n !== 'users')) {
        if (!obj[name].length) continue;
        const { error } = await sb.from(name).insert(obj[name]);
        if (error) throw new Error('Gagal memulihkan ' + name + ': ' + error.message);
      }
    }
    cache = obj; migratePasswords(); save(); return true;
  }

  /* ---------- CRUD (sinkron untuk UI, async ke Supabase) ---------- */
  const all = name => (load()[name] || []).slice();
  const get = (name, id) => load()[name].find(x => x.id === id) || null;
  function applyInsert(name, obj) {
    const db = load();
    const row = Object.assign({ id: obj.id || U.uid(name.slice(0, 3)), createdAt: new Date().toISOString() }, obj);
    db[name].push(row); save();
    return row;
  }
  function applyUpdate(name, id, patch) {
    const db = load(), i = db[name].findIndex(x => x.id === id);
    if (i < 0) return null;
    db[name][i] = Object.assign({}, db[name][i], patch); save();
    return db[name][i];
  }
  function insert(name, obj) {
    const row = applyInsert(name, obj);
    if (isSupabase()) queue(() => sb.from(name).insert(row), 'tambah ' + name);
    return row;
  }
  function update(name, id, patch) {
    const row = applyUpdate(name, id, patch);
    if (row && isSupabase()) queue(() => sb.from(name).update(patch).eq('id', id), 'update ' + name);
    return row;
  }
  // Versi await: dipakai form yang harus memastikan data tersimpan sebelum tutorial sukses.
  async function insertAsync(name, obj) {
    const row = applyInsert(name, obj);
    const res = isSupabase() ? await queue(() => sb.from(name).insert(row), 'tambah ' + name) : { ok: true };
    return Object.assign({ row }, res);
  }
  async function updateAsync(name, id, patch) {
    const row = applyUpdate(name, id, patch);
    if (!row) return { ok: false, row: null, error: new Error('Data tidak ditemukan') };
    const res = isSupabase() ? await queue(() => sb.from(name).update(patch).eq('id', id), 'update ' + name) : { ok: true };
    return Object.assign({ row }, res);
  }
  function remove(name, id) {
    const db = load();
    db[name] = db[name].filter(x => x.id !== id); save();
    if (isSupabase()) queue(() => sb.from(name).delete().eq('id', id), 'hapus ' + name);
  }
  function removeMany(name, ids) {
    const db = load();
    const set = new Set(ids);
    db[name] = db[name].filter(x => !set.has(x.id)); save();
    if (isSupabase() && ids.length) queue(() => sb.from(name).delete().in('id', ids), 'hapus ' + ids.length + ' ' + name);
  }
  function updateMany(name, ids, patch) {
    const db = load();
    const set = new Set(ids);
    db[name].forEach(row => { if (set.has(row.id)) Object.assign(row, patch); });
    save();
    if (isSupabase() && ids.length) queue(() => sb.from(name).update(patch).in('id', ids), 'update ' + ids.length + ' ' + name);
  }
  // Ubah ID/nama pengrajin dan semua riwayat yang mereferensikannya.
  function renameArtisan(oldId, newId, newName) {
    const from = String(oldId || '').trim();
    const to = String(newId || '').trim().toUpperCase();
    const nm = String(newName || '').trim();
    if (!from || !to || !nm) return false;
    if (to !== from && get('artisans', to)) return false;
    const row = get('artisans', from);
    if (!row) return false;
    const patch = {};
    if (to !== from) patch.id = to;
    if (nm !== row.name) patch.name = nm;
    if (!Object.keys(patch).length) return true;
    Object.assign(row, patch);
    save();
    if (isSupabase()) queue(() => sb.from('artisans').update(patch).eq('id', from), 'update artisans');
    if (to !== from) {
      ['distributions', 'returns', 'spk'].forEach(name => {
        const ids = all(name).filter(x => x.artisanId === from).map(x => x.id);
        if (ids.length) updateMany(name, ids, { artisanId: to });
      });
    }
    if (nm !== row.name || patch.name) {
      const currentName = nm;
      ['distributions', 'returns'].forEach(name => {
        const ids = all(name).filter(x => x.artisanId === to).map(x => x.id);
        if (ids.length) updateMany(name, ids, { artisanName: currentName });
      });
    }
    return true;
  }

  /* ---------- Perhitungan stok otomatis ---------- */
  const sumWhere = (arr, pred, field) => U.sum(arr.filter(pred), x => x[field]);

  function qtyIn(pid) { return sumWhere(all('inbound'), x => x.productId === pid, 'qty'); }
  function qtyOut(pid, type) { return sumWhere(all('outbound'), x => x.productId === pid && (!type || x.type === type), 'qty'); }
  function qtyDist(pid, aid) { return sumWhere(all('distributions'), x => x.productId === pid && (!aid || x.artisanId === aid), 'qty'); }
  const isArtisanReturn = r => !r.source || r.source === 'Pengrajin' || !!r.distributionId;
  function qtyReturn(pid, aid) { return sumWhere(all('returns'), x => x.productId === pid && isArtisanReturn(x) && (!aid || x.artisanId === aid), 'qty'); }
  function qtyReturnSource(pid, source) { return sumWhere(all('returns'), x => x.productId === pid && x.source === source, 'qty'); }
  function qtyOutNet(pid, type) { return qtyOut(pid, type) - qtyReturnSource(pid, type); }
  function qtyAfkirArtisan(pid, aid) { return sumWhere(all('returns'), x => x.productId === pid && (!aid || x.artisanId === aid), 'afkirQty'); }
  function qtyQc(pid) { return sumWhere(all('qc'), x => x.productId === pid, 'qty'); }
  function qtyQcPassed(pid) { return sumWhere(all('qc'), x => x.productId === pid && !x.inboundId, 'passedQty'); }
  function qtyQcPassedAll(pid) { return sumWhere(all('qc'), x => x.productId === pid, 'passedQty'); }
  function qtyQcRejected(pid) { return sumWhere(all('qc'), x => x.productId === pid, 'rejectedQty'); }

  function stock(pid) {
    const borrowed = ['Borong Obat', 'Servis', 'Pinjaman Sampel'];
    const borrowedOut = U.sum(borrowed, t => qtyOut(pid, t));
    // Barang pinjaman baru kembali ke gudang setelah QC lulus dibuatkan barang masuk.
    const warehouse = qtyIn(pid) - qtyDist(pid) - qtyOut(pid) + qtyQcPassed(pid);
    const process = qtyDist(pid) - qtyReturn(pid);
    const qcPending = sumWhere(all('returns'), x => x.productId === pid, 'goodQty') - qtyQc(pid);
    const damaged = qtyOut(pid, 'Rusak/Afkir') + qtyAfkirArtisan(pid) + qtyQcRejected(pid);
    const ready = Math.max(0, qtyQcPassedAll(pid) - qtyOut(pid, 'Customer') - borrowedOut);
    return {
      warehouse: warehouse, process: process, qc: qcPending, damaged: damaged,
      ready: ready, borong: qtyOutNet(pid, 'Borong Obat'), total: warehouse + process + qcPending
    };
  }

  function totals() {
    const keys = ['warehouse', 'process', 'qc', 'damaged', 'ready', 'borong', 'total'];
    const out = { inbound: sumWhere(all('inbound'), () => true, 'qty'), outbound: sumWhere(all('outbound'), () => true, 'qty') };
    keys.forEach(k => out[k] = 0);
    all('products').forEach(p => { const s = stock(p.id); keys.forEach(k => out[k] += s[k]); });
    return out;
  }

  /* ---------- Stok box & kubikasi ---------- */
  function boxVolume(b) {
    if (!b) return 0;
    const manual = U.num(b.volumeM3);
    if (manual > 0) return manual;
    const p = U.num(b.lengthCm), l = U.num(b.widthCm), h = U.num(b.heightCm);
    if (p <= 0 || l <= 0 || h <= 0) return 0;
    return Math.round((p * l * h / 1000000) * 1000000) / 1000000;
  }
  function boxTotalM3(b) { return U.num(b.qty) * boxVolume(b); }
  function boxSizeText(b) {
    if (!b) return '-';
    if (String(b.sizeDetail || '').trim()) return b.sizeDetail;
    const p = U.num(b.lengthCm), l = U.num(b.widthCm), h = U.num(b.heightCm);
    return (p || l || h) ? (p + ' x ' + l + ' x ' + h + ' cm') : '-';
  }
  function boxSummary() {
    const rows = all('boxes');
    return {
      types: rows.length,
      qty: U.sum(rows, b => U.num(b.qty)),
      m3: U.sum(rows, b => boxTotalM3(b)),
      low: rows.filter(b => U.num(b.qty) <= U.num(b.minQty)).length
    };
  }

  /* ---------- Gaji karyawan ---------- */
  function wageTotal(w) { return U.num(w.days) * U.num(w.dailyWage) + U.num(w.overtimeHours) * U.num(w.overtimeRate); }
  function payrollSummary(date) {
    const rows = all('wages').filter(w => !date || w.date === date);
    return {
      rows: rows,
      employees: U.unique(rows.map(w => w.employee)).length,
      basic: U.sum(rows, w => U.num(w.days) * U.num(w.dailyWage)),
      overtime: U.sum(rows, w => U.num(w.overtimeHours) * U.num(w.overtimeRate)),
      total: U.sum(rows, wageTotal)
    };
  }
  function payrollWeek(employee, start) {
    const end = U.shiftDays(6, start);
    const rows = all('wages').filter(w => w.employee === employee && w.date >= start && w.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date));
    const basic = U.sum(rows, w => U.num(w.days) * U.num(w.dailyWage));
    const overtime = U.sum(rows, w => U.num(w.overtimeHours) * U.num(w.overtimeRate));
    return {
      employee, start, end, rows, basic, overtime, subtotal: basic + overtime,
      position: (rows[0] || {}).position || ''
    };
  }

  /* ---------- Gaji borong amplas & packing ---------- */
  const borongItemTotal = it => U.num(it.qty) * U.num(it.rate) + U.num(it.overtime);
  const borongItemTarget = it => U.num(it.targetQty || it.qty);
  const borongDone = b => U.sum(b.items || [], it => U.num(it.qty));
  const borongTarget = b => U.sum(b.items || [], borongItemTarget);
  function borongTotal(b) {
    return U.sum(b.items || [], borongItemTotal) + U.num(b.overtimeExtra);
  }
  function borongSummary(date) {
    const rows = all('borong').filter(b => !date || b.date === date);
    const byType = t => U.sum(rows.filter(b => b.type === t), borongTotal);
    return {
      rows,
      people: U.unique(rows.map(b => b.employee)).length,
      amplas: byType('Amplas'),
      packing: byType('Packing'),
      overtime: U.sum(rows, b => U.sum(b.items || [], it => U.num(it.overtime)) + U.num(b.overtimeExtra)),
      done: U.sum(rows, borongDone),
      target: U.sum(rows, borongTarget),
      items: U.sum(rows, b => (b.items || []).length),
      total: U.sum(rows, borongTotal)
    };
  }
  function borongWeek(employee, start) {
    const end = U.shiftDays(6, start);
    const rows = all('borong').filter(b => (!employee || b.employee === employee) && b.date >= start && b.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.type).localeCompare(b.type));
    const items = [];
    rows.forEach(b => (b.items || []).forEach(it => items.push(Object.assign({
      date: b.date, employee: b.employee, type: b.type, borongId: b.id,
      handledById: b.handledById, handledByName: b.handledByName, workerName: b.workerName
    }, it))));
    const basic = U.sum(items, it => U.num(it.qty) * U.num(it.rate));
    const overtime = U.sum(items, it => U.num(it.overtime)) + U.sum(rows, b => U.num(b.overtimeExtra));
    return { employee, start, end, rows, items, basic, overtime, subtotal: basic + overtime,
      done: U.sum(rows, borongDone), target: U.sum(rows, borongTarget), total: U.sum(rows, borongTotal) };
  }

  /* ---------- Informasi operasional produksi & gudang (dashboard) ---------- */
  function opsSummary(date) {
    const day = date || U.today();
    const bucket = () => ({ qty: 0, items: [] });
    const add = (b, label, qty, href) => {
      const n = U.num(qty);
      if (n <= 0) return;
      b.qty += n;
      const found = b.items.find(x => x.label === label);
      if (found) found.qty += n; else b.items.push({ label, qty: n, href: href || '' });
    };
    const production = bucket(), qcPending = bucket(), sample = bucket(), borongObat = bucket(), servis = bucket(), warehouse = bucket();
    all('products').forEach(p => {
      const s = stock(p.id), sku = p.sku + ' - ' + p.name;
      add(production, sku, s.process, '#/distributions');
      add(qcPending, sku, s.qc, '#/returns');
      add(warehouse, sku, s.warehouse, '#/products');
      add(sample, sku, qtyOutNet(p.id, 'Pinjaman Sampel'), '#/outbound');
      add(borongObat, sku, qtyOutNet(p.id, 'Borong Obat'), '#/outbound');
      add(servis, sku, qtyOutNet(p.id, 'Servis'), '#/outbound');
    });
    const returned = bucket();
    all('returns').filter(r => !date || r.date === day).forEach(r => {
      add(returned, (r.source || 'Pengrajin') + ' - ' + (r.productName || r.sku || '-'), r.goodQty || r.qty, '#/returns');
    });
    const qcDone = bucket();
    all('qc').filter(q => !date || q.date === day).forEach(q => {
      add(qcDone, q.productName || q.sku || '-', q.passedQty, '#/returns');
    });
    const sortItems = b => { b.items.sort((a, z) => z.qty - a.qty); return b; };
    return {
      date: day,
      production: sortItems(production), qcPending: sortItems(qcPending), sample: sortItems(sample),
      borongObat: sortItems(borongObat), servis: sortItems(servis), returned: sortItems(returned), qcDone: sortItems(qcDone),
      warehouse: sortItems(warehouse),
      outside: production.qty + qcPending.qty + sample.qty + borongObat.qty + servis.qty
    };
  }

  /* Ringkasan kerja harian untuk pengawas (owner/manager) */
  function dailyWorkSummary(date) {
    const day = date || U.today();
    const dists = all('distributions').filter(d => d.date === day);
    const rets = all('returns').filter(r => r.date === day && isArtisanReturn(r));
    const prodMap = {};
    dists.forEach(d => {
      const name = (get('artisans', d.artisanId) || {}).name || d.artisanName || '-';
      prodMap[name] = prodMap[name] || { name, given: 0, finished: 0 };
      prodMap[name].given += U.num(d.qty);
    });
    rets.forEach(r => {
      const name = r.artisanName || (get('artisans', r.artisanId) || {}).name || '-';
      prodMap[name] = prodMap[name] || { name, given: 0, finished: 0 };
      prodMap[name].finished += U.num(r.goodQty);
    });
    const borongRows = all('borong').filter(b => b.date === day);
    const bMap = {};
    borongRows.forEach(b => {
      const admin = b.handledByName || (get('users', b.handledById) || {}).name || (get('users', b.handledById) || {}).username || '-';
      const key = admin + '|' + b.employee + '|' + b.type;
      bMap[key] = bMap[key] || { admin, worker: b.workerName || '', employee: b.employee, type: b.type, target: 0, done: 0, wage: 0 };
      bMap[key].target += borongTarget(b);
      bMap[key].done += borongDone(b);
      bMap[key].wage += borongTotal(b);
    });
    const production = Object.values(prodMap).sort((a, b) => U.natCompare(a.name, b.name));
    const borong = Object.values(bMap).sort((a, b) => U.natCompare(a.employee, b.employee) || a.type.localeCompare(b.type));
    return {
      date: day, production, borong,
      given: U.sum(production, r => r.given), finished: U.sum(production, r => r.finished),
      target: U.sum(borong, r => r.target), done: U.sum(borong, r => r.done),
      wage: U.sum(borong, r => r.wage)
    };
  }

  function artisanStats(aid) {
    const dists = all('distributions').filter(x => x.artisanId === aid);
    const rets = all('returns').filter(x => x.artisanId === aid);
    const received = U.sum(dists, x => x.qty);
    const returned = U.sum(rets, x => x.qty);
    const afkir = U.sum(rets, x => x.afkirQty);
    const t = U.today();
    const late = dists.filter(x => x.targetDate < t && (x.qty - U.sum(rets.filter(r => r.distributionId === x.id), r => r.qty)) > 0);
    return {
      received: received, finished: returned, unfinished: received - returned, afkir: afkir,
      lateCount: late.length, lateQty: U.sum(late, x => x.qty - U.sum(rets.filter(r => r.distributionId === x.id), r => r.qty)),
      lateItems: late, nearDeadline: dists.filter(x => x.targetDate >= t && x.targetDate <= U.shiftDays(3) && x.qty > U.sum(rets.filter(r => r.distributionId === x.id), r => r.qty))
    };
  }

  function distRemaining(distId) {
    const dist = get('distributions', distId);
    if (!dist) return 0;
    return dist.qty - sumWhere(all('returns'), r => r.distributionId === distId, 'qty');
  }

  function validate(kind, pid, qty, extra) {
    const n = U.num(qty);
    if (!n || n <= 0) return 'Jumlah harus lebih dari 0';
    if (kind === 'distribute' && n > stock(pid).warehouse) return 'Stok gudang tidak cukup. Tersedia: ' + stock(pid).warehouse;
    if (kind === 'ship' && n > stock(pid).warehouse) return 'Stok gudang tidak cukup. Tersedia: ' + stock(pid).warehouse;
    if (kind === 'return') {
      const available = extra && extra.distributionId ? distRemaining(extra.distributionId) : stock(pid).process;
      if (n > available) return 'Jumlah melebihi barang yang masih diproses pengrajin. Tersedia: ' + available;
      if (extra && U.num(extra.afkirQty) > n) return 'Jumlah afkir tidak boleh melebihi jumlah kembali';
    }
    if (kind === 'qc' && n > stock(pid).qc) return 'Jumlah melebihi barang menunggu QC. Tersedia: ' + stock(pid).qc;
    return null;
  }

  /* ---------- Auth & hak akses ---------- */
  async function authenticate(username, password) {
    if (isSupabase()) {
      const { data, error } = await sb.rpc('authenticate', { p_username: username, p_password: password });
      if (error) throw new Error('Login gagal: ' + error.message);
      return (data && data[0]) ? data[0] : null;
    }
    const u = load().users.find(x => x.username === String(username).toLowerCase().trim());
    if (!u || !u.active) return null;
    const pass = String(password);
    let sha = hash(pass);
    try { sha = await hashAsync(pass); } catch (e) {}
    return (u.password === hash(pass) || u.password === sha) ? u : null;
  }
  function currentUser() {
    try {
      const id = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!id) return null;
      const u = get('users', id);
      return u && u.active ? u : null;
    } catch (e) { return null; }
  }
  function login(user) { localStorage.setItem(SESSION_KEY, JSON.stringify(user.id)); }
  function logout() { localStorage.removeItem(SESSION_KEY); }

  const PERMS = {
    ADMIN: ['*'],
    GUDANG: ['dashboard', 'products.view', 'inbound.*', 'outbound.*', 'boxes.*', 'artisans.*', 'distributions.view', 'returns.*', 'qc.*', 'spk.view', 'borong.*', 'reports.*', 'search', 'notifications', 'payroll.view', 'import.*'],
    PURCHASING: ['dashboard', 'products.view', 'inbound.*', 'boxes.view', 'reports.*', 'search', 'notifications', 'payroll.view', 'import.*'],
    PRODUKSI: ['dashboard', 'products.view', 'boxes.view', 'artisans.*', 'distributions.*', 'returns.view', 'qc.view', 'spk.*', 'borong.*', 'reports.view', 'search', 'notifications', 'payroll.view'],
    MANAGER: ['dashboard', 'products.view', 'inbound.view', 'outbound.view', 'boxes.view', 'artisans.*', 'distributions.view', 'returns.view', 'qc.view', 'spk.view', 'borong.view', 'borong.assign', 'reports.*', 'search', 'notifications', 'payroll.*', 'import.view']
  };
  function can(perm) {
    const u = currentUser();
    if (!u) return false;
    const list = PERMS[u.role] || [];
    if (list.includes('*')) return true;
    if (list.includes(perm)) return true;
    const parts = perm.split('.');
    return parts.length > 1 && list.includes(parts[0] + '.*');
  }

  return {
    KEY, TABLES, JOB_TITLES, load, save, reset, replace, all, get, insert, insertAsync, update, updateAsync, remove, removeMany, updateMany, renameArtisan,
    getCategories, saveCategories, addCategory, renameCategory, deleteCategory,
    getPayrollEmployees, savePayrollEmployees, addPayrollEmployee, updatePayrollEmployee, deletePayrollEmployee,
    getPayrollAdjustment, savePayrollAdjustment,
    getConfig, saveConfig, getBackupConfig, saveBackupConfig, pushBackup, connectSupabase, useLocal, isSupabase, isConfigured, autoConnectEnabled, pull, syncNow,
    qtyIn, qtyOut, qtyOutNet, qtyDist, qtyReturn, qtyReturnSource, qtyAfkirArtisan, qtyQc, qtyQcPassed, qtyQcPassedAll, qtyQcRejected,
    stock, totals, opsSummary, dailyWorkSummary, payrollSummary, payrollWeek, wageTotal,
    boxVolume, boxTotalM3, boxSizeText, boxSummary,
    borongItemTotal, borongItemTarget, borongDone, borongTarget, borongTotal, borongSummary, borongWeek,
    artisanStats, distRemaining, validate,
    authenticate, currentUser, login, logout, can, hash, hashAsync, svgPhoto
  };
})();
