/* ═══════════════════════════════════════
   NAVBAR.JS — Sidebar Navigation
   ═══════════════════════════════════════ */

const Navbar = (() => {
  function init() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        navigateTo(page);
      });
    });


    // Handle hash on load
    const hash = location.hash.slice(1) || 'overview';
    navigateTo(hash);
  }

  function navigateTo(page) {
    // Update hash
    location.hash = page;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Load page content
    const container = document.getElementById('pageContent');
    switch (page) {
      case 'overview':
        OverviewPage.render(container);
        break;
      case 'karkas':
        KarkasPage.render(container);
        break;
      default:
        container.innerHTML = `
          <div style="padding:60px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:12px;">🚧</div>
            <h2 style="font-size:18px;margin-bottom:8px;">Halaman ${page}</h2>
            <p style="color:var(--text-muted);font-size:13px;">Coming soon — mockup belum tersedia</p>
          </div>`;
    }
  }

  return { init, navigateTo };
})();
