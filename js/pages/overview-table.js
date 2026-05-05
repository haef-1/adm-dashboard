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

  const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  function render(container) {
    selectedItems = null;
    selectedFrom = null;
    selectedTo = null;
    sortCol = "date";
    sortDir = "desc";

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
    `;

    initPeriodSelector();
    renderKpiTable();

    document.getElementById("tblExport").addEventListener("click", exportTable);
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
          label: parts[2] + " " + MONTH_NAMES[parseInt(parts[1])],
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
          label: "Week " + wk.slice(1),
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
        rangeLabel = `${rows[0].label} – ${rows[rows.length - 1].label}`;
      } else if (selectedFrom && selectedTo) {
        rangeLabel = `${selectedFrom} – ${selectedTo} (kosong)`;
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
            <div class="range-daily-summary-label">Dari</div>
            <div class="range-daily-summary-val">${fmtDate(fromDate)}</div>
          </div>
          <div class="range-daily-summary-arrow">→</div>
          <div class="range-daily-summary-field ${clickPhase === 1 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Sampai</div>
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

  // ── Export ──
  function exportTable() {
    const table = document.querySelector("#kpiTableWrap .data-table");
    if (!table) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    XLSX.utils.book_append_sheet(wb, ws, "KPI");
    XLSX.writeFile(wb, `KPI_Overview_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return { render };
})();
