/* ═══════════════════════════════════════
   TTA-IMPORT.JS — TTA Excel Import Handler

   Dipanggil oleh router di import.js setelah file dibaca.
   Memakai gate yang sama dengan import.js:
     1 validasi kolom  2 parsing baris  3 normalisasi
     4 lookup auto-grow  5 simpan ke server
   ═══════════════════════════════════════ */

const TTAImportUI = (() => {

  // ── Kolom wajib (dicocokkan persis, bukan "mengandung") ──
  const REQUIRED_COLS = [
    'prod version', 'proses order date', 'material', 'sloc',
    'qty(ekor)', 'qty(kg)', 'create date', 'create time'
  ];

  // ── Kolom opsional ──
  // 'departement asal' & 'departement tujuan' memang sering kosong isinya,
  // tapi minimal salah satu kolomnya harus ada di header.
  const OPTIONAL_COLS = [
    'material description', 'qty(kg) asli',
    'departement asal', 'departement tujuan', 'plant'
  ];

  const CHUNK = 20000;  // baris per chunk, supaya overlay sempat ter-render

  // ── Normalisasi judul kolom ──
  // Kurung TIDAK dibuang: 'qty kg' (file lama) harus tetap beda dari 'qty(kg)'.
  function norm(s) {
    return String(s === null || s === undefined ? '' : s).toLowerCase().trim().replace(/\s+/g, ' ');
  }
  function tight(s) {
    return norm(s).replace(/ /g, '');
  }

  function findCol(headerRow, name) {
    let idx = headerRow.indexOf(norm(name));
    if (idx !== -1) return idx;
    // Toleransi spasi: 'Qty (Kg)' tetap ketemu sebagai 'qty(kg)'.
    const t = tight(name);
    for (let i = 0; i < headerRow.length; i++) {
      if (tight(headerRow[i]) === t) return i;
    }
    return -1;
  }

  // ══════ Entry point dari router import.js ══════
  async function process(json) {
    try {
      // ══════ Gate 1: Column Validation ══════
      showOverlay('VALIDASI KOLOM TTA...');
      const headerRow = json[0].map(norm);
      const colMap = {};
      [...REQUIRED_COLS, ...OPTIONAL_COLS].forEach(name => {
        const idx = findCol(headerRow, name);
        if (idx !== -1) colMap[name] = idx;
      });

      console.log('[TTA Import] Headers:', headerRow);
      console.log('[TTA Import] Column map:', JSON.stringify(colMap));

      const missing = REQUIRED_COLS.filter(c => colMap[c] === undefined);
      if (missing.length) {
        hideOverlay();
        toast('Kolom wajib TTA tidak ditemukan: ' + missing.join(', '), 'error');
        return;
      }
      if (colMap['departement asal'] === undefined && colMap['departement tujuan'] === undefined) {
        hideOverlay();
        toast('Kolom Departement Asal / Tujuan tidak ditemukan', 'error');
        return;
      }

      // ══════ Muat kamus yang sudah tersimpan ══════
      // WAJIB dilakukan sebelum growLookup dipanggil. Kalau dilewat, index
      // kamus mulai dari 0 lagi dan seluruh data TTA lama jadi salah baca.
      showOverlay('MEMUAT KAMUS TTA...');
      TTAEngine.setLookups(await TTADB.getLookups());

      // ══════ Gate 2-4: Parsing + Normalisasi + Lookup Auto-Grow ══════
      const cOrderDate = colMap['proses order date'];
      const cCreateDate = colMap['create date'];
      const cAsal = colMap['departement asal'];
      const cTujuan = colMap['departement tujuan'];
      const cMd = colMap['material description'];
      const cAsli = colMap['qty(kg) asli'];

      const indexedRows = [];
      let skipped = 0;
      const skipReasons = { empty: 0, noOrderDate: 0, noCreateDate: 0, noDept: 0 };

      const total = json.length - 1;
      for (let i = 1; i < json.length; i++) {
        if (i % CHUNK === 0) {
          showOverlay('PARSING DATA TTA... ' + Math.round(i / total * 100) + '%');
          await new Promise(r => setTimeout(r, 0));
        }

        const row = json[i];
        if (!row || !row.length) { skipped++; skipReasons.empty++; continue; }

        const date = parseDate(row[cOrderDate]);
        if (!date) {
          skipped++; skipReasons.noOrderDate++;
          if (i <= 3) console.log('[TTA Import] Row', i, 'bad order date:', JSON.stringify(row[cOrderDate]));
          continue;
        }

        const createDate = parseDate(row[cCreateDate]);
        if (!createDate) {
          skipped++; skipReasons.noCreateDate++;
          if (i <= 3) console.log('[TTA Import] Row', i, 'bad create date:', JSON.stringify(row[cCreateDate]));
          continue;
        }

        const asal = cAsal !== undefined ? String(row[cAsal] || '').toUpperCase().trim() : '';
        const tujuan = cTujuan !== undefined ? String(row[cTujuan] || '').toUpperCase().trim() : '';
        if (!asal && !tujuan) { skipped++; skipReasons.noDept++; continue; }

        const kg = parseFloat(row[colMap['qty(kg)']]) || 0;
        const kgAsli = cAsli !== undefined ? (parseFloat(row[cAsli]) || 0) : kg;

        indexedRows.push([
          TTAEngine.growLookup('pv', String(row[colMap['prod version']] || '').toUpperCase().trim()),
          TTAEngine.growLookup('mat', String(row[colMap['material']] || '').trim()),
          TTAEngine.growLookup('md', cMd !== undefined ? String(row[cMd] || '').toUpperCase().trim() : ''),
          TTAEngine.growLookup('sloc', String(row[colMap['sloc']] || '').toUpperCase().trim()),
          parseInt(row[colMap['qty(ekor)']]) || 0,
          kg,
          kgAsli,
          TTAEngine.growLookup('dept', asal),
          TTAEngine.growLookup('dept', tujuan),
          date,
          daysBetween(date, createDate),
          parseHour(row[colMap['create time']]),
        ]);
      }

      console.log('[TTA Import] Skip reasons:', JSON.stringify(skipReasons));

      if (!indexedRows.length) {
        hideOverlay();
        toast('Tidak ada data TTA valid di file' + (skipped ? ' (' + skipped + ' rows dilewati)' : ''), 'error');
        return;
      }

      // ══════ Gate 5: Simpan ke server ══════
      showOverlay('MENYIMPAN DATA TTA...');
      let result;
      try {
        result = await TTADB.upsertByDate(indexedRows, TTAEngine.getLookups());
      } catch (err) {
        hideOverlay();
        toast('Error menyimpan data TTA: ' + err.message, 'error');
        return;
      }

      hideOverlay();

      const sortedDates = result.dates.slice().sort();
      const dateStr = sortedDates.length === 1
        ? sortedDates[0]
        : sortedDates[0] + ' s/d ' + sortedDates[sortedDates.length - 1];
      const skippedMsg = skipped > 0 ? ', ' + skipped + ' dilewati' : '';
      const replacedMsg = result.replaced > 0 ? ' (replaced ' + result.replaced + ' existing rows)' : '';
      toast('✓ [TTA] ' + result.inserted + ' rows imported (' + dateStr + ')' + skippedMsg + replacedMsg, 'success');

    } catch (err) {
      console.error('TTA import error:', err);
      hideOverlay();
      toast('Error: ' + err.message, 'error');
    }
  }

  // ── Parse date: Excel serial, Date object, atau string ──
  function parseDate(val) {
    if (val === null || val === undefined || val === '') return null;

    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      return formatYMD(val);
    }

    const s = String(val).trim();

    if (/^\d{5}(\.\d+)?$/.test(s)) {
      const d = XLSX.SSF.parse_date_code(parseFloat(s));
      if (d && d.y && d.m && d.d) return pad4(d.y) + '-' + pad2(d.m) + '-' + pad2(d.d);
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(s.slice(0, 10));
      return isNaN(d.getTime()) ? null : s.slice(0, 10);
    }

    const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (m) {
      const dt = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
      return isNaN(dt.getTime()) ? null : formatYMD(dt);
    }

    return null;
  }

  // ── Create Time: angka jam 0-23, bukan pecahan waktu ──
  function parseHour(val) {
    if (val === null || val === undefined || val === '') return 0;
    const n = parseFloat(val);
    if (isNaN(n)) return 0;
    // Kalau file di-export ulang, jam bisa jadi pecahan hari (0.5 = jam 12).
    if (n > 0 && n < 1) return Math.floor(n * 24);
    return Math.max(0, Math.min(23, Math.floor(n)));
  }

  function daysBetween(a, b) {
    return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  }

  function formatYMD(d) {
    return pad4(d.getUTCFullYear()) + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function pad4(n) { return String(n).padStart(4, '0'); }

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
