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

  function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('sidebar').style.display = '';
    document.querySelector('.main').style.display = '';
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

    let isSignUp = false;

    toggleLink.addEventListener('click', (e) => {
      e.preventDefault();
      isSignUp = !isSignUp;
      formTitle.textContent = isSignUp ? 'Create Account' : 'Login';
      submitLabel.textContent = isSignUp ? 'Sign Up' : 'Sign In';
      toggleLink.textContent = isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up';
      errorEl.textContent = '';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      submitBtn.disabled = true;
      submitLabel.textContent = 'Loading...';

      try {
        if (isSignUp) {
          await signUp(emailInput.value, passInput.value);
          errorEl.style.color = 'var(--green)';
          errorEl.textContent = 'Check your email for confirmation link!';
          submitBtn.disabled = false;
          submitLabel.textContent = 'Sign Up';
        } else {
          await signIn(emailInput.value, passInput.value);
        }
      } catch (err) {
        errorEl.style.color = 'var(--red)';
        errorEl.textContent = err.message;
        submitBtn.disabled = false;
        submitLabel.textContent = isSignUp ? 'Sign Up' : 'Sign In';
      }
    });

    // Logout button
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => signOut());
    }
  }

  return { getSession, getUser, signIn, signUp, signOut, onAuthChange, showLogin, showApp, initLoginUI };
})();
