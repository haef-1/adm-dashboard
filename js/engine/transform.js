/* ═══════════════════════════════════════
   TRANSFORM.JS — Data Processing Engine
   ═══════════════════════════════════════ */

const Engine = (() => {
  // ── Lookup Tables (from v3, will be updated on import) ──
  let R_DEPT = [];
  let R_PV = [];
  let R_ORDER = [];
  let R_MAT = [];
  let R_MATDESC = [];
  const R_MVT = ["HASIL","BAHAN","BY PRODUCT","SUSUT (+)","SUSUT (-)","SUSUT ( )"];
  const R_SLOC = ["FROZEN","CRP","FRESH","STAGING RM","PACKAGING","REPRO","LIVEBIRD","STAGING FG"];

  // ── In-memory data ──
  let RAW_DB = [];
  let YIELD_DATA = [];
  let ALL_RAW = [];

  // ── Precomputed indices (built once in buildDerivedData) ──
  let _allDates = [];
  let _yieldByDate = {};
  let _susutByDate = {};
  let _bahanDistByDate = {};
  let _rowsByDate = new Map();
  let _dateSet = new Set();

  // ── Livebird S/M/L mapping (mat code → category) ──
  const LB_SIZE_MAP = {
    '17002566': 'Small',
    '17002568': 'Small',
    '17002569': 'Small',
    '17002570': 'Medium',
    '17002571': 'Medium',
    '17002572': 'Large',
    '17002573': 'Large',
  };

  // ── Distribution dept list ──
  const DIST_DEPTS = new Set(['AU','CUT UP','BONELESS BONGKAR','BONELESS MIX','PARTING']);

  // ── Setter for lookup tables ──
  function setLookups(lookups) {
    if (lookups.dept) R_DEPT = lookups.dept;
    if (lookups.pv) R_PV = lookups.pv;
    if (lookups.order) R_ORDER = lookups.order;
    if (lookups.mat) R_MAT = lookups.mat;
    if (lookups.matdesc) R_MATDESC = lookups.matdesc;
    if (lookups.mvt) { R_MVT.length = 0; lookups.mvt.forEach(v => R_MVT.push(v)); }
    if (lookups.sloc) { R_SLOC.length = 0; lookups.sloc.forEach(v => R_SLOC.push(v)); }
    _rebuildReverseMaps();
  }

  // ── Auto-grow lookup: return index, add if new ──
  const LOOKUP_MAP = { dept: () => R_DEPT, pv: () => R_PV, order: () => R_ORDER, mat: () => R_MAT, matdesc: () => R_MATDESC, mvt: () => R_MVT, sloc: () => R_SLOC };
  const LOOKUP_RMAP = {};

  function _rebuildReverseMaps() {
    Object.keys(LOOKUP_MAP).forEach(type => {
      const arr = LOOKUP_MAP[type]();
      const m = new Map();
      for (let i = 0; i < arr.length; i++) m.set(arr[i], i);
      LOOKUP_RMAP[type] = m;
    });
  }

  function growLookup(type, value) {
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

  // ── Set RAW_DB and rebuild derived data ──
  function setRawDB(rows) {
    RAW_DB = rows;
    buildDerivedData();
  }

  function getRawDB() { return RAW_DB; }
  function getYieldData() { return YIELD_DATA; }
  function getAllRaw() { return ALL_RAW; }
  function getLookups() {
    return { dept: R_DEPT, pv: R_PV, order: R_ORDER, mat: R_MAT, matdesc: R_MATDESC, mvt: R_MVT, sloc: R_SLOC };
  }

  // ── Decode row ──
  function rRow(r) {
    return {
      dept: R_DEPT[r[0]], pv: R_PV[r[1]], order: R_ORDER[r[2]],
      mat: R_MAT[r[3]], matdesc: R_MATDESC[r[4]], mvt: R_MVT[r[5]],
      brd: r[6], kg: r[7], date: r[8], sloc: R_SLOC[r[9]],
      amount: r[10] * 1000,
    };
  }

  function _cleanGrade(matdesc) {
    return matdesc.replace(/^KARKAS\s*\(\s*/, '').replace(/\s*\)\s*$/, '').replace(/\s*-\s*/g, '-').trim();
  }

  // ── Process rows into indices (used by both full build and incremental append) ──
  function _processRows(rows) {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]],
            sloc = R_SLOC[r[9]], matdesc = R_MATDESC[r[4]], date = r[8];

      _dateSet.add(date);

      let bucket = _rowsByDate.get(date);
      if (!bucket) { bucket = []; _rowsByDate.set(date, bucket); }
      bucket.push(r);

      if (dept === 'KARKAS' && pv === 'AYAM BARU' &&
          (mvt === 'BAHAN' || mvt === 'HASIL' || mvt === 'BY PRODUCT')) {
        if (!_yieldByDate[date]) _yieldByDate[date] = { bahan: 0, hasil: 0, byprod: 0 };
        if (mvt === 'BAHAN') _yieldByDate[date].bahan += r[7];
        else if (mvt === 'HASIL') _yieldByDate[date].hasil += r[7];
        else _yieldByDate[date].byprod += r[7];
      }

      if (DIST_DEPTS.has(dept) && pv === 'AYAM BARU' && mvt === 'BAHAN' &&
          sloc === 'STAGING RM' && matdesc.includes('KARKAS')) {
        ALL_RAW.push({ dept, grade: _cleanGrade(matdesc), brd: r[6], kg: r[7], date });
      }

      if (dept === 'KARKAS' && sloc === 'LIVEBIRD') {
        if (!_susutByDate[date]) _susutByDate[date] = { bahan: 0, minus: 0, plus: 0 };
        if (mvt === 'BAHAN') _susutByDate[date].bahan += r[7];
        else if (mvt === 'SUSUT (-)' || mvt === 'SUSUT ( )') _susutByDate[date].minus += r[7];
        else if (mvt === 'SUSUT (+)') _susutByDate[date].plus += r[7];
      }

      if (DIST_DEPTS.has(dept) && mvt === 'BAHAN') {
        const dk = (dept === 'BONELESS BONGKAR' || dept === 'BONELESS MIX') ? 'BONELESS' : dept;
        const isAB = pv === 'AYAM BARU' && sloc === 'STAGING RM' && matdesc.includes('KARKAS');
        const isAL = pv === 'AYAM LAMA' && (sloc === 'CRP' || sloc === 'REPRO');
        if (isAB || isAL) {
          if (!_bahanDistByDate[date]) _bahanDistByDate[date] = {};
          if (!_bahanDistByDate[date][dk]) _bahanDistByDate[date][dk] = { ab_brd: 0, ab_kg: 0, al_brd: 0, al_kg: 0 };
          const e = _bahanDistByDate[date][dk];
          if (isAB) { e.ab_brd += r[6]; e.ab_kg += r[7]; }
          if (isAL) { e.al_brd += r[6]; e.al_kg += r[7]; }
        }
      }
    }
  }

  // ── Rebuild derived arrays from accumulated indices ──
  function _finalize() {
    YIELD_DATA = [];
    Object.keys(_yieldByDate).sort().forEach(d => {
      const v = _yieldByDate[d];
      if (!v.bahan) return;
      const [, mm, dd] = d.split('-');
      YIELD_DATA.push({
        ymd: d, d: mm + '-' + dd,
        bahan: v.bahan, hasil: v.hasil, byprod: v.byprod,
        yk: Math.round(v.hasil / v.bahan * 10000) / 100,
        yb: Math.round(v.byprod / v.bahan * 10000) / 100,
        w: Math.round((1 - (v.hasil + v.byprod) / v.bahan) * 10000) / 100,
      });
    });
    _allDates = [..._dateSet].sort();
  }

  // ── Build all derived data + indices from RAW_DB (full rebuild) ──
  function buildDerivedData() {
    YIELD_DATA = [];
    ALL_RAW = [];
    _yieldByDate = {};
    _susutByDate = {};
    _bahanDistByDate = {};
    _rowsByDate = new Map();
    _dateSet = new Set();

    _processRows(RAW_DB);
    _finalize();
  }

  // ── Volume-weighted average ──
  function avgWeighted(fd, key) {
    let sumBahan = 0, sumNum = 0;
    fd.forEach(r => {
      sumBahan += r.bahan;
      if (key === 'yk') sumNum += r.hasil;
      else if (key === 'yb') sumNum += r.byprod;
      else if (key === 'w') sumNum += (r.bahan - r.hasil - r.byprod);
    });
    if (!sumBahan) return 0;
    return Math.round(sumNum / sumBahan * 10000) / 100;
  }

  // ── Get available dates ──
  function getAvailableDates() {
    return _allDates;
  }

  function getLastDate() {
    return _allDates.length ? _allDates[_allDates.length - 1] : null;
  }

  // ── Get available months ──
  function getAvailableMonths() {
    const seen = new Set();
    _allDates.forEach(d => seen.add(d.slice(0, 7)));
    return [...seen].sort();
  }

  // ── KPI for a specific date ──
  function getKpiForDate(dateStr) {
    const row = YIELD_DATA.find(r => r.ymd === dateStr);
    if (!row) return null;

    // Previous date
    const idx = YIELD_DATA.findIndex(r => r.ymd === dateStr);
    const prev = idx > 0 ? YIELD_DATA[idx - 1] : null;

    return {
      date: dateStr,
      yk: row.yk,
      yb: row.yb,
      w: row.w,
      prev_yk: prev?.yk ?? null,
      prev_yb: prev?.yb ?? null,
      prev_w: prev?.w ?? null,
    };
  }

  // ── Truck count for a specific date ──
  function getTruckForDate(dateStr) {
    const lbOrders = new Set();
    const allOrders = new Set();
    const sizeCount = { Small: 0, Medium: 0, Large: 0 };
    const dateRows = _rowsByDate.get(dateStr) || [];

    dateRows.forEach(r => {
      if (R_DEPT[r[0]] !== 'KARKAS' || R_PV[r[1]] !== 'AYAM BARU') return;
      allOrders.add(R_ORDER[r[2]]);

      if (R_MVT[r[5]] !== 'BAHAN' || R_SLOC[r[9]] !== 'LIVEBIRD') return;
      if (!R_MATDESC[r[4]].includes('AYAM HIDUP')) return;

      const order = R_ORDER[r[2]];
      if (lbOrders.has(order)) return;
      lbOrders.add(order);

      const matCode = R_MAT[r[3]];
      const size = LB_SIZE_MAP[matCode] || 'Unknown';
      if (sizeCount[size] !== undefined) sizeCount[size]++;
    });

    return {
      total: allOrders.size,
      small: sizeCount.Small,
      medium: sizeCount.Medium,
      large: sizeCount.Large,
    };
  }

  // ── Previous date truck count (for delta) ──
  function getTruckDelta(dateStr) {
    const dates = getAvailableDates();
    const idx = dates.indexOf(dateStr);
    if (idx <= 0) return null;
    const prevDate = dates[idx - 1];
    return getTruckForDate(prevDate).total;
  }

  // ── Susut LB for a specific date ──
  function getSusutLBForDate(dateStr) {
    const s = _susutByDate[dateStr];
    if (!s || !s.bahan) return null;
    return Math.round((s.minus - s.plus) / s.bahan * 10000) / 100;
  }

  // ── Truck count per day for calendar month ──
  function getTruckCalendar(ym) {
    const days = {};
    for (const dateStr of _allDates) {
      if (!dateStr.startsWith(ym)) continue;
      const dateRows = _rowsByDate.get(dateStr);
      if (!dateRows) continue;
      for (const r of dateRows) {
        if (R_DEPT[r[0]] !== 'KARKAS' || R_PV[r[1]] !== 'AYAM BARU') continue;
        if (!days[dateStr]) days[dateStr] = new Set();
        days[dateStr].add(R_ORDER[r[2]]);
      }
    }
    const result = {};
    let total = 0;
    Object.keys(days).sort().forEach(d => {
      result[d] = days[d].size;
      total += days[d].size;
    });
    return { days: result, total };
  }

  // ── Bahan distribution per dept per date ──
  function getBahanDistribution(dateRange, pvMode, metric) {
    const result = {};
    dateRange.forEach(date => {
      const dd = _bahanDistByDate[date];
      if (!dd) return;
      Object.keys(dd).forEach(dept => {
        const e = dd[dept];
        let val = 0;
        if (pvMode === 'AYAM BARU' || pvMode === 'AYAM PROSES') {
          val += metric === 'brd' ? e.ab_brd : e.ab_kg;
        }
        if (pvMode === 'AYAM LAMA' || pvMode === 'AYAM PROSES') {
          val += metric === 'brd' ? e.al_brd : e.al_kg;
        }
        if (val) {
          if (!result[date]) result[date] = {};
          result[date][dept] = val;
        }
      });
    });
    return result;
  }

  // ── ByProduct breakdown for a date ──
  function getByProductForDate(dateStr) {
    const items = {};
    let totalBahan = 0;
    const dateRows = _rowsByDate.get(dateStr) || [];

    dateRows.forEach(r => {
      if (R_DEPT[r[0]] !== 'KARKAS' || R_PV[r[1]] !== 'AYAM BARU') return;

      const mvt = R_MVT[r[5]];
      if (mvt === 'BAHAN') {
        totalBahan += r[7];
      } else if (mvt === 'BY PRODUCT') {
        const name = R_MATDESC[r[4]];
        if (!items[name]) items[name] = 0;
        items[name] += r[7];
      }
    });

    if (!totalBahan) return { items: [], totalPct: 0 };

    const list = Object.entries(items).map(([name, kg]) => ({
      name,
      kg,
      pct: Math.round(kg / totalBahan * 10000) / 100,
    }));

    const totalPct = Math.round(list.reduce((s, i) => s + i.kg, 0) / totalBahan * 10000) / 100;

    return { items: list, totalPct };
  }

  // ── Search material ──
  function searchMaterial(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const seen = new Set();
    const results = [];

    for (let i = 0; i < R_MATDESC.length; i++) {
      const desc = R_MATDESC[i];
      const code = R_MAT[i] || '';
      if (desc.toLowerCase().includes(q) || code.toLowerCase().includes(q)) {
        const key = i; // matdesc index as unique key
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ idx: i, matdesc: desc, matcode: code });
        }
      }
      if (results.length >= 20) break; // limit autocomplete
    }
    return results;
  }

  // ── Calculate value for selected materials ──
  function calcMaterialValue(matIndices, filters, dateStr) {
    let totalBrd = 0, totalKg = 0;
    const matSet = new Set(matIndices);
    const dateRows = _rowsByDate.get(dateStr) || [];

    dateRows.forEach(r => {
      if (!matSet.has(r[4])) return;
      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
      if (filters.dept !== 'All' && dept !== filters.dept) return;
      if (filters.pv !== 'All' && pv !== filters.pv) return;
      if (filters.mvt !== 'All' && mvt !== filters.mvt) return;
      totalBrd += r[6];
      totalKg += r[7];
    });

    let bahanKg = 0;
    if (filters.mvt !== 'BAHAN') {
      dateRows.forEach(r => {
        if (R_MVT[r[5]] !== 'BAHAN') return;
        const dept = R_DEPT[r[0]], pv = R_PV[r[1]];
        if (filters.dept !== 'All' && dept !== filters.dept) return;
        if (filters.pv !== 'All' && pv !== filters.pv) return;
        bahanKg += r[7];
      });
    }

    const yieldPct = (filters.mvt === 'BAHAN' || !bahanKg) ? null :
      Math.round(totalKg / bahanKg * 10000) / 100;
    return { brd: totalBrd, kg: totalKg, yieldPct };
  }

  // ── Get available filter options for selected materials ──
  function getMaterialFilterOptions(matIndices, dateStr, activeFilters) {
    const matSet = new Set(matIndices);
    const depts = new Set(), filteredPvs = new Set(), filteredMvts = new Set();
    const dateRows = _rowsByDate.get(dateStr) || [];

    dateRows.forEach(r => {
      if (!matSet.has(r[4])) return;
      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
      depts.add(dept);
      if (activeFilters.dept !== 'All' && dept !== activeFilters.dept) return;
      filteredPvs.add(pv);
      if (activeFilters.pv !== 'All' && pv !== activeFilters.pv) return;
      filteredMvts.add(mvt);
    });

    return {
      depts: [...depts].sort(),
      pvs: [...filteredPvs].sort(),
      mvts: [...filteredMvts].sort(),
    };
  }

  // ── Check if material matches current filters ──
  function materialMatchesFilter(matIdx, filters, dateStr) {
    const dateRows = _rowsByDate.get(dateStr) || [];
    return dateRows.some(r => {
      if (r[4] !== matIdx) return false;
      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
      if (filters.dept !== 'All' && dept !== filters.dept) return false;
      if (filters.pv !== 'All' && pv !== filters.pv) return false;
      if (filters.mvt !== 'All' && mvt !== filters.mvt) return false;
      return true;
    });
  }

  function calcMaterialValueRange(matIndices, filters, dateArr) {
    const matSet = new Set(matIndices);
    let totalBrd = 0, totalKg = 0;

    for (const d of dateArr) {
      const dateRows = _rowsByDate.get(d);
      if (!dateRows) continue;
      for (const r of dateRows) {
        if (!matSet.has(r[4])) continue;
        const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
        if (filters.dept !== 'All' && dept !== filters.dept) continue;
        if (filters.pv !== 'All' && pv !== filters.pv) continue;
        if (filters.mvt !== 'All' && mvt !== filters.mvt) continue;
        totalBrd += r[6];
        totalKg += r[7];
      }
    }

    let bahanKg = 0;
    if (filters.mvt !== 'BAHAN') {
      for (const d of dateArr) {
        const dateRows = _rowsByDate.get(d);
        if (!dateRows) continue;
        for (const r of dateRows) {
          if (R_MVT[r[5]] !== 'BAHAN') continue;
          const dept = R_DEPT[r[0]], pv = R_PV[r[1]];
          const sloc = R_SLOC[r[9]];
          if (filters.dept !== 'All' && dept !== filters.dept) continue;
          const pvFilter = filters.pv;
          let match = false;
          if (pvFilter === 'AYAM BARU' || pvFilter === 'All') {
            if (pv === 'AYAM BARU' && sloc === 'STAGING RM') match = true;
          }
          if (pvFilter === 'AYAM LAMA' || pvFilter === 'All') {
            if (pv === 'AYAM LAMA' && (sloc === 'CRP' || sloc === 'REPRO')) match = true;
          }
          if (!match) continue;
          bahanKg += r[7];
        }
      }
    }

    const yieldPct = (filters.mvt === 'BAHAN' || !bahanKg) ? null :
      Math.round(totalKg / bahanKg * 10000) / 100;
    return { brd: totalBrd, kg: totalKg, yieldPct };
  }

  function getMaterialFilterOptionsRange(matIndices, dateArr, activeFilters) {
    const matSet = new Set(matIndices);
    const depts = new Set(), filteredPvs = new Set(), filteredMvts = new Set();

    for (const d of dateArr) {
      const dateRows = _rowsByDate.get(d);
      if (!dateRows) continue;
      for (const r of dateRows) {
        if (!matSet.has(r[4])) continue;
        const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
        depts.add(dept);
        if (activeFilters.dept !== 'All' && dept !== activeFilters.dept) continue;
        filteredPvs.add(pv);
        if (activeFilters.pv !== 'All' && pv !== activeFilters.pv) continue;
        filteredMvts.add(mvt);
      }
    }

    return { depts: [...depts].sort(), pvs: [...filteredPvs].sort(), mvts: [...filteredMvts].sort() };
  }

  function materialMatchesFilterRange(matIdx, filters, dateArr) {
    for (const d of dateArr) {
      const dateRows = _rowsByDate.get(d);
      if (!dateRows) continue;
      for (const r of dateRows) {
        if (r[4] !== matIdx) continue;
        const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
        if (filters.dept !== 'All' && dept !== filters.dept) continue;
        if (filters.pv !== 'All' && pv !== filters.pv) continue;
        if (filters.mvt !== 'All' && mvt !== filters.mvt) continue;
        return true;
      }
    }
    return false;
  }

  function appendRows(newRows) {
    for (let i = 0; i < newRows.length; i++) RAW_DB.push(newRows[i]);
    _processRows(newRows);
    _finalize();
  }

  function getRowsForDates(dateArr) {
    const result = [];
    for (const d of dateArr) {
      const rows = _rowsByDate.get(d);
      if (rows) for (let i = 0; i < rows.length; i++) result.push(rows[i]);
    }
    return result;
  }

  // ── Weighted KPI for a date range ──
  function getKpiForRange(dateArr) {
    let sumBahan = 0, sumHasil = 0, sumByprod = 0;
    dateArr.forEach(d => {
      const r = _yieldByDate[d];
      if (!r) return;
      sumBahan += r.bahan;
      sumHasil += r.hasil;
      sumByprod += r.byprod;
    });
    if (!sumBahan) return { yk: 0, yb: 0, w: 0 };
    return {
      yk: Math.round(sumHasil / sumBahan * 10000) / 100,
      yb: Math.round(sumByprod / sumBahan * 10000) / 100,
      w: Math.round((1 - (sumHasil + sumByprod) / sumBahan) * 10000) / 100,
    };
  }

  // ── Weighted Susut LB for a date range ──
  function getSusutLBForRange(dateArr) {
    let bahan = 0, minus = 0, plus = 0;
    dateArr.forEach(d => {
      const s = _susutByDate[d];
      if (!s) return;
      bahan += s.bahan;
      minus += s.minus;
      plus += s.plus;
    });
    if (!bahan) return null;
    return Math.round((minus - plus) / bahan * 10000) / 100;
  }

  // ── Yield per truck for a specific date ──
  function getYieldPerTruck(dateStr) {
    const trucks = {};
    const dateRows = _rowsByDate.get(dateStr) || [];
    dateRows.forEach(r => {
      if (R_DEPT[r[0]] !== 'KARKAS' || R_PV[r[1]] !== 'AYAM BARU') return;
      const mvt = R_MVT[r[5]];
      if (mvt !== 'BAHAN' && mvt !== 'HASIL') return;
      const order = R_ORDER[r[2]];
      if (!trucks[order]) trucks[order] = { order, bahanKg: 0, hasilKg: 0, size: null, matdesc: '' };
      if (mvt === 'BAHAN') {
        trucks[order].bahanKg += r[7];
        if (R_SLOC[r[9]] === 'LIVEBIRD' && R_MATDESC[r[4]].includes('AYAM HIDUP')) {
          const matCode = R_MAT[r[3]];
          trucks[order].size = LB_SIZE_MAP[matCode] || null;
          trucks[order].matdesc = R_MATDESC[r[4]];
        }
      } else {
        trucks[order].hasilKg += r[7];
      }
    });
    return Object.values(trucks)
      .filter(t => t.bahanKg > 0)
      .map(t => ({ ...t, yieldPct: Math.round(t.hasilKg / t.bahanKg * 10000) / 100 }))
      .sort((a, b) => b.yieldPct - a.yieldPct);
  }

  // ── Karkas flow data for sankey ──
  function getKarkasFlow(dateStr, pvMode) {
    pvMode = pvMode || 'AYAM BARU';
    let bahanKg = 0, hasilKg = 0, byprodKg = 0;
    let susutMinus = 0, susutPlus = 0;
    const dateRows = _rowsByDate.get(dateStr) || [];

    dateRows.forEach(r => {
      if (R_DEPT[r[0]] !== 'KARKAS') return;
      const pv = R_PV[r[1]], mvt = R_MVT[r[5]];
      if (pvMode !== 'AYAM PROSES' && pv !== pvMode) return;
      if (mvt === 'BAHAN') bahanKg += r[7];
      else if (mvt === 'HASIL') hasilKg += r[7];
      else if (mvt === 'BY PRODUCT') byprodKg += r[7];
      else if (mvt === 'SUSUT (-)' || mvt === 'SUSUT ( )') susutMinus += r[7];
      else if (mvt === 'SUSUT (+)') susutPlus += r[7];
    });

    const susutKg = susutMinus - susutPlus;
    const wasteKg = Math.max(0, bahanKg - hasilKg - byprodKg - susutKg);

    const depts = { 'CUT UP': 0, 'BONELESS': 0, 'AU': 0, 'PARTING': 0 };
    const dist = getBahanDistribution([dateStr], pvMode, 'kg');
    if (dist[dateStr]) {
      Object.keys(depts).forEach(d => { depts[d] = dist[dateStr][d] || 0; });
    }

    return { bahanKg, hasilKg, byprodKg, wasteKg, susutKg, depts };
  }

  return {
    setLookups, growLookup, setRawDB, appendRows, getRawDB, getYieldData, getAllRaw, getLookups,
    rRow, buildDerivedData, avgWeighted,
    getAvailableDates, getLastDate, getAvailableMonths,
    getKpiForDate, getTruckForDate, getTruckDelta,
    getSusutLBForDate, getSusutLBForRange, getKpiForRange, getTruckCalendar,
    getBahanDistribution, getByProductForDate,
    getYieldPerTruck, getKarkasFlow,
    searchMaterial, calcMaterialValue, getMaterialFilterOptions, materialMatchesFilter,
    calcMaterialValueRange, getMaterialFilterOptionsRange, materialMatchesFilterRange,
    getRowsForDates, LB_SIZE_MAP, DIST_DEPTS, R_MVT, R_SLOC,
  };
})();
