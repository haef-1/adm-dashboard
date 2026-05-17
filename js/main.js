/* ═══════════════════════════════════════
   MAIN.JS — App Initialization
   ═══════════════════════════════════════ */

const App = (() => {
  let _bgRunning = false;

  async function init() {
    await DB.open();

    const session = await Auth.getSession();
    const hadSession = !!session && !Auth.shouldRestoreSession();
    if (!session || hadSession) {
      if (session) await DB.getClient().auth.signOut();
      Auth.showLogin();
      Auth.initLoginUI();
      if (hadSession) {
        const modal = document.getElementById('sessionModal');
        const btn = document.getElementById('sessionModalBtn');
        modal.classList.add('show');
        btn.onclick = () => modal.classList.remove('show');
      }
      Auth.onAuthChange((s) => {
        if (s) {
          Auth.showApp();
          Auth.startIdleWatch();
          showWelcome(s.user, false);
          boot().catch(err => console.error('Boot failed:', err));
        } else {
          Auth.stopIdleWatch();
          Auth.showLogin();
        }
      });
      return;
    }

    Auth.showApp();
    Auth.initLoginUI();
    showWelcome(session.user, true);
    Auth.onAuthChange((s) => {
      if (s) {
        Auth.showApp();
        Auth.startIdleWatch();
        boot().catch(err => console.error('Boot failed:', err));
      } else {
        Auth.stopIdleWatch();
        Auth.showLogin();
      }
    });
    Auth.startIdleWatch();
    await boot();
  }

  let _hiddenAt = 0;
  function showWelcome(user, isReturning) {
    const name = user.user_metadata?.full_name || user.email.split('@')[0];
    const toast = document.getElementById('welcomeToast');
    if (!toast) return;
    toast.textContent = (isReturning ? 'welcome back, ' : 'welcome, ') + name;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) { _hiddenAt = Date.now(); return; }
    if (Date.now() - _hiddenAt < 3000) return;
    const session = await Auth.getSession();
    if (session) showWelcome(session.user, true);
  });

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

    showSeedOverlay('loading bentar..');

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

    let loaded = 0;
    const allRows = [];

    const results = await Promise.allSettled(
      months.map(ym =>
        DB.loadMonth(ym).then(rows => {
          loaded++;
          updateBgLoader(ym, loaded, months.length);
          return { ym, rows };
        })
      )
    );

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.rows.length) {
        const { ym, rows } = res.value;
        for (let i = 0; i < rows.length; i++) allRows.push(rows[i]);
        console.log('[BG] Loaded ' + ym + ': ' + rows.length + ' rows');
      } else if (res.status === 'rejected') {
        console.warn('[BG] Error loading month', res.reason);
      }
    }

    if (allRows.length) Engine.appendRows(allRows);

    _bgRunning = false;
    hideBgLoader();
    console.log('[BG] Background load complete. Total appended: ' + allRows.length + ' rows');
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
