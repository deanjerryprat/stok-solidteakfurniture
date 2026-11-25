/* utils.js — helper umum (tanpa dependency wajib) */
window.U = (function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const num = v => Number(v || 0);
  function fmt(n) { return num(n).toLocaleString('id-ID'); }
  function rp(n) { return 'Rp ' + fmt(n); }

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function shiftDays(days, from) {
    const d = from ? new Date(from + 'T00:00:00') : new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dateID(s) {
    if (!s) return '-';
    const d = new Date(s + 'T00:00:00');
    if (isNaN(d)) return s;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function dateTime(s) {
    if (!s) return '-';
    const d = new Date(s);
    return isNaN(d) ? s : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toCSV(rows) {
    return '\uFEFF' + rows.map(r => r.map(cell => {
      const s = (cell === null || cell === undefined) ? '' : String(cell);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
  }

  function exportExcel(filename, rows, sheetName) {
    if (window.XLSX) {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, (sheetName || 'Sheet1').slice(0, 31));
      XLSX.writeFile(wb, filename + '.xlsx');
    } else {
      download(filename + '.csv', toCSV(rows), 'text/csv;charset=utf-8');
    }
  }

  function exportPDF(title, rows) {
    if (window.jspdf && window.jspdf.jsPDF) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: rows[0] && rows[0].length > 6 ? 'landscape' : 'portrait' });
      doc.setFontSize(14); doc.text(title, 14, 18);
      doc.setFontSize(8); doc.text('Dicetak: ' + dateTime(new Date().toISOString()), 14, 25);
      const header = rows[0] || [];
      const body = rows.slice(1);
      const colCount = header.length;
      const pageW = doc.internal.pageSize.getWidth() - 28;
      const colW = pageW / colCount;
      let y = 34;
      const drawRow = (cells, isHeader) => {
        if (y > doc.internal.pageSize.getHeight() - 16) { doc.addPage(); y = 18; }
        doc.setFont(undefined, isHeader ? 'bold' : 'normal');
        cells.forEach((c, i) => {
          const txt = String(c === null || c === undefined ? '' : c).slice(0, 42);
          doc.text(doc.splitTextToSize(txt, colW - 3), 14 + i * colW, y);
        });
        y += isHeader ? 8 : 7;
      };
      drawRow(header, true);
      body.forEach(r => drawRow(r, false));
      doc.save(title.replace(/[^\w\s-]/g, '') + '.pdf');
    } else {
      const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
        '<style>body{font-family:Segoe UI,sans-serif;padding:24px}h1{font-size:18px}table{border-collapse:collapse;width:100%;font-size:11px}' +
        'th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#eee}p{color:#666}</style></head><body>' +
        '<h1>' + esc(title) + '</h1><p>Dicetak: ' + esc(dateTime(new Date().toISOString())) + '</p><table>' +
        rows.map((r, i) => '<tr>' + r.map(c => (i === 0 ? '<th>' : '<td>') + esc(c) + (i === 0 ? '</th>' : '</td>')).join('') + '</tr>').join('') +
        '</table><script>window.onload=function(){window.print()}<\/script></body></html>';
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
      else U.toast('Izinkan popup untuk mencetak PDF', 'warning');
    }
  }

  function badge(text) {
    const t = String(text || '');
    const map = {
      'Lulus': 'green', 'Selesai': 'green', 'Aktif': 'green', 'Barang Jadi': 'green', 'Customer': 'blue',
      'Gudang': 'blue', 'Proses': 'yellow', 'Menunggu QC': 'yellow', 'Menunggu': 'yellow', 'Belum Selesai': 'yellow',
      'Rusak/Afkir': 'red', 'Afkir': 'red', 'Terlambat': 'red', 'Nonaktif': 'gray', 'Borong Obat': 'purple',
      'Proses Obat': 'purple'
    };
    return '<span class="badge badge-' + (map[t] || 'gray') + '">' + esc(t) + '</span>';
  }

  function sum(arr, fn) { return (arr || []).reduce((a, x) => a + num(fn ? fn(x) : x), 0); }
  function group(arr, fn) {
    return (arr || []).reduce((acc, x) => { const k = fn(x); (acc[k] = acc[k] || []).push(x); return acc; }, {});
  }
  function unique(arr) { return Array.from(new Set(arr)); }

  // Urut alami (natural sort): angka dibandingkan sebagai angka, bukan teks.
  // Contoh: ST-2 < ST-10, Kursi 2 < Kursi 11.
  function natCompare(a, b) {
    const sa = String(a === null || a === undefined ? '' : a);
    const sb = String(b === null || b === undefined ? '' : b);
    const pa = sa.split(/(\d+)/), pb = sb.split(/(\d+)/);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i], y = pb[i];
      if (x === undefined) return -1;
      if (y === undefined) return 1;
      const xNum = /^\d+$/.test(x), yNum = /^\d+$/.test(y);
      if (xNum && yNum) {
        const diff = parseInt(x, 10) - parseInt(y, 10);
        if (diff) return diff;
        if (x.length !== y.length) return x.length - y.length;
      } else if (x !== y) {
        return x.localeCompare(y, 'id', { sensitivity: 'base' });
      }
    }
    return 0;
  }
  const sortBySKU = arr => (arr || []).slice().sort((a, b) => natCompare(a.sku, b.sku) || natCompare(a.name, b.name));
  const sortByName = arr => (arr || []).slice().sort((a, b) => natCompare(a.name, b.name) || natCompare(a.id, b.id));

  return { $, $$, esc, num, fmt, rp, today, shiftDays, dateID, dateTime, uid, download, toCSV, exportExcel, exportPDF, badge, sum, group, unique, natCompare, sortBySKU, sortByName };
})();
