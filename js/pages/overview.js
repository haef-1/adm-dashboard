/* ═══════════════════════════════════════
   OVERVIEW.JS — Overview Page Renderer
   ═══════════════════════════════════════ */

const OverviewPage = (() => {
  let selectedDate = null;
  let calMonth = null;
  let chartMetric = "brd";
  let chartPvMode = "AYAM BARU";
  let chartPeriod = "daily";
  let chartDateRange = [];
  let chartSelectedItems = null;
  let _rangeDocListener = null;
  let _rangeScrollListener = null;
  let _srDocListener = null;
  let _srScrollListener = null;
  let searchFromDate = null;
  let searchToDate = null;
  let selectedMaterials = []; // [{idx, matdesc, matcode}]
  let searchFilters = { dept: "All", pv: "All", mvt: "All" };

  // ── Main render ──
  function render(container) {
    selectedDate = Engine.getLastDate();
    calMonth = selectedDate ? selectedDate.slice(0, 7) : null;
    searchFromDate = selectedDate;
    searchToDate = selectedDate;

    container.innerHTML = `
      <div class="page-title">Overview</div>

      <!-- SECTION 1: KPI -->
      <div class="section" id="sectionKpi">
        <div class="section-header">
          <span></span>
          <div id="kpiDateNav"></div>
        </div>
        <div class="kpi-row" id="kpiRow">
          <!-- KPI cards rendered here -->
        </div>
      </div>

      <!-- SECTION 2: Calendar + Chart -->
      <div class="section" id="sectionCalChart">
        <div class="section-split">
          <!-- Left: Calendar -->
          <div class="split-panel" id="calPanel">
            <div class="split-panel-header">
              <div class="split-panel-title">Truk Kalender</div>
            </div>
            <div id="calContainer"></div>
          </div>
          <!-- Right: Bahan Chart -->
          <div class="split-panel" id="chartPanel">
            <div class="split-panel-header">
              <div class="split-panel-title" style="display:none">Bahan Karkas</div>
            </div>
            <div id="chartControls"></div>
            <div class="chart-area">
              <span class="chart-title-vertical">bahan macing2 departemen</span>
              <div class="chart-wrap" id="chartWrap" style="height:280px;position:relative;">
                <canvas id="bahanChart"></canvas>
              </div>
            </div>
            <div class="chart-legend" id="chartLegend"></div>
          </div>
        </div>
      </div>

      <!-- SECTION 3: Search Material -->
      <div class="section" id="sectionSearch">
        <div class="split-panel" id="searchPanel">
          <div class="split-panel-header">
            <div class="split-panel-title">Search Material</div>
            <div id="searchDateNav"></div>
          </div>
          <div id="searchContainer"></div>
        </div>
      </div>
    `;

    initKpiSection();
    initCalendar();
    initBahanChart();
    initSearchMaterial();
    renderAll();
  }

  // ══════════════════════════════════════
  // SECTION 1: KPI
  // ══════════════════════════════════════
  function initKpiSection() {
    const navContainer = document.getElementById("kpiDateNav");
    const nav = DatePicker.createDateNav({
      initialDate: selectedDate,
      onPrev: () => {
        const prev = KPI.getPrevDate(selectedDate);
        if (prev) {
          selectedDate = prev;
          renderKpi();
          renderCalendar();
        }
      },
      onNext: () => {
        const next = KPI.getNextDate(selectedDate);
        if (next) {
          selectedDate = next;
          renderKpi();
          renderCalendar();
        }
      },
    });
    navContainer.appendChild(nav.el);
    window._kpiNav = nav;
  }

  function renderKpi() {
    if (!selectedDate) return;

    const nav = window._kpiNav;
    nav.setLabel(KPI.formatDate(selectedDate));
    nav.setPrevEnabled(!!KPI.getPrevDate(selectedDate));
    nav.setNextEnabled(!!KPI.getNextDate(selectedDate));

    const kpi = Engine.getKpiForDate(selectedDate);
    const truck = Engine.getTruckForDate(selectedDate);
    const prevTruck = Engine.getTruckDelta(selectedDate);
    const susut = Engine.getSusutLBForDate(selectedDate);

    // Get previous date susut for delta
    const prevDate = KPI.getPrevDate(selectedDate);
    const prevSusut = prevDate ? Engine.getSusutLBForDate(prevDate) : null;

    const truckDelta = KPI.formatDeltaInt(truck.total, prevTruck);

    const row = document.getElementById("kpiRow");
    if (!row) return;

    row.innerHTML = `
      <!-- Truk -->
      <div class="kpi-card kpi-card--truck" style="flex:1.4">
        <div class="kpi-card-label">Truk hari ini</div>
        <div class="kpi-card-truck">
          <div class="truck-value-col">
            <span class="kpi-card-value">${truck.total}</span>
            <span class="kpi-card-delta ${truckDelta.cls}">${truckDelta.text}</span>
          </div>
          <div class="truck-breakdown">
            <div><strong>Small</strong> × ${truck.small}</div>
            <div><strong>Medium</strong> × ${truck.medium}</div>
            <div><strong>Large</strong> × ${truck.large}</div>
          </div>
        </div>
      </div>

      <!-- Yield Karkas -->
      <div class="kpi-card">
        <div class="kpi-card-label">Yield Karkas</div>
        <div class="kpi-card-body">
          <span class="kpi-card-value">${kpi ? kpi.yk.toFixed(2) : "--"}<span class="unit">%</span></span>
          ${kpi ? `<span class="kpi-card-delta ${KPI.formatDelta(kpi.yk, kpi.prev_yk, false).cls}">${KPI.formatDelta(kpi.yk, kpi.prev_yk, false).text}</span>` : ""}
        </div>
      </div>

      <!-- Yield By Product -->
      <div class="kpi-card">
        <div class="kpi-card-label">Yield By Product</div>
        <div class="kpi-card-body">
          <span class="kpi-card-value">${kpi ? kpi.yb.toFixed(2) : "--"}<span class="unit">%</span></span>
          ${kpi ? `<span class="kpi-card-delta ${KPI.formatDelta(kpi.yb, kpi.prev_yb, false).cls}">${KPI.formatDelta(kpi.yb, kpi.prev_yb, false).text}</span>` : ""}
        </div>
      </div>

      <!-- Waste -->
      <div class="kpi-card">
        <div class="kpi-card-label">Waste</div>
        <div class="kpi-card-body">
          <span class="kpi-card-value">${kpi ? kpi.w.toFixed(2) : "--"}<span class="unit">%</span></span>
          ${kpi ? `<span class="kpi-card-delta ${KPI.formatDelta(kpi.w, kpi.prev_w, true).cls}">${KPI.formatDelta(kpi.w, kpi.prev_w, true).text}</span>` : ""}
        </div>
      </div>

      <!-- Susut LB -->
      <div class="kpi-card">
        <div class="kpi-card-label">Susut LB</div>
        <div class="kpi-card-body">
          <span class="kpi-card-value">${susut !== null ? susut.toFixed(2) : "--"}<span class="unit">%</span></span>
          ${susut !== null ? `<span class="kpi-card-delta ${KPI.formatDelta(susut, prevSusut, true).cls}">${KPI.formatDelta(susut, prevSusut, true).text}</span>` : ""}
        </div>
      </div>
    `;
  }

  // ══════════════════════════════════════
  // SECTION 2 LEFT: Calendar
  // ══════════════════════════════════════
  function initCalendar() {
    // Calendar has its own month navigator
  }

  function renderCalendar() {
    const container = document.getElementById("calContainer");
    if (!container || !calMonth) return;

    const calData = Engine.getTruckCalendar(calMonth);
    const months = Engine.getAvailableMonths();
    const monthIdx = months.indexOf(calMonth);

    const values = Object.values(calData.days);
    const minVal = values.length ? Math.min(...values) : 0;
    const maxVal = values.length ? Math.max(...values) : 1;

    // Build header
    const [yr, mo] = calMonth.split("-").map(Number);

    container.innerHTML = `
      <div class="cal-header">
        <div class="cal-total">
          <span class="cal-total-label">Total</span>
          <span class="cal-total-value">${calData.total}</span>
        </div>
        <div class="date-nav" id="calMonthNav">
          <button class="date-nav-btn" id="calPrev" ${monthIdx <= 0 ? "disabled" : ""}>‹</button>
          <span class="date-nav-label">${KPI.formatMonthYear(calMonth)}</span>
          <button class="date-nav-btn" id="calNext" ${monthIdx >= months.length - 1 ? "disabled" : ""}>›</button>
        </div>
      </div>
      <div class="cal-grid" id="calGrid"></div>
    `;

    // Nav events
    document.getElementById("calPrev")?.addEventListener("click", () => {
      if (monthIdx > 0) {
        calMonth = months[monthIdx - 1];
        renderCalendar();
      }
    });
    document.getElementById("calNext")?.addEventListener("click", () => {
      if (monthIdx < months.length - 1) {
        calMonth = months[monthIdx + 1];
        renderCalendar();
      }
    });

    // Build grid
    const grid = document.getElementById("calGrid");
    const dow = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
    dow.forEach((d) => {
      const el = document.createElement("div");
      el.className = "cal-dow";
      el.textContent = d;
      grid.appendChild(el);
    });

    // First day of month
    const firstDay = new Date(yr, mo - 1, 1);
    let startDow = firstDay.getDay(); // 0=Sun
    startDow = startDow === 0 ? 6 : startDow - 1; // Convert to Mon=0

    // Days in month
    const daysInMonth = new Date(yr, mo, 0).getDate();

    // Empty cells before first day
    for (let i = 0; i < startDow; i++) {
      const el = document.createElement("div");
      el.className = "cal-cell";
      grid.appendChild(el);
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = calMonth + "-" + String(d).padStart(2, "0");
      const count = calData.days[dateStr] || 0;
      const el = document.createElement("div");
      el.className = "cal-cell" + (count ? " has-data" : "");

      if (count) {
        el.style.background = KPI.calColor(count, minVal, maxVal);
        if (dateStr === selectedDate) el.classList.add("selected");
        el.addEventListener("click", () => {
          selectedDate =
            selectedDate === dateStr ? Engine.getLastDate() : dateStr;
          renderKpi();
          renderCalendar();
        });
      }

      el.innerHTML = `
        <span class="cal-date" style="color:${count ? "var(--cal-label)" : "var(--text-muted)"}">${d}</span>
        ${count ? `<span class="cal-val" style="color:var(--cal-label)">${count}</span>` : ""}
      `;

      grid.appendChild(el);
    }
  }

  // ══════════════════════════════════════
  // SECTION 2 RIGHT: Bahan Chart
  // ══════════════════════════════════════
  function initBahanChart() {
    const controls = document.getElementById("chartControls");
    if (!controls) return;

    controls.innerHTML = `
      <div class="chart-controls">
        <div class="toggle-group">
          <button class="toggle-btn active" data-metric="brd">BRD</button>
          <button class="toggle-btn" data-metric="kg">KG</button>
        </div>
        <div id="pvSelectWrap"></div>
        <div id="periodSelectWrap"></div>
        <div class="spacer"></div>
        <div id="chartRangeNav"></div>
      </div>
    `;

    // Metric toggle
    controls.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        controls
          .querySelectorAll(".toggle-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        chartMetric = btn.dataset.metric;
        renderBahanChart();
      });
    });

    // PV custom select
    const pvSel = DatePicker.createCustomSelect(
      [
        { value: "AYAM BARU", label: "Ayam Baru" },
        { value: "AYAM LAMA", label: "Ayam Lama" },
        { value: "AYAM PROSES", label: "Ayam Proses" },
      ],
      chartPvMode,
      (val) => {
        chartPvMode = val;
        renderBahanChart();
      },
    );
    document.getElementById("pvSelectWrap").appendChild(pvSel.el);

    // Period custom select
    const periodSel = DatePicker.createCustomSelect(
      [
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
        { value: "monthly", label: "Monthly" },
      ],
      chartPeriod,
      (val) => {
        chartPeriod = val;
        chartSelectedItems = null;
        computeChartRange();
        renderBahanChart();
      },
    );
    document.getElementById("periodSelectWrap").appendChild(periodSel.el);

    // Legend
    const legend = document.getElementById("chartLegend");
    const depts = [
      { name: "CUT UP", color: "#34d399" },
      { name: "BONELESS", color: "#60a5fa" },
      { name: "AU", color: "#fbbf24" },
      { name: "PARTING", color: "#f472b6" },
    ];
    legend.innerHTML = depts
      .map(
        (d) =>
          `<div class="chart-legend-item">
        <div class="chart-legend-dot" style="background:${d.color}"></div>
        ${d.name}
      </div>`,
      )
      .join("");
  }

  function computeChartRange() {
    const dates = Engine.getAvailableDates();
    if (!dates.length) {
      chartDateRange = [];
      return;
    }

    if (chartPeriod === "daily") {
      // Last 7 days
      chartDateRange = dates.slice(-7);
    } else if (chartPeriod === "weekly") {
      // Last 7 weeks — get unique weeks
      chartDateRange = dates; // full range, aggregate in render
    } else {
      chartDateRange = dates;
    }
  }

  const MONTH_NAMES = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];

  function getWeekMap(dates) {
    const map = {};
    dates.forEach((d) => {
      const key = "W" + KPI.getISOWeek(d);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }

  function getMonthMap(dates) {
    const map = {};
    dates.forEach((d) => {
      const key = MONTH_NAMES[parseInt(d.slice(5, 7))];
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }

  function renderBahanChart() {
    const dates = Engine.getAvailableDates();
    if (!dates.length) return;

    const MAX = 7;
    let labels = [],
      dataByDept = { "CUT UP": [], BONELESS: [], AU: [], PARTING: [] };

    if (chartPeriod === "daily") {
      const range = chartSelectedItems
        ? dates.filter((d) => chartSelectedItems.includes(d))
        : dates.slice(-MAX);
      const dist = Engine.getBahanDistribution(range, chartPvMode, chartMetric);
      range.forEach((d) => {
        const parts = d.split("-");
        labels.push(parts[2] + " " + MONTH_NAMES[parseInt(parts[1])]);
        Object.keys(dataByDept).forEach((dept) => {
          dataByDept[dept].push(dist[d]?.[dept] || 0);
        });
      });
    } else if (chartPeriod === "weekly") {
      const weekMap = getWeekMap(dates);
      const allKeys = Object.keys(weekMap);
      const weekKeys = chartSelectedItems
        ? allKeys.filter((k) => chartSelectedItems.includes(k))
        : allKeys.slice(-MAX);
      weekKeys.forEach((wk) => {
        labels.push(wk);
        const dist = Engine.getBahanDistribution(
          weekMap[wk],
          chartPvMode,
          chartMetric,
        );
        Object.keys(dataByDept).forEach((dept) => {
          let sum = 0;
          weekMap[wk].forEach((d) => {
            sum += dist[d]?.[dept] || 0;
          });
          dataByDept[dept].push(sum);
        });
      });
    } else {
      const monthMap = getMonthMap(dates);
      const allKeys = Object.keys(monthMap);
      const mKeys = chartSelectedItems
        ? allKeys.filter((k) => chartSelectedItems.includes(k))
        : allKeys.slice(-MAX);
      mKeys.forEach((mk) => {
        labels.push(mk);
        const dist = Engine.getBahanDistribution(
          monthMap[mk],
          chartPvMode,
          chartMetric,
        );
        Object.keys(dataByDept).forEach((dept) => {
          let sum = 0;
          monthMap[mk].forEach((d) => {
            sum += dist[d]?.[dept] || 0;
          });
          dataByDept[dept].push(sum);
        });
      });
    }

    const datasets = Object.keys(dataByDept).map((dept) => ({
      label: dept,
      data: dataByDept[dept],
    }));

    Charts.buildStackedBar("bahanChart", { labels, datasets });

    const navEl = document.getElementById("chartRangeNav");
    if (navEl && labels.length) {
      navEl.innerHTML = `<button class="chart-range-btn" id="chartRangeBtn">${labels[0]} – ${labels[labels.length - 1]}</button>`;
      document
        .getElementById("chartRangeBtn")
        .addEventListener("click", openChartRangePicker);
    }
  }

  function openChartRangePicker() {
    const MAX = 7;
    const dates = Engine.getAvailableDates();
    if (!dates.length) return;

    if (chartPeriod === "daily") {
      openDailyRangePicker(dates, MAX);
      return;
    }

    // Weekly / monthly: flat grid UI
    let items = [];
    if (chartPeriod === "weekly") {
      items = Object.keys(getWeekMap(dates)).map((k) => ({ key: k, label: k }));
    } else {
      items = Object.keys(getMonthMap(dates)).map((k) => ({
        key: k,
        label: k,
      }));
    }

    let pickStart = Math.max(0, items.length - MAX);
    let pickEnd = items.length - 1;
    if (chartSelectedItems && chartSelectedItems.length) {
      const s = items.findIndex((i) => i.key === chartSelectedItems[0]);
      const e = items.findIndex(
        (i) => i.key === chartSelectedItems[chartSelectedItems.length - 1],
      );
      if (s !== -1 && e !== -1) {
        pickStart = s;
        pickEnd = e;
      }
    }

    let clickPhase = 0;

    closeRangePicker();

    const popup = document.createElement("div");
    popup.className = "range-picker-popup";
    popup.addEventListener("click", (e) => e.stopPropagation());
    popup.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        document.querySelector(".page-content")?.scrollBy({ top: e.deltaY });
      },
      { passive: false },
    );

    function renderGrid() {
      const hint =
        clickPhase === 0 ? "Klik awal rentang" : "Klik akhir rentang";
      popup.innerHTML = `
        <div class="range-picker-header">
          <span class="range-picker-title">${hint} <span class="range-picker-hint">(maks ${MAX})</span></span>
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
        cell.className =
          "range-picker-cell" +
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
            if (e - s + 1 > MAX) {
              if (idx > pickStart) e = s + MAX - 1;
              else s = e - MAX + 1;
            }
            pickStart = s;
            pickEnd = e;
            clickPhase = 0;
          }
          renderGrid();
        });
        grid.appendChild(cell);
      });

      popup
        .querySelector("#rpClose")
        .addEventListener("click", closeRangePicker);
      popup.querySelector("#rpReset").addEventListener("click", () => {
        chartSelectedItems = null;
        closeRangePicker();
        renderBahanChart();
      });
      popup.querySelector("#rpApply").addEventListener("click", () => {
        chartSelectedItems = items
          .slice(pickStart, pickEnd + 1)
          .map((i) => i.key);
        closeRangePicker();
        renderBahanChart();
      });
    }

    renderGrid();
    document.body.appendChild(popup);

    function positionPopup() {
      const btn = document.getElementById("chartRangeBtn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      popup.style.top = rect.bottom + 6 + "px";
      popup.style.left =
        Math.max(8, Math.min(rect.left, window.innerWidth - 300 - 32)) + "px";
    }
    positionPopup();
    _rangeScrollListener = positionPopup;
    const sc = document.querySelector(".page-content");
    if (sc) sc.addEventListener("scroll", _rangeScrollListener);
    popup.addEventListener("scroll", _rangeScrollListener, true);

    _rangeDocListener = () => closeRangePicker();
    setTimeout(() => document.addEventListener("click", _rangeDocListener), 0);
  }

  function openDailyRangePicker(dates, MAX) {
    const availSet = new Set(dates);
    const allMonths = [...new Set(dates.map((d) => d.slice(0, 7)))];

    let fromDate = null,
      toDate = null;
    if (chartSelectedItems && chartSelectedItems.length) {
      fromDate = chartSelectedItems[0];
      toDate = chartSelectedItems[chartSelectedItems.length - 1];
    } else {
      const range = dates.slice(-MAX);
      fromDate = range[0];
      toDate = range[range.length - 1];
    }

    // 0 = waiting pick start, 1 = waiting pick end
    let clickPhase = fromDate && toDate ? 0 : 0;
    let calMonth = (fromDate || dates[dates.length - 1]).slice(0, 7);

    closeRangePicker();

    const popup = document.createElement("div");
    popup.className = "range-picker-popup range-picker-daily";
    popup.addEventListener("click", (e) => e.stopPropagation());
    popup.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        document.querySelector(".page-content")?.scrollBy({ top: e.deltaY });
      },
      { passive: false },
    );

    function fmtDate(d) {
      if (!d) return "—";
      const p = d.split("-");
      return p[2] + " " + MONTH_NAMES[parseInt(p[1])] + " " + p[0];
    }

    function renderAll() {
      const hint =
        clickPhase === 0 ? "Pilih tanggal mulai" : "Pilih tanggal akhir";
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

      popup
        .querySelector("#rpClose")
        .addEventListener("click", closeRangePicker);
      popup.querySelector("#rpReset").addEventListener("click", () => {
        chartSelectedItems = null;
        closeRangePicker();
        renderBahanChart();
      });
      popup.querySelector("#rpApply").addEventListener("click", () => {
        if (fromDate && toDate) {
          const f = fromDate <= toDate ? fromDate : toDate;
          const t = fromDate <= toDate ? toDate : fromDate;
          chartSelectedItems = dates.filter((d) => d >= f && d <= t);
        } else {
          chartSelectedItems = null;
        }
        closeRangePicker();
        renderBahanChart();
      });

      renderCalPanel(popup.querySelector("#rpCalPanel"));
    }

    function renderCalPanel(panel) {
      const [yr, mo] = calMonth.split("-").map(Number);
      const minMonth = allMonths[0];
      const maxMonth = allMonths[allMonths.length - 1];
      const from =
        fromDate && toDate
          ? fromDate <= toDate
            ? fromDate
            : toDate
          : fromDate;
      const to =
        fromDate && toDate ? (fromDate <= toDate ? toDate : fromDate) : null;

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
        calMonth =
          prev.getFullYear() +
          "-" +
          String(prev.getMonth() + 1).padStart(2, "0");
        renderCalPanel(panel);
      });
      panel.querySelector("#rpCalNext").addEventListener("click", () => {
        const [y, m] = calMonth.split("-").map(Number);
        const next = new Date(y, m, 1);
        calMonth =
          next.getFullYear() +
          "-" +
          String(next.getMonth() + 1).padStart(2, "0");
        renderCalPanel(panel);
      });

      const grid = panel.querySelector("#rpCalGrid");
      ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].forEach((d) => {
        const el = document.createElement("div");
        el.className = "range-cal-dow";
        el.textContent = d;
        grid.appendChild(el);
      });

      const firstDay = new Date(yr, mo - 1, 1);
      let startDow = firstDay.getDay();
      startDow = startDow === 0 ? 6 : startDow - 1;
      for (let i = 0; i < startDow; i++) {
        grid.appendChild(
          Object.assign(document.createElement("div"), {
            className: "range-cal-cell",
          }),
        );
      }

      const daysInMonth = new Date(yr, mo, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = calMonth + "-" + String(d).padStart(2, "0");
        const available = availSet.has(dateStr);
        const inRange = from && to && dateStr >= from && dateStr <= to;
        const isEndpoint = dateStr === fromDate || dateStr === toDate;

        // Phase 1: disable dates too far from fromDate
        let tooFar = false;
        if (available && clickPhase === 1 && fromDate) {
          const diff = Math.round(
            (new Date(dateStr) - new Date(fromDate)) / 86400000,
          );
          if (Math.abs(diff) >= MAX) tooFar = true;
        }

        const cell = document.createElement("div");
        cell.className =
          "range-cal-cell" +
          (available && !tooFar ? " available" : "") +
          (inRange ? " in-range" : "") +
          (isEndpoint ? " is-endpoint" : "") +
          (tooFar && available ? " too-far" : "");
        cell.innerHTML = `<span>${d}</span>`;

        if (available && !tooFar) {
          cell.addEventListener("click", () => {
            if (clickPhase === 0) {
              fromDate = dateStr;
              toDate = null;
              clickPhase = 1;
            } else {
              toDate = dateStr;
              if (toDate < fromDate) {
                const tmp = fromDate;
                fromDate = toDate;
                toDate = tmp;
              }
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
      const btn = document.getElementById("chartRangeBtn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      popup.style.top = rect.bottom + 6 + "px";
      popup.style.left =
        Math.max(8, Math.min(rect.left, window.innerWidth - 270 - 32)) + "px";
    }
    positionPopup();
    _rangeScrollListener = positionPopup;
    const sc = document.querySelector(".page-content");
    if (sc) sc.addEventListener("scroll", _rangeScrollListener);
    popup.addEventListener("scroll", _rangeScrollListener, true);

    _rangeDocListener = () => closeRangePicker();
    setTimeout(() => document.addEventListener("click", _rangeDocListener), 0);
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
    document.querySelector(".range-picker-popup")?.remove();
  }

  // ══════════════════════════════════════
  // SECTION 3 LEFT: Search Material
  // ══════════════════════════════════════
  function initSearchMaterial() {
    const container = document.getElementById("searchContainer");
    if (!container) return;

    container.innerHTML = `
      <div class="search-layout">
        <div class="search-left">
          <div class="search-material-wrap">
            <span class="search-material-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </span>
            <input type="text" class="search-material-input" id="matSearchInput" placeholder="Search for material...">
            <div class="search-autocomplete" id="matAutocomplete"></div>
          </div>
          <div class="filter-row" style="margin-top:10px;">
            <div id="matDeptFilterWrap"></div>
            <div id="matPvFilterWrap"></div>
            <div id="matMvtFilterWrap"></div>
          </div>
          <div class="material-tags" id="matTags">
            <span class="material-tags-placeholder">material yang dipilih</span>
          </div>
        </div>
        <div class="search-right">
          <div class="search-right-value-col">
            <div class="search-right-col-label">value</div>
            <div class="search-value-item">
              <div class="search-value-box" id="srBrd"></div>
              <span class="search-value-unit">BRD</span>
            </div>
            <div class="search-value-item">
              <div class="search-value-box" id="srKg"></div>
              <span class="search-value-unit">KG</span>
            </div>
          </div>
          <div class="search-right-yield-col">
            <div class="search-right-col-label">yield</div>
            <div class="donut-wrap" id="srDonut" style="display:none"></div>
          </div>
        </div>
      </div>
    `;

    // Search input
    const input = document.getElementById("matSearchInput");
    const acList = document.getElementById("matAutocomplete");

    let _acResults = [];
    let _acQ = "";

    function renderAcList() {
      const selSet = new Set(selectedMaterials.map((m) => m.idx));
      const allChecked =
        _acResults.length > 0 && _acResults.every((r) => selSet.has(r.idx));
      const someChecked = _acResults.some((r) => selSet.has(r.idx));
      const re = new RegExp(
        `(${_acQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi",
      );

      acList.innerHTML = `
        <div class="search-ac-select-all">
          <div id="acSelectAll" style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" class="search-ac-checkbox" id="acSelectAllChk">
            <span>Select All</span>
          </div>
          <button class="search-ac-done-btn" id="acDoneBtn">Selesai</button>
        </div>
        ${_acResults
          .map((r) => {
            const checked = selSet.has(r.idx);
            const highlighted = r.matdesc.replace(re, "<mark>$1</mark>");
            return `<div class="search-ac-item" data-idx="${r.idx}">
            <input type="checkbox" class="search-ac-checkbox" ${checked ? "checked" : ""} readonly>
            <span class="search-ac-desc">${highlighted}</span>
            <span class="search-ac-code">${r.matcode}</span>
          </div>`;
          })
          .join("")}
      `;

      const selectAllChk = document.getElementById("acSelectAllChk");
      selectAllChk.checked = allChecked;
      selectAllChk.indeterminate = !allChecked && someChecked;

      // Item click — toggle selection
      acList.querySelectorAll(".search-ac-item[data-idx]").forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = parseInt(item.dataset.idx);
          const r = _acResults.find((x) => x.idx === idx);
          if (!r) return;
          const i = selectedMaterials.findIndex((m) => m.idx === idx);
          if (i >= 0) selectedMaterials.splice(i, 1);
          else selectedMaterials.push(r);
          renderAcList();
          renderSearchResult();
        });
      });

      // Select All click — toggle all
      document.getElementById("acSelectAll").addEventListener("click", (e) => {
        e.stopPropagation();
        const selSet = new Set(selectedMaterials.map((m) => m.idx));
        const allChk = _acResults.every((r) => selSet.has(r.idx));
        if (allChk) {
          _acResults.forEach((r) => {
            const i = selectedMaterials.findIndex((m) => m.idx === r.idx);
            if (i >= 0) selectedMaterials.splice(i, 1);
          });
        } else {
          _acResults.forEach((r) => {
            if (!selSet.has(r.idx)) selectedMaterials.push(r);
          });
        }
        renderAcList();
        renderSearchResult();
      });

      // Selesai — close dropdown
      document.getElementById("acDoneBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        acList.classList.remove("show");
        input.value = "";
      });
    }

    input.addEventListener("input", () => {
      const q = input.value.trim();
      if (q.length < 2) {
        acList.classList.remove("show");
        return;
      }
      const results = Engine.searchMaterial(q);
      if (!results.length) {
        acList.classList.remove("show");
        return;
      }
      _acResults = results;
      _acQ = q;
      renderAcList();
      acList.classList.add("show");
    });

    // Close autocomplete on outside click
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search-material-wrap")) {
        acList.classList.remove("show");
      }
    });

    // Custom select filters
    const deptSel = DatePicker.createCustomSelect(
      [{ value: "All", label: "All Dept" }],
      "All",
      (val) => {
        searchFilters.dept = val;
        searchFilters.pv = "All";
        searchFilters.mvt = "All";
        updateSearchFilterOptions();
        renderSearchResult();
      },
    );
    document.getElementById("matDeptFilterWrap").appendChild(deptSel.el);

    const pvSel = DatePicker.createCustomSelect(
      [{ value: "All", label: "All PV" }],
      "All",
      (val) => {
        searchFilters.pv = val;
        searchFilters.mvt = "All";
        updateSearchFilterOptions();
        renderSearchResult();
      },
    );
    document.getElementById("matPvFilterWrap").appendChild(pvSel.el);

    const mvtSel = DatePicker.createCustomSelect(
      [{ value: "All", label: "All MVT" }],
      "All",
      (val) => {
        searchFilters.mvt = val;
        renderSearchResult();
      },
    );
    document.getElementById("matMvtFilterWrap").appendChild(mvtSel.el);

    window._matDeptSel = deptSel;
    window._matPvSel = pvSel;
    window._matMvtSel = mvtSel;

    // Date range button with prev/next navigation
    const searchNavContainer = document.getElementById("searchDateNav");
    searchNavContainer.innerHTML = `
      <div class="date-nav">
        <button class="date-nav-btn" id="searchRangePrev">‹</button>
        <button class="chart-range-btn" id="searchRangeBtn">${fmtSearchRange()}</button>
        <button class="date-nav-btn" id="searchRangeNext">›</button>
      </div>
    `;
    document
      .getElementById("searchRangeBtn")
      .addEventListener("click", openSearchRangePicker);
    document.getElementById("searchRangePrev").addEventListener("click", () => {
      const allDates = Engine.getAvailableDates();
      const fromIdx = allDates.indexOf(searchFromDate);
      if (fromIdx <= 0) return;
      const span = allDates.indexOf(searchToDate) - fromIdx;
      searchFromDate = allDates[fromIdx - 1];
      searchToDate = allDates[Math.max(0, fromIdx - 1 + span)];
      renderSearchResult();
    });
    document.getElementById("searchRangeNext").addEventListener("click", () => {
      const allDates = Engine.getAvailableDates();
      const toIdx = allDates.indexOf(searchToDate);
      if (toIdx >= allDates.length - 1) return;
      const span = toIdx - allDates.indexOf(searchFromDate);
      searchToDate = allDates[toIdx + 1];
      searchFromDate = allDates[Math.max(0, toIdx + 1 - span)];
      renderSearchResult();
    });
  }

  function fmtSearchRange() {
    if (!searchFromDate) return "—";
    const fmt = (d) => {
      const p = d.split("-");
      return p[2] + " " + MONTH_NAMES[parseInt(p[1])];
    };
    if (searchFromDate === searchToDate)
      return fmt(searchFromDate) + " " + searchFromDate.slice(0, 4);
    return (
      fmt(searchFromDate) +
      " – " +
      fmt(searchToDate) +
      " " +
      searchToDate.slice(0, 4)
    );
  }

  function getSearchDates() {
    const all = Engine.getAvailableDates();
    if (!searchFromDate || !searchToDate) return all.slice(-1);
    const from = searchFromDate <= searchToDate ? searchFromDate : searchToDate;
    const to = searchFromDate <= searchToDate ? searchToDate : searchFromDate;
    return all.filter((d) => d >= from && d <= to);
  }

  function closeSearchRangePicker() {
    if (_srDocListener) {
      document.removeEventListener("click", _srDocListener);
      _srDocListener = null;
    }
    if (_srScrollListener) {
      document
        .querySelector(".page-content")
        ?.removeEventListener("scroll", _srScrollListener);
      _srScrollListener = null;
    }
    document.querySelector(".range-picker-popup")?.remove();
  }

  function openSearchRangePicker() {
    const MAX = 31;
    const dates = Engine.getAvailableDates();
    if (!dates.length) return;

    const availSet = new Set(dates);
    const allMonths = [...new Set(dates.map((d) => d.slice(0, 7)))];

    let fromDate = searchFromDate || dates[dates.length - 1];
    let toDate = searchToDate || dates[dates.length - 1];
    let clickPhase = 0;
    let srCalMonth = fromDate.slice(0, 7);

    closeRangePicker();
    closeSearchRangePicker();

    const popup = document.createElement("div");
    popup.className = "range-picker-popup range-picker-daily";
    popup.addEventListener("click", (e) => e.stopPropagation());
    popup.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        document.querySelector(".page-content")?.scrollBy({ top: e.deltaY });
      },
      { passive: false },
    );

    function fmtD(d) {
      if (!d) return "—";
      const p = d.split("-");
      return p[2] + " " + MONTH_NAMES[parseInt(p[1])] + " " + p[0];
    }

    function renderPopup() {
      const hint =
        clickPhase === 0 ? "Pilih tanggal mulai" : "Pilih tanggal akhir";
      popup.innerHTML = `
        <div class="range-picker-header">
          <span class="range-picker-title">${hint} <span class="range-picker-hint">(maks ${MAX} hari)</span></span>
          <button class="range-picker-close" id="srpClose">×</button>
        </div>
        <div class="range-daily-summary">
          <div class="range-daily-summary-field ${clickPhase === 0 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Dari</div>
            <div class="range-daily-summary-val">${fmtD(fromDate)}</div>
          </div>
          <div class="range-daily-summary-arrow">→</div>
          <div class="range-daily-summary-field ${clickPhase === 1 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Sampai</div>
            <div class="range-daily-summary-val">${fmtD(toDate)}</div>
          </div>
        </div>
        <div class="range-cal-panel" id="srpCalPanel"></div>
        <div class="range-picker-footer">
          <button class="range-picker-reset" id="srpReset">Reset</button>
          <button class="range-picker-apply" id="srpApply" ${!fromDate || !toDate || clickPhase === 1 ? "disabled" : ""}>Terapkan</button>
        </div>
      `;

      popup
        .querySelector("#srpClose")
        .addEventListener("click", closeSearchRangePicker);
      popup.querySelector("#srpReset").addEventListener("click", () => {
        const last = Engine.getLastDate();
        searchFromDate = last;
        searchToDate = last;
        closeSearchRangePicker();
        renderSearchResult();
      });
      popup.querySelector("#srpApply").addEventListener("click", () => {
        if (fromDate && toDate) {
          const f = fromDate <= toDate ? fromDate : toDate;
          const t = fromDate <= toDate ? toDate : fromDate;
          searchFromDate = f;
          searchToDate = t;
        }
        closeSearchRangePicker();
        renderSearchResult();
      });

      renderSrCalPanel(popup.querySelector("#srpCalPanel"));
    }

    function renderSrCalPanel(panel) {
      const [yr, mo] = srCalMonth.split("-").map(Number);
      const minMonth = allMonths[0];
      const maxMonth = allMonths[allMonths.length - 1];
      const from =
        fromDate && toDate
          ? fromDate <= toDate
            ? fromDate
            : toDate
          : fromDate;
      const to =
        fromDate && toDate ? (fromDate <= toDate ? toDate : fromDate) : null;

      panel.innerHTML = `
        <div class="range-cal-nav">
          <button class="date-nav-btn" id="srpCalPrev" ${srCalMonth <= minMonth ? "disabled" : ""}>‹</button>
          <span class="date-nav-label" style="font-size:12px">${KPI.formatMonthYear(srCalMonth)}</span>
          <button class="date-nav-btn" id="srpCalNext" ${srCalMonth >= maxMonth ? "disabled" : ""}>›</button>
        </div>
        <div class="range-cal-grid" id="srpCalGrid"></div>
      `;

      panel.querySelector("#srpCalPrev").addEventListener("click", () => {
        const [y, m] = srCalMonth.split("-").map(Number);
        const prev = new Date(y, m - 2, 1);
        srCalMonth =
          prev.getFullYear() +
          "-" +
          String(prev.getMonth() + 1).padStart(2, "0");
        renderSrCalPanel(panel);
      });
      panel.querySelector("#srpCalNext").addEventListener("click", () => {
        const [y, m] = srCalMonth.split("-").map(Number);
        const next = new Date(y, m, 1);
        srCalMonth =
          next.getFullYear() +
          "-" +
          String(next.getMonth() + 1).padStart(2, "0");
        renderSrCalPanel(panel);
      });

      const grid = panel.querySelector("#srpCalGrid");
      ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].forEach((d) => {
        const el = document.createElement("div");
        el.className = "range-cal-dow";
        el.textContent = d;
        grid.appendChild(el);
      });

      const firstDay = new Date(yr, mo - 1, 1);
      let startDow = firstDay.getDay();
      startDow = startDow === 0 ? 6 : startDow - 1;
      for (let i = 0; i < startDow; i++) {
        grid.appendChild(
          Object.assign(document.createElement("div"), {
            className: "range-cal-cell",
          }),
        );
      }

      const daysInMonth = new Date(yr, mo, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = srCalMonth + "-" + String(d).padStart(2, "0");
        const available = availSet.has(dateStr);
        const inRange = from && to && dateStr >= from && dateStr <= to;
        const isEndpoint = dateStr === fromDate || dateStr === toDate;

        let tooFar = false;
        if (available && clickPhase === 1 && fromDate) {
          const diff = Math.round(
            (new Date(dateStr) - new Date(fromDate)) / 86400000,
          );
          if (Math.abs(diff) >= MAX) tooFar = true;
        }

        const cell = document.createElement("div");
        cell.className =
          "range-cal-cell" +
          (available && !tooFar ? " available" : "") +
          (inRange ? " in-range" : "") +
          (isEndpoint ? " is-endpoint" : "") +
          (tooFar && available ? " too-far" : "");
        cell.innerHTML = `<span>${d}</span>`;

        if (available && !tooFar) {
          cell.addEventListener("click", () => {
            if (clickPhase === 0) {
              fromDate = dateStr;
              toDate = null;
              clickPhase = 1;
            } else {
              toDate = dateStr;
              if (toDate < fromDate) {
                const tmp = fromDate;
                fromDate = toDate;
                toDate = tmp;
              }
              clickPhase = 0;
            }
            renderPopup();
          });
        }
        grid.appendChild(cell);
      }
    }

    renderPopup();
    document.body.appendChild(popup);

    function positionPopup() {
      const btn = document.getElementById("searchRangeBtn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      popup.style.top = rect.bottom + 6 + "px";
      popup.style.left =
        Math.max(8, Math.min(rect.left, window.innerWidth - 270 - 32)) + "px";
    }
    positionPopup();
    _srScrollListener = positionPopup;
    const sc = document.querySelector(".page-content");
    if (sc) sc.addEventListener("scroll", _srScrollListener);
    popup.addEventListener("scroll", _srScrollListener, true);

    _srDocListener = () => closeSearchRangePicker();
    setTimeout(() => document.addEventListener("click", _srDocListener), 0);
  }

  function updateSearchFilterOptions() {
    if (!selectedMaterials.length) return;
    const indices = selectedMaterials.map((m) => m.idx);
    const opts = Engine.getMaterialFilterOptionsRange(
      indices,
      getSearchDates(),
      searchFilters,
    );

    window._matDeptSel?.updateOptions(
      [
        { value: "All", label: "All Dept" },
        ...opts.depts.map((d) => ({ value: d, label: d })),
      ],
      searchFilters.dept,
    );
    window._matPvSel?.updateOptions(
      [
        { value: "All", label: "All PV" },
        ...opts.pvs.map((p) => ({ value: p, label: p })),
      ],
      searchFilters.pv,
    );
    window._matMvtSel?.updateOptions(
      [
        { value: "All", label: "All MVT" },
        ...opts.mvts.map((m) => ({ value: m, label: m })),
      ],
      searchFilters.mvt,
    );
  }

  function renderSearchResult() {
    const tagsEl = document.getElementById("matTags");
    const brdEl = document.getElementById("srBrd");
    const kgEl = document.getElementById("srKg");
    const donutEl = document.getElementById("srDonut");

    // Sync range button label and prev/next state
    const rangeBtn = document.getElementById("searchRangeBtn");
    if (rangeBtn) rangeBtn.textContent = fmtSearchRange();
    const allDates = Engine.getAvailableDates();
    const fromIdx = allDates.indexOf(searchFromDate);
    const toIdx = allDates.indexOf(searchToDate);
    const prevBtn = document.getElementById("searchRangePrev");
    const nextBtn = document.getElementById("searchRangeNext");
    if (prevBtn) prevBtn.disabled = fromIdx <= 0;
    if (nextBtn) nextBtn.disabled = toIdx >= allDates.length - 1;

    if (!selectedMaterials.length) {
      tagsEl.innerHTML =
        '<span class="material-tags-placeholder">Daftar Material Dipilih (bisa multiple)</span>';
      brdEl.textContent = "";
      kgEl.textContent = "";
      donutEl.style.display = "none";
      return;
    }

    const dates = getSearchDates();

    // Update filter dropdowns
    updateSearchFilterOptions();

    // Render tags (dimmed if not matching filter)
    tagsEl.innerHTML =
      selectedMaterials
        .map((m, i) => {
          const matches = Engine.materialMatchesFilterRange(
            m.idx,
            searchFilters,
            dates,
          );
          return `<span class="material-tag ${matches ? "" : "dimmed"}" data-i="${i}">
        ${m.matdesc}
        <span class="material-tag-remove" data-i="${i}">×</span>
      </span>`;
        })
        .join("") +
      `<button class="material-tags-clear-all" id="matClearAll">Clear All</button>`;

    tagsEl.querySelectorAll(".material-tag-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.i);
        selectedMaterials.splice(idx, 1);
        searchFilters = { dept: "All", pv: "All", mvt: "All" };
        renderSearchResult();
      });
    });

    document.getElementById("matClearAll").addEventListener("click", (e) => {
      e.stopPropagation();
      selectedMaterials.length = 0;
      searchFilters = { dept: "All", pv: "All", mvt: "All" };
      renderSearchResult();
    });

    // Calculate result
    const indices = selectedMaterials.map((m) => m.idx);
    const result = Engine.calcMaterialValueRange(indices, searchFilters, dates);

    brdEl.textContent = KPI.fmtShort(result.brd);
    kgEl.textContent = KPI.fmtShort(result.kg);

    if (searchFilters.mvt === "HASIL" && result.yieldPct !== null) {
      donutEl.style.display = "";
      Charts.renderDonut("srDonut", result.yieldPct);
    } else {
      donutEl.style.display = "none";
    }
  }

  // ══════════════════════════════════════
  // RENDER ALL
  // ══════════════════════════════════════
  function renderAll() {
    renderKpi();
    renderCalendar();
    renderBahanChart();
  }

  return { render };
})();
