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
  }

  // ── Auto-grow lookup: return index, add if new ──
  const LOOKUP_MAP = { dept: () => R_DEPT, pv: () => R_PV, order: () => R_ORDER, mat: () => R_MAT, matdesc: () => R_MATDESC, mvt: () => R_MVT, sloc: () => R_SLOC };
  function growLookup(type, value) {
    const arr = LOOKUP_MAP[type]();
    let idx = arr.indexOf(value);
    if (idx === -1) { idx = arr.length; arr.push(value); }
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

  // ── Build YIELD_DATA + ALL_RAW from RAW_DB ──
  function buildDerivedData() {
    YIELD_DATA = [];
    ALL_RAW = [];

    // --- YIELD_DATA: dept=KARKAS, pv=AYAM BARU, mvt in [BAHAN, HASIL, BY PRODUCT] ---
    const karkasByDate = {};
    RAW_DB.forEach(r => {
      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
      if (dept !== 'KARKAS' || pv !== 'AYAM BARU') return;
      if (!['BAHAN','HASIL','BY PRODUCT'].includes(mvt)) return;
      if (!karkasByDate[r[8]]) karkasByDate[r[8]] = { bahan: 0, hasil: 0, byprod: 0 };
      if (mvt === 'BAHAN') karkasByDate[r[8]].bahan += r[7];
      if (mvt === 'HASIL') karkasByDate[r[8]].hasil += r[7];
      if (mvt === 'BY PRODUCT') karkasByDate[r[8]].byprod += r[7];
    });

    Object.keys(karkasByDate).sort().forEach(d => {
      const v = karkasByDate[d];
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

    // --- ALL_RAW: for distribution chart ---
    function cleanGrade(matdesc) {
      return matdesc.replace(/^KARKAS\s*\(\s*/, '').replace(/\s*\)\s*$/, '').replace(/\s*-\s*/g, '-').trim();
    }

    RAW_DB.forEach(r => {
      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]],
            sloc = R_SLOC[r[9]], matdesc = R_MATDESC[r[4]];
      if (!DIST_DEPTS.has(dept) || pv !== 'AYAM BARU' || mvt !== 'BAHAN' ||
          sloc !== 'STAGING RM' || !matdesc.includes('KARKAS')) return;
      ALL_RAW.push({ dept, grade: cleanGrade(matdesc), brd: r[6], kg: r[7], date: r[8] });
    });
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
    return YIELD_DATA.map(r => r.ymd);
  }

  function getLastDate() {
    return YIELD_DATA.length ? YIELD_DATA[YIELD_DATA.length - 1].ymd : null;
  }

  // ── Get available months ──
  function getAvailableMonths() {
    const seen = new Set();
    YIELD_DATA.forEach(r => { if (r.ymd) seen.add(r.ymd.slice(0, 7)); });
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
    const orders = new Set();
    const sizeCount = { Small: 0, Medium: 0, Large: 0 };

    RAW_DB.forEach(r => {
      if (R_DEPT[r[0]] !== 'KARKAS' || R_PV[r[1]] !== 'AYAM BARU') return;
      if (r[8] !== dateStr) return;
      if (R_MVT[r[5]] !== 'BAHAN' || R_SLOC[r[9]] !== 'LIVEBIRD') return;
      if (!R_MATDESC[r[4]].includes('AYAM HIDUP')) return;

      const order = R_ORDER[r[2]];
      if (orders.has(order)) return;
      orders.add(order);

      const matCode = R_MAT[r[3]];
      const size = LB_SIZE_MAP[matCode] || 'Unknown';
      if (sizeCount[size] !== undefined) sizeCount[size]++;
    });

    // Also count total unique orders (broader: all KARKAS AYAM BARU)
    const allOrders = new Set();
    RAW_DB.forEach(r => {
      if (R_DEPT[r[0]] !== 'KARKAS' || R_PV[r[1]] !== 'AYAM BARU') return;
      if (r[8] !== dateStr) return;
      allOrders.add(R_ORDER[r[2]]);
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
    let susutMinus = 0, susutPlus = 0, bahanLB = 0;

    RAW_DB.forEach(r => {
      if (R_DEPT[r[0]] !== 'KARKAS') return;
      if (r[8] !== dateStr || R_SLOC[r[9]] !== 'LIVEBIRD') return;

      const mvt = R_MVT[r[5]];
      if (mvt === 'BAHAN') bahanLB += r[7];
      else if (mvt === 'SUSUT (-)' || mvt === 'SUSUT ( )') susutMinus += r[7];
      else if (mvt === 'SUSUT (+)') susutPlus += r[7];
    });

    if (!bahanLB) return null;
    const pct = Math.round((susutMinus - susutPlus) / bahanLB * 10000) / 100;
    return pct;
  }

  // ── Truck count per day for calendar month ──
  function getTruckCalendar(ym) {
    const days = {};
    RAW_DB.forEach(r => {
      if (R_DEPT[r[0]] !== 'KARKAS' || R_PV[r[1]] !== 'AYAM BARU') return;
      if (!r[8].startsWith(ym)) return;
      if (!days[r[8]]) days[r[8]] = new Set();
      days[r[8]].add(R_ORDER[r[2]]);
    });
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
    // pvMode: 'AYAM BARU', 'AYAM LAMA', 'AYAM PROSES'
    const result = {}; // { date: { dept: value } }

    RAW_DB.forEach(r => {
      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]],
            sloc = R_SLOC[r[9]], matdesc = R_MATDESC[r[4]], date = r[8];

      if (!DIST_DEPTS.has(dept) || mvt !== 'BAHAN') return;
      if (!dateRange.includes(date)) return;

      let match = false;
      if (pvMode === 'AYAM BARU' || pvMode === 'AYAM PROSES') {
        if (pv === 'AYAM BARU' && sloc === 'STAGING RM' && matdesc.includes('KARKAS')) match = true;
      }
      if (pvMode === 'AYAM LAMA' || pvMode === 'AYAM PROSES') {
        if (pv === 'AYAM LAMA' && (sloc === 'CRP' || sloc === 'REPRO')) match = true;
      }

      if (!match) return;

      // Merge BONELESS BONGKAR + BONELESS MIX → BONELESS
      const deptKey = (dept === 'BONELESS BONGKAR' || dept === 'BONELESS MIX') ? 'BONELESS' : dept;
      if (!result[date]) result[date] = {};
      if (!result[date][deptKey]) result[date][deptKey] = 0;
      result[date][deptKey] += metric === 'brd' ? r[6] : r[7];
    });

    return result;
  }

  // ── ByProduct breakdown for a date ──
  function getByProductForDate(dateStr) {
    const items = {};
    let totalBahan = 0;

    RAW_DB.forEach(r => {
      if (R_DEPT[r[0]] !== 'KARKAS' || R_PV[r[1]] !== 'AYAM BARU') return;
      if (r[8] !== dateStr) return;

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
    // filters: { dept: 'All'|string, pv: 'All'|string, mvt: 'All'|string }
    let totalBrd = 0, totalKg = 0;
    const matSet = new Set(matIndices);

    RAW_DB.forEach(r => {
      if (r[8] !== dateStr) return;
      if (!matSet.has(r[4])) return; // r[4] = matdesc index

      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
      if (filters.dept !== 'All' && dept !== filters.dept) return;
      if (filters.pv !== 'All' && pv !== filters.pv) return;
      if (filters.mvt !== 'All' && mvt !== filters.mvt) return;

      totalBrd += r[6];
      totalKg += r[7];
    });

    // Calculate bahan for yield denominator (same dept + pv + date)
    let bahanKg = 0;
    if (filters.mvt !== 'BAHAN') {
      RAW_DB.forEach(r => {
        if (r[8] !== dateStr || R_MVT[r[5]] !== 'BAHAN') return;
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
    const depts = new Set(), pvs = new Set(), mvts = new Set();

    RAW_DB.forEach(r => {
      if (r[8] !== dateStr || !matSet.has(r[4])) return;
      depts.add(R_DEPT[r[0]]);
      pvs.add(R_PV[r[1]]);
      mvts.add(R_MVT[r[5]]);
    });

    // Cascade: if dept selected, filter pv and mvt
    const filteredPvs = new Set(), filteredMvts = new Set();
    RAW_DB.forEach(r => {
      if (r[8] !== dateStr || !matSet.has(r[4])) return;
      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
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
    return RAW_DB.some(r => {
      if (r[8] !== dateStr || r[4] !== matIdx) return false;
      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
      if (filters.dept !== 'All' && dept !== filters.dept) return false;
      if (filters.pv !== 'All' && pv !== filters.pv) return false;
      if (filters.mvt !== 'All' && mvt !== filters.mvt) return false;
      return true;
    });
  }

  function calcMaterialValueRange(matIndices, filters, dateArr) {
    const dateSet = new Set(dateArr);
    const matSet = new Set(matIndices);
    let totalBrd = 0, totalKg = 0;

    RAW_DB.forEach(r => {
      if (!dateSet.has(r[8]) || !matSet.has(r[4])) return;
      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
      if (filters.dept !== 'All' && dept !== filters.dept) return;
      if (filters.pv !== 'All' && pv !== filters.pv) return;
      if (filters.mvt !== 'All' && mvt !== filters.mvt) return;
      totalBrd += r[6];
      totalKg += r[7];
    });

    let bahanKg = 0;
    if (filters.mvt !== 'BAHAN') {
      RAW_DB.forEach(r => {
        if (!dateSet.has(r[8]) || R_MVT[r[5]] !== 'BAHAN') return;
        const dept = R_DEPT[r[0]], pv = R_PV[r[1]];
        const sloc = R_SLOC[r[9]];
        if (filters.dept !== 'All' && dept !== filters.dept) return;

        const pvFilter = filters.pv;
        let match = false;
        if (pvFilter === 'AYAM BARU' || pvFilter === 'All') {
          if (pv === 'AYAM BARU' && sloc === 'STAGING RM') match = true;
        }
        if (pvFilter === 'AYAM LAMA' || pvFilter === 'All') {
          if (pv === 'AYAM LAMA' && (sloc === 'CRP' || sloc === 'REPRO')) match = true;
        }
        if (!match) return;

        bahanKg += r[7];
      });
    }

    const yieldPct = (filters.mvt === 'BAHAN' || !bahanKg) ? null :
      Math.round(totalKg / bahanKg * 10000) / 100;
    return { brd: totalBrd, kg: totalKg, yieldPct };
  }

  function getMaterialFilterOptionsRange(matIndices, dateArr, activeFilters) {
    const dateSet = new Set(dateArr);
    const matSet = new Set(matIndices);
    const depts = new Set(), filteredPvs = new Set(), filteredMvts = new Set();

    RAW_DB.forEach(r => {
      if (!dateSet.has(r[8]) || !matSet.has(r[4])) return;
      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
      depts.add(dept);
      if (activeFilters.dept !== 'All' && dept !== activeFilters.dept) return;
      filteredPvs.add(pv);
      if (activeFilters.pv !== 'All' && pv !== activeFilters.pv) return;
      filteredMvts.add(mvt);
    });

    return { depts: [...depts].sort(), pvs: [...filteredPvs].sort(), mvts: [...filteredMvts].sort() };
  }

  function materialMatchesFilterRange(matIdx, filters, dateArr) {
    const dateSet = new Set(dateArr);
    return RAW_DB.some(r => {
      if (!dateSet.has(r[8]) || r[4] !== matIdx) return false;
      const dept = R_DEPT[r[0]], pv = R_PV[r[1]], mvt = R_MVT[r[5]];
      if (filters.dept !== 'All' && dept !== filters.dept) return false;
      if (filters.pv !== 'All' && pv !== filters.pv) return false;
      if (filters.mvt !== 'All' && mvt !== filters.mvt) return false;
      return true;
    });
  }

  function appendRows(newRows) {
    newRows.forEach(r => RAW_DB.push(r));
    buildDerivedData();
  }

  // ── Weighted KPI for a date range ──
  function getKpiForRange(dateArr) {
    const dateSet = new Set(dateArr);
    let sumBahan = 0, sumHasil = 0, sumByprod = 0;

    RAW_DB.forEach(r => {
      if (R_DEPT[r[0]] !== 'KARKAS' || R_PV[r[1]] !== 'AYAM BARU') return;
      if (!dateSet.has(r[8])) return;
      const mvt = R_MVT[r[5]];
      if (mvt === 'BAHAN') sumBahan += r[7];
      else if (mvt === 'HASIL') sumHasil += r[7];
      else if (mvt === 'BY PRODUCT') sumByprod += r[7];
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
    const dateSet = new Set(dateArr);
    let susutMinus = 0, susutPlus = 0, bahanLB = 0;

    RAW_DB.forEach(r => {
      if (R_DEPT[r[0]] !== 'KARKAS') return;
      if (!dateSet.has(r[8]) || R_SLOC[r[9]] !== 'LIVEBIRD') return;
      const mvt = R_MVT[r[5]];
      if (mvt === 'BAHAN') bahanLB += r[7];
      else if (mvt === 'SUSUT (-)' || mvt === 'SUSUT ( )') susutMinus += r[7];
      else if (mvt === 'SUSUT (+)') susutPlus += r[7];
    });

    if (!bahanLB) return null;
    return Math.round((susutMinus - susutPlus) / bahanLB * 10000) / 100;
  }

  return {
    setLookups, growLookup, setRawDB, appendRows, getRawDB, getYieldData, getAllRaw, getLookups,
    rRow, buildDerivedData, avgWeighted,
    getAvailableDates, getLastDate, getAvailableMonths,
    getKpiForDate, getTruckForDate, getTruckDelta,
    getSusutLBForDate, getSusutLBForRange, getKpiForRange, getTruckCalendar,
    getBahanDistribution, getByProductForDate,
    searchMaterial, calcMaterialValue, getMaterialFilterOptions, materialMatchesFilter,
    calcMaterialValueRange, getMaterialFilterOptionsRange, materialMatchesFilterRange,
    LB_SIZE_MAP, DIST_DEPTS, R_MVT, R_SLOC,
  };
})();
