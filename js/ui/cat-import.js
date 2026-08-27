/* ═══════════════════════════════════════
   CAT-IMPORT.JS — Import kamus kategori material

   Dipanggil router di import.js begitu file yang dibaca punya kolom "Cat"
   tapi tidak punya "Mvt Type". Memakai gate yang sama dengan importer lain:
     1 validasi kolom  2 parsing baris  3 dedupe  4 simpan ke server

   Yang masuk ke sini bukan data harian melainkan reference data: peta kode
   material → kategori produk, isi tabel dept_categorized. Tidak ada kolom
   dept — kategori itu sifat materialnya, dan dept dibaca dari data bulanan
   waktu menghitung. Jadi satu file bisa dipakai dept mana pun, dan file dept
   lain nanti tinggal menambah materialnya ke tabel yang sama.
   ═══════════════════════════════════════ */

const CatImportUI = (() => {

  // ── Kolom wajib ──
  const REQUIRED_COLS = ['material', 'cat'];

  // ── Kolom opsional ──
  // Deskripsi cuma disimpan sebagai penolong baca waktu tabelnya disunting
  // manual di Supabase; app sendiri tidak memakainya.
  const OPTIONAL_COLS = ['material description'];

  // ── Normalisasi judul kolom ── (sama seperti tta-import.js)
  function norm(s) {
    return String(s === null || s === undefined ? '' : s).toLowerCase().trim().replace(/\s+/g, ' ');
  }
  function tight(s) {
    return norm(s).replace(/ /g, '');
  }

  function findCol(headerRow, name) {
    let idx = headerRow.indexOf(norm(name));
    if (idx !== -1) return idx;
    // Toleransi spasi: 'Material Description' tetap ketemu sebagai
    // 'materialdescription'.
    const t = tight(name);
    for (let i = 0; i < headerRow.length; i++) {
      if (tight(headerRow[i]) === t) return i;
    }
    return -1;
  }

  // ══════ Entry point dari router import.js ══════
  async function process(json) {
    try {
      // ══════ Gate 1: Validasi kolom ══════
      showOverlay('VALIDASI KOLOM KATEGORI...');
      const headerRow = json[0].map(norm);
      const colMap = {};
      [...REQUIRED_COLS, ...OPTIONAL_COLS].forEach(name => {
        const idx = findCol(headerRow, name);
        if (idx !== -1) colMap[name] = idx;
      });

      console.log('[Cat Import] Headers:', headerRow);

      const missing = REQUIRED_COLS.filter(c => colMap[c] === undefined);
      if (missing.length) {
        hideOverlay();
        toast('Kolom wajib tidak ditemukan: ' + missing.join(', '), 'error');
        return;
      }

      // ══════ Gate 2: Parsing baris ══════
      showOverlay('PARSING KATEGORI...');
      const parsed = [];
      let skipped = 0;
      const skipReasons = { empty: 0, noMat: 0, noCat: 0 };

      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (!row || !row.length) { skipped++; skipReasons.empty++; continue; }

        const mat = String(row[colMap['material']] || '').trim().toUpperCase();
        const cat = String(row[colMap['cat']] || '').trim().toUpperCase();
        if (!mat || !cat) {
          skipped++;
          if (!mat) skipReasons.noMat++;
          if (!cat) skipReasons.noCat++;
          continue;
        }

        const matdesc = colMap['material description'] !== undefined
          ? String(row[colMap['material description']] || '').trim().toUpperCase()
          : '';

        parsed.push({ mat, category: cat, matdesc });
      }

      console.log('[Cat Import] Skip reasons:', JSON.stringify(skipReasons));

      if (!parsed.length) {
        hideOverlay();
        toast('Tidak ada baris kategori yang valid di file'
          + (skipped ? ' (' + skipped + ' dilewati)' : ''), 'error');
        return;
      }

      // ══════ Gate 3: Dedupe ══════
      // Kode yang sama muncul dua kali di file berarti yang terakhir yang
      // dimaksud. Tanpa ini upsert-nya menolak: satu batch tidak boleh memuat
      // dua baris dengan primary key yang sama.
      const byMat = new Map();
      parsed.forEach(r => byMat.set(r.mat, r));
      const rows = [...byMat.values()];
      const dupes = parsed.length - rows.length;

      // ══════ Gate 4: Simpan ke server ══════
      showOverlay('MENYIMPAN KAMUS...');
      try {
        await DB.upsertDeptCategories(rows);
      } catch (err) {
        hideOverlay();
        toast('Error menyimpan kamus kategori: ' + err.message, 'error');
        return;
      }

      // ══════ Sesudah simpan: muat ulang peta & gambar ulang halaman ══════
      // Data bulanan tidak berubah, jadi App.loadFromDB() berlebihan — cukup
      // ambil ulang kamusnya lalu render ulang halaman yang sedang terbuka,
      // supaya section yang memakainya langsung memperlihatkan angka baru.
      showOverlay('MEMPROSES...');
      const saved = await DB.getDeptCategories();
      Engine.setDeptCategories(saved);

      try {
        Navbar.navigateTo(location.hash.slice(1) || 'overview');
      } catch (err) {
        console.warn('[Cat Import] gagal menggambar ulang halaman:', err);
      }

      hideOverlay();

      const nCat = new Set(rows.map(r => r.category)).size;
      const skippedMsg = skipped > 0 ? ', ' + skipped + ' dilewati' : '';
      const dupeMsg = dupes > 0 ? ', ' + dupes + ' duplikat digabung' : '';
      toast('✓ [Kategori] ' + rows.length + ' material · ' + nCat + ' kategori'
        + skippedMsg + dupeMsg, 'success');

    } catch (err) {
      console.error('Cat import error:', err);
      hideOverlay();
      toast('Error: ' + err.message, 'error');
    }
  }

  // ── Overlay & toast (pakai elemen yang sama dengan import biasa) ──
  function showOverlay(text) {
    const el = document.getElementById('importOverlay');
    const label = el?.querySelector('.import-label');
    if (el) el.classList.add('show');
    if (label) label.textContent = text || 'MEMPROSES...';
  }

  function hideOverlay() {
    document.getElementById('importOverlay')?.classList.remove('show');
  }

  function toast(msg, type) {
    ImportUI.showToast(msg, type);
  }

  return { process };
})();
