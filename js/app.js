/* app.js - login, navigasi (hash router), dan hak akses */
window.App = (function () {
  const NAV = [
    { group: 'Utama', items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'Laporan', perm: 'dashboard' },
      { key: 'search', label: 'Pencarian', icon: 'Cari', perm: 'search' },
      { key: 'notifications', label: 'Notifikasi', icon: 'Notifikasi', perm: 'notifications' }
    ]},
    { group: 'Gudang', items: [
      { key: 'products', label: 'Database Produk', icon: 'Produk', perm: 'products.view' },
      { key: 'inbound', label: 'Barang Masuk', icon: 'Masuk', perm: 'inbound.view' },
      { key: 'outbound', label: 'Barang Keluar', icon: 'Keluar', perm: 'outbound.view' },
      { key: 'boxes', label: 'Stok Box & Kubikasi', icon: 'Box', perm: 'boxes.view' }
    ]},
    { group: 'Produksi', items: [
      { key: 'artisans', label: 'Pengrajin', icon: 'Pengrajin', perm: 'artisans.view' },
      { key: 'distributions', label: 'Distribusi & Tugas Borong', icon: 'Produksi', perm: 'distributions.view' },
      { key: 'returns', label: 'Barang Kembali & QC', icon: 'Kembali', perm: 'returns.view' },
      { key: 'spk', label: 'SPK', icon: 'SPK', perm: 'spk.view' }
    ]},
    { group: 'Keuangan', items: [
      { key: 'payroll', label: 'Gaji Karyawan', icon: 'Gaji', perm: 'payroll.view' },
      { key: 'borong', label: 'Tugas & Gaji Borong', icon: 'Borong', perm: 'borong.view' }
    ]},
    { group: 'Laporan & Sistem', items: [
      { key: 'import', label: 'Import Excel', icon: '', perm: 'import.view' },
      { key: 'reports', label: 'Laporan', icon: 'Laporan', perm: 'reports.view' },
      { key: 'users', label: 'Pengguna', icon: 'Pengguna', perm: 'users.view' },
      { key: 'settings', label: 'Pengaturan', icon: 'Setelan', perm: 'users.view' }
    ]}
  ];

  function parseHash() {
    const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const params = {};
    if (query) query.split('&').forEach(p => { const kv = p.split('='); params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
    return { name: parts[0] || 'dashboard', params: params, id: parts[1] };
  }

  function renderNav(active) {
    const html = NAV.map(g => {
      const items = g.items.filter(i => DB.can(i.perm));
      if (!items.length) return '';
      return '<div class="nav-group">' + g.group + '</div>' + items.map(i =>
        '<button class="nav-item ' + (active === i.key ? 'active' : '') + '" data-route="' + i.key + '">' +
        '<span>' + i.label + '</span></button>').join('');
    }).join('');
    U.$('#navMenu').innerHTML = html;
    U.$$('#navMenu [data-route]').forEach(b => b.addEventListener('click', () => {
      location.hash = '#/' + b.dataset.route;
      U.$('#sidebar').classList.remove('open');
    }));
  }

  function updateBadge() {
    const el = U.$('#notifBadge');
    if (!el) return;
    let count = 0;
    try {
      const read = JSON.parse(localStorage.getItem('furniture_notif_read') || '[]');
      count = (Views.notifications.alerts() || []).filter(a => !read.includes(a.key)).length;
    } catch (e) {}
    el.hidden = count === 0;
    el.title = count + ' notifikasi belum dibaca';
  }

  function render() {
    if (!DB.currentUser()) { location.replace('index.html'); return; }
    const u = DB.currentUser();
    const initials = u.name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();
    U.$('#userChip').innerHTML = '<span class="avatar">' + U.esc(initials) + '</span><span><strong>' + U.esc(u.name) + '</strong><br><small style="color:var(--muted)">' + U.esc(u.role) + '</small></span>';

    const r = parseHash();
    const nav = NAV.flatMap(g => g.items).find(i => i.key === r.name);
    renderNav(r.name === 'artisans' && r.id ? 'artisans' : r.name);
    updateBadge();
    const view = U.$('#view');
    if (!nav || !DB.can(nav.perm)) {
      view.innerHTML = UI.pageHead('Akses ditolak', 'Anda tidak memiliki hak untuk membuka halaman ini', '<a class="btn" href="#/dashboard">Kembali ke Dashboard</a>') +
        '<div class="card card-body">Hubungi administrator untuk mendapatkan akses.</div>';
      return;
    }
    let V = Views[r.name];
    if (!V) { location.hash = '#/dashboard'; return; }
    if (r.name === 'artisans' && r.id) V = Views.artisanDetail;
    try {
      const params = Object.assign({ id: r.id }, r.params);
      view.innerHTML = V.render(params, r.id);
      if (V.bind) V.bind(view, params);
      view.scrollTop = 0;
    } catch (e) {
      console.error(e);
      view.innerHTML = '<div class="notice error">Terjadi kesalahan saat menampilkan halaman: ' + U.esc(e.message) + '</div>';
    }
  }

  function refresh() { render(); }

  async function init() {
    DB.load();
    if (DB.isConfigured() && DB.autoConnectEnabled()) {
      try { await DB.connectSupabase(DB.getConfig()); }
      catch (e) { console.warn('Supabase tidak tersambung, pakai mode lokal:', e); UI.toast('Supabase tidak tersambung: ' + e.message, 'warning'); }
    }
    // Halaman aplikasi hanya boleh dibuka setelah login
    if (!DB.currentUser()) { location.replace('index.html'); return; }
    U.$('#logoutBtn').addEventListener('click', () => { DB.logout(); location.replace('index.html'); });
    U.$('#menuToggle').addEventListener('click', () => U.$('#sidebar').classList.toggle('open'));
    U.$('#notifBtn').addEventListener('click', () => { location.hash = '#/notifications'; });
    U.$('#globalSearchInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') location.hash = '#/search?q=' + encodeURIComponent(e.target.value);
    });
    U.$('#backupBtn').addEventListener('click', () => {
      if (!DB.can('*')) { UI.toast('Hanya ADMIN yang bisa backup data', 'warning'); return; }
      U.download('backup-stok-furniture-' + U.today() + '.json', JSON.stringify(DB.load(), null, 2), 'application/json');
      UI.toast('Backup data diunduh', 'success');
    });
    U.$('#restoreBtn').addEventListener('click', () => {
      if (!DB.can('*')) { UI.toast('Hanya ADMIN yang bisa memulihkan data', 'warning'); return; }
      U.$('#restoreFile').click();
    });
    U.$('#restoreFile').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          if (!await DB.replace(JSON.parse(reader.result))) throw new Error('Format tidak dikenal');
          render(); UI.toast('Data berhasil dipulihkan', 'success');
        } catch (err) { UI.toast('Gagal memulihkan: ' + err.message, 'error'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
    U.$('#resetDemoBtn').addEventListener('click', () => {
      if (!DB.can('*')) { UI.toast('Hanya ADMIN yang bisa reset data', 'warning'); return; }
      UI.confirm('Reset seluruh data ke kondisi awal (10 produk, 10 pengrajin, transaksi contoh)? Semua perubahan akan hilang.', async () => {
        try {
          await DB.reset();
          location.hash = '#/dashboard'; render(); UI.toast('Data contoh dipulihkan', 'success');
        } catch (err) { UI.toast('Gagal reset: ' + err.message, 'error'); }
      }, true);
    });
    window.addEventListener('hashchange', render);
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { render, refresh, updateBadge };
})();
