/* views.js — Dashboard, Produk, Barang Masuk, Barang Keluar, Pengrajin */
window.Views = (function () {
  const pOpts = () => U.sortBySKU(DB.all('products')).map(p => ({ value: p.id, label: p.sku + ' — ' + p.name }));
  const aOpts = () => U.sortByName(DB.all('artisans')).map(a => ({ value: a.id, label: a.name }));
  const pName = id => (DB.get('products', id) || {}).name || '-';
  const aName = id => (DB.get('artisans', id) || {}).name || '-';
  const pOf = id => DB.get('products', id) || {};
  const can = p => DB.can(p);

  const state = { productSearch: '', productCat: '', productStatus: '', inSearch: '', inDate: '', outSearch: '', outType: '', outDate: '', artisanSearch: '', artisanActive: '' };
  const OUT_TYPES = ['Customer', 'Borong Obat', 'Servis', 'Pinjaman Sampel', 'Rusak/Afkir'];
  const RETURNABLE = ['Borong Obat', 'Servis', 'Pinjaman Sampel'];

  function filterRows(rows, q, fields) {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter(r => fields.some(f => String(r[f] || '').toLowerCase().includes(s)));
  }

  /* ================= DASHBOARD ================= */
  function opsInfoHtml() {
    const o = DB.opsSummary(U.today());
    const chip = (label, value, icon) => '<div style="min-width:125px"><div style="color:var(--muted);font-size:11px">' + icon + ' ' + label +
      '</div><strong style="font-size:17px">' + U.fmt(value) + '</strong></div>';
    const panel = (title, bucket, empty) => '<div><div class="section-title">' + title + '</div>' +
      (bucket.items.length ? bucket.items.slice(0, 5).map(it =>
        '<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:3px 0;border-bottom:1px dashed var(--border)">' +
        '<span>' + U.esc(it.label) + '</span><strong style="white-space:nowrap">' + U.fmt(it.qty) + '</strong></div>').join('') :
        '<div style="color:var(--muted);font-size:12px">' + empty + '</div>') +
      (bucket.items.length > 5 ? '<small style="color:var(--muted)">+' + (bucket.items.length - 5) + ' produk lainnya</small>' : '') + '</div>';
    return '<div class="card" style="margin-top:16px"><div class="card-head"><h3>📋 Informasi Produksi & Gudang</h3>' +
      '<span class="badge badge-blue">' + U.dateID(o.date) + '</span></div><div class="card-body">' +
      '<div style="display:flex;gap:20px;flex-wrap:wrap">' +
      chip('Total di luar gudang*', o.outside, '🚚') +
      chip('Di gudang', o.warehouse.qty, '🏭') +
      chip('Dikerjakan produksi', o.production.qty, '🔨') +
      chip('Dikontrol gudang (QC)', o.qcPending.qty, '🔍') +
      chip('Dipinjam sampel', o.sample.qty, '🧪') +
      chip('Pemborong obat', o.borongObat.qty, '💊') +
      chip('Servis / pengrajin', o.servis.qty, '🔧') +
      '</div><div style="margin-top:6px;color:var(--muted);font-size:11px">* Di luar gudang = proses produksi + QC + pinjaman sampel + borong obat + servis (tidak termasuk afkir/rusak).</div>' +
      '<div class="grid grid-2" style="margin-top:14px">' +
      panel('Barang sedang dikerjakan tim produksi', o.production, 'Tidak ada barang dalam proses.') +
      panel('Barang sedang di kontrol tim gudang', o.qcPending, 'Tidak ada barang menunggu QC.') +
      panel('Barang keluar dipinjam pengrajin untuk sampel', o.sample, 'Tidak ada pinjaman sampel.') +
      panel('Barang dibawa pemborong obat', o.borongObat, 'Tidak ada barang di pemborong obat.') +
      panel('Barang servis / dibawa pengrajin', o.servis, 'Tidak ada barang dalam servis.') +
      panel('Sudah kembali pengrajin / pemborong obat', o.returned, 'Belum ada barang kembali hari ini.') +
      panel('Barang masuk setelah lolos QC', o.qcDone, 'Belum ada QC lulus hari ini.') +
      '</div></div></div>';
  }

  const dashboard = {
    render() {
      const t = DB.totals();
      const prods = DB.all('products');
      const maxStock = Math.max(1, ...prods.map(p => DB.stock(p.id).warehouse));
      const top = prods.map(p => ({ p, s: DB.stock(p.id) })).sort((a, b) => b.s.warehouse - a.s.warehouse).slice(0, 6);
      const activities = []
        .concat(DB.all('inbound').map(x => ({ date: x.date, text: 'Barang masuk ' + x.productName + ' (' + x.qty + ')', icon: '📥', href: '#/inbound' })))
        .concat(DB.all('outbound').map(x => ({ date: x.date, text: x.type + ' ' + x.productName + ' (' + x.qty + ')', icon: '📤', href: '#/outbound' })))
        .concat(DB.all('distributions').map(x => ({ date: x.date, text: 'Distribusi ke ' + x.artisanName + ' — ' + x.productName + ' (' + x.qty + ')', icon: '🔨', href: '#/distributions' })))
        .concat(DB.all('returns').map(x => ({ date: x.date, text: 'Barang kembali dari ' + x.artisanName + ' (' + x.qty + ')', icon: '↩️', href: '#/returns' })))
        .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
      const late = DB.all('distributions').filter(d => {
        const rem = d.qty - U.sum(DB.all('returns').filter(r => r.distributionId === d.id), r => r.qty);
        return d.targetDate < U.today() && rem > 0;
      }).slice(0, 5);
      const low = prods.filter(p => DB.stock(p.id).warehouse <= p.minStock).slice(0, 5);

      return UI.pageHead('Dashboard', 'Ringkasan seluruh stok & aktivitas perusahaan',
          [can('reports.view') ? '<a class="btn btn-primary" href="#/reports">📊 Lihat Laporan</a>' : '']) +
        '<div class="grid grid-stats">' +
        UI.statCard({ label: 'Total Seluruh Stok', value: U.fmt(t.total), sub: 'gudang + proses + QC', icon: '📦' }) +
        UI.statCard({ label: 'Total Barang Masuk', value: U.fmt(t.inbound), sub: 'akumulasi penerimaan', icon: '📥', accent: 'in' }) +
        UI.statCard({ label: 'Total Barang Keluar', value: U.fmt(t.outbound), sub: 'semua jenis keluar', icon: '📤', accent: 'out' }) +
        UI.statCard({ label: 'Total Barang di Gudang', value: U.fmt(t.warehouse), sub: 'siap dipakai/produksi', icon: '🏭' }) +
        UI.statCard({ label: 'Total di Pengrajin', value: U.fmt(t.process), sub: 'sedang dikerjakan', icon: '🔨', accent: 'process' }) +
        UI.statCard({ label: 'Menunggu QC', value: U.fmt(t.qc), sub: 'kontrol tim gudang', icon: '🔍', accent: 'qc' }) +
        UI.statCard({ label: 'Barang Rusak / Afkir', value: U.fmt(t.damaged), sub: 'tidak layak jual', icon: '⚠️', accent: 'bad' }) +
        UI.statCard({ label: 'Di Borong Obat', value: U.fmt(t.borong), sub: 'barang keluar borongan', icon: '🚚' }) +
        '</div><br>' +
        '<div class="grid grid-2">' +
        '<div class="card"><div class="card-head"><h3>Stok Gudang per Produk</h3><a href="#/products" class="link-btn">Detail</a></div>' +
        '<div class="card-body">' + top.map(x =>
          '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">' +
          '<span>' + U.esc(x.p.name) + '</span><strong>' + U.fmt(x.s.warehouse) + '</strong></div>' +
          '<div class="progress"><div style="width:' + Math.round(x.s.warehouse / maxStock * 100) + '%"></div></div></div>'
        ).join('') + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>Aktivitas Terbaru</h3></div><div class="card-body">' +
        activities.map(a => '<div class="timeline-item"><span>' + a.icon + '</span><div><div>' + U.esc(a.text) + '</div><small>' + U.dateID(a.date) + '</small></div></div>').join('') +
        '</div></div></div><br>' +
        '<div class="grid grid-2">' +
        '<div class="card"><div class="card-head"><h3>⚠️ Pekerjaan Terlambat</h3><a href="#/distributions" class="link-btn">Lihat semua</a></div><div class="card-body">' +
        (late.length ? late.map(d => '<div class="timeline-item"><span>🕒</span><div><div><strong>' + U.esc(aName(d.artisanId)) + '</strong> — ' + U.esc(d.productName) + '</div>' +
          '<small>Target ' + U.dateID(d.targetDate) + ' · sisa ' + U.fmt(d.qty - U.sum(DB.all('returns').filter(r => r.distributionId === d.id), r => r.qty)) + ' pcs</small></div></div>').join('') :
          '<div class="empty">Tidak ada pekerjaan terlambat 🎉</div>') + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>📉 Stok Menipis</h3><a href="#/products" class="link-btn">Lihat produk</a></div><div class="card-body">' +
        (low.length ? low.map(p => '<div class="timeline-item"><span>📦</span><div><div><strong>' + U.esc(p.name) + '</strong> — ' + U.fmt(DB.stock(p.id).warehouse) + ' pcs</div>' +
          '<small>Minimum ' + U.fmt(p.minStock) + ' pcs</small></div></div>').join('') :
          '<div class="empty">Semua stok aman</div>') + '</div></div></div>' +
        (can('payroll.view') ? '<div class="card" style="margin-top:16px"><div class="card-head"><h3>💰 Gaji Karyawan Harian</h3><a href="#/payroll" class="link-btn">Buka menu gaji</a></div><div class="card-body">' +
          (function () {
            const p = DB.payrollSummary(U.today());
            return '<div style="display:flex;gap:24px;flex-wrap:wrap">' +
              '<div><div style="color:var(--muted);font-size:12px">Total gaji hari ini</div><strong style="font-size:18px">' + U.rp(p.total) + '</strong></div>' +
              '<div><div style="color:var(--muted);font-size:12px">Karyawan masuk</div><strong style="font-size:18px">' + U.fmt(p.employees) + ' orang</strong></div>' +
              '<div><div style="color:var(--muted);font-size:12px">Upah lembur</div><strong style="font-size:18px">' + U.rp(p.overtime) + '</strong></div>' +
              '</div><div style="margin-top:10px;color:var(--muted);font-size:12px">Catat gaji harian dan cetak slip gaji mingguan (bonus, bon/hutang, potongan telat) di menu Gaji Karyawan.</div>';
          })() +
          '</div></div>' : '') +
        (can('borong.view') ? '<div class="card" style="margin-top:16px"><div class="card-head"><h3>🧹 Tugas & Gaji Borong Amplas / Packing</h3><a href="#/borong" class="link-btn">Buka menu borong</a></div><div class="card-body">' +
          (function () {
            const b = DB.borongSummary(U.today());
            return '<div style="display:flex;gap:24px;flex-wrap:wrap">' +
              '<div><div style="color:var(--muted);font-size:12px">Selesai / target hari ini</div><strong style="font-size:18px">' + U.fmt(b.done) + ' / ' + U.fmt(b.target) + ' pcs</strong></div>' +
              '<div><div style="color:var(--muted);font-size:12px">Total upah borong</div><strong style="font-size:18px">' + U.rp(b.total) + '</strong></div>' +
              '<div><div style="color:var(--muted);font-size:12px">Amplas</div><strong style="font-size:18px">' + U.rp(b.amplas) + '</strong></div>' +
              '<div><div style="color:var(--muted);font-size:12px">Packing</div><strong style="font-size:18px">' + U.rp(b.packing) + '</strong></div>' +
              '<div><div style="color:var(--muted);font-size:12px">Pemborong</div><strong style="font-size:18px">' + U.fmt(b.people) + ' orang</strong></div>' +
              '</div>';
          })() +
          '</div></div>' : '') +
        opsInfoHtml();
    },
    bind() {}
  };

  /* ================= PRODUK ================= */
  function productForm(existing, close) {
    const cats = DB.getCategories();
    UI.formModal({
      title: existing ? 'Edit Produk' : 'Tambah Produk', wide: true,
      values: existing || {},
      fields: [
        { key: 'sku', label: 'Kode Produk / SKU', required: true, placeholder: 'ST005' },
        { key: 'name', label: 'Nama Produk', required: true, placeholder: 'Dining Chair' },
        { key: 'category', label: 'Kategori', type: 'datalist', options: cats, required: true, placeholder: 'Pilih atau ketik kategori baru', hint: 'Pilih yang tersedia, atau ketik nama kategori baru.' },
        { key: 'size', label: 'Ukuran', placeholder: '48 x 52 x 85 cm' },
        { key: 'status', label: 'Status Produk', type: 'select', options: ['Gudang', 'Proses Obat', 'Barang Jadi'], required: true },
        { key: 'minStock', label: 'Stok Minimum', type: 'number', min: 0, value: 5 },
        { key: 'price', label: 'Harga Barang (Rp/pcs)', type: 'number', min: 0, step: 1000, value: 0, hint: 'Harga jual per pcs; otomatis muncul di SPK dan slip kerja pengrajin.' },
        { key: 'rateAmplas', label: 'Upah Borong Amplas (Rp/pcs)', type: 'number', min: 0, step: 1000, value: 0, hint: 'Isi sendiri per produk, dipakai saat mencatat gaji borong.' },
        { key: 'ratePacking', label: 'Upah Borong Packing (Rp/pcs)', type: 'number', min: 0, step: 1000, value: 0 },
        { key: 'photo', label: 'Foto Produk', type: 'file', full: true },
        { key: 'notes', label: 'Catatan', type: 'textarea', full: true, placeholder: 'Opsional' }
      ],
      onSubmit(data, closeFn) {
        if (DB.all('products').some(p => p.sku.toLowerCase() === data.sku.toLowerCase() && p.id !== (existing || {}).id)) {
          UI.toast('SKU sudah digunakan', 'error'); return;
        }
        data.minStock = U.num(data.minStock);
        data.price = U.num(data.price);
        data.rateAmplas = U.num(data.rateAmplas);
        data.ratePacking = U.num(data.ratePacking);
        data.category = String(data.category || '').trim();
        if (data.category) DB.addCategory(data.category);
        if (existing) { DB.update('products', existing.id, data); UI.toast('Produk diperbarui', 'success'); }
        else { DB.insert('products', data); UI.toast('Produk ditambahkan', 'success'); }
        closeFn(); App.refresh();
      }
    });
  }

  // Kelola daftar kategori: tambah baru, ubah nama (produk terkait ikut diubah), hapus yang kosong.
  function categoryManager() {
    const render = () => {
      const counts = {};
      DB.all('products').forEach(p => { const c = p.category || '-'; counts[c] = (counts[c] || 0) + 1; });
      const list = DB.getCategories().map(c => {
        const builtin = DB.DEFAULT_CATEGORIES.indexOf(c) >= 0;
        const n = counts[c] || 0;
        return '<div style="display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid var(--border)">' +
          '<strong style="flex:1">' + U.esc(c) + '</strong>' +
          '<span class="badge badge-gray">' + n + ' produk</span>' +
          (builtin ? '<span class="badge">Bawaan</span>' : '<button class="btn btn-sm" data-rename="' + U.esc(c) + '">Ubah</button>') +
          (!builtin && !n ? '<button class="btn btn-sm btn-danger" data-del="' + U.esc(c) + '">Hapus</button>' : '') +
          '</div>';
      }).join('');
      UI.openModal(UI.modalHead('Kelola Kategori') +
        '<div class="modal-body">' +
        '<p style="color:var(--muted);font-size:12px;margin:0">Kategori juga bisa dibuat langsung saat menambah produk. Kategori yang masih dipakai produk tidak bisa dihapus.</p>' +
        '<div style="display:flex;gap:8px;margin:14px 0"><input id="catNew" placeholder="Nama kategori baru" style="flex:1;padding:9px;border:1px solid var(--border);border-radius:8px">' +
        '<button class="btn btn-primary" id="catAdd">+ Tambah</button></div>' +
        '<div id="catList">' + list + '</div></div>' +
        '<div class="modal-foot"><button class="btn" data-close>Tutup</button></div>');
      const m = U.$('#modalRoot');
      U.$('#catAdd', m).addEventListener('click', () => {
        const name = U.$('#catNew', m).value.trim();
        if (!name) { UI.toast('Nama kategori wajib diisi', 'warning'); return; }
        if (!DB.addCategory(name)) { UI.toast('Kategori sudah ada', 'error'); return; }
        UI.toast('Kategori ditambahkan', 'success'); render(); App.refresh();
      });
      U.$$('[data-rename]', m).forEach(b => b.addEventListener('click', () => {
        const old = b.dataset.rename;
        UI.formModal({
          title: 'Ubah Kategori',
          values: { name: old },
          fields: [{ key: 'name', label: 'Nama Kategori Baru', required: true, full: true }],
          onSubmit(data, close) {
            if (!DB.renameCategory(old, data.name)) { UI.toast('Gagal diubah. Nama mungkin sudah dipakai.', 'error'); return; }
            close(); UI.toast('Kategori diubah. Produk terkait ikut diperbarui.', 'success');
            categoryManager(); App.refresh();
          }
        });
      }));
      U.$$('[data-del]', m).forEach(b => b.addEventListener('click', () => {
        const name = b.dataset.del;
        UI.confirm('Hapus kategori "' + name + '"?', () => {
          if (!DB.deleteCategory(name)) { UI.toast('Kategori masih dipakai produk', 'error'); return; }
          UI.toast('Kategori dihapus', 'success'); render(); App.refresh();
        }, true);
      }));
    };
    render();
  }

  function productDetail(p) {
    const s = DB.stock(p.id);
    const hist = []
      .concat(DB.all('inbound').filter(x => x.productId === p.id).map(x => ({ date: x.date, t: 'Masuk', text: x.supplier, qty: x.qty })))
      .concat(DB.all('outbound').filter(x => x.productId === p.id).map(x => ({ date: x.date, t: x.type, text: x.destination, qty: -x.qty })))
      .concat(DB.all('distributions').filter(x => x.productId === p.id).map(x => ({ date: x.date, t: 'Distribusi', text: x.artisanName, qty: -x.qty })))
      .concat(DB.all('returns').filter(x => x.productId === p.id).map(x => ({ date: x.date, t: 'Kembali', text: x.artisanName, qty: x.qty })))
      .concat(DB.all('qc').filter(x => x.productId === p.id).map(x => ({ date: x.date, t: 'QC Lulus', text: x.notes || '-', qty: x.passedQty })))
      .sort((a, b) => b.date.localeCompare(a.date));
    UI.openModal(UI.modalHead('Detail Produk') +
      '<div class="modal-body"><div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">' +
      '<img class="photo-preview" style="width:100px;height:100px" src="' + U.esc(p.photo || DB.svgPhoto('📦', '#f1f5f9')) + '">' +
      '<div><h3>' + U.esc(p.name) + '</h3><div class="badge badge-blue">' + U.esc(p.sku) + '</div> ' + U.badge(p.status) +
      '<div style="color:var(--muted);margin-top:6px">' + U.esc(p.category) + ' · ' + U.esc(p.size || '-') + '</div></div></div>' +
      '<div class="section-title">Posisi Stok</div><div class="detail-grid">' +
      [['Gudang', s.warehouse], ['Dalam Proses', s.process], ['Menunggu QC', s.qc], ['Siap Kirim', s.ready], ['Rusak/Afkir', s.damaged], ['Total', s.total]]
        .map(x => '<div class="detail-item"><small>' + x[0] + '</small><strong>' + U.fmt(x[1]) + ' pcs</strong></div>').join('') +
      '</div><div class="section-title">Harga Upah per pcs</div><div class="detail-grid">' +
      [['Harga Barang', p.price], ['Amplas', p.rateAmplas], ['Packing', p.ratePacking]]
        .map(x => '<div class="detail-item"><small>' + x[0] + '</small><strong>' + U.rp(x[1]) + '</strong></div>').join('') +
      '</div><div class="section-title">Riwayat</div>' +
      UI.table({ columns: [
        { label: 'Tanggal', key: 'date', render: r => U.dateID(r.date) },
        { label: 'Jenis', render: r => U.badge(r.t) },
        { label: 'Keterangan', key: 'text' },
        { label: 'Qty', align: 'right', render: r => (r.qty > 0 ? '+' : '') + U.fmt(r.qty) }
      ], rows: hist, empty: 'Belum ada riwayat' }) + '</div>', { wide: true });
  }

  const products = {
    render() {
      let rows = U.sortBySKU(DB.all('products'));
      rows = filterRows(rows, state.productSearch, ['sku', 'name', 'category', 'size', 'status']);
      if (state.productCat) rows = rows.filter(p => p.category === state.productCat);
      if (state.productStatus) rows = rows.filter(p => p.status === state.productStatus);
      const cats = DB.getCategories();
      return UI.pageHead('Database Produk', 'Kode SKU, kategori, foto, ukuran & status produk (SKU diurutkan dari nomor terkecil)',
        (can('products.create') ? '<button class="btn btn-primary" data-act="add">+ Tambah Produk</button>' : '') +
        (can('products.create') || can('products.update') ? '<button class="btn" data-act="cats">🏷️ Kelola Kategori</button>' : '')) +
        '<div class="toolbar"><input id="pSearch" placeholder="Cari SKU / nama..." value="' + U.esc(state.productSearch) + '">' +
        '<select id="pCat"><option value="">Semua kategori</option>' + cats.map(c => '<option' + (state.productCat === c ? ' selected' : '') + '>' + U.esc(c) + '</option>').join('') + '</select>' +
        '<select id="pStatus"><option value="">Semua status</option>' + ['Gudang', 'Proses Obat', 'Barang Jadi'].map(s => '<option' + (state.productStatus === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
        '<div class="card"><div class="card-body">' +
        UI.table({
          columns: [
            { label: 'Foto', render: r => '<img class="photo-preview" style="width:40px;height:40px" src="' + U.esc(r.photo || DB.svgPhoto('📦', '#f1f5f9')) + '">' },
            { label: 'SKU', render: r => '<strong>' + U.esc(r.sku) + '</strong>' },
            { label: 'Nama Produk', render: r => U.esc(r.name) + '<br><small style="color:var(--muted)">' + U.esc(r.size || '-') + '</small>' },
            { label: 'Kategori', key: 'category' },
            { label: 'Status', render: r => U.badge(r.status) },
            { label: 'Gudang', align: 'right', render: r => U.fmt(DB.stock(r.id).warehouse) },
            { label: 'Proses', align: 'right', render: r => U.fmt(DB.stock(r.id).process) },
            { label: 'QC', align: 'right', render: r => U.fmt(DB.stock(r.id).qc) },
            { label: 'Siap', align: 'right', render: r => U.fmt(DB.stock(r.id).ready) },
            { label: 'Harga Barang', align: 'right', render: r => U.rp(r.price) },
            { label: 'Upah Amplas', align: 'right', render: r => U.rp(r.rateAmplas) },
            { label: 'Upah Packing', align: 'right', render: r => U.rp(r.ratePacking) }
          ],
          rows,
          actions: [
            { label: 'Detail', act: 'detail' },
            ...(can('products.update') ? [{ label: 'Edit', act: 'edit' }] : []),
            ...(can('products.delete') ? [{ label: 'Hapus', act: 'delete', cls: 'danger' }] : [])
          ],
          empty: 'Belum ada produk. Klik "Tambah Produk".'
        }) + '</div></div>';
    },
    bind(root) {
      U.$('#pSearch', root).addEventListener('input', e => { state.productSearch = e.target.value; App.refresh(); U.$('#pSearch').focus(); });
      U.$('#pCat', root).addEventListener('change', e => { state.productCat = e.target.value; App.refresh(); });
      U.$('#pStatus', root).addEventListener('change', e => { state.productStatus = e.target.value; App.refresh(); });
      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const p = DB.get('products', b.dataset.id);
        if (b.dataset.act === 'add') productForm(null);
        if (b.dataset.act === 'cats') categoryManager();
        if (b.dataset.act === 'detail' && p) productDetail(p);
        if (b.dataset.act === 'edit' && p) productForm(p);
        if (b.dataset.act === 'delete' && p) UI.confirm('Hapus produk ' + p.name + '? Riwayat transaksi tetap disimpan.', () => {
          DB.remove('products', p.id); UI.toast('Produk dihapus', 'success'); App.refresh();
        }, true);
      }));
    }
  };

  /* ================= BARANG MASUK ================= */
  function inboundForm(existing) {
    UI.formModal({
      title: existing ? 'Edit Barang Masuk' : 'Catat Barang Masuk', wide: true,
      values: existing || { date: U.today() },
      fields: [
        { key: 'date', label: 'Tanggal Masuk', type: 'date', required: true },
        { key: 'supplier', label: 'Supplier / Pengrajin', required: true, placeholder: 'CV Jati Utama' },
        { key: 'productId', label: 'Produk', type: 'select', options: pOpts(), required: true, placeholder: '-- Pilih produk --', full: true },
        { key: 'qty', label: 'Jumlah Masuk (pcs)', type: 'number', min: 1, required: true },
        { key: 'condition', label: 'Kondisi Barang', type: 'select', options: ['Baik', 'Rusak Ringan', 'Rusak'], required: true, value: 'Baik' },
        { key: 'receiver', label: 'Petugas Penerima', required: true, placeholder: 'Budi' },
        { key: 'notes', label: 'Keterangan', type: 'textarea', full: true }
      ],
      onSubmit(data, close) {
        if (U.num(data.qty) <= 0) { UI.toast('Jumlah harus > 0', 'error'); return; }
        const p = pOf(data.productId);
        data.sku = p.sku; data.productName = p.name; data.qty = U.num(data.qty);
        if (existing) DB.update('inbound', existing.id, data); else DB.insert('inbound', data);
        UI.toast('Barang masuk tercatat. Stok gudang bertambah ' + U.fmt(data.qty), 'success');
        close(); App.refresh();
      }
    });
  }

  const inbound = {
    render() {
      let rows = DB.all('inbound');
      rows = filterRows(rows, state.inSearch, ['sku', 'productName', 'supplier', 'receiver', 'notes', 'date']);
      if (state.inDate) rows = rows.filter(x => x.date === state.inDate);
      rows.sort((a, b) => b.date.localeCompare(a.date));
      return UI.pageHead('Barang Masuk (Inbound)', 'Pencatatan semua barang yang diterima perusahaan',
        (can('inbound.create') ? '<button class="btn btn-primary" data-act="add">+ Catat Barang Masuk</button>' : '') +
        (can('inbound.view') ? '<button class="btn" data-act="excel">⬇ Excel</button><button class="btn" data-act="pdf">⬇ PDF</button>' : '')) +
        '<div class="toolbar"><input id="inSearch" placeholder="Cari produk / supplier / petugas..." value="' + U.esc(state.inSearch) + '">' +
        '<input type="date" id="inDate" value="' + U.esc(state.inDate) + '"><div class="spacer"></div>' +
        '<strong>Total masuk: ' + U.fmt(U.sum(rows, r => r.qty)) + ' pcs</strong></div>' +
        '<div class="card"><div class="card-body">' + UI.table({
          columns: [
            { label: 'Tanggal', render: r => U.dateID(r.date) },
            { label: 'Supplier', key: 'supplier' },
            { label: 'SKU', key: 'sku' },
            { label: 'Produk', key: 'productName' },
            { label: 'Qty', align: 'right', render: r => '<strong>' + U.fmt(r.qty) + '</strong>' },
            { label: 'Kondisi', render: r => U.badge(r.condition === 'Baik' ? 'Lulus' : r.condition === 'Rusak' ? 'Afkir' : 'Menunggu') },
            { label: 'Petugas', key: 'receiver' },
            { label: 'Keterangan', key: 'notes' }
          ], rows,
          actions: can('inbound.update') ? [{ label: 'Edit', act: 'edit' }, { label: 'Hapus', act: 'delete', cls: 'danger' }] : [],
          empty: 'Belum ada transaksi barang masuk.'
        }) + '</div></div>';
    },
    bind(root) {
      U.$('#inSearch', root).addEventListener('input', e => { state.inSearch = e.target.value; App.refresh(); U.$('#inSearch').focus(); });
      U.$('#inDate', root).addEventListener('change', e => { state.inDate = e.target.value; App.refresh(); });
      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'add') { if (DB.can('inbound.create')) inboundForm(null); }
        if (act === 'edit') { const x = DB.get('inbound', b.dataset.id); if (x) inboundForm(x); }
        if (act === 'delete') { const x = DB.get('inbound', b.dataset.id); if (x) UI.confirm('Hapus transaksi masuk ' + x.sku + '? Stok akan dikurangi otomatis.', () => { DB.remove('inbound', x.id); UI.toast('Dihapus', 'success'); App.refresh(); }, true); }
        if (act === 'excel' || act === 'pdf') {
          const rows = [['Tanggal', 'Supplier', 'SKU', 'Produk', 'Qty', 'Kondisi', 'Petugas', 'Keterangan']]
            .concat(DB.all('inbound').sort((a, b) => b.date.localeCompare(a.date)).map(x => [U.dateID(x.date), x.supplier, x.sku, x.productName, x.qty, x.condition, x.receiver, x.notes]));
          if (act === 'excel') U.exportExcel('laporan-barang-masuk', rows); else U.exportPDF('Laporan Barang Masuk', rows);
        }
      }));
    }
  };

  /* ================= BARANG KELUAR ================= */
  window.openOutboundForm = function (productId) {
    const types = OUT_TYPES;
    UI.formModal({
      title: 'Catat Barang Keluar', wide: true,
      values: { date: U.today(), type: 'Customer', productId: productId || '', staff: DB.currentUser().name },
      fields: [
        { key: 'date', label: 'Tanggal Keluar', type: 'date', required: true },
        { key: 'type', label: 'Jenis Barang Keluar', type: 'select', options: types, required: true },
        { key: 'productId', label: 'Produk', type: 'select', options: pOpts(), required: true, placeholder: '-- Pilih produk --' },
        { key: 'qty', label: 'Jumlah Keluar (pcs)', type: 'number', min: 1, required: true },
        { key: 'destination', label: 'Tujuan Pengiriman', placeholder: 'Nama customer / gudang afkir' },
        { key: 'artisanReceiver', label: 'Nama Pengrajin Penerima', placeholder: 'Opsional' },
        { key: 'suratJalan', label: 'Nomor Surat Jalan', placeholder: 'SJ/2026/00104' },
        { key: 'staff', label: 'Petugas Gudang', required: true },
        { key: 'notes', label: 'Keterangan', type: 'textarea', full: true }
      ],
      onSubmit(data, close) {
        const err = DB.validate('ship', data.productId, data.qty);
        if (err) { UI.toast(err, 'error'); return; }
        const p = pOf(data.productId);
        data.sku = p.sku; data.productName = p.name; data.qty = U.num(data.qty);
        DB.insert('outbound', data);
        UI.toast('Barang keluar tercatat. Stok gudang berkurang ' + U.fmt(data.qty), 'success');
        close(); App.refresh();
      }
    });
  };

  const outbound = {
    render() {
      let rows = DB.all('outbound');
      rows = filterRows(rows, state.outSearch, ['sku', 'productName', 'destination', 'suratJalan', 'staff', 'artisanReceiver', 'date']);
      if (state.outType) rows = rows.filter(x => x.type === state.outType);
      if (state.outDate) rows = rows.filter(x => x.date === state.outDate);
      rows.sort((a, b) => b.date.localeCompare(a.date));
      return UI.pageHead('Barang Keluar (Outbound)', 'Customer, borong obat, servis, pinjaman sampel pengrajin, dan afkir — dicatat tim gudang',
        (can('outbound.create') ? '<button class="btn btn-primary" data-act="add">+ Catat Barang Keluar</button>' : '') +
        '<button class="btn" data-act="excel">⬇ Excel</button><button class="btn" data-act="pdf">⬇ PDF</button>') +
        '<div class="toolbar"><input id="outSearch" placeholder="Cari produk / tujuan / no SJ..." value="' + U.esc(state.outSearch) + '">' +
        '<select id="outType"><option value="">Semua jenis</option>' + OUT_TYPES.map(t => '<option' + (state.outType === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' +
        '<input type="date" id="outDate" value="' + U.esc(state.outDate) + '"><div class="spacer"></div>' +
        '<strong>Total keluar: ' + U.fmt(U.sum(rows, r => r.qty)) + ' pcs</strong></div>' +
        '<div class="card"><div class="card-body">' + UI.table({
          columns: [
            { label: 'Tanggal', render: r => U.dateID(r.date) },
            { label: 'Jenis', render: r => U.badge(r.type) },
            { label: 'SKU', key: 'sku' },
            { label: 'Produk', key: 'productName' },
            { label: 'Qty', align: 'right', render: r => '<strong>' + U.fmt(r.qty) + '</strong>' },
            { label: 'Tujuan', key: 'destination' },
            { label: 'No. SJ', key: 'suratJalan' },
            { label: 'Petugas', key: 'staff' },
            { label: 'Kembali', render: r => (RETURNABLE.includes(r.type) && can('returns.create')
              ? '<button class="link-btn" data-act="returnOut" data-id="' + U.esc(r.id) + '">Terima Kembali</button>' : '-') }
          ], rows,
          actions: can('outbound.update') ? [{ label: 'Edit', act: 'edit' }, { label: 'Hapus', act: 'delete', cls: 'danger' }] : [],
          empty: 'Belum ada transaksi barang keluar.'
        }) + '</div></div>';
    },
    bind(root) {
      U.$('#outSearch', root).addEventListener('input', e => { state.outSearch = e.target.value; App.refresh(); U.$('#outSearch').focus(); });
      U.$('#outType', root).addEventListener('change', e => { state.outType = e.target.value; App.refresh(); });
      U.$('#outDate', root).addEventListener('change', e => { state.outDate = e.target.value; App.refresh(); });
      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'add') { if (DB.can('outbound.create')) window.openOutboundForm(); }
        if (act === 'edit') {
          const x = DB.get('outbound', b.dataset.id);
          if (!x) return;
          UI.formModal({
            title: 'Edit Barang Keluar', wide: true, values: x,
            fields: [
              { key: 'date', label: 'Tanggal', type: 'date', required: true },
              { key: 'type', label: 'Jenis', type: 'select', options: OUT_TYPES, required: true },
              { key: 'qty', label: 'Jumlah', type: 'number', min: 1, required: true },
              { key: 'destination', label: 'Tujuan' },
              { key: 'suratJalan', label: 'No. Surat Jalan' },
              { key: 'staff', label: 'Petugas Gudang' },
              { key: 'notes', label: 'Keterangan', type: 'textarea', full: true }
            ],
            onSubmit(d, close) { DB.update('outbound', x.id, Object.assign({}, d, { qty: U.num(d.qty) })); UI.toast('Diupdate', 'success'); close(); App.refresh(); }
          });
        }
        if (act === 'delete') { const x = DB.get('outbound', b.dataset.id); if (x) UI.confirm('Hapus transaksi keluar ini? Stok akan dikembalikan.', () => { DB.remove('outbound', x.id); UI.toast('Dihapus', 'success'); App.refresh(); }, true); }
        if (act === 'returnOut') {
          const x = DB.get('outbound', b.dataset.id);
          if (x && RETURNABLE.includes(x.type) && window.openOtherReturnForm) window.openOtherReturnForm(x.type, null, x);
        }
        if (act === 'excel' || act === 'pdf') {
          const rows = [['Tanggal', 'Jenis', 'SKU', 'Produk', 'Qty', 'Tujuan', 'Penerima', 'No SJ', 'Petugas', 'Keterangan']]
            .concat(DB.all('outbound').sort((a, b) => b.date.localeCompare(a.date)).map(x => [U.dateID(x.date), x.type, x.sku, x.productName, x.qty, x.destination, x.artisanReceiver, x.suratJalan, x.staff, x.notes]));
          if (act === 'excel') U.exportExcel('laporan-barang-keluar', rows); else U.exportPDF('Laporan Barang Keluar', rows);
        }
      }));
    }
  };

  /* ================= PENGRAJIN ================= */
  window.artisanForm = function (existing) {
    UI.formModal({
      title: existing ? 'Edit Pengrajin' : 'Tambah Pengrajin', wide: true,
      values: existing ? Object.assign({}, existing, { idManual: existing.id, productTypes: (existing.productTypes || []).join(', ') }) : { active: true },
      fields: [
        { key: 'idManual', label: 'ID Pengrajin', type: existing ? 'readonly' : 'text', value: existing ? existing.id : 'PN' + String(DB.all('artisans').length + 1).padStart(3, '0'), required: true, hint: 'Boleh diisi sendiri saat tambah. ID tidak bisa diubah saat edit.' },
        { key: 'name', label: 'Nama Pengrajin', required: true },
        { key: 'address', label: 'Alamat', full: true },
        { key: 'phone', label: 'Nomor Telepon' },
        { key: 'specialization', label: 'Spesialisasi Pekerjaan' },
        { key: 'productTypes', label: 'Jenis Produk', placeholder: 'Kursi, Meja', hint: 'Pisahkan dengan koma' },
        { key: 'active', label: 'Status', type: 'checkbox', checkLabel: 'Aktif' },
        { key: 'notes', label: 'Catatan', type: 'textarea', full: true }
      ],
      onSubmit(data, close) {
        const id = existing ? existing.id : String(data.idManual || '').trim().toUpperCase();
        if (!id) { UI.toast('ID pengrajin wajib diisi', 'error'); return; }
        if (!existing && DB.get('artisans', id)) { UI.toast('ID pengrajin ' + id + ' sudah dipakai', 'error'); return; }
        const row = Object.assign({}, data, { id });
        delete row.idManual;
        row.productTypes = String(row.productTypes || '').split(',').map(s => s.trim()).filter(Boolean);
        if (existing) { DB.update('artisans', existing.id, row); UI.toast('Pengrajin diperbarui', 'success'); }
        else { DB.insert('artisans', row); UI.toast('Pengrajin ditambahkan: ' + id, 'success'); }
        close(); App.refresh();
      }
    });
  };

  const artisans = {
    render() {
      let rows = U.sortByName(DB.all('artisans'));
      rows = filterRows(rows, state.artisanSearch, ['id', 'name', 'address', 'phone', 'specialization']);
      if (state.artisanActive === 'aktif') rows = rows.filter(a => a.active);
      if (state.artisanActive === 'nonaktif') rows = rows.filter(a => !a.active);
      return UI.pageHead('Manajemen Pengrajin', 'Data pengrajin diurutkan berdasarkan nama (A–Z), spesialisasi & monitoring pekerjaan',
        (can('artisans.create') ? '<button class="btn btn-primary" data-act="add">+ Tambah Pengrajin</button>' : '')) +
        '<div class="toolbar"><input id="aSearch" placeholder="Cari nama / telepon / spesialisasi..." value="' + U.esc(state.artisanSearch) + '">' +
        '<select id="aActive"><option value="">Semua status</option><option' + (state.artisanActive === 'aktif' ? ' selected' : '') + ' value="aktif">Aktif</option><option' + (state.artisanActive === 'nonaktif' ? ' selected' : '') + ' value="nonaktif">Nonaktif</option></select></div>' +
        '<div class="grid grid-3">' + rows.map(a => {
          const s = DB.artisanStats(a.id);
          return '<div class="card"><div class="card-body">' +
            '<div style="display:flex;justify-content:space-between;align-items:start;gap:8px"><div><strong style="font-size:16px">' + U.esc(a.name) + '</strong>' +
            '<div style="color:var(--muted);font-size:12px">' + U.esc(a.id) + ' · ' + U.esc(a.specialization || '-') + '</div></div>' + U.badge(a.active ? 'Aktif' : 'Nonaktif') + '</div>' +
            '<div style="margin:14px 0;display:flex;gap:8px;flex-wrap:wrap">' +
            '<span class="badge badge-blue">Diterima ' + U.fmt(s.received) + '</span>' +
            '<span class="badge ' + (s.unfinished > 0 ? 'badge-yellow' : 'badge-green') + '">Belum selesai ' + U.fmt(s.unfinished) + '</span>' +
            '<span class="badge badge-purple">Afkir ' + U.fmt(s.afkir) + '</span>' +
            (s.lateCount ? '<span class="badge badge-red">Terlambat ' + s.lateCount + '</span>' : '') + '</div>' +
            '<div style="font-size:12px;color:var(--muted)">📞 ' + U.esc(a.phone || '-') + '<br>📍 ' + U.esc(a.address || '-') + '</div>' +
            '<div style="margin-top:14px;display:flex;gap:6px"><a class="btn btn-sm btn-primary" href="#/artisans/' + a.id + '">Lihat Detail</a>' +
            (can('artisans.update') ? '<button class="btn btn-sm" data-act="edit" data-id="' + a.id + '">Edit</button>' : '') +
            (can('artisans.delete') ? '<button class="btn btn-sm btn-danger" data-act="del" data-id="' + a.id + '">Hapus</button>' : '') + '</div>' +
            '</div></div>';
        }).join('') + '</div>' + (rows.length ? '' : '<div class="empty">Belum ada pengrajin.</div>');
    },
    bind(root) {
      U.$('#aSearch', root).addEventListener('input', e => { state.artisanSearch = e.target.value; App.refresh(); U.$('#aSearch').focus(); });
      U.$('#aActive', root).addEventListener('change', e => { state.artisanActive = e.target.value; App.refresh(); });
      U.$$('[data-act="edit"]', root).forEach(b => b.addEventListener('click', () => window.artisanForm(DB.get('artisans', b.dataset.id))));
      U.$$('[data-act="del"]', root).forEach(b => b.addEventListener('click', () => {
        const a = DB.get('artisans', b.dataset.id);
        if (!a) return;
        const linked = DB.all('distributions').filter(d => d.artisanId === a.id).length +
          DB.all('returns').filter(r => r.artisanId === a.id).length;
        UI.confirm('Hapus pengrajin "' + a.name + '"?' +
          (linked ? ' Riwayat ' + linked + ' transaksi tetap tersimpan, tetapi pengrajin ini akan hilang dari daftar.' : ''), () => {
          DB.remove('artisans', a.id); UI.toast('Pengrajin dihapus', 'success'); App.refresh();
        }, true);
      }));
      const add = U.$('[data-act="add"]', root); if (add) add.addEventListener('click', () => window.artisanForm(null));
    }
  };

  const artisanDetail = {
    render(params) {
      const a = DB.get('artisans', params.id);
      if (!a) return UI.pageHead('Pengrajin tidak ditemukan', '') + '<div class="card card-body"><a href="#/artisans">Kembali</a></div>';
      const s = DB.artisanStats(a.id);
      const dists = DB.all('distributions').filter(d => d.artisanId === a.id).sort((x, y) => y.date.localeCompare(x.date));
      const rets = DB.all('returns').filter(r => r.artisanId === a.id).sort((x, y) => y.date.localeCompare(x.date));
      const t = U.today();
      return UI.pageHead(a.name, a.id + ' · ' + (a.specialization || '-') + ' · ' + (a.address || '-'),
        '<a class="btn" href="#/artisans">← Kembali</a>' +
        (can('artisans.update') ? '<button class="btn" data-act="edit">Edit Pengrajin</button>' : '') +
        (can('artisans.delete') ? '<button class="btn btn-danger" data-act="del">Hapus Pengrajin</button>' : '') +
        (can('distributions.create') ? '<button class="btn btn-primary" data-act="distribute">+ Distribusi Barang</button>' : '') +
        (can('returns.create') ? '<button class="btn btn-success" data-act="return">↩ Terima Barang Kembali</button>' : '')) +
        '<div class="grid grid-stats">' +
        UI.statCard({ label: 'Barang Diterima', value: U.fmt(s.received), icon: '📥', accent: 'in' }) +
        UI.statCard({ label: 'Sudah Selesai', value: U.fmt(s.finished), icon: '✅' }) +
        UI.statCard({ label: 'Belum Selesai', value: U.fmt(s.unfinished), icon: '🔨', accent: 'process' }) +
        UI.statCard({ label: 'Dikembalikan Afkir', value: U.fmt(s.afkir), icon: '⚠️', accent: 'bad' }) +
        UI.statCard({ label: 'Pekerjaan Terlambat', value: s.lateCount + ' item', sub: U.fmt(s.lateQty) + ' pcs', icon: '🕒', accent: 'out' }) +
        '</div><br>' +
        (s.nearDeadline.length ? '<div class="notice">⏰ ' + s.nearDeadline.length + ' pekerjaan mendekati deadline 3 hari.</div><br>' : '') +
        '<div class="card"><div class="card-head"><h3>Barang Sedang Dikerjakan</h3></div><div class="card-body">' +
        UI.table({ columns: [
          { label: 'Tanggal', render: r => U.dateID(r.date) },
          { label: 'Produk', render: r => U.esc(r.productName) + '<br><small>' + U.esc(r.sku) + '</small>' },
          { label: 'Diberikan', align: 'right', render: r => U.fmt(r.qty) },
          { label: 'Sudah Kembali', align: 'right', render: r => U.fmt(U.sum(DB.all('returns').filter(x => x.distributionId === r.id), x => x.qty)) },
          { label: 'Sisa', align: 'right', render: r => U.fmt(DB.distRemaining(r.id)) },
          { label: 'Target', render: r => U.dateID(r.targetDate) },
          { label: 'Status', render: r => U.badge(DB.distRemaining(r.id) <= 0 ? 'Selesai' : (r.targetDate < t ? 'Terlambat' : 'Proses')) }
        ], rows: dists, empty: 'Belum ada barang yang didistribusikan.' }) + '</div></div><br>' +
        '<div class="card"><div class="card-head"><h3>Riwayat Barang Kembali</h3></div><div class="card-body">' +
        UI.table({ columns: [
          { label: 'Tanggal', render: r => U.dateID(r.date) },
          { label: 'Produk', key: 'productName' },
          { label: 'Qty Kembali', align: 'right', render: r => U.fmt(r.qty) },
          { label: 'Afkir', align: 'right', render: r => U.fmt(r.afkirQty) },
          { label: 'Catatan', key: 'notes' }
        ], rows: rets, empty: 'Belum ada barang kembali.' }) + '</div></div>' +
        '<div class="section-title">Catatan Pengrajin</div><div class="card card-body">' + U.esc(a.notes || '-') +
        '<br><small style="color:var(--muted)">Spesialisasi: ' + U.esc((a.productTypes || []).join(', ')) + ' · Telepon: ' + U.esc(a.phone || '-') + '</small></div>';
    },
    bind(root, params) {
      const a = DB.get('artisans', params.id);
      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        if (b.dataset.act === 'edit') window.artisanForm(a);
        if (b.dataset.act === 'del') {
          const linked = DB.all('distributions').filter(d => d.artisanId === a.id).length +
            DB.all('returns').filter(r => r.artisanId === a.id).length;
          UI.confirm('Hapus pengrajin "' + a.name + '"?' +
            (linked ? ' Riwayat ' + linked + ' transaksi tetap tersimpan, tetapi pengrajin ini akan hilang dari daftar.' : ''), () => {
            DB.remove('artisans', a.id); UI.toast('Pengrajin dihapus', 'success');
            location.hash = '#/artisans'; App.refresh();
          }, true);
        }
        if (b.dataset.act === 'distribute') window.openDistributionForm(null, a.id);
        if (b.dataset.act === 'return') window.openReturnForm(null, a.id);
      }));
    }
  };

  return { dashboard, products, inbound, outbound, artisans, artisanDetail, state };
})();
