/* ═══════════════════════════════════════
   AUTH.JS — Supabase Authentication
   ═══════════════════════════════════════ */

const Auth = (() => {
  function getClient() {
    return DB.getClient();
  }

  async function getSession() {
    const { data } = await getClient().auth.getSession();
    return data.session;
  }

  function shouldRestoreSession() {
    return sessionStorage.getItem('sessionActive') === '1';
  }

  async function getUser() {
    const session = await getSession();
    return session ? session.user : null;
  }

  async function signIn(email, password, remember) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (remember) {
      localStorage.setItem('savedCredentials', JSON.stringify({ email, password }));
    } else {
      localStorage.removeItem('savedCredentials');
    }
    sessionStorage.setItem('sessionActive', '1');
    return data;
  }

  async function signUp(email, password) {
    const { data, error } = await getClient().auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    sessionStorage.removeItem('sessionActive');
    _role = null;
    const { error } = await getClient().auth.signOut();
    if (error) throw error;
    showLogin();
  }

  function onAuthChange(callback) {
    getClient().auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  }

  function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('sidebar').style.display = 'none';
    document.querySelector('.main').style.display = 'none';
    const errorEl = document.getElementById('loginError');
    if (errorEl) errorEl.textContent = '';
    const submitBtn = document.getElementById('loginBtn');
    if (submitBtn) submitBtn.disabled = false;
    const submitLabel = document.getElementById('loginBtnLabel');
    if (submitLabel) submitLabel.textContent = 'Sign In';

    const saved = localStorage.getItem('savedCredentials');
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    const rememberChk = document.getElementById('rememberMe');
    if (saved) {
      try {
        const cred = JSON.parse(saved);
        if (emailInput) emailInput.value = cred.email || '';
        if (passInput) passInput.value = cred.password || '';
        if (rememberChk) rememberChk.checked = true;
      } catch (_) {
        if (emailInput) emailInput.value = '';
        if (passInput) passInput.value = '';
        if (rememberChk) rememberChk.checked = false;
      }
    } else {
      if (emailInput) emailInput.value = '';
      if (passInput) passInput.value = '';
      if (rememberChk) rememberChk.checked = false;
    }
  }

  let _role = null;

  async function getRole() {
    if (_role) return _role;
    const { data, error } = await getClient()
      .from('user_roles')
      .select('role')
      .eq('user_id', (await getUser()).id)
      .single();
    _role = (data && !error) ? data.role : 'viewer';
    return _role;
  }

  function isAdmin() { return _role === 'admin'; }

  async function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('sidebar').style.display = '';
    document.querySelector('.main').style.display = '';
    const user = await getUser();
    const el = document.getElementById('topbarUser');
    if (el && user) {
      const name = user.user_metadata?.full_name || user.email.split('@')[0];
      el.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>${name}</span>
        <button class="topbar-logout-btn" id="btnLogout" title="Logout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>`;
      el.querySelector('#btnLogout').addEventListener('click', () => {
        document.getElementById('logoutModal').classList.add('show');
      });
    }
  }

  async function applyRole() {
    const role = await getRole();
    const importBtn = document.getElementById('btnImport');
    const fileInput = document.getElementById('fileImport');
    if (role !== 'admin') {
      if (importBtn) importBtn.style.display = 'none';
      if (fileInput) fileInput.style.display = 'none';
    } else {
      if (importBtn) importBtn.style.display = '';
    }
  }

  function initLoginUI() {
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    const errorEl = document.getElementById('loginError');
    const submitBtn = document.getElementById('loginBtn');
    const toggleLink = document.getElementById('toggleAuth');
    const formTitle = document.getElementById('loginTitle');
    const submitLabel = document.getElementById('loginBtnLabel');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      submitBtn.disabled = true;
      submitLabel.textContent = 'Loading...';

      const remember = document.getElementById('rememberMe')?.checked ?? false;
      try {
        await signIn(emailInput.value, passInput.value, remember);
      } catch (err) {
        errorEl.style.color = 'var(--red)';
        errorEl.textContent = err.message === 'Invalid login credentials'
          ? 'Username/password salah'
          : err.message;
        submitBtn.disabled = false;
        submitLabel.textContent = 'Sign In';
      }
    });

    document.getElementById('logoutYes')?.addEventListener('click', () => {
      document.getElementById('logoutModal').classList.remove('show');
      signOut();
    });
    document.getElementById('logoutNo')?.addEventListener('click', () => {
      document.getElementById('logoutModal').classList.remove('show');
    });
  }

  // ── Idle timeout (15 minutes) ──
  const IDLE_TIMEOUT = 15 * 60 * 1000;
  let _idleTimer = null;

  function _resetIdleTimer() {
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = setTimeout(async () => {
      stopIdleWatch();
      sessionStorage.removeItem('sessionActive');
      _role = null;
      await getClient().auth.signOut();
      const modal = document.getElementById('sessionModal');
      const btn = document.getElementById('sessionModalBtn');
      modal.classList.add('show');
      btn.onclick = () => {
        modal.classList.remove('show');
        showLogin();
      };
    }, IDLE_TIMEOUT);
  }

  function startIdleWatch() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(ev => document.addEventListener(ev, _resetIdleTimer, { passive: true }));
    _resetIdleTimer();
  }

  function stopIdleWatch() {
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = null;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(ev => document.removeEventListener(ev, _resetIdleTimer));
  }

  return { getSession, shouldRestoreSession, getUser, getRole, isAdmin, signIn, signUp, signOut, onAuthChange, showLogin, showApp, applyRole, initLoginUI, startIdleWatch, stopIdleWatch };
})();
