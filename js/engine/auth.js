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

  async function getUser() {
    const session = await getSession();
    return session ? session.user : null;
  }

  async function signIn(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password) {
    const { data, error } = await getClient().auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
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

      try {
        await signIn(emailInput.value, passInput.value);
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

  return { getSession, getUser, getRole, isAdmin, signIn, signUp, signOut, onAuthChange, showLogin, showApp, applyRole, initLoginUI };
})();
