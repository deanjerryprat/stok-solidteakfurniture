/* views2.js — Distribusi, Barang Kembali/QC, SPK, Laporan, Pencarian, Notifikasi, User */
Object.assign(window.Views, (function () {
  const pOpts = () => DB.all('products').map(p => ({ value: p.id, label: p.sku + ' — ' + p.name }));
  const aOpts = () => DB.all('artisans').map(a => ({ value: a.id, label: a.name }));
  const pOf = id => DB.get('products', id) || {};
  const aName = id => (DB.get('artisans', id) || {}).name || '-';
  const can = p => DB.can(p);
  const t = () => U.today();
  function filterRows(rows, q, fields) {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter(r => fields.some(f => String(r[f] || '').toLowerCase().includes(s)));
  }

  const state = {
    distSearch: '', distArtisan: '', distStatus: '', returnsTab: 'kembali', spkSearch: '',
    reportTab: 'masuk', from: U.shiftDays(-30), to: U.today(), reportProduct: '', reportCategory: '', reportArtisan: '', reportStatus: ''
  };

  /* ================= DISTRIBUSI ================= */
  window.openDistributionForm = function (existing, artisanId, spkId) {
    const dists = DB.all('distributions');
    const spkOpts = DB.all('spk').map(s => ({ value: s.id, label: s.no + ' — ' + pOf(s.productId).name + ' (' + s.qty + ')' }));
    const values = existing || {
      date: t(), artisanId: artisanId || '', productId: '', qty: '',
      targetDate: U.shiftDays(7), spkId: spkId || '', proof: '', notes: ''
    };
    UI.formModal({
      title: existing ? 'Edit Distribusi' : 'Distribusikan Barang ke Pengrajin', wide: true, values,
      notice: 'Stok gudang akan berkurang otomatis dan stok "dalam proses pengrajin" bertambah.',
      fields: [
        { key: 'date', label: 'Tanggal Distribusi', type: 'date', required: true },
        { key: 'artisanId', label: 'Nama Pengrajin', type: 'select', options: aOpts(), required: true, placeholder: '-- Pilih pengrajin --' },
        { key: 'productId', label: 'Produk yang Dikerjakan', type: 'select', options: pOpts(), required: true, placeholder: '-- Pilih produk --' },
        { key: 'qty', label: 'Jumlah Diberikan (pcs)', type: 'number', min: 1, required: true },
        { key: 'targetDate', label: 'Target Penyelesaian', type: 'date', required: true },
        { key: 'spkId', label: 'SPK Terkait', type: 'select', options: spkOpts, placeholder: '-- Tanpa SPK --' },
        { key: 'proof', label: 'Bukti Penerimaan Barang', placeholder: 'Tanda tangan / nomor dokumen' },
        { key: 'notes', label: 'Keterangan', type: 'textarea', full: true }
      ],
      onOpen() {
        const applySpk = id => {
          const s = DB.get('spk', id); if (!s) return;
          const set = (k, v) => { const el = U.$('#f_' + k); if (el) el.value = v; };
          set('productId', s.productId); set('qty', s.qty); set('targetDate', s.targetDate); set('artisanId', s.artisanId);
        };
        if (values.spkId) applySpk(values.spkId);
        const sel = U.$('#f_spkId'); if (sel) sel.addEventListener('change', e => applySpk(e.target.value));
      },
      onSubmit(data, close) {
        const p = pOf(data.productId), a = DB.get('artisans', data.artisanId);
        if (!p.id || !a) { UI.toast('Produk / pengrajin belum dipilih', 'error'); return; }
        let available = DB.stock(data.productId).warehouse + (existing ? existing.qty : 0);
        if (U.num(data.qty) <= 0) { UI.toast('Jumlah harus > 0', 'error'); return; }
        if (U.num(data.qty) > available) { UI.toast('Stok gudang tidak cukup. Tersedia: ' + U.fmt(available), 'error'); return; }
        const row = Object.assign({}, data, {
          qty: U.num(data.qty), sku: p.sku, productName: p.name, artisanName: a.name
        });
        if (existing) DB.update('distributions', existing.id, row); else DB.insert('distributions', row);
        if (data.spkId) DB.update('spk', data.spkId, { status: 'Proses' });
        UI.toast('Distribusi tercatat. Stok gudang → pengrajin: ' + U.fmt(row.qty) + ' pcs', 'success');
        close(); App.refresh();
      }
    });
  };

  const distributions = {
    render() {
      let rows = DB.all('distributions');
      rows = filterRows(rows, state.distSearch, ['sku', 'productName', 'artisanName', 'proof', 'date']);
      if (state.distArtisan) rows = rows.filter(d => d.artisanId === state.distArtisan);
      if (state.distStatus === 'proses') rows = rows.filter(d => DB.distRemaining(d.id) > 0);
      if (state.distStatus === 'selesai') rows = rows.filter(d => DB.distRemaining(d.id) <= 0);
      if (state.distStatus === 'terlambat') rows = rows.filter(d => d.targetDate < t() && DB.distRemaining(d.id) > 0);
      rows.sort((a, b) => b.date.localeCompare(a.date));
      return UI.pageHead('Distribusi Barang ke Pengrajin', 'Pembagian pekerjaan; stok gudang otomatis berkurang',
        (can('distributions.create') ? '<button class="btn btn-primary" data-act="add">+ Distribusi Barang</button>' : '')) +
        '<div class="toolbar"><input id="dSearch" placeholder="Cari produk / pengrajin..." value="' + U.esc(state.distSearch) + '">' +
        '<select id="dArtisan"><option value="">Semua pengrajin</option>' + aOpts().map(a => '<option value="' + a.value + '"' + (state.distArtisan === a.value ? ' selected' : '') + '>' + U.esc(a.label) + '</option>').join('') + '</select>' +
        '<select id="dStatus"><option value="">Semua status</option>' + [['proses', 'Proses'], ['selesai', 'Selesai'], ['terlambat', 'Terlambat']].map(x => '<option value="' + x[0] + '"' + (state.distStatus === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></div>' +
        '<div class="card"><div class="card-body">' + UI.table({
          columns: [
            { label: 'Tanggal', render: r => U.dateID(r.date) },
            { label: 'Pengrajin', render: r => '<a href="#/artisans/' + r.artisanId + '">' + U.esc(r.artisanName) + '</a>' },
            { label: 'Produk', render: r => U.esc(r.productName) + '<br><small>' + U.esc(r.sku) + '</small>' },
            { label: 'Diberikan', align: 'right', render: r => U.fmt(r.qty) },
            { label: 'Sudah Kembali', align: 'right', render: r => U.fmt(r.qty - DB.distRemaining(r.id)) },
            { label: 'Sisa', align: 'right', render: r => '<strong>' + U.fmt(DB.distRemaining(r.id)) + '</strong>' },
            { label: 'Target', render: r => U.dateID(r.targetDate) },
            { label: 'Bukti', key: 'proof' },
            { label: 'Status', render: r => U.badge(DB.distRemaining(r.id) <= 0 ? 'Selesai' : (r.targetDate < t() ? 'Terlambat' : 'Proses')) }
          ], rows,
          actions: [
            ...(can('returns.create') ? [{ label: 'Terima', act: 'return' }] : []),
            ...(can('distributions.update') ? [{ label: 'Edit', act: 'edit' }] : []),
            ...(can('distributions.delete') ? [{ label: 'Hapus', act: 'delete', cls: 'danger' }] : [])
          ],
          empty: 'Belum ada distribusi ke pengrajin.'
        }) + '</div></div>';
    },
    bind(root) {
      U.$('#dSearch', root).addEventListener('input', e => { state.distSearch = e.target.value; App.refresh(); U.$('#dSearch').focus(); });
      U.$('#dArtisan', root).addEventListener('change', e => { state.distArtisan = e.target.value; App.refresh(); });
      U.$('#dStatus', root).addEventListener('change', e => { state.distStatus = e.target.value; App.refresh(); });
      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const x = DB.get('distributions', b.dataset.id);
        if (b.dataset.act === 'add') window.openDistributionForm();
        if (!x) return;
        if (b.dataset.act === 'return') window.openReturnForm(null, x.artisanId, x.id);
        if (b.dataset.act === 'edit') window.openDistributionForm(x);
        if (b.dataset.act === 'delete') UI.confirm('Hapus distribusi ini? Barang akan kembali ke stok gudang.', () => {
          DB.remove('distributions', x.id); UI.toast('Dihapus', 'success'); App.refresh();
        }, true);
      }));
    }
  };

  /* ================= BARANG KEMBALI & QC ================= */
  window.openReturnForm = function (existing, artisanId, distributionId) {
    const availOpts = () => DB.all('distributions').filter(d => {
      const rem = DB.distRemaining(d.id);
      return rem > 0 || (existing && d.id === existing.distributionId);
    }).map(d => ({
      value: d.id,
      label: d.artisanName + ' — ' + d.productName + ' (sisa ' + DB.distRemaining(d.id) + ')'
    }));
    UI.formModal({
      title: existing ? 'Edit Penerimaan Barang' : 'Terima Barang Kembali dari Pengrajin', wide: true,
      values: existing || { date: t(), distributionId: distributionId || '', qty: '', afkirQty: 0, notes: '' },
      notice: 'Jumlah tidak boleh melebihi barang yang masih tercatat pada pengrajin. Barang masuk ke QC.',
      fields: [
        { key: 'date', label: 'Tanggal Barang Kembali', type: 'date', required: true },
        { key: 'distributionId', label: 'Distribusi / Pengrajin', type: 'select', options: availOpts(), required: true, placeholder: '-- Pilih --', full: true },
        { key: 'qty', label: 'Jumlah Dikembalikan (pcs)', type: 'number', min: 1, required: true },
        { key: 'afkirQty', label: 'Di antaranya Afkir/Rusak (pcs)', type: 'number', min: 0, value: 0 },
        { key: 'notes', label: 'Catatan Penerimaan', type: 'textarea', full: true }
      ],
      onSubmit(data, close) {
        const dist = DB.get('distributions', data.distributionId);
        if (!dist) { UI.toast('Distribusi tidak ditemukan', 'error'); return; }
        const max = DB.distRemaining(dist.id) + (existing && existing.distributionId === dist.id ? existing.qty : 0);
        const err = DB.validate('return', dist.productId, data.qty, { distributionId: dist.id, afkirQty: data.afkirQty });
        if (err && U.num(data.qty) > max) { UI.toast('Jumlah melebihi sisa barang pengrajin (' + U.fmt(max) + ')', 'error'); return; }
        if (U.num(data.afkirQty) > U.num(data.qty)) { UI.toast('Afkir tidak boleh melebihi jumlah kembali', 'error'); return; }
        const row = Object.assign({}, data, {
          qty: U.num(data.qty), afkirQty: U.num(data.afkirQty), goodQty: U.num(data.qty) - U.num(data.afkirQty),
          artisanId: dist.artisanId, artisanName: dist.artisanName, productId: dist.productId, sku: dist.sku, productName: dist.productName
        });
        if (existing) DB.update('returns', existing.id, row); else DB.insert('returns', row);
        if (DB.distRemaining(dist.id) <= 0) {
          const spk = DB.get('spk', dist.spkId);
          if (spk) DB.update('spk', spk.id, { status: 'Selesai' });
        }
        UI.toast('Barang diterima. Stok pengrajin berkurang, QC bertambah ' + U.fmt(row.goodQty), 'success');
        close(); App.refresh();
      }
    });
  };

  function qcForm(existing) {
    const pending = DB.all('products').filter(p => DB.stock(p.id).qc > 0 || (existing && existing.productId === p.id));
    UI.formModal({
      title: existing ? 'Edit QC' : 'Proses Quality Control', wide: true,
      values: existing || { date: t(), productId: pending[0] ? pending[0].id : '', qty: '', passedQty: '', rejectedQty: 0 },
      fields: [
        { key: 'date', label: 'Tanggal QC', type: 'date', required: true },
        { key: 'productId', label: 'Produk (sedang menunggu QC)', type: 'select', options: pending.map(p => ({ value: p.id, label: p.sku + ' — ' + p.name + ' (pending ' + DB.stock(p.id).qc + ')' })), required: true, full: true },
        { key: 'qty', label: 'Jumlah Diperiksa', type: 'number', min: 1, required: true },
        { key: 'passedQty', label: 'Jumlah Lulus', type: 'number', min: 0, required: true },
        { key: 'rejectedQty', label: 'Jumlah Afkir', type: 'number', min: 0, value: 0 },
        { key: 'notes', label: 'Catatan QC', type: 'textarea', full: true }
      ],
      onSubmit(data, close) {
        const avail = DB.stock(data.productId).qc + (existing ? existing.qty : 0);
        if (U.num(data.qty) > avail) { UI.toast('Melebihi stok QC. Tersedia: ' + U.fmt(avail), 'error'); return; }
        if (U.num(data.passedQty) + U.num(data.rejectedQty) !== U.num(data.qty)) {
          UI.toast('Lulus + afkir harus sama dengan jumlah diperiksa', 'error'); return;
        }
        const p = pOf(data.productId);
        const row = Object.assign({}, data, {
          qty: U.num(data.qty), passedQty: U.num(data.passedQty), rejectedQty: U.num(data.rejectedQty),
          status: 'Lulus', sku: p.sku, productName: p.name
        });
        if (existing) DB.update('qc', existing.id, row); else DB.insert('qc', row);
        UI.toast('QC selesai. ' + U.fmt(row.passedQty) + ' pcs menjadi barang jadi di gudang', 'success');
        close(); App.refresh();
      }
    });
  }

  const returns = {
    render() {
      const tab = state.returnsTab;
      let body = '';
      if (tab === 'kembali') {
        const rows = DB.all('returns').sort((a, b) => b.date.localeCompare(a.date));
        body = UI.pageHead('Barang Kembali dari Pengrajin', 'Penerimaan barang hasil kerja; stok pengrajin otomatis berkurang',
          (can('returns.create') ? '<button class="btn btn-primary" data-act="addReturn">+ Terima Barang Kembali</button>' : '')) +
          '<div class="card"><div class="card-body">' + UI.table({
            columns: [
              { label: 'Tanggal', render: r => U.dateID(r.date) },
              { label: 'Pengrajin', render: r => '<a href="#/artisans/' + r.artisanId + '">' + U.esc(r.artisanName) + '</a>' },
              { label: 'Produk', render: r => U.esc(r.productName) + '<br><small>' + U.esc(r.sku) + '</small>' },
              { label: 'Qty Kembali', align: 'right', render: r => U.fmt(r.qty) },
              { label: 'Afkir', align: 'right', render: r => U.fmt(r.afkirQty) },
              { label: 'Masuk QC', align: 'right', render: r => '<strong>' + U.fmt(r.goodQty) + '</strong>' },
              { label: 'Catatan', key: 'notes' }
            ], rows,
            actions: can('returns.update') ? [{ label: 'Edit', act: 'editReturn' }, { label: 'Hapus', act: 'delReturn', cls: 'danger' }] : [],
            empty: 'Belum ada barang yang kembali dari pengrajin.'
          }) + '</div></div>';
      } else if (tab === 'qc') {
        const rows = DB.all('qc').sort((a, b) => b.date.localeCompare(a.date));
        body = UI.pageHead('Quality Control (QC)', 'Barang kembali diperiksa; yang lulus menjadi barang jadi',
          (can('qc.create') ? '<button class="btn btn-primary" data-act="addQc">+ Proses QC</button>' : '')) +
          '<div class="card"><div class="card-body">' + UI.table({
            columns: [
              { label: 'Tanggal', render: r => U.dateID(r.date) },
              { label: 'Produk', key: 'productName' },
              { label: 'Diperiksa', align: 'right', render: r => U.fmt(r.qty) },
              { label: 'Lulus', align: 'right', render: r => U.fmt(r.passedQty) },
              { label: 'Afkir', align: 'right', render: r => U.fmt(r.rejectedQty) },
              { label: 'Status', render: r => U.badge('Lulus') },
              { label: 'Catatan', key: 'notes' }
            ], rows,
            actions: can('qc.update') ? [{ label: 'Edit', act: 'editQc' }, { label: 'Hapus', act: 'delQc', cls: 'danger' }] : [],
            empty: 'Belum ada proses QC.'
          }) + '</div></div>';
      } else {
        const rows = DB.all('products').filter(p => DB.stock(p.id).ready > 0);
        body = UI.pageHead('Barang Jadi / Siap Dikirim', 'Hasil QC lulus yang tersedia untuk dikirim', '') +
          '<div class="card"><div class="card-body">' + UI.table({
            columns: [
              { label: 'SKU', render: r => '<strong>' + U.esc(r.sku) + '</strong>' },
              { label: 'Produk', key: 'name' },
              { label: 'Kategori', key: 'category' },
              { label: 'Siap Kirim', align: 'right', render: r => '<strong>' + U.fmt(DB.stock(r.id).ready) + '</strong> pcs' },
              { label: 'Total Gudang', align: 'right', render: r => U.fmt(DB.stock(r.id).warehouse) }
            ], rows,
            actions: (can('outbound.create') ? [{ label: 'Kirim', act: 'ship' }] : []),
            empty: 'Belum ada barang jadi hasil QC.'
          }) + '</div></div>';
      }
      return '<div class="tabs">' +
        [['kembali', 'Barang Kembali'], ['qc', 'Quality Control'], ['barang-jadi', 'Barang Jadi']].map(x =>
          '<button class="tab ' + (tab === x[0] ? 'active' : '') + '" data-tab="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' + body;
    },
    bind(root) {
      U.$$('[data-tab]', root).forEach(b => b.addEventListener('click', () => { state.returnsTab = b.dataset.tab; App.refresh(); }));
      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        const x = ({ editReturn: 'returns', delReturn: 'returns', editQc: 'qc', delQc: 'qc' })[act]
          ? DB.get(({ editReturn: 'returns', delReturn: 'returns', editQc: 'qc', delQc: 'qc' })[act], b.dataset.id) : null;
        if (act === 'addReturn') window.openReturnForm();
        if (act === 'addQc') qcForm(null);
        if (act === 'editReturn' && x) window.openReturnForm(x);
        if (act === 'delReturn' && x) UI.confirm('Hapus penerimaan ini? Barang akan kembali ke pengrajin.', () => { DB.remove('returns', x.id); UI.toast('Dihapus', 'success'); App.refresh(); }, true);
        if (act === 'editQc' && x) qcForm(x);
        if (act === 'delQc' && x) UI.confirm('Hapus data QC ini? Barang kembali menunggu QC.', () => { DB.remove('qc', x.id); UI.toast('Dihapus', 'success'); App.refresh(); }, true);
        if (act === 'ship') window.openOutboundForm(b.dataset.id);
      }));
    }
  };

  /* ================= SPK ================= */
  const spk = {
    render() {
      let rows = DB.all('spk');
      rows = filterRows(rows, state.spkSearch, ['no', 'status', 'notes'])
        .filter(s => !state.reportStatus || s.status === state.reportStatus);
      rows.sort((a, b) => b.date.localeCompare(a.date));
      return UI.pageHead('SPK — Surat Perintah Kerja', 'Perintah kerja produksi untuk pengrajin',
        (can('spk.create') ? '<button class="btn btn-primary" data-act="add">+ Buat SPK</button>' : '')) +
        '<div class="toolbar"><input id="sSearch" placeholder="Cari nomor SPK / catatan..." value="' + U.esc(state.spkSearch) + '">' +
        '<select id="sStatus"><option value="">Semua status</option>' + ['Proses', 'Selesai', 'Terlambat'].map(s => '<option' + (state.reportStatus === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
        '<div class="card"><div class="card-body">' + UI.table({
          columns: [
            { label: 'No. SPK', render: r => '<strong>' + U.esc(r.no) + '</strong>' },
            { label: 'Tanggal', render: r => U.dateID(r.date) },
            { label: 'Pengrajin', render: r => aName(r.artisanId) },
            { label: 'Produk', render: r => pOf(r.productId).name || '-' },
            { label: 'Qty', align: 'right', render: r => U.fmt(r.qty) },
            { label: 'Target', render: r => U.dateID(r.targetDate) },
            { label: 'Status', render: r => U.badge(r.targetDate < t() && r.status !== 'Selesai' ? 'Terlambat' : r.status) },
            { label: 'Catatan', key: 'notes' }
          ], rows,
          actions: [
            ...(can('distributions.create') ? [{ label: 'Distribusi', act: 'dist' }] : []),
            ...(can('spk.update') ? [{ label: 'Edit', act: 'edit' }] : []),
            ...(can('spk.delete') ? [{ label: 'Hapus', act: 'delete', cls: 'danger' }] : [])
          ], empty: 'Belum ada SPK.'
        }) + '</div></div>';
    },
    bind(root) {
      U.$('#sSearch', root).addEventListener('input', e => { state.spkSearch = e.target.value; App.refresh(); U.$('#sSearch').focus(); });
      U.$('#sStatus', root).addEventListener('change', e => { state.reportStatus = e.target.value; App.refresh(); });
      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const x = DB.get('spk', b.dataset.id);
        if (b.dataset.act === 'add') {
          UI.formModal({
            title: 'Buat SPK Baru', wide: true, values: { date: t(), targetDate: U.shiftDays(7), qty: '', status: 'Proses' },
            fields: [
              { key: 'date', label: 'Tanggal SPK', type: 'date', required: true },
              { key: 'artisanId', label: 'Pengrajin', type: 'select', options: aOpts(), required: true, placeholder: '-- Pilih --' },
              { key: 'productId', label: 'Produk', type: 'select', options: pOpts(), required: true, placeholder: '-- Pilih --' },
              { key: 'qty', label: 'Jumlah', type: 'number', min: 1, required: true },
              { key: 'targetDate', label: 'Target Selesai', type: 'date', required: true },
              { key: 'status', label: 'Status', type: 'select', options: ['Proses', 'Selesai', 'Terlambat'], required: true },
              { key: 'notes', label: 'Catatan', type: 'textarea', full: true }
            ],
            onSubmit(d, close) {
              const no = 'SPK/' + String(new Date().getFullYear()).slice(-2) + '/' + String(DB.all('spk').length + 1).padStart(4, '0');
              DB.insert('spk', Object.assign({}, d, { no, qty: U.num(d.qty) }));
              UI.toast('SPK ' + no + ' dibuat', 'success'); close(); App.refresh();
            }
          });
        }
        if (!x) return;
        if (b.dataset.act === 'dist') window.openDistributionForm(null, x.artisanId, x.id);
        if (b.dataset.act === 'edit') UI.formModal({
          title: 'Edit SPK', wide: true, values: x,
          fields: [
            { key: 'date', label: 'Tanggal', type: 'date', required: true },
            { key: 'artisanId', label: 'Pengrajin', type: 'select', options: aOpts(), required: true },
            { key: 'productId', label: 'Produk', type: 'select', options: pOpts(), required: true },
            { key: 'qty', label: 'Jumlah', type: 'number', min: 1, required: true },
            { key: 'targetDate', label: 'Target', type: 'date', required: true },
            { key: 'status', label: 'Status', type: 'select', options: ['Proses', 'Selesai', 'Terlambat'], required: true },
            { key: 'notes', label: 'Catatan', type: 'textarea', full: true }
          ],
          onSubmit(d, close) { DB.update('spk', x.id, Object.assign({}, d, { qty: U.num(d.qty) })); UI.toast('Diupdate', 'success'); close(); App.refresh(); }
        });
        if (b.dataset.act === 'delete') UI.confirm('Hapus SPK ' + x.no + '?', () => { DB.remove('spk', x.id); UI.toast('Dihapus', 'success'); App.refresh(); }, true);
      }));
    }
  };

  /* ================= LAPORAN ================= */
  function dateOk(d) { return (!state.from || d >= state.from) && (!state.to || d <= state.to); }
  function reportRows() {
    if (state.reportTab === 'masuk') {
      return DB.all('inbound').filter(x => dateOk(x.date)).filter(x => {
        const p = DB.get('products', x.productId) || {};
        return (!state.reportProduct || x.productId === state.reportProduct) &&
          (!state.reportCategory || p.category === state.reportCategory);
      }).sort((a, b) => b.date.localeCompare(a.date)).map(x => [U.dateID(x.date), x.supplier, x.sku, x.productName, x.qty, x.condition, x.receiver, x.notes]);
    }
    if (state.reportTab === 'keluar') {
      return DB.all('outbound').filter(x => dateOk(x.date)).filter(x => {
        const p = DB.get('products', x.productId) || {};
        return (!state.reportProduct || x.productId === state.reportProduct) &&
          (!state.reportCategory || p.category === state.reportCategory) &&
          (!state.reportStatus || x.type === state.reportStatus) &&
          (!state.reportArtisan || (x.artisanReceiver || '').toLowerCase().includes(aName(state.reportArtisan).toLowerCase()));
      }).sort((a, b) => b.date.localeCompare(a.date)).map(x => [U.dateID(x.date), x.type, x.sku, x.productName, x.qty, x.destination, x.artisanReceiver, x.suratJalan, x.staff, x.notes]);
    }
    if (state.reportTab === 'stok') {
      return DB.all('products').filter(p => !state.reportProduct || p.id === state.reportProduct)
        .filter(p => !state.reportCategory || p.category === state.reportCategory)
        .filter(p => !state.reportStatus || p.status === state.reportStatus)
        .map(p => { const s = DB.stock(p.id); return [p.sku, p.name, p.category, p.status, s.warehouse, s.process, s.qc, s.ready, s.damaged, s.total]; });
    }
    return DB.all('artisans').filter(a => !state.reportArtisan || a.id === state.reportArtisan).map(a => {
      const s = DB.artisanStats(a.id);
      return [a.id, a.name, a.specialization, s.received, s.finished, s.unfinished, s.afkir, s.lateCount];
    });
  }
  function reportHeader() {
    if (state.reportTab === 'masuk') return ['Tanggal', 'Supplier', 'SKU', 'Produk', 'Qty', 'Kondisi', 'Petugas', 'Keterangan'];
    if (state.reportTab === 'keluar') return ['Tanggal', 'Jenis', 'SKU', 'Produk', 'Qty', 'Tujuan', 'Penerima', 'No SJ', 'Petugas', 'Keterangan'];
    if (state.reportTab === 'stok') return ['SKU', 'Produk', 'Kategori', 'Status', 'Gudang', 'Proses', 'QC', 'Siap', 'Rusak', 'Total'];
    return ['ID', 'Pengrajin', 'Spesialisasi', 'Diterima', 'Selesai', 'Belum Selesai', 'Afkir', 'Terlambat'];
  }

  const reports = {
    render() {
      const rows = reportRows();
      const title = { masuk: 'Laporan Barang Masuk', keluar: 'Laporan Barang Keluar', stok: 'Laporan Stok Keseluruhan', pengrajin: 'Laporan Per Pengrajin' }[state.reportTab];
      return UI.pageHead('Laporan', 'Filter tanggal, produk, kategori, pengrajin & status',
        '<button class="btn" data-act="excel">⬇ Export Excel</button><button class="btn" data-act="pdf">⬇ Export PDF</button>') +
        '<div class="tabs">' + [['masuk', 'Barang Masuk'], ['keluar', 'Barang Keluar'], ['stok', 'Stok Keseluruhan'], ['pengrajin', 'Per Pengrajin']].map(x =>
          '<button class="tab ' + (state.reportTab === x[0] ? 'active' : '') + '" data-tab="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
        '<div class="toolbar"><label>Dari <input type="date" id="rFrom" value="' + U.esc(state.from) + '"></label>' +
        '<label>Sampai <input type="date" id="rTo" value="' + U.esc(state.to) + '"></label>' +
        '<select id="rProduct"><option value="">Semua produk</option>' + pOpts().map(o => '<option value="' + o.value + '"' + (state.reportProduct === o.value ? ' selected' : '') + '>' + U.esc(o.label) + '</option>').join('') + '</select>' +
        '<select id="rCat"><option value="">Semua kategori</option>' + U.unique(DB.all('products').map(p => p.category)).map(c => '<option' + (state.reportCategory === c ? ' selected' : '') + '>' + U.esc(c) + '</option>').join('') + '</select>' +
        '<select id="rArtisan"><option value="">Semua pengrajin</option>' + aOpts().map(o => '<option value="' + o.value + '"' + (state.reportArtisan === o.value ? ' selected' : '') + '>' + U.esc(o.label) + '</option>').join('') + '</select>' +
        '<select id="rStatus"><option value="">Semua status</option>' +
          (state.reportTab === 'keluar' ? ['Customer', 'Borong Obat', 'Rusak/Afkir'] : ['Gudang', 'Proses Obat', 'Barang Jadi']).map(s => '<option' + (state.reportStatus === s ? ' selected' : '') + '>' + s + '</option>').join('') +
        '</select></div>' +
        '<div class="card"><div class="card-head"><h3>' + title + ' (' + rows.length + ' baris)</h3></div><div class="card-body">' +
        UI.table({ columns: reportHeader().map(h => ({ label: h })), rows: rows.map(r => r.reduce((o, v, i) => (o['c' + i] = v, o), { id: '' })), empty: 'Tidak ada data sesuai filter.' }) +
        '</div></div>';
    },
    bind(root) {
      U.$$('[data-tab]', root).forEach(b => b.addEventListener('click', () => { state.reportTab = b.dataset.tab; state.reportStatus = ''; App.refresh(); }));
      const map = { rFrom: 'from', rTo: 'to', rProduct: 'reportProduct', rCat: 'reportCategory', rArtisan: 'reportArtisan', rStatus: 'reportStatus' };
      Object.keys(map).forEach(id => { const el = U.$('#' + id, root); if (el) el.addEventListener('change', e => { state[map[id]] = e.target.value; App.refresh(); }); });
      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const rows = [reportHeader()].concat(reportRows());
        const name = 'laporan-' + state.reportTab;
        if (b.dataset.act === 'excel') U.exportExcel(name, rows, state.reportTab);
        else U.exportPDF(name, rows);
      }));
    }
  };

  /* ================= PENCARIAN ================= */
  const search = {
    render(params) {
      const q = (params.q || '').trim();
      const s = q.toLowerCase();
      const match = obj => Object.values(obj).some(v => typeof v !== 'object' && String(v || '').toLowerCase().includes(s));
      const groups = [
        ['Produk', DB.all('products').filter(match), '#/products', p => p.name + ' · ' + p.sku],
        ['Pengrajin', DB.all('artisans').filter(match), '#/artisans', a => a.name + ' · ' + a.id],
        ['Barang Masuk', DB.all('inbound').filter(match), '#/inbound', x => x.productName + ' · ' + x.qty + ' pcs'],
        ['Barang Keluar', DB.all('outbound').filter(match), '#/outbound', x => x.productName + ' · ' + x.qty + ' pcs'],
        ['Distribusi', DB.all('distributions').filter(match), '#/distributions', x => x.artisanName + ' · ' + x.productName],
        ['Barang Kembali', DB.all('returns').filter(match), '#/returns', x => x.artisanName + ' · ' + x.qty + ' pcs'],
        ['SPK', DB.all('spk').filter(match), '#/spk', x => x.no + ' · ' + x.status]
      ];
      return UI.pageHead('Pencarian', 'Hasil untuk: "' + U.esc(q || '-') + '"', '') +
        '<div class="toolbar"><input id="qSearch" style="flex:1" placeholder="Cari SKU, nama produk, pengrajin, atau tanggal..." value="' + U.esc(q) + '"></div>' +
        groups.map(g => '<div class="card" style="margin-bottom:12px"><div class="card-head"><h3>' + g[0] + ' (' + g[1].length + ')</h3></div><div class="card-body">' +
          (g[1].length ? g[1].slice(0, 8).map(x => '<div class="timeline-item"><span>🔎</span><div><a href="' + g[2] + (g[0] === 'Pengrajin' ? '/' + x.id : '') + '">' + U.esc(g[3](x)) + '</a><br><small>' + U.dateID(x.date || x.createdAt) + '</small></div></div>').join('') :
            '<div style="color:var(--muted)">Tidak ada hasil</div>') + '</div></div>').join('');
    },
    bind(root) {
      U.$('#qSearch', root).addEventListener('keydown', e => {
        if (e.key === 'Enter') location.hash = '#/search?q=' + encodeURIComponent(e.target.value);
      });
    }
  };

  /* ================= NOTIFIKASI ================= */
  const notifKey = 'furniture_notif_read';
  function readList() { try { return JSON.parse(localStorage.getItem(notifKey) || '[]'); } catch (e) { return []; } }
  function alerts() {
    const out = [];
    DB.all('distributions').forEach(d => {
      const rem = DB.distRemaining(d.id);
      if (d.targetDate < t() && rem > 0) out.push({ key: 'late_' + d.id, icon: '🕒', title: 'Pekerjaan terlambat', text: aName(d.artisanId) + ' — ' + d.productName + ' sisa ' + U.fmt(rem) + ' pcs (target ' + U.dateID(d.targetDate) + ')', href: '#/artisans/' + d.artisanId, date: d.targetDate });
      else if (d.targetDate >= t() && d.targetDate <= U.shiftDays(3) && rem > 0) out.push({ key: 'soon_' + d.id, icon: '⏰', title: 'Mendekati deadline', text: aName(d.artisanId) + ' — ' + d.productName + ' target ' + U.dateID(d.targetDate), href: '#/distributions', date: d.targetDate });
    });
    DB.all('returns').forEach(r => {
      const pending = r.goodQty - U.sum(DB.all('qc').filter(q => q.productId === r.productId), q => q.qty);
      if (pending > 0) out.push({ key: 'qc_' + r.id, icon: '🔍', title: 'Barang perlu QC', text: r.artisanName + ' mengirim ' + U.fmt(r.goodQty) + ' pcs ' + r.productName, href: '#/returns', date: r.date });
      else out.push({ key: 'sent_' + r.id, icon: '✅', title: 'Pengrajin kirim barang', text: r.artisanName + ' — ' + r.productName + ' (' + U.fmt(r.qty) + ' pcs) diterima', href: '#/returns', date: r.date });
    });
    DB.all('spk').filter(s => s.status === 'Selesai').forEach(s => out.push({ key: 'done_' + s.id, icon: '🎉', title: 'Pekerjaan selesai', text: s.no + ' — ' + pOf(s.productId).name, href: '#/spk', date: s.targetDate }));
    DB.all('products').filter(p => DB.stock(p.id).warehouse <= p.minStock).forEach(p => out.push({ key: 'low_' + p.id, icon: '📉', title: 'Stok menipis', text: p.name + ' tersisa ' + U.fmt(DB.stock(p.id).warehouse) + ' pcs', href: '#/products', date: t() }));
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }
  const notifications = {
    render() {
      const list = alerts(), read = readList();
      const unread = list.filter(a => !read.includes(a.key)).length;
      return UI.pageHead('Notifikasi Otomatis', unread + ' belum dibaca dari ' + list.length + ' notifikasi',
        '<button class="btn" data-act="readAll">✓ Tandai semua dibaca</button>') +
        '<div class="card"><div class="card-body">' + (list.length ? list.map(a =>
          '<div class="timeline-item" style="opacity:' + (read.includes(a.key) ? '.55' : '1') + '"><span>' + a.icon + '</span><div style="flex:1">' +
          '<strong>' + U.esc(a.title) + '</strong> ' + (read.includes(a.key) ? '' : '<span class="badge badge-blue">Baru</span>') +
          '<div>' + U.esc(a.text) + '</div><small>' + U.dateID(a.date) + ' · <a href="' + a.href + '">Lihat detail</a></small></div>' +
          '<button class="link-btn" data-act="read" data-key="' + U.esc(a.key) + '">Tandai dibaca</button></div>').join('') :
          '<div class="empty">Belum ada notifikasi</div>') + '</div></div>';
    },
    bind(root) {
      const read = readList();
      U.$$('[data-act="read"]', root).forEach(b => b.addEventListener('click', () => {
        if (!read.includes(b.dataset.key)) read.push(b.dataset.key);
        localStorage.setItem(notifKey, JSON.stringify(read)); App.refresh(); App.updateBadge();
      }));
      U.$('[data-act="readAll"]', root).addEventListener('click', () => {
        localStorage.setItem(notifKey, JSON.stringify(alerts().map(a => a.key))); App.refresh(); App.updateBadge(); UI.toast('Semua notifikasi ditandai dibaca', 'success');
      });
    }
  };

  /* ================= USER & HAK AKSES ================= */
  const users = {
    render() {
      const rows = DB.all('users');
      return UI.pageHead('Pengguna & Hak Akses', 'Username, password, dan peran (role) pengguna',
        '<button class="btn btn-primary" data-act="add">+ Tambah Pengguna</button>') +
        '<div class="card"><div class="card-body">' + UI.table({
          columns: [
            { label: 'Username', render: r => '<strong>' + U.esc(r.username) + '</strong>' },
            { label: 'Nama', key: 'name' },
            { label: 'Role', render: r => U.badge(r.role) },
            { label: 'Status', render: r => U.badge(r.active ? 'Aktif' : 'Nonaktif') }
          ], rows, actions: [{ label: 'Edit', act: 'edit' }, { label: 'Hapus', act: 'delete', cls: 'danger' }],
          empty: 'Belum ada pengguna.'
        }) + '</div></div>' +
        '<div class="card card-body" style="margin-top:14px"><strong>Hak akses:</strong><br>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
        ['ADMIN', 'GUDANG', 'PURCHASING', 'PRODUKSI', 'MANAGER'].map(r => '<span class="badge badge-blue">' + r + '</span>').join('') +
        '</div><small style="color:var(--muted);display:block;margin-top:8px">ADMIN: penuh · GUDANG: masuk/keluar/stok · PURCHASING: supplier & masuk · PRODUKSI: distribusi & pengrajin · MANAGER: lihat dashboard & laporan.</small></div>';
    },
    bind(root) {
      const roles = ['ADMIN', 'GUDANG', 'PURCHASING', 'PRODUKSI', 'MANAGER'];
      const form = existing => UI.formModal({
        title: existing ? 'Edit Pengguna' : 'Tambah Pengguna', values: existing || { active: true, role: 'GUDANG' },
        fields: [
          { key: 'username', label: 'Username', required: true },
          { key: 'name', label: 'Nama Lengkap', required: true },
          { key: 'password', label: existing ? 'Password baru (kosongkan jika tidak diubah)' : 'Password', type: 'password', required: !existing },
          { key: 'role', label: 'Role', type: 'select', options: roles, required: true },
          { key: 'active', label: 'Status', type: 'checkbox', checkLabel: 'Aktif' }
        ],
        onSubmit: async (d, close) => {
          try {
            if (DB.all('users').some(u => u.username === d.username.toLowerCase() && u.id !== (existing || {}).id)) { UI.toast('Username sudah ada', 'error'); return; }
            const data = { username: d.username.toLowerCase(), name: d.name, role: d.role, active: d.active };
            if (d.password) data.password = await DB.hashAsync(d.password);
            if (existing) DB.update('users', existing.id, data); else DB.insert('users', data);
            UI.toast('Pengguna disimpan', 'success'); close(); App.refresh();
          } catch (err) { UI.toast('Gagal menyimpan pengguna: ' + err.message, 'error'); }
        }
      });
      U.$('[data-act="add"]', root).addEventListener('click', () => form(null));
      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const u = DB.get('users', b.dataset.id); if (!u) return;
        if (b.dataset.act === 'edit') form(u);
        if (b.dataset.act === 'delete') {
          if (u.id === (DB.currentUser() || {}).id) { UI.toast('Tidak bisa menghapus akun sendiri', 'error'); return; }
          UI.confirm('Hapus pengguna ' + u.username + '?', () => { DB.remove('users', u.id); UI.toast('Dihapus', 'success'); App.refresh(); }, true);
        }
      }));
    }
  };

  /* ================= PENGATURAN SUPABASE ================= */
  const settings = {
    render() {
      const cfg = DB.getConfig() || {};
      const online = DB.isSupabase();
      return UI.pageHead('Pengaturan Database', 'Hubungkan aplikasi ke Supabase (database bersama gratis)',
        online ? '<span class="badge badge-green">● MODE SUPABASE</span>' : '<span class="badge badge-yellow">● MODE LOKAL</span>') +
        '<div class="card"><div class="card-head"><h3>Koneksi Supabase</h3></div><div class="card-body">' +
        '<div class="notice">Status saat ini: <strong>' + (online ? 'Terhubung ke Supabase — data bersama lintas perangkat & user' : 'Data tersimpan di browser perangkat ini saja') + '</strong></div><br>' +
        '<div class="form-grid">' +
        '<div class="field full"><label>Project URL</label><input id="sbUrl" placeholder="https://xxxxxxxx.supabase.co" value="' + U.esc(cfg.url || '') + '"></div>' +
        '<div class="field full"><label>Publishable / anon / public key</label><input id="sbKey" placeholder="sb_publishable_... atau eyJhbGciOi..." value="' + U.esc(cfg.key || '') + '"><div class="hint">Ambil dari tombol Connect atau Settings → API Keys. Jangan pakai secret key (sb_secret_...).</div></div>' +
        '</div><div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" id="sbConnect">Aktifkan Supabase</button>' +
        '<button class="btn" id="sbSync"' + (online ? '' : ' disabled') + '>🔄 Tarik data terbaru</button>' +
        '<button class="btn btn-warning" id="sbLocal"' + (online ? '' : ' disabled') + '>Kembali ke mode lokal</button>' +
        '</div></div></div><br>' +
        '<div class="card"><div class="card-head"><h3>Langkah persiapan (sekali saja)</h3></div><div class="card-body">' +
        '<ol style="line-height:1.9;margin:0;padding-left:20px">' +
        '<li>Buat project gratis di <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a>.</li>' +
        '<li>Buka <strong>SQL Editor</strong> → <strong>New query</strong> → salin seluruh isi file <code>supabase/schema.sql</code> → <strong>Run</strong>.</li>' +
        '<li>Buka <strong>Project Settings → API</strong>. Salin <strong>Project URL</strong> dan <strong>anon/public key</strong>.</li>' +
        '<li>Tempel keduanya di atas, lalu klik <strong>Aktifkan Supabase</strong>. Data contoh akan otomatis terunggah.</li>' +
        '<li>Deploy ulang folder aplikasi ke hosting gratis. Semua perangkat yang membuka link akan memakai database yang sama.</li>' +
        '</ol></div></div><br>' +
        '<div class="notice error"><strong>Catatan keamanan:</strong> schema di atas memakai policy akses penuh untuk kemudahan internal/demo. Untuk pemakaian publik, sebaiknya aktifkan Supabase Auth dan ganti RLS policy dengan pemeriksaan <code>auth.uid()</code>. Akun demo (admin/admin123, dll.) dibuat oleh schema.sql dan diverifikasi lewat fungsi <code>authenticate()</code> di server.</div>';
    },
    bind(root) {
      const urlEl = U.$('#sbUrl', root), keyEl = U.$('#sbKey', root);
      const connect = U.$('#sbConnect', root), sync = U.$('#sbSync', root), local = U.$('#sbLocal', root);
      connect.addEventListener('click', async () => {
        connect.disabled = true; connect.textContent = 'Menghubungkan...';
        try {
          await DB.connectSupabase({ url: urlEl.value.trim(), key: keyEl.value.trim() });
          UI.toast('Supabase tersambung. Data tersinkron.', 'success');
          App.refresh();
        } catch (err) { UI.toast(err.message, 'error'); }
        finally { connect.disabled = false; connect.textContent = 'Aktifkan Supabase'; }
      });
      sync.addEventListener('click', async () => {
        sync.disabled = true;
        try { await DB.syncNow(); UI.toast('Data terbaru berhasil ditarik', 'success'); App.refresh(); }
        catch (err) { UI.toast(err.message, 'error'); }
        finally { sync.disabled = false; }
      });
      local.addEventListener('click', () => {
        UI.confirm('Kembali ke mode lokal? Data di Supabase tetap tersimpan, tetapi aplikasi akan memakai data di browser ini.', () => {
          DB.useLocal(); App.refresh();
        });
      });
    }
  };

  notifications.alerts = alerts;
  return { distributions, returns, spk, reports, search, notifications, users, settings };
})());
