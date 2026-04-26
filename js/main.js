/* ═══════════════════════════════════════
   MAIN.JS — App Initialization
   ═══════════════════════════════════════ */

const App = (() => {
  let _bgRunning = false;

  async function init() {
    await DB.open();

    const session = await Auth.getSession();
    if (!session) {
      Auth.showLogin();
      Auth.initLoginUI();
      Auth.onAuthChange((s) => {
        if (s) {
          Auth.showApp();
          Auth.startIdleWatch();
          boot();
        } else {
          Auth.stopIdleWatch();
          Auth.showLogin();
        }
      });
      return;
    }

    Auth.showApp();
    Auth.initLoginUI();
    Auth.onAuthChange((s) => {
      if (!s) {
        Auth.stopIdleWatch();
        Auth.showLogin();
      }
    });
    Auth.startIdleWatch();
    await boot();
  }

  async function boot() {
    console.log('[App] Loading data from Supabase...');
    await Auth.applyRole();
    await loadFromDB();
    if (Auth.isAdmin()) ImportUI.init();
  }

  async function loadFromDB() {
    const lookups = await DB.getMeta('lookups');
    if (lookups && Object.keys(lookups).length) Engine.setLookups(lookups);

    const months = ((await DB.getMeta('months')) || []).slice().sort().reverse();

    if (months.length === 0) {
      console.log('[App] No data yet. Import an Excel file to start.');
      Navbar.init();
      return;
    }

    showSeedOverlay('LOADING DATA...');

    const latestRows = await DB.loadMonth(months[0]);
    Engine.setRawDB(latestRows);
    console.log('[App] ' + months[0] + ': ' + latestRows.length + ' rows — first render');

    hideSeedOverlay();
    Navbar.init();

    if (months.length > 1) {
      _loadBackground(months.slice(1));
    }
  }

  async function _loadBackground(months) {
    if (_bgRunning) return;
    _bgRunning = true;
    showBgLoader(months[0]);

    let total = 0;
    for (let i = 0; i < months.length; i++) {
      const ym = months[i];
      updateBgLoader(ym, i + 1, months.length);

      try {
        const rows = await DB.loadMonth(ym);
        Engine.appendRows(rows);
        total += rows.length;
        console.log('[BG] Loaded ' + ym + ': ' + rows.length + ' rows');
      } catch (e) {
        console.warn('[BG] Error loading ' + ym, e);
      }
    }

    _bgRunning = false;
    hideBgLoader();
    console.log('[BG] Background load complete. Total appended: ' + total + ' rows');

    const hash = location.hash.slice(1) || 'overview';
    Navbar.navigateTo(hash);
  }

  function showSeedOverlay(text) {
    const el = document.getElementById('importOverlay');
    const label = el?.querySelector('.import-label');
    if (el) el.classList.add('show');
    if (label) label.textContent = text || 'LOADING...';
  }

  function hideSeedOverlay() {
    document.getElementById('importOverlay')?.classList.remove('show');
  }

  function showBgLoader(ym) {
    const el = document.getElementById('bgLoader');
    if (!el) return;
    el.classList.add('show');
    const label = el.querySelector('.bg-loader-label');
    if (label) label.textContent = ym || '';
  }

  function updateBgLoader(ym, current, total) {
    const label = document.querySelector('#bgLoader .bg-loader-label');
    if (label) label.textContent = ym + ' (' + current + '/' + total + ')';
  }

  function hideBgLoader() {
    document.getElementById('bgLoader')?.classList.remove('show');
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => console.error('App init failed:', err));
  });

  return { init, loadFromDB };
})();
