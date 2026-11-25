/* store.js — database localStorage + mode Supabase (database bersama) */
window.DB = (function () {
  const KEY = 'furniture_stock_db_v1';
  const SESSION_KEY = 'furniture_session_v1';
  const CONFIG_KEY = 'furniture_supabase_config';
  const MODE_KEY = 'furniture_db_mode';
  const DISABLE_KEY = 'furniture_supabase_disabled';
  const TABLES = ['products', 'artisans', 'inbound', 'outbound', 'distributions', 'returns', 'qc', 'spk', 'users'];
  let cache = null;
  let mode = localStorage.getItem(MODE_KEY) || 'local';
  let sb = null;

  function svgPhoto(emoji, color) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120">' +
      '<rect width="160" height="120" fill="' + color + '"/>' +
      '<text x="80" y="78" font-size="56" text-anchor="middle">' + emoji + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function hash(str) {
    let h = 2166136261;
    const s = 'furn|' + str;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }
  async function hashAsync(str) {
    if (isSupabase() && window.crypto && window.crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('furn|' + str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return hash(str);
  }

  function seed() {
    const t = U.today();
    const d = n => U.shiftDays(n);
    const products = [
      ['ST001', 'Meja Makan Jati', 'Meja', '180 x 90 x 75 cm', 'Gudang', 10, '🪑', '#dbeafe'],
      ['ST002', 'Kursi Makan Jati', 'Kursi', '45 x 50 x 90 cm', 'Gudang', 20, '🪑', '#dcfce7'],
      ['ST003', 'Lemari Pakaian 3 Pintu', 'Lemari', '120 x 60 x 200 cm', 'Gudang', 5, '🚪', '#fef3c7'],
      ['ST004', 'Sofa Minimalis 3 Seat', 'Sofa', '200 x 85 x 80 cm', 'Proses Obat', 5, '🛋️', '#ede9fe'],
      ['ST005', 'Dining Chair', 'Kursi', '48 x 52 x 85 cm', 'Proses Obat', 30, '🪑', '#ffe4e6'],
      ['ST006', 'Meja Kerja Kayu', 'Meja', '140 x 70 x 75 cm', 'Gudang', 10, '🪵', '#e0f2fe'],
      ['ST007', 'Rak Buku Susun', 'Rak', '90 x 35 x 180 cm', 'Gudang', 10, '📚', '#f1f5f9'],
      ['ST008', 'Tempat Tidur Queen', 'Tempat Tidur', '160 x 200 x 90 cm', 'Proses Obat', 5, '🛏️', '#fae8ff'],
      ['ST009', 'Kursi Bar Jati', 'Kursi', '40 x 45 x 100 cm', 'Gudang', 15, '🪑', '#ccfbf1'],
      ['ST010', 'Meja Lipat Portable', 'Meja', '120 x 60 x 75 cm', 'Barang Jadi', 10, '📦', '#fef9c3']
    ].map((p, i) => ({
      id: 'P' + String(i + 1).padStart(3, '0'), sku: p[0], name: p[1], category: p[2], size: p[3],
      status: p[4], minStock: p[5], photo: svgPhoto(p[6], p[7]), notes: '', createdAt: t
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

    return {
      version: 1, products, artisans, inbound, outbound, distributions, returns, qc, spk,
      users: [
        { id: 'U1', username: 'admin', password: hash('admin123'), name: 'Administrator', role: 'ADMIN', active: true },
        { id: 'U2', username: 'gudang', password: hash('gudang123'), name: 'Budi (Gudang)', role: 'GUDANG', active: true },
        { id: 'U3', username: 'purchasing', password: hash('purchasing123'), name: 'Sari (Purchasing)', role: 'PURCHASING', active: true },
        { id: 'U4', username: 'produksi', password: hash('produksi123'), name: 'Rangga (Produksi)', role: 'PRODUKSI', active: true },
        { id: 'U5', username: 'manager', password: hash('manager123'), name: 'Pak Direktur', role: 'MANAGER', active: true }
      ],
      settings: { company: 'CV Furniture Jati', seededAt: new Date().toISOString() }
    };
  }

  /* ---------- Penyimpanan ---------- */
  function load() {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        cache = JSON.parse(raw);
        TABLES.forEach(k => { if (!Array.isArray(cache[k])) cache[k] = []; });
        return cache;
      }
    } catch (e) { console.warn('DB load gagal, reset:', e); }
    cache = seed(); save(); return cache;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); }
    catch (e) { U.toast('Gagal menyimpan cache lokal (penyimpanan penuh)', 'error'); }
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
        msg = 'Role anon belum punya hak akses tabel. Buka Supabase → SQL Editor → jalankan isi supabase/fix-permission.sql → Run, lalu coba lagi. Atau jalankan ulang schema.sql terbaru yang sudah memuat GRANT. Detail: ' + raw;
      } else if (/permission|42501|rls|row-level/i.test(raw)) {
        msg = 'Akses ditolak RLS/policy. Jalankan seluruh isi supabase/schema.sql sampai selesai, lalu coba lagi. Detail: ' + raw;
      }
      throw new Error('Gagal terhubung: ' + msg);
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
      if (error) throw new Error('Gagal memuat ' + name + ': ' + error.message);
      out[name] = data || [];
    }
    cache = out; save(); return cache;
  }

  async function syncNow() {
    if (!isSupabase()) return false;
    await pull(); return true;
  }

  async function queue(fn, label) {
    try {
      const { error } = await fn();
      if (error) throw error;
    } catch (e) {
      UI.toast('Gagal sinkron ke Supabase (' + label + '): ' + e.message, 'error');
      try { await pull(); } catch (ignore) {}
      if (window.App) App.refresh();
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
      save(); return cache;
    }
    cache = fresh; save(); return cache;
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
    cache = obj; save(); return true;
  }

  /* ---------- CRUD (sinkron untuk UI, async ke Supabase) ---------- */
  const all = name => (load()[name] || []).slice();
  const get = (name, id) => load()[name].find(x => x.id === id) || null;
  function insert(name, obj) {
    const db = load();
    const row = Object.assign({ id: U.uid(name.slice(0, 3)), createdAt: new Date().toISOString() }, obj);
    db[name].push(row); save();
    if (isSupabase()) queue(() => sb.from(name).insert(row), 'tambah ' + name);
    return row;
  }
  function update(name, id, patch) {
    const db = load(), i = db[name].findIndex(x => x.id === id);
    if (i < 0) return null;
    db[name][i] = Object.assign({}, db[name][i], patch); save();
    if (isSupabase()) queue(() => sb.from(name).update(patch).eq('id', id), 'update ' + name);
    return db[name][i];
  }
  function remove(name, id) {
    const db = load();
    db[name] = db[name].filter(x => x.id !== id); save();
    if (isSupabase()) queue(() => sb.from(name).delete().eq('id', id), 'hapus ' + name);
  }

  /* ---------- Perhitungan stok otomatis ---------- */
  const sumWhere = (arr, pred, field) => U.sum(arr.filter(pred), x => x[field]);

  function qtyIn(pid) { return sumWhere(all('inbound'), x => x.productId === pid, 'qty'); }
  function qtyOut(pid, type) { return sumWhere(all('outbound'), x => x.productId === pid && (!type || x.type === type), 'qty'); }
  function qtyDist(pid, aid) { return sumWhere(all('distributions'), x => x.productId === pid && (!aid || x.artisanId === aid), 'qty'); }
  function qtyReturn(pid, aid) { return sumWhere(all('returns'), x => x.productId === pid && (!aid || x.artisanId === aid), 'qty'); }
  function qtyAfkirArtisan(pid, aid) { return sumWhere(all('returns'), x => x.productId === pid && (!aid || x.artisanId === aid), 'afkirQty'); }
  function qtyQc(pid) { return sumWhere(all('qc'), x => x.productId === pid, 'qty'); }
  function qtyQcPassed(pid) { return sumWhere(all('qc'), x => x.productId === pid, 'passedQty'); }
  function qtyQcRejected(pid) { return sumWhere(all('qc'), x => x.productId === pid, 'rejectedQty'); }

  function stock(pid) {
    const warehouse = qtyIn(pid) - qtyDist(pid) - qtyOut(pid) + qtyQcPassed(pid);
    const process = qtyDist(pid) - qtyReturn(pid);
    const qcPending = sumWhere(all('returns'), x => x.productId === pid, 'goodQty') - qtyQc(pid);
    const damaged = qtyOut(pid, 'Rusak/Afkir') + qtyAfkirArtisan(pid) + qtyQcRejected(pid);
    const ready = Math.max(0, qtyQcPassed(pid) - qtyOut(pid, 'Customer') - qtyOut(pid, 'Borong Obat'));
    return {
      warehouse: warehouse, process: process, qc: qcPending, damaged: damaged,
      ready: ready, borong: qtyOut(pid, 'Borong Obat'), total: warehouse + process + qcPending
    };
  }

  function totals() {
    const keys = ['warehouse', 'process', 'qc', 'damaged', 'ready', 'borong', 'total'];
    const out = { inbound: sumWhere(all('inbound'), () => true, 'qty'), outbound: sumWhere(all('outbound'), () => true, 'qty') };
    keys.forEach(k => out[k] = 0);
    all('products').forEach(p => { const s = stock(p.id); keys.forEach(k => out[k] += s[k]); });
    return out;
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
    return (u && u.active && u.password === hash(password)) ? u : null;
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
    GUDANG: ['dashboard', 'products.view', 'inbound.*', 'outbound.*', 'distributions.view', 'returns.view', 'qc.*', 'spk.view', 'reports.*', 'search', 'notifications'],
    PURCHASING: ['dashboard', 'products.view', 'inbound.*', 'reports.*', 'search', 'notifications'],
    PRODUKSI: ['dashboard', 'products.view', 'artisans.*', 'distributions.*', 'returns.*', 'qc.view', 'spk.*', 'reports.view', 'search', 'notifications'],
    MANAGER: ['dashboard', 'products.view', 'inbound.view', 'outbound.view', 'artisans.view', 'distributions.view', 'returns.view', 'qc.view', 'spk.view', 'reports.*', 'search', 'notifications']
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
    KEY, TABLES, load, save, reset, replace, all, get, insert, update, remove,
    getConfig, saveConfig, connectSupabase, useLocal, isSupabase, isConfigured, autoConnectEnabled, pull, syncNow,
    qtyIn, qtyOut, qtyDist, qtyReturn, qtyAfkirArtisan, qtyQc, qtyQcPassed, qtyQcRejected,
    stock, totals, artisanStats, distRemaining, validate,
    authenticate, currentUser, login, logout, can, hash, hashAsync, svgPhoto
  };
})();
