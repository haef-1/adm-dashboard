/* ═══════════════════════════════════════
   WHATSNEW.JS — Popup "Apa yang Baru" + spotlight

   Muncul hanya saat login baru / setelah sesi habis — TIDAK saat refresh.
   Pembedanya ada di main.js: sesi yang dipulihkan (refresh) tidak pernah
   melewati jalur ini, jadi tidak perlu ditebak-tebak di sini.

   Alurnya:
     modal  →  [Lihat fiturnya]  →  spotlight ke panel terkait  →  [Selesai]

   Muncul SETIAP login baru selama rilis teratas masih yang itu — sengaja
   tidak disimpan "sudah pernah dilihat", supaya pengumumannya tidak terlewat
   oleh yang menutup buru-buru. Untuk menghentikannya, ganti isi RELEASES.

   Cara menambah catatan rilis baru: tambahkan entri di paling ATAS array
   RELEASES. Itu saja — entri teratas otomatis jadi yang ditampilkan.

   `spotlight` diisi id elemen yang mau disorot (opsional).
   ═══════════════════════════════════════ */

const WhatsNew = (() => {
  const RELEASES = [
    {
      id: '2026-07-28.2',
      title: 'Apa yang Baru',
      subtitle: 'Ada fitur baru di halaman Overview',
      spotlight: 'trafficBody',
      spotlightNote: 'Grafik barunya ada di sini — coba geser tanggalnya atau ganti BRD/KG.',
      items: [
        {
          icon: '📊',
          title: 'Trafic Bahan Karkas',
          desc: 'Grafik kepadatan transfer karkas per jam. Kelihatan jam berapa produksi paling padat, lengkap dengan garis rata-rata bulan berjalan sebagai pembanding.',
        },
      ],
    },
  ];

  const VERSION = RELEASES[0].id;

  let _cleanup = null;

  // Penjaga per-sesi, bukan localStorage: popup harus muncul lagi di login
  // berikutnya, tapi onAuthStateChange juga menyala saat token diperbarui di
  // tengah sesi — tanpa penjaga ini popup bisa nongol lagi padahal baru
  // ditutup. Reset sendiri saat halaman dimuat ulang (logout me-reload).
  let _shownThisSession = false;

  function _release() {
    return RELEASES[0];
  }

  // ══════ Modal ══════
  function _renderModal(rel) {
    const overlay = document.getElementById('whatsNewModal');
    if (!overlay) return null;

    const nextLabel = rel.spotlight ? 'Lihat fiturnya' : 'Mengerti';

    overlay.innerHTML = `
      <div class="whatsnew-modal" role="dialog" aria-labelledby="whatsNewTitle">
        <button class="whatsnew-close" id="whatsNewSkip" aria-label="Tutup">&times;</button>
        <div class="whatsnew-header">
          <span class="whatsnew-badge">Baru</span>
          <h3 class="whatsnew-title" id="whatsNewTitle">${rel.title}</h3>
          <p class="whatsnew-subtitle">${rel.subtitle}</p>
        </div>
        <div class="whatsnew-list">
          ${rel.items.map((it) => `
            <div class="whatsnew-item">
              <span class="whatsnew-item-icon">${it.icon}</span>
              <div class="whatsnew-item-text">
                <div class="whatsnew-item-title">${it.title}</div>
                <div class="whatsnew-item-desc">${it.desc}</div>
              </div>
            </div>`).join('')}
        </div>
        <button class="whatsnew-btn" id="whatsNewNext">${nextLabel}</button>
      </div>
    `;
    return overlay;
  }

  function _hideModal() {
    document.getElementById('whatsNewModal')?.classList.remove('show');
  }

  // ══════ Spotlight ══════
  // Satu elemen "lubang" dipasang tepat di atas panel target, lalu seluruh
  // sisa layar digelapkan lewat box-shadow bersebaran sangat besar. Dengan
  // cara ini tidak perlu empat panel penutup yang harus dihitung satu-satu.
  // Panel targetnya dibuat dinamis oleh renderer halaman, jadi saat popup
  // muncul bisa jadi belum ada. Tunggu sebentar sebelum menyerah.
  function _waitFor(id, timeoutMs) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      (function poll() {
        const el = document.getElementById(id);
        if (el) return resolve(el);
        if (Date.now() - t0 > timeoutMs) return resolve(null);
        setTimeout(poll, 120);
      })();
    });
  }

  async function _showSpotlight(rel) {
    const layer = document.getElementById('whatsNewSpotlight');
    const target = await _waitFor(rel.spotlight, 6000);
    if (!target || !layer) { finish(); return; }

    layer.innerHTML = `
      <div class="whatsnew-spot-hole" id="wnHole"></div>
      <div class="whatsnew-spot-caption" id="wnCaption">
        <div class="whatsnew-spot-text">${rel.spotlightNote || ''}</div>
        <button class="whatsnew-spot-btn" id="wnDone">Selesai</button>
      </div>
    `;

    const hole = document.getElementById('wnHole');
    const caption = document.getElementById('wnCaption');

    function position() {
      // Sengaja dicari ulang tiap kali: halaman di-render ulang setelah
      // background load selesai, dan referensi lama jadi node terlepas
      // yang rect-nya nol.
      const el = document.getElementById(rel.spotlight);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pad = 6;
      hole.style.top = r.top - pad + 'px';
      hole.style.left = r.left - pad + 'px';
      hole.style.width = r.width + pad * 2 + 'px';
      hole.style.height = r.height + pad * 2 + 'px';

      // Penempatan caption: bawah → atas → kanan → kiri.
      // Dulu hanya bawah/atas dengan Math.max(12, …) sebagai jaring pengaman,
      // dan justru itu yang menindih konten: di desktop panelnya teregang
      // mengikuti tinggi Search Material sehingga lebih tinggi dari layar,
      // jadi atas maupun bawah sama-sama tidak muat dan caption dipaksa ke
      // y=12 — tepat di atas grafiknya.
      const cw = caption.offsetWidth || 320;
      const ch = caption.offsetHeight || 96;
      const gap = 14;
      const M = 12; // jarak minimum dari tepi layar
      const VW = window.innerWidth;
      const VH = window.innerHeight;
      const clampX = (x) => Math.max(M, Math.min(x, VW - cw - M));
      const clampY = (y) => Math.max(M, Math.min(y, VH - ch - M));

      let top, left;
      if (r.bottom + gap + ch <= VH - M) {
        top = r.bottom + gap;
        left = clampX(r.left);
      } else if (r.top - gap - ch >= M) {
        top = r.top - gap - ch;
        left = clampX(r.left);
      } else if (r.right + gap + cw <= VW - M) {
        left = r.right + gap;
        top = clampY(r.top);
      } else if (r.left - gap - cw >= M) {
        left = r.left - gap - cw;
        top = clampY(r.top);
      } else {
        // Panel memenuhi layar dari segala sisi — tempel di bawah, jauh dari
        // grafik yang ada di bagian atas panel.
        left = clampX(r.left);
        top = VH - ch - M;
      }
      caption.style.top = top + 'px';
      caption.style.left = left + 'px';
    }

    // Panel yang lebih tinggi dari layar tidak boleh dipusatkan — bagian
    // atasnya (tempat grafiknya) malah terdorong keluar layar.
    const tall = target.getBoundingClientRect().height > window.innerHeight * 0.8;
    target.scrollIntoView({ behavior: 'smooth', block: tall ? 'start' : 'center' });

    // Tunggu scroll halus selesai sebelum mengukur posisi akhirnya.
    setTimeout(() => {
      position();
      layer.classList.add('show');
    }, 420);

    const scroller = document.querySelector('.page-content');
    window.addEventListener('resize', position);
    scroller?.addEventListener('scroll', position, { passive: true });
    document.getElementById('wnDone')?.addEventListener('click', finish);

    _cleanup = () => {
      window.removeEventListener('resize', position);
      scroller?.removeEventListener('scroll', position);
      layer.classList.remove('show');
      layer.innerHTML = '';
    };
  }

  // ══════ Alur ══════
  function maybeShow() {
    if (_shownThisSession) {
      console.log('[WhatsNew] dilewati: sudah tampil di sesi ini.');
      return;
    }
    _open();
  }

  // Paksa tampil ulang tanpa perlu login lagi — untuk uji dari console.
  function show() {
    _shownThisSession = false;
    _open();
  }

  function _open() {
    if (document.getElementById('whatsNewModal')?.classList.contains('show')) {
      console.log('[WhatsNew] dilewati: popup sudah terbuka.');
      return;
    }

    const rel = _release();
    if (!rel) {
      console.warn('[WhatsNew] tidak ada entri RELEASES untuk versi ' + VERSION);
      return;
    }

    const overlay = _renderModal(rel);
    if (!overlay) {
      console.warn('[WhatsNew] elemen #whatsNewModal tidak ada di halaman — index.html kemungkinan masih versi lama (cache). Coba Ctrl+Shift+R.');
      return;
    }

    _shownThisSession = true;

    // Beri jeda supaya tidak bertabrakan dengan toast "welcome".
    setTimeout(() => {
      overlay.classList.add('show');

      document.getElementById('whatsNewNext')?.addEventListener('click', () => {
        _hideModal();
        if (rel.spotlight) _showSpotlight(rel);
        else finish();
      });

      // Lapisan latar tembus klik supaya halaman tetap bisa digulir, jadi
      // jalan keluarnya lewat tombol × ini — bukan klik latar.
      document.getElementById('whatsNewSkip')?.addEventListener('click', finish);
    }, 900);
  }

  function finish() {
    _hideModal();
    if (_cleanup) { _cleanup(); _cleanup = null; }
  }

  return { maybeShow, show, finish, VERSION };
})();
