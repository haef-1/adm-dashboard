/* ═══════════════════════════════════════
   NAVBAR.JS — Sidebar Navigation
   ═══════════════════════════════════════ */

const Navbar = (() => {
  let viewMode = 'chart'; // 'chart' or 'table'

  function init() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = viewMode === 'table' ? item.dataset.pageTable : item.dataset.page;
        navigateTo(page);
      });
    });

    // View toggle dropdown
    const viewSelect = document.getElementById('viewModeSelect');
    viewSelect.addEventListener('change', () => {
      viewMode = viewSelect.value;
      const activeItem = document.querySelector('.nav-item.active');
      if (activeItem) {
        const page = viewMode === 'table' ? activeItem.dataset.pageTable : activeItem.dataset.page;
        navigateTo(page);
      }
    });

    // Handle hash on load
    const hash = location.hash.slice(1) || 'overview';
    if (hash.endsWith('-table')) {
      viewMode = 'table';
      viewSelect.value = 'table';
    }
    navigateTo(hash);
  }

  function navigateTo(page) {
    // Update hash
    location.hash = page;

    // Update active nav — match by either data-page or data-page-table
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page || item.dataset.pageTable === page);
    });

    // Load page content
    const container = document.getElementById('pageContent');
    switch (page) {
      case 'overview':
        OverviewPage.render(container);
        break;
      case 'overview-table':
        OverviewTablePage.render(container);
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
