/* ui.js — komponen tampilan: modal, form, tabel, toast */
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
      '<button class="icon-btn" data-close title="Tutup">✕</button></div>';
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
        '<img class="photo-preview" id="preview_' + f.key + '" src="' + (v || DB.svgPhoto('📦', '#f1f5f9')) + '">' +
        '<input type="file" id="f_' + f.key + '" data-key="' + f.key + '" data-file="1" accept="' + (f.accept || 'image/*') + '">' +
        '<input type="hidden" data-key="' + f.key + '_value" value="' + U.esc(v) + '"></div>';
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
      const f = e.target.files[0];
      if (!f) return;
      const key = inp.dataset.key;
      const reader = new FileReader();
      reader.onload = () => {
        U.$('input[data-key="' + key + '_value"]', root()).value = reader.result;
        U.$('#preview_' + key, root()).src = reader.result;
      };
      reader.readAsDataURL(f);
    }));

    U.$('#modalForm', root()).addEventListener('submit', e => {
      e.preventDefault();
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
      '<span class="stat-icon">' + (o.icon || '📦') + '</span>' +
      '<span class="label">' + U.esc(o.label) + '</span>' +
      '<span class="value">' + U.esc(o.value) + '</span>' +
      (o.sub ? '<span class="sub">' + U.esc(o.sub) + '</span>' : '') + '</div>';
  }

  function table(opts) {
    const cols = opts.columns || [];
    const rows = opts.rows || [];
    const actions = opts.actions || [];
    if (!rows.length) return '<div class="empty"><span class="empty-icon">📭</span>' + U.esc(opts.empty || 'Belum ada data.') + '</div>';
    const head = cols.map(c => '<th class="' + (c.align === 'right' ? 'num' : '') + '">' + U.esc(c.label) + '</th>').join('') +
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
