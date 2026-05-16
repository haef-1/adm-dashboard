/* ═══════════════════════════════════════
   KARKAS-TABLE.JS — Karkas Table View
   ═══════════════════════════════════════ */

const KarkasTablePage = (() => {
  const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const DEPTS = ["CUT UP", "BONELESS", "AU", "PARTING"];
  const DEPT_COLORS = { "CUT UP": "#34d399", "BONELESS": "#60a5fa", "AU": "#fbbf24", "PARTING": "#f472b6" };
  const DEPT_BG = { "CUT UP": "#ecfdf5", "BONELESS": "#dbeafe", "AU": "#fefce8", "PARTING": "#fdf2f8" };

  let krkPeriod = "daily";
  let krkMetric = "brd";
  let krkPvMode = "AYAM BARU";
  let krkSelectedItems = null;
  let krkSelectedFrom = null;
  let krkSelectedTo = null;
  let _krkRangeDocListener = null;
  let _krkRangeScrollListener = null;
  let collapsedDepts = {};

  function getWeekMap(dates) {
    const map = {};
    dates.forEach(d => {
      const key = d.slice(0, 4) + "-W" + KPI.getISOWeek(d);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }

  function getMonthMap(dates) {
    const map = {};
    dates.forEach(d => {
      const key = d.slice(0, 7);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }

  function fmtDateLabel(dateStr, includeYear) {
    const p = dateStr.split("-");
    const base = p[2] + " " + MONTH_NAMES[parseInt(p[1])];
    return includeYear ? base + " " + p[0] : base;
  }

  function fmtRangeLabel(dateA, dateB, periodType) {
    if (periodType === "weekly") {
      const wA = "W" + KPI.getISOWeek(dateA);
      const wB = "W" + KPI.getISOWeek(dateB);
      const yA = dateA.split("-")[0], yB = dateB.split("-")[0];
      if (yA === yB) return wA + " – " + wB + " " + yA;
      return wA + " " + yA + " – " + wB + " " + yB;
    }
    if (periodType === "monthly") {
      const mA = MONTH_NAMES[parseInt(dateA.split("-")[1])];
      const mB = MONTH_NAMES[parseInt(dateB.split("-")[1])];
      const yA = dateA.split("-")[0], yB = dateB.split("-")[0];
      if (yA === yB) return mA + " – " + mB + " " + yA;
      return mA + " " + yA + " – " + mB + " " + yB;
    }
    const yA = dateA.split("-")[0], yB = dateB.split("-")[0];
    if (yA === yB) {
      return fmtDateLabel(dateA, false) + " – " + fmtDateLabel(dateB, true);
    }
    return fmtDateLabel(dateA, true) + " – " + fmtDateLabel(dateB, true);
  }

  function exportSheetWithRaw(table) {
    const ws = XLSX.utils.table_to_sheet(table);
    const rows = table.querySelectorAll("tr");
    let r = 0;
    rows.forEach(tr => {
      let c = 0;
      tr.querySelectorAll("th, td").forEach(cell => {
        const addr = XLSX.utils.encode_cell({ r, c });
        const raw = cell.getAttribute("data-v");
        if (raw !== null && ws[addr]) {
          const num = parseFloat(raw);
          if (!isNaN(num)) { ws[addr].t = "n"; ws[addr].v = num; }
        }
        c++;
      });
      r++;
    });
    return ws;
  }

  // ══════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════

  function render(container) {
    krkSelectedItems = null;
    krkSelectedFrom = null;
    krkSelectedTo = null;
    collapsedDepts = {};

    container.innerHTML = `
      <div class="page-title">Karkas — Table</div>
      <div class="table-section">
        <div class="table-section-header">
          <h3 class="table-section-title" id="krkTitle">Karkas Distribution Harian</h3>
          <div class="table-controls">
            <div class="toggle-group" id="krkMetricToggle">
              <button class="toggle-btn active" data-metric="brd">BRD</button>
              <button class="toggle-btn" data-metric="kg">KG</button>
            </div>
            <div id="krkPvWrap"></div>
            <div id="krkPeriodWrap"></div>
            <div id="krkRangeNav"></div>
            <button class="table-export-btn" id="krkExport">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
          </div>
        </div>
        <div class="krk-table-wrap" id="krkTableWrap"></div>
      </div>
    `;

    initControls();
    renderTable();
    document.getElementById("krkExport").addEventListener("click", exportTable);
  }

  // ══════════════════════════════════════
  //  CONTROLS
  // ══════════════════════════════════════

  function initControls() {
    document.querySelectorAll("#krkMetricToggle .toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#krkMetricToggle .toggle-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        krkMetric = btn.dataset.metric;
        renderTable();
      });
    });

    const pvSel = DatePicker.createCustomSelect(
      [
        { value: "AYAM BARU", label: "Ayam Baru" },
        { value: "AYAM LAMA", label: "Ayam Lama" },
        { value: "AYAM PROSES", label: "Ayam Proses" },
      ],
      krkPvMode,
      (val) => { krkPvMode = val; renderTable(); },
    );
    document.getElementById("krkPvWrap").appendChild(pvSel.el);

    const periodSel = DatePicker.createCustomSelect(
      [
        { value: "daily", label: "Daily" },
        { value: "weekly", label: "Weekly" },
        { value: "monthly", label: "Monthly" },
      ],
      krkPeriod,
      (val) => {
        krkPeriod = val;
        krkSelectedItems = null;
        krkSelectedFrom = null;
        krkSelectedTo = null;
        renderTable();
      },
    );
    document.getElementById("krkPeriodWrap").appendChild(periodSel.el);
  }

  // ══════════════════════════════════════
  //  DATA
  // ══════════════════════════════════════

  function getPeriodColumns() {
    const dates = Engine.getAvailableDates();
    if (!dates.length) return [];

    if (krkPeriod === "daily") {
      const range = krkSelectedItems
        ? dates.filter(d => krkSelectedItems.includes(d))
        : dates.slice(-7);
      return range.map(d => {
        const p = d.split("-");
        return { key: d, label: p[2] + " " + MONTH_NAMES[parseInt(p[1])] + " " + p[0].slice(2), dates: [d] };
      });
    } else if (krkPeriod === "weekly") {
      const weekMap = getWeekMap(dates);
      const allKeys = Object.keys(weekMap);
      const keys = krkSelectedItems
        ? allKeys.filter(k => krkSelectedItems.includes(k))
        : allKeys.slice(-7);
      return keys.map(wk => ({
        key: wk,
        label: "W" + wk.split("-W")[1] + " " + wk.split("-W")[0].slice(2),
        dates: weekMap[wk],
      }));
    } else {
      const monthMap = getMonthMap(dates);
      const allKeys = Object.keys(monthMap);
      const keys = krkSelectedItems
        ? allKeys.filter(k => krkSelectedItems.includes(k))
        : allKeys.slice(-7);
      return keys.map(ym => ({
        key: ym,
        label: KPI.formatMonthYear(ym),
        dates: monthMap[ym],
      }));
    }
  }

  function buildTableData(columns) {
    const allDates = [];
    columns.forEach(c => c.dates.forEach(d => allDates.push(d)));

    const lookups = Engine.getLookups();
    const rows = Engine.getRowsForDates(allDates);
    const BONELESS_DEPTS = new Set(["BONELESS BONGKAR", "BONELESS MIX"]);

    // dept → matdesc → date → { brd, kg }
    const data = {};
    DEPTS.forEach(d => { data[d] = {}; });

    rows.forEach(r => {
      const rawDept = lookups.dept[r[0]];
      const pv = lookups.pv[r[1]];
      const mvt = lookups.mvt[r[5]];
      const sloc = lookups.sloc[r[9]];
      const matdesc = lookups.matdesc[r[4]];
      const date = r[8];

      if (mvt !== "BAHAN") return;

      const dept = BONELESS_DEPTS.has(rawDept) ? "BONELESS" : rawDept;
      if (!data[dept]) return;

      let ok = false;
      if (krkPvMode === "AYAM BARU" || krkPvMode === "AYAM PROSES") {
        if (pv === "AYAM BARU" && sloc === "STAGING RM" && matdesc.includes("KARKAS")) ok = true;
      }
      if (krkPvMode === "AYAM LAMA" || krkPvMode === "AYAM PROSES") {
        if (pv === "AYAM LAMA" && (sloc === "CRP" || sloc === "REPRO")) ok = true;
      }
      if (!ok) return;

      if (!data[dept][matdesc]) data[dept][matdesc] = {};
      if (!data[dept][matdesc][date]) data[dept][matdesc][date] = { brd: 0, kg: 0 };
      data[dept][matdesc][date].brd += r[6];
      data[dept][matdesc][date].kg += r[7];
    });

    return data;
  }

  // ══════════════════════════════════════
  //  RENDER TABLE
  // ══════════════════════════════════════

  function renderTable() {
    const titleEl = document.getElementById("krkTitle");
    if (titleEl) {
      const titles = { daily: "Karkas Distribution Harian", weekly: "Karkas Distribution Mingguan", monthly: "Karkas Distribution Bulanan" };
      titleEl.textContent = titles[krkPeriod];
    }

    const dates = Engine.getAvailableDates();
    if (!dates.length) {
      document.getElementById("krkTableWrap").innerHTML = `<p class="table-empty">Tidak ada data tersedia.</p>`;
      renderRangeNav();
      return;
    }

    const columns = getPeriodColumns();
    if (!columns.length) {
      document.getElementById("krkTableWrap").innerHTML = `<p class="table-empty">Tidak ada data untuk periode ini.</p>`;
      renderRangeNav();
      return;
    }

    const data = buildTableData(columns);
    const metric = krkMetric;
    const isKg = metric === "kg";

    const _fmtKg = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const _fmtBrd = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
    const fmtVal = (v) => isKg ? _fmtKg.format(v) : _fmtBrd.format(Math.round(v));

    const metricLabel = isKg ? "KG" : "BRD";

    // Build HTML
    const lastIdx = columns.length - 1;
    let bodyHtml = "";
    let grandTotals = {};
    columns.forEach(c => { grandTotals[c.key] = 0; });
    let grandTotal = 0;

    DEPTS.forEach(dept => {
      const matdescs = Object.keys(data[dept]).sort();
      const isCollapsed = collapsedDepts[dept];

      // Compute dept totals per column
      const deptColTotals = {};
      let deptTotal = 0;
      columns.forEach(col => {
        let sum = 0;
        matdescs.forEach(md => {
          col.dates.forEach(d => {
            const v = data[dept][md]?.[d];
            if (v) sum += metric === "brd" ? v.brd : v.kg;
          });
        });
        deptColTotals[col.key] = sum;
        deptTotal += sum;
        grandTotals[col.key] += sum;
      });
      grandTotal += deptTotal;

      // Department header row
      bodyHtml += `<tr class="krk-dept-row" data-dept="${dept}" style="background:${DEPT_BG[dept]}">
        <td class="krk-dept-cell" style="background:${DEPT_BG[dept]}">
          <span class="krk-dept-dot" style="background:${DEPT_COLORS[dept]}"></span>
          <span class="krk-dept-toggle">${isCollapsed ? "&#9654;" : "&#9660;"}</span>
          ${dept}
          <span class="krk-dept-count">${matdescs.length}</span>
        </td>
        ${columns.map((c, ci) => `<td data-v="${deptColTotals[c.key]}"${ci === lastIdx ? ' class="krk-col-latest"' : ''}><strong>${fmtVal(deptColTotals[c.key])}</strong></td>`).join("")}
        <td data-v="${deptTotal}"><strong>${fmtVal(deptTotal)}</strong></td>
      </tr>`;

      // Sub-rows per matdesc (always rendered, hidden via display when collapsed)
      matdescs.forEach((md, mi) => {
        let rowTotal = 0;
        const vals = columns.map(col => {
          let sum = 0;
          col.dates.forEach(d => {
            const v = data[dept][md]?.[d];
            if (v) sum += metric === "brd" ? v.brd : v.kg;
          });
          rowTotal += sum;
          return sum;
        });

        const isLast = mi === matdescs.length - 1;
        bodyHtml += `<tr class="krk-sub-row${isLast ? " krk-sub-last" : ""}" data-dept="${dept}"${isCollapsed ? ' style="display:none"' : ''}>
          <td class="krk-mat-cell" title="${md}">${md}</td>
          ${vals.map((v, i) => `<td data-v="${v}"${i === lastIdx ? ' class="krk-col-latest"' : ''}>${fmtVal(v)}</td>`).join("")}
          <td data-v="${rowTotal}">${fmtVal(rowTotal)}</td>
        </tr>`;
      });

    });

    // Grand total row
    bodyHtml += `<tr class="smt-total-row">
      <td><strong>TOTAL</strong></td>
      ${columns.map((c, ci) => `<td data-v="${grandTotals[c.key]}"${ci === lastIdx ? ' class="krk-col-latest"' : ''}><strong>${fmtVal(grandTotals[c.key])}</strong></td>`).join("")}
      <td data-v="${grandTotal}"><strong>${fmtVal(grandTotal)}</strong></td>
    </tr>`;

    const wrap = document.getElementById("krkTableWrap");
    wrap.innerHTML = `
      <table class="data-table smt-table krk-table">
        <thead>
          <tr>
            <th>Departemen / Material (${metricLabel})</th>
            ${columns.map((c, ci) => `<th${ci === lastIdx ? ' class="krk-col-latest"' : ''}>${c.label}</th>`).join("")}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    `;

    // Toggle collapsed (DOM toggle, no full re-render)
    wrap.querySelectorAll(".krk-dept-row").forEach(row => {
      row.addEventListener("click", () => {
        const dept = row.dataset.dept;
        collapsedDepts[dept] = !collapsedDepts[dept];
        const hidden = collapsedDepts[dept];
        wrap.querySelectorAll(`.krk-sub-row[data-dept="${dept}"]`).forEach(sr => {
          sr.style.display = hidden ? "none" : "";
        });
        const toggle = row.querySelector(".krk-dept-toggle");
        if (toggle) toggle.innerHTML = hidden ? "&#9654;" : "&#9660;";
      });
    });

    renderRangeNav();
    initStickyHeader();
  }

  let _stickyCleanup = null;

  function initStickyHeader() {
    if (_stickyCleanup) { _stickyCleanup(); _stickyCleanup = null; }

    const wrap = document.getElementById("krkTableWrap");
    if (!wrap) return;

    const table = wrap.querySelector(".krk-table");
    const thead = table?.querySelector("thead");
    if (!thead) return;

    const topbarH = 52;
    const scrollTop = topbarH - 1;
    let headerActive = false;
    let currentDept = null;
    let syncing = false;

    // Scroll proxy (visible scrollbar above table in normal flow)
    const scrollProxy = document.createElement("div");
    scrollProxy.className = "krk-scroll-proxy";
    const scrollProxyInner = document.createElement("div");
    scrollProxyInner.className = "krk-scroll-proxy-inner";
    scrollProxy.appendChild(scrollProxyInner);
    wrap.parentNode.insertBefore(scrollProxy, wrap);
    scrollProxyInner.style.width = table.offsetWidth + "px";

    // Bidirectional sync between proxy and wrapper
    scrollProxy.addEventListener("scroll", () => {
      if (syncing) return;
      syncing = true;
      wrap.scrollLeft = scrollProxy.scrollLeft;
      syncFixedScroll();
      syncing = false;
    });
    wrap.addEventListener("scroll", () => {
      if (syncing) return;
      syncing = true;
      scrollProxy.scrollLeft = wrap.scrollLeft;
      syncFixedScroll();
      syncing = false;
    });

    // Sentinel: triggers when scroll proxy crosses the topbar
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "height:0;margin:0;padding:0;";
    wrap.parentNode.insertBefore(sentinel, scrollProxy);

    // Single fixed container for scrollbar + header (no gap possible)
    const fixedContainer = document.createElement("div");
    fixedContainer.style.cssText = `position:fixed;top:${scrollTop}px;display:none;z-index:50;background:var(--bg);box-shadow:0 2px 6px rgba(0,0,0,.08);`;
    document.body.appendChild(fixedContainer);

    // Fixed scroll proxy inside container
    const fixedScroll = document.createElement("div");
    fixedScroll.className = "krk-scroll-proxy";
    const fixedScrollInner = document.createElement("div");
    fixedScroll.appendChild(fixedScrollInner);
    fixedScrollInner.style.height = "1px";
    fixedContainer.appendChild(fixedScroll);
    fixedScroll.addEventListener("scroll", () => {
      if (syncing) return;
      syncing = true;
      wrap.scrollLeft = fixedScroll.scrollLeft;
      scrollProxy.scrollLeft = fixedScroll.scrollLeft;
      syncFixedScroll();
      syncing = false;
    });

    // Fixed header inside same container
    const fixedHeaderWrap = document.createElement("div");
    fixedHeaderWrap.style.cssText = "overflow:hidden;";
    const cloneTable = document.createElement("table");
    cloneTable.className = table.className;
    fixedHeaderWrap.appendChild(cloneTable);
    fixedContainer.appendChild(fixedHeaderWrap);

    // Fixed dept row clone (separate, below container)
    const deptBar = document.createElement("div");
    deptBar.className = "krk-fixed-dept";
    deptBar.style.cssText = `position:fixed;overflow:hidden;display:none;z-index:49;background:var(--bg);`;
    const deptCloneTable = document.createElement("table");
    deptCloneTable.className = table.className;
    deptBar.appendChild(deptCloneTable);
    document.body.appendChild(deptBar);

    function syncFixedScroll() {
      if (!headerActive) return;
      const sl = -wrap.scrollLeft + "px";
      cloneTable.style.marginLeft = sl;
      deptCloneTable.style.marginLeft = sl;
    }

    function activateHeader() {
      headerActive = true;

      // Measure column widths
      const origThs = thead.querySelectorAll("th");
      const clone = thead.cloneNode(true);
      const cloneThs = clone.querySelectorAll("th");
      origThs.forEach((th, i) => {
        cloneThs[i].style.width = th.offsetWidth + "px";
        cloneThs[i].style.minWidth = th.offsetWidth + "px";
      });
      cloneTable.innerHTML = "";
      cloneTable.appendChild(clone);
      cloneTable.style.tableLayout = "fixed";
      cloneTable.style.width = table.offsetWidth + "px";

      const wrapRect = wrap.getBoundingClientRect();

      // Setup fixed container
      fixedScrollInner.style.width = table.offsetWidth + "px";
      fixedScroll.scrollLeft = wrap.scrollLeft;
      fixedContainer.style.left = wrapRect.left + "px";
      fixedContainer.style.width = wrap.clientWidth + "px";
      cloneTable.style.marginLeft = -wrap.scrollLeft + "px";
      fixedContainer.style.display = "";

      updateDeptRow();
    }

    function deactivateHeader() {
      headerActive = false;
      fixedContainer.style.display = "none";
      deptBar.style.display = "none";
      currentDept = null;
    }

    const cachedDeptRows = [...table.querySelectorAll(".krk-dept-row")];

    function updateDeptRow() {
      if (!headerActive) return;

      const containerBottom = fixedContainer.getBoundingClientRect().bottom;
      const deptRows = cachedDeptRows;
      let pinned = null;

      for (let i = 0; i < deptRows.length; i++) {
        const rect = deptRows[i].getBoundingClientRect();
        if (rect.top < containerBottom) {
          pinned = deptRows[i];
        } else {
          break;
        }
      }

      if (!pinned) {
        deptBar.style.display = "none";
        currentDept = null;
        return;
      }

      const dept = pinned.dataset.dept;
      if (dept !== currentDept) {
        currentDept = dept;
        const origCells = pinned.querySelectorAll("td");
        const cloneRow = pinned.cloneNode(true);
        const cloneCells = cloneRow.querySelectorAll("td");
        origCells.forEach((td, i) => {
          cloneCells[i].style.width = td.offsetWidth + "px";
          cloneCells[i].style.minWidth = td.offsetWidth + "px";
        });
        const tbody = document.createElement("tbody");
        tbody.appendChild(cloneRow);
        deptCloneTable.innerHTML = "";
        deptCloneTable.appendChild(tbody);
        deptCloneTable.style.tableLayout = "fixed";
        deptCloneTable.style.width = table.offsetWidth + "px";
      }

      const wrapRect = wrap.getBoundingClientRect();
      deptBar.style.top = containerBottom + "px";
      deptBar.style.left = wrapRect.left + "px";
      deptBar.style.width = wrap.clientWidth + "px";
      deptCloneTable.style.marginLeft = -wrap.scrollLeft + "px";
      deptBar.style.display = "";
    }

    // Scroll on page-content to update dept row
    const sc = document.querySelector(".page-content");
    let ticking = false;
    function onPageScroll() {
      if (!ticking) {
        requestAnimationFrame(() => { updateDeptRow(); ticking = false; });
        ticking = true;
      }
    }
    if (sc) sc.addEventListener("scroll", onPageScroll);

    // IntersectionObserver for header
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) activateHeader();
        else deactivateHeader();
      });
    }, { rootMargin: `-${topbarH}px 0px 0px 0px`, threshold: 0 });

    observer.observe(sentinel);

    _stickyCleanup = () => {
      observer.disconnect();
      sentinel.remove();
      scrollProxy.remove();
      fixedContainer.remove();
      deptBar.remove();
      if (sc) sc.removeEventListener("scroll", onPageScroll);
    };
  }

  // ══════════════════════════════════════
  //  RANGE NAV
  // ══════════════════════════════════════

  function renderRangeNav() {
    const navEl = document.getElementById("krkRangeNav");
    if (!navEl) return;

    const columns = getPeriodColumns();
    let rangeLabel;
    if (columns.length) {
      const first = columns[0], last = columns[columns.length - 1];
      const dateA = krkPeriod === "daily" ? first.key : (krkPeriod === "monthly" ? first.key : first.dates[0]);
      const dateB = krkPeriod === "daily" ? last.key : (krkPeriod === "monthly" ? last.key : last.dates[0]);
      rangeLabel = fmtRangeLabel(dateA, dateB, krkPeriod);
    } else if (krkSelectedFrom && krkSelectedTo) {
      rangeLabel = fmtRangeLabel(krkSelectedFrom, krkSelectedTo, krkPeriod);
    } else {
      rangeLabel = "Pilih tanggal";
    }
    navEl.innerHTML = `<button class="chart-range-btn" id="krkRangeBtn">${rangeLabel}</button>`;
    document.getElementById("krkRangeBtn").addEventListener("click", openRangePicker);
  }

  // ══════════════════════════════════════
  //  RANGE PICKER
  // ══════════════════════════════════════

  function openRangePicker() {
    const dates = Engine.getAvailableDates();
    if (!dates.length) return;

    if (krkPeriod === "daily") {
      openDailyRangePicker(dates, 31);
    } else {
      openGridRangePicker(dates);
    }
  }

  function closeRangePicker() {
    if (_krkRangeDocListener) {
      document.removeEventListener("click", _krkRangeDocListener);
      _krkRangeDocListener = null;
    }
    if (_krkRangeScrollListener) {
      const sc = document.querySelector(".page-content");
      if (sc) sc.removeEventListener("scroll", _krkRangeScrollListener);
      _krkRangeScrollListener = null;
    }
    document.querySelectorAll(".krk-range-picker-popup").forEach(el => el.remove());
  }

  function openDailyRangePicker(dates, MAX) {
    const availSet = new Set(dates);
    const allMonths = [...new Set(dates.map(d => d.slice(0, 7)))];

    let fromDate = null, toDate = null;
    if (krkSelectedFrom && krkSelectedTo) {
      fromDate = krkSelectedFrom;
      toDate = krkSelectedTo;
    } else if (krkSelectedItems && krkSelectedItems.length) {
      fromDate = krkSelectedItems[0];
      toDate = krkSelectedItems[krkSelectedItems.length - 1];
    } else {
      const range = dates.slice(-7);
      fromDate = range[0];
      toDate = range[range.length - 1];
    }

    let clickPhase = 0;
    let calMonth = (fromDate || dates[dates.length - 1]).slice(0, 7);

    closeRangePicker();

    const popup = document.createElement("div");
    popup.className = "range-picker-popup range-picker-daily krk-range-picker-popup";
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
          <button class="range-picker-close" id="krkRpClose">×</button>
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
        <div class="range-cal-panel" id="krkRpCalPanel"></div>
        <div class="range-picker-footer">
          <button class="range-picker-reset" id="krkRpReset">Reset</button>
          <button class="range-picker-apply" id="krkRpApply" ${!fromDate || !toDate || clickPhase === 1 ? "disabled" : ""}>Terapkan</button>
        </div>
      `;

      popup.querySelector("#krkRpClose").addEventListener("click", closeRangePicker);
      popup.querySelector("#krkRpReset").addEventListener("click", () => {
        krkSelectedItems = null;
        krkSelectedFrom = null;
        krkSelectedTo = null;
        closeRangePicker();
        renderTable();
      });
      popup.querySelector("#krkRpApply").addEventListener("click", () => {
        if (fromDate && toDate) {
          const f = fromDate <= toDate ? fromDate : toDate;
          const t = fromDate <= toDate ? toDate : fromDate;
          krkSelectedFrom = f;
          krkSelectedTo = t;
          krkSelectedItems = dates.filter(d => d >= f && d <= t);
        } else {
          krkSelectedItems = null;
          krkSelectedFrom = null;
          krkSelectedTo = null;
        }
        closeRangePicker();
        renderTable();
      });

      renderCalPanel(popup.querySelector("#krkRpCalPanel"));
    }

    function renderCalPanel(panel) {
      const [yr, mo] = calMonth.split("-").map(Number);
      const minMonth = allMonths[0];
      const maxMonth = allMonths[allMonths.length - 1];
      const from = fromDate && toDate ? (fromDate <= toDate ? fromDate : toDate) : fromDate;
      const to = fromDate && toDate ? (fromDate <= toDate ? toDate : fromDate) : null;

      panel.innerHTML = `
        <div class="range-cal-nav">
          <button class="date-nav-btn" id="krkRpCalPrev" ${calMonth <= minMonth ? "disabled" : ""}>&#8249;</button>
          <span class="date-nav-label" style="font-size:12px">${KPI.formatMonthYear(calMonth)}</span>
          <button class="date-nav-btn" id="krkRpCalNext" ${calMonth >= maxMonth ? "disabled" : ""}>&#8250;</button>
        </div>
        <div class="range-cal-grid" id="krkRpCalGrid"></div>
      `;

      panel.querySelector("#krkRpCalPrev").addEventListener("click", () => {
        const [y, m] = calMonth.split("-").map(Number);
        const prev = new Date(y, m - 2, 1);
        calMonth = prev.getFullYear() + "-" + String(prev.getMonth() + 1).padStart(2, "0");
        renderCalPanel(panel);
      });
      panel.querySelector("#krkRpCalNext").addEventListener("click", () => {
        const [y, m] = calMonth.split("-").map(Number);
        const next = new Date(y, m, 1);
        calMonth = next.getFullYear() + "-" + String(next.getMonth() + 1).padStart(2, "0");
        renderCalPanel(panel);
      });

      const grid = panel.querySelector("#krkRpCalGrid");
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
      const btn = document.getElementById("krkRangeBtn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      popup.style.top = rect.bottom + 6 + "px";
      popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 270 - 32)) + "px";
    }
    positionPopup();
    _krkRangeScrollListener = positionPopup;
    const sc = document.querySelector(".page-content");
    if (sc) sc.addEventListener("scroll", _krkRangeScrollListener);
    _krkRangeDocListener = () => closeRangePicker();
    setTimeout(() => document.addEventListener("click", _krkRangeDocListener), 0);
  }

  function openGridRangePicker(dates) {
    const isWeekly = krkPeriod === "weekly";
    const map = isWeekly ? getWeekMap(dates) : getMonthMap(dates);
    const items = Object.keys(map).map(k => isWeekly
      ? { key: k, label: "W" + k.split("-W")[1] }
      : { key: k, label: KPI.formatMonthYear(k) }
    );

    let pickStart = Math.max(0, items.length - 7);
    let pickEnd = items.length - 1;
    if (krkSelectedItems && krkSelectedItems.length) {
      const s = items.findIndex(i => i.key === krkSelectedItems[0]);
      const e = items.findIndex(i => i.key === krkSelectedItems[krkSelectedItems.length - 1]);
      if (s !== -1 && e !== -1) { pickStart = s; pickEnd = e; }
    }

    let clickPhase = 0;
    closeRangePicker();

    const popup = document.createElement("div");
    popup.className = "range-picker-popup krk-range-picker-popup";
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
          <button class="range-picker-close" id="krkRpClose">×</button>
        </div>
        <div class="range-picker-grid" id="krkRpGrid"></div>
        <div class="range-picker-footer">
          <button class="range-picker-reset" id="krkRpReset">Reset</button>
          <button class="range-picker-apply" id="krkRpApply">Terapkan</button>
        </div>
      `;

      const grid = popup.querySelector("#krkRpGrid");
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

      popup.querySelector("#krkRpClose").addEventListener("click", closeRangePicker);
      popup.querySelector("#krkRpReset").addEventListener("click", () => {
        krkSelectedItems = null;
        krkSelectedFrom = null;
        krkSelectedTo = null;
        closeRangePicker();
        renderTable();
      });
      popup.querySelector("#krkRpApply").addEventListener("click", () => {
        krkSelectedItems = items.slice(pickStart, pickEnd + 1).map(i => i.key);
        krkSelectedFrom = null;
        krkSelectedTo = null;
        closeRangePicker();
        renderTable();
      });
    }

    renderGrid();
    document.body.appendChild(popup);

    function positionPopup() {
      const btn = document.getElementById("krkRangeBtn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      popup.style.top = rect.bottom + 6 + "px";
      popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 300 - 32)) + "px";
    }
    positionPopup();
    _krkRangeScrollListener = positionPopup;
    const sc = document.querySelector(".page-content");
    if (sc) sc.addEventListener("scroll", _krkRangeScrollListener);
    _krkRangeDocListener = () => closeRangePicker();
    setTimeout(() => document.addEventListener("click", _krkRangeDocListener), 0);
  }

  // ══════════════════════════════════════
  //  EXPORT
  // ══════════════════════════════════════

  function exportTable() {
    const table = document.querySelector("#krkTableWrap .data-table");
    if (!table) return;

    const wb = XLSX.utils.book_new();
    const ws = exportSheetWithRaw(table);
    XLSX.utils.book_append_sheet(wb, ws, "Karkas");
    XLSX.writeFile(wb, `Karkas_${krkPeriod}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function destroy() {
    if (_stickyCleanup) { _stickyCleanup(); _stickyCleanup = null; }
  }

  return { render, destroy };
})();
