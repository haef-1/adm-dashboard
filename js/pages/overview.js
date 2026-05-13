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
  let chartSelectedFrom = null;
  let chartSelectedTo = null;
  let _rangeDocListener = null;
  let _rangeScrollListener = null;
  let _srDocListener = null;
  let _srScrollListener = null;
  let searchFromDate = null;
  let searchToDate = null;
  let selectedMaterials = []; // [{idx, matdesc, matcode}, ...]
  let searchFilters = { dept: "All", pv: "All", mvt: "All" };
  let smtMetric = "brd";
  let smtPeriod = "daily";
  let smtChartInstances = [];
  let smtCombined = true;

  // ── Main render ──
  function render(container) {
    selectedDate = Engine.getLastDate();
    calMonth = selectedDate ? selectedDate.slice(0, 7) : null;
    initSmtDefaultRange();

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
            <div class="smt-header-controls" id="smtHeaderControls"></div>
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
      const prevDateStr = calMonth + "-" + String(d - 1).padStart(2, "0");
      const count = calData.days[dateStr] || 0;
      const prevCount = d > 1 ? (calData.days[prevDateStr] || 0) : null;
      const el = document.createElement("div");
      el.className = "cal-cell" + (count ? " has-data" : "");

      if (count) {
        el.style.background = KPI.calColor(count, prevCount);
        if (dateStr === selectedDate) el.classList.add("selected");
        el.addEventListener("click", () => {
          selectedDate =
            selectedDate === dateStr ? Engine.getLastDate() : dateStr;
          renderKpi();
          renderCalendar();
        });
      }

      const textColor = count ? "var(--text)" : "var(--text-muted)";
      el.innerHTML = `
        <span class="cal-date" style="color:${textColor}">${d}</span>
        ${count ? `<span class="cal-val" style="color:${textColor}">${count}</span>` : ""}
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
        chartSelectedFrom = null;
        chartSelectedTo = null;
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
      const key = d.slice(0, 4) + "-W" + KPI.getISOWeek(d);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }

  function getMonthMap(dates) {
    const map = {};
    dates.forEach((d) => {
      const key = d.slice(0, 7);
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
    let rangeFirst = null, rangeLast = null;

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
      if (range.length) { rangeFirst = range[0]; rangeLast = range[range.length - 1]; }
    } else if (chartPeriod === "weekly") {
      const weekMap = getWeekMap(dates);
      const allKeys = Object.keys(weekMap);
      const weekKeys = chartSelectedItems
        ? allKeys.filter((k) => chartSelectedItems.includes(k))
        : allKeys.slice(-MAX);
      weekKeys.forEach((wk) => {
        labels.push("W" + wk.split("-W")[1]);
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
      if (weekKeys.length) { rangeFirst = weekKeys[0]; rangeLast = weekKeys[weekKeys.length - 1]; }
    } else {
      const monthMap = getMonthMap(dates);
      const allKeys = Object.keys(monthMap);
      const mKeys = chartSelectedItems
        ? allKeys.filter((k) => chartSelectedItems.includes(k))
        : allKeys.slice(-MAX);
      mKeys.forEach((mk) => {
        labels.push(MONTH_NAMES[parseInt(mk.slice(5, 7))]);
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
      if (mKeys.length) { rangeFirst = mKeys[0]; rangeLast = mKeys[mKeys.length - 1]; }
    }

    const datasets = Object.keys(dataByDept).map((dept) => ({
      label: dept,
      data: dataByDept[dept],
    }));

    Charts.buildStackedBar("bahanChart", { labels, datasets });

    const navEl = document.getElementById("chartRangeNav");
    if (navEl) {
      const fmtShort = (d) => {
        const p = d.split("-");
        return p[2] + " " + MONTH_NAMES[parseInt(p[1])];
      };
      let rangeLabel;
      if (rangeFirst && rangeLast) {
        if (chartPeriod === "monthly") {
          const mA = MONTH_NAMES[parseInt(rangeFirst.split("-")[1])];
          const mB = MONTH_NAMES[parseInt(rangeLast.split("-")[1])];
          const yA = rangeFirst.split("-")[0], yB = rangeLast.split("-")[0];
          if (yA === yB) {
            rangeLabel = mA + " – " + mB + " " + yB;
          } else {
            rangeLabel = mA + " " + yA + " – " + mB + " " + yB;
          }
        } else if (chartPeriod === "weekly") {
          const wA = "W" + rangeFirst.split("-W")[1];
          const wB = "W" + rangeLast.split("-W")[1];
          const yA = rangeFirst.split("-")[0], yB = rangeLast.split("-")[0];
          if (yA === yB) {
            rangeLabel = wA + " – " + wB + " " + yA;
          } else {
            rangeLabel = wA + " " + yA + " – " + wB + " " + yB;
          }
        } else {
          const yA = rangeFirst.split("-")[0], yB = rangeLast.split("-")[0];
          if (yA === yB) {
            rangeLabel = fmtShort(rangeFirst) + " – " + fmtShort(rangeLast) + " " + yB;
          } else {
            rangeLabel = fmtShort(rangeFirst) + " " + yA + " – " + fmtShort(rangeLast) + " " + yB;
          }
        }
      } else if (chartSelectedFrom && chartSelectedTo) {
        rangeLabel = `${fmtShort(chartSelectedFrom)} – ${fmtShort(chartSelectedTo)} (kosong)`;
      } else {
        rangeLabel = "Pilih tanggal";
      }
      navEl.innerHTML = `<button class="chart-range-btn" id="chartRangeBtn">${rangeLabel}</button>`;
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
      items = Object.keys(getWeekMap(dates)).map((k) => ({ key: k, label: "W" + k.split("-W")[1] }));
    } else {
      items = Object.keys(getMonthMap(dates)).map((k) => ({
        key: k,
        label: MONTH_NAMES[parseInt(k.slice(5, 7))],
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
        clickPhase === 0 ? "Pilih awal rentang" : "Pilih akhir rentang";
      const fromLabel = items[pickStart] ? items[pickStart].label : "—";
      const toLabel = clickPhase === 0 && items[pickEnd] ? items[pickEnd].label : (clickPhase === 1 ? "—" : "—");
      popup.innerHTML = `
        <div class="range-picker-header">
          <span class="range-picker-title">${hint} <span class="range-picker-hint">(maks ${MAX})</span></span>
          <button class="range-picker-close" id="rpClose">×</button>
        </div>
        <div class="range-daily-summary">
          <div class="range-daily-summary-field ${clickPhase === 0 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Dari</div>
            <div class="range-daily-summary-val">${fromLabel}</div>
          </div>
          <div class="range-daily-summary-arrow">→</div>
          <div class="range-daily-summary-field ${clickPhase === 1 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Sampai</div>
            <div class="range-daily-summary-val">${toLabel}</div>
          </div>
        </div>
        <div class="range-picker-grid" id="rpGrid"></div>
        <div class="range-picker-footer">
          <button class="range-picker-reset" id="rpReset">Reset</button>
          <button class="range-picker-apply" id="rpApply" ${clickPhase === 1 ? "disabled" : ""}>Terapkan</button>
        </div>
      `;

      const grid = popup.querySelector("#rpGrid");
      items.forEach((item, idx) => {
        const inRange = idx >= pickStart && idx <= pickEnd;
        const isEndpoint = idx === pickStart || (clickPhase === 0 && idx === pickEnd);
        let tooFar = false;
        if (clickPhase === 1) {
          const s = Math.min(pickStart, idx);
          const e = Math.max(pickStart, idx);
          if (e - s + 1 > MAX) tooFar = true;
        }
        const cell = document.createElement("div");
        cell.className =
          "range-picker-cell" +
          (inRange && !tooFar ? " in-range" : "") +
          (isEndpoint ? " is-start" : "") +
          (tooFar ? " too-far" : "");
        cell.textContent = item.label;
        if (!tooFar) {
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
        }
        grid.appendChild(cell);
      });

      popup
        .querySelector("#rpClose")
        .addEventListener("click", closeRangePicker);
      popup.querySelector("#rpReset").addEventListener("click", () => {
        chartSelectedItems = null;
        chartSelectedFrom = null;
        chartSelectedTo = null;
        closeRangePicker();
        renderBahanChart();
      });
      popup.querySelector("#rpApply").addEventListener("click", () => {
        chartSelectedItems = items
          .slice(pickStart, pickEnd + 1)
          .map((i) => i.key);
        chartSelectedFrom = null;
        chartSelectedTo = null;
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
    if (chartSelectedFrom && chartSelectedTo) {
      fromDate = chartSelectedFrom;
      toDate = chartSelectedTo;
    } else if (chartSelectedItems && chartSelectedItems.length) {
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
          <span class="range-picker-title">${hint} <span class="range-picker-hint">(maks ${MAX} data)</span></span>
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
        chartSelectedFrom = null;
        chartSelectedTo = null;
        closeRangePicker();
        renderBahanChart();
      });
      popup.querySelector("#rpApply").addEventListener("click", () => {
        if (fromDate && toDate) {
          const f = fromDate <= toDate ? fromDate : toDate;
          const t = fromDate <= toDate ? toDate : fromDate;
          chartSelectedFrom = f;
          chartSelectedTo = t;
          chartSelectedItems = dates.filter((d) => d >= f && d <= t);
        } else {
          chartSelectedItems = null;
          chartSelectedFrom = null;
          chartSelectedTo = null;
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
      const today = new Date();
      const todayStr =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = calMonth + "-" + String(d).padStart(2, "0");
        const hasData = availSet.has(dateStr);
        const isFuture = dateStr > todayStr;
        const inRange = from && to && dateStr >= from && dateStr <= to;
        const isEndpoint = dateStr === fromDate || dateStr === toDate;

        let tooFar = false;
        if (!isFuture && clickPhase === 1 && fromDate) {
          const lo = fromDate < dateStr ? fromDate : dateStr;
          const hi = fromDate < dateStr ? dateStr : fromDate;
          const dataCount = dates.filter(d => d >= lo && d <= hi).length;
          if (dataCount > MAX) tooFar = true;
        }

        const cell = document.createElement("div");
        cell.className =
          "range-cal-cell" +
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

  function initSmtDefaultRange() {
    const dates = Engine.getAvailableDates();
    if (!dates.length) { searchFromDate = null; searchToDate = null; return; }
    searchToDate = dates[dates.length - 1];
    if (smtPeriod === "daily") {
      searchFromDate = dates[Math.max(0, dates.length - 7)];
    } else if (smtPeriod === "weekly") {
      const weekMap = getWeekMap(dates);
      const weeks = Object.keys(weekMap);
      const startWk = weeks[Math.max(0, weeks.length - 7)];
      searchFromDate = weekMap[startWk][0];
    } else {
      const monthMap = getMonthMap(dates);
      const months = Object.keys(monthMap);
      const startMo = months[Math.max(0, months.length - 7)];
      searchFromDate = monthMap[startMo][0];
    }
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
        <div class="search-right" style="flex:1;min-width:0">
          <div style="display:flex;justify-content:flex-end;min-height:24px" id="smtCombineWrap">
            <button class="smt-mode-btn" id="smtCombineBtn" style="display:none">Breakdown Chart</button>
          </div>
          <div id="smtChartsContainer"></div>
          <div class="smt-chart-empty" id="smtChartEmpty">Pilih material untuk ditampilkan</div>
        </div>
      </div>
    `;

    // Header controls: metric toggle + period dropdown + range nav
    const hdrCtrl = document.getElementById("smtHeaderControls");
    hdrCtrl.innerHTML = `
      <div class="toggle-group" id="smtMetricToggle">
        <button class="toggle-btn active" data-metric="brd">BRD</button>
        <button class="toggle-btn" data-metric="kg">KG</button>
        <button class="toggle-btn" data-metric="pct" id="smtPctBtn" style="display:none">%</button>
      </div>
      <div id="smtPeriodSelectWrap"></div>
      <div class="date-nav" id="searchDateNav">
        <button class="date-nav-btn" id="searchRangePrev">‹</button>
        <button class="chart-range-btn" id="searchRangeBtn">${fmtSearchRange()}</button>
        <button class="date-nav-btn" id="searchRangeNext">›</button>
      </div>
    `;

    // Metric toggle
    hdrCtrl.querySelectorAll("#smtMetricToggle .toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        smtMetric = btn.dataset.metric;
        hdrCtrl.querySelectorAll("#smtMetricToggle .toggle-btn").forEach(b => b.classList.toggle("active", b.dataset.metric === smtMetric));
        renderSearchResult();
      });
    });

    // Combine toggle
    document.getElementById("smtCombineBtn").addEventListener("click", () => {
      smtCombined = !smtCombined;
      const btn = document.getElementById("smtCombineBtn");
      btn.textContent = smtCombined ? "Breakdown Chart" : "Combine Chart";
      renderSearchResult();
    });

    // Period dropdown
    const smtPeriodSel = DatePicker.createCustomSelect(
      [
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
        { value: "monthly", label: "Monthly" },
      ],
      smtPeriod,
      (val) => {
        smtPeriod = val;
        initSmtDefaultRange();
        renderSearchResult();
      },
    );
    document.getElementById("smtPeriodSelectWrap").appendChild(smtPeriodSel.el);

    // Search input
    const input = document.getElementById("matSearchInput");
    const acList = document.getElementById("matAutocomplete");

    let _acResults = [];
    let _acQ = "";

    function renderAcList() {
      const selSet = new Set(selectedMaterials.map(m => m.idx));
      const allChecked = _acResults.length > 0 && _acResults.every(r => selSet.has(r.idx));
      const someChecked = _acResults.some(r => selSet.has(r.idx));
      const re = new RegExp(
        `(${_acQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi",
      );

      acList.innerHTML = `
        <div class="search-ac-select-all">
          <div id="matAcSelectAll" style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" class="search-ac-checkbox" id="matAcSelectAllChk">
            <span>Select All</span>
          </div>
          <button class="search-ac-done-btn" id="matAcDoneBtn">Selesai</button>
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

      const selectAllChk = document.getElementById("matAcSelectAllChk");
      selectAllChk.checked = allChecked;
      selectAllChk.indeterminate = !allChecked && someChecked;

      acList.querySelectorAll(".search-ac-item[data-idx]").forEach(item => {
        item.querySelector(".search-ac-checkbox").addEventListener("click", e => {
          e.stopPropagation();
          const idx = parseInt(item.dataset.idx);
          const r = _acResults.find(x => x.idx === idx);
          if (!r) return;
          const i = selectedMaterials.findIndex(m => m.idx === idx);
          if (i >= 0) selectedMaterials.splice(i, 1);
          else selectedMaterials.push(r);
          renderAcList();
          updateSearchFilterOptions();
          renderSearchResult();
        });
        item.querySelector(".search-ac-desc").addEventListener("click", e => {
          e.stopPropagation();
          const idx = parseInt(item.dataset.idx);
          const r = _acResults.find(x => x.idx === idx);
          if (!r) return;
          selectedMaterials.length = 0;
          selectedMaterials.push(r);
          searchFilters = { dept: "All", pv: "All", mvt: "All" };
          acList.classList.remove("show");
          input.value = "";
          updateSearchFilterOptions();
          renderSearchResult();
        });
      });

      document.getElementById("matAcSelectAll").addEventListener("click", e => {
        e.stopPropagation();
        const set = new Set(selectedMaterials.map(m => m.idx));
        const allChk = _acResults.every(r => set.has(r.idx));
        if (allChk) {
          _acResults.forEach(r => {
            const i = selectedMaterials.findIndex(m => m.idx === r.idx);
            if (i >= 0) selectedMaterials.splice(i, 1);
          });
        } else {
          _acResults.forEach(r => {
            if (!set.has(r.idx)) selectedMaterials.push(r);
          });
        }
        renderAcList();
        updateSearchFilterOptions();
        renderSearchResult();
      });

      document.getElementById("matAcDoneBtn").addEventListener("click", e => {
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

    // Range nav event listeners
    document.getElementById("searchRangeBtn").addEventListener("click", openSearchRangePicker);
    document.getElementById("searchRangePrev").addEventListener("click", () => stepSearchRange(-1));
    document.getElementById("searchRangeNext").addEventListener("click", () => stepSearchRange(1));
  }

  function stepSearchRange(dir) {
    const allDates = Engine.getAvailableDates();
    if (!allDates.length) return;

    if (smtPeriod === "weekly") {
      const wMap = getWeekMap(allDates);
      const weeks = Object.keys(wMap);
      const fk = searchFromDate.slice(0, 4) + "-W" + KPI.getISOWeek(searchFromDate);
      const tk = searchToDate.slice(0, 4) + "-W" + KPI.getISOWeek(searchToDate);
      const fi = weeks.indexOf(fk), ti = weeks.indexOf(tk);
      const span = ti - fi;
      const ni = dir < 0 ? fi - 1 : ti + 1;
      if (ni < 0 || ni >= weeks.length) return;
      const nf = dir < 0 ? ni : Math.max(0, ni - span);
      const nt = dir < 0 ? Math.min(weeks.length - 1, ni + span) : ni;
      searchFromDate = wMap[weeks[nf]][0];
      searchToDate = wMap[weeks[nt]].slice(-1)[0];
    } else if (smtPeriod === "monthly") {
      const mMap = getMonthMap(allDates);
      const months = Object.keys(mMap);
      const fk = searchFromDate.slice(0, 7), tk = searchToDate.slice(0, 7);
      const fi = months.indexOf(fk), ti = months.indexOf(tk);
      const span = ti - fi;
      const ni = dir < 0 ? fi - 1 : ti + 1;
      if (ni < 0 || ni >= months.length) return;
      const nf = dir < 0 ? ni : Math.max(0, ni - span);
      const nt = dir < 0 ? Math.min(months.length - 1, ni + span) : ni;
      searchFromDate = mMap[months[nf]][0];
      searchToDate = mMap[months[nt]].slice(-1)[0];
    } else {
      const fromIdx = allDates.indexOf(searchFromDate);
      const toIdx = allDates.indexOf(searchToDate);
      const span = toIdx - fromIdx;
      if (dir < 0) {
        if (fromIdx <= 0) return;
        searchFromDate = allDates[fromIdx - 1];
        searchToDate = allDates[Math.max(0, fromIdx - 1 + span)];
      } else {
        if (toIdx >= allDates.length - 1) return;
        searchToDate = allDates[toIdx + 1];
        searchFromDate = allDates[Math.max(0, toIdx + 1 - span)];
      }
    }
    renderSearchResult();
  }

  function fmtSearchRange() {
    if (!searchFromDate) return "—";
    if (smtPeriod === "weekly") {
      const fW = "W" + KPI.getISOWeek(searchFromDate);
      const tW = "W" + KPI.getISOWeek(searchToDate);
      if (fW === tW && searchFromDate.slice(0, 4) === searchToDate.slice(0, 4))
        return fW + " " + searchFromDate.slice(0, 4);
      return fW + " – " + tW + " " + searchToDate.slice(0, 4);
    }
    if (smtPeriod === "monthly") {
      const fM = MONTH_NAMES[parseInt(searchFromDate.slice(5, 7))];
      const tM = MONTH_NAMES[parseInt(searchToDate.slice(5, 7))];
      if (searchFromDate.slice(0, 7) === searchToDate.slice(0, 7))
        return fM + " " + searchFromDate.slice(0, 4);
      return fM + " – " + tM + " " + searchToDate.slice(0, 4);
    }
    const fmt = (d) => {
      const p = d.split("-");
      return p[2] + " " + MONTH_NAMES[parseInt(p[1])];
    };
    if (searchFromDate === searchToDate)
      return fmt(searchFromDate) + " " + searchFromDate.slice(0, 4);
    return fmt(searchFromDate) + " – " + fmt(searchToDate) + " " + searchToDate.slice(0, 4);
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
    const dates = Engine.getAvailableDates();
    if (!dates.length) return;

    closeRangePicker();
    closeSearchRangePicker();

    if (smtPeriod === "daily") {
      openSearchRangeDaily(dates);
    } else {
      openSearchRangeGrid(dates);
    }
  }

  function openSearchRangeGrid(dates) {
    let items = [];
    if (smtPeriod === "weekly") {
      items = Object.keys(getWeekMap(dates)).map(k => ({ key: k, label: "W" + k.split("-W")[1], fullLabel: "W" + k.split("-W")[1] + " " + k.split("-W")[0] }));
    } else {
      items = Object.keys(getMonthMap(dates)).map(k => ({ key: k, label: MONTH_NAMES[parseInt(k.slice(5, 7))], fullLabel: MONTH_NAMES[parseInt(k.slice(5, 7))] + " " + k.slice(0, 4) }));
    }

    const wMap = smtPeriod === "weekly" ? getWeekMap(dates) : null;
    const mMap = smtPeriod === "monthly" ? getMonthMap(dates) : null;

    function keyForDate(d) {
      if (smtPeriod === "weekly") return d.slice(0, 4) + "-W" + KPI.getISOWeek(d);
      return d.slice(0, 7);
    }

    let pickStart = Math.max(0, items.length - 7);
    let pickEnd = items.length - 1;
    if (searchFromDate && searchToDate) {
      const fk = keyForDate(searchFromDate), tk = keyForDate(searchToDate);
      const si = items.findIndex(i => i.key === fk);
      const ei = items.findIndex(i => i.key === tk);
      if (si !== -1 && ei !== -1) { pickStart = si; pickEnd = ei; }
    }
    let clickPhase = 0;

    const popup = document.createElement("div");
    popup.className = "range-picker-popup";
    popup.addEventListener("click", e => e.stopPropagation());
    popup.addEventListener("wheel", e => { e.preventDefault(); document.querySelector(".page-content")?.scrollBy({ top: e.deltaY }); }, { passive: false });

    function renderGrid() {
      const hint = clickPhase === 0 ? "Pilih awal rentang" : "Pilih akhir rentang";
      const fromLabel = items[pickStart] ? items[pickStart].fullLabel : "—";
      const toLabel = clickPhase === 0 && items[pickEnd] ? items[pickEnd].fullLabel : "—";
      popup.innerHTML = `
        <div class="range-picker-header">
          <span class="range-picker-title">${hint}</span>
          <button class="range-picker-close" id="srpClose">×</button>
        </div>
        <div class="range-daily-summary">
          <div class="range-daily-summary-field ${clickPhase === 0 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Dari</div>
            <div class="range-daily-summary-val">${fromLabel}</div>
          </div>
          <div class="range-daily-summary-arrow">→</div>
          <div class="range-daily-summary-field ${clickPhase === 1 ? "is-active" : ""}">
            <div class="range-daily-summary-label">Sampai</div>
            <div class="range-daily-summary-val">${toLabel}</div>
          </div>
        </div>
        <div class="range-picker-grid" id="srpGrid"></div>
        <div class="range-picker-footer">
          <button class="range-picker-reset" id="srpReset">Reset</button>
          <button class="range-picker-apply" id="srpApply" ${clickPhase === 1 ? "disabled" : ""}>Terapkan</button>
        </div>
      `;

      const grid = popup.querySelector("#srpGrid");
      items.forEach((item, idx) => {
        const inRange = idx >= pickStart && idx <= pickEnd;
        const isEndpoint = idx === pickStart || (clickPhase === 0 && idx === pickEnd);
        const cell = document.createElement("div");
        cell.className = "range-picker-cell" + (inRange ? " in-range" : "") + (isEndpoint ? " is-start" : "");
        cell.textContent = item.label;
        cell.addEventListener("click", () => {
          if (clickPhase === 0) {
            pickStart = idx; pickEnd = idx; clickPhase = 1;
          } else {
            pickStart = Math.min(pickStart, idx);
            pickEnd = Math.max(pickStart, idx);
            clickPhase = 0;
          }
          renderGrid();
        });
        grid.appendChild(cell);
      });

      popup.querySelector("#srpClose").addEventListener("click", closeSearchRangePicker);
      popup.querySelector("#srpReset").addEventListener("click", () => {
        initSmtDefaultRange();
        closeSearchRangePicker();
        renderSearchResult();
      });
      popup.querySelector("#srpApply").addEventListener("click", () => {
        const selKeys = items.slice(pickStart, pickEnd + 1).map(i => i.key);
        const map = smtPeriod === "weekly" ? wMap : mMap;
        const allDates = selKeys.flatMap(k => map[k] || []);
        if (allDates.length) {
          searchFromDate = allDates[0];
          searchToDate = allDates[allDates.length - 1];
        }
        closeSearchRangePicker();
        renderSearchResult();
      });
    }

    renderGrid();
    document.body.appendChild(popup);

    function positionPopup() {
      const btn = document.getElementById("searchRangeBtn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      popup.style.top = rect.bottom + 6 + "px";
      popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 300 - 32)) + "px";
    }
    positionPopup();
    _srScrollListener = positionPopup;
    const sc = document.querySelector(".page-content");
    if (sc) sc.addEventListener("scroll", _srScrollListener);
    popup.addEventListener("scroll", _srScrollListener, true);
    _srDocListener = () => closeSearchRangePicker();
    setTimeout(() => document.addEventListener("click", _srDocListener), 0);
  }

  function openSearchRangeDaily(dates) {
    const availSet = new Set(dates);
    const allMonths = [...new Set(dates.map(d => d.slice(0, 7)))];

    let fromDate = searchFromDate || dates[dates.length - 1];
    let toDate = searchToDate || dates[dates.length - 1];
    let clickPhase = 0;
    let srCalMonth = fromDate.slice(0, 7);

    const popup = document.createElement("div");
    popup.className = "range-picker-popup range-picker-daily";
    popup.addEventListener("click", e => e.stopPropagation());
    popup.addEventListener("wheel", e => { e.preventDefault(); document.querySelector(".page-content")?.scrollBy({ top: e.deltaY }); }, { passive: false });

    function fmtD(d) {
      if (!d) return "—";
      const p = d.split("-");
      return p[2] + " " + MONTH_NAMES[parseInt(p[1])] + " " + p[0];
    }

    function renderPopup() {
      const hint = clickPhase === 0 ? "Pilih tanggal mulai" : "Pilih tanggal akhir";
      popup.innerHTML = `
        <div class="range-picker-header">
          <span class="range-picker-title">${hint}</span>
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

      popup.querySelector("#srpClose").addEventListener("click", closeSearchRangePicker);
      popup.querySelector("#srpReset").addEventListener("click", () => {
        initSmtDefaultRange();
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
      const from = fromDate && toDate ? (fromDate <= toDate ? fromDate : toDate) : fromDate;
      const to = fromDate && toDate ? (fromDate <= toDate ? toDate : fromDate) : null;

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
        srCalMonth = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0");
        renderSrCalPanel(panel);
      });
      panel.querySelector("#srpCalNext").addEventListener("click", () => {
        const [y, m] = srCalMonth.split("-").map(Number);
        const next = new Date(y, m, 1);
        srCalMonth = next.getFullYear() + "-" + String(next.getMonth() + 1).padStart(2, "0");
        renderSrCalPanel(panel);
      });

      const grid = panel.querySelector("#srpCalGrid");
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
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = srCalMonth + "-" + String(d).padStart(2, "0");
        const available = availSet.has(dateStr);
        const inRange = from && to && dateStr >= from && dateStr <= to;
        const isEndpoint = dateStr === fromDate || dateStr === toDate;

        const cell = document.createElement("div");
        cell.className = "range-cal-cell" + (available ? " available" : "") + (inRange ? " in-range" : "") + (isEndpoint ? " is-endpoint" : "");
        cell.innerHTML = `<span>${d}</span>`;

        if (available) {
          cell.addEventListener("click", () => {
            if (clickPhase === 0) { fromDate = dateStr; toDate = null; clickPhase = 1; }
            else { toDate = dateStr; if (toDate < fromDate) { const tmp = fromDate; fromDate = toDate; toDate = tmp; } clickPhase = 0; }
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
      popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 270 - 32)) + "px";
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
    const indices = selectedMaterials.map(m => m.idx);
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

  function _smtPrecompute(matIndices, dates, filters) {
    const matSet = new Set(matIndices);
    const lookups = Engine.getLookups();
    const matchingMats = new Set();
    const matDate = new Map();
    const bahanDate = new Map();

    const rows = Engine.getRowsForDates(dates);
    rows.forEach(r => {
      const dept = lookups.dept[r[0]], pv = lookups.pv[r[1]],
            mvt = lookups.mvt[r[5]], sloc = lookups.sloc[r[9]];

      if (mvt === "BAHAN" && (filters.dept === "All" || dept === filters.dept)) {
        const pvF = filters.pv;
        let ok = false;
        if (pvF === "All" || pvF === "AYAM BARU") { if (pv === "AYAM BARU" && sloc === "STAGING RM") ok = true; }
        if (pvF === "All" || pvF === "AYAM LAMA") { if (pv === "AYAM LAMA" && (sloc === "CRP" || sloc === "REPRO")) ok = true; }
        if (pvF === "All" || pvF === "AYAM PROSES") { if (pv === "AYAM PROSES") ok = true; }
        if (ok) bahanDate.set(r[8], (bahanDate.get(r[8]) || 0) + r[7]);
      }

      if (!matSet.has(r[4])) return;
      if (filters.dept !== "All" && dept !== filters.dept) return;
      if (filters.pv !== "All" && pv !== filters.pv) return;
      if (filters.mvt !== "All" && mvt !== filters.mvt) return;

      matchingMats.add(r[4]);
      const key = r[4] + "|" + r[8];
      const cur = matDate.get(key);
      if (cur) { cur.brd += r[6]; cur.kg += r[7]; }
      else matDate.set(key, { brd: r[6], kg: r[7] });
    });

    return { matchingMats, matDate, bahanDate };
  }

  function _smtMatVal(pre, matIdx, periodDates, metric) {
    let total = 0;
    for (const d of periodDates) {
      const v = pre.matDate.get(matIdx + "|" + d);
      if (v) total += metric === "brd" ? v.brd : v.kg;
    }
    return total;
  }

  function _smtBahan(pre, periodDates) {
    let total = 0;
    for (const d of periodDates) total += pre.bahanDate.get(d) || 0;
    return total;
  }

  function getSmtPeriodColumns(dates) {
    if (smtPeriod === "daily") {
      let prevMo = null;
      return dates.map(d => {
        const p = d.split("-");
        const mo = parseInt(p[1]);
        const label = mo !== prevMo ? MONTH_NAMES[mo] : "";
        prevMo = mo;
        return { key: d, label, fullLabel: p[2] + " " + MONTH_NAMES[mo], dates: [d] };
      });
    } else if (smtPeriod === "weekly") {
      const weekMap = getWeekMap(dates);
      return Object.keys(weekMap).map(wk => ({
        key: wk,
        label: "W" + wk.split("-W")[1],
        fullLabel: "W" + wk.split("-W")[1] + " " + wk.split("-W")[0],
        dates: weekMap[wk],
      }));
    } else {
      const monthMap = getMonthMap(dates);
      return Object.keys(monthMap).map(ym => ({
        key: ym,
        label: MONTH_NAMES[parseInt(ym.slice(5, 7))],
        fullLabel: MONTH_NAMES[parseInt(ym.slice(5, 7))] + " " + ym.slice(0, 4),
        dates: monthMap[ym],
      }));
    }
  }

  function smtGetCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  const SMT_COLORS = ["#4d9eff", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#38bdf8", "#e879f9", "#f87171", "#2dd4bf"];

  function destroySmtCharts() {
    smtChartInstances.forEach(c => c.destroy());
    smtChartInstances = [];
  }

  function renderSearchResult() {
    const tagsEl = document.getElementById("matTags");
    const chartsContainer = document.getElementById("smtChartsContainer");
    const chartEmpty = document.getElementById("smtChartEmpty");

    // Sync range button label and prev/next state
    const rangeBtn = document.getElementById("searchRangeBtn");
    if (rangeBtn) rangeBtn.textContent = fmtSearchRange();
    const allDates = Engine.getAvailableDates();
    const fromIdx = allDates.indexOf(searchFromDate);
    const toIdx = allDates.indexOf(searchToDate);
    const prevBtnEl = document.getElementById("searchRangePrev");
    const nextBtnEl = document.getElementById("searchRangeNext");
    if (prevBtnEl) prevBtnEl.disabled = fromIdx <= 0;
    if (nextBtnEl) nextBtnEl.disabled = toIdx >= allDates.length - 1;

    // Update % toggle visibility
    const pctBtn = document.getElementById("smtPctBtn");
    if (pctBtn) {
      if (searchFilters.mvt === "HASIL") {
        pctBtn.style.display = "";
      } else {
        pctBtn.style.display = "none";
        if (smtMetric === "pct") {
          smtMetric = "brd";
          document.querySelectorAll("#smtMetricToggle .toggle-btn").forEach(b => b.classList.toggle("active", b.dataset.metric === "brd"));
        }
      }
    }

    // Show combine/breakdown button only when 2+ materials selected and MVT is set
    const combineBtn = document.getElementById("smtCombineBtn");
    if (combineBtn) {
      const showCombine = selectedMaterials.length >= 2 && searchFilters.mvt !== "All";
      combineBtn.style.display = showCombine ? "" : "none";
      combineBtn.textContent = smtCombined ? "Breakdown Chart" : "Combine Chart";
      if (!showCombine) smtCombined = true;
    }

    if (!selectedMaterials.length) {
      tagsEl.innerHTML = '<span class="material-tags-placeholder">Pilih material untuk ditampilkan</span>';
      destroySmtCharts();
      chartsContainer.innerHTML = "";
      chartEmpty.style.display = "";
      chartEmpty.textContent = "Pilih material untuk ditampilkan";
      return;
    }

    const dates = getSearchDates();
    updateSearchFilterOptions();

    // Precompute to know which materials match current filters
    const matIndices = selectedMaterials.map(m => m.idx);
    const pre = _smtPrecompute(matIndices, dates, searchFilters);

    // Render tags with dimming + clear buttons
    const hasDimmed = selectedMaterials.some(m => !pre.matchingMats.has(m.idx));
    tagsEl.innerHTML =
      selectedMaterials.map((mat, i) => {
        const matches = pre.matchingMats.has(mat.idx);
        const color = SMT_COLORS[i % SMT_COLORS.length];
        return `<span class="material-tag ${matches ? "" : "dimmed"}" data-i="${i}">
          <span style="background:${color};width:8px;height:8px;display:inline-block;border-radius:50%;margin-right:4px;flex-shrink:0"></span>
          ${mat.matdesc}
          <span class="material-tag-remove" data-i="${i}">×</span>
        </span>`;
      }).join("") +
      (hasDimmed ? `<button class="material-tags-clear-dimmed" id="matClearDimmed">Clear Unmatched</button>` : "") +
      `<button class="material-tags-clear-all" id="matClearAll">Clear All</button>`;

    tagsEl.querySelectorAll(".material-tag-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const i = parseInt(btn.dataset.i);
        selectedMaterials.splice(i, 1);
        if (selectedMaterials.length) {
          const indices = selectedMaterials.map(m => m.idx);
          const d = getSearchDates();
          const opts = Engine.getMaterialFilterOptionsRange(indices, d, { dept: "All", pv: "All", mvt: "All" });
          if (searchFilters.dept !== "All" && !opts.depts.includes(searchFilters.dept)) {
            searchFilters.dept = "All";
            searchFilters.pv = "All";
            searchFilters.mvt = "All";
          } else {
            const opts2 = Engine.getMaterialFilterOptionsRange(indices, d, searchFilters);
            if (searchFilters.pv !== "All" && !opts2.pvs.includes(searchFilters.pv)) {
              searchFilters.pv = "All";
              searchFilters.mvt = "All";
            } else if (searchFilters.mvt !== "All" && !opts2.mvts.includes(searchFilters.mvt)) {
              searchFilters.mvt = "All";
            }
          }
        } else {
          searchFilters = { dept: "All", pv: "All", mvt: "All" };
        }
        updateSearchFilterOptions();
        renderSearchResult();
      });
    });

    const clearDimmedBtn = document.getElementById("matClearDimmed");
    if (clearDimmedBtn) {
      clearDimmedBtn.addEventListener("click", e => {
        e.stopPropagation();
        const d = getSearchDates();
        for (let i = selectedMaterials.length - 1; i >= 0; i--) {
          if (!Engine.materialMatchesFilterRange(selectedMaterials[i].idx, searchFilters, d)) {
            selectedMaterials.splice(i, 1);
          }
        }
        updateSearchFilterOptions();
        renderSearchResult();
      });
    }

    document.getElementById("matClearAll").addEventListener("click", e => {
      e.stopPropagation();
      selectedMaterials.length = 0;
      searchFilters = { dept: "All", pv: "All", mvt: "All" };
      updateSearchFilterOptions();
      renderSearchResult();
    });

    // Chart only renders when MVT is filled
    if (searchFilters.mvt === "All") {
      destroySmtCharts();
      chartsContainer.innerHTML = "";
      chartEmpty.style.display = "";
      chartEmpty.textContent = "Pilih MVT untuk menampilkan chart";
      return;
    }

    // Build chart data
    const columns = getSmtPeriodColumns(dates);
    if (!columns.length) {
      destroySmtCharts();
      chartsContainer.innerHTML = "";
      chartEmpty.style.display = "";
      chartEmpty.textContent = "Tidak ada data untuk range ini";
      return;
    }

    // Only chart materials that match current filters
    const matchedMaterials = selectedMaterials.filter(m => pre.matchingMats.has(m.idx));
    if (!matchedMaterials.length) {
      destroySmtCharts();
      chartsContainer.innerHTML = "";
      chartEmpty.style.display = "";
      chartEmpty.textContent = "Tidak ada material yang cocok dengan filter";
      return;
    }

    chartEmpty.style.display = "none";
    destroySmtCharts();

    const xLabels = columns.map(c => c.label);
    const fullLabels = columns.map(c => c.fullLabel || c.label);

    function fmtTickVal(v) {
      if (smtMetric === "pct") return v.toFixed(1) + "%";
      return v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toLocaleString("id-ID", { maximumFractionDigits: 1 });
    }

    if (smtCombined) {
      renderCombinedChart(chartsContainer, matchedMaterials, columns, xLabels, fullLabels, pre, fmtTickVal);
    } else {
      renderIndependentCharts(chartsContainer, matchedMaterials, columns, xLabels, fullLabels, pre, fmtTickVal);
    }
  }

  function renderCombinedChart(container, mats, columns, xLabels, fullLabels, pre, fmtTickVal) {
    const LINE_COLOR = "#4d9eff";
    const totalValues = columns.map((col, ci) => {
      let sum = 0;
      mats.forEach(mat => {
        if (smtMetric === "pct") {
          const matKg = _smtMatVal(pre, mat.idx, col.dates, "kg");
          const bahanKg = _smtBahan(pre, col.dates);
          sum += bahanKg > 0 ? (matKg / bahanKg) * 100 : 0;
        } else {
          sum += _smtMatVal(pre, mat.idx, col.dates, smtMetric);
        }
      });
      return sum;
    });

    const mn = Math.min(0, ...totalValues);
    const mx = Math.max(...totalValues);
    const pad = (mx - mn) * 0.1 || 1;

    container.innerHTML = `
      <div class="smt-chart-block">
        <div class="smt-chart-legend">
          <div class="smt-legend-date" id="smtCombDate"></div>
          <div class="smt-legend-item" style="font-weight:600">
            <span class="smt-legend-dot" style="background:${LINE_COLOR}"></span>
            <span class="smt-legend-name" style="max-width:none">Total (${mats.length} material)</span>
            <span class="smt-legend-val" id="smtCombValTotal" style="color:${LINE_COLOR}">—</span>
          </div>
        </div>
        <div class="smt-chart-wrap" style="display:block;height:240px">
          <canvas id="smtCombCanvas"></canvas>
        </div>
      </div>`;

    let hoverIdx = columns.length - 1;

    const crosshairPlugin = {
      id: "smtCrosshair",
      afterDatasetsDraw(chart) {
        const ca = chart.chartArea; if (!ca) return;
        const meta = chart.getDatasetMeta(0);
        const si = Math.max(0, Math.min(meta.data.length - 1, hoverIdx));
        const pt = meta.data[si]; if (!pt) return;
        const ctx = chart.ctx;

        ctx.save();
        ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pt.x, ca.top); ctx.lineTo(pt.x, ca.bottom); ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = LINE_COLOR; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();

        const tel = document.getElementById("smtCombValTotal");
        if (tel) tel.textContent = smtMetric === "pct" ? totalValues[si].toFixed(2) + "%" : totalValues[si].toLocaleString("id-ID", { maximumFractionDigits: 2 });
        const dateEl = document.getElementById("smtCombDate");
        if (dateEl) dateEl.textContent = fullLabels[si] || "";
      }
    };

    const chartCanvas = document.getElementById("smtCombCanvas");
    const chartInst = new Chart(chartCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels: xLabels,
        datasets: [{
          data: totalValues,
          borderColor: LINE_COLOR,
          borderWidth: 1.5,
          backgroundColor: LINE_COLOR + "15",
          fill: true,
          tension: 0.15,
          pointRadius: 0,
          pointHoverRadius: 0,
        }],
      },
      plugins: [crosshairPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: "easeInOutQuart" },
        events: [],
        layout: { padding: { top: 10, bottom: 8, left: 4, right: 8 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: smtGetCSSVar("--text-muted"),
              font: { family: "JetBrains Mono", size: 9, weight: "600" },
              maxRotation: 0, padding: 0, autoSkip: smtPeriod !== "daily",
            },
          },
          y: {
            min: mn - pad, max: mx + pad,
            grid: { color: smtGetCSSVar("--border-light"), lineWidth: 0.5 },
            border: { display: false },
            ticks: {
              color: smtGetCSSVar("--text-muted"),
              font: { family: "JetBrains Mono", size: 9 },
              callback: v => fmtTickVal(v), maxTicksLimit: 8,
            },
          },
        },
      },
    });
    smtChartInstances.push(chartInst);

    function getIdx(mouseX) {
      const ca = chartInst.chartArea; if (!ca) return 0;
      if (columns.length <= 1) return 0;
      return Math.max(0, Math.min(columns.length - 1, Math.round((mouseX - ca.left) / ((ca.right - ca.left) / (columns.length - 1)))));
    }

    const wrap = chartCanvas.parentElement;
    let ready = false;
    let raf = false;
    setTimeout(() => { ready = true; chartInst.draw(); }, 620);
    wrap.style.pointerEvents = "auto";
    wrap.addEventListener("mousemove", e => {
      if (!ready) return;
      const mx = e.clientX - chartCanvas.getBoundingClientRect().left;
      const ni = getIdx(mx);
      if (ni !== hoverIdx) { hoverIdx = ni; if (!raf) { raf = true; requestAnimationFrame(() => { raf = false; chartInst.draw(); }); } }
    }, { passive: true });
    wrap.addEventListener("touchmove", e => {
      if (!ready) return;
      const mx = e.touches[0].clientX - chartCanvas.getBoundingClientRect().left;
      const ni = getIdx(mx);
      if (ni !== hoverIdx) { hoverIdx = ni; if (!raf) { raf = true; requestAnimationFrame(() => { raf = false; chartInst.draw(); }); } }
    }, { passive: true });
  }

  function renderIndependentCharts(container, mats, columns, xLabels, fullLabels, pre, fmtTickVal) {
    container.innerHTML = mats.map((mat, i) => {
      const origIdx = selectedMaterials.indexOf(mat);
      const color = SMT_COLORS[origIdx % SMT_COLORS.length];
      return `<div class="smt-chart-block" data-mat-i="${i}">
        <div class="smt-chart-legend">
          <div class="smt-legend-date" id="smtLvDate${i}"></div>
          <div class="smt-legend-item">
            <span class="smt-legend-dot" style="background:${color}"></span>
            <span class="smt-legend-name" style="max-width:none">${mat.matdesc}</span>
            <span class="smt-legend-val" id="smtLvVal${i}" style="color:${color}">—</span>
          </div>
        </div>
        <div class="smt-chart-wrap" style="display:block">
          <canvas id="smtChartCanvas${i}"></canvas>
        </div>
      </div>`;
    }).join("");

    mats.forEach((mat, i) => {
      const origIdx = selectedMaterials.indexOf(mat);
      const color = SMT_COLORS[origIdx % SMT_COLORS.length];

      const values = columns.map(col => {
        if (smtMetric === "pct") {
          const matKg = _smtMatVal(pre, mat.idx, col.dates, "kg");
          const bahanKg = _smtBahan(pre, col.dates);
          return bahanKg > 0 ? (matKg / bahanKg) * 100 : 0;
        }
        return _smtMatVal(pre, mat.idx, col.dates, smtMetric);
      });

      const mn = Math.min(0, ...values);
      const mx = Math.max(...values);
      const pad = (mx - mn) * 0.1 || 1;

      let hoverIdx = columns.length - 1;

      const crosshairPlugin = {
        id: "smtCrosshair" + i,
        afterDatasetsDraw(chart) {
          const ca = chart.chartArea; if (!ca) return;
          const meta = chart.getDatasetMeta(0);
          const si = Math.max(0, Math.min(meta.data.length - 1, hoverIdx));
          const pt = meta.data[si]; if (!pt) return;
          const ctx = chart.ctx;

          ctx.save();
          ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(pt.x, ca.top); ctx.lineTo(pt.x, ca.bottom); ctx.stroke();
          ctx.setLineDash([]);

          ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.restore();

          const lvEl = document.getElementById("smtLvVal" + i);
          if (lvEl) lvEl.textContent = smtMetric === "pct" ? values[si].toFixed(2) + "%" : values[si].toLocaleString("id-ID", { maximumFractionDigits: 2 });
          const dateEl = document.getElementById("smtLvDate" + i);
          if (dateEl) dateEl.textContent = fullLabels[si] || "";
        }
      };

      const chartCanvas = document.getElementById("smtChartCanvas" + i);
      const chartInst = new Chart(chartCanvas.getContext("2d"), {
        type: "line",
        data: {
          labels: xLabels,
          datasets: [{
            data: values,
            borderColor: color,
            borderWidth: 1.5,
            backgroundColor: color + "15",
            fill: true,
            tension: 0.15,
            pointRadius: 0,
            pointHoverRadius: 0,
          }],
        },
        plugins: [crosshairPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 600, easing: "easeInOutQuart" },
          events: [],
          layout: { padding: { top: 10, bottom: 8, left: 4, right: 8 } },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: {
                color: smtGetCSSVar("--text-muted"),
                font: { family: "JetBrains Mono", size: 9, weight: "600" },
                maxRotation: 0, padding: 0, autoSkip: smtPeriod !== "daily",
              },
            },
            y: {
              min: mn - pad, max: mx + pad,
              grid: { color: smtGetCSSVar("--border-light"), lineWidth: 0.5 },
              border: { display: false },
              ticks: {
                color: smtGetCSSVar("--text-muted"),
                font: { family: "JetBrains Mono", size: 9 },
                callback: v => fmtTickVal(v), maxTicksLimit: 5,
              },
            },
          },
        },
      });
      smtChartInstances.push(chartInst);

      function getIdx(mouseX) {
        const ca = chartInst.chartArea; if (!ca) return 0;
        if (columns.length <= 1) return 0;
        return Math.max(0, Math.min(columns.length - 1, Math.round((mouseX - ca.left) / ((ca.right - ca.left) / (columns.length - 1)))));
      }

      const wrap = chartCanvas.parentElement;
      let ready = false;
      let raf = false;
      setTimeout(() => { ready = true; chartInst.draw(); }, 620);
      wrap.style.pointerEvents = "auto";
      wrap.addEventListener("mousemove", e => {
        if (!ready) return;
        const mx = e.clientX - chartCanvas.getBoundingClientRect().left;
        const ni = getIdx(mx);
        if (ni !== hoverIdx) { hoverIdx = ni; if (!raf) { raf = true; requestAnimationFrame(() => { raf = false; chartInst.draw(); }); } }
      }, { passive: true });
      wrap.addEventListener("touchmove", e => {
        if (!ready) return;
        const mx = e.touches[0].clientX - chartCanvas.getBoundingClientRect().left;
        const ni = getIdx(mx);
        if (ni !== hoverIdx) { hoverIdx = ni; if (!raf) { raf = true; requestAnimationFrame(() => { raf = false; chartInst.draw(); }); } }
      }, { passive: true });
    });
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
