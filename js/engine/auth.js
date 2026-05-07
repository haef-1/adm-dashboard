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
    return localStorage.getItem('rememberMe') === '1' || sessionStorage.getItem('sessionActive') === '1';
  }

  async function getUser() {
    const session = await getSession();
    return session ? session.user : null;
  }

  async function signIn(email, password, remember) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (remember) {
      localStorage.setItem('rememberMe', '1');
      localStorage.setItem('savedCredentials', JSON.stringify({ email, password }));
    } else {
      localStorage.removeItem('rememberMe');
      localStorage.removeItem('savedCredentials');
      sessionStorage.setItem('sessionActive', '1');
    }
    return data;
  }

  async function signUp(email, password) {
    const { data, error } = await getClient().auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    localStorage.removeItem('rememberMe');
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
      } catch (_) {}
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

  function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('sidebar').style.display = '';
    document.querySelector('.main').style.display = '';
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
        errorEl.textContent = err.message;
        submitBtn.disabled = false;
        submitLabel.textContent = 'Sign In';
      }
    });

    // Logout button
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => signOut());
    }
  }

  // ── Idle timeout (10 minutes) ──
  const IDLE_TIMEOUT = 15 * 60 * 1000;
  let _idleTimer = null;

  function _resetIdleTimer() {
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = setTimeout(async () => {
      stopIdleWatch();
      localStorage.removeItem('rememberMe');
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
