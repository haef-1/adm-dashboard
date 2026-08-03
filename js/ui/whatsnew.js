/* ═══════════════════════════════════════
   WHATSNEW.JS — Popup "Apa yang Baru" + spotlight

   Muncul hanya saat login baru / setelah sesi habis — TIDAK saat refresh.
   Pembedanya ada di main.js: sesi yang dipulihkan (refresh) tidak pernah
   melewati jalur ini, jadi tidak perlu ditebak-tebak di sini.

   Alurnya:
     modal  →  [Lihat fiturnya]  →  spotlight ke panel terkait
            →  [Next] … langkah berikutnya …  →  [Selesai]

   Muncul SETIAP login baru selama rilis teratas masih yang itu — sengaja
   tidak disimpan "sudah pernah dilihat", supaya pengumumannya tidak terlewat
   oleh yang menutup buru-buru. Untuk menghentikannya, ganti isi RELEASES.

   Cara menambah catatan rilis baru: tambahkan entri di paling ATAS array
   RELEASES. Itu saja — entri teratas otomatis jadi yang ditampilkan.

   `spotlight` diisi id elemen yang mau disorot (opsional). Untuk panduan
   berlangkah, pakai `steps: [{ spotlight, note, action }]` — tombolnya jadi
   "Next" sampai langkah terakhir, baru "Selesai". `action` (opsional) adalah
   fungsi yang dijalankan sebelum langkahnya disorot, dipakai untuk membukakan
   tampilan yang sedang dijelaskan; boleh async. Entri lama yang masih memakai
   `spotlight` + `spotlightNote` tetap jalan — diperlakukan sebagai satu langkah.
   `page` diisi halaman tempat elemen itu berada — isinya sama persis dengan
   data-page / data-page-table di sidebar (index.html): "overview", "karkas",
   "karkas-table", dst. WAJIB diisi setiap kali `spotlight` dipakai: user bisa
   mendarat di halaman mana saja sesudah login (hash terakhir bertahan melewati
   logout) sedangkan fiturnya ada di halaman lain, dan WhatsNew hanya bisa
   pindah sendiri ke sana kalau halamannya disebutkan di sini.
   Sesudah [Selesai] user ditinggal di halaman fitur barunya — sengaja, supaya
   bisa langsung dicoba.
   ═══════════════════════════════════════ */

