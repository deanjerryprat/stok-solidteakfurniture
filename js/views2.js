/* views2.js — Distribusi, Barang Kembali/QC, SPK, Laporan, Pencarian, Notifikasi, User */
Object.assign(window.Views, (function () {
  const pOpts = () => U.sortBySKU(DB.all('products')).map(p => ({ value: p.id, label: p.sku + ' — ' + p.name }));
  const aOpts = () => U.sortByName(DB.all('artisans')).map(a => ({ value: a.id, label: a.name }));
  const pOf = id => DB.get('products', id) || {};
  const aName = id => (DB.get('artisans', id) || {}).name || '-';
  const adminOpts = () => DB.all('users').filter(u => u.active).map(u => ({ value: u.id, label: (u.name || u.username) + ' — ' + u.role }))
    .sort((a, b) => U.natCompare(a.label, b.label));
  const adminName = id => { const u = DB.get('users', id) || {}; return u.name || u.username || '-'; };
  const can = p => DB.can(p);
  const t = () => U.today();
  function filterRows(rows, q, fields) {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter(r => fields.some(f => String(r[f] || '').toLowerCase().includes(s)));
  }

  // Cetak dokumen (SPK / slip gaji) lewat tab baru; fallback iframe bila popup diblokir.
  function printDocument(html, message) {
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); return; }
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    frame.srcdoc = html;
    frame.onload = () => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) {}
      setTimeout(() => frame.remove(), 1500);
    };
    document.body.appendChild(frame);
    UI.toast(message || 'Dokumen disiapkan untuk dicetak', 'success');
  }

  const state = {
    distSearch: '', distArtisan: '', distAdmin: '', distStatus: '', returnsTab: 'kembali', spkSearch: '',
    reportTab: 'masuk', from: U.shiftDays(-30), to: U.today(), reportProduct: '', reportCategory: '', reportArtisan: '', reportStatus: '',
    payrollQ: '', payrollFrom: U.shiftDays(-30), payrollTo: U.today(), payrollEmployee: '', payrollPosition: '',
    slipEmployee: '', slipWeek: '', slipBonus: 0, slipDebt: 0, slipLate: 0,
    borongQ: '', borongFrom: U.shiftDays(-30), borongTo: U.today(), borongEmployee: '', borongAdmin: '', borongType: '', monitorDate: U.today(),
    slipBorongEmployee: '', slipBorongWeek: '', slipBorongExtra: 0,
    boxQ: ''
  };
  const m3 = n => Number(U.num(n)).toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  /* ================= DISTRIBUSI ================= */
  window.openDistributionForm = function (existing, artisanId, spkId) {
    const dists = DB.all('distributions');
    const spkOpts = DB.all('spk').map(s => ({ value: s.id, label: s.no + ' — ' + pOf(s.productId).name + ' (' + s.qty + ')' }));
    const values = existing || {
      date: t(), handledById: (DB.currentUser() || {}).id || '', artisanId: artisanId || '', productId: '', qty: '',
      targetDate: U.shiftDays(7), spkId: spkId || '', proof: '', notes: ''
    };
    UI.formModal({
      title: existing ? 'Edit Distribusi' : 'Distribusikan Barang ke Pengrajin', wide: true, values,
      notice: 'Pilih Admin yang Menangani (mis. admin gudang yang memegang karyawan), lalu pengrajin penerima. Stok gudang berkurang otomatis dan stok "dalam proses" bertambah.',
      fields: [
        { key: 'date', label: 'Tanggal Distribusi', type: 'date', required: true },
        { key: 'handledById', label: 'Admin yang Menangani', type: 'select', options: adminOpts(), required: true, placeholder: '-- Pilih admin --' },
        { key: 'artisanId', label: 'Karyawan / Pengrajin Penerima', type: 'select', options: aOpts(), required: true, placeholder: '-- Pilih pengrajin --' },
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
          qty: U.num(data.qty), sku: p.sku, productName: p.name, artisanName: a.name,
          handledByName: adminName(data.handledById)
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
      rows = filterRows(rows, state.distSearch, ['sku', 'productName', 'artisanName', 'handledByName', 'proof', 'date']);
      if (state.distArtisan) rows = rows.filter(d => d.artisanId === state.distArtisan);
      if (state.distAdmin) rows = rows.filter(d => d.handledById === state.distAdmin);
      if (state.distStatus === 'proses') rows = rows.filter(d => DB.distRemaining(d.id) > 0);
      if (state.distStatus === 'selesai') rows = rows.filter(d => DB.distRemaining(d.id) <= 0);
      if (state.distStatus === 'terlambat') rows = rows.filter(d => d.targetDate < t() && DB.distRemaining(d.id) > 0);
      rows.sort((a, b) => b.date.localeCompare(a.date));
      return UI.pageHead('Distribusi & Tugas Borong', 'Pembagian pekerjaan pengrajin dan pemborong; stok gudang otomatis berkurang',
        (can('distributions.create') ? '<button class="btn btn-primary" data-act="add">+ Distribusi Barang</button>' : '') +
        (can('borong.assign') || can('borong.create') ? '<button class="btn" data-act="assignBorong">🧹 Tugas Borong Harian</button>' : '')) +
        '<div class="toolbar"><input id="dSearch" placeholder="Cari produk / admin / pengrajin..." value="' + U.esc(state.distSearch) + '">' +
        '<select id="dAdmin"><option value="">Semua admin</option>' + adminOpts().map(a => '<option value="' + a.value + '"' + (state.distAdmin === a.value ? ' selected' : '') + '>' + U.esc(a.label) + '</option>').join('') + '</select>' +
        '<select id="dArtisan"><option value="">Semua pengrajin</option>' + aOpts().map(a => '<option value="' + a.value + '"' + (state.distArtisan === a.value ? ' selected' : '') + '>' + U.esc(a.label) + '</option>').join('') + '</select>' +
        '<select id="dStatus"><option value="">Semua status</option>' + [['proses', 'Proses'], ['selesai', 'Selesai'], ['terlambat', 'Terlambat']].map(x => '<option value="' + x[0] + '"' + (state.distStatus === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></div>' +
        '<div class="card"><div class="card-body">' + UI.table({
          columns: [
            { label: 'Tanggal', render: r => U.dateID(r.date) },
            { label: 'Admin yang Menangani', render: r => U.esc(r.handledByName || adminName(r.handledById)) },
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
      U.$('#dAdmin', root).addEventListener('change', e => { state.distAdmin = e.target.value; App.refresh(); });
      U.$('#dArtisan', root).addEventListener('change', e => { state.distArtisan = e.target.value; App.refresh(); });
      U.$('#dStatus', root).addEventListener('change', e => { state.distStatus = e.target.value; App.refresh(); });
      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const x = DB.get('distributions', b.dataset.id);
        if (b.dataset.act === 'add') window.openDistributionForm();
        if (b.dataset.act === 'assignBorong') borongForm(null, 'assign');
        if (!x) return;
        if (b.dataset.act === 'return') window.openReturnForm(null, x.artisanId, x.id);
        if (b.dataset.act === 'edit') window.openDistributionForm(x);
        if (b.dataset.act === 'delete') UI.confirm('Hapus distribusi ini? Barang akan kembali ke stok gudang.', () => {
          DB.remove('distributions', x.id); UI.toast('Dihapus', 'success'); App.refresh();
        }, true);
      }));
    }
  };

  /* ================= STOK BOX & KUBIKASI ================= */
  window.openBoxForm = function (existing) {
    const values = existing || {
      productId: '', productSku: '', productName: '',
      code: '', name: '', sizeDetail: '', lengthCm: '', widthCm: '', heightCm: '',
      volumeM3: '', qty: '', minQty: 0, location: '', notes: ''
    };
    UI.formModal({
      title: existing ? 'Edit Box' : 'Tambah Box', wide: true, values,
      notice: 'Pilih barang dari Database Produk yang akan dimuat ke dalam box. Ukuran detail diisi sendiri. Isi Panjang/Lebar/Tinggi (cm) untuk kubikasi otomatis, atau isi Kubikasi per box manual.',
      fields: [
        { key: 'productId', label: 'Barang yang Dimuat (Database Produk)', type: 'select', options: pOpts(), required: true, placeholder: '-- Pilih produk --', full: true },
        { key: 'code', label: 'Kode Box', required: true, placeholder: 'mis. BX-001' },
        { key: 'name', label: 'Nama / Jenis Box', required: true, placeholder: 'mis. Box Kursi 120' },
        { key: 'sizeDetail', label: 'Ukuran Detail (teks bebas)', full: true, placeholder: 'mis. 120 x 60 x 45 cm, double wall' },
        { key: 'lengthCm', label: 'Panjang (cm)', type: 'number', min: 0, step: '0.01', placeholder: '120' },
        { key: 'widthCm', label: 'Lebar (cm)', type: 'number', min: 0, step: '0.01', placeholder: '60' },
        { key: 'heightCm', label: 'Tinggi (cm)', type: 'number', min: 0, step: '0.01', placeholder: '45' },
        { key: 'volumeM3', label: 'Kubikasi per Box (m³)', type: 'number', min: 0, step: '0.000001', placeholder: '0.324', hint: 'Kosongkan untuk dihitung otomatis dari P × L × T ÷ 1.000.000' },
        { key: 'qty', label: 'Stok Box (pcs)', type: 'number', min: 0, required: true },
        { key: 'minQty', label: 'Stok Minimum (pcs)', type: 'number', min: 0 },
        { key: 'location', label: 'Lokasi', placeholder: 'mis. Gudang A' },
        { key: 'notes', label: 'Catatan', type: 'textarea', full: true }
      ],
      onOpen() {
        const recalc = () => {
          const vol = U.$('#f_volumeM3');
          if (!vol) return;
          const prevAuto = U.num(vol.dataset.auto || 0);
          const current = U.num(vol.value);
          // Jangan timpa kubikasi yang diisi manual oleh user.
          if (vol.value && Math.abs(current - prevAuto) > 1e-9) return;
          const p = U.num(U.$('#f_lengthCm') && U.$('#f_lengthCm').value);
          const l = U.num(U.$('#f_widthCm') && U.$('#f_widthCm').value);
          const h = U.num(U.$('#f_heightCm') && U.$('#f_heightCm').value);
          const v = (p > 0 && l > 0 && h > 0) ? Math.round((p * l * h / 1000000) * 1000000) / 1000000 : 0;
          vol.value = v ? String(v) : '';
          vol.dataset.auto = String(v);
        };
        ['lengthCm', 'widthCm', 'heightCm'].forEach(k => {
          const el = U.$('#f_' + k);
          if (el) el.addEventListener('input', recalc);
        });
      },
      onSubmit(data, close) {
        const prod = DB.get('products', data.productId);
        if (!prod) { UI.toast('Pilih barang dari Database Produk terlebih dahulu', 'error'); return; }
        const code = String(data.code || '').trim().toUpperCase();
        const name = String(data.name || '').trim();
        if (!code || !name) { UI.toast('Kode dan nama box wajib diisi', 'error'); return; }
        const dup = DB.all('boxes').some(b => String(b.code || '').toUpperCase() === code && (!existing || b.id !== existing.id));
        if (dup) { UI.toast('Kode box ' + code + ' sudah dipakai', 'error'); return; }
        const row = {
          productId: prod.id, productSku: prod.sku, productName: prod.name,
          code, name,
          sizeDetail: String(data.sizeDetail || '').trim(),
          lengthCm: U.num(data.lengthCm), widthCm: U.num(data.widthCm), heightCm: U.num(data.heightCm),
          volumeM3: U.num(data.volumeM3),
          qty: U.num(data.qty), minQty: U.num(data.minQty),
          location: String(data.location || '').trim(),
          notes: String(data.notes || '').trim()
        };
        if (existing) DB.update('boxes', existing.id, row); else DB.insert('boxes', row);
        UI.toast(existing ? 'Box diperbarui' : 'Box ditambahkan: ' + code, 'success');
        close(); App.refresh();
      }
    });
  };

  const boxes = {
    render() {
      let rows = DB.all('boxes');
      rows = filterRows(rows, state.boxQ, ['code', 'name', 'productSku', 'productName', 'sizeDetail', 'location', 'notes']);
      rows.sort((a, b) => U.natCompare(String(a.code || ''), String(b.code || '')));
      const s = DB.boxSummary();
      return UI.pageHead('Stok Box & Kubikasi', 'Barang dipilih dari Database Produk. Ukuran detail diisi sendiri oleh gudang.',
        can('boxes.create') ? '<button class="btn btn-primary" data-act="add">+ Tambah Box</button>' : '') +
        '<div class="grid grid-stats">' +
        UI.statCard({ label: 'Jenis Box', value: U.fmt(s.types), sub: 'terdaftar', icon: '📐' }) +
        UI.statCard({ label: 'Total Stok Box', value: U.fmt(s.qty), sub: 'pcs', icon: '📦' }) +
        UI.statCard({ label: 'Total Kubikasi', value: m3(s.m3), sub: 'm³', icon: '🧊' }) +
        UI.statCard({ label: 'Box Menipis', value: U.fmt(s.low), sub: 'di bawah minimum', icon: '⚠️', accent: s.low ? 'bad' : '' }) +
        '</div><br>' +
        '<div class="toolbar"><input id="boxSearch" placeholder="Cari produk / kode / nama / ukuran / lokasi..." value="' + U.esc(state.boxQ) + '"></div>' +
        '<div class="card"><div class="card-body">' + UI.table({
          columns: [
            { label: 'Barang', render: r => U.esc((r.productSku || pOf(r.productId).sku || '-') + ' — ' + (r.productName || pOf(r.productId).name || '-')) },
            { label: 'Kode', render: r => '<strong>' + U.esc(r.code) + '</strong>' },
            { label: 'Nama / Jenis', key: 'name' },
            { label: 'Ukuran Detail', render: r => U.esc(DB.boxSizeText(r)) },
            { label: 'Volume/Box', align: 'right', render: r => m3(DB.boxVolume(r)) + ' m³' },
            { label: 'Stok', align: 'right', render: r => U.fmt(r.qty) + ' pcs' },
            { label: 'Total Kubikasi', align: 'right', render: r => '<strong>' + m3(DB.boxTotalM3(r)) + ' m³</strong>' },
            { label: 'Minimum', align: 'right', render: r => U.fmt(r.minQty) },
            { label: 'Status', render: r => {
              const low = U.num(r.qty) <= U.num(r.minQty);
              return '<span class="badge badge-' + (low ? 'red' : 'green') + '">' + (low ? 'Menipis' : 'Aman') + '</span>';
            } },
            { label: 'Lokasi', render: r => U.esc(r.location || '-') }
          ], rows,
          actions: [
            ...(can('boxes.update') ? [{ label: 'Edit', act: 'edit' }] : []),
            ...(can('boxes.delete') ? [{ label: 'Hapus', act: 'delete', cls: 'danger' }] : [])
          ],
          empty: 'Belum ada box. Klik "+ Tambah Box" untuk mengisi ukuran dan stok.'
        }) + '</div></div>';
    },
    bind(root) {
      const search = U.$('#boxSearch', root);
      if (search) search.addEventListener('input', e => {
        state.boxQ = e.target.value; App.refresh();
        const next = U.$('#boxSearch'); if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
      });
      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        if (b.dataset.act === 'add' && can('boxes.create')) { window.openBoxForm(); return; }
        const x = DB.get('boxes', b.dataset.id);
        if (!x) return;
        if (b.dataset.act === 'edit' && can('boxes.update')) window.openBoxForm(x);
        if (b.dataset.act === 'delete' && can('boxes.delete')) UI.confirm('Hapus box ' + x.code + ' — ' + x.name + '?', () => {
          DB.remove('boxes', x.id); UI.toast('Dihapus', 'success'); App.refresh();
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
        if (existing && existing.inboundId) {
          DB.update('inbound', existing.inboundId, { qty: row.passedQty, sku: row.sku, productName: row.productName });
        }
        if (existing) DB.update('qc', existing.id, row); else DB.insert('qc', row);
        UI.toast('QC selesai. ' + U.fmt(row.passedQty) + ' pcs menjadi barang jadi; buat barang masuk di tab QC.', 'success');
        close(); App.refresh();
      }
    });
  }

  const OTHER_SOURCES = ['Borong Obat', 'Servis', 'Pinjaman Sampel'];
  window.openOtherReturnForm = function (source, existing, outboundRow) {
    const p = outboundRow ? pOf(outboundRow.productId) : {};
    UI.formModal({
      title: existing ? 'Edit Barang Kembali' : 'Terima Barang Kembali ke Gudang', wide: true,
      values: existing || {
        date: t(), source: OTHER_SOURCES.includes(source) ? source : OTHER_SOURCES[0],
        productId: p.id || '', qty: outboundRow ? outboundRow.qty : '',
        partyName: outboundRow ? (outboundRow.artisanReceiver || outboundRow.destination || '') : '', notes: ''
      },
      notice: 'Barang kembali akan menunggu QC tim gudang. Setelah QC lolos, dibuatkan barang masuk.',
      fields: [
        { key: 'date', label: 'Tanggal Kembali', type: 'date', required: true },
        { key: 'source', label: 'Dari', type: 'select', options: OTHER_SOURCES, required: true },
        { key: 'productId', label: 'Produk', type: 'select', options: pOpts(), required: true, full: true },
        { key: 'qty', label: 'Jumlah Kembali (pcs)', type: 'number', min: 1, required: true },
        { key: 'partyName', label: 'Nama Pengrajin / Pemborong', placeholder: 'mis. Pak Radiman' },
        { key: 'notes', label: 'Catatan', type: 'textarea', full: true }
      ],
      onSubmit(d, close) {
        const prod = pOf(d.productId);
        if (!prod.id) { UI.toast('Produk belum dipilih', 'error'); return; }
        const max = DB.qtyOut(prod.id, d.source) - DB.qtyReturnSource(prod.id, d.source) + (existing && existing.source === d.source ? U.num(existing.qty) : 0);
        if (U.num(d.qty) <= 0 || U.num(d.qty) > max) {
          UI.toast('Jumlah tidak boleh melebihi barang masih di ' + d.source + ' (' + U.fmt(Math.max(0, max)) + ')', 'error'); return;
        }
        const row = Object.assign({}, d, {
          qty: U.num(d.qty), goodQty: U.num(d.qty), afkirQty: 0,
          sku: prod.sku, productName: prod.name, source: d.source, artisanName: d.partyName || d.source
        });
        if (existing) DB.update('returns', existing.id, row); else DB.insert('returns', row);
        UI.toast('Barang kembali diterima. Menunggu QC tim gudang.', 'success');
        close(); App.refresh();
      }
    });
  };

  const returns = {
    render() {
      const tab = state.returnsTab;
      let body = '';
      if (tab === 'kembali') {
        const rows = DB.all('returns').filter(r => !r.source || r.source === 'Pengrajin' || r.distributionId).sort((a, b) => b.date.localeCompare(a.date));
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
            actions: [
              ...(can('inbound.create') && can('qc.update') ? [{ label: 'Buat Masuk', act: 'qcInbound' }] : []),
              ...(can('qc.update') ? [{ label: 'Edit', act: 'editQc' }, { label: 'Hapus', act: 'delQc', cls: 'danger' }] : [])
            ],
            empty: 'Belum ada proses QC.'
          }) + '</div></div>';
      } else if (tab === 'kembali-lain') {
        const rows = DB.all('returns').filter(r => r.source && r.source !== 'Pengrajin').sort((a, b) => b.date.localeCompare(a.date));
        body = UI.pageHead('Barang Kembali dari Pemborong / Pinjaman', 'Borong obat, servis, dan sampel pengrajin yang kembali ke gudang',
          (can('returns.create') ? '<button class="btn btn-primary" data-act="addOtherReturn">+ Terima Barang Kembali</button>' : '')) +
          '<div class="card"><div class="card-body">' + UI.table({
            columns: [
              { label: 'Tanggal', render: r => U.dateID(r.date) },
              { label: 'Dari', render: r => U.badge(r.source) },
              { label: 'Nama', key: 'artisanName' },
              { label: 'Produk', render: r => U.esc(r.productName) + '<br><small>' + U.esc(r.sku) + '</small>' },
              { label: 'Qty', align: 'right', render: r => U.fmt(r.qty) },
              { label: 'Masuk QC', align: 'right', render: r => '<strong>' + U.fmt(r.goodQty) + '</strong>' },
              { label: 'Catatan', key: 'notes' }
            ], rows,
            actions: can('returns.update') ? [{ label: 'Edit', act: 'editOtherReturn' }, { label: 'Hapus', act: 'delOtherReturn', cls: 'danger' }] : [],
            empty: 'Belum ada barang kembali dari pemborong / pinjaman sampel.'
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
        [['kembali', 'Barang Kembali'], ['kembali-lain', 'Kembali Borong / Sampel'], ['qc', 'Quality Control'], ['barang-jadi', 'Barang Jadi']].map(x =>
          '<button class="tab ' + (tab === x[0] ? 'active' : '') + '" data-tab="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' + body;
    },
    bind(root) {
      U.$$('[data-tab]', root).forEach(b => b.addEventListener('click', () => { state.returnsTab = b.dataset.tab; App.refresh(); }));
      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        const tableOf = { editReturn: 'returns', delReturn: 'returns', editOtherReturn: 'returns', delOtherReturn: 'returns', editQc: 'qc', delQc: 'qc', qcInbound: 'qc' };
        const x = tableOf[act] ? DB.get(tableOf[act], b.dataset.id) : null;
        if (act === 'addReturn') window.openReturnForm();
        if (act === 'addOtherReturn') window.openOtherReturnForm();
        if (act === 'addQc') qcForm(null);
        if (act === 'editReturn' && x) window.openReturnForm(x);
        if (act === 'delReturn' && x) UI.confirm('Hapus penerimaan ini? Barang akan kembali ke pengrajin.', () => { DB.remove('returns', x.id); UI.toast('Dihapus', 'success'); App.refresh(); }, true);
        if (act === 'editOtherReturn' && x) window.openOtherReturnForm(x.source, x);
        if (act === 'delOtherReturn' && x) UI.confirm('Hapus penerimaan ' + x.source + ' ini?', () => { DB.remove('returns', x.id); UI.toast('Dihapus', 'success'); App.refresh(); }, true);
        if (act === 'editQc' && x) qcForm(x);
        if (act === 'delQc' && x) UI.confirm('Hapus data QC ini? Barang kembali menunggu QC.', () => {
          if (x.inboundId) DB.remove('inbound', x.inboundId);
          DB.remove('qc', x.id); UI.toast('Dihapus', 'success'); App.refresh();
        }, true);
        if (act === 'qcInbound' && x) {
          if (x.inboundId) { UI.toast('Barang masuk untuk QC ini sudah dibuat', 'warning'); return; }
          if (U.num(x.passedQty) <= 0) { UI.toast('Tidak ada barang lulus pada QC ini', 'warning'); return; }
          const rec = DB.insert('inbound', {
            date: x.date, supplier: 'Hasil QC', productId: x.productId, sku: x.sku, productName: x.productName,
            qty: U.num(x.passedQty), condition: 'Baik', receiver: DB.currentUser().name,
            notes: 'Hasil QC ' + x.id, createdAt: new Date().toISOString()
          });
          DB.update('qc', x.id, { inboundId: rec.id });
          UI.toast('Barang masuk ' + U.fmt(rec.qty) + ' pcs dibuat dari QC', 'success'); App.refresh();
        }
        if (act === 'ship') window.openOutboundForm(b.dataset.id);
      }));
    }
  };

  /* ================= SPK ================= */
  function spkHtml(s) {
    const p = pOf(s.productId);
    const a = DB.get('artisans', s.artisanId) || {};
    const unit = U.num(p.price), amount = U.num(s.qty) * unit;
    const row = (label, value) => '<tr><th style="width:150px">' + label + '</th><td>' + (value || '-') + '</td></tr>';
    return '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>SPK ' + U.esc(s.no) + '</title>' +
      '<style>' +
      'body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#1e293b}' +
      '.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #7a4a22;padding-bottom:12px;margin-bottom:18px}' +
      'h1{font-size:19px;margin:0;color:#7a4a22;letter-spacing:.03em}h2{text-align:center;font-size:17px;margin:0 0 18px;text-decoration:underline}' +
      '.brand{font-size:11px;color:#64748b;margin-top:4px}.no{font-size:13px;text-align:right;line-height:1.7}' +
      'table{border-collapse:collapse;width:100%;font-size:12px;margin-bottom:14px}' +
      'th,td{border:1px solid #cbd5e1;padding:7px 9px;text-align:left;vertical-align:top}' +
      '.info th{background:#efe0cc;width:150px}.num{text-align:right}' +
      '.items th{background:#efe0cc;text-align:center}.items td{text-align:center}.items td.left{text-align:left}' +
      '.total{margin-left:auto;width:320px}.total td{border:none;padding:5px 0}.total td.num{border-bottom:1px solid #cbd5e1}' +
      '.grand{font-weight:bold;font-size:14px;background:#f1f5f9}' +
      '.sign{display:flex;justify-content:space-between;margin-top:44px;font-size:12px;text-align:center}' +
      '.notes{font-size:12px;min-height:46px;border:1px solid #cbd5e1;padding:9px}' +
      '.muted{color:#64748b;font-size:11px}@media print{body{padding:10px}.no-print{display:none}}' +
      '</style></head><body>' +
      '<div class="head"><div><h1>STOCK SOLID TEAK FURNITURE</h1><div class="brand">Sistem Stok, Produksi & Pengrajin</div></div>' +
      '<div class="no"><strong>' + U.esc(s.no) + '</strong><br>Tanggal: ' + U.dateID(s.date) + '<br>Target: ' + U.dateID(s.targetDate) + '</div></div>' +
      '<h2>SURAT PERINTAH KERJA (SPK)</h2>' +
      '<table class="info">' +
      row('Ditujukan Kepada', '<strong>' + U.esc(a.name || '-') + '</strong>') +
      row('Alamat', U.esc(a.address || '-')) +
      row('Telepon', U.esc(a.phone || '-')) +
      row('Status', U.esc(s.status || 'Proses')) +
      '</table>' +
      '<table class="items"><thead><tr><th>No</th><th>SKU</th><th>Produk</th><th>Ukuran</th><th>Qty</th><th>Harga Satuan</th><th>Nilai</th></tr></thead><tbody>' +
      '<tr><td>1</td><td>' + U.esc(p.sku || '-') + '</td><td class="left">' + U.esc(p.name || '-') + '</td>' +
      '<td>' + U.esc(p.size || '-') + '</td><td>' + U.fmt(s.qty) + '</td><td class="num">' + U.rp(unit) + '</td>' +
      '<td class="num">' + U.rp(amount) + '</td></tr></tbody></table>' +
      '<table class="total"><tr><td>Total Barang</td><td class="num">' + U.fmt(s.qty) + ' pcs</td></tr>' +
      '<tr class="grand"><td>TOTAL NILAI PEKERJAAN</td><td class="num">' + U.rp(amount) + '</td></tr></table>' +
      '<p style="font-size:12px;font-weight:bold;margin:16px 0 5px">Catatan / Instruksi:</p>' +
      '<div class="notes">' + U.esc(s.notes || 'Kerjakan sesuai spesifikasi dan target waktu yang ditentukan.') + '</div>' +
      '<div class="sign"><div>Dibuat oleh,<br><br>_______________________<br>Produksi</div>' +
      '<div>Diterima oleh,<br><br>_______________________<br>' + U.esc(a.name || 'Pengrajin') + '</div></div>' +
      '<p class="muted" style="margin-top:28px">Dicetak: ' + U.dateTime(new Date().toISOString()) + '</p>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>';
  }

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
            { label: 'Nilai', align: 'right', render: r => U.rp(U.num(r.qty) * U.num(pOf(r.productId).price)) },
            { label: 'Target', render: r => U.dateID(r.targetDate) },
            { label: 'Status', render: r => U.badge(r.targetDate < t() && r.status !== 'Selesai' ? 'Terlambat' : r.status) },
            { label: 'Catatan', key: 'notes' }
          ], rows,
          actions: [
            { label: 'Cetak', act: 'printSpk' },
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
        if (b.dataset.act === 'printSpk') printDocument(spkHtml(x), 'SPK disiapkan untuk dicetak');
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
      return U.sortBySKU(DB.all('products')).filter(p => !state.reportProduct || p.id === state.reportProduct)
        .filter(p => !state.reportCategory || p.category === state.reportCategory)
        .filter(p => !state.reportStatus || p.status === state.reportStatus)
        .map(p => { const s = DB.stock(p.id); return [p.sku, p.name, p.category, p.status, s.warehouse, s.process, s.qc, s.ready, s.damaged, s.total]; });
    }
    return U.sortByName(DB.all('artisans')).filter(a => !state.reportArtisan || a.id === state.reportArtisan).map(a => {
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
        '<select id="rCat"><option value="">Semua kategori</option>' + DB.getCategories().map(c => '<option' + (state.reportCategory === c ? ' selected' : '') + '>' + U.esc(c) + '</option>').join('') + '</select>' +
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
        ['Produk', U.sortBySKU(DB.all('products')).filter(match), '#/products', p => p.name + ' · ' + p.sku],
        ['Pengrajin', U.sortByName(DB.all('artisans')).filter(match), '#/artisans', a => a.name + ' · ' + a.id],
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
    DB.all('boxes').filter(b => U.num(b.qty) <= U.num(b.minQty)).forEach(b => out.push({ key: 'boxlow_' + b.id, icon: '📐', title: 'Stok box menipis', text: (b.productSku || pOf(b.productId).sku || b.code) + ' — ' + b.code + ' tersisa ' + U.fmt(b.qty) + ' pcs', href: '#/boxes', date: t() }));
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
      const bk = DB.getBackupConfig() || {};
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
        '<li>Buka <strong>SQL Editor</strong> → <strong>New query</strong> → jalankan <code>supabase/schema.sql</code> untuk project baru, atau untuk project lama jalankan berurutan: <code>fix-auth.sql</code>, <code>fix-permission.sql</code>, <code>add-wages.sql</code>, <code>add-borong.sql</code>, <code>add-online-updates.sql</code>, <code>update-passwords.sql</code>. Detail ada di <code>PANDUAN-ONLINE.md</code>.</li>' +
        '<li>Buka <strong>Project Settings → API</strong>. Salin <strong>Project URL</strong> dan <strong>anon/public key</strong>.</li>' +
        '<li>Tempel keduanya di atas, lalu klik <strong>Aktifkan Supabase</strong>. Data contoh akan otomatis terunggah.</li>' +
        '<li>Deploy ulang folder aplikasi ke hosting gratis. Semua perangkat yang membuka link akan memakai database yang sama.</li>' +
        '</ol></div></div><br>' +
        '<div class="card"><div class="card-head"><h3>☁️ Backup ke Google Sheet + Gmail</h3>' +
        (bk.lastBackup ? '<span class="badge badge-green">Terakhir: ' + U.dateTime(bk.lastBackup) + '</span>' : '<span class="badge badge-yellow">Belum pernah backup</span>') +
        '</div><div class="card-body">' +
        '<div class="notice">Supabase sudah menyimpan data bersama secara otomatis. Tambahan ini mengirim salinan seluruh tabel ke <strong>Google Sheet</strong>, menyimpan file JSON di <strong>Google Drive</strong>, dan mengirim email ke <strong>Gmail</strong>. Siapkan sekali lewat file <code>google-apps-script/Code.gs</code> (panduan ada di README).</div><br>' +
        '<div class="form-grid">' +
        '<div class="field full"><label>Web App URL (dari Deploy → Web app)</label><input id="bkUrl" placeholder="https://script.google.com/macros/s/.../exec" value="' + U.esc(bk.url || '') + '"></div>' +
        '<div class="field"><label>Email Gmail penerima</label><input id="bkEmail" type="email" placeholder="nama@gmail.com" value="' + U.esc(bk.email || '') + '"></div>' +
        '<div class="field"><label>Token rahasia (sama dengan Script Properties)</label><input id="bkToken" type="password" value="' + U.esc(bk.token || '') + '"></div>' +
        '</div>' +
        '<div style="margin-top:12px"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="bkAuto"' + (bk.auto ? ' checked' : '') + ' style="width:auto"> Backup otomatis 20 detik setelah ada perubahan data</label></div>' +
        '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn" id="bkSave">💾 Simpan Pengaturan</button>' +
        '<button class="btn btn-primary" id="bkNow">☁️ Backup Sekarang</button>' +
        '<button class="btn" id="bkJson">⬇ Unduh Cadangan JSON</button>' +
        (bk.sheetUrl ? '<a class="btn" href="' + U.esc(bk.sheetUrl) + '" target="_blank" rel="noopener">📊 Buka Google Sheet</a>' : '') +
        '</div><div id="bkStatus" class="hint" style="margin-top:10px">' +
        (bk.sheetUrl ? 'Sheet: ' + U.esc(bk.sheetUrl) : 'Belum ada Google Sheet tertaut.') + '</div>' +
        '</div></div><br>' +
        '<div class="notice error"><strong>Catatan keamanan:</strong> schema Supabase di atas memakai policy akses penuh untuk kemudahan internal/demo. Untuk pemakaian publik, sebaiknya aktifkan Supabase Auth dan ganti RLS policy dengan pemeriksaan <code>auth.uid()</code>. Akun bawaan dibuat oleh schema.sql dan diverifikasi lewat fungsi <code>authenticate()</code> di server. Untuk backup: siapa pun yang tahu Web App URL + token bisa menimpa sheet, jadi simpan token baik-baik.</div>';
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

      const bkForm = () => {
        const old = DB.getBackupConfig() || {};
        return {
          url: U.$('#bkUrl', root).value.trim(),
          email: U.$('#bkEmail', root).value.trim(),
          token: U.$('#bkToken', root).value.trim(),
          auto: U.$('#bkAuto', root).checked,
          lastBackup: old.lastBackup, sheetUrl: old.sheetUrl
        };
      };
      const bkSave = U.$('#bkSave', root);
      if (bkSave) bkSave.addEventListener('click', () => {
        DB.saveBackupConfig(bkForm());
        UI.toast('Pengaturan backup disimpan', 'success');
        App.refresh();
      });
      const bkNow = U.$('#bkNow', root);
      if (bkNow) bkNow.addEventListener('click', async () => {
        DB.saveBackupConfig(bkForm());
        bkNow.disabled = true; bkNow.textContent = 'Mengirim...';
        const status = U.$('#bkStatus', root);
        if (status) status.textContent = 'Mengirim salinan data ke Google Sheet & Gmail...';
        try {
          const out = await DB.pushBackup();
          UI.toast(out.opaque
            ? 'Backup dikirim. Cek Google Sheet / email untuk konfirmasi.'
            : 'Backup berhasil: ' + U.fmt(out.rows) + ' baris' + (out.emailSent ? ', email terkirim' : (out.emailSent === false ? ', email gagal: ' + (out.emailError || 'cek pengaturan') : '')), 'success');
          App.refresh();
        } catch (err) {
          UI.toast(err.message, 'error');
          if (status) status.textContent = 'Gagal: ' + err.message;
          bkNow.disabled = false; bkNow.textContent = '☁️ Backup Sekarang';
        }
      });
      const bkJson = U.$('#bkJson', root);
      if (bkJson) bkJson.addEventListener('click', () => {
        U.download('backup-stok-' + U.today() + '.json', JSON.stringify(DB.load(), null, 2), 'application/json');
        UI.toast('Cadangan JSON diunduh', 'success');
      });
    }
  };

  /* ================= GAJI KARYAWAN HARIAN & SLIP MINGGUAN ================= */
  function weekStart(dateStr) {
    const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    if (isNaN(d)) return U.shiftDays(-((d.getDay() || 7) - 1));
    const diff = (d.getDay() || 7) - 1; // Senin = awal minggu
    d.setDate(d.getDate() - diff);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function wageForm(existing, close) {
    const names = U.unique(DB.all('wages').map(w => w.employee));
    UI.formModal({
      title: existing ? 'Edit Gaji Harian' : 'Catat Gaji Harian', wide: true,
      values: existing || {
        date: U.today(), employee: '', position: DB.JOB_TITLES[0], dailyWage: 150000, overtimeRate: 25000,
        days: 1, overtimeHours: 0, notes: ''
      },
      notice: 'Isi Nama Karyawan dan Jabatan sesuai peran di perusahaan: ' +
        'Manager/Mandor/Angkat Junjung mengawasi pekerjaan, Pemborong Amplas mengerjakan amplas, ' +
        'Pemborong Packing mengerjakan packing. Total harian = (Jumlah masuk × Gaji harian) + (Jam lembur × Upah lembur per jam).',
      fields: [
        { key: 'date', label: 'Tanggal', type: 'date', required: true },
        { key: 'employee', label: 'Nama Karyawan', type: 'datalist', options: names, required: true, placeholder: 'mis. Rizky Prasetyo' },
        { key: 'position', label: 'Jabatan dalam Perusahaan', type: 'select', options: DB.JOB_TITLES, required: true, placeholder: '-- Pilih jabatan --' },
        { key: 'dailyWage', label: 'Gaji Harian (Rp)', type: 'number', min: 0, step: 1000, required: true },
        { key: 'overtimeRate', label: 'Upah Lembur per Jam (Rp)', type: 'number', min: 0, step: 1000, required: true },
        { key: 'days', label: 'Jumlah Masuk (hari)', type: 'number', min: 0, step: 0.5, required: true },
        { key: 'overtimeHours', label: 'Jam Lembur', type: 'number', min: 0, step: 0.5 },
        { key: 'notes', label: 'Catatan', type: 'textarea', full: true, placeholder: 'Opsional' }
      ],
      onSubmit(d, closeFn) {
        d.dailyWage = U.num(d.dailyWage);
        d.overtimeRate = U.num(d.overtimeRate);
        d.days = U.num(d.days);
        d.overtimeHours = U.num(d.overtimeHours);
        if (existing) { DB.update('wages', existing.id, d); UI.toast('Data gaji diperbarui', 'success'); }
        else { DB.insert('wages', d); UI.toast('Gaji harian dicatat', 'success'); }
        closeFn(); App.refresh();
      }
    });
  }

  function wageDailyHtml(w) {
    const basic = U.num(w.days) * U.num(w.dailyWage);
    const ot = U.num(w.overtimeHours) * U.num(w.overtimeRate);
    const row = (label, value) => '<tr><th style="width:190px">' + label + '</th><td>' + value + '</td></tr>';
    return '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Bukti Gaji ' + U.esc(w.employee) + '</title>' +
      '<style>' +
      'body{font-family:Segoe UI,Arial,sans-serif;padding:26px;color:#1e293b}' +
      '.head{display:flex;justify-content:space-between;border-bottom:3px solid #7a4a22;padding-bottom:12px;margin-bottom:18px}' +
      'h1{font-size:19px;margin:0;color:#7a4a22}h2{text-align:center;font-size:16px;margin:0 0 18px;text-decoration:underline}' +
      '.brand{font-size:11px;color:#64748b;margin-top:4px}.no{font-size:12px;text-align:right;line-height:1.7}' +
      'table{border-collapse:collapse;width:100%;font-size:12px;margin-bottom:14px}' +
      'th,td{border:1px solid #cbd5e1;padding:7px 9px;text-align:left}.info th{background:#efe0cc;width:190px}' +
      '.summary{width:360px;margin-left:auto}.summary td{border:none;padding:6px 0}.summary td:last-child{border-bottom:1px solid #cbd5e1;text-align:right}' +
      '.grand{font-weight:bold;font-size:14px;background:#f1f5f9}' +
      '.sign{display:flex;justify-content:space-between;margin-top:44px;font-size:12px;text-align:center}' +
      '.notes{font-size:12px;min-height:40px;border:1px solid #cbd5e1;padding:9px}' +
      '.muted{color:#64748b;font-size:11px}@media print{body{padding:10px}}' +
      '</style></head><body>' +
      '<div class="head"><div><h1>STOCK SOLID TEAK FURNITURE</h1><div class="brand">Sistem Stok, Produksi & Pengrajin</div></div>' +
      '<div class="no"><strong>' + U.esc(w.employee) + '</strong><br>' + U.esc(w.position || '-') + '<br>Tanggal: ' + U.dateID(w.date) + '</div></div>' +
      '<h2>BUKTI GAJI HARIAN</h2>' +
      '<table class="info">' +
      row('Nama Karyawan', '<strong>' + U.esc(w.employee) + '</strong>') +
      row('Jabatan', U.esc(w.position || '-')) +
      row('Tanggal', U.dateID(w.date)) +
      row('Jumlah Masuk', U.num(w.days) + ' hari') +
      row('Gaji Harian', U.rp(w.dailyWage)) +
      row('Jam Lembur', U.num(w.overtimeHours) + ' jam') +
      row('Upah Lembur / Jam', U.rp(w.overtimeRate)) +
      '</table>' +
      '<table class="summary">' +
      '<tr><td>Gaji Pokok (' + U.num(w.days) + ' hari)</td><td>' + U.rp(basic) + '</td></tr>' +
      '<tr><td>Upah Lembur (' + U.num(w.overtimeHours) + ' jam)</td><td>' + U.rp(ot) + '</td></tr>' +
      '<tr class="grand"><td>TOTAL DITERIMA</td><td>' + U.rp(DB.wageTotal(w)) + '</td></tr>' +
      '</table>' +
      '<p style="font-size:12px;font-weight:bold;margin:16px 0 5px">Catatan:</p>' +
      '<div class="notes">' + U.esc(w.notes || '-') + '</div>' +
      '<div class="sign"><div>Diterima oleh,<br><br>_______________________<br>' + U.esc(w.employee) + '</div>' +
      '<div>Dibayar oleh,<br><br>_______________________<br>Perusahaan</div></div>' +
      '<p class="muted" style="margin-top:28px">Dicetak: ' + U.dateTime(new Date().toISOString()) + '</p>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>';
  }

  function slipHtml(week, bonus, debt, late) {
    const total = week.subtotal + bonus - debt - late;
    const detail = week.rows.map(w =>
      '<tr><td>' + U.dateID(w.date) + '</td><td>' + U.num(w.days) + '</td>' +
      '<td style="text-align:right">' + U.rp(w.dailyWage) + '</td>' +
      '<td style="text-align:right">' + U.rp(U.num(w.days) * U.num(w.dailyWage)) + '</td>' +
      '<td style="text-align:right">' + U.num(w.overtimeHours) + '</td>' +
      '<td style="text-align:right">' + U.rp(U.num(w.overtimeHours) * U.num(w.overtimeRate)) + '</td></tr>'
    ).join('');
    const line = (label, value, bold) => '<tr' + (bold ? ' style="font-weight:bold;background:#f1f5f9"' : '') + '><td>' + label + '</td><td style="text-align:right">' + U.rp(value) + '</td></tr>';
    return '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Slip Gaji ' + U.esc(week.employee) + '</title>' +
      '<style>' +
      'body{font-family:Segoe UI,Arial,sans-serif;padding:28px;color:#1e293b}' +
      'h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 8px}' +
      '.head{display:flex;justify-content:space-between;border-bottom:2px solid #334155;padding-bottom:12px;margin-bottom:16px}' +
      '.muted{color:#64748b;font-size:12px}table{border-collapse:collapse;width:100%;font-size:12px;margin-bottom:14px}' +
      'th,td{border:1px solid #cbd5e1;padding:7px 9px;text-align:left}th{background:#e2e8f0}' +
      '.summary{width:340px;margin-left:auto}.sign{display:flex;justify-content:space-between;margin-top:48px;font-size:12px}' +
      '@media print{body{padding:12px}.no-print{display:none}}' +
      '</style></head><body>' +
      '<div class="head"><div><h1>SLIP GAJI MINGGUAN</h1><div class="muted">CV Furniture Jati — Sistem Stok & Produksi</div></div>' +
      '<div style="text-align:right"><strong>' + U.esc(week.employee) + '</strong>' +
      (week.position ? '<br><span class="muted">Jabatan: ' + U.esc(week.position) + '</span>' : '') +
      '<br><span class="muted">Periode ' + U.dateID(week.start) + ' s/d ' + U.dateID(week.end) + '</span></div></div>' +
      '<h2>Rincian Kehadiran & Lembur</h2>' +
      '<table><thead><tr><th>Tanggal</th><th>Masuk (hari)</th><th>Gaji/hari</th><th>Gaji Pokok</th><th>Lembur (jam)</th><th>Upah Lembur</th></tr></thead>' +
      '<tbody>' + (detail || '<tr><td colspan="6" style="text-align:center">Tidak ada data pada periode ini</td></tr>') + '</tbody></table>' +
      '<h2>Rekapitulasi</h2>' +
      '<table class="summary">' +
      line('Gaji Pokok', week.basic) +
      line('Upah Lembur', week.overtime) +
      line('Bonus', bonus) +
      line('Total Bon / Hutang', -debt) +
      line('Potongan Telat Masuk', -late) +
      line('GAJI BERSIH', total, true) +
      '</table>' +
      '<div class="sign"><div>Diterima oleh,<br><br>_______________________</div><div>Dibayar oleh,<br><br>_______________________</div></div>' +
      '<p class="muted" style="margin-top:24px">Dicetak: ' + U.dateTime(new Date().toISOString()) + '</p>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>';
  }

  function printSlip(week, bonus, debt, late) {
    printDocument(slipHtml(week, bonus, debt, late), 'Slip disiapkan untuk dicetak');
  }

  const payroll = {
    render() {
      const allW = DB.all('wages');
      const today = DB.payrollSummary(U.today());
      const names = U.unique(allW.map(w => w.employee));
      if (!state.slipEmployee && names.length) state.slipEmployee = names[0];
      if (!state.slipWeek) state.slipWeek = weekStart(U.today());

      let rows = allW.filter(w => (!state.payrollFrom || w.date >= state.payrollFrom) && (!state.payrollTo || w.date <= state.payrollTo));
      rows = filterRows(rows, state.payrollQ, ['employee', 'position', 'date', 'notes']);
      if (state.payrollEmployee) rows = rows.filter(w => w.employee === state.payrollEmployee);
      if (state.payrollPosition) rows = rows.filter(w => w.position === state.payrollPosition);
      rows.sort((a, b) => b.date.localeCompare(a.date));

      const week = DB.payrollWeek(state.slipEmployee, state.slipWeek);
      const bonus = U.num(state.slipBonus), debt = U.num(state.slipDebt), late = U.num(state.slipLate);
      const net = week.subtotal + bonus - debt - late;
      const weekOpts = names.map(n => '<option value="' + U.esc(n) + '"' + (n === state.slipEmployee ? ' selected' : '') + '>' + U.esc(n) + '</option>').join('');
      const empOpts = names.map(n => '<option value="' + U.esc(n) + '"' + (n === state.payrollEmployee ? ' selected' : '') + '>' + U.esc(n) + '</option>').join('');
      const posOpts = DB.JOB_TITLES.map(p => '<option' + (state.payrollPosition === p ? ' selected' : '') + '>' + U.esc(p) + '</option>').join('');

      return UI.pageHead('Gaji Karyawan Harian', 'Nama karyawan & jabatan (Manager/Mandor/Angkat Junjung, Pemborong Amplas, Pemborong Packing), upah harian, lembur, dan slip mingguan',
          (can('payroll.edit') ? '<button class="btn btn-primary" data-act="addWage">+ Catat Gaji Harian</button>' : '') +
          '<button class="btn" data-act="printSlip">🖨️ Cetak Slip Mingguan</button>') +
        '<div class="grid grid-stats">' +
        UI.statCard({ label: 'Gaji Hari Ini', value: U.rp(today.total), sub: U.dateID(U.today()), icon: '💰' }) +
        UI.statCard({ label: 'Karyawan Masuk Hari Ini', value: U.fmt(today.employees), sub: 'orang', icon: '👷' }) +
        UI.statCard({ label: 'Gaji Pokok Hari Ini', value: U.rp(today.basic), sub: 'jumlah masuk × harian', icon: '📅' }) +
        UI.statCard({ label: 'Upah Lembur Hari Ini', value: U.rp(today.overtime), sub: 'jam × tarif lembur', icon: '⏱️' }) +
        '</div><br>' +
        '<div class="card"><div class="card-head"><h3>Catatan Gaji Harian</h3><span style="display:flex;gap:8px">' +
        '<button class="btn btn-sm" data-act="wageExcel">⬇ Excel</button>' +
        '<button class="btn btn-sm" data-act="wagePdf">⬇ PDF</button></span></div><div class="card-body">' +
        '<div class="toolbar"><input id="wageQ" placeholder="Cari nama / jabatan / catatan..." value="' + U.esc(state.payrollQ) + '">' +
        '<input type="date" id="wageFrom" value="' + U.esc(state.payrollFrom) + '">' +
        '<input type="date" id="wageTo" value="' + U.esc(state.payrollTo) + '">' +
        '<select id="wageEmployee"><option value="">Semua karyawan</option>' + empOpts + '</select>' +
        '<select id="wagePosition"><option value="">Semua jabatan</option>' + posOpts + '</select>' +
        '<div class="spacer"></div><strong>Total: ' + U.rp(U.sum(rows, DB.wageTotal)) + '</strong></div>' +
        UI.table({
          columns: [
            { label: 'Tanggal', render: r => U.dateID(r.date) },
            { label: 'Nama Karyawan', key: 'employee' },
            { label: 'Jabatan', render: r => U.badge(r.position || '-') },
            { label: 'Gaji Harian', align: 'right', render: r => U.rp(r.dailyWage) },
            { label: 'Lembur / Jam', align: 'right', render: r => U.rp(r.overtimeRate) },
            { label: 'Masuk', align: 'right', render: r => U.num(r.days) + ' hari' },
            { label: 'Jam Lembur', align: 'right', render: r => U.num(r.overtimeHours) + ' jam' },
            { label: 'Gaji Pokok', align: 'right', render: r => U.rp(U.num(r.days) * U.num(r.dailyWage)) },
            { label: 'Upah Lembur', align: 'right', render: r => U.rp(U.num(r.overtimeHours) * U.num(r.overtimeRate)) },
            { label: 'Total', align: 'right', render: r => '<strong>' + U.rp(DB.wageTotal(r)) + '</strong>' },
            { label: 'Catatan', key: 'notes' }
          ], rows,
          actions: [{ label: 'Cetak', act: 'printWage' },
            ...(can('payroll.edit') ? [{ label: 'Edit', act: 'editWage' }, { label: 'Hapus', act: 'delWage', cls: 'danger' }] : [])],
          empty: 'Belum ada catatan gaji harian.'
        }) + '</div></div><br>' +
        '<div class="card"><div class="card-head"><h3>🧾 Slip Gaji Mingguan</h3><span class="badge badge-blue">' + U.dateID(week.start) + ' — ' + U.dateID(week.end) + '</span></div><div class="card-body">' +
        '<div class="form-grid">' +
        '<div class="field"><label>Karyawan</label><select id="slipEmployee">' + weekOpts + '</select></div>' +
        '<div class="field"><label>Mulai Pekan (Senin)</label><input type="date" id="slipWeek" value="' + U.esc(state.slipWeek) + '"></div>' +
        '<div class="field"><label>Bonus (Rp)</label><input type="number" id="slipBonus" min="0" step="1000" value="' + bonus + '"></div>' +
        '<div class="field"><label>Total Bon / Hutang (Rp)</label><input type="number" id="slipDebt" min="0" step="1000" value="' + debt + '"></div>' +
        '<div class="field"><label>Potongan Telat Masuk (Rp)</label><input type="number" id="slipLate" min="0" step="1000" value="' + late + '"></div>' +
        '</div>' +
        '<div class="notice" style="margin-top:12px">Jabatan: <strong>' + U.esc(week.position || '-') + '</strong>. ' +
        'Manager/Mandor/Angkat Junjung = pengawas pekerjaan; Pemborong Amplas = pelaksana amplas; Pemborong Packing = pelaksana packing.</div>' +
        '<div style="margin-top:14px">' + UI.table({
          columns: [
            { label: 'Tanggal', render: r => U.dateID(r.date) },
            { label: 'Masuk', align: 'right', render: r => U.num(r.days) + ' hari' },
            { label: 'Gaji Pokok', align: 'right', render: r => U.rp(U.num(r.days) * U.num(r.dailyWage)) },
            { label: 'Lembur', align: 'right', render: r => U.num(r.overtimeHours) + ' jam' },
            { label: 'Upah Lembur', align: 'right', render: r => U.rp(U.num(r.overtimeHours) * U.num(r.overtimeRate)) }
          ], rows: week.rows, empty: 'Tidak ada data gaji pada pekan ini.'
        }) + '</div>' +
        '<div id="slipTotals" style="margin-top:14px">' + payroll.totalsHtml(week, bonus, debt, late) + '</div>' +
        '</div></div>';
    },
    totalsHtml(week, bonus, debt, late) {
      const net = week.subtotal + bonus - debt - late;
      const line = (label, value, bold) => '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0' + (bold ? ';font-weight:bold;font-size:16px;border-bottom:none' : '') + '"><span>' + label + '</span><span>' + U.rp(value) + '</span></div>';
      return '<div style="max-width:380px;margin-left:auto">' +
        line('Gaji Pokok', week.basic) + line('Upah Lembur', week.overtime) + line('Bonus', bonus) +
        line('Total Bon / Hutang', -debt) + line('Potongan Telat Masuk', -late) + line('GAJI BERSIH', net, true) + '</div>';
    },
    bind(root) {
      const refreshTable = () => { App.refresh(); const el = U.$('#wageQ'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
      U.$('#wageQ', root).addEventListener('input', e => { state.payrollQ = e.target.value; refreshTable(); });
      U.$('#wageFrom', root).addEventListener('change', e => { state.payrollFrom = e.target.value; App.refresh(); });
      U.$('#wageTo', root).addEventListener('change', e => { state.payrollTo = e.target.value; App.refresh(); });
      U.$('#wageEmployee', root).addEventListener('change', e => { state.payrollEmployee = e.target.value; App.refresh(); });
      U.$('#wagePosition', root).addEventListener('change', e => { state.payrollPosition = e.target.value; App.refresh(); });
      U.$('#slipEmployee', root).addEventListener('change', e => { state.slipEmployee = e.target.value; App.refresh(); });
      U.$('#slipWeek', root).addEventListener('change', e => { state.slipWeek = e.target.value; App.refresh(); });

      const week = DB.payrollWeek(state.slipEmployee, state.slipWeek);
      const recalc = () => {
        const b = U.num(U.$('#slipBonus', root)?.value), d = U.num(U.$('#slipDebt', root)?.value), l = U.num(U.$('#slipLate', root)?.value);
        state.slipBonus = b; state.slipDebt = d; state.slipLate = l;
        const el = U.$('#slipTotals', root);
        if (el) el.innerHTML = payroll.totalsHtml(week, b, d, l);
      };
      ['#slipBonus', '#slipDebt', '#slipLate'].forEach(sel => {
        const el = U.$(sel, root); if (el) el.addEventListener('input', recalc);
      });
      recalc();

      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'printWage') {
          const w = DB.get('wages', b.dataset.id);
          if (w) printDocument(wageDailyHtml(w), 'Bukti gaji disiapkan untuk dicetak');
        }
        if (act === 'addWage') { if (can('payroll.edit')) wageForm(null); }
        if (act === 'editWage') { const w = DB.get('wages', b.dataset.id); if (w && can('payroll.edit')) wageForm(w); }
        if (act === 'delWage') {
          const w = DB.get('wages', b.dataset.id);
          if (w && can('payroll.edit')) UI.confirm('Hapus catatan gaji ' + w.employee + ' tanggal ' + U.dateID(w.date) + '?', () => { DB.remove('wages', w.id); UI.toast('Dihapus', 'success'); App.refresh(); }, true);
        }
        if (act === 'printSlip') {
          printSlip(week, U.num(state.slipBonus), U.num(state.slipDebt), U.num(state.slipLate));
        }
        if (act === 'wageExcel' || act === 'wagePdf') {
          const rows = [['Tanggal', 'Nama Karyawan', 'Jabatan', 'Gaji Harian', 'Lembur/Jam', 'Jumlah Masuk', 'Jam Lembur', 'Gaji Pokok', 'Upah Lembur', 'Total', 'Catatan']]
            .concat(DB.all('wages').sort((a, b) => b.date.localeCompare(a.date)).map(w => [
              U.dateID(w.date), w.employee, w.position || '', w.dailyWage, w.overtimeRate, w.days, w.overtimeHours,
              U.num(w.days) * U.num(w.dailyWage), U.num(w.overtimeHours) * U.num(w.overtimeRate), DB.wageTotal(w), w.notes || ''
            ]));
          if (act === 'wageExcel') U.exportExcel('laporan-gaji-karyawan', rows); else U.exportPDF('Laporan Gaji Karyawan', rows);
        }
      }));
    }
  };

  /* ================= GAJI BORONG AMPLAS & PACKING ================= */
  const borongNames = () => U.unique(DB.all('wages').map(w => w.employee)
    .concat(DB.all('borong').map(b => b.employee))).filter(Boolean).sort(U.natCompare);
  const rateOf = (p, type) => U.num(type === 'Packing' ? p.ratePacking : p.rateAmplas);

  function borongForm(existing, mode) {
    const assign = mode === 'assign';
    let items = existing ? JSON.parse(JSON.stringify(existing.items || [])) : [];
    let curType = existing ? existing.type : 'Amplas';
    const opts = pOpts();

    const itemHTML = (it, i) =>
      '<div class="borong-item" data-i="' + i + '">' +
        '<select class="bi-product" data-i="' + i + '"><option value="">-- Pilih produk --</option>' +
        opts.map(o => '<option value="' + o.value + '"' + (o.value === it.productId ? ' selected' : '') + '>' + U.esc(o.label) + '</option>').join('') + '</select>' +
        '<input class="bi-target" data-i="' + i + '" type="number" min="0" step="1" placeholder="Target" value="' + U.esc(it.targetQty || it.qty || 0) + '">' +
        '<input class="bi-qty" data-i="' + i + '" type="number" min="0" step="1" placeholder="Selesai" value="' + U.esc(it.qty) + '">' +
        '<input class="bi-rate" data-i="' + i + '" type="number" min="0" step="1000" placeholder="Rp/pcs" value="' + U.esc(it.rate) + '">' +
        '<input class="bi-ot" data-i="' + i + '" type="number" min="0" step="1000" placeholder="Lembur Rp" value="' + U.esc(it.overtime || 0) + '">' +
        '<strong class="bi-amount" data-i="' + i + '">' + U.rp(DB.borongItemTotal(it)) + '</strong>' +
        '<button type="button" class="btn btn-sm btn-danger bi-del" data-i="' + i + '">✕</button></div>';

    const sync = () => {
      U.$$('.borong-item', U.$('#modalRoot')).forEach(row => {
        const i = Number(row.dataset.i);
        const p = DB.get('products', U.$('.bi-product', row).value) || {};
        items[i] = {
          productId: p.id || '', sku: p.sku || '', name: p.name || '',
          targetQty: U.num(U.$('.bi-target', row).value),
          qty: U.num(U.$('.bi-qty', row).value),
          rate: U.num(U.$('.bi-rate', row).value),
          overtime: U.num(U.$('.bi-ot', row).value)
        };
      });
    };
    const recalc = () => {
      const target = U.sum(items, DB.borongItemTarget);
      const done = U.sum(items, it => U.num(it.qty));
      const subtotal = U.sum(items, DB.borongItemTotal);
      const extra = U.num(U.$('#borongExtra')?.value);
      U.$$('.bi-amount', U.$('#modalRoot')).forEach(el => {
        const it = items[Number(el.dataset.i)];
        if (it) el.textContent = U.rp(DB.borongItemTotal(it));
      });
      const el = U.$('#borongTotal');
      if (el) el.innerHTML =
        '<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Target barang</span><span>' + U.fmt(target) + ' pcs</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Selesai dikerjakan</span><span>' + U.fmt(done) + ' pcs</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Upah (selesai × tarif)</span><span>' + U.rp(subtotal) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:4px 0"><span>Tambahan lembur</span><span>' + U.rp(extra) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:700;font-size:16px;border-top:1px solid var(--border)"><span>TOTAL</span><span>' + U.rp(subtotal + extra) + '</span></div>';
    };
    const bindItems = () => {
      const m = U.$('#modalRoot');
      U.$$('.bi-product', m).forEach(sel => sel.addEventListener('change', () => {
        sync();
        const i = Number(sel.dataset.i), p = DB.get('products', sel.value) || {};
        items[i] = Object.assign({}, items[i], { productId: p.id || '', sku: p.sku || '', name: p.name || '', rate: rateOf(p, curType) });
        drawItems();
      }));
      U.$$('.bi-target, .bi-qty, .bi-rate, .bi-ot', m).forEach(inp => inp.addEventListener('input', () => { sync(); recalc(); }));
      U.$$('.bi-del', m).forEach(btn => btn.addEventListener('click', () => { sync(); items.splice(Number(btn.dataset.i), 1); drawItems(); }));
    };
    const drawItems = () => {
      const box = U.$('#borongItems');
      if (box) box.innerHTML = items.map(itemHTML).join('');
      bindItems(); recalc();
    };

    UI.openModal(UI.modalHead(assign ? 'Tugaskan Borong Harian' : (existing ? 'Edit Gaji Borong' : 'Catat Gaji Borong')) +
      '<form id="borongForm"><div class="modal-body">' +
      '<div class="notice">' + (assign
        ? 'Pilih <strong>Admin yang Menangani</strong> (mis. admin gudang yang memegang karyawan bernama Ulin), isi karyawan yang dipegang bila perlu, lalu <strong>Nama Pemborong</strong> penerima borong. Kolom <strong>Target</strong> = rencana, <strong>Selesai</strong> = realisasi. Owner memantau progres di tabel ini.'
        : 'Tarif per pcs otomatis diambil dari <strong>Database Produk</strong>. Kolom <strong>Selesai</strong> dipakai sebagai jumlah upah.') + '</div><br>' +
      '<div class="form-grid">' +
      '<div class="field"><label>Tanggal</label><input type="date" id="borongDate" required value="' + U.esc(existing ? existing.date : U.today()) + '"></div>' +
      '<div class="field"><label>Admin yang Menangani</label><select id="borongAdminId" required><option value="">-- Pilih admin --</option>' +
      adminOpts().map(a => '<option value="' + a.value + '"' + ((existing ? existing.handledById : (DB.currentUser() || {}).id) === a.value ? ' selected' : '') + '>' + U.esc(a.label) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Karyawan yang Dipegang</label><input type="text" id="borongWorker" placeholder="mis. Ulin (opsional)" value="' + U.esc(existing ? existing.workerName || '' : '') + '"></div>' +
      '<div class="field"><label>Nama Pemborong</label><input type="text" id="borongEmployeeName" list="dl_borongEmp" required placeholder="mis. Sinta Wulandari" value="' + U.esc(existing ? existing.employee : '') + '">' +
      '<datalist id="dl_borongEmp">' + borongNames().map(n => '<option value="' + U.esc(n) + '"></option>').join('') + '</datalist></div>' +
      '<div class="field"><label>Jenis Pekerjaan</label><select id="borongJobType"><option' + (curType === 'Amplas' ? ' selected' : '') + '>Amplas</option><option' + (curType === 'Packing' ? ' selected' : '') + '>Packing</option></select></div>' +
      '<div class="field"><label>Catatan</label><input type="text" id="borongNotes" placeholder="Opsional" value="' + U.esc(existing ? existing.notes || '' : '') + '"></div>' +
      '</div><div class="section-title">Barang yang Dikerjakan</div>' +
      '<div class="borong-head"><span>Produk</span><span>Target</span><span>Selesai</span><span>Rp/pcs</span><span>Lembur Rp</span><span>Jumlah</span><span></span></div>' +
      '<div id="borongItems"></div>' +
      '<button type="button" class="btn btn-sm" id="borongAddItem">+ Tambah Item</button>' +
      '<div class="form-grid" style="margin-top:14px"><div class="field"><label>Tambahan Lembur Lainnya (Rp)</label>' +
      '<input type="number" id="borongExtra" min="0" step="1000" value="' + U.esc(existing ? existing.overtimeExtra || 0 : 0) + '"></div></div>' +
      '<div id="borongTotal" style="max-width:360px;margin:14px 0 0 auto"></div>' +
      '</div><div class="modal-foot"><button type="button" class="btn" data-close>Batal</button>' +
      '<button type="submit" class="btn btn-primary">Simpan</button></div></form>', { wide: true });

    const m = U.$('#modalRoot');
    U.$('#borongJobType', m).addEventListener('change', e => {
      curType = e.target.value; sync();
      items.forEach(it => { const p = DB.get('products', it.productId) || {}; it.rate = rateOf(p, curType); });
      drawItems();
    });
    U.$('#borongExtra', m).addEventListener('input', recalc);
    U.$('#borongAddItem', m).addEventListener('click', () => {
      sync(); items.push({ productId: '', sku: '', name: '', targetQty: 1, qty: assign ? 0 : 1, rate: 0, overtime: 0 }); drawItems();
    });
    U.$('#borongForm', m).addEventListener('submit', e => {
      e.preventDefault(); sync();
      const employee = U.$('#borongEmployeeName', m).value.trim();
      if (!employee) { UI.toast('Nama pemborong wajib diisi', 'warning'); return; }
      const clean = items.filter(it => it.productId && U.num(it.targetQty) > 0);
      if (!clean.length) { UI.toast('Pilih minimal satu produk dengan target > 0', 'warning'); return; }
      const handledById = U.$('#borongAdminId', m).value;
      if (!handledById) { UI.toast('Admin yang menangani wajib dipilih', 'warning'); return; }
      const d = {
        date: U.$('#borongDate', m).value, handledById, handledByName: adminName(handledById),
        workerName: U.$('#borongWorker', m).value.trim(),
        employee, type: U.$('#borongJobType', m).value,
        items: clean, overtimeExtra: U.num(U.$('#borongExtra', m).value),
        notes: U.$('#borongNotes', m).value.trim()
      };
      if (existing) { DB.update('borong', existing.id, d); UI.toast('Data borong diperbarui', 'success'); }
      else { DB.insert('borong', d); UI.toast(assign ? 'Penugasan borong disimpan' : 'Gaji borong dicatat', 'success'); }
      UI.closeModal(); App.refresh();
    });
    drawItems();
  }

  function borongSlipHtml(week, extra) {
    const grand = week.subtotal + extra;
    const itemRows = week.items.map(it =>
      '<tr><td>' + U.dateID(it.date) + '</td><td>' + U.esc(it.handledByName || adminName(it.handledById)) + '</td>' +
      '<td>' + U.esc(it.type) + '</td><td>' + U.esc(it.sku) + '</td>' +
      '<td>' + U.esc(it.name) + '</td><td style="text-align:right">' + U.fmt(DB.borongItemTarget(it)) + '</td>' +
      '<td style="text-align:right">' + U.fmt(it.qty) + '</td>' +
      '<td style="text-align:right">' + U.rp(it.rate) + '</td>' +
      '<td style="text-align:right">' + U.rp(U.num(it.qty) * U.num(it.rate)) + '</td>' +
      '<td style="text-align:right">' + U.rp(it.overtime) + '</td>' +
      '<td style="text-align:right">' + U.rp(DB.borongItemTotal(it)) + '</td></tr>').join('');
    const recap = week.rows.map(b =>
      '<tr><td>' + U.dateID(b.date) + '</td><td>' + U.esc(b.handledByName || adminName(b.handledById)) + '</td>' +
      '<td>' + U.esc(b.type) + '</td><td>' + (b.items || []).length + ' item</td>' +
      '<td style="text-align:right">' + U.rp(U.sum(b.items || [], it => U.num(it.qty) * U.num(it.rate))) + '</td>' +
      '<td style="text-align:right">' + U.rp(U.sum(b.items || [], it => U.num(it.overtime)) + U.num(b.overtimeExtra)) + '</td>' +
      '<td style="text-align:right">' + U.rp(DB.borongTotal(b)) + '</td></tr>').join('');
    const line = (label, value, bold) => '<tr' + (bold ? ' style="font-weight:bold;background:#f1f5f9"' : '') + '><td>' + label + '</td><td style="text-align:right">' + U.rp(value) + '</td></tr>';
    return '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Slip Borong ' + U.esc(week.employee || 'Semua Orang') + '</title>' +
      '<style>' +
      'body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#1e293b}' +
      'h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 8px}' +
      '.head{display:flex;justify-content:space-between;border-bottom:2px solid #7a4a22;padding-bottom:12px;margin-bottom:16px}' +
      '.muted{color:#64748b;font-size:12px}table{border-collapse:collapse;width:100%;font-size:11px;margin-bottom:14px}' +
      'th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}th{background:#efe0cc}' +
      '.summary{width:340px;margin-left:auto}.sign{display:flex;justify-content:space-between;margin-top:44px;font-size:12px}' +
      '@media print{body{padding:10px}}' +
      '</style></head><body>' +
      '<div class="head"><div><h1>SLIP GAJI BORONG</h1><div class="muted">Amplas & Packing — CV Furniture Jati</div></div>' +
      '<div style="text-align:right"><strong>' + U.esc(week.employee || 'Semua Orang') + '</strong><br><span class="muted">Periode ' + U.dateID(week.start) + ' s/d ' + U.dateID(week.end) + '</span>' +
      (week.rows[0] ? '<br><span class="muted">Admin: ' + U.esc(week.rows[0].handledByName || '-') + (week.rows[0].workerName ? ' · Karyawan: ' + U.esc(week.rows[0].workerName) : '') + '</span>' : '') + '</div></div>' +
      '<h2>Rincian Barang per Orang</h2>' +
      '<table><thead><tr><th>Tanggal</th><th>Admin</th><th>Jenis</th><th>SKU</th><th>Produk</th><th>Target</th><th>Selesai</th><th>Tarif</th><th>Upah</th><th>Lembur</th><th>Jumlah</th></tr></thead>' +
      '<tbody>' + (itemRows || '<tr><td colspan="11" style="text-align:center">Tidak ada data pada periode ini</td></tr>') + '</tbody></table>' +
      '<h2>Rekap per Hari</h2>' +
      '<table><thead><tr><th>Tanggal</th><th>Admin</th><th>Jenis</th><th>Item</th><th>Upah Borong</th><th>Lembur</th><th>Total</th></tr></thead>' +
      '<tbody>' + (recap || '<tr><td colspan="7" style="text-align:center">-</td></tr>') + '</tbody></table>' +
      '<h2>Rekapitulasi</h2>' +
      '<table class="summary">' + line('Upah Borong', week.basic) + line('Lembur per Item', U.sum(week.items, it => U.num(it.overtime))) +
      line('Tambahan Lembur', extra) + line('TOTAL GAJI BORONG', grand, true) + '</table>' +
      '<div class="sign"><div>Diterima oleh,<br><br>_______________________</div><div>Dibayar oleh,<br><br>_______________________</div></div>' +
      '<p class="muted" style="margin-top:24px">Dicetak: ' + U.dateTime(new Date().toISOString()) + '</p>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>';
  }
  function printBorongSlip(week, extra) {
    printDocument(borongSlipHtml(week, extra), 'Slip borong disiapkan untuk dicetak');
  }

  function workMonitorHtml() {
    const d = state.monitorDate || U.today();
    const w = DB.dailyWorkSummary(d);
    const pct = (done, target) => target > 0 ? Math.min(100, Math.round(U.num(done) / U.num(target) * 100)) : 0;
    const bar = (done, target) => {
      const n = pct(done, target);
      return '<div style="display:flex;align-items:center;gap:6px"><div style="flex:1;background:var(--border);border-radius:8px;height:7px;overflow:hidden">' +
        '<div style="height:100%;width:' + n + '%;background:var(--primary)"></div></div><small>' + n + '%</small></div>';
    };
    const empty = (text, cols) => '<tr><td colspan="' + cols + '" style="text-align:center;color:var(--muted)">' + text + '</td></tr>';
    const prodRows = w.production.length ? w.production.map(r =>
      '<tr><td>' + U.esc(r.name) + '</td><td style="text-align:right">' + U.fmt(r.given) + '</td>' +
      '<td style="text-align:right"><strong>' + U.fmt(r.finished) + '</strong></td>' +
      '<td style="text-align:right">' + U.fmt(Math.max(0, r.given - r.finished)) + '</td>' +
      '<td style="min-width:110px">' + bar(r.finished, r.given) + '</td></tr>').join('') : empty('Belum ada distribusi produksi tanggal ini.', 5);
    const borongRows = w.borong.length ? w.borong.map(r =>
      '<tr><td>' + U.esc(r.admin) + '</td><td>' + (r.worker ? U.esc(r.worker) : '-') + '</td>' +
      '<td>' + U.esc(r.employee) + '</td><td>' + U.badge(r.type) + '</td>' +
      '<td style="text-align:right">' + U.fmt(r.target) + '</td>' +
      '<td style="text-align:right"><strong>' + U.fmt(r.done) + '</strong></td>' +
      '<td style="min-width:110px">' + bar(r.done, r.target) + '</td>' +
      '<td style="text-align:right">' + U.rp(r.wage) + '</td></tr>').join('') : empty('Belum ada tugas borong tanggal ini.', 8);
    return '<div class="card" style="margin-top:16px"><div class="card-head"><h3>📊 Pengawasan Harian Produksi & Pemborong</h3>' +
      '<input type="date" id="monitorDate" value="' + U.esc(d) + '" title="Tanggal pengawasan"></div><div class="card-body">' +
      '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:12px">' +
      '<div><div style="color:var(--muted);font-size:11px">Diberikan ke pengrajin</div><strong style="font-size:17px">' + U.fmt(w.given) + ' pcs</strong></div>' +
      '<div><div style="color:var(--muted);font-size:11px">Selesai pengrajin</div><strong style="font-size:17px">' + U.fmt(w.finished) + ' pcs</strong></div>' +
      '<div><div style="color:var(--muted);font-size:11px">Target borong</div><strong style="font-size:17px">' + U.fmt(w.target) + ' pcs</strong></div>' +
      '<div><div style="color:var(--muted);font-size:11px">Selesai borong</div><strong style="font-size:17px">' + U.fmt(w.done) + ' pcs</strong></div>' +
      '<div><div style="color:var(--muted);font-size:11px">Upah borong</div><strong style="font-size:17px">' + U.rp(w.wage) + '</strong></div>' +
      '</div><div class="grid grid-2">' +
      '<div><div class="section-title">Produksi — Pengrajin</div><div style="overflow:auto"><table><thead><tr><th>Nama</th><th>Diberikan</th><th>Selesai</th><th>Sisa</th><th>Progres</th></tr></thead><tbody>' + prodRows + '</tbody></table></div></div>' +
      '<div><div class="section-title">Borong — Amplas / Packing</div><div style="overflow:auto"><table><thead><tr><th>Admin</th><th>Karyawan</th><th>Pemborong</th><th>Jenis</th><th>Target</th><th>Selesai</th><th>Progres</th><th>Upah</th></tr></thead><tbody>' + borongRows + '</tbody></table></div></div>' +
      '</div></div></div>';
  }

  const borong = {
    render() {
      const names = borongNames();
      if (!state.slipBorongEmployee && names.length) state.slipBorongEmployee = names[0];
      if (!state.slipBorongWeek) state.slipBorongWeek = weekStart(U.today());
      let rows = DB.all('borong').filter(b =>
        (!state.borongFrom || b.date >= state.borongFrom) && (!state.borongTo || b.date <= state.borongTo));
      rows = filterRows(rows, state.borongQ, ['employee', 'handledByName', 'workerName', 'date', 'type', 'notes']);
      if (state.borongEmployee) rows = rows.filter(b => b.employee === state.borongEmployee);
      if (state.borongAdmin) rows = rows.filter(b => b.handledById === state.borongAdmin);
      if (state.borongType) rows = rows.filter(b => b.type === state.borongType);
      rows.sort((a, b) => b.date.localeCompare(a.date));

      const today = DB.borongSummary(U.today());
      const week = DB.borongWeek(state.slipBorongEmployee, state.slipBorongWeek);
      const extra = U.num(state.slipBorongExtra);
      const nameOpts = names.map(n => '<option value="' + U.esc(n) + '"' + (n === state.slipBorongEmployee ? ' selected' : '') + '>' + U.esc(n) + '</option>').join('');
      const filterNames = names.map(n => '<option value="' + U.esc(n) + '"' + (n === state.borongEmployee ? ' selected' : '') + '>' + U.esc(n) + '</option>').join('');
      const filterAdmins = adminOpts().map(a => '<option value="' + a.value + '"' + (state.borongAdmin === a.value ? ' selected' : '') + '>' + U.esc(a.label) + '</option>').join('');
      const canEdit = can('borong.update') || can('payroll.edit');
      const canCreate = can('borong.create') || can('payroll.edit');
      const canAssign = can('borong.assign');

      return UI.pageHead('Tugas & Gaji Borong Amplas / Packing', 'Admin produksi menugaskan harian; owner memantau target, realisasi, dan upah',
        (canAssign ? '<button class="btn btn-primary" data-act="assignBorong">+ Tugaskan Borong Harian</button>' : '') +
        (canCreate ? '<button class="btn" data-act="addBorong">+ Catat Gaji</button>' : '') +
        '<button class="btn" data-act="printBorong">🖨️ Cetak Slip Borong</button>') +
        '<div class="grid grid-stats">' +
        UI.statCard({ label: 'Selesai / Target', value: U.fmt(today.done) + ' / ' + U.fmt(today.target), sub: 'pcs hari ini', icon: '✅' }) +
        UI.statCard({ label: 'Total Upah Borong', value: U.rp(today.total), sub: U.dateID(U.today()), icon: '💰' }) +
        UI.statCard({ label: 'Amplas', value: U.rp(today.amplas), sub: 'hari ini', icon: '🪵' }) +
        UI.statCard({ label: 'Packing', value: U.rp(today.packing), sub: 'hari ini', icon: '📦' }) +
        '</div><br>' + workMonitorHtml() + '<br>' +
        '<div class="card"><div class="card-head"><h3>Tugas & Catatan Borong</h3><span style="display:flex;gap:8px">' +
        '<button class="btn btn-sm" data-act="borongExcel">⬇ Excel</button><button class="btn btn-sm" data-act="borongPdf">⬇ PDF</button></span></div><div class="card-body">' +
        '<div class="toolbar"><input id="borongQ" placeholder="Cari admin / karyawan / pemborong..." value="' + U.esc(state.borongQ) + '">' +
        '<input type="date" id="borongFrom" value="' + U.esc(state.borongFrom) + '">' +
        '<input type="date" id="borongTo" value="' + U.esc(state.borongTo) + '">' +
        '<select id="borongAdmin"><option value="">Semua admin</option>' + filterAdmins + '</select>' +
        '<select id="borongEmployee"><option value="">Semua pemborong</option>' + filterNames + '</select>' +
        '<select id="borongType"><option value="">Semua jenis</option>' + ['Amplas', 'Packing'].map(x => '<option' + (state.borongType === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>' +
        '<div class="spacer"></div><strong>Total: ' + U.rp(U.sum(rows, DB.borongTotal)) + '</strong></div>' +
        UI.table({
          columns: [
            { label: 'Tanggal', render: r => U.dateID(r.date) },
            { label: 'Admin yang Menangani', render: r => U.esc(r.handledByName || adminName(r.handledById)) },
            { label: 'Karyawan yang Dipegang', render: r => U.esc(r.workerName || '-') },
            { label: 'Nama Pemborong', key: 'employee' },
            { label: 'Jenis', render: r => U.badge(r.type) },
            { label: 'Barang (selesai / target)', render: r => (r.items || []).map(it => U.esc(it.name) + ' × ' + U.fmt(it.qty) + ' / ' + U.fmt(DB.borongItemTarget(it))).join('<br>') || '-' },
            { label: 'Upah Borong', align: 'right', render: r => U.rp(U.sum(r.items || [], it => U.num(it.qty) * U.num(it.rate))) },
            { label: 'Lembur', align: 'right', render: r => U.rp(U.sum(r.items || [], it => U.num(it.overtime)) + U.num(r.overtimeExtra)) },
            { label: 'Total', align: 'right', render: r => '<strong>' + U.rp(DB.borongTotal(r)) + '</strong>' },
            { label: 'Catatan', key: 'notes' }
          ], rows,
          actions: canEdit ? [{ label: 'Edit', act: 'editBorong' }, { label: 'Hapus', act: 'delBorong', cls: 'danger' }] : [],
          empty: 'Belum ada tugas borong. Klik "+ Tugaskan Borong Harian".'
        }) + '</div></div><br>' +
        '<div class="card"><div class="card-head"><h3>🧾 Slip Gaji Borong per Orang</h3><span class="badge badge-blue">' + U.dateID(week.start) + ' — ' + U.dateID(week.end) + '</span></div><div class="card-body">' +
        '<div class="form-grid">' +
        '<div class="field"><label>Orang</label><select id="slipBorongEmployee">' + nameOpts + '</select></div>' +
        '<div class="field"><label>Mulai Pekan (Senin)</label><input type="date" id="slipBorongWeek" value="' + U.esc(state.slipBorongWeek) + '"></div>' +
        '<div class="field"><label>Tambahan Lembur Lainnya (Rp)</label><input type="number" id="slipBorongExtra" min="0" step="1000" value="' + extra + '"></div>' +
        '</div><div style="margin-top:14px">' + UI.table({
          columns: [
            { label: 'Tanggal', render: r => U.dateID(r.date) },
            { label: 'Jenis', key: 'type' },
            { label: 'SKU', key: 'sku' },
            { label: 'Barang', key: 'name' },
            { label: 'Selesai', align: 'right', render: r => U.fmt(r.qty) },
            { label: 'Tarif', align: 'right', render: r => U.rp(r.rate) },
            { label: 'Upah', align: 'right', render: r => U.rp(U.num(r.qty) * U.num(r.rate)) },
            { label: 'Lembur', align: 'right', render: r => U.rp(r.overtime) },
            { label: 'Jumlah', align: 'right', render: r => '<strong>' + U.rp(DB.borongItemTotal(r)) + '</strong>' }
          ], rows: week.items, empty: 'Tidak ada borong pada pekan ini.'
        }) + '</div>' +
        '<div id="borongSlipTotals" style="margin-top:14px">' + borong.totalsHtml(week, extra) + '</div>' +
        '</div></div>';
    },
    totalsHtml(week, extra) {
      const line = (label, value, bold) => '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)' + (bold ? ';font-weight:bold;font-size:16px;border-bottom:none' : '') + '"><span>' + label + '</span><span>' + U.rp(value) + '</span></div>';
      return '<div style="max-width:380px;margin-left:auto">' +
        line('Upah Borong', week.basic) +
        line('Lembur per Item', U.sum(week.items, it => U.num(it.overtime))) +
        line('Tambahan Lembur', extra) +
        line('TOTAL GAJI BORONG', week.subtotal + extra, true) + '</div>';
    },
    bind(root) {
      const refresh = () => { App.refresh(); const el = U.$('#borongQ'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
      U.$('#borongQ', root).addEventListener('input', e => { state.borongQ = e.target.value; refresh(); });
      ['#borongFrom:borongFrom', '#borongTo:borongTo', '#borongAdmin:borongAdmin', '#borongEmployee:borongEmployee', '#borongType:borongType',
        '#monitorDate:monitorDate', '#slipBorongEmployee:slipBorongEmployee', '#slipBorongWeek:slipBorongWeek'].forEach(pair => {
        const [sel, key] = pair.split(':');
        const el = U.$(sel, root); if (el) el.addEventListener('change', e => { state[key] = e.target.value; App.refresh(); });
      });
      const week = DB.borongWeek(state.slipBorongEmployee, state.slipBorongWeek);
      const recalc = () => {
        const extra = U.num(U.$('#slipBorongExtra', root)?.value);
        state.slipBorongExtra = extra;
        const el = U.$('#borongSlipTotals', root);
        if (el) el.innerHTML = borong.totalsHtml(week, extra);
      };
      const extraEl = U.$('#slipBorongExtra', root); if (extraEl) extraEl.addEventListener('input', recalc);
      recalc();

      U.$$('[data-act]', root).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        const canEditRow = can('borong.update') || can('payroll.edit');
        if (act === 'assignBorong') { if (can('borong.assign')) borongForm(null, 'assign'); }
        if (act === 'addBorong') { if (can('borong.create') || can('payroll.edit')) borongForm(null); }
        if (act === 'editBorong') { const x = DB.get('borong', b.dataset.id); if (x && canEditRow) borongForm(x); }
        if (act === 'delBorong') {
          const x = DB.get('borong', b.dataset.id);
          if (x && canEditRow) UI.confirm('Hapus catatan borong ' + x.employee + ' tanggal ' + U.dateID(x.date) + '?', () => {
            DB.remove('borong', x.id); UI.toast('Dihapus', 'success'); App.refresh();
          }, true);
        }
        if (act === 'printBorong') printBorongSlip(DB.borongWeek(state.slipBorongEmployee, state.slipBorongWeek), U.num(state.slipBorongExtra));
        if (act === 'borongExcel' || act === 'borongPdf') {
          const header = ['Tanggal', 'Admin yang Menangani', 'Karyawan yang Dipegang', 'Nama Pemborong', 'Jenis', 'SKU', 'Produk', 'Target', 'Selesai', 'Tarif', 'Lembur Item', 'Upah', 'Tambahan Lembur', 'Total', 'Catatan'];
          const body = [];
          DB.all('borong').sort((a, b) => b.date.localeCompare(a.date)).forEach(x => {
            const admin = x.handledByName || adminName(x.handledById);
            if (!(x.items || []).length) body.push([U.dateID(x.date), admin, x.workerName || '', x.employee, x.type, '', '', '', '', '', '', '', x.overtimeExtra || 0, DB.borongTotal(x), x.notes || '']);
            (x.items || []).forEach(it => body.push([
              U.dateID(x.date), admin, x.workerName || '', x.employee, x.type, it.sku, it.name, DB.borongItemTarget(it), it.qty, it.rate, it.overtime || 0,
              U.num(it.qty) * U.num(it.rate), x.overtimeExtra || 0, DB.borongTotal(x), x.notes || ''
            ]));
          });
          const rows = [header].concat(body);
          if (act === 'borongExcel') U.exportExcel('laporan-gaji-borong', rows); else U.exportPDF('Laporan Gaji Borong', rows);
        }
      }));
    }
  };

  /* ================= IMPORT EXCEL / CSV ================= */
  const impState = {
    fileName: '', sheet: '', headerRow: 1, sheets: [], headers: [], rows: [],
    mode: 'mutasi', mapping: {}, result: null, busy: false
  };
  let impWorkbook = null;

  const impAliases = {
    tanggal: ['tanggal', 'tgl', 'date', 'tanggaltransaksi', 'tanggalmasuk', 'tanggalkeluar'],
    jenis: ['jenis', 'type', 'tipe', 'transaksi', 'mutasi', 'jenistransaksi', 'status'],
    sku: ['sku', 'kode', 'kodeproduk', 'kdproduk', 'code', 'itemcode', 'kodebarang', 'no'],
    nama: ['nama', 'namaproduk', 'product', 'productname', 'item', 'itemname', 'deskripsi', 'description', 'barang', 'namabarang'],
    kategori: ['kategori', 'category', 'jenisbarang', 'group', 'kelompok'],
    ukuran: ['ukuran', 'size', 'dimensi', 'dimension', 'spec'],
    qty: ['qty', 'jumlah', 'quantity', 'jumlahbarang', 'pcs', 'unit', 'volume', 'jumlahmasuk', 'jumlahkeluar'],
    supplier: ['supplier', 'penyuplai', 'vendor', 'dari', 'from', 'asal', 'namasupplier', 'supplierdari'],
    tujuan: ['tujuan', 'destination', 'ke', 'to', 'customer', 'buyer', 'penerima', 'namacustomer', 'tujuanke'],
    petugas: ['petugas', 'receiver', 'staff', 'pic', 'admin', 'operator', 'petugasgudang'],
    kondisi: ['kondisi', 'condition', 'statusbarang', 'kualitas'],
    suratJalan: ['suratjalan', 'nosuratjalan', 'sj', 'nosj', 'no Surat jalan'],
    status: ['status', 'statusproduk', 'posisi'],
    minStock: ['minstock', 'stokminimum', 'minimum', 'min'],
    initial: ['stockawal', 'stokawal', 'saldoawal', 'awal', 'beginning'],
    inTotal: ['masuk', 'totalmasuk', 'jumlahmasuk'],
    outTotal: ['keluar', 'totalkeluar', 'jumlahkeluar'],
    final: ['stockakhir', 'stokakhir', 'akhir', 'ending'],
    keterangan: ['keterangan', 'catatan', 'notes', 'note', 'remark', 'memo']
  };

  const impModeFields = {
    stok: [],
    mutasi: ['tanggal', 'jenis', 'sku', 'nama', 'qty', 'supplier', 'tujuan', 'petugas', 'kondisi', 'suratJalan', 'kategori', 'ukuran', 'keterangan'],
    inbound: ['tanggal', 'sku', 'nama', 'qty', 'supplier', 'petugas', 'kondisi', 'kategori', 'ukuran', 'keterangan'],
    outbound: ['tanggal', 'sku', 'nama', 'qty', 'tujuan', 'petugas', 'suratJalan', 'kategori', 'ukuran', 'keterangan'],
    products: ['sku', 'nama', 'kategori', 'ukuran', 'status', 'minStock', 'keterangan']
  };
  const impFieldLabel = {
    tanggal: 'Tanggal', jenis: 'Jenis (Masuk/Keluar)', sku: 'SKU / Kode Produk', nama: 'Nama Produk',
    qty: 'Jumlah / Qty', supplier: 'Supplier / Dari', tujuan: 'Tujuan / Customer', petugas: 'Petugas',
    kondisi: 'Kondisi', suratJalan: 'No. Surat Jalan', kategori: 'Kategori', ukuran: 'Ukuran',
    status: 'Status Produk', minStock: 'Stok Minimum', keterangan: 'Keterangan'
  };

  function impNorm(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function impGuess(headers, field) {
    const aliases = (impAliases[field] || []).map(impNorm);
    return headers.find(h => aliases.includes(impNorm(h))) || '';
  }
  function impDate(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
    if (typeof v === 'number') {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
    const d = new Date(s);
    return isNaN(d) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function impVal(row, field) {
    const key = impState.mapping[field];
    return key ? (row[key] === undefined || row[key] === null ? '' : row[key]) : '';
  }
  function impParseSheet() {
    if (!impWorkbook || !impState.sheet) return;
    const ws = impWorkbook.Sheets[impState.sheet];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: true });
    const hi = Math.max(0, U.num(impState.headerRow) - 1);
    const headers = (aoa[hi] || []).map((h, i) => String(h || '').trim() || ('Kolom ' + (i + 1)));
    impState.headers = headers;
    impState.rows = aoa.slice(hi + 1).map(arr => {
      const o = {}; headers.forEach((h, i) => o[h] = arr[i]); return o;
    }).filter(r => Object.values(r).some(v => String(v || '').trim() !== ''));
    impState.mapping = {};
    impModeFields[impState.mode].forEach(f => { impState.mapping[f] = impGuess(headers, f); });
    impState.result = null;
  }

  function impIsErr(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'number' && (v < -2000000000 || v > 2000000000)) return true;
    const s = String(v).trim();
    return /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!)$/i.test(s) || /^-?2146826\d{3}$/.test(s);
  }
  function impVal2(row, map, field) {
    const k = map[field];
    return k ? (row[k] === undefined || row[k] === null ? '' : row[k]) : '';
  }
  function impMapHeaders(headers) {
    const m = {};
    Object.keys(impAliases).forEach(f => { m[f] = impGuess(headers, f); });
    return m;
  }
  function impFindSheet(headerKeys) {
    if (!impWorkbook || !window.XLSX) return null;
    for (const name of impWorkbook.SheetNames) {
      const ws = impWorkbook.Sheets[name];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false, raw: true });
      for (let i = 0; i < Math.min(aoa.length, 12); i++) {
        const norm = (aoa[i] || []).map(h => impNorm(h));
        if (!headerKeys.every(k => norm.some(h => h.includes(k)))) continue;
        const headers = (aoa[i] || []).map((h, j) => String(h || '').trim() || ('Kolom ' + (j + 1)));
        const rows = aoa.slice(i + 1).map((arr, j) => {
          const o = {}; headers.forEach((h, c) => o[h] = arr[c]);
          o.__excelRow = i + j + 2;
          return o;
        }).filter(r => Object.keys(r).some(k => k !== '__excelRow' && !impIsErr(r[k]) && String(r[k] || '').trim() !== ''));
        return { name, headers, rows, mapping: impMapHeaders(headers) };
      }
    }
    return null;
  }
  function impWorkbookInfo() {
    return [
      ['Produk', ['kode', 'nama', 'stockawal']],
      ['Barang masuk', ['tanggal', 'kode', 'jumlahmasuk']],
      ['Barang keluar', ['tanggal', 'kode', 'jumlahkeluar']]
    ].map(d => {
      const info = impFindSheet(d[1]);
      return { label: d[0], name: info ? info.name : '-', rows: info ? info.rows.length : 0 };
    });
  }

  function impImportWorkbook() {
    const res = { products: 0, saldoAwal: 0, inbound: 0, outbound: 0, flagged: 0, skipped: 0, errors: [] };
    const pInfo = impFindSheet(['kode', 'nama', 'stockawal']);
    const iInfo = impFindSheet(['tanggal', 'kode', 'jumlahmasuk']);
    const oInfo = impFindSheet(['tanggal', 'kode', 'jumlahkeluar']);
    if (!pInfo && !iInfo && !oInfo) { res.errors.push('Sheet DAFTAR PRODUK / PRODUK MASUK / PRODUK KELUAR tidak ditemukan.'); return res; }

    const now = new Date().toISOString();
    const byKey = {};
    DB.all('products').forEach(p => { byKey[impNorm(p.sku)] = p; });
    const ensureProduct = (sku, name, note) => {
      const key = impNorm(sku);
      if (!key) return null;
      let p = byKey[key];
      if (!p) {
        p = DB.insert('products', {
          sku: sku, name: name || sku, category: 'Lainnya', size: '', status: 'Gudang', minStock: 0,
          photo: DB.svgPhoto('📦', '#f1f5f9'), notes: note || 'Diimpor dari Excel', createdAt: now
        });
        byKey[key] = p; res.products++;
      }
      return p;
    };
    const dup = (table, tag) => impState.skipDuplicate !== false && DB.all(table).some(x => x.notes === tag);

    const dates = [];
    [iInfo, oInfo].forEach(info => {
      if (!info) return;
      let last = '';
      info.rows.forEach(r => {
        const d = impDate(impVal2(r, info.mapping, 'tanggal'));
        if (d) last = d;
        if (last) dates.push(last);
      });
    });
    dates.sort();
    const baseDate = dates[0] || U.today();

    if (pInfo) pInfo.rows.forEach(r => {
      const rawSku = impVal2(r, pInfo.mapping, 'sku');
      const sku = String(rawSku || '').trim();
      if (!sku || impIsErr(rawSku)) { res.skipped++; return; }
      const key = impNorm(sku);
      const name = String(impVal2(r, pInfo.mapping, 'nama') || '').trim();
      const initial = U.num(impVal2(r, pInfo.mapping, 'initial'));
      let p = ensureProduct(sku, name, 'Diimpor dari DAFTAR PRODUK');
      if (!p) return;
      const patch = {};
      if (p.sku !== sku) patch.sku = sku;
      if (name && p.name !== name) patch.name = name;
      if (!String(p.notes || '').includes('DAFTAR PRODUK')) patch.notes = 'Diimpor dari DAFTAR PRODUK';
      if (Object.keys(patch).length) {
        delete byKey[key];
        p = DB.update('products', p.id, patch);
        byKey[impNorm(p.sku)] = p;
      }
      if (initial <= 0) return;
      const tag = 'IMPORT|SALDO_AWAL|' + impState.fileName + '|' + p.sku;
      if (dup('inbound', tag)) { res.skipped++; return; }
      DB.insert('inbound', {
        date: baseDate, productId: p.id, sku: p.sku, productName: p.name, qty: initial,
        supplier: 'SALDO AWAL', condition: 'Baik', receiver: '-', notes: tag, createdAt: now
      });
      res.saldoAwal++;
    });

    let check = null;
    if (iInfo) {
      let lastDate = '', lastSupplier = '';
      iInfo.rows.forEach(r => {
        const qty = U.num(impVal2(r, iInfo.mapping, 'qty'));
        if (qty <= 0) return;
        const d = impDate(impVal2(r, iInfo.mapping, 'tanggal'));
        if (d) lastDate = d;
        const sup = impVal2(r, iInfo.mapping, 'supplier');
        if (String(sup || '').trim() && !impIsErr(sup)) lastSupplier = String(sup).trim();
        const date = lastDate || U.today();
        const supplier = lastSupplier || '-';
        const rawSku = impVal2(r, iInfo.mapping, 'sku');
        const rawName = impVal2(r, iInfo.mapping, 'nama');
        const bad = impIsErr(rawSku) || impIsErr(rawName) || !String(rawSku || '').trim();
        if (bad && !check) check = ensureProduct('CEK-SKU', 'SKU TIDAK DIKETAHUI (CEK EXCEL)', 'Perlu dicek: baris tanpa SKU / #N/A dari sheet PRODUK MASUK.');
        const p = bad ? check : ensureProduct(String(rawSku).trim(), String(rawName || '').trim(), 'Diimpor dari PRODUK MASUK');
        if (!p) { res.errors.push('Baris ' + r.__excelRow + ': produk tidak dibuat'); return; }
        const tag = 'IMPORT|MASUK|' + impState.fileName + '|' + r.__excelRow + '|' + p.sku + '|' + qty;
        if (dup('inbound', tag)) { res.skipped++; return; }
        DB.insert('inbound', {
          date, productId: p.id, sku: p.sku, productName: p.name, qty, supplier,
          condition: 'Baik', receiver: '-',
          notes: tag + (bad ? ' | PERLU DICEK: SKU #N/A / kosong' : ''), createdAt: now
        });
        res.inbound++;
        if (bad) {
          res.flagged++;
          const fresh = DB.get('products', p.id) || p;
          DB.update('products', p.id, {
            notes: String((fresh.notes || '') + ' | Baris ' + r.__excelRow + ': qty ' + qty + ', supplier ' + supplier).slice(0, 2000)
          });
        }
      });
    }

    if (oInfo) {
      let lastDate = '';
      oInfo.rows.forEach(r => {
        const qty = U.num(impVal2(r, oInfo.mapping, 'qty'));
        if (qty <= 0) return;
        const d = impDate(impVal2(r, oInfo.mapping, 'tanggal'));
        if (d) lastDate = d;
        const rawSku = impVal2(r, oInfo.mapping, 'sku');
        if (impIsErr(rawSku) || !String(rawSku || '').trim()) { res.skipped++; return; }
        const p = ensureProduct(String(rawSku).trim(), String(impVal2(r, oInfo.mapping, 'nama') || '').trim(), 'Diimpor dari PRODUK KELUAR');
        if (!p) { res.errors.push('Baris ' + r.__excelRow + ': produk tidak dibuat'); return; }
        const tag = 'IMPORT|KELUAR|' + impState.fileName + '|' + r.__excelRow + '|' + p.sku + '|' + qty;
        if (dup('outbound', tag)) { res.skipped++; return; }
        DB.insert('outbound', {
          date: lastDate || U.today(), type: 'Customer', productId: p.id, sku: p.sku, productName: p.name,
          qty, destination: '-', artisanReceiver: '-', suratJalan: '-', staff: '-', notes: tag, createdAt: now
        });
        res.outbound++;
      });
    }
    return res;
  }

  const importView = {
    render() {
      return UI.pageHead('Import Excel / CSV', 'Impor dataproduk, barang masuk, dan barang keluar dari file Excel Anda',
        '<button class="btn" id="impTemplate">⬇ Unduh Template</button>') +
        '<div id="importArea">' + this.area() + '</div>';
    },
    area() {
      const s = impState;
      if (!s.rows.length) {
        return '<div class="card"><div class="card-head"><h3>1. Pilih File Excel</h3></div><div class="card-body">' +
          '<div class="notice">Format didukung: <strong>.xlsx, .xls, .csv</strong>. Baris pertama sheet dianggap sebagai header (bisa diatur). Mapping kolom bisa diubah sebelum import.</div><br>' +
          '<input type="file" id="impFile" accept=".xlsx,.xls,.csv,.ods">' +
          '<p class="hint" style="margin-top:10px">Belum ada file dipilih. ' + (s.fileName ? 'Terakhir: ' + U.esc(s.fileName) : '') + '</p>' +
          '</div></div>';
      }
      const sel = (field) => '<select data-imp-map="' + field + '"><option value="">— tidak ada —</option>' +
        s.headers.map(h => '<option value="' + U.esc(h) + '"' + (s.mapping[field] === h ? ' selected' : '') + '>' + U.esc(h) + '</option>').join('') + '</select>';
      const mapping = impModeFields[s.mode].map(f =>
        '<div class="field"><label>' + impFieldLabel[f] + '</label>' + sel(f) + '</div>').join('');
      const preview = s.rows.slice(0, 8).map(r => '<tr>' + s.headers.map(h =>
        '<td>' + U.esc(typeof r[h] === 'string' ? r[h].slice(0, 40) : (r[h] instanceof Date ? U.dateID(impDate(r[h])) : r[h])) + '</td>').join('') + '</tr>').join('');
      const result = s.result ? '<div class="notice ' + (s.result.errors.length ? 'error' : '') + '"><strong>Hasil import:</strong> ' +
        'Produk baru: ' + s.result.products + ' · Saldo awal: ' + (s.result.saldoAwal || 0) +
        ' · Barang masuk: ' + s.result.inbound + ' · Barang keluar: ' + s.result.outbound +
        ' · Perlu dicek: ' + (s.result.flagged || 0) +
        ' · Dilewati: ' + s.result.skipped + ' · Error: ' + s.result.errors.length +
        (s.result.errors.length ? '<br>' + s.result.errors.slice(0, 5).map(U.esc).join('<br>') : '') + '</div><br>' : '';
      const isStok = s.mode === 'stok';
      const step3 = isStok
        ? '<div class="card"><div class="card-head"><h3>3. Sheet yang terdeteksi</h3><span class="badge badge-green">Otomatis</span></div><div class="card-body">' +
          impWorkbookInfo().map(x => '<div style="padding:6px 0;border-bottom:1px solid #e2e8f0"><strong>' + x.label + '</strong>: ' +
            U.esc(x.name) + ' <span class="badge badge-blue">' + x.rows + ' baris</span></div>').join('') +
          '<p class="hint" style="margin-top:10px">Saldo awal dibuat sebagai transaksi masuk bertanda <code>SALDO AWAL</code> pada tanggal transaksi pertama. Tanggal & supplier kosong diisi dari baris sebelumnya. Baris tanpa SKU/#N/A masuk ke produk <strong>SKU TIDAK DIKETAHUI (CEK EXCEL)</strong>.</p>' +
          '</div></div><br>'
        : '<div class="card"><div class="card-head"><h3>3. Mapping Kolom</h3><span class="badge badge-green">' + s.rows.length + ' baris terbaca</span></div><div class="card-body">' +
          '<div class="form-grid">' + mapping + '</div></div></div><br>';

      return result +
        '<div class="card"><div class="card-head"><h3>1. File & Sheet</h3><span class="badge badge-blue">' + U.esc(s.fileName) + '</span></div><div class="card-body">' +
        '<div class="form-grid">' +
        '<div class="field"><label>Sheet</label><select id="impSheet">' + s.sheets.map(sh =>
          '<option value="' + U.esc(sh) + '"' + (sh === s.sheet ? ' selected' : '') + '>' + U.esc(sh) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>Baris header ke-</label><input type="number" id="impHeaderRow" min="1" max="50" value="' + U.num(s.headerRow) + '"></div>' +
        '</div><div style="margin-top:10px"><input type="file" id="impFile" accept=".xlsx,.xls,.csv,.ods"></div>' +
        '</div></div><br>' +
        '<div class="card"><div class="card-head"><h3>2. Mode Import</h3></div><div class="card-body">' +
        '<div class="form-grid">' +
        [['stok', 'Workbook Stok Lengkap (3 sheet)'], ['mutasi', 'Otomatis: produk + masuk/keluar'], ['inbound', 'Barang masuk saja'], ['outbound', 'Barang keluar saja'], ['products', 'Database produk saja']]
          .map(m => '<div class="field"><label style="display:flex;gap:8px;align-items:center">' +
            '<input type="radio" name="impMode" value="' + m[0] + '"' + (s.mode === m[0] ? ' checked' : '') + ' style="width:auto"> ' + m[1] + '</label></div>').join('') +
        '</div><p class="hint" style="margin-top:10px">Mode <strong>Workbook Stok Lengkap</strong> otomatis membaca sheet <em>DAFTAR PRODUK</em>, <em>PRODUK MASUK</em>, dan <em>PRODUK KELUAR</em>, termasuk saldo awal, tanggal/supplier yang kosong (diisi dari baris atas), serta baris <code>#N/A</code> tanpa SKU (ditandai "SKU TIDAK DIKETAHUI"). Mode "Otomatis" untuk file dengan satu sheet dan kolom <strong>Jenis</strong>.</p>' +
        '</div></div><br>' +
        step3 +
        '<div class="card"><div class="card-head"><h3>4. Preview (8 baris pertama)</h3></div><div class="card-body">' +
        '<div class="table-wrap"><table class="data-table"><thead><tr>' + s.headers.map(h => '<th>' + U.esc(h) + '</th>').join('') +
        '</tr></thead><tbody>' + preview + '</tbody></table></div>' +
        '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" id="impRun"' + (s.busy || !can('import.create') ? ' disabled' : '') + '>' + (s.busy ? 'Mengimpor...' : '⬆️ Import ' + (isStok ? 'Workbook Stok' : s.rows.length + ' Baris')) + '</button>' +
        '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="impSkipDuplicate"' + (s.skipDuplicate !== false ? ' checked' : '') + ' style="width:auto"> Lewati duplikat</label>' +
        '</div></div></div>';
    },
    bind(root) { this.bindArea(root); },
    bindArea(root) {
      const self = this;
      const area = () => U.$('#importArea', root);
      const rebind = () => { area().innerHTML = self.area(); self.bindArea(root); };

      const file = U.$('#impFile', root);
      if (file) file.addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        if (!window.XLSX) { UI.toast('Library Excel belum termuat. Periksa internet lalu refresh.', 'error'); return; }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            impWorkbook = XLSX.read(new Uint8Array(reader.result), { type: 'array', cellDates: true });
            impState.fileName = f.name;
            impState.sheets = impWorkbook.SheetNames;
            impState.sheet = impWorkbook.SheetNames[0];
            impState.headerRow = 1;
            impParseSheet();
            rebind();
            UI.toast('File terbaca: ' + impState.rows.length + ' baris', 'success');
          } catch (err) { UI.toast('Gagal membaca file: ' + err.message, 'error'); }
        };
        reader.readAsArrayBuffer(f);
      });

      const sheet = U.$('#impSheet', root);
      if (sheet) sheet.addEventListener('change', e => { impState.sheet = e.target.value; impParseSheet(); rebind(); });
      const hr = U.$('#impHeaderRow', root);
      if (hr) hr.addEventListener('change', e => { impState.headerRow = Math.max(1, U.num(e.target.value)); impParseSheet(); rebind(); });
      U.$$('[data-imp-map]', root).forEach(sel => sel.addEventListener('change', e => {
        impState.mapping[e.target.dataset.impMap] = e.target.value;
      }));
      U.$$('input[name=impMode]', root).forEach(r => r.addEventListener('change', e => {
        impState.mode = e.target.value; impParseSheet(); rebind();
      }));
      const skip = U.$('#impSkipDuplicate', root);
      if (skip) skip.addEventListener('change', e => { impState.skipDuplicate = e.target.checked; });

      const tmpl = U.$('#impTemplate', root);
      if (tmpl) tmpl.addEventListener('click', () => {
        const headers = ['Tanggal', 'Jenis', 'SKU', 'Nama Produk', 'Kategori', 'Ukuran', 'Jumlah', 'Supplier/Dari', 'Tujuan/Ke', 'Petugas', 'Kondisi', 'No. Surat Jalan', 'Keterangan'];
        U.exportExcel('template-import-stok', [headers,
          [U.today(), 'Masuk', 'ST001', 'Meja Makan Jati', 'Meja', '180 x 90 cm', 10, 'CV Jati Utama', '', 'Budi', 'Baik', '', 'Stok awal'],
          [U.today(), 'Keluar', 'ST001', 'Meja Makan Jati', 'Meja', '180 x 90 cm', 2, '', 'Toko ABC', 'Budi', 'Baik', 'SJ/001', 'Kirim customer']
        ], 'Template Import');
      });

      const run = U.$('#impRun', root);
      if (run) run.addEventListener('click', () => {
        if (!can('import.create')) return;
        impState.busy = true; rebind();
        const s = impState;
        if (s.mode === 'stok') {
          const res = impImportWorkbook();
          impState.result = res;
          impState.busy = false;
          rebind();
          UI.toast('Import selesai: ' + (res.products + res.saldoAwal + res.inbound + res.outbound) + ' data ditambahkan' +
            (res.flagged ? ', ' + res.flagged + ' baris perlu dicek' : ''), 'success');
          if (window.App) App.updateBadge();
          return;
        }
        const res = { products: 0, inbound: 0, outbound: 0, skipped: 0, errors: [] };
        s.rows.forEach((row, idx) => {
          try {
            const sku = String(impVal(row, 'sku') || '').trim();
            const nama = String(impVal(row, 'nama') || '').trim();
            if (s.mode === 'products') {
              if (!sku && !nama) { res.skipped++; return; }
              const exist = DB.all('products').find(p => sku && p.sku.toLowerCase() === sku.toLowerCase());
              if (exist) {
                const patch = {};
                if (nama) patch.name = nama;
                if (impVal(row, 'kategori')) patch.category = String(impVal(row, 'kategori'));
                if (impVal(row, 'ukuran')) patch.size = String(impVal(row, 'ukuran'));
                if (impVal(row, 'status')) patch.status = String(impVal(row, 'status'));
                if (impVal(row, 'minStock') !== '') patch.minStock = U.num(impVal(row, 'minStock'));
                DB.update('products', exist.id, patch);
              } else {
                DB.insert('products', {
                  sku: sku || ('IMP' + Date.now() + idx), name: nama || sku, category: String(impVal(row, 'kategori') || 'Lainnya'),
                  size: String(impVal(row, 'ukuran') || ''), status: String(impVal(row, 'status') || 'Gudang'),
                  minStock: U.num(impVal(row, 'minStock')), photo: DB.svgPhoto('📦', '#f1f5f9'),
                  notes: String(impVal(row, 'keterangan') || '')
                });
                res.products++;
              }
              return;
            }

            const qty = U.num(impVal(row, 'qty'));
            if (!qty || qty <= 0) { res.errors.push('Baris ' + (idx + 2) + ': jumlah tidak valid'); return; }
            const date = impDate(impVal(row, 'tanggal')) || U.today();
            let type = s.mode;
            if (s.mode === 'mutasi') {
              const raw = String(impVal(row, 'jenis') || '').toLowerCase();
              const tujuan = String(impVal(row, 'tujuan') || '').toLowerCase();
              type = /keluar|out|kirim|jual|customer|export/.test(raw) || (!raw && tujuan) ? 'outbound' : 'inbound';
            }
            let product = DB.all('products').find(p => sku && p.sku.toLowerCase() === sku.toLowerCase());
            if (!product && nama) product = DB.all('products').find(p => p.name.toLowerCase() === nama.toLowerCase());
            if (!product) {
              product = DB.insert('products', {
                sku: sku || ('IMP' + Date.now() + idx), name: nama || sku || 'Produk Import',
                category: String(impVal(row, 'kategori') || 'Lainnya'), size: String(impVal(row, 'ukuran') || ''),
                status: 'Gudang', minStock: 0, photo: DB.svgPhoto('📦', '#f1f5f9'), notes: 'Dibuat saat import'
              });
              res.products++;
            }
            const supplier = String(impVal(row, 'supplier') || '');
            const tujuan = String(impVal(row, 'tujuan') || '');
            const petugas = String(impVal(row, 'petugas') || '');
            const kondisi = String(impVal(row, 'kondisi') || 'Baik');
            const sj = String(impVal(row, 'suratJalan') || '');
            const notes = String(impVal(row, 'keterangan') || '');
            const dup = DB.all(type).find(x => x.productId === product.id && U.num(x.qty) === qty && x.date === date &&
              String(type === 'inbound' ? x.supplier : x.destination).toLowerCase() === String(type === 'inbound' ? supplier : tujuan).toLowerCase());
            if (s.skipDuplicate !== false && dup) { res.skipped++; return; }
            const base = {
              date, productId: product.id, sku: product.sku, productName: product.name,
              qty, notes, createdAt: new Date().toISOString()
            };
            if (type === 'inbound') {
              DB.insert('inbound', Object.assign({}, base, { supplier: supplier || '-', condition: kondisi || 'Baik', receiver: petugas || '-' }));
              res.inbound++;
            } else {
              DB.insert('outbound', Object.assign({}, base, {
                type: 'Customer', destination: tujuan || '-', artisanReceiver: '-', suratJalan: sj || '-',
                staff: petugas || (DB.currentUser() || {}).name || '-'
              }));
              res.outbound++;
            }
          } catch (err) { res.errors.push('Baris ' + (idx + 2) + ': ' + err.message); }
        });
        impState.result = res;
        impState.busy = false;
        rebind();
        UI.toast('Import selesai: ' + (res.inbound + res.outbound + res.products) + ' data ditambahkan', 'success');
        if (window.App) App.updateBadge();
      });
    }
  };

  notifications.alerts = alerts;
  return { distributions, boxes, returns, spk, reports, search, notifications, users, settings, payroll, borong, import: importView };
})());
