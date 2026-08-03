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
  // ── Trafic bahan per jam (TTA) ──
  let trafficDate = null;
  let trafficMetric = "brd";
  let trafficDays = {}; // 'YYYY-MM-DD' -> [[24 ekor], [24 kg]]
  let trafficDates = []; // tanggal tersedia, terurut
  let _trafficChart = null;
  let _trafficNav = null;
  let _trafficActive = -1; // batang yang sedang ditunjuk (-1 = tidak ada)
  let _trafficPinned = false; // true kalau dikunci lewat klik
  let _trafficDefault = -1; // jam terpadat — posisi label saat tidak di-hover
  let trafficDetailOpen = false; // matriks Material × Jam menggantikan grafik
  let trafficDeptMap = false; // arsir warna departemen tujuan di tiap sel

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

      <!-- SECTION 3: Trafic Bahan (kiri) + Search Material (kanan), 50/50 -->
      <div class="section" id="sectionTrafficSearch">
        <div class="section-split">
          <!-- Kiri: Trafic Bahan per Jam (data TTA) -->
          <div class="split-panel" id="trafficPanel">
            <!-- Pembungkus isi. Panel-nya sendiri teregang mengikuti tinggi
                 Search Material di sebelahnya, jadi spotlight What's New
                 menyorot elemen ini supaya tidak ikut menutupi ruang kosong
                 di bawah grafik. -->
            <div id="trafficBody">
              <div class="split-panel-header">
                <div class="traffic-title-row">
                  <div class="split-panel-title">Trafic Bahan Karkas</div>
                  <button type="button" class="traffic-detail-btn" id="trafficDetailBtn" aria-expanded="false">
                    <span class="traffic-detail-sign" id="trafficDetailSign" aria-hidden="true">+</span>
                    <span id="trafficDetailLabel">Detail data</span>
                  </button>
                </div>
                <div class="traffic-header-controls">
                  <div class="toggle-group" id="trafficToggle">
                    <button class="toggle-btn active" data-metric="brd">BRD</button>
                    <button class="toggle-btn" data-metric="kg">KG</button>
                  </div>
                  <div id="trafficDateNav"></div>
                  <!-- Hanya muncul di mode detail (disembunyikan lewat CSS). -->
                  <button type="button" class="traffic-detail-btn traffic-dept-btn" id="trafficDeptBtn" aria-pressed="false">
                    Map dept color
                  </button>
                </div>
              </div>
              <div class="traffic-summary" id="trafficSummary">
                <span class="traffic-skel-pill"></span>
              </div>
              <div class="chart-wrap" id="trafficWrap" style="height:220px;position:relative;">
                <canvas id="trafficChart"></canvas>
                <div class="traffic-skel" id="trafficSkeleton">${TRAFFIC_SKELETON}</div>
              </div>
              <!-- Tampilan detail: matriks Material × Jam. Menggantikan
                   ringkasan + grafik saat tombol "Detail data" ditekan;
                   navigasi tanggal dan toggle BRD/KG di atasnya tetap yang
                   sama, hanya ditukar urutannya lewat CSS. -->
              <div class="traffic-detail" id="trafficDetail" hidden></div>
            </div>
          </div>
          <!-- Kanan: Search Material -->
          <div class="split-panel" id="searchPanel">
            <div class="split-panel-header">
              <div class="split-panel-title">Search Material</div>
              <div class="smt-header-controls" id="smtHeaderControls"></div>
            </div>
            <div id="searchContainer"></div>
          </div>
        </div>
      </div>
    `;

    initKpiSection();
    initCalendar();
    initBahanChart();
    initTrafficChart();
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
    // Pembanding warna adalah hari PRODUKSI terakhir, bukan tanggal kalender
    // sebelumnya. Hari libur dilewati (bukan dihitung nol, yang bikin hari
    // sesudahnya selalu hijau), dan disemai dari bulan sebelumnya supaya
    // tanggal 1 tidak selalu netral.
    let lastCount = calData.prevCount ?? null;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = calMonth + "-" + String(d).padStart(2, "0");
      const count = calData.days[dateStr] || 0;
      const prevCount = lastCount;
      if (count) lastCount = count;
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

    document.addEventListener("click", (e) => {
      const wrap = document.getElementById("chartWrap");
      const pop = document.getElementById("bahanPopover");
      if (pop && pop.contains(e.target)) return;
      if (!wrap || !wrap.contains(e.target)) closeBahanPopover();
    });
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

  let _chartBarDetails = [];

  function closeBahanPopover(skipRedraw) {
    const old = document.getElementById("bahanPopover");
    if (old) old.remove();
    Charts.highlightState["bahanChart"] = -1;
    if (!skipRedraw) {
      const chart = Charts.instances["bahanChart"];
      if (chart) chart.draw();
    }
  }

  function showBahanPopover(bi, barMeta) {
    const old = document.getElementById("bahanPopover");
    if (old) old.remove();
    if (bi < 0 || !barMeta || !_chartBarDetails[bi]) return;

    const detail = _chartBarDetails[bi];
    const isKg = chartMetric === "kg";
    const deptColors = {
      "CUT UP": "#34d399",
      BONELESS: "#60a5fa",
      AU: "#fbbf24",
      PARTING: "#f472b6",
    };

    let total = 0;
    const rows = Object.keys(deptColors).map((dept) => {
      const val = detail[dept] || 0;
      total += val;
      return { dept, val, color: deptColors[dept] };
    });

    const fmtVal = (v) =>
      isKg
        ? v.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " KG"
        : Math.round(v).toLocaleString("id-ID") + " BRD";

    const pop = document.createElement("div");
    pop.id = "bahanPopover";
    pop.className = "bahan-popover";
    pop.innerHTML =
      `<div class="bahan-popover-title">${barMeta.label}</div>` +
      rows
        .map(
          (r) =>
            `<div class="bahan-popover-row">
              <span class="bahan-popover-dot" style="background:${r.color}"></span>
              <span class="bahan-popover-dept">${r.dept}</span>
              <span class="bahan-popover-val">${fmtVal(r.val)}</span>
            </div>`,
        )
        .join("") +
      `<div class="bahan-popover-total">
        <span>TOTAL</span>
        <span class="bahan-popover-val">${fmtVal(total)}</span>
      </div>`;

    document.body.appendChild(pop);

    const EDGE = 8;
    const GAP = 16;
    const popW = pop.offsetWidth;
    const popH = pop.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = barMeta.x + GAP;
    let top = barMeta.y - 20;

    if (left + popW > vw - EDGE) left = barMeta.x - popW - GAP;
    if (left < EDGE) left = EDGE;
    if (top + popH > vh - EDGE) top = vh - EDGE - popH;
    if (top < EDGE) top = EDGE;

    pop.style.left = left + "px";
    pop.style.top = top + "px";
    pop.style.opacity = "1";
  }

  function renderBahanChart() {
    closeBahanPopover(true);
    const dates = Engine.getAvailableDates();
    if (!dates.length) return;

    const MAX = 7;
    let labels = [],
      dataByDept = { "CUT UP": [], BONELESS: [], AU: [], PARTING: [] };
    _chartBarDetails = [];
    let rangeFirst = null, rangeLast = null;

    if (chartPeriod === "daily") {
      const range = chartSelectedItems
        ? dates.filter((d) => chartSelectedItems.includes(d))
        : dates.slice(-MAX);
      const dist = Engine.getBahanDistribution(range, chartPvMode, chartMetric);
      range.forEach((d) => {
        const parts = d.split("-");
        labels.push(parts[2] + " " + MONTH_NAMES[parseInt(parts[1])]);
        const barDetail = {};
        Object.keys(dataByDept).forEach((dept) => {
          dataByDept[dept].push(dist[d]?.[dept] || 0);
          barDetail[dept] = dist[d]?.[dept] || 0;
        });
        _chartBarDetails.push(barDetail);
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
        const barDetail = {};
        Object.keys(dataByDept).forEach((dept) => {
          let sum = 0;
          weekMap[wk].forEach((d) => {
            sum += dist[d]?.[dept] || 0;
          });
          dataByDept[dept].push(sum);
          barDetail[dept] = sum;
        });
        _chartBarDetails.push(barDetail);
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
        const barDetail = {};
        Object.keys(dataByDept).forEach((dept) => {
          let sum = 0;
          monthMap[mk].forEach((d) => {
            sum += dist[d]?.[dept] || 0;
          });
          dataByDept[dept].push(sum);
          barDetail[dept] = sum;
        });
        _chartBarDetails.push(barDetail);
      });
      if (mKeys.length) { rangeFirst = mKeys[0]; rangeLast = mKeys[mKeys.length - 1]; }
    }

    const datasets = Object.keys(dataByDept).map((dept) => ({
      label: dept,
      data: dataByDept[dept],
    }));

    Charts.buildStackedBar("bahanChart", { labels, datasets }, (bi, barMeta) => {
      if (bi < 0) { closeBahanPopover(); return; }
      showBahanPopover(bi, barMeta);
    });

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
  // SECTION 3: Trafic Bahan per Jam (TTA)
  //
  // Gaya "popular times" Google Maps: 24 batang per jam untuk satu tanggal,
  // dengan garis rata-rata bulan berjalan sebagai pembanding.
  // Aturan: pv 1A01+1A05, material KARKAS, tanggal = Proses Order Date,
  // jam = Create Time.
  // ══════════════════════════════════════
  // Aturan filter (pv 1A01+1A05, material KARKAS) ada di TTATraffic —
  // dipakai bareng oleh chart ini dan pipeline import.

  // Hari produksi mulai jam 07:00 dan berlanjut melewati tengah malam. Baris
  // jam 00–06 dengan Proses Order Date yang sama adalah ekor shift itu, jadi
  // di sumbu X ditaruh setelah jam 23 — bukan di awal.
  // Agregasi tetap memakai jam asli 0–23; urutan ini hanya untuk tampilan.
  const TRAFFIC_HOURS = Array.from({ length: 24 }, (_, i) => (i + 7) % 24);

  // ── Skeleton selagi ringkasan TTA dimuat ──
  // Ringkasannya datang dari jaringan (TTATraffic.getDays), jadi area chart
  // sempat kosong — apalagi kalau Overview baru dibuka dari halaman lain.
  // Tinggi batangnya dipatok, bukan acak, supaya tidak ada kesan angka.
  // Kemunculannya ditunda lewat CSS: kalau datanya sudah di cache, skeleton
  // ini tidak pernah sempat terlihat.
  const TRAFFIC_SKELETON_HEIGHTS = [
    18, 22, 30, 46, 58, 72, 64, 78, 88, 74, 62, 70, 82, 66, 54, 60, 48, 40, 34,
    28, 24, 20, 16, 14,
  ];

  const TRAFFIC_SKELETON = TRAFFIC_SKELETON_HEIGHTS.map(
    (h, i) =>
      `<span class="traffic-skel-bar" style="height:${h}%;animation-delay:${(i % 8) * 90}ms"></span>`,
  ).join("");

  // Skeleton ringkasan (pill) ikut hilang sendiri: renderTrafficSummary dan
  // showTrafficEmpty sama-sama menimpa isi #trafficSummary.
  function hideTrafficSkeleton() {
    document.getElementById("trafficSkeleton")?.classList.add("hide");
  }

  function initTrafficChart() {
    const toggle = document.getElementById("trafficToggle");
    toggle?.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggle
          .querySelectorAll(".toggle-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        trafficMetric = btn.dataset.metric;
        renderTrafficChart();
      });
    });

    initTrafficDetailToggle();

    const nav = DatePicker.createDateNav({
      initialDate: trafficDate,
      onPrev: () => stepTrafficDate(-1),
      onNext: () => stepTrafficDate(1),
    });
    // Kursor keluar dari chart → label hilang, kecuali sedang dikunci lewat
    // klik. Dipasang sekali di sini karena canvas-nya baru dibuat ulang saat
    // halaman di-render ulang, jadi listener tidak menumpuk.
    document
      .getElementById("trafficChart")
      ?.addEventListener("mouseleave", () => {
        if (_trafficPinned || _trafficActive === _trafficDefault) return;
        _trafficActive = _trafficDefault;
        _trafficChart?.draw();
      });

    document.getElementById("trafficDateNav")?.appendChild(nav.el);
    _trafficNav = nav;
    nav.setLabel("memuat…");
    nav.setPrevEnabled(false);
    nav.setNextEnabled(false);

    loadTrafficInitial();
  }

  // Tombol "Detail data" / "Collapse data" di samping judul. Dua tampilan
  // (grafik dan matriks) berbagi satu tanggal + satu metrik, jadi tombolnya
  // cukup membalik state lalu menyerahkan sisanya ke renderTrafficChart.
  function initTrafficDetailToggle() {
    const btn = document.getElementById("trafficDetailBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      trafficDetailOpen = !trafficDetailOpen;
      applyTrafficDetailState();
      renderTrafficChart();
    });

    // Arsiran departemen cuma soal tampilan — datanya sudah ada di tangan,
    // jadi tabelnya digambar ulang seketika tanpa menyentuh jaringan lagi.
    document.getElementById("trafficDeptBtn")?.addEventListener("click", () => {
      trafficDeptMap = !trafficDeptMap;
      applyTrafficDetailState();
      redrawTrafficDetail();
    });

    // Legendanya lahir ulang tiap tabel digambar, jadi kliknya ditangkap di
    // wadahnya — satu listener yang tidak perlu dipasang ulang.
    document.getElementById("trafficDetail")?.addEventListener("click", (e) => {
      const item = e.target.closest(".tdl-item");
      if (!item) return;
      const code = item.dataset.dept;
      if (trafficDeptSel.has(code)) trafficDeptSel.delete(code);
      else trafficDeptSel.add(code);
      redrawTrafficDetail();
    });

    // Overview di-render ulang tiap kali halamannya dibuka, markup-nya selalu
    // lahir dalam keadaan tertutup — samakan dengan state yang masih hidup.
    applyTrafficDetailState();
  }

  function applyTrafficDetailState() {
    const btn = document.getElementById("trafficDetailBtn");
    if (btn) {
      btn.classList.toggle("is-open", trafficDetailOpen);
      btn.setAttribute("aria-expanded", String(trafficDetailOpen));
      const sign = document.getElementById("trafficDetailSign");
      const label = document.getElementById("trafficDetailLabel");
      if (sign) sign.textContent = trafficDetailOpen ? "−" : "+";
      if (label) {
        label.textContent = trafficDetailOpen ? "Collapse data" : "Detail data";
      }
    }
    const deptBtn = document.getElementById("trafficDeptBtn");
    if (deptBtn) {
      deptBtn.classList.toggle("is-open", trafficDeptMap);
      deptBtn.setAttribute("aria-pressed", String(trafficDeptMap));
    }
    document
      .getElementById("trafficBody")
      ?.classList.toggle("detail-open", trafficDetailOpen);
    // Matriks 24 jam butuh ruang lebih dari separuh baris: kelasnya ikut
    // dipasang di section supaya pembagian kolomnya bisa digeser ke 70/30.
    document
      .getElementById("sectionTrafficSearch")
      ?.classList.toggle("detail-open", trafficDetailOpen);
    const detail = document.getElementById("trafficDetail");
    if (!detail) return;
    detail.hidden = !trafficDetailOpen;
    // Dibuka sebelum ringkasan harian sampai dari jaringan: jangan tinggalkan
    // kotak kosong — renderTrafficDetail menimpanya begitu tanggalnya siap.
    if (trafficDetailOpen && !detail.innerHTML) {
      detail.innerHTML = `<div class="traffic-note">memuat rincian material…</div>`;
    }
  }

  async function loadTrafficInitial() {
    try {
      // Satu request ±45 KB berisi SEMUA tanggal — tidak ada lagi unduh per
      // bulan, jadi tombol ‹ › langsung tanpa menunggu jaringan.
      trafficDays = await TTATraffic.getDays((i, n, ym) => {
        _trafficNav?.setLabel(
          "menyiapkan " + KPI.formatMonthYear(ym) + " (" + i + "/" + n + ")…",
        );
      });
      trafficDates = Object.keys(trafficDays).sort();

      if (!trafficDates.length) {
        showTrafficEmpty("Belum ada data TTA — import dulu file TTA-nya");
        return;
      }
      // Pertahankan tanggal yang sedang dilihat kalau halaman di-render ulang.
      if (!trafficDate || !trafficDays[trafficDate]) {
        trafficDate = trafficDates[trafficDates.length - 1];
      }
      renderTrafficChart();
    } catch (err) {
      console.error("[Traffic] gagal memuat ringkasan TTA:", err);
      showTrafficEmpty("Gagal memuat data TTA");
    }
  }

  // Dipanggil setelah import TTA selesai. Panel ini memegang salinan
  // ringkasannya sendiri di `trafficDays`, jadi mengosongkan cache di
  // TTATraffic saja tidak cukup — tanpa ini angka yang tampil masih angka
  // sebelum import sampai halaman dibuka ulang.
  //
  // Hanya panel trafic yang dimuat ulang, bukan seluruh halaman: `trafficDate`,
  // pilihan BRD/KG, dan keadaan buka/tutup matriks sengaja dipertahankan
  // supaya admin yang sedang memeriksa satu tanggal tidak dilempar kembali ke
  // tanggal terakhir.
  function refreshTraffic() {
    // Halaman lain yang sedang terbuka: tidak ada yang perlu digambar. Cache
    // TTATraffic sudah kosong, jadi kunjungan berikutnya mengambil yang baru.
    if (!document.getElementById("trafficBody")) return;
    _trafficDetailRows = null;
    _trafficDetailRowsDate = "";
    return loadTrafficInitial();
  }

  function stepTrafficDate(dir) {
    const next = trafficDates[trafficDates.indexOf(trafficDate) + dir];
    if (!next) return;
    trafficDate = next;
    renderTrafficChart();
  }

  // Ringkasan menyimpan dua metrik berdampingan: index 0 ekor, 1 kg.
  function trafficMetricIdx() {
    return trafficMetric === "kg" ? 1 : 0;
  }

  function peakHour(total) {
    let peak = -1;
    for (let h = 0; h < 24; h++) {
      if (total[h] > 0 && (peak === -1 || total[h] > total[peak])) peak = h;
    }
    return peak;
  }

  function pad2h(h) {
    return (h < 10 ? "0" : "") + h;
  }

  // Nilai penuh dengan pemisah ribuan — sengaja bukan KPI.fmtShort, karena
  // label ini harus menunjukkan angka asli, bukan singkatan "6,3K".
  function trafficFmtFull(v) {
    return Math.round(v).toLocaleString("id-ID");
  }

  // Pengganti tooltip: label kecil di atas area chart, disambung ke batang
  // yang di-hover/klik lewat garis putus-putus vertikal. Labelnya digambar di
  // strip padding atas (lihat layout.padding.top) supaya tidak menimpa batang.
  const LABEL_H = 21;
  const LABEL_GAP = 5;

  const trafficMarkerPlugin = {
    id: "trafficMarker",
    afterDatasetsDraw(chart) {
      const i = _trafficActive;
      if (i < 0) return;

      const bar = chart.getDatasetMeta(1).data[i];
      if (!bar) return;

      const ctx = chart.ctx;
      const area = chart.chartArea;
      const value = chart.data.datasets[1].data[i] || 0;
      const text =
        trafficFmtFull(value) + " " + (trafficMetric === "kg" ? "kg" : "ekor");

      ctx.save();
      ctx.font = "700 11px 'JetBrains Mono'";

      const tw = ctx.measureText(text).width;
      const by = area.top - LABEL_H - LABEL_GAP;
      // Jaga label tetap di dalam area walau batangnya di tepi kiri/kanan.
      const cx = Math.max(
        area.left + tw / 2,
        Math.min(bar.x, area.right - tw / 2),
      );

      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(59,125,221,0.6)";
      ctx.lineWidth = 1;
      ctx.moveTo(bar.x, by + LABEL_H);
      ctx.lineTo(bar.x, bar.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tanpa kotak latar — teks abu-abu gelap langsung di atas background.
      ctx.fillStyle = "#4a4f6a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, cx, by + LABEL_H / 2 + 0.5);
      ctx.restore();
    },
  };

  function renderTrafficChart() {
    if (!trafficDate) return;
    hideTrafficSkeleton();

    const mi = trafficMetricIdx();
    const day = { total: trafficDays[trafficDate]?.[mi] || new Array(24).fill(0) };

    // Rata-rata bulan berjalan sebagai pembanding.
    const ym = trafficDate.slice(0, 7);
    const monthDates = trafficDates.filter((d) => d.startsWith(ym));
    const avg = new Array(24).fill(0);
    if (monthDates.length) {
      for (const d of monthDates) {
        const rec = trafficDays[d]?.[mi];
        if (rec) for (let h = 0; h < 24; h++) avg[h] += rec[h];
      }
      for (let h = 0; h < 24; h++) avg[h] /= monthDates.length;
    }

    // ── Navigasi tanggal ──
    const idx = trafficDates.indexOf(trafficDate);
    _trafficNav?.setLabel(KPI.formatDate(trafficDate));
    _trafficNav?.setPrevEnabled(idx > 0);
    _trafficNav?.setNextEnabled(idx >= 0 && idx < trafficDates.length - 1);

    // Panel detail menggantikan ringkasan + grafik. Chart-nya sengaja tidak
    // digambar selagi tersembunyi (lebarnya 0 → Chart.js salah ukur); saat
    // kembali ke tampilan grafik, drawTrafficChart membuatnya dari awal.
    if (trafficDetailOpen) {
      renderTrafficDetail();
      return;
    }

    renderTrafficSummary(day, ym);
    drawTrafficChart(day, avg);
  }

  // ══════════════════════════════════════
  // Detail: matriks Material × Jam untuk satu tanggal
  // ══════════════════════════════════════

  // "KARKAS 1.2-1.3" → "K 1.2" — rentang cukup diwakili batas bawahnya, dan
  // dengan 24 kolom jam kolom material harus sesempit mungkin. Bentuk yang
  // bukan rentang angka ("KARKAS 1.6up dan 2.0up") dibiarkan utuh.
  function shortKarkasLabel(md) {
    const rest = String(md)
      .trim()
      .replace(/^KARKAS\s*/i, "")
      .replace(/^(\d+(?:[.,]\d+)?)\s*-\s*\d+(?:[.,]\d+)?$/, "$1");
    return ("K " + rest).trim();
  }

  // ── Peta warna departemen tujuan ──
  // Kode dept-nya dibiarkan mentah di data (lihat catatan di TTA import),
  // jadi pemetaan ke nama dan warna dilakukan di sini. Urutannya menentukan
  // slot arsiran: tiap departemen selalu menempati garis yang sama, jadi
  // sel yang berisi dua departemen terbaca sebagai dua warna bertumpuk,
  // bukan sebagai pola baru.
  const TRAFFIC_DEPTS = [
    { code: "103B", label: "Cut Up", color: "var(--dept-cutup)" },
    { code: "103C", label: "Parting", color: "var(--dept-parting)" },
    { code: "103D", label: "Boneless", color: "var(--dept-boneless)" },
    { code: "103F", label: "AU", color: "var(--dept-au)" },
  ];

  // Departemen yang arsirannya sedang ditampilkan. Mulai dari semua menyala,
  // jadi menekan "Map dept color" langsung memperlihatkan peta yang utuh —
  // legendanya baru dipakai kalau ingin menyisihkan sebagian.
  const trafficDeptSel = new Set(TRAFFIC_DEPTS.map((d) => d.code));

  // Nilai "Departement Tujuan" datang apa adanya dari Excel — kadang cuma
  // "103B", kadang ada embel-embel nama. Kode 103x-nya yang dipakai.
  function deptCode(raw) {
    const m = /103[A-K]/.exec(String(raw || "").toUpperCase());
    return m ? m[0] : "";
  }

  // Satu periode 8px dibagi jadi empat slot berjarak 2px; tiap departemen
  // selalu memakai slot yang sama, jadi arsiran dua departemen saling
  // menyilang tanpa menutupi. Garisnya sendiri tipis (1px) — cukup untuk
  // menandai warna tanpa mengganggu angka di atasnya.
  // Perapatan periode inilah yang mengatur banyak garis per sel: 8px memberi
  // kira-kira satu garis lebih banyak per sel dibanding 10px.
  const HATCH_PERIOD = 8;
  const HATCH_SLOT = 2;
  const HATCH_W = 1;

  function deptHatch(codes) {
    if (!codes || !codes.length) return "";
    const set = new Set(codes.map(deptCode));
    const layers = TRAFFIC_DEPTS.filter(
      (d) => set.has(d.code) && trafficDeptSel.has(d.code),
    ).map((d) => {
      const off = TRAFFIC_DEPTS.indexOf(d) * HATCH_SLOT;
      return (
        `repeating-linear-gradient(45deg,` +
        `transparent 0 ${off}px,` +
        `${d.color} ${off}px ${off + HATCH_W}px,` +
        `transparent ${off + HATCH_W}px ${HATCH_PERIOD}px)`
      );
    });
    return layers.join(",");
  }

  // Legendanya sekaligus jadi saklar: tiap departemen bisa dimatikan sendiri
  // supaya sel yang berisi banyak departemen lebih mudah dibaca.
  function trafficDeptLegend() {
    const items = TRAFFIC_DEPTS.map((d) => {
      const on = trafficDeptSel.has(d.code);
      return (
        `<button type="button" class="tdl-item${on ? "" : " is-off"}"` +
        ` data-dept="${d.code}" aria-pressed="${on}">` +
        `<i style="background:${d.color}"></i>${d.label}</button>`
      );
    }).join("");
    // id dipakai panduan What's New sebagai sasaran sorotan.
    return `<div class="traffic-dept-legend" id="trafficDeptLegend">${items}</div>`;
  }

  // Rincian per material datang dari baris mentah (lihat TTATraffic
  // .getDayDetail), jadi bisa lambat di bulan yang belum pernah dibuka.
  // Nomor request menjaga hasil unduhan lama tidak menimpa tanggal terbaru
  // kalau ‹ › ditekan cepat.
  let _trafficDetailReq = 0;

  // Baris tanggal yang sedang tampil, disimpan supaya tombol "Map dept color"
  // bisa menggambar ulang tabel seketika tanpa menunggu promise lagi.
  let _trafficDetailRows = null;
  let _trafficDetailRowsDate = "";

  // Matriks 24 kolom hampir selalu digulir mendatar, tapi tiap gambar ulang
  // mengganti innerHTML — elemen penggulungnya ikut lahir baru dan posisinya
  // balik ke kolom paling kiri. Dua fungsi kecil ini menjaga jam yang sedang
  // dilihat tetap di tempatnya.
  //
  // Hanya berlaku selama tanggalnya tidak berganti: ganti BRD/KG dan arsiran
  // dept cuma menukar isi kolom yang itu-itu juga, sementara pindah tanggal
  // memang wajar mulai dari kiri lagi.
  function readTrafficDetailScroll(el) {
    return el.querySelector(".traffic-detail-scroll")?.scrollLeft || 0;
  }

  function restoreTrafficDetailScroll(el, left) {
    if (!left) return;
    const scroller = el.querySelector(".traffic-detail-scroll");
    // Lebar tabel bisa bergeser sedikit antara BRD dan KG karena jumlah
    // digitnya beda; browser sendiri yang memangkas kalau posisinya kelewat.
    if (scroller) scroller.scrollLeft = left;
  }

  async function renderTrafficDetail() {
    const el = document.getElementById("trafficDetail");
    if (!el || !trafficDate) return;

    const req = ++_trafficDetailReq;
    // Dibaca sebelum placeholder menimpanya. _trafficDetailRowsDate masih
    // berisi tanggal yang sedang tampil di layar, jadi perbandingan ini yang
    // memisahkan "ganti metrik" dari "pindah tanggal".
    const keepLeft =
      _trafficDetailRowsDate === trafficDate ? readTrafficDetailScroll(el) : 0;
    el.innerHTML = `<div class="traffic-note">memuat rincian material…</div>`;

    let rows;
    try {
      rows = await TTATraffic.getDayDetail(trafficDate);
    } catch (err) {
      console.error("[Traffic] gagal memuat rincian material:", err);
      if (req === _trafficDetailReq) {
        el.innerHTML = `<div class="traffic-note">Gagal memuat rincian material</div>`;
      }
      return;
    }

    if (req !== _trafficDetailReq || !trafficDetailOpen) return;
    _trafficDetailRows = rows;
    _trafficDetailRowsDate = trafficDate;
    el.innerHTML = trafficDetailTable(rows);
    restoreTrafficDetailScroll(el, keepLeft);
  }

  // Menggambar ulang tabel dari baris yang sudah di tangan. Dipakai perubahan
  // yang murni tampilan (arsiran dept, pilihan legend) — tidak perlu menunggu
  // promise dan tidak memunculkan "memuat rincian…" yang berkedip.
  function redrawTrafficDetail() {
    const el = document.getElementById("trafficDetail");
    if (el && _trafficDetailRows && _trafficDetailRowsDate === trafficDate) {
      const keepLeft = readTrafficDetailScroll(el);
      el.innerHTML = trafficDetailTable(_trafficDetailRows);
      restoreTrafficDetailScroll(el, keepLeft);
    } else {
      renderTrafficDetail();
    }
  }

  function trafficDetailTable(rows) {
    if (!rows.length) {
      return `<div class="traffic-note">Tidak ada transfer karkas di tanggal ini</div>`;
    }

    const mi = trafficMetricIdx();
    const hourHead = TRAFFIC_HOURS.map((h) => `<th>${pad2h(h)}</th>`).join("");

    // Jam tanpa transfer dikosongkan, bukan diisi "0" — dalam matriks 24 kolom
    // deretan nol menenggelamkan angka yang berarti.
    // Angkanya ditulis polos tanpa pemisah ribuan: di 26 kolom yang berdesakan
    // titik pemisah cuma menambah lebar dan bikin kolom makin ramai.
    const cell = (v, cls, hatch) => {
      if (!v) return `<td class="is-zero${cls ? " " + cls : ""}"></td>`;
      const attrs =
        (cls ? ` class="${cls}"` : "") +
        (hatch ? ` style="background-image:${hatch}"` : "");
      return `<td${attrs}>${Math.round(v)}</td>`;
    };

    // Total per jam (baris bawah) dijumlahkan dari angka yang sama persis
    // dengan yang tampil di sel — jadi tiap total selalu cocok kalau
    // dijumlahkan sendiri oleh pembacanya, tanpa selisih pembulatan.
    const hourTotal = new Array(24).fill(0);
    let grand = 0;

    const body = rows
      .map((r) => {
        let rowTotal = 0;
        const cells = TRAFFIC_HOURS.map((h) => {
          const v = r.hours[mi][h];
          rowTotal += v;
          hourTotal[h] += v;
          return cell(v, "", trafficDeptMap ? deptHatch(r.dept?.[h]) : "");
        }).join("");
        grand += rowTotal;
        return (
          `<tr><th scope="row">${shortKarkasLabel(r.md)}</th>${cells}` +
          cell(rowTotal, "tdt-total") +
          `</tr>`
        );
      })
      .join("");

    const footCells = TRAFFIC_HOURS.map((h) => cell(hourTotal[h])).join("");

    return `
      ${trafficDeptMap ? trafficDeptLegend() : ""}
      <div class="traffic-detail-scroll">
        <table class="traffic-detail-table">
          <thead>
            <tr>
              <th class="tdt-corner" rowspan="2" scope="col">Material</th>
              <th class="tdt-group" colspan="${TRAFFIC_HOURS.length}" scope="colgroup">Jam</th>
              <th class="tdt-total-head" rowspan="2" scope="col">Total</th>
            </tr>
            <tr class="tdt-hours">${hourHead}</tr>
          </thead>
          <tbody>${body}</tbody>
          <tfoot>
            <tr id="tdtTotalRow">
              <th scope="row">Total</th>
              ${footCells}
              ${cell(grand, "tdt-total")}
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  function renderTrafficSummary(day, ym) {
    const el = document.getElementById("trafficSummary");
    if (!el) return;

    // Totalnya cuma dipakai untuk membedakan "tanggal kosong" dari "ada data" —
    // angkanya sendiri tidak lagi ditampilkan di baris ini.
    const sum = day.total.reduce((a, b) => a + b, 0);

    if (!sum) {
      el.innerHTML = `<span class="traffic-note">Tidak ada transfer karkas di tanggal ini</span>`;
      return;
    }

    const peak = peakHour(day.total);
    const filled = day.total.filter((v) => v > 0).length;
    const sparse =
      filled <= 6
        ? `<span class="traffic-note">· data tipis (${filled} dari 24 jam terisi)</span>`
        : "";

    el.innerHTML =
      `<span class="traffic-peak">Paling padat jam ${pad2h(peak)}:00</span>` +
      `<span class="traffic-note">· garis putus-putus = rata-rata ${KPI.formatMonthYear(ym)}</span>` +
      sparse;
  }

  function showTrafficEmpty(msg) {
    hideTrafficSkeleton();
    const el = document.getElementById("trafficSummary");
    if (el) el.innerHTML = `<span class="traffic-note">${msg}</span>`;
    // Panel detail menutupi ringkasan di atas, jadi pesannya harus ikut ke
    // sana — kalau tidak, yang terlihat cuma "memuat…" yang tidak pernah usai.
    const detail = document.getElementById("trafficDetail");
    if (detail && trafficDetailOpen) {
      detail.innerHTML = `<div class="traffic-note">${msg}</div>`;
    }
    _trafficNav?.setLabel("—");
    _trafficNav?.setPrevEnabled(false);
    _trafficNav?.setNextEnabled(false);
    if (_trafficChart) {
      _trafficChart.destroy();
      _trafficChart = null;
    }
  }

  function drawTrafficChart(day, avg) {
    const ctx = document.getElementById("trafficChart")?.getContext("2d");
    if (!ctx) return;

    if (_trafficChart) {
      _trafficChart.destroy();
      _trafficChart = null;
    }

    const peak = peakHour(day.total);

    // Tanpa hover pun label sudah menempel di jam terpadat, dan ke sinilah
    // label kembali setiap kursor meninggalkan batang.
    //
    // Kuncian dari klik sebelumnya sengaja dilepas di sini: fungsi ini hanya
    // dipanggil saat datanya benar-benar berganti (ganti tanggal, ganti
    // BRD/KG, atau kembali dari tampilan detail), sementara hover dan klik
    // cuma memanggil chart.draw(). Kalau tidak dilepas, label tetap terkunci
    // di jam pilihan tanggal lama — jam terpadat tanggal baru tidak ditandai.
    _trafficPinned = false;
    _trafficDefault = peak >= 0 ? TRAFFIC_HOURS.indexOf(peak) : -1;
    _trafficActive = _trafficDefault;

    _trafficChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: TRAFFIC_HOURS.map(pad2h),
        datasets: [
          {
            // order lebih kecil digambar lebih dulu → garis berada di belakang bar
            type: "line",
            label: "Rata-rata",
            data: TRAFFIC_HOURS.map((h) => avg[h]),
            order: 0,
            borderColor: "rgba(107,112,148,0.5)",
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 0,
            pointHitRadius: 0,
            // Tanpa ini Chart.js memunculkan bulatan abu-abu di garis rata-rata
            // setiap kali di-hover (pointHoverRadius bawaannya 4).
            pointHoverRadius: 0,
            pointHoverBorderWidth: 0,
            tension: 0.35,
            fill: false,
          },
          {
            type: "bar",
            label: "Hari ini",
            data: TRAFFIC_HOURS.map((h) => day.total[h]),
            order: 1,
            // Canvas tidak bisa membaca var(--…), jadi nilai warnanya ditulis
            // langsung: --blue untuk jam puncak, --cal-2 untuk sisanya.
            backgroundColor: TRAFFIC_HOURS.map((h) =>
              day.total[h] > 0 && h === peak ? "#3b7ddd" : "#C0D9F5",
            ),
            borderRadius: 3,
            borderSkipped: false,
            barPercentage: 0.72,
            categoryPercentage: 0.92,
          },
        ],
      },
      plugins: [trafficMarkerPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeInOutQuart" },
        // Batang tetap tumbuh 500ms saat pertama muncul, tapi perubahan warna
        // saat kursor menyapu antar batang harus cepat — 500ms terasa lamban.
        animations: { colors: { duration: 110, easing: "linear" } },
        interaction: { mode: "index", intersect: false },
        // Ruang di atas plot untuk label penunjuk.
        layout: { padding: { top: LABEL_H + LABEL_GAP + 2 } },
        onHover: (_e, els, chart) => {
          if (_trafficPinned) return;
          // Di luar batang label balik ke jam terpadat, bukan menghilang.
          const i = els.length ? els[0].index : _trafficDefault;
          if (i !== _trafficActive) {
            _trafficActive = i;
            chart.draw();
          }
        },
        onClick: (_e, els, chart) => {
          const i = els.length ? els[0].index : -1;
          if (i < 0) {
            _trafficPinned = false;
            _trafficActive = _trafficDefault;
          } else if (_trafficPinned && _trafficActive === i) {
            _trafficPinned = false;
            _trafficActive = i;
          } else {
            _trafficPinned = true;
            _trafficActive = i;
          }
          chart.draw();
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { family: "'JetBrains Mono'", size: 9, weight: 700 },
              color: "#1a1d2e", // --text
              maxRotation: 0,
              autoSkip: false,
              // Tampilkan tiap 2 jam supaya tidak berdesakan di layar HP.
              callback: (_, i) => (i % 2 === 0 ? pad2h(TRAFFIC_HOURS[i]) : ""),
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(0,0,0,0.04)", lineWidth: 0.5 },
            border: { display: false },
            ticks: {
              font: { family: "'JetBrains Mono'", size: 10, weight: 700 },
              color: "#1a1d2e", // --text
              maxTicksLimit: 5,
              callback: (v) => KPI.fmtShort(v),
            },
          },
        },
      },
    });
  }

  // ══════════════════════════════════════
  // SECTION 4 LEFT: Search Material
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

  // Dipakai panduan What's New untuk membuka tampilan yang sedang dijelaskan.
  // Lewat fungsi ini, bukan dengan mengklik tombolnya lewat skrip, supaya
  // state dan tampilannya dijamin sinkron seperti klik user biasa.
  function setTrafficDetail(open) {
    if (trafficDetailOpen === open) return;
    trafficDetailOpen = open;
    applyTrafficDetailState();
    renderTrafficChart();
  }

  function setTrafficDeptMap(on) {
    if (trafficDeptMap === on) return;
    trafficDeptMap = on;
    applyTrafficDetailState();
    redrawTrafficDetail();
  }

  return { render, refreshTraffic, setTrafficDetail, setTrafficDeptMap };
})();
