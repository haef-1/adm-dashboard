/* ═══════════════════════════════════════
   TTA-TRANSFORM.JS — TTA Data Engine
   Transfer antar departemen (Departement Asal → Tujuan)
   ═══════════════════════════════════════ */

const TTAEngine = (() => {
  // ── Row layout (12 fields, indexed like RAW_DB) ──
  //  0 pv       → R_PV        6 kgAsli    Qty(Kg) asli
  //  1 mat      → R_MAT       7 asal      → R_DEPT, -1 = null
  //  2 matdesc  → R_MD        8 tujuan    → R_DEPT, -1 = null
  //  3 sloc     → R_SLOC      9 date      'YYYY-MM-DD' (Proses Order Date)
  //  4 ekor     Qty(Ekor)    10 dLag      createDate - date, in days
  //  5 kg       Qty(Kg)      11 hour      0-23 (Create Time)
  const F = {
    PV: 0, MAT: 1, MD: 2, SLOC: 3, EKOR: 4, KG: 5,
    KG_ASLI: 6, ASAL: 7, TUJUAN: 8, DATE: 9, DLAG: 10, HOUR: 11,
  };

  // ── Lookup Tables (loaded from meta.tta_lookups) ──
  let R_PV = [];
  let R_MAT = [];
  let R_MD = [];
  let R_SLOC = [];
  let R_DEPT = [];

  // ── In-memory data ──
  let RAW_TTA = [];

  // ── Precomputed indices ──
  let _rowsByDate = new Map();
  let _dateSet = new Set();
  let _allDates = [];

  // ── Setter for lookup tables ──
  function setLookups(lookups) {
    if (lookups.pv) R_PV = lookups.pv;
    if (lookups.mat) R_MAT = lookups.mat;
    if (lookups.md) R_MD = lookups.md;
    if (lookups.sloc) R_SLOC = lookups.sloc;
    if (lookups.dept) R_DEPT = lookups.dept;
    _rebuildReverseMaps();
  }

  function getLookups() {
    return { pv: R_PV, mat: R_MAT, md: R_MD, sloc: R_SLOC, dept: R_DEPT };
  }

  // ── Auto-grow lookup: return index, add if new ──
  const LOOKUP_MAP = { pv: () => R_PV, mat: () => R_MAT, md: () => R_MD, sloc: () => R_SLOC, dept: () => R_DEPT };
  const LOOKUP_RMAP = {};

  function _rebuildReverseMaps() {
    Object.keys(LOOKUP_MAP).forEach(type => {
      const arr = LOOKUP_MAP[type]();
      const m = new Map();
      for (let i = 0; i < arr.length; i++) m.set(arr[i], i);
      LOOKUP_RMAP[type] = m;
    });
  }

  // Returns -1 for blank values — Departement Asal/Tujuan are often empty.
  function growLookup(type, value) {
    if (value === null || value === undefined || value === '') return -1;
    let rmap = LOOKUP_RMAP[type];
    if (!rmap) { rmap = new Map(); LOOKUP_RMAP[type] = rmap; }
    let idx = rmap.get(value);
    if (idx === undefined) {
      const arr = LOOKUP_MAP[type]();
      idx = arr.length;
      arr.push(value);
      rmap.set(value, idx);
    }
    return idx;
  }

  // ── Date helper: 'YYYY-MM-DD' + n days ──
  function addDays(ymd, n) {
    if (!n) return ymd;
    const d = new Date(ymd + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // ── Set data and rebuild indices ──
  function setRawDB(rows) {
    RAW_TTA = rows;
    _rowsByDate = new Map();
    _dateSet = new Set();
    _processRows(RAW_TTA);
    _finalize();
  }

  function appendRows(newRows) {
    for (let i = 0; i < newRows.length; i++) RAW_TTA.push(newRows[i]);
    _processRows(newRows);
    _finalize();
  }

  function _processRows(rows) {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const date = r[F.DATE];
      _dateSet.add(date);
      let bucket = _rowsByDate.get(date);
      if (!bucket) { bucket = []; _rowsByDate.set(date, bucket); }
      bucket.push(r);
    }
  }

  function _finalize() {
    _allDates = [..._dateSet].sort();
  }

  function getRawDB() { return RAW_TTA; }
  function getAllDates() { return _allDates; }

  function getRowsForDates(dateArr) {
    const result = [];
    for (const d of dateArr) {
      const rows = _rowsByDate.get(d);
      if (rows) for (let i = 0; i < rows.length; i++) result.push(rows[i]);
    }
    return result;
  }

  // ── Decode row ──
  function rRow(r) {
    const date = r[F.DATE];
    return {
      pv: R_PV[r[F.PV]],
      mat: R_MAT[r[F.MAT]],
      matdesc: R_MD[r[F.MD]],
      sloc: R_SLOC[r[F.SLOC]],
      ekor: r[F.EKOR],
      kg: r[F.KG],
      kgAsli: r[F.KG_ASLI],
      asal: r[F.ASAL] === -1 ? null : R_DEPT[r[F.ASAL]],
      tujuan: r[F.TUJUAN] === -1 ? null : R_DEPT[r[F.TUJUAN]],
      date: date,
      createDate: addDays(date, r[F.DLAG]),
      hour: r[F.HOUR],
      // Jam sejak tengah malam tanggal order — dasar metrik TTA.
      lagHours: r[F.DLAG] * 24 + r[F.HOUR],
      // Selisih timbangan: 0 untuk ~98.6% baris.
      selisihKg: Math.round((r[F.KG] - r[F.KG_ASLI]) * 1000) / 1000,
    };
  }

  return {
    F, setLookups, getLookups, growLookup, addDays,
    setRawDB, appendRows, getRawDB, getAllDates, getRowsForDates, rRow,
  };
})();
