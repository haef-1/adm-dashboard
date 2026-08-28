/* ═══════════════════════════════════════
   NAVBAR.JS — Sidebar Navigation
   ═══════════════════════════════════════ */

const Navbar = (() => {
  let viewMode = 'chart'; // 'chart' or 'table'
  let _bound = false;

  function closeSidebar() {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-overlay')?.classList.remove('show');
  }

  function init() {
    if (!_bound) {
      _bound = true;

      // Mobile: logo click toggles sidebar
      const mobileLogo = document.getElementById('topbarLogoMobile');
      const sidebar = document.querySelector('.sidebar');
      if (mobileLogo && sidebar) {
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'sidebar-overlay';
          document.body.appendChild(overlay);
        }
        mobileLogo.addEventListener('click', () => {
          sidebar.classList.toggle('open');
          overlay.classList.toggle('show');
        });
        overlay.addEventListener('click', closeSidebar);
      }

      document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          closeSidebar();
          const page = viewMode === 'table' ? item.dataset.pageTable : item.dataset.page;
          navigateTo(page);
        });
      });

      // View toggle buttons
      const toggleBtns = document.querySelectorAll('.view-toggle-btn');
      toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          viewMode = btn.dataset.mode;
          toggleBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === viewMode));
          const activeItem = document.querySelector('.nav-item.active');
          if (activeItem) {
            const page = viewMode === 'table' ? activeItem.dataset.pageTable : activeItem.dataset.page;
            navigateTo(page);
          }
        });
      });
    }

    // Handle hash on load
    const hash = location.hash.slice(1) || 'overview';
    if (hash.endsWith('-table')) {
      viewMode = 'table';
      document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'table'));
    }
    navigateTo(hash);
  }

  function navigateTo(page) {
    // Update hash
    location.hash = page;

    // Selaraskan mode tampilan dengan halaman yang benar-benar dibuka.
    // Penting untuk navigasi yang datang dari luar sidebar (mis. spotlight
    // WhatsNew): tanpa ini tombol toggle bisa menunjuk mode yang berbeda
    // dari isi layar, dan klik nav berikutnya melompat ke mode lama.
    viewMode = page.endsWith('-table') ? 'table' : 'chart';
    document.querySelectorAll('.view-toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === viewMode);
    });

    // Update active nav — match by either data-page or data-page-table
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page || item.dataset.pageTable === page);
    });

    // Clean up previous page
    if (typeof OverviewPage !== 'undefined' && OverviewPage.destroy) OverviewPage.destroy();
    if (typeof KarkasTablePage !== 'undefined' && KarkasTablePage.destroy) KarkasTablePage.destroy();
    if (typeof CutUpPage !== 'undefined' && CutUpPage.destroy) CutUpPage.destroy();
    if (typeof BonelessPage !== 'undefined' && BonelessPage.destroy) BonelessPage.destroy();
    if (typeof AyamUtuhPage !== 'undefined' && AyamUtuhPage.destroy) AyamUtuhPage.destroy();

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
      case 'karkas-table':
        KarkasTablePage.render(container);
        break;
      case 'cut-up':
        CutUpPage.render(container);
        break;
      case 'boneless':
        BonelessPage.render(container);
        break;
      case 'ayam-utuh':
        AyamUtuhPage.render(container);
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
