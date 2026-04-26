/* ═══════════════════════════════════════
   IMPORT.JS — Excel Import Handler (v3 Gate-Based)
   ═══════════════════════════════════════ */

const ImportUI = (() => {

  // ── 9 kolom wajib (case-insensitive match) ──
  const REQUIRED_COLS = [
    'order', 'departemen', 'prod version', 'material',
    'mvt type', 'qty brd', 'qty kg', 'post date', 'sloc'
  ];

  // ── Kolom opsional ──
  const OPTIONAL_COLS = ['plant', 'material description', 'amount'];

  // ── Gate 3: MVT alias normalization ──
  const MVT_ALIASES = {
    'BY-PRODUCT': 'BY PRODUCT',
    'BYPROD':     'BY PRODUCT',
    'BY PROD':    'BY PRODUCT',
    'SUSUT+':     'SUSUT (+)',
    'SUSUT (+)':  'SUSUT (+)',
    'SUSUT(+)':   'SUSUT (+)',
    'SUSUT-':     'SUSUT (-)',
    'SUSUT (-)':  'SUSUT (-)',
    'SUSUT(-)':   'SUSUT (-)',
    'HASIL':      'HASIL',
    'BAHAN':      'BAHAN',
    'BY PRODUCT': 'BY PRODUCT',
    'SUSUT ( )':  'SUSUT ( )',
  };

  function init() {
    const btn = document.getElementById('btnImport');
    const input = document.getElementById('fileImport');
    if (!btn || !input) return;

    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', handleFile);

    const clearBtn = document.getElementById('btnClearDB');
    if (clearBtn) clearBtn.addEventListener('click', handleClearDB);
  }

  async function handleClearDB() {
    if (!confirm('Hapus semua data dari database?\nAnda perlu import ulang setelah ini.')) return;

    try {
      showOverlay('MENGHAPUS DATA...');
      await DB.clearAll();
      Engine.setRawDB([]);
      Engine.setLookups({});
      hideOverlay();
      showToast('Database berhasil dihapus. Silakan import ulang.', 'success');
      location.reload();
    } catch (err) {
      hideOverlay();
      showToast('Gagal menghapus: ' + err.message, 'error');
    }
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    showOverlay('MEMBACA FILE...');

    try {
      // ── Read file ──
      const arrayBuffer = await readFileAsArray(file);
      let wb;
      try {
        wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
      } catch (_) {
        hideOverlay();
        showToast('Gagal membaca file', 'error');
        return;
      }

      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
      if (!json.length) {
        hideOverlay();
        showToast('Tidak ada data valid di file', 'error');
        return;
      }

      // ══════ Gate 1: Column Validation ══════
      showOverlay('VALIDASI KOLOM...');
      const headerRow = json[0].map(h => String(h || '').toLowerCase().trim());
      const colMap = {};
      [...REQUIRED_COLS, ...OPTIONAL_COLS].forEach(name => {
        const idx = headerRow.indexOf(name);
        if (idx !== -1) colMap[name] = idx;
      });

      console.log('[Import Debug] Headers:', headerRow);
      console.log('[Import Debug] Column map:', JSON.stringify(colMap));
      console.log('[Import Debug] First data row:', JSON.stringify(json[1]?.slice(0, 12)));

      const missing = REQUIRED_COLS.filter(c => colMap[c] === undefined);
      if (missing.length) {
        hideOverlay();
        showToast('Kolom wajib tidak ditemukan: ' + missing.join(', '), 'error');
        return;
      }

      // ══════ Gate 2 + 3: Row Parsing, Validation & MVT Normalization ══════
      showOverlay('PARSING DATA...');
      const parsed = [];
      let skipped = 0;
      let skipReasons = { empty: 0, noDept: 0, noMvt: 0, noDate: 0 };

      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (!row || !row.length) { skipped++; skipReasons.empty++; continue; }

        const rawDept = String(row[colMap['departemen']] || '').trim();
        const rawMvt  = String(row[colMap['mvt type']] || '').trim();
        if (!rawDept || !rawMvt) {
          skipped++;
          if (!rawDept) skipReasons.noDept++;
          if (!rawMvt) skipReasons.noMvt++;
          if (i <= 3) console.log('[Import Debug] Row', i, '| dept:', JSON.stringify(rawDept), '| mvt:', JSON.stringify(rawMvt), '| raw:', JSON.stringify(row.slice(0, 10)));
          continue;
        }

        const rawDate = row[colMap['post date']];
        const date = parseDate(rawDate);
        if (!date) {
          skipped++; skipReasons.noDate++;
          if (i <= 3) console.log('[Import Debug] Row', i, '| bad date:', JSON.stringify(rawDate), '| raw:', JSON.stringify(row.slice(0, 10)));
          continue;
        }
        if (i <= 5) console.log('[Import Debug] Row', i, '| rawDate:', JSON.stringify(rawDate), '| parsed:', date);

        const dept    = rawDept.toUpperCase();
        const pv      = String(row[colMap['prod version']] || '').toUpperCase().trim();
        const order   = String(row[colMap['order']] || '').trim();
        const mat     = String(row[colMap['material']] || '').toUpperCase().trim();
        const matdesc = colMap['material description'] !== undefined
          ? String(row[colMap['material description']] || '').toUpperCase().trim() : '';
        const sloc    = String(row[colMap['sloc']] || '').toUpperCase().trim();

        // Gate 3: MVT normalization
        const mvtUpper = rawMvt.toUpperCase();
        const mvt = MVT_ALIASES[mvtUpper] || mvtUpper;

        const brd = parseInt(row[colMap['qty brd']]) || 0;
        const kg  = parseFloat(row[colMap['qty kg']]) || 0;
        const amount = colMap['amount'] !== undefined
          ? (parseFloat(row[colMap['amount']]) || 0) / 1000 : 0;

        parsed.push({ dept, pv, order, mat, matdesc, mvt, brd, kg, date, sloc, amount });
      }

      console.log('[Import Debug] Skip reasons:', JSON.stringify(skipReasons));

      if (!parsed.length) {
        hideOverlay();
        showToast('Tidak ada data valid di file' + (skipped ? ' (' + skipped + ' rows dilewati)' : ''), 'error');
        return;
      }

      // ══════ Gate 4: Lookup Auto-Grow + Convert to Indexed Format ══════
      showOverlay('MENYIMPAN DATA...');

      const indexedRows = parsed.map(r => [
        Engine.growLookup('dept', r.dept),
        Engine.growLookup('pv', r.pv),
        Engine.growLookup('order', r.order),
        Engine.growLookup('mat', r.mat),
        Engine.growLookup('matdesc', r.matdesc),
        Engine.growLookup('mvt', r.mvt),
        r.brd,
        r.kg,
        r.date,
        Engine.growLookup('sloc', r.sloc),
        r.amount,
      ]);

      const updatedLookups = Engine.getLookups();

      // ══════ Gate 5: Save to server ══════
      let result;
      try {
        result = await DB.upsertByDate(indexedRows, updatedLookups);
      } catch (err) {
        hideOverlay();
        showToast('Error menyimpan data: ' + err.message, 'error');
        return;
      }

      // ══════ Post-Import: Reload & Refresh ══════
      showOverlay('MEMPROSES...');
      await App.loadFromDB();

      hideOverlay();

      const sortedDates = result.dates.slice().sort();
      const dateStr = sortedDates.length === 1
        ? sortedDates[0]
        : sortedDates[0] + ' s/d ' + sortedDates[sortedDates.length - 1];
      const skippedMsg = skipped > 0 ? ', ' + skipped + ' dilewati' : '';
      const replacedMsg = result.replaced > 0 ? ' (replaced ' + result.replaced + ' existing rows)' : '';
      showToast('\u2713 ' + result.inserted + ' rows imported (' + dateStr + ')' + skippedMsg + replacedMsg, 'success');

    } catch (err) {
      console.error('Import error:', err);
      hideOverlay();
      showToast('Error: ' + err.message, 'error');
    }
  }

  // ── Parse date: handle Excel serial, Date object, or string ──
  function parseDate(val) {
    if (val == null || val === '') return null;

    // Already a Date object (cellDates: true)
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      return formatYMD(val);
    }

    const s = String(val).trim();

    // Excel serial number
    if (/^\d{5}(\.\d+)?$/.test(s)) {
      const serial = parseFloat(s);
      const d = XLSX.SSF.parse_date_code(serial);
      if (d && d.y && d.m && d.d) {
        return pad4(d.y) + '-' + pad2(d.m) + '-' + pad2(d.d);
      }
      return null;
    }

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(s.slice(0, 10));
      return isNaN(d.getTime()) ? null : s.slice(0, 10);
    }

    // DD.MM.YYYY or DD/MM/YYYY
    const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (m) {
      const dt = new Date(+m[3], +m[2] - 1, +m[1]);
      return isNaN(dt.getTime()) ? null : formatYMD(dt);
    }

    return null;
  }

  function formatYMD(d) {
    return pad4(d.getUTCFullYear()) + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function pad4(n) { return String(n).padStart(4, '0'); }

  // ── Read file as ArrayBuffer ──
  function readFileAsArray(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ── Overlay ──
  function showOverlay(text) {
    const el = document.getElementById('importOverlay');
    const label = el?.querySelector('.import-label');
    if (el) el.classList.add('show');
    if (label) label.textContent = text || 'MEMPROSES...';
  }

  function hideOverlay() {
    document.getElementById('importOverlay')?.classList.remove('show');
  }

  // ── Toast ──
  function showToast(msg, type) {
    const el = document.getElementById('importToast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'import-toast ' + type + ' show';
    setTimeout(() => el.classList.remove('show'), 4000);
  }

  return { init, showToast };
})();
