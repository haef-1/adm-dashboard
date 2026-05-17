/* ═══════════════════════════════════════
   KARKAS.JS — Karkas Page (Yield + Sankey)
   Ported from adm_dashboard_v3_trial
   ═══════════════════════════════════════ */

// roundRect polyfill — not available in Chrome <99, Samsung Internet <18, older WebViews
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    var r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0);
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

const KarkasPage = (() => {
  // ═══════════════════════════════════════
  //  SHARED
  // ═══════════════════════════════════════
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const DEPT_COLOR = {'AU':'#f59e0b','CUT UP':'#10b981','BONELESS BONGKAR':'#3b82f6','PARTING':'#ec4899','BONELESS MIX':'#8b5cf6'};
  const DEPTS = ['AU','CUT UP','BONELESS BONGKAR','PARTING','BONELESS MIX'];

  function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function hexRgb(h) { return { r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16) }; }
  function fmtShort(v, m) {
    if (m === 'brd') { if (v >= 1e6) return (v/1e6).toFixed(1)+'M'; if (v >= 1e3) return (v/1e3).toFixed(1)+'K'; return Math.round(v)+''; }
    else { if (v >= 1e6) return (v/1e6).toFixed(1)+'T'; if (v >= 1e3) return (v/1e3).toFixed(1)+'K'; return Math.round(v)+''; }
  }

  // ═══════════════════════════════════════
  //  YIELD SECTION STATE
  // ═══════════════════════════════════════
  const yDEFS = [
    { id:'karkas', key:'yk', line:'#4d9eff', line2:'#7db8ff' },
    { id:'bypro',  key:'yb', line:'#34d399', line2:'#6ee7b7' },
    { id:'waste',  key:'w',  line:'#e05252', line2:'#ff8a94' },
  ];
  let yChartInstances = {};
  let yChartRegistry = [];
  let yGlobalRafPending = false;
  let yPeriod = 'daily';
  let ySelectedItems = null;
  let ySelectedFrom = null;
  let ySelectedTo = null;

  // ═══════════════════════════════════════
  //  SANKEY SECTION STATE
  // ═══════════════════════════════════════
  let sMetric = 'brd';
  let sSelected = { type: null, key: null };
  let sLayout = {};
  let sCanvas = null;
  let sRo = null;
  let sPeriod = 'daily';
  let sSelectedItems = null;
  let sSelectedFrom = null;
  let sSelectedTo = null;


  function sBezPt(y0, y1, t) {
    return (1-t)**3*y0 + 3*(1-t)**2*t*y0 + 3*(1-t)*t**2*y1 + t**3*y1;
  }

  // ═══════════════════════════════════════
  //  RANGE PICKER STATE
  // ═══════════════════════════════════════
  let _rangeDocListener = null;
  let _rangeScrollListener = null;

  // ═══════════════════════════════════════
  //  DATE HELPERS
  // ═══════════════════════════════════════
  function getWeekMap(dates) {
    const map = {};
    dates.forEach(d => { const key = d.slice(0, 4) + '-W' + KPI.getISOWeek(d); if (!map[key]) map[key] = []; map[key].push(d); });
    return map;
  }
  function getMonthMap(dates) {
    const map = {};
    dates.forEach(d => { const key = d.slice(0, 7); if (!map[key]) map[key] = []; map[key].push(d); });
    return map;
  }
  function fmtDateShort(d) {
    if (!d) return '—';
    const p = d.split('-');
    return p[2] + ' ' + MONTHS_SHORT[parseInt(p[1]) - 1];
  }
  function fmtDateFull(d) {
    if (!d) return '—';
    const p = d.split('-');
    return p[2] + ' ' + MONTHS_SHORT[parseInt(p[1]) - 1] + ' ' + p[0];
  }

  // ═══════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════
  function render(container) {
    Object.keys(yChartInstances).forEach(k => { if (yChartInstances[k] && yChartInstances[k].destroy) yChartInstances[k].destroy(); });
    yChartInstances = {};
    yChartRegistry = [];
    yGlobalRafPending = false;
    sSelected = { type: null, key: null };
    yPeriod = 'daily';
    ySelectedItems = null; ySelectedFrom = null; ySelectedTo = null;
    sPeriod = 'daily';
    sSelectedItems = null; sSelectedFrom = null; sSelectedTo = null;

    container.innerHTML = `
      <div class="page-title">Karkas</div>

      <div class="karkas-grid">
        <!-- YIELD PER TRUK -->
        <div class="section" id="sectionYield">
          <div class="section-header">
            <span class="section-title">Yield Per Truk</span>
            <div class="section-header-controls" id="yHeaderControls"></div>
          </div>
          <div class="y-container" id="yCardsContainer"></div>
        </div>

        <!-- KARKAS DISTRIBUTION (SANKEY) -->
        <div class="section" id="sectionSankey">
          <div class="section-header">
            <span class="section-title">Karkas Distribution</span>
            <div class="section-header-controls" id="sHeaderControls"></div>
          </div>
          <div class="sankey-body" id="sankeyBody">
            <div class="s-axis-labels">
              <span class="s-lbl-l">Grade</span>
              <span class="s-lbl-r">Departemen</span>
            </div>
            <p class="s-hint">Tap grade atau departemen untuk highlight distribusi</p>
            <div class="s-chart-wrap"><canvas id="sCanvas"></canvas></div>
            <div class="s-empty" id="sEmpty"><div class="s-empty-icon">📭</div>Tidak ada data untuk periode yang dipilih</div>
            <div class="s-legend" id="sLegend"></div>
          </div>
        </div>
      </div>
    `;

    // Inject unified yield chart
    document.getElementById('yCardsContainer').innerHTML = `
      <div class="y-stats-row">
        <div class="y-stat">
          <div class="y-stat-label">Karkas</div>
          <div class="y-stat-val" id="lv-karkas">--%</div>
          <div class="y-stat-avg" id="avg-karkas"></div>
        </div>
        <div class="y-stat">
          <div class="y-stat-label">By-Pro</div>
          <div class="y-stat-val" id="lv-bypro">--%</div>
          <div class="y-stat-avg" id="avg-bypro"></div>
        </div>
        <div class="y-stat">
          <div class="y-stat-label">Waste</div>
          <div class="y-stat-val" id="lv-waste">--%</div>
          <div class="y-stat-avg" id="avg-waste"></div>
        </div>
      </div>
      <div class="y-chart-date-label" id="dl-yield"><span></span></div>
      <div class="y-chart-wrap"><canvas id="chart-yield"></canvas></div>
    `;

    // Yield header controls
    const yCtrl = document.getElementById('yHeaderControls');
    yCtrl.innerHTML = '<div id="yPeriodWrap"></div><div class="spacer"></div><div id="yRangeNav"></div>';
    const yPeriodSel = DatePicker.createCustomSelect(
      [{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }],
      yPeriod,
      val => { yPeriod = val; ySelectedItems = null; ySelectedFrom = null; ySelectedTo = null; yBuildCharts(); }
    );
    document.getElementById('yPeriodWrap').appendChild(yPeriodSel.el);

    // Sankey header controls
    const sCtrl = document.getElementById('sHeaderControls');
    sCtrl.innerHTML = `
      <div class="s-tab-grp">
        <button class="s-tab-btn active" id="sTabBrd">BRD</button>
        <button class="s-tab-btn" id="sTabKg">KG</button>
      </div>
      <div id="sPeriodWrap"></div>
      <div class="spacer"></div>
      <div id="sRangeNav"></div>`;
    document.getElementById('sTabBrd').addEventListener('click', function() { sSetMetric('brd', this); });
    document.getElementById('sTabKg').addEventListener('click', function() { sSetMetric('kg', this); });
    const sPeriodSel = DatePicker.createCustomSelect(
      [{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }],
      sPeriod,
      val => { sPeriod = val; sSelectedItems = null; sSelectedFrom = null; sSelectedTo = null; sDraw(); sUpdateRangeBtn(); }
    );
    document.getElementById('sPeriodWrap').appendChild(sPeriodSel.el);

    sCanvas = document.getElementById('sCanvas');
    yBuildCharts();
    sBuildLegend();
    sUpdateRangeBtn();

    sRo = new ResizeObserver(() => { requestAnimationFrame(sDraw); });
    sRo.observe(sCanvas.parentElement);
    requestAnimationFrame(() => requestAnimationFrame(sDraw));
  }

  // ═══════════════════════════════════════
  //  YIELD: FILTER + BUILD
  // ═══════════════════════════════════════
  function yGetFilteredDates() {
    const dates = Engine.getAvailableDates();
    if (yPeriod === 'daily') {
      if (ySelectedItems) return ySelectedItems;
      if (ySelectedFrom && ySelectedTo) return dates.filter(d => d >= ySelectedFrom && d <= ySelectedTo);
      return dates.slice(-7);
    } else if (yPeriod === 'weekly') {
      const wm = getWeekMap(dates);
      const keys = Object.keys(wm);
      const selKeys = ySelectedItems ? keys.filter(k => ySelectedItems.includes(k)) : keys;
      let result = [];
      selKeys.forEach(k => { result = result.concat(wm[k]); });
      return result;
    } else {
      const mm = getMonthMap(dates);
      const keys = Object.keys(mm);
      const selKeys = ySelectedItems ? keys.filter(k => ySelectedItems.includes(k)) : keys;
      let result = [];
      selKeys.forEach(k => { result = result.concat(mm[k]); });
      return result;
    }
  }

  function yFilterData() {
    const fd = Engine.getYieldData();
    const filterDates = new Set(yGetFilteredDates());
    const daily = fd.filter(r => filterDates.has(r.ymd));

    if (yPeriod === 'daily') return daily;

    const groupMap = {};
    const groupOrder = [];
    daily.forEach(r => {
      let key;
      if (yPeriod === 'weekly') {
        key = r.ymd.slice(0, 4) + '-W' + KPI.getISOWeek(r.ymd);
      } else {
        key = r.ymd.slice(0, 7);
      }
      if (!groupMap[key]) { groupMap[key] = { bahan: 0, hasil: 0, byprod: 0 }; groupOrder.push(key); }
      groupMap[key].bahan += r.bahan;
      groupMap[key].hasil += r.hasil;
      groupMap[key].byprod += r.byprod;
    });

    return groupOrder.map(key => {
      const g = groupMap[key];
      const b = g.bahan || 1;
      return {
        ymd: key, d: key,
        bahan: g.bahan, hasil: g.hasil, byprod: g.byprod,
        yk: Math.round(g.hasil / b * 10000) / 100,
        yb: Math.round(g.byprod / b * 10000) / 100,
        w: Math.round((1 - (g.hasil + g.byprod) / b) * 10000) / 100,
      };
    });
  }

  function yUpdateRangeBtn() {
    const navEl = document.getElementById('yRangeNav');
    if (!navEl) return;
    const dates = Engine.getAvailableDates();
    let rangeLabel;
    if (yPeriod === 'daily') {
      const range = ySelectedItems || (ySelectedFrom && ySelectedTo ? dates.filter(d => d >= ySelectedFrom && d <= ySelectedTo) : dates.slice(-7));
      if (range.length) {
        const a = range[0], b = range[range.length - 1];
        const yA = a.split('-')[0], yB = b.split('-')[0];
        rangeLabel = yA === yB
          ? fmtDateShort(a) + ' – ' + fmtDateShort(b) + ' ' + yB
          : fmtDateFull(a) + ' – ' + fmtDateFull(b);
      } else rangeLabel = 'Pilih tanggal';
    } else if (yPeriod === 'weekly') {
      const keys = Object.keys(getWeekMap(dates));
      const selKeys = ySelectedItems || keys;
      if (selKeys.length) {
        const a = selKeys[0], b = selKeys[selKeys.length - 1];
        const wA = 'W' + a.split('-W')[1], wB = 'W' + b.split('-W')[1];
        const yA = a.split('-')[0], yB = b.split('-')[0];
        rangeLabel = yA === yB
          ? wA + ' – ' + wB + ' ' + yA
          : wA + ' ' + yA + ' – ' + wB + ' ' + yB;
      } else rangeLabel = 'Pilih minggu';
    } else {
      const keys = Object.keys(getMonthMap(dates));
      const selKeys = ySelectedItems || keys;
      if (selKeys.length) {
        const a = selKeys[0], b = selKeys[selKeys.length - 1];
        const mA = MONTHS_SHORT[parseInt(a.slice(5, 7)) - 1], mB = MONTHS_SHORT[parseInt(b.slice(5, 7)) - 1];
        const yA = a.split('-')[0], yB = b.split('-')[0];
        rangeLabel = yA === yB
          ? mA + ' – ' + mB + ' ' + yA
          : mA + ' ' + yA + ' – ' + mB + ' ' + yB;
      } else rangeLabel = 'Pilih bulan';
    }
    navEl.innerHTML = '<button class="chart-range-btn" id="yRangeBtn">' + rangeLabel + '</button>';
    document.getElementById('yRangeBtn').addEventListener('click', () => openRangePicker('yield'));
  }

  function yBuildCharts() {
    yUpdateRangeBtn();
    const fd = yFilterData();
    yChartRegistry = [];

    Object.keys(yChartInstances).forEach(k => { if (yChartInstances[k] && yChartInstances[k].destroy) yChartInstances[k].destroy(); });
    yChartInstances = {};

    if (!fd.length) return;

    const metrics = yDEFS.map(({ id, key, line, line2 }) => ({
      id, key, line, line2,
      values: fd.map(r => r[key]),
      av: Engine.avgWeighted(fd, key)
    }));

    metrics.forEach(m => {
      const numEl = document.getElementById('lv-' + m.id);
      const avgEl = document.getElementById('avg-' + m.id);
      if (avgEl) { avgEl.textContent = 'avg ' + m.av.toFixed(1) + '%'; avgEl.style.color = m.line; avgEl.style.background = m.line + '15'; }
      if (numEl) { numEl.style.color = m.line; numEl.textContent = '--%'; }
    });

    let xLabels, fullLabels;
    if (yPeriod === 'daily') {
      xLabels = fd.map((r, i) => {
        const mm = parseInt(r.d.split('-')[0], 10);
        const prev = i > 0 ? parseInt(fd[i-1].d.split('-')[0], 10) : null;
        return mm !== prev ? MONTHS_SHORT[mm - 1] : '';
      });
      fullLabels = fd.map(r => {
        const [mm, dd] = r.d.split('-');
        return dd + ' ' + MONTHS_SHORT[parseInt(mm, 10) - 1];
      });
    } else {
      xLabels = fd.map(r => {
        if (yPeriod === 'weekly') return "W" + r.d.split("-W")[1];
        return MONTHS_SHORT[parseInt(r.d.slice(5, 7)) - 1];
      });
      fullLabels = xLabels;
    }

    const sorted = [...metrics].sort((a, b) => a.av - b.av);
    const BAND_GAP = 0.07;
    const bandH = (1.0 - (sorted.length - 1) * BAND_GAP) / sorted.length;

    sorted.forEach(m => {
      const mn = Math.min(...m.values), mx = Math.max(...m.values);
      const pad = (mx - mn) * 0.15 || 0.5;
      m.dataMin = mn - pad; m.dataMax = mx + pad;
    });
    const uniRange = Math.max(...sorted.map(m => m.dataMax - m.dataMin)) || 1;

    sorted.forEach((m, i) => {
      m.bandBot = i * (bandH + BAND_GAP);
      m.bandTop = m.bandBot + bandH;
      const center = (m.dataMin + m.dataMax) / 2;
      m.nMin = center - uniRange / 2;
      m.nMax = center + uniRange / 2;
      m.nRange = uniRange;
      m.norm = m.values.map(v => m.bandBot + ((v - m.nMin) / m.nRange) * bandH);
      m.nAvg = m.bandBot + ((m.av - m.nMin) / m.nRange) * bandH;
    });

    const longPeriod = yPeriod === 'daily' && fd.length > 31;
    function yNiceTicks(lo, hi) {
      const steps = longPeriod ? [1, 2, 5, 10, 20] : [0.5, 1, 2, 5, 10, 20];
      for (const s of steps) {
        const t = [];
        for (let v = Math.ceil(lo / s) * s; v <= hi + 0.01; v += s) t.push(Math.round(v * 10) / 10);
        if (t.length <= 8) return t;
      }
      return [Math.round(((lo + hi) / 2) * 10) / 10];
    }

    const datasets = sorted.map(m => ({
      data: m.norm, borderColor: m.line, borderWidth: 1.5,
      backgroundColor: 'transparent', fill: false,
      tension: 0.15, pointRadius: 0, pointHoverRadius: 0, clip: false
    }));

    const bandAxisPlugin = {
      id: 'bandAxis',
      afterDraw(ch) {
        const { ctx: c, chartArea, scales: { y } } = ch;
        if (!chartArea || !y) return;
        const { left, right } = chartArea;
        c.save();
        sorted.forEach((m, i) => {
          const ticks = yNiceTicks(m.nMin, m.nMax);
          ticks.forEach(v => {
            const normPos = m.bandBot + ((v - m.nMin) / m.nRange) * bandH;
            const px = y.getPixelForValue(normPos);
            c.strokeStyle = getCSSVar('--border-light'); c.lineWidth = 0.5;
            c.beginPath(); c.moveTo(left, px); c.lineTo(right, px); c.stroke();
            c.fillStyle = m.line; c.font = '400 9px "JetBrains Mono", monospace';
            c.textAlign = 'left'; c.textBaseline = 'middle';
            c.fillText(v.toFixed(1) + '%', right + 6, px);
          });
          const avgPx = y.getPixelForValue(m.nAvg);
          c.strokeStyle = m.line + '33'; c.lineWidth = 1; c.setLineDash([4, 4]);
          c.beginPath(); c.moveTo(left, avgPx); c.lineTo(right, avgPx); c.stroke();
          c.setLineDash([]);
          const vals = m.values;
          if (vals.length > 1) {
            const maxVal = Math.max(...vals), minVal = Math.min(...vals);
            const maxIdx = vals.indexOf(maxVal), minIdx = vals.indexOf(minVal);
            const stp = vals.length > 1 ? (right - left) / (vals.length - 1) : 0;
            c.font = 'bold 9px "JetBrains Mono", monospace';
            function drawPeakLabel(idx, val, isTop) {
              const xp = left + idx * stp;
              const normP = m.bandBot + ((val - m.nMin) / m.nRange) * bandH;
              const yp = y.getPixelForValue(normP);
              const txt = val.toFixed(2);
              const tw = c.measureText(txt).width;
              const cx = Math.max(left + tw / 2, Math.min(right - tw / 2, xp));
              const cy = isTop ? yp - 10 : yp + 12;
              c.fillStyle = m.line; c.textAlign = 'center'; c.textBaseline = 'middle';
              c.fillText(txt, cx, cy);
            }
            drawPeakLabel(maxIdx, maxVal, true);
            if (maxIdx !== minIdx) drawPeakLabel(minIdx, minVal, false);
          }
          if (i < sorted.length - 1) {
            const gy = y.getPixelForValue(m.bandTop + BAND_GAP / 2);
            const gx = right + 12;
            c.strokeStyle = getCSSVar('--text-muted'); c.lineWidth = 1;
            c.beginPath();
            c.moveTo(gx - 4, gy - 4); c.lineTo(gx + 2, gy - 1);
            c.lineTo(gx - 4, gy + 1); c.lineTo(gx + 2, gy + 4);
            c.stroke();
          }
        });
        c.restore();
      }
    };

    const chartCanvas = document.getElementById('chart-yield');
    const chartCtx = chartCanvas.getContext('2d');

    const chart = new Chart(chartCtx, {
      type: 'line',
      data: { labels: xLabels, datasets },
      plugins: [bandAxisPlugin],
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 820, easing: 'easeInOutQuart' },
        events: [],
        layout: { padding: { top: 10, bottom: 8, left: 4, right: 44 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: getCSSVar('--text-muted'), font: { family: 'JetBrains Mono', size: 9, weight: '600' }, maxRotation: 0, padding: 0, autoSkip: yPeriod !== 'daily' } },
          y: { display: false, min: -0.05, max: 1.05 }
        }
      }
    });
    yChartInstances['unified'] = chart;

    const wrap = chartCanvas.parentElement;
    wrap.style.position = 'relative';
    wrap.querySelector('canvas.y-overlay')?.remove();
    const over = document.createElement('canvas');
    over.className = 'y-overlay';
    over.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    wrap.appendChild(over);
    function syncSize() { over.width = chartCanvas.width; over.height = chartCanvas.height; }
    syncSize();
    new ResizeObserver(syncSize).observe(chartCanvas);
    const oc = over.getContext('2d');

    const dlWrap = document.getElementById('dl-yield');
    dlWrap.innerHTML = '';
    const dlSpan = document.createElement('span');
    dlWrap.appendChild(dlSpan);

    let chartReady = false;
    setTimeout(() => { chartReady = true; yChartRegistry.forEach(fn => fn(fd.length - 1)); }, 840);

    function drawAtIndex(si) {
      const ca = chart.chartArea; if (!ca) return;
      const safeIdx = Math.max(0, Math.min(fd.length - 1, si));
      const stp2 = fd.length > 1 ? (ca.right - ca.left) / (fd.length - 1) : 0;
      const xp = fd.length > 1 ? ca.left + safeIdx * stp2 : (ca.left + ca.right) / 2;
      const dpr = window.devicePixelRatio || 1;

      oc.clearRect(0, 0, over.width, over.height);
      oc.save();
      oc.strokeStyle = 'rgba(0,0,0,0.15)'; oc.lineWidth = 1 * dpr; oc.setLineDash([4 * dpr, 4 * dpr]);
      oc.beginPath(); oc.moveTo(xp * dpr, ca.top * dpr); oc.lineTo(xp * dpr, ca.bottom * dpr); oc.stroke();
      oc.setLineDash([]);

      metrics.forEach(m => {
        const nVal = m.norm[safeIdx]; if (nVal === undefined) return;
        const yp = chart.scales.y.getPixelForValue(nVal);
        oc.beginPath(); oc.arc(xp * dpr, yp * dpr, 3.5 * dpr, 0, Math.PI * 2);
        oc.fillStyle = m.line; oc.fill(); oc.strokeStyle = '#fff'; oc.lineWidth = 1.5 * dpr; oc.stroke();
        const numEl = document.getElementById('lv-' + m.id);
        if (numEl) numEl.textContent = m.values[safeIdx].toFixed(2) + '%';
      });

      oc.restore();
      const rect = chartCanvas.getBoundingClientRect();
      const dlRect = dlWrap.getBoundingClientRect();
      dlSpan.textContent = fullLabels[safeIdx]; dlSpan.style.left = (rect.left - dlRect.left + xp) + 'px';
    }
    yChartRegistry.push(drawAtIndex);

    function getIdx(mouseX) {
      const ca = chart.chartArea; if (!ca) return 0;
      if (fd.length <= 1) return 0;
      return Math.max(0, Math.min(fd.length - 1, Math.round((mouseX - ca.left) / ((ca.right - ca.left) / (fd.length - 1)))));
    }
    if (wrap._yMouse) wrap.removeEventListener('mousemove', wrap._yMouse);
    if (wrap._yTouch) wrap.removeEventListener('touchmove', wrap._yTouch);
    wrap._yMouse = e => {
      if (!chartReady) return;
      const mouseX = e.clientX - chartCanvas.getBoundingClientRect().left;
      if (!yGlobalRafPending) { yGlobalRafPending = true; requestAnimationFrame(() => { yGlobalRafPending = false; const idx = getIdx(mouseX); yChartRegistry.forEach(fn => fn(idx)); }); }
    };
    wrap._yTouch = e => {
      if (!chartReady) return;
      const mouseX = e.touches[0].clientX - chartCanvas.getBoundingClientRect().left;
      if (!yGlobalRafPending) { yGlobalRafPending = true; requestAnimationFrame(() => { yGlobalRafPending = false; const idx = getIdx(mouseX); yChartRegistry.forEach(fn => fn(idx)); }); }
    };
    wrap.addEventListener('mousemove', wrap._yMouse, { passive: true });
    wrap.addEventListener('touchmove', wrap._yTouch, { passive: true });
  }

  // ═══════════════════════════════════════
  //  SANKEY: CONTROLS
  // ═══════════════════════════════════════
  function sSetMetric(m, btn) {
    sMetric = m;
    document.querySelectorAll('.s-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sDraw();
  }

  function sGetAllDates() {
    return [...new Set(Engine.getAllRaw().map(r => r.date))].sort();
  }

  function sGetFilteredDates() {
    const dates = sGetAllDates();
    if (sPeriod === 'daily') {
      if (sSelectedItems) return sSelectedItems;
      if (sSelectedFrom && sSelectedTo) return dates.filter(d => d >= sSelectedFrom && d <= sSelectedTo);
      return dates.length ? [dates[dates.length - 1]] : [];
    } else if (sPeriod === 'weekly') {
      const wm = getWeekMap(dates);
      const keys = Object.keys(wm);
      const selKeys = sSelectedItems ? keys.filter(k => sSelectedItems.includes(k)) : keys.slice(-1);
      let result = [];
      selKeys.forEach(k => { result = result.concat(wm[k]); });
      return result;
    } else {
      const mm = getMonthMap(dates);
      const keys = Object.keys(mm);
      const selKeys = sSelectedItems ? keys.filter(k => sSelectedItems.includes(k)) : keys.slice(-1);
      let result = [];
      selKeys.forEach(k => { result = result.concat(mm[k]); });
      return result;
    }
  }

  function sGetCurrentKeys() {
    const dates = sGetAllDates();
    if (sPeriod === 'daily') return dates;
    if (sPeriod === 'weekly') return Object.keys(getWeekMap(dates));
    return Object.keys(getMonthMap(dates));
  }

  function sGetSelectedKeys() {
    const allKeys = sGetCurrentKeys();
    if (sSelectedItems) return sSelectedItems;
    return allKeys.length ? [allKeys[allKeys.length - 1]] : [];
  }

  function sNavigate(dir) {
    const allKeys = sGetCurrentKeys();
    if (!allKeys.length) return;
    const sel = sGetSelectedKeys();
    const startIdx = allKeys.indexOf(sel[0]);
    const endIdx = allKeys.indexOf(sel[sel.length - 1]);
    const span = endIdx - startIdx + 1;
    const newStart = startIdx + dir;
    const newEnd = newStart + span - 1;
    if (newStart < 0 || newEnd >= allKeys.length) return;
    const newSel = allKeys.slice(newStart, newEnd + 1);
    sSelectedItems = newSel;
    if (sPeriod === 'daily') {
      sSelectedFrom = newSel[0];
      sSelectedTo = newSel[newSel.length - 1];
    }
    sDraw(); sUpdateRangeBtn();
  }

  function sUpdateRangeBtn() {
    const navEl = document.getElementById('sRangeNav');
    if (!navEl) return;
    const allKeys = sGetCurrentKeys();
    const sel = sGetSelectedKeys();
    let rangeLabel;
    if (sel.length === 0) {
      rangeLabel = sPeriod === 'daily' ? 'Pilih tanggal' : sPeriod === 'weekly' ? 'Pilih minggu' : 'Pilih bulan';
    } else if (sel.length === 1) {
      rangeLabel = sPeriod === 'daily' ? fmtDateFull(sel[0])
        : sPeriod === 'weekly' ? 'W' + sel[0].split('-W')[1] + ' ' + sel[0].split('-')[0]
        : MONTHS_SHORT[parseInt(sel[0].slice(5, 7)) - 1] + ' ' + sel[0].split('-')[0];
    } else {
      const a = sel[0], b = sel[sel.length - 1];
      const yA = a.split('-')[0], yB = b.split('-')[0];
      if (sPeriod === 'daily') {
        rangeLabel = yA === yB
          ? fmtDateShort(a) + ' – ' + fmtDateShort(b) + ' ' + yB
          : fmtDateFull(a) + ' – ' + fmtDateFull(b);
      } else if (sPeriod === 'weekly') {
        const wA = 'W' + a.split('-W')[1], wB = 'W' + b.split('-W')[1];
        rangeLabel = yA === yB
          ? wA + ' – ' + wB + ' ' + yA
          : wA + ' ' + yA + ' – ' + wB + ' ' + yB;
      } else {
        const mA = MONTHS_SHORT[parseInt(a.slice(5, 7)) - 1], mB = MONTHS_SHORT[parseInt(b.slice(5, 7)) - 1];
        rangeLabel = yA === yB
          ? mA + ' – ' + mB + ' ' + yA
          : mA + ' ' + yA + ' – ' + mB + ' ' + yB;
      }
    }
    const canPrev = sel.length > 0 && allKeys.indexOf(sel[0]) > 0;
    const canNext = sel.length > 0 && allKeys.indexOf(sel[sel.length - 1]) < allKeys.length - 1;
    navEl.innerHTML = `
      <div class="date-nav">
        <button class="date-nav-btn" id="sNavPrev" ${canPrev ? '' : 'disabled'}>‹</button>
        <button class="chart-range-btn" id="sRangeBtn">${rangeLabel}</button>
        <button class="date-nav-btn" id="sNavNext" ${canNext ? '' : 'disabled'}>›</button>
      </div>`;
    document.getElementById('sNavPrev').addEventListener('click', () => sNavigate(-1));
    document.getElementById('sNavNext').addEventListener('click', () => sNavigate(1));
    document.getElementById('sRangeBtn').addEventListener('click', () => openRangePicker('sankey'));
  }

  function sGetRAW() {
    const allRaw = Engine.getAllRaw();
    const filterDates = new Set(sGetFilteredDates());
    return allRaw.filter(r => filterDates.has(r.date));
  }

  // ═══════════════════════════════════════
  //  SANKEY: LEGEND + CLICK
  // ═══════════════════════════════════════
  function sBuildLegend() {
    const el = document.getElementById('sLegend');
    if (!el) return;
    el.innerHTML = '';
    DEPTS.forEach(d => {
      const item = document.createElement('div');
      item.className = 's-leg';
      item.dataset.dept = d;
      item.innerHTML = '<div class="s-leg-dot" style="background:' + DEPT_COLOR[d] + '"></div><span>' + d + '</span>';
      item.addEventListener('click', () => sHandleClick('dept', d));
      el.appendChild(item);
    });
  }

  function sHandleClick(type, key) {
    if (sSelected.type === type && sSelected.key === key) {
      sSelected = { type: null, key: null };
    } else {
      sSelected = { type, key };
    }
    document.querySelectorAll('.s-leg').forEach(el => {
      if (!sSelected.type) { el.classList.remove('active-leg'); return; }
      const { depts } = sGetConnected(sSelected.type, sSelected.key);
      el.classList.toggle('active-leg', depts.has(el.dataset.dept));
    });
    sDraw();
  }

  function sGetFlowConnected(flowKey) {
    const [grade, dept] = flowKey.split('||');
    return { grades: new Set([grade]), depts: new Set([dept]) };
  }

  function sGetConnected(type, key) {
    if (type === 'flow') return sGetFlowConnected(key);
    const RAW = sGetRAW();
    const grades = new Set(), depts = new Set();
    RAW.forEach(r => {
      if (type === 'grade' && r.grade === key) { grades.add(r.grade); depts.add(r.dept); }
      if (type === 'dept' && r.dept === key) { grades.add(r.grade); depts.add(r.dept); }
    });
    return { grades, depts };
  }

  // ═══════════════════════════════════════
  //  SANKEY: DRAW (Canvas)
  // ═══════════════════════════════════════
  function sDraw() {
    if (!sCanvas) return;
    sUpdateRangeBtn();
    const RAW = sGetRAW();
    const gradeOrder = g => g === '1.6 UP' ? 99 : parseFloat(g);
    const GRADES = [...new Set(RAW.map(r => r.grade))].sort((a, b) => gradeOrder(a) - gradeOrder(b));

    if (RAW.length === 0) {
      sCanvas.style.display = 'none';
      document.getElementById('sEmpty').style.display = 'block';
      return;
    }
    sCanvas.style.display = 'block';
    document.getElementById('sEmpty').style.display = 'none';

    const DPR = devicePixelRatio || 1;
    const CW = sCanvas.parentElement.clientWidth;

    const gradeTotals = {}, deptTotals = {};
    GRADES.forEach(g => { gradeTotals[g] = RAW.filter(r => r.grade === g).reduce((s, r) => s + (sMetric === 'brd' ? r.brd : r.kg), 0); });
    DEPTS.forEach(d => { deptTotals[d] = RAW.filter(r => r.dept === d).reduce((s, r) => s + (sMetric === 'brd' ? r.brd : r.kg), 0); });
    const grandTotal = Object.values(deptTotals).reduce((a, b) => a + b, 0);
    const activeDepts = DEPTS.filter(d => deptTotals[d] > 0);

    const mob = CW < 460;
    const ELEM_GAP = mob ? 6 : 4, ELEM_MAX = mob ? 60 : 80, TEXT_MIN = 22;
    const TOP = 16, PAD_L = mob ? 84 : 122, PAD_R = mob ? 84 : 110, NODE_W = 6;
    const innerW = CW - PAD_L - PAD_R;

    sCanvas.width = CW * DPR; sCanvas.height = 10 * DPR; sCanvas.style.height = '10px';
    const ctx = sCanvas.getContext('2d');
    ctx.scale(DPR, DPR);

    const maxGradeVal = Math.max(...GRADES.map(g => gradeTotals[g] || 0));
    const maxDeptVal = Math.max(...activeDepts.map(d => deptTotals[d] || 0));

    const gradeNodeH = {}, deptNodeH = {};
    GRADES.forEach(g => { gradeNodeH[g] = Math.max(TEXT_MIN, (gradeTotals[g] / maxGradeVal) * ELEM_MAX); });
    const DEPT_TEXT_MIN = d => d === 'BONELESS BONGKAR' ? (mob ? 30 : 36) : TEXT_MIN;
    activeDepts.forEach(d => { deptNodeH[d] = Math.max(DEPT_TEXT_MIN(d), (deptTotals[d] / maxDeptVal) * ELEM_MAX); });

    const totalGradeH = GRADES.reduce((s, g) => s + gradeNodeH[g], 0) + (GRADES.length - 1) * ELEM_GAP;
    const totalDeptH0 = activeDepts.reduce((s, d) => s + deptNodeH[d], 0) + (activeDepts.length - 1) * ELEM_GAP;
    const deptScale = totalDeptH0 > 0 ? totalGradeH / totalDeptH0 : 1;
    activeDepts.forEach(d => { deptNodeH[d] = Math.max(DEPT_TEXT_MIN(d), deptNodeH[d] * deptScale); });

    const gradeY = {}, deptY = {}, gradeBarY = {}, deptBarY = {};
    let gCur = TOP;
    GRADES.forEach(g => { gradeBarY[g] = gCur + gradeNodeH[g] / 2; gradeY[g] = gradeBarY[g]; gCur += gradeNodeH[g] + ELEM_GAP; });
    let dCur = TOP;
    activeDepts.forEach(d => { deptBarY[d] = dCur + deptNodeH[d] / 2; deptY[d] = deptBarY[d]; dCur += deptNodeH[d] + ELEM_GAP; });

    const H = Math.max(gCur, dCur) - ELEM_GAP + TOP + 20;

    sCanvas.width = CW * DPR; sCanvas.height = H * DPR; sCanvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(DPR, DPR); ctx.clearRect(0, 0, CW, H);

    sLayout = { gradeY, deptY, gradeBarY, deptBarY, gradeNodeH, deptNodeH, PAD_L, PAD_R, NODE_W, innerW, CW, H, GRADES, activeDepts };

    const hasSel = sSelected.type !== null;
    const conn = hasSel ? sGetConnected(sSelected.type, sSelected.key) : { grades: new Set(), depts: new Set() };

    const flowMap = {};
    RAW.forEach(row => {
      const key = row.grade + '||' + row.dept;
      if (!flowMap[key]) flowMap[key] = { grade: row.grade, dept: row.dept, brd: 0, kg: 0 };
      flowMap[key].brd += row.brd; flowMap[key].kg += row.kg;
    });
    const flows = Object.values(flowMap).sort((a, b) => {
      const di = activeDepts.indexOf(a.dept) - activeDepts.indexOf(b.dept);
      return di !== 0 ? di : GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade);
    });

    const gradeOffset = {}, deptOffset = {};
    GRADES.forEach(g => { gradeOffset[g] = 0; });
    activeDepts.forEach(d => { deptOffset[d] = 0; });

    const flowShapes = [];
    flows.forEach(row => {
      const v = sMetric === 'brd' ? row.brd : row.kg; if (!v) return;
      if (!gradeY[row.grade] || !deptY[row.dept]) return;
      const lhG = (v / gradeTotals[row.grade]) * gradeNodeH[row.grade];
      const lhD = (v / deptTotals[row.dept]) * deptNodeH[row.dept];
      const gCY2 = gradeBarY[row.grade], dCY = deptBarY[row.dept];
      const y0a = gCY2 - gradeNodeH[row.grade] / 2 + gradeOffset[row.grade], y0b = y0a + lhG;
      const y1a = dCY - deptNodeH[row.dept] / 2 + deptOffset[row.dept], y1b = y1a + lhD;
      const x0 = PAD_L + NODE_W, x1 = PAD_L + innerW - NODE_W, cx = (x0 + x1) / 2;
      const { r, g, b } = hexRgb(DEPT_COLOR[row.dept]);
      const isHl = !hasSel || (conn.grades.has(row.grade) && conn.depts.has(row.dept));

      flowShapes.push({ row, y0a, y0b, y1a, y1b, x0, x1, cx, r, g, b, isHl, v, gradeTotals, deptTotals });
      gradeOffset[row.grade] += lhG;
      deptOffset[row.dept] += lhD;
    });

    // Draw pass 1: dimmed ribbons (background)
    flowShapes.forEach(s => {
      if (s.isHl && hasSel) return;
      const alpha = s.isHl ? 0.45 : 0.14;
      const grad = ctx.createLinearGradient(s.x0, 0, s.x1, 0);
      grad.addColorStop(0, 'rgba(160,160,160,' + (alpha * 0.55) + ')');
      grad.addColorStop(0.42, 'rgba(' + s.r + ',' + s.g + ',' + s.b + ',' + (alpha * 0.35) + ')');
      grad.addColorStop(1, 'rgba(' + s.r + ',' + s.g + ',' + s.b + ',' + alpha + ')');
      ctx.beginPath(); ctx.moveTo(s.x0, s.y0a); ctx.bezierCurveTo(s.cx, s.y0a, s.cx, s.y1a, s.x1, s.y1a);
      ctx.lineTo(s.x1, s.y1b); ctx.bezierCurveTo(s.cx, s.y1b, s.cx, s.y0b, s.x0, s.y0b); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
    });
    // Draw pass 2: highlighted ribbons (foreground)
    flowShapes.forEach(s => {
      if (!s.isHl || !hasSel) return;
      const alpha = 0.72;
      const grad = ctx.createLinearGradient(s.x0, 0, s.x1, 0);
      grad.addColorStop(0, 'rgba(160,160,160,' + (alpha * 0.55) + ')');
      grad.addColorStop(0.42, 'rgba(' + s.r + ',' + s.g + ',' + s.b + ',' + (alpha * 0.35) + ')');
      grad.addColorStop(1, 'rgba(' + s.r + ',' + s.g + ',' + s.b + ',' + alpha + ')');
      ctx.beginPath(); ctx.moveTo(s.x0, s.y0a); ctx.bezierCurveTo(s.cx, s.y0a, s.cx, s.y1a, s.x1, s.y1a);
      ctx.lineTo(s.x1, s.y1b); ctx.bezierCurveTo(s.cx, s.y1b, s.cx, s.y0b, s.x0, s.y0b); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
    });

    sLayout.flowShapes = flowShapes;

    if (hasSel) {
      const x0 = PAD_L + NODE_W, x1 = PAD_L + innerW - NODE_W;
      const LSUFFIX = mob ? 8 : 9;

      function drawPill(text, pillCx, pillCy, rgb, bgAlpha) {
        ctx.save();
        ctx.font = 'bold ' + LSUFFIX + 'px "Plus Jakarta Sans", sans-serif';
        const tw = ctx.measureText(text).width;
        const pw = tw + 8, ph = 14;
        ctx.fillStyle = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + bgAlpha + ')';
        ctx.beginPath(); ctx.roundRect(pillCx - pw/2, pillCy - ph/2, pw, ph, 3); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 2;
        ctx.fillText(text, pillCx, pillCy);
        ctx.restore();
      }

      flowShapes.forEach(({ row, y0a, y0b, y1a, y1b, isHl, v, gradeTotals: gt, deptTotals: dt }) => {
        if (!isHl) return;
        const pctG = (v / gt[row.grade] * 100).toFixed(1) + '%';
        const pctD = (v / dt[row.dept] * 100).toFixed(1) + '%';
        const valStr = fmtShort(v, sMetric);
        const rgb = hexRgb(DEPT_COLOR[row.dept]);

        const lyT = sBezPt(y0a, y1a, 0.15), lyB = sBezPt(y0b, y1b, 0.15), lyC = (lyT+lyB)/2, lH = lyB - lyT;
        const lx = x0 + innerW * 0.18;
        if (lH >= LSUFFIX) {
          ctx.save(); ctx.beginPath(); ctx.rect(x0, lyT-1, innerW*0.36, lH+2); ctx.clip();
          drawPill(pctG, lx, lyC, rgb, 0.9);
          ctx.restore();
        } else {
          drawPill(pctG, lx, lyC, rgb, 0.95);
        }

        const mT = sBezPt(y0a, y1a, 0.5), mB = sBezPt(y0b, y1b, 0.5), mC = (mT+mB)/2, mH = mB - mT;
        const mx = (x0 + x1) / 2;
        const mFontSz = mob ? 10 : 12;
        ctx.save();
        if (mH >= mFontSz) { ctx.beginPath(); ctx.rect(x0 + innerW*0.25, mT-1, innerW*0.5, mH+2); ctx.clip(); }
        ctx.font = 'bold ' + mFontSz + 'px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = getCSSVar('--text');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(valStr, mx, mC);
        ctx.restore();

        const ryT = sBezPt(y0a, y1a, 0.85), ryB = sBezPt(y0b, y1b, 0.85), ryC = (ryT+ryB)/2, rH = ryB - ryT;
        const rx = x1 - innerW * 0.18;
        if (rH >= LSUFFIX) {
          ctx.save(); ctx.beginPath(); ctx.rect(x1 - innerW*0.36, ryT-1, innerW*0.36, rH+2); ctx.clip();
          drawPill(pctD, rx, ryC, rgb, 0.9);
          ctx.restore();
        } else {
          drawPill(pctD, rx, ryC, rgb, 0.95);
        }
      });
    }

    // Grade nodes
    const gFontSz = mob ? 9 : 11;
    const gValSz = mob ? 8 : 10;
    const gBw = mob ? 72 : 108, gBh = mob ? 20 : 22;
    GRADES.forEach(g => {
      const cy = gradeY[g], nh = gradeNodeH[g], val = gradeTotals[g];
      const isSel = sSelected.type === 'grade' && sSelected.key === g;
      const isConn = hasSel && conn.grades.has(g) && !isSel;
      const dimmed = hasSel && !conn.grades.has(g);
      ctx.shadowColor = isSel ? 'rgba(0,0,0,0.3)' : 'transparent'; ctx.shadowBlur = isSel ? 8 : 0;
      ctx.fillStyle = isSel ? getCSSVar('--text') : isConn ? getCSSVar('--text-mid') : dimmed ? '#ccc' : '#999';
      ctx.beginPath(); ctx.roundRect(PAD_L - NODE_W, gradeBarY[g] - nh / 2, NODE_W, nh, 2); ctx.fill(); ctx.shadowBlur = 0;
      const bx = PAD_L - NODE_W - gBw - 6;
      ctx.fillStyle = (isSel || isConn) ? '#f0f2f7' : '#f8f9fc';
      ctx.strokeStyle = isSel ? getCSSVar('--text-soft') : isConn ? getCSSVar('--text-muted') : getCSSVar('--border');
      ctx.lineWidth = (isSel || isConn) ? 1.5 : 1;
      ctx.beginPath(); ctx.roundRect(bx, cy - gBh / 2, gBw, gBh, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = isSel ? getCSSVar('--text') : isConn ? getCSSVar('--text') : dimmed ? '#ccc' : getCSSVar('--text-mid');
      ctx.font = 'bold ' + gFontSz + 'px "Plus Jakarta Sans", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(mob ? g : g + ' kg', bx + 7, cy);
      ctx.fillStyle = isSel ? '#10b981' : isConn ? '#10b981' : dimmed ? '#ccc' : '#999';
      ctx.font = gValSz + 'px "JetBrains Mono", monospace'; ctx.textAlign = 'right';
      ctx.fillText(fmtShort(val, sMetric), bx + gBw - 6, cy);
      ctx.textBaseline = 'alphabetic';
    });

    // Dept nodes
    const dFontSz = mob ? 10 : 12;
    const dValSz = mob ? 9 : 10;
    const dPad = mob ? 6 : 8;
    activeDepts.forEach(d => {
      const cy = deptY[d], nh = deptNodeH[d], val = deptTotals[d], col = DEPT_COLOR[d];
      const { r, g, b } = hexRgb(col);
      const isSel = sSelected.type === 'dept' && sSelected.key === d;
      const isConn = hasSel && conn.depts.has(d) && !isSel;
      const dimmed = hasSel && !conn.depts.has(d);
      const x = PAD_L + innerW;
      ctx.shadowColor = isSel ? col : 'transparent'; ctx.shadowBlur = isSel ? 10 : 0;
      ctx.globalAlpha = dimmed ? 0.15 : 1;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.roundRect(x, deptBarY[d] - nh / 2, NODE_W, nh, 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = isSel ? col : isConn ? col : '#888';
      ctx.font = 'bold ' + dFontSz + 'px "Plus Jakarta Sans", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const dLabelX = x + NODE_W + dPad;
      if (d === 'BONELESS BONGKAR') {
        ctx.fillText('BONELESS', dLabelX, cy - 7.2);
        ctx.fillText('BONGKAR', dLabelX, cy + 7.2);
      } else if (mob && d === 'BONELESS MIX') {
        ctx.fillText('BL.MIX', dLabelX, cy - 7);
      } else {
        ctx.fillText(d, dLabelX, cy - 7);
      }
      ctx.fillStyle = isSel ? 'rgba(' + r + ',' + g + ',' + b + ',0.9)' : isConn ? 'rgba(' + r + ',' + g + ',' + b + ',0.7)' : '#999';
      ctx.font = dValSz + 'px "JetBrains Mono", monospace';
      ctx.fillText(fmtShort(val, sMetric), dLabelX, d === 'BONELESS BONGKAR' ? cy + 21 : cy + 8);
      ctx.globalAlpha = 1;
      if (isSel || isConn) {
        const pct = (val / grandTotal * 100).toFixed(1) + '%';
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.1)';
        ctx.font = (isSel ? 'bold ' : '') + dValSz + 'px "JetBrains Mono", monospace';
        const pw = ctx.measureText(pct).width + 10;
        const pctOffY = d === 'BONELESS BONGKAR' ? cy + 32 : cy + 19;
        ctx.beginPath(); ctx.roundRect(dLabelX, pctOffY, pw, 16, 4); ctx.fill();
        ctx.fillStyle = isSel ? col : 'rgba(' + r + ',' + g + ',' + b + ',0.8)';
        ctx.textAlign = 'left';
        ctx.fillText(pct, dLabelX + 5, d === 'BONELESS BONGKAR' ? cy + 40 : cy + 27);
      }
      ctx.textBaseline = 'alphabetic';
    });
  }

  // ═══════════════════════════════════════
  //  SHARED RANGE PICKER
  // ═══════════════════════════════════════
  function openRangePicker(target) {
    const MAX = target === 'sankey' ? 31 : 9999;
    const dates = target === 'yield' ? Engine.getAvailableDates() : sGetAllDates();
    if (!dates.length) return;

    const period = target === 'yield' ? yPeriod : sPeriod;
    const selItems = target === 'yield' ? ySelectedItems : sSelectedItems;
    const selFrom = target === 'yield' ? ySelectedFrom : sSelectedFrom;
    const selTo = target === 'yield' ? ySelectedTo : sSelectedTo;
    const btnId = target === 'yield' ? 'yRangeBtn' : 'sRangeBtn';

    function applyResult(items, from, to) {
      if (target === 'yield') { ySelectedItems = items; ySelectedFrom = from; ySelectedTo = to; yBuildCharts(); }
      else { sSelectedItems = items; sSelectedFrom = from; sSelectedTo = to; sDraw(); sUpdateRangeBtn(); }
    }
    function resetResult() {
      if (target === 'yield') { ySelectedItems = null; ySelectedFrom = null; ySelectedTo = null; yBuildCharts(); }
      else { sSelectedItems = null; sSelectedFrom = null; sSelectedTo = null; sDraw(); sUpdateRangeBtn(); }
    }

    if (period === 'daily') {
      const defaultCount = target === 'yield' ? 7 : 1;
      openDailyRangePicker(dates, MAX, selFrom, selTo, selItems, btnId, applyResult, resetResult, defaultCount);
      return;
    }

    // Weekly / monthly grid
    const GRID_MAX = MAX;
    let items = [];
    if (period === 'weekly') {
      items = Object.keys(getWeekMap(dates)).map(k => ({ key: k, label: "W" + k.split("-W")[1] }));
    } else {
      items = Object.keys(getMonthMap(dates)).map(k => ({ key: k, label: MONTHS_SHORT[parseInt(k.slice(5, 7)) - 1] }));
    }

    let pickStart = Math.max(0, items.length - GRID_MAX);
    let pickEnd = items.length - 1;
    if (selItems && selItems.length) {
      const s = items.findIndex(i => i.key === selItems[0]);
      const e = items.findIndex(i => i.key === selItems[selItems.length - 1]);
      if (s !== -1 && e !== -1) { pickStart = s; pickEnd = e; }
    }
    let clickPhase = 0;
    closeRangePicker();

    const popup = document.createElement('div');
    popup.className = 'range-picker-popup';
    popup.addEventListener('click', e => e.stopPropagation());
    popup.addEventListener('wheel', e => { e.preventDefault(); document.querySelector('.page-content')?.scrollBy({ top: e.deltaY }); }, { passive: false });

    function renderGrid() {
      const hint = clickPhase === 0 ? 'Klik awal rentang' : 'Klik akhir rentang';
      popup.innerHTML = `
        <div class="range-picker-header"><span class="range-picker-title">${hint}${GRID_MAX < 9999 ? ' <span class="range-picker-hint">(maks ' + GRID_MAX + ')</span>' : ''}</span><button class="range-picker-close" id="rpClose">×</button></div>
        <div class="range-picker-grid" id="rpGrid"></div>
        <div class="range-picker-footer"><button class="range-picker-reset" id="rpReset">Reset</button><button class="range-picker-apply" id="rpApply">Terapkan</button></div>
      `;
      const grid = popup.querySelector('#rpGrid');
      items.forEach((item, idx) => {
        const inRange = idx >= pickStart && idx <= pickEnd;
        const cell = document.createElement('div');
        cell.className = 'range-picker-cell' + (inRange ? ' in-range' : '') + (idx === pickStart ? ' is-start' : '') + (idx === pickEnd ? ' is-end' : '');
        cell.textContent = item.label;
        cell.addEventListener('click', () => {
          if (clickPhase === 0) { pickStart = idx; pickEnd = idx; clickPhase = 1; }
          else { let s = Math.min(pickStart, idx); let e = Math.max(pickStart, idx); if (e - s + 1 > GRID_MAX) { if (idx > pickStart) e = s + GRID_MAX - 1; else s = e - GRID_MAX + 1; } pickStart = s; pickEnd = e; clickPhase = 0; }
          renderGrid();
        });
        grid.appendChild(cell);
      });
      popup.querySelector('#rpClose').addEventListener('click', closeRangePicker);
      popup.querySelector('#rpReset').addEventListener('click', () => { closeRangePicker(); resetResult(); });
      popup.querySelector('#rpApply').addEventListener('click', () => { applyResult(items.slice(pickStart, pickEnd + 1).map(i => i.key), null, null); closeRangePicker(); });
    }

    renderGrid();
    document.body.appendChild(popup);
    positionPopup(popup, btnId);
    _rangeScrollListener = () => positionPopup(popup, btnId);
    const sc = document.querySelector('.page-content');
    if (sc) sc.addEventListener('scroll', _rangeScrollListener);
    _rangeDocListener = () => closeRangePicker();
    setTimeout(() => document.addEventListener('click', _rangeDocListener), 0);
  }

  function openDailyRangePicker(dates, MAX, selFrom, selTo, selItems, btnId, applyResult, resetResult, defaultCount) {
    const availSet = new Set(dates);
    const allMonths = [...new Set(dates.map(d => d.slice(0, 7)))];
    let fromDate = null, toDate = null;
    if (selFrom && selTo) { fromDate = selFrom; toDate = selTo; }
    else if (selItems && selItems.length) { fromDate = selItems[0]; toDate = selItems[selItems.length - 1]; }
    else { const range = dates.slice(-(defaultCount || MAX)); fromDate = range[0]; toDate = range[range.length - 1]; }

    let clickPhase = 0;
    let calMonth = (fromDate || dates[dates.length - 1]).slice(0, 7);
    closeRangePicker();

    const popup = document.createElement('div');
    popup.className = 'range-picker-popup range-picker-daily';
    popup.addEventListener('click', e => e.stopPropagation());
    popup.addEventListener('wheel', e => { e.preventDefault(); document.querySelector('.page-content')?.scrollBy({ top: e.deltaY }); }, { passive: false });

    function renderAll() {
      const hint = clickPhase === 0 ? 'Pilih tanggal mulai' : 'Pilih tanggal akhir';
      popup.innerHTML = `
        <div class="range-picker-header"><span class="range-picker-title">${hint}${MAX < 9999 ? ' <span class="range-picker-hint">(maks ' + MAX + ' hari)</span>' : ''}</span><button class="range-picker-close" id="rpClose">×</button></div>
        <div class="range-daily-summary">
          <div class="range-daily-summary-field ${clickPhase === 0 ? 'is-active' : ''}"><div class="range-daily-summary-label">Dari</div><div class="range-daily-summary-val">${fmtDateFull(fromDate)}</div></div>
          <div class="range-daily-summary-arrow">→</div>
          <div class="range-daily-summary-field ${clickPhase === 1 ? 'is-active' : ''}"><div class="range-daily-summary-label">Sampai</div><div class="range-daily-summary-val">${fmtDateFull(toDate)}</div></div>
        </div>
        <div class="range-cal-panel" id="rpCalPanel"></div>
        <div class="range-picker-footer"><button class="range-picker-reset" id="rpReset">Reset</button><button class="range-picker-apply" id="rpApply" ${!fromDate || !toDate || clickPhase === 1 ? 'disabled' : ''}>Terapkan</button></div>
      `;
      popup.querySelector('#rpClose').addEventListener('click', closeRangePicker);
      popup.querySelector('#rpReset').addEventListener('click', () => { closeRangePicker(); resetResult(); });
      popup.querySelector('#rpApply').addEventListener('click', () => {
        if (fromDate && toDate) {
          const f = fromDate <= toDate ? fromDate : toDate;
          const t = fromDate <= toDate ? toDate : fromDate;
          applyResult(dates.filter(d => d >= f && d <= t), f, t);
        } else { resetResult(); }
        closeRangePicker();
      });
      renderCalPanel(popup.querySelector('#rpCalPanel'));
    }

    function renderCalPanel(panel) {
      const [yr, mo] = calMonth.split('-').map(Number);
      const from = fromDate && toDate ? (fromDate <= toDate ? fromDate : toDate) : fromDate;
      const to = fromDate && toDate ? (fromDate <= toDate ? toDate : fromDate) : null;

      panel.innerHTML = `
        <div class="range-cal-nav">
          <button class="date-nav-btn" id="rpCalPrev" ${calMonth <= allMonths[0] ? 'disabled' : ''}>‹</button>
          <span class="date-nav-label" style="font-size:12px">${KPI.formatMonthYear(calMonth)}</span>
          <button class="date-nav-btn" id="rpCalNext" ${calMonth >= allMonths[allMonths.length - 1] ? 'disabled' : ''}>›</button>
        </div>
        <div class="range-cal-grid" id="rpCalGrid"></div>
      `;
      panel.querySelector('#rpCalPrev').addEventListener('click', () => {
        const [y2, m2] = calMonth.split('-').map(Number);
        const prev = new Date(y2, m2 - 2, 1);
        calMonth = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
        renderCalPanel(panel);
      });
      panel.querySelector('#rpCalNext').addEventListener('click', () => {
        const [y2, m2] = calMonth.split('-').map(Number);
        const next = new Date(y2, m2, 1);
        calMonth = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0');
        renderCalPanel(panel);
      });

      const grid = panel.querySelector('#rpCalGrid');
      ['Sen','Sel','Rab','Kam','Jum','Sab','Min'].forEach(d => {
        const el = document.createElement('div'); el.className = 'range-cal-dow'; el.textContent = d; grid.appendChild(el);
      });
      const firstDay = new Date(yr, mo - 1, 1);
      let startDow = firstDay.getDay(); startDow = startDow === 0 ? 6 : startDow - 1;
      for (let i = 0; i < startDow; i++) grid.appendChild(Object.assign(document.createElement('div'), { className: 'range-cal-cell' }));

      const daysInMonth = new Date(yr, mo, 0).getDate();
      const todayStr = new Date().toISOString().slice(0, 10);
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = calMonth + '-' + String(d).padStart(2, '0');
        const hasData = availSet.has(dateStr);
        const isFuture = dateStr > todayStr;
        const inRange = from && to && dateStr >= from && dateStr <= to;
        const isEndpoint = dateStr === fromDate || dateStr === toDate;
        let tooFar = false;
        if (!isFuture && clickPhase === 1 && fromDate) {
          if (Math.abs(Math.round((new Date(dateStr) - new Date(fromDate)) / 86400000)) >= MAX) tooFar = true;
        }
        const cell = document.createElement('div');
        cell.className = 'range-cal-cell' + (!isFuture && !tooFar ? ' available' : '') + (!hasData && !isFuture && !tooFar ? ' no-data' : '') + (inRange ? ' in-range' : '') + (isEndpoint ? ' is-endpoint' : '') + (tooFar && !isFuture ? ' too-far' : '');
        cell.innerHTML = '<span>' + d + '</span>';
        if (!isFuture && !tooFar) {
          cell.addEventListener('click', () => {
            if (clickPhase === 0) { fromDate = dateStr; toDate = null; clickPhase = 1; }
            else { toDate = dateStr; if (toDate < fromDate) { const tmp = fromDate; fromDate = toDate; toDate = tmp; } clickPhase = 0; }
            renderAll();
          });
        }
        grid.appendChild(cell);
      }
    }

    renderAll();
    document.body.appendChild(popup);
    positionPopup(popup, btnId);
    _rangeScrollListener = () => positionPopup(popup, btnId);
    const sc = document.querySelector('.page-content');
    if (sc) sc.addEventListener('scroll', _rangeScrollListener);
    _rangeDocListener = () => closeRangePicker();
    setTimeout(() => document.addEventListener('click', _rangeDocListener), 0);
  }

  function positionPopup(popup, btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    popup.style.top = (rect.bottom + 6) + 'px';
    popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 300 - 32)) + 'px';
  }

  function closeRangePicker() {
    if (_rangeDocListener) { document.removeEventListener('click', _rangeDocListener); _rangeDocListener = null; }
    if (_rangeScrollListener) { const sc = document.querySelector('.page-content'); if (sc) sc.removeEventListener('scroll', _rangeScrollListener); _rangeScrollListener = null; }
    document.querySelector('.range-picker-popup')?.remove();
  }


  // ═══════════════════════════════════════
  //  CANVAS CLICK
  // ═══════════════════════════════════════
  function sHitTest(canvas, mx, my) {
    const { gradeY: gY, deptY: dY, PAD_L: pl, innerW: iw, NODE_W: nw, CW: cw, GRADES: G, activeDepts: AD, flowShapes } = sLayout;
    if (!G) return false;
    for (const g of G) { if (my >= gY[g] - 18 && my <= gY[g] + 18 && mx >= 0 && mx <= pl + nw + 50) return true; }
    const xS = pl + iw;
    for (const d of AD) { if (my >= dY[d] - 26 && my <= dY[d] + 30 && mx >= xS && mx <= cw) return true; }
    if (flowShapes && flowShapes.length) {
      const DPR = devicePixelRatio || 1;
      const ctx = canvas.getContext('2d');
      for (const s of flowShapes) {
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0a);
        ctx.bezierCurveTo(s.cx, s.y0a, s.cx, s.y1a, s.x1, s.y1a);
        ctx.lineTo(s.x1, s.y1b);
        ctx.bezierCurveTo(s.cx, s.y1b, s.cx, s.y0b, s.x0, s.y0b);
        ctx.closePath();
        if (ctx.isPointInPath(mx * DPR, my * DPR)) return true;
      }
    }
    return false;
  }

  function initCanvasClick() {
    const canvas = document.getElementById('sCanvas');
    if (!canvas) return;
    let cursorRaf = 0;
    canvas.addEventListener('mousemove', e => {
      if (cursorRaf) return;
      cursorRaf = requestAnimationFrame(() => {
        cursorRaf = 0;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        canvas.style.cursor = sHitTest(canvas, mx, my) ? 'pointer' : '';
      });
    }, { passive: true });
    canvas.addEventListener('mouseleave', () => { canvas.style.cursor = ''; });
    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const { gradeY: gY, deptY: dY, PAD_L: pl, innerW: iw, NODE_W: nw, CW: cw, GRADES: G, activeDepts: AD, flowShapes } = sLayout;
      if (!G) return;
      // Priority 1: grade nodes
      for (const g of G) { if (my >= gY[g] - 18 && my <= gY[g] + 18 && mx >= 0 && mx <= pl + nw + 50) { sHandleClick('grade', g); return; } }
      // Priority 2: dept nodes
      const xS = pl + iw;
      for (const d of AD) { if (my >= dY[d] - 26 && my <= dY[d] + 30 && mx >= xS && mx <= cw) { sHandleClick('dept', d); return; } }
      // Priority 3: ribbons (smallest value first)
      if (flowShapes && flowShapes.length) {
        const DPR = devicePixelRatio || 1;
        const ctx = canvas.getContext('2d');
        const sorted = [...flowShapes].sort((a, b) => a.v - b.v);
        for (const s of sorted) {
          ctx.beginPath();
          ctx.moveTo(s.x0, s.y0a);
          ctx.bezierCurveTo(s.cx, s.y0a, s.cx, s.y1a, s.x1, s.y1a);
          ctx.lineTo(s.x1, s.y1b);
          ctx.bezierCurveTo(s.cx, s.y1b, s.cx, s.y0b, s.x0, s.y0b);
          ctx.closePath();
          if (ctx.isPointInPath(mx * DPR, my * DPR)) {
            sHandleClick('flow', s.row.grade + '||' + s.row.dept);
            return;
          }
        }
      }
      sSelected = { type: null, key: null };
      document.querySelectorAll('.s-leg').forEach(el => el.classList.remove('active-leg'));
      sDraw();
    });
  }

  function renderPage(container) {
    render(container);
    initCanvasClick();
  }

  return { render: renderPage };
})();