const WhatsNew = (() => {
  const RELEASES = [
    {
      id: "2026-07-31.1",
      title: "Apa yang Baru",
      subtitle: "Ada hal baru di halaman Overview: Trafic Bahan Karkas",
      page: "overview",
      // Panduannya membukakan sendiri tiap tampilan yang dijelaskan, jadi user
      // tinggal menekan Next dan melihat hasilnya — tidak perlu menebak tombol
      // mana yang harus ditekan lebih dulu.
      steps: [
        {
          spotlight: "trafficBody",
          note: "Ini grafik Trafic Bahan Karkas, coba geser jamnya, ganti tanggal, atau pilih BRD/KG. Tekan Next buat lihat detailnya.",
          // Panduannya bisa diputar ulang, jadi mulai dari keadaan awal:
          // tampilan grafik, arsiran departemen mati.
          action: () => {
            OverviewPage?.setTrafficDetail?.(false);
            OverviewPage?.setTrafficDeptMap?.(false);
          },
        },
        {
          spotlight: "trafficDetailBtn",
          note: 'Tombol ini "+ Detail data" buat ubah grafik dengan matriks rincian per material, tekan Next buat lanjutin.',
        },
        {
          spotlight: "trafficDetail",
          note: "Ini matriksnya, tiap baris satu ukuran karkas, tiap kolom satu jam. Navigasi tanggal dan pilihan BRD/KG di atas tetap bisa jalan di sini.",
          action: () => OverviewPage?.setTrafficDetail?.(true),
        },
        {
          spotlight: "tdtTotalRow",
          note: "Baris Total menjumlahkan tiap jam, dan kolom Total di ujung kanan menjumlahkan tiap material sepanjang hari. Tekan Next buat lihat arsiran warna departemen tujuan.",
        },
        {
          spotlight: "trafficDeptBtn",
          note: '"Map dept color" mengarsir tiap sel dengan warna departemen tujuan. Karkas ukuran tertentu pd jam tertentu yang dikirim ke lebih dari satu departemen diarsir bertumpuk.',
          action: () => OverviewPage?.setTrafficDeptMap?.(true),
        },
        {
          spotlight: "trafficDeptLegend",
          note: "Tiap warna di sini bisa diklik untuk dimatikan atau dinyalakan, berguna saat ingin memisahkan satu departemen dari sel yang isinya bertumpuk.",
        },
        {
          // Sengaja TANPA action: matriksnya harus masih terbuka supaya
          // tombolnya benar-benar terbaca "− Collapse data" saat disorot.
          spotlight: "trafficDetailBtn",
          note: 'Selagi matriksnya terbuka, tombol tadi berubah jadi "− Collapse data" itu jalan kembali ke grafik.',
        },
        {
          spotlight: "trafficBody",
          note: "Dan grafiknya balik seperti semula. selamat mencoba!",
          // Panduannya ditutup di tampilan awal, bukan di tengah matriks yang
          // masih terbuka dengan arsiran menyala.
          action: () => {
            OverviewPage?.setTrafficDetail?.(false);
            OverviewPage?.setTrafficDeptMap?.(false);
          },
        },
      ],
      // Rinciannya sengaja tidak diurai di sini — biar tidak dibaca dua kali.
      // Panduan langkah demi langkah di atas yang menjelaskannya sambil
      // membukakan tampilannya.
      items: [
        {
          icon: "📊",
          title: "Trafic Bahan Karkas",
          desc: "Grafik tta bahan karkas per jam. Kelihatan jam berapa tta bahan paling padat, lengkap dengan garis rata-rata bulan berjalan sebagai pembanding.",
        },
      ],
    },
    {
      id: "2026-07-28.2",
      title: "Apa yang Baru",
      subtitle: "Ada fitur baru di halaman Overview",
      page: "overview",
      spotlight: "trafficBody",
      spotlightNote:
        "Grafik barunya ada di sini — coba geser jam nya atau ganti tanggal dan pilih BRD/KG.",
      items: [
        {
          icon: "📊",
          title: "Trafic Bahan Karkas",
          desc: "Grafik tta bahan karkas per jam. Kelihatan jam berapa tta bahan paling padat, lengkap dengan garis rata-rata bulan berjalan sebagai pembanding.",
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
    const overlay = document.getElementById("whatsNewModal");
    if (!overlay) return null;

    // Lewat _steps, bukan rel.spotlight langsung: rilis berlangkah memakai
    // `steps` dan tidak punya `spotlight` sama sekali.
    const nextLabel = _steps(rel).length ? "Lihat fiturnya" : "Mengerti";

    overlay.innerHTML = `
      <div class="whatsnew-modal" role="dialog" aria-labelledby="whatsNewTitle">
        <button class="whatsnew-close" id="whatsNewSkip" aria-label="Tutup">&times;</button>
        <div class="whatsnew-header">
          <span class="whatsnew-badge">Baru</span>
          <h3 class="whatsnew-title" id="whatsNewTitle">${rel.title}</h3>
          <p class="whatsnew-subtitle">${rel.subtitle}</p>
        </div>
        <div class="whatsnew-list">
          ${rel.items
            .map(
              (it) => `
            <div class="whatsnew-item">
              <span class="whatsnew-item-icon">${it.icon}</span>
              <div class="whatsnew-item-text">
                <div class="whatsnew-item-title">${it.title}</div>
                <div class="whatsnew-item-desc">${it.desc}</div>
              </div>
            </div>`,
            )
            .join("")}
        </div>
        <button class="whatsnew-btn" id="whatsNewNext">${nextLabel}</button>
      </div>
    `;
    return overlay;
  }

  function _hideModal() {
    document.getElementById("whatsNewModal")?.classList.remove("show");
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

  // Body/documentElement seharusnya tidak pernah tergulir — layout aplikasi
  // memakai `.page-content` sebagai satu-satunya scroller. Kalau toh tergulir
  // (di mobile body punya sisa gulir setinggi toolbar browser), topbar ikut
  // terdorong keluar layar dan koordinat spotlight jadi meleset.
  function _resetOuterScroll() {
    const doc = document.scrollingElement || document.documentElement;
    if (doc && doc.scrollTop) doc.scrollTop = 0;
    if (document.body.scrollTop) document.body.scrollTop = 0;
  }

  // Halaman awal user bisa halaman apa saja: hash terakhir bertahan melewati
  // logout (logout me-reload halaman, tidak mengganti url), jadi yang logout
  // dari Karkas akan mendarat di Karkas lagi sesudah login. Fitur barunya pun
  // bisa ada di halaman mana saja — keduanya sering tidak sama. Tanpa pindah
  // halaman lebih dulu, panel targetnya tidak pernah muncul dan spotlight
  // batal diam-diam setelah menunggu 6 detik.
  //
  // Nama halaman = nilai data-page / data-page-table di sidebar (index.html),
  // mis. "overview", "karkas", "karkas-table". Salah tulis sengaja tidak
  // dinavigasikan: Navbar akan merender halaman "coming soon", dan user malah
  // terlempar ke halaman kosong gara-gara popup hiasan.
  function _ensurePage(page) {
    if (!page) return;
    if ((location.hash.slice(1) || "overview") === page) return;

    if (typeof Navbar === "undefined" || !Navbar.navigateTo) {
      console.warn(
        "[WhatsNew] Navbar tidak tersedia — tetap di halaman ini, spotlight kemungkinan gagal.",
      );
      return;
    }
    if (
      !document.querySelector(
        `.nav-item[data-page="${page}"], .nav-item[data-page-table="${page}"]`,
      )
    ) {
      console.warn(
        `[WhatsNew] halaman "${page}" tidak dikenal di sidebar — navigasi dilewati.`,
      );
      return;
    }
    Navbar.navigateTo(page);
  }

  // Entri lama cuma punya satu sorotan; diperlakukan sebagai panduan
  // berlangkah yang kebetulan panjangnya satu.
  function _steps(rel) {
    if (rel.steps?.length) return rel.steps;
    if (rel.spotlight) {
      return [{ spotlight: rel.spotlight, note: rel.spotlightNote }];
    }
    return [];
  }

  async function _showSpotlight(rel) {
    const layer = document.getElementById("whatsNewSpotlight");
    const steps = _steps(rel);
    if (!layer || !steps.length) {
      finish();
      return;
    }
    _ensurePage(rel.page);

    layer.innerHTML = `
      <div class="whatsnew-spot-hole" id="wnHole"></div>
      <div class="whatsnew-spot-caption" id="wnCaption">
        <div class="whatsnew-spot-text" id="wnText"></div>
        <div class="whatsnew-spot-actions">
          <span class="whatsnew-spot-count" id="wnCount"></span>
          <button class="whatsnew-spot-skip" id="wnSkip">Sudahi petunjuk</button>
          <button class="whatsnew-spot-btn" id="wnDone">Next</button>
        </div>
      </div>
    `;

    const hole = document.getElementById("wnHole");
    const caption = document.getElementById("wnCaption");
    const textEl = document.getElementById("wnText");
    const countEl = document.getElementById("wnCount");
    const nextBtn = document.getElementById("wnDone");
    const skipBtn = document.getElementById("wnSkip");

    // Id yang sedang disorot — dibaca position() tiap kali mengukur ulang.
    let current = steps[0].spotlight;

    function position() {
      // Sengaja dicari ulang tiap kali: halaman di-render ulang setelah
      // background load selesai, dan referensi lama jadi node terlepas
      // yang rect-nya nol.
      const el = document.getElementById(current);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pad = 6;
      hole.style.top = r.top - pad + "px";
      hole.style.left = r.left - pad + "px";
      hole.style.width = r.width + pad * 2 + "px";
      hole.style.height = r.height + pad * 2 + "px";

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
      caption.style.top = top + "px";
      caption.style.left = left + "px";
    }

    const scroller = document.querySelector(".page-content");

    // Sengaja TIDAK pakai scrollIntoView: metode itu menggulir semua ancestor
    // yang bisa digulir, termasuk body. Di mobile `.main` setinggi 100vh
    // (viewport besar, toolbar tersembunyi) sedangkan body cuma setinggi
    // viewport kecil, jadi body punya sisa gulir setinggi toolbar — dan
    // scrollIntoView memakainya, mendorong topbar keluar layar. Menggulir
    // container `.page-content` sendiri membuat body tidak pernah tersentuh.
    function scrollTargetIntoView(el) {
      if (!scroller) return;
      const r = el.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      // Panel yang lebih tinggi dari layar tidak boleh dipusatkan — bagian
      // atasnya (tempat grafiknya) malah terdorong keluar layar.
      const tall = r.height > sr.height * 0.8;
      const delta = tall
        ? r.top - sr.top - 12
        : r.top - sr.top - (sr.height - r.height) / 2;
      scroller.scrollTo({
        top: scroller.scrollTop + delta,
        behavior: "smooth",
      });
    }

    // Tunggu scroll halus selesai sebelum mengukur posisi akhirnya. Ukur ulang
    // beberapa kali sesudahnya: kalau _ensurePage baru saja pindah halaman,
    // datanya masih dimuat dan panelnya bisa berubah tinggi setelah lubang
    // spotlight terlanjur digambar. Alasan yang sama berlaku antar langkah —
    // action() bisa membuat tabel yang isinya baru selesai dihitung.
    let timers = [];
    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
    }

    function settle() {
      clearTimers();
      timers = [420, 1100, 2000].map((ms, i) =>
        setTimeout(() => {
          _resetOuterScroll();
          position();
          if (i === 0) layer.classList.add("show");
        }, ms),
      );
    }

    let idx = -1;
    // Langkahnya bisa menunggu elemen yang belum jadi. Tanpa penjaga ini,
    // klik Next kedua saat langkah pertama masih menunggu akan memakai idx
    // yang belum sempat maju — langkahnya jalan di tempat.
    let busy = false;

    async function goTo(i) {
      const step = steps[i];
      busy = true;
      clearTimers();

      // Langkahnya sering menjelaskan tampilan yang belum terbuka — bukakan
      // dulu, baru sasarannya dicari.
      try {
        await step.action?.();
      } catch (err) {
        console.warn("[WhatsNew] action langkah " + (i + 1) + " gagal:", err);
      }

      const el = await _waitFor(step.spotlight, 6000);
      if (!el) {
        console.warn(
          `[WhatsNew] elemen "${step.spotlight}" tidak muncul — panduan dihentikan.`,
        );
        busy = false;
        finish();
        return;
      }

      busy = false;
      idx = i;
      current = step.spotlight;
      textEl.textContent = step.note || "";
      // Nomor langkah disembunyikan kalau cuma ada satu — tidak ada yang
      // perlu dihitung.
      countEl.textContent =
        steps.length > 1 ? i + 1 + " / " + steps.length : "";
      const last = i === steps.length - 1;
      nextBtn.textContent = last ? "Selesai" : "Next";
      // Di langkah terakhir "Selesai" sudah menutup panduan — dua tombol
      // dengan akibat yang sama cuma bikin ragu.
      skipBtn.hidden = last;

      scrollTargetIntoView(el);
      settle();
    }

    window.addEventListener("resize", position);
    scroller?.addEventListener("scroll", position, { passive: true });
    nextBtn.addEventListener("click", () => {
      if (busy) return;
      if (idx >= steps.length - 1) finish();
      else goTo(idx + 1);
    });

    // Berhenti di tengah jalan. Tampilan panel dibiarkan apa adanya —
    // langkah terakhir yang mengembalikannya ke grafik memang sengaja
    // dilewati, jadi yang berhenti karena ingin langsung mencoba tidak
    // kehilangan tampilan yang sedang dilihatnya.
    skipBtn.addEventListener("click", finish);

    _cleanup = () => {
      clearTimers();
      window.removeEventListener("resize", position);
      scroller?.removeEventListener("scroll", position);
      layer.classList.remove("show");
      layer.innerHTML = "";
    };

    goTo(0);
  }

  // ══════ Alur ══════
  function maybeShow() {
    if (_shownThisSession) {
      console.log("[WhatsNew] dilewati: sudah tampil di sesi ini.");
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
    if (document.getElementById("whatsNewModal")?.classList.contains("show")) {
      console.log("[WhatsNew] dilewati: popup sudah terbuka.");
      return;
    }

    const rel = _release();
    if (!rel) {
      console.warn(
        "[WhatsNew] tidak ada entri RELEASES untuk versi " + VERSION,
      );
      return;
    }

    const overlay = _renderModal(rel);
    if (!overlay) {
      console.warn(
        "[WhatsNew] elemen #whatsNewModal tidak ada di halaman — index.html kemungkinan masih versi lama (cache). Coba Ctrl+Shift+R.",
      );
      return;
    }

    _shownThisSession = true;

    // Beri jeda supaya tidak bertabrakan dengan toast "welcome".
    setTimeout(() => {
      overlay.classList.add("show");

      document.getElementById("whatsNewNext")?.addEventListener("click", () => {
        _hideModal();
        if (_steps(rel).length) _showSpotlight(rel);
        else finish();
      });

      // Lapisan latar tembus klik supaya halaman tetap bisa digulir, jadi
      // jalan keluarnya lewat tombol × ini — bukan klik latar.
      document
        .getElementById("whatsNewSkip")
        ?.addEventListener("click", finish);
    }, 900);
  }

  function finish() {
    _hideModal();
    if (_cleanup) {
      _cleanup();
      _cleanup = null;
    }
  }

  return { maybeShow, show, finish, VERSION };
})();
