/* login.js - halaman masuk. Setelah berhasil, pindah ke app.html */
window.Login = (function () {
  async function init() {
    DB.load();

    // Kalau sudah login, langsung lempar ke aplikasi
    if (DB.currentUser()) { location.replace('app.html#/dashboard'); return; }

    // Sambung ke Supabase sebelum login supaya authenticate() memakai server
    if (DB.isConfigured() && DB.autoConnectEnabled()) {
      try { await DB.connectSupabase(DB.getConfig()); }
      catch (e) {
        console.warn('Supabase tidak tersambung, pakai mode lokal:', e);
        UI.toast('Supabase tidak tersambung: ' + e.message, 'warning');
      }
    }

    U.$('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      if (btn) { btn.disabled = true; btn.textContent = 'Memeriksa...'; }
      try {
        const u = await DB.authenticate(U.$('#loginUsername').value, U.$('#loginPassword').value);
        if (!u) { UI.toast('Username atau password salah', 'error'); return; }
        DB.login(u);
        location.replace('app.html#/dashboard');
      } catch (err) {
        UI.toast(err.message, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  return { init };
})();
