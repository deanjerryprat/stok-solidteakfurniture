/* ui.js - komponen tampilan: modal, form, tabel, toast */
window.UI = (function () {
  const root = () => U.$('#modalRoot');

  function closeModal() { root().innerHTML = ''; document.body.style.overflow = ''; }
  function openModal(html, opts) {
    opts = opts || {};
    root().innerHTML = '<div class="modal-overlay" id="modalOverlay">' +
      '<div class="modal ' + (opts.wide ? 'wide' : '') + '">' + html + '</div></div>';
    document.body.style.overflow = 'hidden';
    U.$('#modalOverlay', root()).addEventListener('mousedown', e => {
      if (e.target.id === 'modalOverlay' && !opts.noClose) closeModal();
    });
    U.$$('[data-close]', root()).forEach(b => b.addEventListener('click', closeModal));
  }

  function modalHead(title) {
    return '<div class="modal-head"><h3>' + U.esc(title) + '</h3>' +
      '<button class="icon-btn" data-close title="Tutup" aria-label="Tutup"><span class="close-x"></span></button></div>';
  }

  // Foto besar/HEIC sering membuat preview kosong dan Simpan terasa tidak merespons.
  // Kompres ke JPG sebelum disimpan: target 100-200 KB, batas 300 KB.
  function compressImage(file, done, fail) {
    const reader = new FileReader();
    reader.onerror = () => fail('File foto tidak bisa dibaca');
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => fail('Format gambar tidak didukung browser. Simpan foto sebagai JPG/PNG.');
      img.onload = () => {
        try {
          const base = Math.min(1, 1600 / Math.max(img.width, img.height));
          const qualities = [0.82, 0.75, 0.68, 0.6, 0.52];
          const scales = [base, base * 0.85, base * 0.7, base * 0.55];
          let best = null;
          for (const scale of scales) {
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            for (const q of qualities) {
              const url = canvas.toDataURL('image/jpeg', q);
              if (!best || url.length < best.length) best = url;
              if (url.length <= 220000) { done(url); return; }
            }
          }
          if (best && best.length > 409600) { fail('Foto tetap terlalu besar setelah dikompres. Pakai foto lebih kecil.'); return; }
          done(best);
        } catch (e) { fail('Gagal mengompres foto: ' + (e.message || e)); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function fieldHTML(f, values) {
    const v = (values && values[f.key] !== undefined) ? values[f.key] : (f.value !== undefined ? f.value : '');
    const req = f.required ? ' required' : '';
    let input = '';
    if (f.type === 'textarea') {
      input = '<textarea id="f_' + f.key + '" data-key="' + f.key + '"' + req + '>' + U.esc(v) + '</textarea>';
    } else if (f.type === 'select') {
      const opts = (f.options || []).map(o => typeof o === 'object' ? o : { value: o, label: o });
      input = '<select id="f_' + f.key + '" data-key="' + f.key + '"' + req + '>' +
        (f.placeholder ? '<option value="">' + U.esc(f.placeholder) + '</option>' : '') +
        opts.map(o => '<option value="' + U.esc(o.value) + '"' + (String(o.value) === String(v) ? ' selected' : '') + '>' + U.esc(o.label) + '</option>').join('') +
        '</select>';
    } else if (f.type === 'datalist') {
      const opts = (f.options || []).map(o => typeof o === 'object' ? o.value : o);
      input = '<input type="text" id="f_' + f.key + '" data-key="' + f.key + '" list="dl_' + f.key + '" value="' + U.esc(v) + '"' + req + ' placeholder="' + U.esc(f.placeholder || '') + '">' +
        '<datalist id="dl_' + f.key + '">' + opts.map(o => '<option value="' + U.esc(o) + '"></option>').join('') + '</datalist>';
    } else if (f.type === 'checkbox') {
      input = '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="f_' + f.key + '" data-key="' + f.key + '"' + (v ? ' checked' : '') + ' style="width:auto"> ' + U.esc(f.checkLabel || 'Ya') + '</label>';
    } else if (f.type === 'file') {
      input = '<div style="display:flex;gap:10px;align-items:center">' +
        '<img class="photo-preview" id="preview_' + f.key + '" src="' + (v || DB.svgPhoto('Produk', '#f1f5f9')) + '">' +
        '<input type="file" id="f_' + f.key + '" data-key="' + f.key + '" data-file="1" accept="' + (f.accept || 'image/jpeg,image/png,image/webp,image/*') + '">' +
        '<input type="hidden" data-key="' + f.key + '_value" value="' + U.esc(v) + '"></div>' +
        '<div class="hint" id="status_' + f.key + '" style="margin-top:6px">Foto dikompres otomatis ke JPG sekitar 100-200 KB (maks 300 KB). Foto lama dipakai bila tidak diganti.</div>' +
        '<button type="submit" class="btn btn-primary btn-sm" style="margin-top:8px;align-self:flex-start">Simpan</button>';
    } else if (f.type === 'readonly') {
      input = '<input type="text" id="f_' + f.key + '" value="' + U.esc(v) + '" readonly style="background:#f8fafc">';
    } else {
      input = '<input type="' + (f.type || 'text') + '" id="f_' + f.key + '" data-key="' + f.key + '" value="' + U.esc(v) + '"' + req +
        (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.max !== undefined ? ' max="' + f.max + '"' : '') +
        (f.step !== undefined ? ' step="' + f.step + '"' : '') + ' placeholder="' + U.esc(f.placeholder || '') + '">';
    }
    return '<div class="field ' + (f.full ? 'full' : '') + '"><label for="f_' + f.key + '">' + U.esc(f.label) + '</label>' + input +
      (f.hint ? '<div class="hint">' + U.esc(f.hint) + '</div>' : '') + '</div>';
  }

  function formModal(opts) {
    const fields = opts.fields || [];
    const html = modalHead(opts.title || 'Form') +
      '<form id="modalForm"><div class="modal-body">' +
      (opts.notice ? '<div class="notice">' + U.esc(opts.notice) + '</div><br>' : '') +
      '<div class="form-grid">' + fields.map(f => fieldHTML(f, opts.values)).join('') + '</div>' +
      '</div><div class="modal-foot">' +
      '<button type="button" class="btn" data-close>Batal</button>' +
      '<button type="submit" class="btn btn-primary">' + U.esc(opts.submitLabel || 'Simpan') + '</button>' +
      '</div></form>';
    openModal(html, opts);

    U.$$('[data-file]', root()).forEach(inp => inp.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const key = inp.dataset.key;
      const status = U.$('#status_' + key, root());
      const submitBtn = U.$('#modalForm button[type="submit"]', root());
      const originalLabel = submitBtn ? submitBtn.textContent : 'Simpan';
      const token = String(Date.now()) + '-' + Math.random();
      let settled = false;
      inp.dataset.token = token;
      const finish = () => {
        if (settled || inp.dataset.token !== token) return;
        settled = true;
        if (inp._compressTimer) { clearTimeout(inp._compressTimer); inp._compressTimer = null; }
        delete inp.dataset.busy;
        if (submitBtn) { delete submitBtn.dataset.processing; submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
      };
      inp.dataset.busy = '1';
      if (submitBtn) { submitBtn.dataset.processing = '1'; submitBtn.textContent = 'Memproses foto...'; }
      if (status) { status.textContent = 'Memproses foto...'; status.style.color = 'var(--muted)'; }
      if (inp._compressTimer) clearTimeout(inp._compressTimer);
      inp._compressTimer = setTimeout(() => {
        if (settled || inp.dataset.token !== token) return;
        if (status) { status.textContent = 'Foto memakan waktu terlalu lama. Coba file lebih kecil.'; status.style.color = '#dc2626'; }
        toast('Foto gagal diproses: timeout', 'error');
        e.target.value = '';
        finish();
      }, 20000);
      compressImage(file, url => {
        if (inp.dataset.token !== token) return;
        const hidden = U.$('input[data-key="' + key + '_value"]', root());
        const preview = U.$('#preview_' + key, root());
        if (hidden) hidden.value = url;
        if (preview) preview.src = url;
        const kb = Math.round(url.length * 3 / 4 / 1024);
        if (status) { status.textContent = 'Foto siap: ' + kb + ' KB (JPG)'; status.style.color = '#16a34a'; }
        finish();
      }, msg => {
        if (inp.dataset.token !== token) return;
        if (status) { status.textContent = msg; status.style.color = '#dc2626'; }
        toast('Foto gagal diproses: ' + msg, 'error');
        e.target.value = '';
        finish();
      });
    }));

    U.$('#modalForm', root()).addEventListener('submit', e => {
      e.preventDefault();
      if (U.$('[data-file][data-busy="1"]', root())) { toast('Tunggu foto selesai diproses', 'warning'); return; }
      const data = {};
      let missing = null;
      fields.forEach(f => {
        if (f.type === 'file') {
          data[f.key] = U.$('input[data-key="' + f.key + '_value"]', root()).value;
        } else if (f.type === 'checkbox') {
          data[f.key] = U.$('#f_' + f.key, root()).checked;
        } else {
          const el = U.$('#f_' + f.key, root());
          data[f.key] = el ? el.value.trim() : '';
        }
        if (f.required && (data[f.key] === '' || data[f.key] === null) && !missing) missing = f.label;
      });
      if (missing) { toast('Field wajib belum diisi: ' + missing, 'warning'); return; }
      opts.onSubmit(data, closeModal);
    });
    if (opts.onOpen) opts.onOpen();
  }

  function confirm(message, onYes, danger) {
    openModal(modalHead('Konfirmasi') +
      '<div class="modal-body"><p>' + U.esc(message) + '</p></div>' +
      '<div class="modal-foot"><button class="btn" data-close>Batal</button>' +
      '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" id="confirmYes">Ya, lanjutkan</button></div>');
    U.$('#confirmYes', root()).addEventListener('click', () => { closeModal(); onYes(); });
  }

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    U.$('#toastRoot').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, 3200);
  }

  function pageHead(title, subtitle, actions) {
    const acts = Array.isArray(actions) ? actions : (actions ? [actions] : []);
    return '<div class="page-head"><div><h1>' + U.esc(title) + '</h1><p>' + U.esc(subtitle || '') + '</p></div>' +
      '<div class="page-actions">' + acts.join('') + '</div></div>';
  }

  function statCard(o) {
    return '<div class="card stat-card ' + (o.accent ? 'accent-' + o.accent : '') + '">' +
      '<span class="label">' + U.esc(o.label) + '</span>' +
      '<span class="value">' + U.esc(o.value) + '</span>' +
      (o.sub ? '<span class="sub">' + U.esc(o.sub) + '</span>' : '') + '</div>';
  }

  function table(opts) {
    const cols = opts.columns || [];
    const rows = opts.rows || [];
    const actions = opts.actions || [];
    if (!rows.length) return '<div class="empty">' + U.esc(opts.empty || 'Belum ada data.') + '</div>';
    const head = cols.map(c => '<th class="' + (c.align === 'right' ? 'num' : '') + '">' + (c.htmlLabel || U.esc(c.label)) + '</th>').join('') +
      (actions.length ? '<th>Aksi</th>' : '');
    const body = rows.map(r => '<tr>' + cols.map(c =>
      '<td class="' + (c.align === 'right' ? 'num' : '') + '">' + (c.render ? c.render(r) : U.esc(r[c.key] ?? '-')) + '</td>'
    ).join('') + (actions.length ? '<td><div class="actions">' + actions.map(a =>
      '<button class="link-btn ' + (a.cls || '') + '" data-act="' + a.act + '" data-id="' + U.esc(r.id) + '">' + U.esc(a.label) + '</button>'
    ).join('') + '</div></td>' : '') + '</tr>').join('');
    return '<div class="table-wrap"><table class="data-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  return { openModal, closeModal, modalHead, formModal, confirm, toast, pageHead, statCard, table };
})();
