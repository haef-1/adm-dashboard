/* ═══════════════════════════════════════
   OVERVIEW-TABLE.JS — Overview Table View
   ═══════════════════════════════════════ */

const OverviewTablePage = (() => {
  let period = "daily";
  let selectedItems = null;
  let selectedFrom = null;
  let selectedTo = null;
  let sortCol = "date";
  let sortDir = "asc";
  let _rangeDocListener = null;
  let _rangeScrollListener = null;

  // Bahan table state
  let bhnPeriod = "daily";
  let bhnMetric = "brd";
  let bhnPvMode = "AYAM BARU";
  let bhnSelectedItems = null;
  let bhnSelectedFrom = null;
  let bhnSelectedTo = null;
  let bhnSortCol = "date";
  let bhnSortDir = "desc";
  let _bhnRangeDocListener = null;
  let _bhnRangeScrollListener = null;

  // Search material table state
  let smtMetric = "brd";
  let smtPeriod = "daily";
  let smtSelectedMaterials = [];
  let smtFilters = { dept: "All", pv: "All", mvt: "All" };
  let smtSelectedItems = null;
  let smtSelectedFrom = null;
  let smtSelectedTo = null;
  let _smtRangeDocListener = null;
  let _smtRangeScrollListener = null;

  const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  function fmtDateLabel(dateStr, includeYear) {
    const p = dateStr.split("-");
    const base = p[2] + " " + MONTH_NAMES[parseInt(p[1])];
    return includeYear ? base + " " + p[0] : base;
  }

  function fmtRangeLabel(dateA, dateB, periodType) {
    if (periodType === "monthly") {
      const labelA = KPI.formatMonthYear(dateA);
      const labelB = KPI.formatMonthYear(dateB);
      const yA = dateA.split("-")[0], yB = dateB.split("-")[0];
      if (yA === yB) {
        return MONTH_NAMES[parseInt(dateA.split("-")[1])] + " – " + labelB;
      }
      return labelA + " – " + labelB;
    }
    if (periodType === "weekly") {
      const yA = dateA.split("-")[0], yB = dateB.split("-")[0];
      const wA = "W" + KPI.getISOWeek(dateA);
      const wB = "W" + KPI.getISOWeek(dateB);
      if (yA === yB) {
        return wA + " – " + wB + ", " + yA;
      }
      return wA + " " + yA + " – " + wB + " " + yB;
    }
    const yA = dateA.split("-")[0], yB = dateB.split("-")[0];
    if (yA === yB) {
      return fmtDateLabel(dateA, false) + " – " + fmtDateLabel(dateB, true);
    }
    return fmtDateLabel(dateA, true) + " – " + fmtDateLabel(dateB, true);
  }

  function render(container) {
    selectedItems = null;
    selectedFrom = null;
    selectedTo = null;
    sortCol = "date";
    sortDir = "desc";

    bhnSelectedItems = null;
    bhnSelectedFrom = null;
    bhnSelectedTo = null;
    bhnSortCol = "date";
    bhnSortDir = "desc";

    smtSelectedMaterials = [];
    smtFilters = { dept: "All", pv: "All", mvt: "All" };
    smtSelectedItems = null;
    smtSelectedFrom = null;
    smtSelectedTo = null;

    container.innerHTML = `
      <div class="page-title">Overview — Table</div>
      <div class="table-section">
        <div class="table-section-header">
          <h3 class="table-section-title">KPI Harian</h3>
          <div class="table-controls">
            <div id="tblPeriodWrap"></div>
            <div id="tblRangeNav"></div>
            <button class="table-export-btn" id="tblExport">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
          </div>
        </div>
        <div class="table-wrapper" id="kpiTableWrap"></div>
      </div>

      <div class="table-section">
        <div class="table-section-header">
          <h3 class="table-section-title" id="bhnTitle">Persebaran Bahan Harian</h3>
          <div class="table-controls">
            <div class="toggle-group" id="bhnMetricToggle">
              <button class="toggle-btn active" data-metric="brd">BRD</button>
              <button class="toggle-btn" data-metric="kg">KG</button>
            </div>
            <div id="bhnPvWrap"></div>
            <div id="bhnPeriodWrap"></div>
            <div id="bhnRangeNav"></div>
            <button class="table-export-btn" id="bhnExport">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
          </div>
        </div>
        <div class="table-wrapper" id="bhnTableWrap"></div>
      </div>

      <div class="table-section">
        <div class="table-section-header">
          <h3 class="table-section-title" id="smtTitle">Search Material</h3>
          <div class="table-controls">
            <div class="toggle-group" id="smtMetricToggle">
              <button class="toggle-btn active" data-metric="brd">BRD</button>
              <button class="toggle-btn" data-metric="kg">KG</button>
              <button class="toggle-btn" data-metric="pct" id="smtPctBtn" style="display:none">%</button>
            </div>
            <div id="smtPeriodWrap"></div>
            <div id="smtRangeNav"></div>
            <button class="table-export-btn" id="smtExport">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
          </div>
        </div>
        <div class="smt-search-bar">
          <div class="search-material-wrap">
            <span class="search-material-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </span>
            <input type="text" class="search-material-input" id="smtSearchInput" placeholder="Search for material...">
            <div class="search-autocomplete" id="smtAutocomplete"></div>
          </div>
          <div class="filter-row">
            <div id="smtDeptFilterWrap"></div>
            <div id="smtPvFilterWrap"></div>
            <div id="smtMvtFilterWrap"></div>
          </div>
        </div>
        <div class="material-tags" id="smtTags" style="padding:0 16px 8px">
          <span class="material-tags-placeholder">Pilih material untuk ditampilkan</span>
        </div>
        <div class="table-wrapper" id="smtTableWrap"></div>
      </div>
    `;

    initPeriodSelector();
    renderKpiTable();
    initBahanControls();
    renderBahanTable();
    initSmtControls();
    renderSmtTable();

    document.getElementById("tblExport").addEventListener("click", exportTable);
    document.getElementById("bhnExport").addEventListener("click", exportBahanTable);
    document.getElementById("smtExport").addEventListener("click", exportSmtTable);
  }

  function initPeriodSelector() {
    const wrap = document.getElementById("tblPeriodWrap");
    const sel = DatePicker.createCustomSelect(
      [
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
        { value: "monthly", label: "Monthly" },
      ],
      period,
      (val) => {
        period = val;
        selectedItems = null;
        selectedFrom = null;
        selectedTo = null;
        renderKpiTable();
      },
    );
    wrap.appendChild(sel.el);
  }

  function getWeekMap(dates) {
    const map = {};
    dates.forEach(d => {
      const key = "W" + KPI.getISOWeek(d);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }

  function getMonthMap(dates) {
    const map = {};
    dates.forEach(d => {
      const ym = d.slice(0, 7);
      if (!map[ym]) map[ym] = [];
      map[ym].push(d);
    });
    return map;
  }

  function renderKpiTable() {
    const titleEl = document.querySelector(".table-section-title");
    if (titleEl) {
      const titles = { daily: "KPI Harian", weekly: "KPI Mingguan", monthly: "KPI Bulanan" };
      titleEl.textContent = titles[period];
    }

    const dates = Engine.getAvailableDates();
    if (!dates.length) {
      document.getElementById("kpiTableWrap").innerHTML = `<p class="table-empty">Tidak ada data tersedia.</p>`;
      return;
    }

    const MAX_DAILY = 31;
    const MAX_WEEKLY = 999;
    const MAX_MONTHLY = 999;
    let rows = [];

    if (period === "daily") {
      const range = selectedItems
        ? dates.filter(d => selectedItems.includes(d))
        : dates.slice(-7);
      range.forEach(d => {
        const kpi = Engine.getKpiForDate(d);
        const susut = Engine.getSusutLBForDate(d);
        const parts = d.split("-");
        rows.push({
          date: d,
          label: parts[2] + " " + MONTH_NAMES[parseInt(parts[1])] + " " + parts[0],
          yk: kpi ? kpi.yk : 0,
          yb: kpi ? kpi.yb : 0,
          w: kpi ? kpi.w : 0,
          susut: susut !== null ? susut : 0,
        });
      });
    } else if (period === "weekly") {
      const weekMap = getWeekMap(dates);
      const allKeys = Object.keys(weekMap);
      const weekKeys = selectedItems
        ? allKeys.filter(k => selectedItems.includes(k))
        : allKeys.slice(-7);
      weekKeys.forEach(wk => {
        const wDates = weekMap[wk];
        const kpi = Engine.getKpiForRange(wDates);
        const susut = Engine.getSusutLBForRange(wDates);
        rows.push({
          date: wDates[0],
          label: "Week " + wk.slice(1) + ", " + wDates[0].split("-")[0],
          yk: kpi.yk,
          yb: kpi.yb,
          w: kpi.w,
          susut: susut !== null ? susut : 0,
        });
      });
    } else {
      const monthMap = getMonthMap(dates);
      const allKeys = Object.keys(monthMap);
      const mKeys = selectedItems
        ? allKeys.filter(k => selectedItems.includes(k))
        : allKeys.slice(-7);
      mKeys.forEach(ym => {
        const mDates = monthMap[ym];
        const kpi = Engine.getKpiForRange(mDates);
        const susut = Engine.getSusutLBForRange(mDates);
        rows.push({
          date: ym,
          label: KPI.formatMonthYear(ym),
          yk: kpi.yk,
          yb: kpi.yb,
          w: kpi.w,
          susut: susut !== null ? susut : 0,
        });
      });
    }

    // Sort
    rows.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (typeof va === "string") {
        const cmp = va.localeCompare(vb);
        return sortDir === "asc" ? cmp : -cmp;
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });

    // Find the latest row
    const latestDate = rows.length ? rows.reduce((max, r) => r.date > max ? r.date : max, rows[0].date) : null;

    // Render table
    const columns = [
      { key: "date", label: "Tanggal" },
      { key: "yk", label: "Yield Karkas (%)" },
      { key: "yb", label: "Yield Byproduct (%)" },
      { key: "w", label: "Waste (%)" },
      { key: "susut", label: "Susut LB (%)" },
    ];

    const wrap = document.getElementById("kpiTableWrap");
    wrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            ${columns.map(c => `<th class="sortable ${sortCol === c.key ? (sortDir === 'asc' ? 'sort-asc' : 'sort-desc') : ''}" data-col="${c.key}">${c.label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map(r => `
            <tr class="${r.date === latestDate ? 'row-latest' : ''}">
              <td>${r.label}</td>
              <td class="${r.yk < 74.5 ? 'val-danger' : ''}">${r.yk.toFixed(2)}</td>
              <td>${r.yb.toFixed(2)}</td>
              <td class="${r.w > 4.5 ? 'val-danger' : ''}">${r.w.toFixed(2)}</td>
              <td>${r.susut.toFixed(2)}</td>
            </tr>
          `).join("") : `<tr><td colspan="5" class="table-empty">Tidak ada data untuk periode ini.</td></tr>`}
        </tbody>
      </table>
    `;

    wrap.classList.toggle("scrollable", rows.length > 7);

    // Sort click handlers
    wrap.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (sortCol === col) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortCol = col;
          sortDir = "asc";
        }
        renderKpiTable();
      });
    });

    // Range nav button
    const navEl = document.getElementById("tblRangeNav");
    if (navEl) {
      let rangeLabel;
      if (rows.length) {
        const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
        rangeLabel = fmtRangeLabel(sorted[0].date, sorted[sorted.length - 1].date, period);
      } else if (selectedFrom && selectedTo) {
        rangeLabel = fmtRangeLabel(selectedFrom, selectedTo, period);
      } else {
        rangeLabel = "Pilih tanggal";
      }
      navEl.innerHTML = `<button class="chart-range-btn" id="tblRangeBtn">${rangeLabel}</button>`;
      document.getElementById("tblRangeBtn").addEventListener("click", openRangePicker);
    }
  }

  // ── Range Picker ──
  function openRangePicker() {
    const dates = Engine.getAvailableDates();
    if (!dates.length) return;

    if (period === "daily") {
      openDailyRangePicker(dates, 31);
    } else {
      openGridRangePicker(dates);
    }
  }

  function closeRangePicker() {
    if (_rangeDocListener) {
      document.removeEventListener("click", _rangeDocListener);
      _rangeDocListener = null;
    }
    if (_rangeScrollListener) {
      const sc = document.querySelector(".page-content");
      if (sc) sc.removeEventListener("scroll", _rangeScrollListener);
      _rangeScrollListener = null;
    }
    document.querySelectorAll(".range-picker-popup").forEach(el => el.remove());
  }

  function openDailyRangePicker(dates, MAX) {
    const availSet = new Set(dates);
    const allMonths = [...new Set(dates.map(d => d.slice(0, 7)))];

    let fromDate = null, toDate = null;
    if (selectedFrom && selectedTo) {
      fromDate = selectedFrom;
      toDate = selectedTo;
    } else if (selectedItems && selectedItems.length) {
      fromDate = selectedItems[0];
      toDate = selectedItems[selectedItems.length - 1];
    } else {
      const range = dates.slice(-7);
      fromDate = range[0];
      toDate = range[range.length - 1];
    }

    let clickPhase = 0;
    let calMonth = (fromDate || dates[dates.length - 1]).slice(0, 7);

    closeRangePicker();

    const popup = document.createElement("div");
    popup.className = "range-picker-popup range-picker-daily";
    popup.addEventListener("click", e => e.stopPropagation());
    popup.addEventListener("wheel", e => {
      e.preventDefault();
      document.querySelector(".page-content")?.scrollBy({ top: e.deltaY });
    }, { passive: false });

    function fmtDate(d) {
      if (!d) return "—";
      const p = d.split("-");
      return p[2] + " " + MONTH_NAMES[parseInt(p[1])] + " " + p[0];
    }

    function renderAll() {
      const hint = clickPhase === 0 ? "Pilih tanggal mulai" : "Pilih tanggal akhir";
      popup.innerHTML = `
        <div class="range-picker-header">
          <span class="range-picker-title">${hint} <span class="range-picker-hint">(maks ${MAX} hari)</span></span>
          <button class="range-picker-close" id="rpClose">×</button>
        </div>
        <div class="range-daily-summary">
          <div class="range-daily-summary-field ${clickPhase === 0 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Tanggal Mulai</div>
            <div class="range-daily-summary-val">${fmtDate(fromDate)}</div>
          </div>
          <div class="range-daily-summary-arrow">→</div>
          <div class="range-daily-summary-field ${clickPhase === 1 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Tanggal Akhir</div>
            <div class="range-daily-summary-val">${fmtDate(toDate)}</div>
          </div>
        </div>
        <div class="range-cal-panel" id="rpCalPanel"></div>
        <div class="range-picker-footer">
          <button class="range-picker-reset" id="rpReset">Reset</button>
          <button class="range-picker-apply" id="rpApply" ${!fromDate || !toDate || clickPhase === 1 ? "disabled" : ""}>Terapkan</button>
        </div>
      `;

      popup.querySelector("#rpClose").addEventListener("click", closeRangePicker);
      popup.querySelector("#rpReset").addEventListener("click", () => {
        selectedItems = null;
        selectedFrom = null;
        selectedTo = null;
        closeRangePicker();
        renderKpiTable();
      });
      popup.querySelector("#rpApply").addEventListener("click", () => {
        if (fromDate && toDate) {
          const f = fromDate <= toDate ? fromDate : toDate;
          const t = fromDate <= toDate ? toDate : fromDate;
          selectedFrom = f;
          selectedTo = t;
          selectedItems = dates.filter(d => d >= f && d <= t);
        } else {
          selectedItems = null;
          selectedFrom = null;
          selectedTo = null;
        }
        closeRangePicker();
        renderKpiTable();
      });

      renderCalPanel(popup.querySelector("#rpCalPanel"));
    }

    function renderCalPanel(panel) {
      const [yr, mo] = calMonth.split("-").map(Number);
      const minMonth = allMonths[0];
      const maxMonth = allMonths[allMonths.length - 1];
      const from = fromDate && toDate ? (fromDate <= toDate ? fromDate : toDate) : fromDate;
      const to = fromDate && toDate ? (fromDate <= toDate ? toDate : fromDate) : null;

      panel.innerHTML = `
        <div class="range-cal-nav">
          <button class="date-nav-btn" id="rpCalPrev" ${calMonth <= minMonth ? "disabled" : ""}>‹</button>
          <span class="date-nav-label" style="font-size:12px">${KPI.formatMonthYear(calMonth)}</span>
          <button class="date-nav-btn" id="rpCalNext" ${calMonth >= maxMonth ? "disabled" : ""}>›</button>
        </div>
        <div class="range-cal-grid" id="rpCalGrid"></div>
      `;

      panel.querySelector("#rpCalPrev").addEventListener("click", () => {
        const [y, m] = calMonth.split("-").map(Number);
        const prev = new Date(y, m - 2, 1);
        calMonth = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0");
        renderCalPanel(panel);
      });
      panel.querySelector("#rpCalNext").addEventListener("click", () => {
        const [y, m] = calMonth.split("-").map(Number);
        const next = new Date(y, m, 1);
        calMonth = next.getFullYear() + "-" + String(next.getMonth() + 1).padStart(2, "0");
        renderCalPanel(panel);
      });

      const grid = panel.querySelector("#rpCalGrid");
      ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].forEach(d => {
        const el = document.createElement("div");
        el.className = "range-cal-dow";
        el.textContent = d;
        grid.appendChild(el);
      });

      const firstDay = new Date(yr, mo - 1, 1);
      let startDow = firstDay.getDay();
      startDow = startDow === 0 ? 6 : startDow - 1;
      for (let i = 0; i < startDow; i++) {
        grid.appendChild(Object.assign(document.createElement("div"), { className: "range-cal-cell" }));
      }

      const daysInMonth = new Date(yr, mo, 0).getDate();
      const today = new Date();
      const todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = calMonth + "-" + String(d).padStart(2, "0");
        const hasData = availSet.has(dateStr);
        const isFuture = dateStr > todayStr;
        const inRange = from && to && dateStr >= from && dateStr <= to;
        const isEndpoint = dateStr === fromDate || dateStr === toDate;

        let tooFar = false;
        if (!isFuture && clickPhase === 1 && fromDate) {
          const diff = Math.round((new Date(dateStr) - new Date(fromDate)) / 86400000);
          if (Math.abs(diff) >= MAX) tooFar = true;
        }

        const cell = document.createElement("div");
        cell.className = "range-cal-cell" +
          (!isFuture && !tooFar ? " available" : "") +
          (!hasData && !isFuture && !tooFar ? " no-data" : "") +
          (inRange ? " in-range" : "") +
          (isEndpoint ? " is-endpoint" : "") +
          (tooFar && !isFuture ? " too-far" : "");
        cell.innerHTML = `<span>${d}</span>`;

        if (!isFuture && !tooFar) {
          cell.addEventListener("click", () => {
            if (clickPhase === 0) {
              fromDate = dateStr;
              toDate = null;
              clickPhase = 1;
            } else {
              toDate = dateStr;
              if (toDate < fromDate) { const tmp = fromDate; fromDate = toDate; toDate = tmp; }
              clickPhase = 0;
            }
            renderAll();
          });
        }

        grid.appendChild(cell);
      }
    }

    renderAll();
    document.body.appendChild(popup);

    function positionPopup() {
      const btn = document.getElementById("tblRangeBtn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      popup.style.top = rect.bottom + 6 + "px";
      popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 270 - 32)) + "px";
    }
    positionPopup();
    _rangeScrollListener = positionPopup;
    const sc = document.querySelector(".page-content");
    if (sc) sc.addEventListener("scroll", _rangeScrollListener);

    _rangeDocListener = () => closeRangePicker();
    setTimeout(() => document.addEventListener("click", _rangeDocListener), 0);
  }

  function openGridRangePicker(dates) {
    const MAX = period === "weekly" ? 999 : 999;
    let items = [];
    if (period === "weekly") {
      const wm = getWeekMap(dates);
      items = Object.keys(wm).map(k => ({ key: k, label: k }));
    } else {
      const mm = getMonthMap(dates);
      items = Object.keys(mm).map(k => ({ key: k, label: KPI.formatMonthYear(k) }));
    }

    let pickStart = Math.max(0, items.length - 7);
    let pickEnd = items.length - 1;
    if (selectedItems && selectedItems.length) {
      const s = items.findIndex(i => i.key === selectedItems[0]);
      const e = items.findIndex(i => i.key === selectedItems[selectedItems.length - 1]);
      if (s !== -1 && e !== -1) { pickStart = s; pickEnd = e; }
    }

    let clickPhase = 0;
    closeRangePicker();

    const popup = document.createElement("div");
    popup.className = "range-picker-popup";
    popup.addEventListener("click", e => e.stopPropagation());
    popup.addEventListener("wheel", e => {
      e.preventDefault();
      document.querySelector(".page-content")?.scrollBy({ top: e.deltaY });
    }, { passive: false });

    function renderGrid() {
      const hint = clickPhase === 0 ? "Klik awal rentang" : "Klik akhir rentang";
      popup.innerHTML = `
        <div class="range-picker-header">
          <span class="range-picker-title">${hint}</span>
          <button class="range-picker-close" id="rpClose">×</button>
        </div>
        <div class="range-picker-grid" id="rpGrid"></div>
        <div class="range-picker-footer">
          <button class="range-picker-reset" id="rpReset">Reset</button>
          <button class="range-picker-apply" id="rpApply">Terapkan</button>
        </div>
      `;

      const grid = popup.querySelector("#rpGrid");
      items.forEach((item, idx) => {
        const inRange = idx >= pickStart && idx <= pickEnd;
        const cell = document.createElement("div");
        cell.className = "range-picker-cell" +
          (inRange ? " in-range" : "") +
          (idx === pickStart ? " is-start" : "") +
          (idx === pickEnd ? " is-end" : "");
        cell.textContent = item.label;
        cell.addEventListener("click", () => {
          if (clickPhase === 0) {
            pickStart = idx;
            pickEnd = idx;
            clickPhase = 1;
          } else {
            let s = Math.min(pickStart, idx);
            let e = Math.max(pickStart, idx);
            pickStart = s;
            pickEnd = e;
            clickPhase = 0;
          }
          renderGrid();
        });
        grid.appendChild(cell);
      });

      popup.querySelector("#rpClose").addEventListener("click", closeRangePicker);
      popup.querySelector("#rpReset").addEventListener("click", () => {
        selectedItems = null;
        selectedFrom = null;
        selectedTo = null;
        closeRangePicker();
        renderKpiTable();
      });
      popup.querySelector("#rpApply").addEventListener("click", () => {
        selectedItems = items.slice(pickStart, pickEnd + 1).map(i => i.key);
        selectedFrom = null;
        selectedTo = null;
        closeRangePicker();
        renderKpiTable();
      });
    }

    renderGrid();
    document.body.appendChild(popup);

    function positionPopup() {
      const btn = document.getElementById("tblRangeBtn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      popup.style.top = rect.bottom + 6 + "px";
      popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 300 - 32)) + "px";
    }
    positionPopup();
    _rangeScrollListener = positionPopup;
    const sc = document.querySelector(".page-content");
    if (sc) sc.addEventListener("scroll", _rangeScrollListener);

    _rangeDocListener = () => closeRangePicker();
    setTimeout(() => document.addEventListener("click", _rangeDocListener), 0);
  }

  // ── Export KPI ──
  function exportTable() {
    const table = document.querySelector("#kpiTableWrap .data-table");
    if (!table) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, "KPI");
    XLSX.writeFile(wb, `KPI_Overview_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ════════════════════════════════════════
  //  PERSEBARAN BAHAN TABLE
  // ════════════════════════════════════════

  const BAHAN_DEPTS = ["CUT UP", "BONELESS", "AU", "PARTING"];

  function initBahanControls() {
    // Metric toggle
    document.querySelectorAll("#bhnMetricToggle .toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#bhnMetricToggle .toggle-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        bhnMetric = btn.dataset.metric;
        renderBahanTable();
      });
    });

    // PV selector
    const pvSel = DatePicker.createCustomSelect(
      [
        { value: "AYAM BARU", label: "Ayam Baru" },
        { value: "AYAM LAMA", label: "Ayam Lama" },
        { value: "AYAM PROSES", label: "Ayam Proses" },
      ],
      bhnPvMode,
      (val) => { bhnPvMode = val; renderBahanTable(); },
    );
    document.getElementById("bhnPvWrap").appendChild(pvSel.el);

    // Period selector
    const periodSel = DatePicker.createCustomSelect(
      [
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
        { value: "monthly", label: "Monthly" },
      ],
      bhnPeriod,
      (val) => {
        bhnPeriod = val;
        bhnSelectedItems = null;
        bhnSelectedFrom = null;
        bhnSelectedTo = null;
        renderBahanTable();
      },
    );
    document.getElementById("bhnPeriodWrap").appendChild(periodSel.el);
  }

  function renderBahanTable() {
    const titleEl = document.getElementById("bhnTitle");
    if (titleEl) {
      const titles = { daily: "Persebaran Bahan Harian", weekly: "Persebaran Bahan Mingguan", monthly: "Persebaran Bahan Bulanan" };
      titleEl.textContent = titles[bhnPeriod];
    }

    const dates = Engine.getAvailableDates();
    if (!dates.length) {
      document.getElementById("bhnTableWrap").innerHTML = `<p class="table-empty">Tidak ada data tersedia.</p>`;
      return;
    }

    let rows = [];
    const metricLabel = bhnMetric === "brd" ? "BRD" : "KG";

    if (bhnPeriod === "daily") {
      const range = bhnSelectedItems
        ? dates.filter(d => bhnSelectedItems.includes(d))
        : dates.slice(-7);
      const dist = Engine.getBahanDistribution(range, bhnPvMode, bhnMetric);
      range.forEach(d => {
        const parts = d.split("-");
        const row = { date: d, label: parts[2] + " " + MONTH_NAMES[parseInt(parts[1])] + " " + parts[0] };
        let total = 0;
        BAHAN_DEPTS.forEach(dept => {
          row[dept] = dist[d]?.[dept] || 0;
          total += row[dept];
        });
        row.total = total;
        rows.push(row);
      });
    } else if (bhnPeriod === "weekly") {
      const weekMap = getWeekMap(dates);
      const allKeys = Object.keys(weekMap);
      const weekKeys = bhnSelectedItems
        ? allKeys.filter(k => bhnSelectedItems.includes(k))
        : allKeys.slice(-7);
      weekKeys.forEach(wk => {
        const wDates = weekMap[wk];
        const dist = Engine.getBahanDistribution(wDates, bhnPvMode, bhnMetric);
        const row = { date: wDates[0], label: "Week " + wk.slice(1) + ", " + wDates[0].split("-")[0] };
        let total = 0;
        BAHAN_DEPTS.forEach(dept => {
          let sum = 0;
          wDates.forEach(d => { sum += dist[d]?.[dept] || 0; });
          row[dept] = sum;
          total += sum;
        });
        row.total = total;
        rows.push(row);
      });
    } else {
      const monthMap = getMonthMap(dates);
      const allKeys = Object.keys(monthMap);
      const mKeys = bhnSelectedItems
        ? allKeys.filter(k => bhnSelectedItems.includes(k))
        : allKeys.slice(-7);
      mKeys.forEach(ym => {
        const mDates = monthMap[ym];
        const dist = Engine.getBahanDistribution(mDates, bhnPvMode, bhnMetric);
        const row = { date: ym, label: KPI.formatMonthYear(ym) };
        let total = 0;
        BAHAN_DEPTS.forEach(dept => {
          let sum = 0;
          mDates.forEach(d => { sum += dist[d]?.[dept] || 0; });
          row[dept] = sum;
          total += sum;
        });
        row.total = total;
        rows.push(row);
      });
    }

    // Sort
    rows.sort((a, b) => {
      let va = a[bhnSortCol], vb = b[bhnSortCol];
      if (typeof va === "string") {
        const cmp = va.localeCompare(vb);
        return bhnSortDir === "asc" ? cmp : -cmp;
      }
      return bhnSortDir === "asc" ? va - vb : vb - va;
    });

    const latestDate = rows.length ? rows.reduce((max, r) => r.date > max ? r.date : max, rows[0].date) : null;

    const columns = [
      { key: "date", label: "Tanggal" },
      { key: "CUT UP", label: "Cut Up (" + metricLabel + ")" },
      { key: "BONELESS", label: "Boneless (" + metricLabel + ")" },
      { key: "AU", label: "AU (" + metricLabel + ")" },
      { key: "PARTING", label: "Part (" + metricLabel + ")" },
      { key: "total", label: "Total (" + metricLabel + ")" },
    ];

    const fmtVal = (v) => Math.round(v).toLocaleString("id-ID");

    const wrap = document.getElementById("bhnTableWrap");
    wrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            ${columns.map(c => `<th class="sortable ${bhnSortCol === c.key ? (bhnSortDir === 'asc' ? 'sort-asc' : 'sort-desc') : ''}" data-col="${c.key}">${c.label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.length ? rows.map(r => `
            <tr class="${r.date === latestDate ? 'row-latest' : ''}">
              <td>${r.label}</td>
              ${BAHAN_DEPTS.map(dept => `<td>${fmtVal(r[dept])}</td>`).join("")}
              <td><strong>${fmtVal(r.total)}</strong></td>
            </tr>
          `).join("") : `<tr><td colspan="6" class="table-empty">Tidak ada data untuk periode ini.</td></tr>`}
        </tbody>
      </table>
    `;

    wrap.classList.toggle("scrollable", rows.length > 7);

    // Sort click handlers
    wrap.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (bhnSortCol === col) {
          bhnSortDir = bhnSortDir === "asc" ? "desc" : "asc";
        } else {
          bhnSortCol = col;
          bhnSortDir = "asc";
        }
        renderBahanTable();
      });
    });

    // Range nav
    const navEl = document.getElementById("bhnRangeNav");
    if (navEl) {
      let rangeLabel;
      if (rows.length) {
        const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
        rangeLabel = fmtRangeLabel(sorted[0].date, sorted[sorted.length - 1].date, bhnPeriod);
      } else if (bhnSelectedFrom && bhnSelectedTo) {
        rangeLabel = fmtRangeLabel(bhnSelectedFrom, bhnSelectedTo, bhnPeriod);
      } else {
        rangeLabel = "Pilih tanggal";
      }
      navEl.innerHTML = `<button class="chart-range-btn" id="bhnRangeBtn">${rangeLabel}</button>`;
      document.getElementById("bhnRangeBtn").addEventListener("click", openBhnRangePicker);
    }
  }

  // ── Bahan Range Picker ──
  function openBhnRangePicker() {
    const dates = Engine.getAvailableDates();
    if (!dates.length) return;

    if (bhnPeriod === "daily") {
      openBhnDailyRangePicker(dates, 31);
    } else {
      openBhnGridRangePicker(dates);
    }
  }

  function closeBhnRangePicker() {
    if (_bhnRangeDocListener) {
      document.removeEventListener("click", _bhnRangeDocListener);
      _bhnRangeDocListener = null;
    }
    if (_bhnRangeScrollListener) {
      const sc = document.querySelector(".page-content");
      if (sc) sc.removeEventListener("scroll", _bhnRangeScrollListener);
      _bhnRangeScrollListener = null;
    }
    document.querySelectorAll(".bhn-range-picker-popup").forEach(el => el.remove());
  }

  function openBhnDailyRangePicker(dates, MAX) {
    const availSet = new Set(dates);
    const allMonths = [...new Set(dates.map(d => d.slice(0, 7)))];

    let fromDate = null, toDate = null;
    if (bhnSelectedFrom && bhnSelectedTo) {
      fromDate = bhnSelectedFrom;
      toDate = bhnSelectedTo;
    } else if (bhnSelectedItems && bhnSelectedItems.length) {
      fromDate = bhnSelectedItems[0];
      toDate = bhnSelectedItems[bhnSelectedItems.length - 1];
    } else {
      const range = dates.slice(-7);
      fromDate = range[0];
      toDate = range[range.length - 1];
    }

    let clickPhase = 0;
    let calMonth = (fromDate || dates[dates.length - 1]).slice(0, 7);

    closeBhnRangePicker();

    const popup = document.createElement("div");
    popup.className = "range-picker-popup range-picker-daily bhn-range-picker-popup";
    popup.addEventListener("click", e => e.stopPropagation());
    popup.addEventListener("wheel", e => {
      e.preventDefault();
      document.querySelector(".page-content")?.scrollBy({ top: e.deltaY });
    }, { passive: false });

    function fmtDate(d) {
      if (!d) return "—";
      const p = d.split("-");
      return p[2] + " " + MONTH_NAMES[parseInt(p[1])] + " " + p[0];
    }

    function renderAll() {
      const hint = clickPhase === 0 ? "Pilih tanggal mulai" : "Pilih tanggal akhir";
      popup.innerHTML = `
        <div class="range-picker-header">
          <span class="range-picker-title">${hint} <span class="range-picker-hint">(maks ${MAX} hari)</span></span>
          <button class="range-picker-close" id="bhnRpClose">×</button>
        </div>
        <div class="range-daily-summary">
          <div class="range-daily-summary-field ${clickPhase === 0 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Tanggal Mulai</div>
            <div class="range-daily-summary-val">${fmtDate(fromDate)}</div>
          </div>
          <div class="range-daily-summary-arrow">→</div>
          <div class="range-daily-summary-field ${clickPhase === 1 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Tanggal Akhir</div>
            <div class="range-daily-summary-val">${fmtDate(toDate)}</div>
          </div>
        </div>
        <div class="range-cal-panel" id="bhnRpCalPanel"></div>
        <div class="range-picker-footer">
          <button class="range-picker-reset" id="bhnRpReset">Reset</button>
          <button class="range-picker-apply" id="bhnRpApply" ${!fromDate || !toDate || clickPhase === 1 ? "disabled" : ""}>Terapkan</button>
        </div>
      `;

      popup.querySelector("#bhnRpClose").addEventListener("click", closeBhnRangePicker);
      popup.querySelector("#bhnRpReset").addEventListener("click", () => {
        bhnSelectedItems = null;
        bhnSelectedFrom = null;
        bhnSelectedTo = null;
        closeBhnRangePicker();
        renderBahanTable();
      });
      popup.querySelector("#bhnRpApply").addEventListener("click", () => {
        if (fromDate && toDate) {
          const f = fromDate <= toDate ? fromDate : toDate;
          const t = fromDate <= toDate ? toDate : fromDate;
          bhnSelectedFrom = f;
          bhnSelectedTo = t;
          bhnSelectedItems = dates.filter(d => d >= f && d <= t);
        } else {
          bhnSelectedItems = null;
          bhnSelectedFrom = null;
          bhnSelectedTo = null;
        }
        closeBhnRangePicker();
        renderBahanTable();
      });

      renderBhnCalPanel(popup.querySelector("#bhnRpCalPanel"));
    }

    function renderBhnCalPanel(panel) {
      const [yr, mo] = calMonth.split("-").map(Number);
      const minMonth = allMonths[0];
      const maxMonth = allMonths[allMonths.length - 1];
      const from = fromDate && toDate ? (fromDate <= toDate ? fromDate : toDate) : fromDate;
      const to = fromDate && toDate ? (fromDate <= toDate ? toDate : fromDate) : null;

      panel.innerHTML = `
        <div class="range-cal-nav">
          <button class="date-nav-btn" id="bhnRpCalPrev" ${calMonth <= minMonth ? "disabled" : ""}>&#8249;</button>
          <span class="date-nav-label" style="font-size:12px">${KPI.formatMonthYear(calMonth)}</span>
          <button class="date-nav-btn" id="bhnRpCalNext" ${calMonth >= maxMonth ? "disabled" : ""}>&#8250;</button>
        </div>
        <div class="range-cal-grid" id="bhnRpCalGrid"></div>
      `;

      panel.querySelector("#bhnRpCalPrev").addEventListener("click", () => {
        const [y, m] = calMonth.split("-").map(Number);
        const prev = new Date(y, m - 2, 1);
        calMonth = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0");
        renderBhnCalPanel(panel);
      });
      panel.querySelector("#bhnRpCalNext").addEventListener("click", () => {
        const [y, m] = calMonth.split("-").map(Number);
        const next = new Date(y, m, 1);
        calMonth = next.getFullYear() + "-" + String(next.getMonth() + 1).padStart(2, "0");
        renderBhnCalPanel(panel);
      });

      const grid = panel.querySelector("#bhnRpCalGrid");
      ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].forEach(d => {
        const el = document.createElement("div");
        el.className = "range-cal-dow";
        el.textContent = d;
        grid.appendChild(el);
      });

      const firstDay = new Date(yr, mo - 1, 1);
      let startDow = firstDay.getDay();
      startDow = startDow === 0 ? 6 : startDow - 1;
      for (let i = 0; i < startDow; i++) {
        grid.appendChild(Object.assign(document.createElement("div"), { className: "range-cal-cell" }));
      }

      const daysInMonth = new Date(yr, mo, 0).getDate();
      const today = new Date();
      const todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = calMonth + "-" + String(d).padStart(2, "0");
        const hasData = availSet.has(dateStr);
        const isFuture = dateStr > todayStr;
        const inRange = from && to && dateStr >= from && dateStr <= to;
        const isEndpoint = dateStr === fromDate || dateStr === toDate;

        let tooFar = false;
        if (!isFuture && clickPhase === 1 && fromDate) {
          const diff = Math.round((new Date(dateStr) - new Date(fromDate)) / 86400000);
          if (Math.abs(diff) >= MAX) tooFar = true;
        }

        const cell = document.createElement("div");
        cell.className = "range-cal-cell" +
          (!isFuture && !tooFar ? " available" : "") +
          (!hasData && !isFuture && !tooFar ? " no-data" : "") +
          (inRange ? " in-range" : "") +
          (isEndpoint ? " is-endpoint" : "") +
          (tooFar && !isFuture ? " too-far" : "");
        cell.innerHTML = `<span>${d}</span>`;

        if (!isFuture && !tooFar) {
          cell.addEventListener("click", () => {
            if (clickPhase === 0) {
              fromDate = dateStr;
              toDate = null;
              clickPhase = 1;
            } else {
              toDate = dateStr;
              if (toDate < fromDate) { const tmp = fromDate; fromDate = toDate; toDate = tmp; }
              clickPhase = 0;
            }
            renderAll();
          });
        }

        grid.appendChild(cell);
      }
    }

    renderAll();
    document.body.appendChild(popup);

    function positionPopup() {
      const btn = document.getElementById("bhnRangeBtn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      popup.style.top = rect.bottom + 6 + "px";
      popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 270 - 32)) + "px";
    }
    positionPopup();
    _bhnRangeScrollListener = positionPopup;
    const sc = document.querySelector(".page-content");
    if (sc) sc.addEventListener("scroll", _bhnRangeScrollListener);

    _bhnRangeDocListener = () => closeBhnRangePicker();
    setTimeout(() => document.addEventListener("click", _bhnRangeDocListener), 0);
  }

  function openBhnGridRangePicker(dates) {
    let items = [];
    if (bhnPeriod === "weekly") {
      const wm = getWeekMap(dates);
      items = Object.keys(wm).map(k => ({ key: k, label: k }));
    } else {
      const mm = getMonthMap(dates);
      items = Object.keys(mm).map(k => ({ key: k, label: KPI.formatMonthYear(k) }));
    }

    let pickStart = Math.max(0, items.length - 7);
    let pickEnd = items.length - 1;
    if (bhnSelectedItems && bhnSelectedItems.length) {
      const s = items.findIndex(i => i.key === bhnSelectedItems[0]);
      const e = items.findIndex(i => i.key === bhnSelectedItems[bhnSelectedItems.length - 1]);
      if (s !== -1 && e !== -1) { pickStart = s; pickEnd = e; }
    }

    let clickPhase = 0;
    closeBhnRangePicker();

    const popup = document.createElement("div");
    popup.className = "range-picker-popup bhn-range-picker-popup";
    popup.addEventListener("click", e => e.stopPropagation());
    popup.addEventListener("wheel", e => {
      e.preventDefault();
      document.querySelector(".page-content")?.scrollBy({ top: e.deltaY });
    }, { passive: false });

    function renderGrid() {
      const hint = clickPhase === 0 ? "Klik awal rentang" : "Klik akhir rentang";
      popup.innerHTML = `
        <div class="range-picker-header">
          <span class="range-picker-title">${hint}</span>
          <button class="range-picker-close" id="bhnRpClose">×</button>
        </div>
        <div class="range-picker-grid" id="bhnRpGrid"></div>
        <div class="range-picker-footer">
          <button class="range-picker-reset" id="bhnRpReset">Reset</button>
          <button class="range-picker-apply" id="bhnRpApply">Terapkan</button>
        </div>
      `;

      const grid = popup.querySelector("#bhnRpGrid");
      items.forEach((item, idx) => {
        const inRange = idx >= pickStart && idx <= pickEnd;
        const cell = document.createElement("div");
        cell.className = "range-picker-cell" +
          (inRange ? " in-range" : "") +
          (idx === pickStart ? " is-start" : "") +
          (idx === pickEnd ? " is-end" : "");
        cell.textContent = item.label;
        cell.addEventListener("click", () => {
          if (clickPhase === 0) {
            pickStart = idx;
            pickEnd = idx;
            clickPhase = 1;
          } else {
            let s = Math.min(pickStart, idx);
            let e = Math.max(pickStart, idx);
            pickStart = s;
            pickEnd = e;
            clickPhase = 0;
          }
          renderGrid();
        });
        grid.appendChild(cell);
      });

      popup.querySelector("#bhnRpClose").addEventListener("click", closeBhnRangePicker);
      popup.querySelector("#bhnRpReset").addEventListener("click", () => {
        bhnSelectedItems = null;
        bhnSelectedFrom = null;
        bhnSelectedTo = null;
        closeBhnRangePicker();
        renderBahanTable();
      });
      popup.querySelector("#bhnRpApply").addEventListener("click", () => {
        bhnSelectedItems = items.slice(pickStart, pickEnd + 1).map(i => i.key);
        bhnSelectedFrom = null;
        bhnSelectedTo = null;
        closeBhnRangePicker();
        renderBahanTable();
      });
    }

    renderGrid();
    document.body.appendChild(popup);

    function positionPopup() {
      const btn = document.getElementById("bhnRangeBtn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      popup.style.top = rect.bottom + 6 + "px";
      popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 300 - 32)) + "px";
    }
    positionPopup();
    _bhnRangeScrollListener = positionPopup;
    const sc = document.querySelector(".page-content");
    if (sc) sc.addEventListener("scroll", _bhnRangeScrollListener);

    _bhnRangeDocListener = () => closeBhnRangePicker();
    setTimeout(() => document.addEventListener("click", _bhnRangeDocListener), 0);
  }

  // ── Export Bahan ──
  function exportBahanTable() {
    const table = document.querySelector("#bhnTableWrap .data-table");
    if (!table) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, "Persebaran Bahan");
    XLSX.writeFile(wb, `Persebaran_Bahan_${bhnPeriod}_${bhnPvMode}_${bhnMetric}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ════════════════════════════════════════
  //  SEARCH MATERIAL TABLE
  // ════════════════════════════════════════

  function initSmtControls() {
    // Metric toggle
    document.querySelectorAll("#smtMetricToggle .toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#smtMetricToggle .toggle-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        smtMetric = btn.dataset.metric;
        renderSmtTable();
      });
    });

    // Period selector
    const periodSel = DatePicker.createCustomSelect(
      [
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
        { value: "monthly", label: "Monthly" },
      ],
      smtPeriod,
      (val) => {
        smtPeriod = val;
        smtSelectedItems = null;
        smtSelectedFrom = null;
        smtSelectedTo = null;
        renderSmtTable();
      },
    );
    document.getElementById("smtPeriodWrap").appendChild(periodSel.el);

    // Cascading filters
    const deptSel = DatePicker.createCustomSelect(
      [{ value: "All", label: "All Dept" }], "All",
      (val) => {
        smtFilters.dept = val;
        smtFilters.pv = "All";
        smtFilters.mvt = "All";
        updateSmtPctToggle();
        updateSmtFilterOptions();
        renderSmtTable();
      },
    );
    document.getElementById("smtDeptFilterWrap").appendChild(deptSel.el);

    const pvSel = DatePicker.createCustomSelect(
      [{ value: "All", label: "All PV" }], "All",
      (val) => {
        smtFilters.pv = val;
        smtFilters.mvt = "All";
        updateSmtPctToggle();
        updateSmtFilterOptions();
        renderSmtTable();
      },
    );
    document.getElementById("smtPvFilterWrap").appendChild(pvSel.el);

    const mvtSel = DatePicker.createCustomSelect(
      [{ value: "All", label: "All MVT" }], "All",
      (val) => {
        smtFilters.mvt = val;
        updateSmtPctToggle();
        renderSmtTable();
      },
    );
    document.getElementById("smtMvtFilterWrap").appendChild(mvtSel.el);

    window._smtDeptSel = deptSel;
    window._smtPvSel = pvSel;
    window._smtMvtSel = mvtSel;

    // Search input
    const input = document.getElementById("smtSearchInput");
    const acList = document.getElementById("smtAutocomplete");
    let _acResults = [];
    let _acQ = "";

    function renderAcList() {
      const selSet = new Set(smtSelectedMaterials.map(m => m.idx));
      const allChecked = _acResults.length > 0 && _acResults.every(r => selSet.has(r.idx));
      const someChecked = _acResults.some(r => selSet.has(r.idx));
      const re = new RegExp(`(${_acQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");

      acList.innerHTML = `
        <div class="search-ac-select-all">
          <div id="smtAcSelectAll" style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" class="search-ac-checkbox" id="smtAcSelectAllChk">
            <span>Select All</span>
          </div>
          <button class="search-ac-done-btn" id="smtAcDoneBtn">Selesai</button>
        </div>
        ${_acResults.map(r => {
          const checked = selSet.has(r.idx);
          const highlighted = r.matdesc.replace(re, "<mark>$1</mark>");
          return `<div class="search-ac-item" data-idx="${r.idx}">
            <input type="checkbox" class="search-ac-checkbox" ${checked ? "checked" : ""} readonly>
            <span class="search-ac-desc">${highlighted}</span>
            <span class="search-ac-code">${r.matcode}</span>
          </div>`;
        }).join("")}
      `;

      const selectAllChk = document.getElementById("smtAcSelectAllChk");
      selectAllChk.checked = allChecked;
      selectAllChk.indeterminate = !allChecked && someChecked;

      acList.querySelectorAll(".search-ac-item[data-idx]").forEach(item => {
        item.querySelector(".search-ac-checkbox").addEventListener("click", e => {
          e.stopPropagation();
          const idx = parseInt(item.dataset.idx);
          const r = _acResults.find(x => x.idx === idx);
          if (!r) return;
          const i = smtSelectedMaterials.findIndex(m => m.idx === idx);
          if (i >= 0) smtSelectedMaterials.splice(i, 1);
          else smtSelectedMaterials.push(r);
          renderAcList();
          updateSmtFilterOptions();
          renderSmtTable();
        });
        item.querySelector(".search-ac-desc").addEventListener("click", e => {
          e.stopPropagation();
          const idx = parseInt(item.dataset.idx);
          const r = _acResults.find(x => x.idx === idx);
          if (!r) return;
          smtSelectedMaterials.length = 0;
          smtSelectedMaterials.push(r);
          smtFilters = { dept: "All", pv: "All", mvt: "All" };
          acList.classList.remove("show");
          input.value = "";
          updateSmtPctToggle();
          updateSmtFilterOptions();
          renderSmtTable();
        });
      });

      document.getElementById("smtAcSelectAll").addEventListener("click", e => {
        e.stopPropagation();
        const set = new Set(smtSelectedMaterials.map(m => m.idx));
        const allChk = _acResults.every(r => set.has(r.idx));
        if (allChk) {
          _acResults.forEach(r => {
            const i = smtSelectedMaterials.findIndex(m => m.idx === r.idx);
            if (i >= 0) smtSelectedMaterials.splice(i, 1);
          });
        } else {
          _acResults.forEach(r => {
            if (!set.has(r.idx)) smtSelectedMaterials.push(r);
          });
        }
        renderAcList();
        updateSmtFilterOptions();
        renderSmtTable();
      });

      document.getElementById("smtAcDoneBtn").addEventListener("click", e => {
        e.stopPropagation();
        acList.classList.remove("show");
        input.value = "";
      });
    }

    input.addEventListener("input", () => {
      const q = input.value.trim();
      if (q.length < 2) { acList.classList.remove("show"); return; }
      const results = Engine.searchMaterial(q);
      if (!results.length) { acList.classList.remove("show"); return; }
      _acResults = results;
      _acQ = q;
      renderAcList();
      acList.classList.add("show");
    });

    document.addEventListener("click", e => {
      if (!e.target.closest("#smtSearchInput") && !e.target.closest("#smtAutocomplete")) {
        acList.classList.remove("show");
      }
    });
  }

  function updateSmtFilterOptions() {
    if (!smtSelectedMaterials.length) return;
    const indices = smtSelectedMaterials.map(m => m.idx);
    const dates = getSmtDates();
    const opts = Engine.getMaterialFilterOptionsRange(indices, dates, smtFilters);

    window._smtDeptSel?.updateOptions(
      [{ value: "All", label: "All Dept" }, ...opts.depts.map(d => ({ value: d, label: d }))],
      smtFilters.dept,
    );
    window._smtPvSel?.updateOptions(
      [{ value: "All", label: "All PV" }, ...opts.pvs.map(p => ({ value: p, label: p }))],
      smtFilters.pv,
    );
    window._smtMvtSel?.updateOptions(
      [{ value: "All", label: "All MVT" }, ...opts.mvts.map(m => ({ value: m, label: m }))],
      smtFilters.mvt,
    );
  }

  function getSmtDates() {
    const all = Engine.getAvailableDates();
    if (smtSelectedItems) return all.filter(d => smtSelectedItems.includes(d));
    if (smtSelectedFrom && smtSelectedTo) {
      const f = smtSelectedFrom <= smtSelectedTo ? smtSelectedFrom : smtSelectedTo;
      const t = smtSelectedFrom <= smtSelectedTo ? smtSelectedTo : smtSelectedFrom;
      return all.filter(d => d >= f && d <= t);
    }
    return all.slice(-7);
  }

  function getSmtPeriodColumns() {
    const dates = getSmtDates();
    if (!dates.length) return [];

    if (smtPeriod === "daily") {
      return dates.map(d => {
        const p = d.split("-");
        return { key: d, label: p[2] + " " + MONTH_NAMES[parseInt(p[1])], dates: [d] };
      });
    } else if (smtPeriod === "weekly") {
      const weekMap = getWeekMap(dates);
      return Object.keys(weekMap).map(wk => ({
        key: wk,
        label: "W" + wk.slice(1) + ", " + weekMap[wk][0].split("-")[0],
        dates: weekMap[wk],
      }));
    } else {
      const monthMap = getMonthMap(dates);
      return Object.keys(monthMap).map(ym => ({
        key: ym,
        label: KPI.formatMonthYear(ym),
        dates: monthMap[ym],
      }));
    }
  }

  function updateSmtPctToggle() {
    const pctBtn = document.getElementById("smtPctBtn");
    if (!pctBtn) return;
    if (smtFilters.mvt === "HASIL") {
      pctBtn.style.display = "";
    } else {
      pctBtn.style.display = "none";
      if (smtMetric === "pct") {
        smtMetric = "brd";
        document.querySelectorAll("#smtMetricToggle .toggle-btn").forEach(b => {
          b.classList.toggle("active", b.dataset.metric === "brd");
        });
      }
    }
  }

  function calcBahanKgForPeriod(periodDates, filters) {
    const dateSet = new Set(periodDates);
    const lookups = Engine.getLookups();
    let bahanKg = 0;
    Engine.getRawDB().forEach(r => {
      if (!dateSet.has(r[8]) || lookups.mvt[r[5]] !== "BAHAN") return;
      const dept = lookups.dept[r[0]];
      const pv = lookups.pv[r[1]];
      const sloc = lookups.sloc[r[9]];
      if (filters.dept !== "All" && dept !== filters.dept) return;
      const pvFilter = filters.pv;
      let match = false;
      if (pvFilter === "AYAM BARU" || pvFilter === "All") {
        if (pv === "AYAM BARU" && sloc === "STAGING RM") match = true;
      }
      if (pvFilter === "AYAM LAMA" || pvFilter === "All") {
        if (pv === "AYAM LAMA" && (sloc === "CRP" || sloc === "REPRO")) match = true;
      }
      if (pvFilter === "AYAM PROSES" || pvFilter === "All") {
        if (pv === "AYAM PROSES") match = true;
      }
      if (!match) return;
      bahanKg += r[7];
    });
    return bahanKg;
  }

  function calcPerMaterialPerPeriod(matIdx, periodDates, filters, metric) {
    const dateSet = new Set(periodDates);
    const lookups = Engine.getLookups();
    let total = 0;

    Engine.getRawDB().forEach(r => {
      if (!dateSet.has(r[8]) || r[4] !== matIdx) return;
      const dept = lookups.dept[r[0]];
      const pv = lookups.pv[r[1]];
      const mvt = lookups.mvt[r[5]];
      if (filters.dept !== "All" && dept !== filters.dept) return;
      if (filters.pv !== "All" && pv !== filters.pv) return;
      if (filters.mvt !== "All" && mvt !== filters.mvt) return;
      total += metric === "brd" ? r[6] : r[7];
    });
    return total;
  }

  function renderSmtTable() {
    const tagsEl = document.getElementById("smtTags");
    const wrap = document.getElementById("smtTableWrap");

    // Render material tags
    if (!smtSelectedMaterials.length) {
      tagsEl.innerHTML = '<span class="material-tags-placeholder">Pilih material untuk ditampilkan</span>';
      wrap.innerHTML = `<p class="table-empty">Pilih material terlebih dahulu.</p>`;
      renderSmtRangeNav();
      return;
    }

    const dates = getSmtDates();

    // Render tags with dimming
    const hasDimmed = smtSelectedMaterials.some(m => !Engine.materialMatchesFilterRange(m.idx, smtFilters, dates));
    tagsEl.innerHTML =
      smtSelectedMaterials.map((m, i) => {
        const matches = Engine.materialMatchesFilterRange(m.idx, smtFilters, dates);
        return `<span class="material-tag ${matches ? "" : "dimmed"}" data-i="${i}">
          ${m.matdesc}
          <span class="material-tag-remove" data-i="${i}">×</span>
        </span>`;
      }).join("") +
      (hasDimmed ? `<button class="material-tags-clear-dimmed" id="smtClearDimmed">Clear Unmatched</button>` : "") +
      `<button class="material-tags-clear-all" id="smtClearAll">Clear All</button>`;

    tagsEl.querySelectorAll(".material-tag-remove").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        smtSelectedMaterials.splice(parseInt(btn.dataset.i), 1);
        if (smtSelectedMaterials.length) {
          const indices = smtSelectedMaterials.map(m => m.idx);
          const d = getSmtDates();
          const opts = Engine.getMaterialFilterOptionsRange(indices, d, { dept: "All", pv: "All", mvt: "All" });
          if (smtFilters.dept !== "All" && !opts.depts.includes(smtFilters.dept)) {
            smtFilters.dept = "All";
            smtFilters.pv = "All";
            smtFilters.mvt = "All";
          } else {
            const opts2 = Engine.getMaterialFilterOptionsRange(indices, d, smtFilters);
            if (smtFilters.pv !== "All" && !opts2.pvs.includes(smtFilters.pv)) {
              smtFilters.pv = "All";
              smtFilters.mvt = "All";
            } else if (smtFilters.mvt !== "All" && !opts2.mvts.includes(smtFilters.mvt)) {
              smtFilters.mvt = "All";
            }
          }
        } else {
          smtFilters = { dept: "All", pv: "All", mvt: "All" };
        }
        updateSmtPctToggle();
        updateSmtFilterOptions();
        renderSmtTable();
      });
    });

    const clearDimmedBtn = document.getElementById("smtClearDimmed");
    if (clearDimmedBtn) {
      clearDimmedBtn.addEventListener("click", e => {
        e.stopPropagation();
        const d = getSmtDates();
        for (let i = smtSelectedMaterials.length - 1; i >= 0; i--) {
          if (!Engine.materialMatchesFilterRange(smtSelectedMaterials[i].idx, smtFilters, d)) {
            smtSelectedMaterials.splice(i, 1);
          }
        }
        updateSmtFilterOptions();
        renderSmtTable();
      });
    }

    document.getElementById("smtClearAll").addEventListener("click", e => {
      e.stopPropagation();
      smtSelectedMaterials.length = 0;
      smtFilters = { dept: "All", pv: "All", mvt: "All" };
      updateSmtPctToggle();
      renderSmtTable();
    });

    // Build columns
    const columns = getSmtPeriodColumns();
    if (!columns.length) {
      wrap.innerHTML = `<p class="table-empty">Tidak ada data untuk periode ini.</p>`;
      renderSmtRangeNav();
      return;
    }

    // Build rows: one per material
    const isPct = smtMetric === "pct";
    const metricLabel = isPct ? "%" : (smtMetric === "brd" ? "BRD" : "KG");

    let bahanPerCol = {};
    if (isPct) {
      columns.forEach(col => {
        bahanPerCol[col.key] = calcBahanKgForPeriod(col.dates, smtFilters);
      });
    }

    const rows = smtSelectedMaterials.map(m => {
      const row = { matdesc: m.matdesc, values: {}, total: 0 };
      let totalKg = 0, totalBahan = 0;
      columns.forEach(col => {
        if (isPct) {
          const kg = calcPerMaterialPerPeriod(m.idx, col.dates, smtFilters, "kg");
          const bahan = bahanPerCol[col.key];
          row.values[col.key] = bahan ? Math.round(kg / bahan * 10000) / 100 : 0;
          totalKg += kg;
          totalBahan += bahan;
        } else {
          const val = calcPerMaterialPerPeriod(m.idx, col.dates, smtFilters, smtMetric);
          row.values[col.key] = val;
          row.total += val;
        }
      });
      if (isPct) {
        row.total = totalBahan ? Math.round(totalKg / totalBahan * 10000) / 100 : 0;
      }
      return row;
    });

    // Column totals
    const colTotals = {};
    let grandTotal = 0;
    if (isPct) {
      let allKg = 0, allBahan = 0;
      columns.forEach(col => {
        const bahan = bahanPerCol[col.key];
        let colKg = 0;
        smtSelectedMaterials.forEach(m => {
          colKg += calcPerMaterialPerPeriod(m.idx, col.dates, smtFilters, "kg");
        });
        colTotals[col.key] = bahan ? Math.round(colKg / bahan * 10000) / 100 : 0;
        allKg += colKg;
        allBahan += bahan;
      });
      grandTotal = allBahan ? Math.round(allKg / allBahan * 10000) / 100 : 0;
    } else {
      columns.forEach(col => {
        colTotals[col.key] = rows.reduce((s, r) => s + r.values[col.key], 0);
        grandTotal += colTotals[col.key];
      });
    }

    const fmtVal = isPct
      ? v => v.toFixed(2)
      : v => Math.round(v).toLocaleString("id-ID");

    wrap.innerHTML = `
      <table class="data-table smt-table">
        <thead>
          <tr>
            <th>Material</th>
            ${columns.map(c => `<th>${c.label}</th>`).join("")}
            <th>${isPct ? "Avg" : "Total"}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td class="smt-mat-cell" title="${r.matdesc}">${r.matdesc}</td>
              ${columns.map(c => `<td>${fmtVal(r.values[c.key])}</td>`).join("")}
              <td><strong>${fmtVal(r.total)}</strong></td>
            </tr>
          `).join("")}
          <tr class="smt-total-row">
            <td><strong>Total</strong></td>
            ${columns.map(c => `<td><strong>${fmtVal(colTotals[c.key])}</strong></td>`).join("")}
            <td><strong>${fmtVal(grandTotal)}</strong></td>
          </tr>
        </tbody>
      </table>
    `;

    wrap.classList.toggle("scrollable", rows.length > 7);
    renderSmtRangeNav();
  }

  function renderSmtRangeNav() {
    const navEl = document.getElementById("smtRangeNav");
    if (!navEl) return;

    const columns = getSmtPeriodColumns();
    let rangeLabel;
    if (columns.length) {
      const first = columns[0], last = columns[columns.length - 1];
      const dateA = smtPeriod === "daily" ? first.key : (smtPeriod === "monthly" ? first.key : first.dates[0]);
      const dateB = smtPeriod === "daily" ? last.key : (smtPeriod === "monthly" ? last.key : last.dates[0]);
      rangeLabel = fmtRangeLabel(dateA, dateB, smtPeriod);
    } else if (smtSelectedFrom && smtSelectedTo) {
      rangeLabel = fmtRangeLabel(smtSelectedFrom, smtSelectedTo, smtPeriod);
    } else {
      rangeLabel = "Pilih tanggal";
    }
    navEl.innerHTML = `<button class="chart-range-btn" id="smtRangeBtn">${rangeLabel}</button>`;
    document.getElementById("smtRangeBtn").addEventListener("click", openSmtRangePicker);
  }

  // ── SMT Range Picker ──
  function openSmtRangePicker() {
    const dates = Engine.getAvailableDates();
    if (!dates.length) return;

    if (smtPeriod === "daily") {
      openSmtDailyRangePicker(dates, 31);
    } else {
      openSmtGridRangePicker(dates);
    }
  }

  function closeSmtRangePicker() {
    if (_smtRangeDocListener) {
      document.removeEventListener("click", _smtRangeDocListener);
      _smtRangeDocListener = null;
    }
    if (_smtRangeScrollListener) {
      const sc = document.querySelector(".page-content");
      if (sc) sc.removeEventListener("scroll", _smtRangeScrollListener);
      _smtRangeScrollListener = null;
    }
    document.querySelectorAll(".smt-range-picker-popup").forEach(el => el.remove());
  }

  function openSmtDailyRangePicker(dates, MAX) {
    const availSet = new Set(dates);
    const allMonths = [...new Set(dates.map(d => d.slice(0, 7)))];

    let fromDate = null, toDate = null;
    if (smtSelectedFrom && smtSelectedTo) {
      fromDate = smtSelectedFrom;
      toDate = smtSelectedTo;
    } else if (smtSelectedItems && smtSelectedItems.length) {
      fromDate = smtSelectedItems[0];
      toDate = smtSelectedItems[smtSelectedItems.length - 1];
    } else {
      const range = dates.slice(-7);
      fromDate = range[0];
      toDate = range[range.length - 1];
    }

    let clickPhase = 0;
    let calMonth = (fromDate || dates[dates.length - 1]).slice(0, 7);

    closeSmtRangePicker();

    const popup = document.createElement("div");
    popup.className = "range-picker-popup range-picker-daily smt-range-picker-popup";
    popup.addEventListener("click", e => e.stopPropagation());
    popup.addEventListener("wheel", e => {
      e.preventDefault();
      document.querySelector(".page-content")?.scrollBy({ top: e.deltaY });
    }, { passive: false });

    function fmtDate(d) {
      if (!d) return "—";
      const p = d.split("-");
      return p[2] + " " + MONTH_NAMES[parseInt(p[1])] + " " + p[0];
    }

    function renderAll() {
      const hint = clickPhase === 0 ? "Pilih tanggal mulai" : "Pilih tanggal akhir";
      popup.innerHTML = `
        <div class="range-picker-header">
          <span class="range-picker-title">${hint} <span class="range-picker-hint">(maks ${MAX} hari)</span></span>
          <button class="range-picker-close" id="smtRpClose">×</button>
        </div>
        <div class="range-daily-summary">
          <div class="range-daily-summary-field ${clickPhase === 0 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Tanggal Mulai</div>
            <div class="range-daily-summary-val">${fmtDate(fromDate)}</div>
          </div>
          <div class="range-daily-summary-arrow">→</div>
          <div class="range-daily-summary-field ${clickPhase === 1 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Tanggal Akhir</div>
            <div class="range-daily-summary-val">${fmtDate(toDate)}</div>
          </div>
        </div>
        <div class="range-cal-panel" id="smtRpCalPanel"></div>
        <div class="range-picker-footer">
          <button class="range-picker-reset" id="smtRpReset">Reset</button>
          <button class="range-picker-apply" id="smtRpApply" ${!fromDate || !toDate || clickPhase === 1 ? "disabled" : ""}>Terapkan</button>
        </div>
      `;

      popup.querySelector("#smtRpClose").addEventListener("click", closeSmtRangePicker);
      popup.querySelector("#smtRpReset").addEventListener("click", () => {
        smtSelectedItems = null;
        smtSelectedFrom = null;
        smtSelectedTo = null;
        closeSmtRangePicker();
        renderSmtTable();
      });
      popup.querySelector("#smtRpApply").addEventListener("click", () => {
        if (fromDate && toDate) {
          const f = fromDate <= toDate ? fromDate : toDate;
          const t = fromDate <= toDate ? toDate : fromDate;
          smtSelectedFrom = f;
          smtSelectedTo = t;
          smtSelectedItems = dates.filter(d => d >= f && d <= t);
        } else {
          smtSelectedItems = null;
          smtSelectedFrom = null;
          smtSelectedTo = null;
        }
        closeSmtRangePicker();
        renderSmtTable();
      });

      renderSmtCalPanel(popup.querySelector("#smtRpCalPanel"));
    }

    function renderSmtCalPanel(panel) {
      const [yr, mo] = calMonth.split("-").map(Number);
      const minMonth = allMonths[0];
      const maxMonth = allMonths[allMonths.length - 1];
      const from = fromDate && toDate ? (fromDate <= toDate ? fromDate : toDate) : fromDate;
      const to = fromDate && toDate ? (fromDate <= toDate ? toDate : fromDate) : null;

      panel.innerHTML = `
        <div class="range-cal-nav">
          <button class="date-nav-btn" id="smtRpCalPrev" ${calMonth <= minMonth ? "disabled" : ""}>&#8249;</button>
          <span class="date-nav-label" style="font-size:12px">${KPI.formatMonthYear(calMonth)}</span>
          <button class="date-nav-btn" id="smtRpCalNext" ${calMonth >= maxMonth ? "disabled" : ""}>&#8250;</button>
        </div>
        <div class="range-cal-grid" id="smtRpCalGrid"></div>
      `;

      panel.querySelector("#smtRpCalPrev").addEventListener("click", () => {
        const [y, m] = calMonth.split("-").map(Number);
        const prev = new Date(y, m - 2, 1);
        calMonth = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0");
        renderSmtCalPanel(panel);
      });
      panel.querySelector("#smtRpCalNext").addEventListener("click", () => {
        const [y, m] = calMonth.split("-").map(Number);
        const next = new Date(y, m, 1);
        calMonth = next.getFullYear() + "-" + String(next.getMonth() + 1).padStart(2, "0");
        renderSmtCalPanel(panel);
      });

      const grid = panel.querySelector("#smtRpCalGrid");
      ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].forEach(d => {
        const el = document.createElement("div");
        el.className = "range-cal-dow";
        el.textContent = d;
        grid.appendChild(el);
      });

      const firstDay = new Date(yr, mo - 1, 1);
      let startDow = firstDay.getDay();
      startDow = startDow === 0 ? 6 : startDow - 1;
      for (let i = 0; i < startDow; i++) {
        grid.appendChild(Object.assign(document.createElement("div"), { className: "range-cal-cell" }));
      }

      const daysInMonth = new Date(yr, mo, 0).getDate();
      const today = new Date();
      const todayStr = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = calMonth + "-" + String(d).padStart(2, "0");
        const hasData = availSet.has(dateStr);
        const isFuture = dateStr > todayStr;
        const inRange = from && to && dateStr >= from && dateStr <= to;
        const isEndpoint = dateStr === fromDate || dateStr === toDate;

        let tooFar = false;
        if (!isFuture && clickPhase === 1 && fromDate) {
          const diff = Math.round((new Date(dateStr) - new Date(fromDate)) / 86400000);
          if (Math.abs(diff) >= MAX) tooFar = true;
        }

        const cell = document.createElement("div");
        cell.className = "range-cal-cell" +
          (!isFuture && !tooFar ? " available" : "") +
          (!hasData && !isFuture && !tooFar ? " no-data" : "") +
          (inRange ? " in-range" : "") +
          (isEndpoint ? " is-endpoint" : "") +
          (tooFar && !isFuture ? " too-far" : "");
        cell.innerHTML = `<span>${d}</span>`;

        if (!isFuture && !tooFar) {
          cell.addEventListener("click", () => {
            if (clickPhase === 0) {
              fromDate = dateStr;
              toDate = null;
              clickPhase = 1;
            } else {
              toDate = dateStr;
              if (toDate < fromDate) { const tmp = fromDate; fromDate = toDate; toDate = tmp; }
              clickPhase = 0;
            }
            renderAll();
          });
        }

        grid.appendChild(cell);
      }
    }

    renderAll();
    document.body.appendChild(popup);

    function positionPopup() {
      const btn = document.getElementById("smtRangeBtn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      popup.style.top = rect.bottom + 6 + "px";
      popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 270 - 32)) + "px";
    }
    positionPopup();
    _smtRangeScrollListener = positionPopup;
    const sc = document.querySelector(".page-content");
    if (sc) sc.addEventListener("scroll", _smtRangeScrollListener);

    _smtRangeDocListener = () => closeSmtRangePicker();
    setTimeout(() => document.addEventListener("click", _smtRangeDocListener), 0);
  }

  function openSmtGridRangePicker(dates) {
    let items = [];
    if (smtPeriod === "weekly") {
      const wm = getWeekMap(dates);
      items = Object.keys(wm).map(k => ({ key: k, label: k }));
    } else {
      const mm = getMonthMap(dates);
      items = Object.keys(mm).map(k => ({ key: k, label: KPI.formatMonthYear(k) }));
    }

    let pickStart = Math.max(0, items.length - 7);
    let pickEnd = items.length - 1;
    if (smtSelectedItems && smtSelectedItems.length) {
      const s = items.findIndex(i => i.key === smtSelectedItems[0]);
      const e = items.findIndex(i => i.key === smtSelectedItems[smtSelectedItems.length - 1]);
      if (s !== -1 && e !== -1) { pickStart = s; pickEnd = e; }
    }

    let clickPhase = 0;
    closeSmtRangePicker();

    const popup = document.createElement("div");
    popup.className = "range-picker-popup smt-range-picker-popup";
    popup.addEventListener("click", e => e.stopPropagation());
    popup.addEventListener("wheel", e => {
      e.preventDefault();
      document.querySelector(".page-content")?.scrollBy({ top: e.deltaY });
    }, { passive: false });

    function renderGrid() {
      const hint = clickPhase === 0 ? "Klik awal rentang" : "Klik akhir rentang";
      popup.innerHTML = `
        <div class="range-picker-header">
          <span class="range-picker-title">${hint}</span>
          <button class="range-picker-close" id="smtRpClose">×</button>
        </div>
        <div class="range-picker-grid" id="smtRpGrid"></div>
        <div class="range-picker-footer">
          <button class="range-picker-reset" id="smtRpReset">Reset</button>
          <button class="range-picker-apply" id="smtRpApply">Terapkan</button>
        </div>
      `;

      const grid = popup.querySelector("#smtRpGrid");
      items.forEach((item, idx) => {
        const inRange = idx >= pickStart && idx <= pickEnd;
        const cell = document.createElement("div");
        cell.className = "range-picker-cell" +
          (inRange ? " in-range" : "") +
          (idx === pickStart ? " is-start" : "") +
          (idx === pickEnd ? " is-end" : "");
        cell.textContent = item.label;
        cell.addEventListener("click", () => {
          if (clickPhase === 0) {
            pickStart = idx;
            pickEnd = idx;
            clickPhase = 1;
          } else {
            let s = Math.min(pickStart, idx);
            let e = Math.max(pickStart, idx);
            pickStart = s;
            pickEnd = e;
            clickPhase = 0;
          }
          renderGrid();
        });
        grid.appendChild(cell);
      });

      popup.querySelector("#smtRpClose").addEventListener("click", closeSmtRangePicker);
      popup.querySelector("#smtRpReset").addEventListener("click", () => {
        smtSelectedItems = null;
        smtSelectedFrom = null;
        smtSelectedTo = null;
        closeSmtRangePicker();
        renderSmtTable();
      });
      popup.querySelector("#smtRpApply").addEventListener("click", () => {
        smtSelectedItems = items.slice(pickStart, pickEnd + 1).map(i => i.key);
        smtSelectedFrom = null;
        smtSelectedTo = null;
        closeSmtRangePicker();
        renderSmtTable();
      });
    }

    renderGrid();
    document.body.appendChild(popup);

    function positionPopup() {
      const btn = document.getElementById("smtRangeBtn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      popup.style.top = rect.bottom + 6 + "px";
      popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 300 - 32)) + "px";
    }
    positionPopup();
    _smtRangeScrollListener = positionPopup;
    const sc = document.querySelector(".page-content");
    if (sc) sc.addEventListener("scroll", _smtRangeScrollListener);

    _smtRangeDocListener = () => closeSmtRangePicker();
    setTimeout(() => document.addEventListener("click", _smtRangeDocListener), 0);
  }

  // ── Export Search Material ──
  function exportSmtTable() {
    const table = document.querySelector("#smtTableWrap .data-table");
    if (!table) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, "Search Material");
    XLSX.writeFile(wb, `Search_Material_${smtMetric}_${smtPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return { render };
})();
