/**
 * BACKUP STOK FURNITURE → GOOGLE SHEET + GOOGLE DRIVE + GMAIL
 * -----------------------------------------------------------
 * Cara pakai singkat:
 * 1. Buat satu Google Sheet kosong, lalu salin Sheet ID dari URL-nya.
 * 2. Di Sheet: Extensions → Apps Script, hapus isi default, tempel seluruh file ini.
 * 3. Project Settings → Script Properties, tambahkan:
 *      SHEET_ID      = <Sheet ID dari langkah 1>
 *      BACKUP_TOKEN  = <token bebas, misal: solidteak2026>
 *      BACKUP_EMAIL  = <email Gmail penerima> (opsional)
 * 4. Deploy → New deployment → Web app:
 *      Execute as   = Me
 *      Who has access = Anyone
 *    Copy Web App URL (.../exec).
 * 5. Di aplikasi: Pengaturan → Backup ke Google Sheet + Gmail, isi URL, email, token.
 *
 * Endpoint ini menerima POST JSON dari aplikasi. Content-Type sengaja memakai
 * text/plain agar browser tidak memicu CORS preflight.
 */

var PROPS = PropertiesService.getScriptProperties();

function doGet(e) {
  return respond({ ok: true, message: 'Endpoint backup siap. Kirim POST JSON ke URL ini.' });
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw) return respond({ ok: false, error: 'Body kosong.' });

    var data = JSON.parse(raw);
    var token = PROPS.getProperty('BACKUP_TOKEN') || '';
    if (token && String(data.token || '') !== token) {
      return respond({ ok: false, error: 'Token tidak cocok.' });
    }

    var sheetId = PROPS.getProperty('SHEET_ID');
    if (!sheetId) return respond({ ok: false, error: 'SHEET_ID belum diisi di Script Properties.' });

    var ss = SpreadsheetApp.openById(sheetId);
    var tables = data.tables || {};
    var tableNames = Object.keys(tables);
    var totalRows = 0;

    tableNames.forEach(function (name) {
      var rows = Array.isArray(tables[name]) ? tables[name] : [];
      var sh = ss.getSheetByName(name) || ss.insertSheet(name);
      sh.clear();

      if (!rows.length) {
        sh.appendRow(['(tidak ada data)']);
        return;
      }

      // Kumpulkan semua kunci kolom (data dari aplikasi memakai camelCase).
      var keys = [];
      rows.forEach(function (r) {
        Object.keys(r).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
      });
      keys.sort();

      var flat = rows.map(function (r) {
        return keys.map(function (k) {
          var v = r[k];
          if (Array.isArray(v) || (v && typeof v === 'object')) return JSON.stringify(v);
          return (v === undefined || v === null) ? '' : v;
        });
      });

      sh.appendRow(keys);
      sh.getRange(2, 1, flat.length, keys.length).setValues(flat);
      totalRows += rows.length;
    });

    var meta = ss.getSheetByName('_BACKUP_INFO') || ss.insertSheet('_BACKUP_INFO');
    meta.clear();
    meta.appendRow(['Diterima', data.timestamp || new Date().toISOString()]);
    meta.appendRow(['Aplikasi', data.app || 'Stok Furniture']);
    meta.appendRow(['Jumlah tabel', tableNames.length]);
    meta.appendRow(['Total baris', totalRows]);
    meta.appendRow(['Google Sheet', ss.getUrl()]);

    // Salinan JSON di Google Drive (cadangan mentah, bisa dipulihkan).
    var driveUrl = '';
    var stamp = String(data.timestamp || Date.now()).replace(/[:T]/g, '-').slice(0, 19);
    try {
      var file = DriveApp.createFile(
        'backup-stok-' + stamp + '.json',
        JSON.stringify(data),
        'application/json'
      );
      driveUrl = file.getUrl();
    } catch (e) {}

    // Email ke Gmail dengan lampiran JSON.
    var emailSent = false;
    var emailError = '';
    var email = data.email || PROPS.getProperty('BACKUP_EMAIL');
    if (email) {
      try {
        var blob = Utilities.newBlob(
          JSON.stringify(data, null, 2),
          'application/json',
          'backup-stok-' + stamp + '.json'
        );
        MailApp.sendEmail({
          to: String(email),
          subject: 'Backup stok furniture ' + String(data.timestamp || '').slice(0, 10),
          body: 'Backup otomatis diterima dari aplikasi stok.\n\n' +
                'Jumlah tabel: ' + tableNames.length + '\n' +
                'Total baris: ' + totalRows + '\n' +
                'Google Sheet: ' + ss.getUrl() + '\n' +
                (driveUrl ? 'File JSON: ' + driveUrl + '\n' : '') +
                '\nFile JSON juga terlampir pada email ini.',
          attachments: [blob]
        });
        emailSent = true;
      } catch (err) {
        emailError = err.message;
      }
    }

    return respond({
      ok: true,
      sheetUrl: ss.getUrl(),
      driveFileUrl: driveUrl,
      rows: totalRows,
      tables: tableNames.length,
      emailSent: emailSent,
      emailError: emailError
    });
  } catch (err) {
    return respond({ ok: false, error: err.message });
  }
}

function respond(obj) {
  // CATATAN: TextOutput TIDAK memiliki method setHeader()/addHeader().
  // Memanggilnya membuat doGet/doPost gagal (status Failed di Executions).
  // CORS tidak perlu di-setting manual: aplikasi mengirim POST dengan
  // Content-Type: text/plain (simple request, tanpa preflight OPTIONS).
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
