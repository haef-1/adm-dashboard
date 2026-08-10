/* ═══════════════════════════════════════
   CUT-UP.JS — Halaman Chart Departemen "CUT UP"
   ═══════════════════════════════════════ */

const CutUpPage = (() => {
  const DEPT = 'CUT UP';

  // Lima warna pertama untuk lima item teratas, warna terakhir khusus
  // "Item Lainnya" — indeksnya dipatok, bukan diambil berurutan, supaya
  // slice agregat itu tetap ungu meski itemnya kurang dari lima.
  const COLORS = ['#3b7ddd', '#f2622a', '#10b981', '#f59e0b', '#85B7EB'];
  const COLOR_OTHER = '#8b5cf6';

  const TOP_N = 5;
  const FONT = "'Plus Jakarta Sans', Helvetica, Arial, sans-serif";

  // Ketebalan tiap slice sebagai pecahan lebar cincin — tebal, tipis, tebal,
  // tipis, dengan amplitudo yang tidak seragam supaya konturnya tidak terbaca
  // mekanis. Enam nilai cukup: donut ini paling banyak 5 item + Item Lainnya.
  const THICK_PATTERN = [1.00, 0.68, 0.90, 0.62, 0.84, 0.72];

  // Bayangan tepi dalam: seberapa gelap di tepi, seberapa jauh ke luar
  // gelapnya luruh (pecahan dari lebar cincin slice itu sendiri — jadi slice
  // tipis dapat bayangan yang proporsional, bukan setebal slice gemuk), dan
  // berapa sisa gelap yang tetap dipertahankan sesudahnya. Sisa itu sengaja
  // tidak nol: kalau gradasinya menyatu habis dengan warna utama, batas
  // akhirnya terlihat sebagai garis dan sisa cincinnya jadi rata mati.
  const INNER_SHADE = 0.22;
  const INNER_SHADE_SPAN = 0.28;
  const INNER_SHADE_FLOOR = 0.20;   // fraksi dari INNER_SHADE yang tersisa

  const PV_OPTIONS = [
    { value: 'AYAM BARU', label: 'Ayam Baru' },
    { value: 'AYAM LAMA', label: 'Ayam Lama' },
    { value: 'AYAM PROSES', label: 'Ayam Proses' },
  ];

  // ── State per section ──
  // KPI dan chart punya filter sendiri-sendiri: mengubah tanggal di satu
  // section tidak menggeser yang lain, sama seperti Overview yang memisahkan
  // navigasi tanggal KPI dari kontrol grafik Bahan.
  const SC = {
    kpi:   { key: 'kpi',   unit: 'kg', pv: 'AYAM BARU',   from: null, to: null },
    chart: { key: 'chart', unit: 'kg', pv: 'AYAM PROSES', from: null, to: null },
  };

  let cuExpanded = false;
  let cuDetailOpen = false;   // tabel menggantikan donut
  let cuCanvas = null, cuRo = null, cuHover = -1, cuLayout = null;
  let _rangeDocListener = null, _rangeScrollListener = null;
  let _datesCache = null, _datesRawLen = -1;
  let _aggCache = new Map(), _aggRawLen = -1;

  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  // Id elemen diturunkan dari nama section supaya dua salinan kontrol yang
  // identik tidak pernah bertabrakan id-nya.
  function eid(s, name) { return 'cu' + s.key.charAt(0).toUpperCase() + s.key.slice(1) + name; }
  function el(s, name) { return document.getElementById(eid(s, name)); }

  // ═══════════════════════════════════════
  //  DATA
  // ═══════════════════════════════════════

  // Daftar tanggal dibatasi pada hari yang benar-benar punya baris CUT UP.
  // Kalau memakai Engine.getAvailableDates(), tombol ‹ › bisa mendarat di
  // hari yang cuma berisi departemen lain dan seluruh halaman terbaca nol.
  function cuAllDates() {
    const raw = Engine.getRawDB();
    if (_datesCache && _datesRawLen === raw.length) return _datesCache;
    const L = Engine.getLookups();
    const dI = L.dept.indexOf(DEPT);
    const set = new Set();
    if (dI !== -1) {
      for (let i = 0; i < raw.length; i++) if (raw[i][0] === dI) set.add(raw[i][8]);
    }
    _datesCache = [...set].sort();
    _datesRawLen = raw.length;
    return _datesCache;
  }

  function rangeDates(s) {
    const dates = cuAllDates();
    if (!dates.length) return [];
    if (!s.from || !s.to) return [dates[dates.length - 1]];
    return dates.filter(d => d >= s.from && d <= s.to);
  }

  // Jendela sebelumnya dengan panjang yang sama, dihitung dalam hari produksi
  // (bukan hari kalender) supaya libur tidak menggeser pembandingnya.
  function prevRangeDates(s) {
    const dates = cuAllDates();
    const cur = rangeDates(s);
    if (!cur.length) return [];
    const end = dates.indexOf(cur[0]) - 1;
    if (end < 0) return [];
    return dates.slice(Math.max(0, end - cur.length + 1), end + 1);
  }

  // Satu lintasan atas baris CUT UP: total BAHAN, total HASIL, dan rincian
  // HASIL per material. Identitas item dipatok ke r[4] (indeks matdesc);
  // R_MAT dan R_MATDESC tumbuh terpisah saat import, jadi R_MAT[r[4]] bukan
  // kode material dari baris yang sama.
  function cuAggregate(dateArr, pv) {
    const raw = Engine.getRawDB();
    if (_aggRawLen !== raw.length) { _aggCache = new Map(); _aggRawLen = raw.length; }
    const key = pv + '|' + dateArr.join(',');
    const hit = _aggCache.get(key);
    if (hit) return hit;

    const L = Engine.getLookups();
    const dI = L.dept.indexOf(DEPT);
    const hI = L.mvt.indexOf('HASIL');
    const bI = L.mvt.indexOf('BAHAN');
    // BAHAN dari sloc PACKAGING itu plastik/karton, bukan bahan baku yang
    // diolah — kalau ikut dijumlah, penyebut yield membengkak dan waste
    // ikut terbaca terlalu besar. Sengaja hanya BAHAN: HASIL yang masuk
    // PACKAGING tetap hasil produksi.
    const packI = L.sloc.indexOf('PACKAGING');
    const pvAll = pv === 'AYAM PROSES';
    const pI = pvAll ? -1 : L.pv.indexOf(pv);

    let bahanKg = 0, hasilKg = 0, bahanBrd = 0, hasilBrd = 0;
    const map = new Map();

    if (dI !== -1 && (pvAll || pI !== -1)) {
      const rows = Engine.getRowsForDates(dateArr);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r[0] !== dI) continue;
        if (!pvAll && r[1] !== pI) continue;
        if (r[5] === bI) {
          if (r[9] === packI) continue;
          bahanBrd += r[6]; bahanKg += r[7];
          continue;
        }
        if (r[5] !== hI) continue;
        hasilBrd += r[6]; hasilKg += r[7];
        let e = map.get(r[4]);
        if (!e) {
          e = { key: r[4], name: L.matdesc[r[4]] || '(tanpa nama)', brd: 0, kg: 0 };
          map.set(r[4], e);
        }
        e.brd += r[6]; e.kg += r[7];
      }
    }

    const out = { bahanKg, hasilKg, bahanBrd, hasilBrd, items: [...map.values()] };
    _aggCache.set(key, out);
    return out;
  }

  // Yield selalu berbasis KG apapun toggle-nya: pada CUT UP kolom BRD di sisi
  // HASIL berisi hitungan potongan, bukan ekor, jadi rasionya tidak sebanding
  // dengan BRD di sisi BAHAN.
  function cuYield(agg) {
    return agg.bahanKg ? (agg.hasilKg / agg.bahanKg) * 100 : null;
  }

  function sortedItems(agg, unit) {
    return agg.items.slice().sort((a, b) => b[unit] - a[unit]);
  }

  function cuSlices(agg, unit) {
    const sorted = sortedItems(agg, unit).filter(i => i[unit] > 0);
    const total = sorted.reduce((s, i) => s + i[unit], 0);
    const top = sorted.slice(0, TOP_N);
    const rest = sorted.slice(TOP_N);
    const slices = top.map((i, n) => ({
      name: i.name,
      val: i[unit],
      pct: total ? (i[unit] / total) * 100 : 0,
      color: COLORS[n],
    }));
    if (rest.length) {
      const v = rest.reduce((s, i) => s + i[unit], 0);
      slices.push({
        name: 'Item Lainnya',
        val: v,
        pct: total ? (v / total) * 100 : 0,
        color: COLOR_OTHER,
        count: rest.length,
      });
    }
    return { slices, total, restCount: rest.length };
  }

  // ═══════════════════════════════════════
  //  FORMAT
  // ═══════════════════════════════════════

  // Menggelapkan warna hex ke arah hitam. Dipakai untuk bayangan tepi dalam
  // slice — bukan warna terpisah, supaya tiap slice tetap terbaca satu warna.
  function darken(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * (1 - k));
    const g = Math.round(((n >> 8) & 255) * (1 - k));
    const b = Math.round((n & 255) * (1 - k));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function fmtNum(v) { return Math.round(v).toLocaleString('id-ID'); }
  function fmtPct(v, dp) { return v.toFixed(dp === undefined ? 1 : dp) + '%'; }
  function unitLabel(s) { return s.unit === 'brd' ? 'BRD' : 'kg'; }

  function fmtItemVal(s, val) {
    return fmtNum(val) + ' ' + unitLabel(s);
  }

  function fmtDateShort(d) {
    const [, m, dd] = d.split('-');
    return parseInt(dd, 10) + ' ' + MONTHS_SHORT[parseInt(m, 10) - 1];
  }

  function fmtDateFull(d) {
    if (!d) return '—';
    const [y, m, dd] = d.split('-');
    return parseInt(dd, 10) + ' ' + MONTHS_SHORT[parseInt(m, 10) - 1] + ' ' + y;
  }

  function rangeLabel(s) {
    const cur = rangeDates(s);
    if (!cur.length) return 'Tidak ada data';
    if (cur.length === 1) return fmtDateFull(cur[0]);
    const a = cur[0], b = cur[cur.length - 1];
    if (a.slice(0, 4) === b.slice(0, 4)) {
      return fmtDateShort(a) + ' – ' + fmtDateShort(b) + ' ' + b.slice(0, 4);
    }
    return fmtDateFull(a) + ' – ' + fmtDateFull(b);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ═══════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════

  function controlsHtml(s) {
    return `
      <div class="section-header cu-header">
        <div class="section-header-controls cu-controls">
          <div class="toggle-group" id="${eid(s, 'MetricToggle')}">
            <button class="toggle-btn" data-metric="brd">BRD</button>
            <button class="toggle-btn" data-metric="kg">KG</button>
          </div>
          <div id="${eid(s, 'PvWrap')}"></div>
          <div class="spacer"></div>
          <div id="${eid(s, 'RangeNav')}"></div>
        </div>
      </div>`;
  }

  function bindControls(s, onChange) {
    const toggle = el(s, 'MetricToggle');
    toggle.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.metric === s.unit);
      btn.addEventListener('click', () => {
        s.unit = btn.dataset.metric;
        toggle.querySelectorAll('.toggle-btn')
          .forEach(b => b.classList.toggle('active', b.dataset.metric === s.unit));
        onChange();
      });
    });

    const pvSel = DatePicker.createCustomSelect(PV_OPTIONS, s.pv, val => {
      s.pv = val;
      onChange();
    });
    el(s, 'PvWrap').appendChild(pvSel.el);
  }

  function render(container) {
    destroy();
    cuExpanded = false;
    cuHover = -1;

    // Rentang yang tersimpan bisa jadi sudah tidak punya data setelah import
    // baru; kembalikan ke default daripada menampilkan halaman kosong.
    const dates = cuAllDates();
    [SC.kpi, SC.chart].forEach(s => {
      if (s.from && s.to && !dates.some(d => d >= s.from && d <= s.to)) { s.from = null; s.to = null; }
    });

    container.innerHTML = `
      <div class="page-title">Cut Up</div>

      <div class="section" id="cuKpiSection">
        ${controlsHtml(SC.kpi)}
        <div class="cu-body">
          <div class="kpi-row cu-kpi-row" id="cuKpiRow"></div>
        </div>
      </div>

      <div class="section" id="cuChartSection">
        ${controlsHtml(SC.chart)}
        <div class="cu-body">
          <div class="cu-card" id="cuProdukCard">
            <div class="cu-card-head">
              <div class="cu-card-title" id="cuDonutTitle">5 Top Produk</div>
              <button type="button" class="traffic-detail-btn" id="cuDetailBtn" aria-expanded="false">
                <span class="traffic-detail-sign" id="cuDetailSign" aria-hidden="true">+</span>
                <span id="cuDetailLabel">Detail data</span>
              </button>
            </div>

            <!-- Dibungkus supaya mode detail cukup menyembunyikan satu elemen.
                 drawDonut() menyetel display pada kanvas dan .cu-empty lewat
                 style inline, dan itu tidak bisa dikalahkan rule CSS — tapi
                 induk yang display:none membuatnya tidak relevan. -->
            <div class="cu-donut-view" id="cuDonutView">
              <div class="cu-donut-wrap" id="cuDonutWrap">
                <canvas id="cuDonutCanvas"></canvas>
              </div>
              <div class="cu-donut-legend" id="cuDonutLegend"></div>
              <div class="cu-empty" id="cuDonutEmpty">Tidak ada data HASIL untuk periode ini</div>
            </div>

            <!-- Tampilan detail: tabel item. Menggantikan donut saat tombol
                 "Detail data" ditekan — filter di header section tetap yang
                 sama, jadi keduanya selalu memotret rentang yang sama. -->
            <div class="cu-detail" id="cuDetail" hidden>
              <div class="cu-table-wrap">
                <table class="cu-table" id="cuTable"></table>
              </div>
              <button type="button" class="cu-more-btn" id="cuMoreBtn"></button>
            </div>
          </div>
        </div>
      </div>
    `;

    bindControls(SC.kpi, refreshKpi);
    bindControls(SC.chart, refreshChart);

    document.getElementById('cuMoreBtn').addEventListener('click', () => {
      cuExpanded = !cuExpanded;
      renderTable();
    });

    document.getElementById('cuDetailBtn').addEventListener('click', () => {
      cuDetailOpen = !cuDetailOpen;
      applyDetailState();
      // Kanvas tidak bisa digambar selagi display:none — lebarnya nol, jadi
      // drawDonut() keluar lebih awal. Gambar ulang setelah kartunya terlihat.
      if (!cuDetailOpen) requestAnimationFrame(drawDonut);
    });
    applyDetailState();

    cuCanvas = document.getElementById('cuDonutCanvas');
    cuCanvas.addEventListener('mousemove', onCanvasMove);
    cuCanvas.addEventListener('mouseleave', () => {
      if (cuHover !== -1) { cuHover = -1; drawDonut(); }
    });

    cuRo = new ResizeObserver(() => requestAnimationFrame(drawDonut));
    cuRo.observe(document.getElementById('cuDonutWrap'));

    refreshKpi();
    refreshChart();
  }

  function refreshKpi() {
    renderRangeNav(SC.kpi, refreshKpi);
    renderKpis();
  }

  function refreshChart() {
    renderRangeNav(SC.chart, refreshChart);
    renderTable();
    drawDonut();
  }

  function applyDetailState() {
    const btn = document.getElementById('cuDetailBtn');
    if (btn) {
      btn.classList.toggle('is-open', cuDetailOpen);
      btn.setAttribute('aria-expanded', String(cuDetailOpen));
      const sign = document.getElementById('cuDetailSign');
      const label = document.getElementById('cuDetailLabel');
      if (sign) sign.textContent = cuDetailOpen ? '−' : '+';
      if (label) label.textContent = cuDetailOpen ? 'Collapse data' : 'Detail data';
    }
    document.getElementById('cuProdukCard')?.classList.toggle('detail-open', cuDetailOpen);
    const detail = document.getElementById('cuDetail');
    if (detail) detail.hidden = !cuDetailOpen;
  }

  function destroy() {
    closeRangePicker();
    if (cuRo) { cuRo.disconnect(); cuRo = null; }
    cuCanvas = null;
    cuLayout = null;
  }

  // ── Navigasi rentang ──
  function renderRangeNav(s, onChange) {
    const nav = el(s, 'RangeNav');
    if (!nav) return;
    const dates = cuAllDates();
    const cur = rangeDates(s);
    const atStart = !cur.length || dates.indexOf(cur[0]) <= 0;
    const atEnd = !cur.length || dates.indexOf(cur[cur.length - 1]) >= dates.length - 1;

    nav.innerHTML = `
      <div class="date-nav cu-range-nav">
        <button class="date-nav-btn" id="${eid(s, 'Prev')}" ${atStart ? 'disabled' : ''}>‹</button>
        <button class="chart-range-btn" id="${eid(s, 'RangeBtn')}">${esc(rangeLabel(s))}</button>
        <button class="date-nav-btn" id="${eid(s, 'Next')}" ${atEnd ? 'disabled' : ''}>›</button>
      </div>`;

    el(s, 'Prev').addEventListener('click', () => shift(s, -1, onChange));
    el(s, 'Next').addEventListener('click', () => shift(s, 1, onChange));
    el(s, 'RangeBtn').addEventListener('click', e => {
      e.stopPropagation();
      openRangePicker(s, onChange);
    });
  }

  // Geser jendela sejauh panjangnya sendiri, dihitung dalam hari produksi.
  function shift(s, dir, onChange) {
    const dates = cuAllDates();
    const cur = rangeDates(s);
    if (!cur.length) return;
    const n = cur.length;
    if (dir < 0) {
      const end = dates.indexOf(cur[0]) - 1;
      if (end < 0) return;
      s.from = dates[Math.max(0, end - n + 1)];
      s.to = dates[end];
    } else {
      const start = dates.indexOf(cur[n - 1]) + 1;
      if (start > dates.length - 1) return;
      s.from = dates[start];
      s.to = dates[Math.min(dates.length - 1, start + n - 1)];
    }
    onChange();
  }

  // ═══════════════════════════════════════
  //  KPI
  // ═══════════════════════════════════════

  // Kartu KPI memakai kelas bersama .kpi-card dari halaman Overview supaya
  // keduanya bergerak bareng kalau stylenya diubah — termasuk pil delta
  // lewat KPI.formatDelta, jadi arah panah dan warnanya konsisten.
  function kpiCard(label, valueHtml, delta) {
    return `
      <div class="kpi-card">
        <div class="kpi-card-label">${label}</div>
        <div class="kpi-card-body">
          <span class="kpi-card-value">${valueHtml}</span>
          ${delta ? `<span class="kpi-card-delta ${delta.cls}">${delta.text}</span>` : ''}
        </div>
      </div>`;
  }

  function renderKpis() {
    const row = document.getElementById('cuKpiRow');
    if (!row) return;
    const s = SC.kpi;

    const agg = cuAggregate(rangeDates(s), s.pv);
    const y = cuYield(agg);
    const waste = y === null ? null : 100 - y;

    const prev = prevRangeDates(s);
    const prevAgg = prev.length ? cuAggregate(prev, s.pv) : null;
    const prevY = prevAgg ? cuYield(prevAgg) : null;
    const prevWaste = prevY === null ? null : 100 - prevY;

    const bahan = s.unit === 'brd' ? agg.bahanBrd : agg.bahanKg;
    const hasil = s.unit === 'brd' ? agg.hasilBrd : agg.hasilKg;
    const prevBahan = prevAgg ? (s.unit === 'brd' ? prevAgg.bahanBrd : prevAgg.bahanKg) : null;
    const prevHasil = prevAgg ? (s.unit === 'brd' ? prevAgg.hasilBrd : prevAgg.hasilKg) : null;

    const u = unitLabel(s);
    row.innerHTML =
      // Waste dibalik: naik berarti buruk, jadi pilnya merah walau angkanya naik.
      kpiCard('Yield', (y === null ? '--' : y.toFixed(2)) + '<span class="unit">%</span>',
        y === null ? null : KPI.formatDelta(y, prevY, false)) +
      kpiCard('Waste', (waste === null ? '--' : waste.toFixed(2)) + '<span class="unit">%</span>',
        waste === null ? null : KPI.formatDelta(waste, prevWaste, true)) +
      kpiCard('Total Bahan', fmtNum(bahan) + '<span class="unit">' + u + '</span>',
        prevBahan === null ? null : KPI.formatDeltaInt(Math.round(bahan), Math.round(prevBahan))) +
      kpiCard('Total Hasil', fmtNum(hasil) + '<span class="unit">' + u + '</span>',
        prevHasil === null ? null : KPI.formatDeltaInt(Math.round(hasil), Math.round(prevHasil)));
  }

  // ═══════════════════════════════════════
  //  TABEL
  // ═══════════════════════════════════════

  function renderTable() {
    const table = document.getElementById('cuTable');
    const btn = document.getElementById('cuMoreBtn');
    if (!table || !btn) return;
    const s = SC.chart;

    const agg = cuAggregate(rangeDates(s), s.pv);
    const sorted = sortedItems(agg, s.unit).filter(i => i[s.unit] > 0);
    const total = sorted.reduce((acc, i) => acc + i[s.unit], 0);
    const shown = cuExpanded ? sorted : sorted.slice(0, TOP_N);

    if (!shown.length) {
      table.innerHTML = `<tbody><tr><td class="cu-td-empty">Tidak ada data HASIL untuk periode ini</td></tr></tbody>`;
      btn.style.display = 'none';
      return;
    }

    table.innerHTML = `
      <thead>
        <tr>
          <th class="cu-th-no">No</th>
          <th>Nama Item</th>
          <th class="cu-num">Jumlah (${unitLabel(s)})</th>
          <th class="cu-num">Persentase (%)</th>
        </tr>
      </thead>
      <tbody>
        ${shown.map((it, i) => {
          const v = it[s.unit];
          const pct = total ? (v / total) * 100 : 0;
          const dot = i < TOP_N ? `<span class="cu-dot" style="background:${COLORS[i]}"></span>` : '';
          return `<tr>
            <td class="cu-th-no">${i + 1}.</td>
            <td class="cu-td-name">${dot}${esc(it.name)}</td>
            <td class="cu-num">${fmtNum(v)}</td>
            <td class="cu-num">${fmtPct(pct)}</td>
          </tr>`;
        }).join('')}
      </tbody>`;

    const rest = sorted.length - TOP_N;
    if (rest > 0) {
      btn.style.display = '';
      btn.textContent = cuExpanded
        ? 'Tampilkan 5 Teratas Saja'
        : 'Lihat Semua Item Lainnya (' + rest + ')';
    } else {
      btn.style.display = 'none';
    }
  }

  // ═══════════════════════════════════════
  //  DONUT
  // ═══════════════════════════════════════

  function drawDonut() {
    const wrap = document.getElementById('cuDonutWrap');
    const empty = document.getElementById('cuDonutEmpty');
    const legendEl = document.getElementById('cuDonutLegend');
    const titleEl = document.getElementById('cuDonutTitle');
    if (!cuCanvas || !wrap || !empty) return;
    const s = SC.chart;

    const agg = cuAggregate(rangeDates(s), s.pv);
    const { slices, total } = cuSlices(agg, s.unit);

    if (titleEl) {
      titleEl.textContent = '5 Top Produk (' + unitLabel(s) + ')';
    }

    if (!slices.length || !total) {
      cuCanvas.style.display = 'none';
      legendEl.innerHTML = '';
      empty.style.display = 'block';
      cuLayout = null;
      return;
    }
    cuCanvas.style.display = 'block';
    empty.style.display = 'none';

    const CW = wrap.clientWidth;
    if (!CW) return;

    // Di lebar sempit label bercabang tidak muat — donutnya dibesarkan dan
    // keterangannya pindah ke daftar HTML di bawah kanvas.
    const compact = CW < 460;
    const H = compact ? 260 : 330;
    const cx = CW / 2, cy = H / 2;
    const R = compact
      ? Math.min(CW * 0.34, H * 0.42)
      : Math.max(70, Math.min((CW - 250) / 2, H * 0.42));
    // Batas dalam slice tertebal — sekaligus titik tersempit lubang, karena
    // slice yang lebih tipis menyusut ke arah luar dan melebarkan lubang di
    // sektornya. 0.51 (bukan 0.62) supaya cincinnya cukup tebal untuk
    // menampung selisih kontur; dengan lubang lama selisihnya cuma ~19 px.
    const inner = R * 0.51;

    const DPR = devicePixelRatio || 1;
    cuCanvas.width = CW * DPR; cuCanvas.height = H * DPR;
    cuCanvas.style.width = CW + 'px'; cuCanvas.style.height = H + 'px';
    const ctx = cuCanvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, CW, H);

    const angles = [];
    let a = -Math.PI / 2;
    for (const sl of slices) {
      const sweep = (sl.pct / 100) * Math.PI * 2;
      angles.push({ a0: a, a1: a + sweep });
      a += sweep;
    }

    // Lubang tengah tetap, tepi luar naik-turun berselang-seling supaya
    // membentuk kontur bergelombang. Ketebalannya hiasan, bukan data —
    // besaran tiap slice tetap dibaca dari sudut dan label persennya.
    //
    // Polanya dipatok, bukan diacak: hover memicu drawDonut() lagi, dan
    // ketebalan acak akan membuat donut berubah bentuk tiap kursor lewat.
    //
    // Jangkarnya slice bernilai terbesar, bukan indeks 0. Keduanya biasanya
    // sama karena slice sudah terurut menurun, kecuali saat "Item Lainnya"
    // melampaui item teratas — misal 100 item kecil, top-5 cuma 5% dan
    // sisanya 95%. Ia selalu ditaruh paling belakang, jadi tanpa penjangkaran
    // ini slice terbesar di layar justru yang paling tipis.
    const BAND = R - inner;
    // Semua slice dipusatkan di radius yang sama, lalu tebalnya dibagi rata
    // ke dalam dan ke luar. Jadi konturnya muncul di dua sisi: tepi luar
    // bergelombang, dan lubang tengahnya ikut melebar-menyempit.
    const midR = (inner + R) / 2;
    const maxIdx = slices.reduce((best, sl, i) => (sl.pct > slices[best].pct ? i : best), 0);
    const thick = slices.map((_, i) => {
      const step = (i - maxIdx + slices.length) % slices.length;
      return BAND * THICK_PATTERN[step % THICK_PATTERN.length];
    });
    const innerR = thick.map(t => midR - t / 2);
    const outerR = thick.map(t => midR + t / 2);
    // Hover melebar ke luar saja — kalau ikut ke dalam, slice-nya menjorok ke
    // ruang teks total dan angkanya tertimpa warna.
    const rOf = i => outerR[i] + (i === cuHover ? 7 : 0);

    cuLayout = { cx, cy, R, inner, innerR, outerR, angles, H, CW, compact };

    // ── Slice ──
    slices.forEach((sl, i) => {
      const { a0, a1 } = angles[i];
      ctx.beginPath();
      ctx.arc(cx, cy, rOf(i), a0, a1);
      ctx.arc(cx, cy, innerR[i], a1, a0, true);
      ctx.closePath();
      // Bayangan di tepi dalam — memberi kesan cincin punya ketebalan, bukan
      // pelat datar. Gelapnya luruh dalam INNER_SHADE_SPAN pertama lebar
      // cincin, lalu berhenti di sisa INNER_SHADE_FLOOR, tidak sampai nol.
      const rest = darken(sl.color, INNER_SHADE * INNER_SHADE_FLOOR);
      const grad = ctx.createRadialGradient(cx, cy, innerR[i], cx, cy, rOf(i));
      grad.addColorStop(0, darken(sl.color, INNER_SHADE));
      grad.addColorStop(INNER_SHADE_SPAN, rest);
      grad.addColorStop(1, rest);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // ── Persen di dalam slice ──
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    slices.forEach((sl, i) => {
      if (sl.pct < 5) return;
      const { a0, a1 } = angles[i];
      const mid = (a0 + a1) / 2;
      const rr = (innerR[i] + rOf(i)) / 2;
      ctx.fillStyle = '#fff';
      ctx.font = '700 13px ' + FONT;
      ctx.fillText(Math.round(sl.pct) + '%', cx + Math.cos(mid) * rr, cy + Math.sin(mid) * rr);
    });

    // ── Total di tengah ──
    ctx.fillStyle = '#6b7094';
    ctx.font = '600 10px ' + FONT;
    ctx.fillText('TOTAL HASIL', cx, cy - 12);
    ctx.fillStyle = '#1a1d2e';
    // Lubangnya lebih sempit sekarang, jadi angka besar bisa melewati tepi
    // dalam. Kecilkan fontnya sampai muat daripada membiarkannya menabrak
    // warna slice.
    const totalText = fmtNum(total) + ' ' + unitLabel(s);
    const holeW = inner * 2 - 16;
    let fs = compact ? 16 : 18;
    ctx.font = '800 ' + fs + 'px ' + FONT;
    while (fs > 10 && ctx.measureText(totalText).width > holeW) {
      fs -= 1;
      ctx.font = '800 ' + fs + 'px ' + FONT;
    }
    ctx.fillText(totalText, cx, cy + 9);

    if (compact) {
      legendEl.innerHTML = slices.map(sl => `
        <div class="cu-leg">
          <span class="cu-dot" style="background:${sl.color}"></span>
          <span class="cu-leg-name">${esc(sl.name)}${sl.count ? ' (' + sl.count + ')' : ''}</span>
          <span class="cu-leg-val">${fmtItemVal(s, sl.val)}</span>
        </div>`).join('');
      return;
    }
    legendEl.innerHTML = '';

    drawCallouts(ctx, s, slices, angles, outerR, cx, cy, R, H, CW);
  }

  function drawCallouts(ctx, s, slices, angles, outerR, cx, cy, R, H, CW) {
    const LINE_H = 14, GAP = 32, MARGIN = 10;

    const nodes = slices.map((sl, i) => {
      const mid = (angles[i].a0 + angles[i].a1) / 2;
      return {
        i, s: sl, mid,
        right: Math.cos(mid) >= 0,
        // Titik awal mengikuti tepi slice-nya sendiri, tapi kolom siku dan
        // teksnya tetap dipatok ke R supaya semua label lurus satu garis.
        y: cy + Math.sin(mid) * (outerR[i] + 16),
      };
    });

    // Dorong label yang bertumpuk supaya tidak saling menimpa, per sisi.
    // Penggeserannya harus per-grup, bukan per-node: menjepit tiap node satu
    // per satu ke batas atas justru merapatkan kembali label yang barusan
    // direnggangkan — slice tipis di dekat jam 12 paling sering kena.
    const top = MARGIN + LINE_H;
    const bottom = H - MARGIN - LINE_H;
    const avail = bottom - top;

    [true, false].forEach(side => {
      const group = nodes.filter(n => n.right === side).sort((a, b) => a.y - b.y);
      if (!group.length) return;

      // Kalau labelnya lebih banyak daripada ruang yang ada, jarak ideal tidak
      // mungkin dipenuhi — bagi rata saja supaya jaraknya seragam.
      if ((group.length - 1) * GAP > avail) {
        const step = group.length > 1 ? avail / (group.length - 1) : 0;
        group.forEach((n, i) => { n.y = top + i * step; });
        return;
      }

      for (let i = 1; i < group.length; i++) {
        if (group[i].y - group[i - 1].y < GAP) group[i].y = group[i - 1].y + GAP;
      }
      const over = group[group.length - 1].y - bottom;
      if (over > 0) group.forEach(n => { n.y -= over; });
      const under = top - group[0].y;
      if (under > 0) group.forEach(n => { n.y += under; });
    });

    ctx.textBaseline = 'middle';
    nodes.forEach(n => {
      const dir = n.right ? 1 : -1;
      const edge = outerR[n.i] + 2;
      const x0 = cx + Math.cos(n.mid) * edge;
      const y0 = cy + Math.sin(n.mid) * edge;
      const xElbow = cx + dir * (R + 18);
      const xText = cx + dir * (R + 30);

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(xElbow, n.y);
      ctx.lineTo(xText - dir * 6, n.y);
      ctx.strokeStyle = n.s.color;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(xText - dir * 6, n.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = n.s.color;
      ctx.fill();

      ctx.textAlign = n.right ? 'left' : 'right';
      const maxW = n.right ? CW - xText - 6 : xText - 6;

      ctx.font = '600 11.5px ' + FONT;
      ctx.fillStyle = '#1a1d2e';
      let name = n.s.name;
      if (n.s.count) name += ' (' + n.s.count + ')';
      ctx.fillText(clip(ctx, name, maxW), xText, n.y - 6);

      ctx.font = '600 11px ' + FONT;
      ctx.fillStyle = '#6b7094';
      ctx.fillText(clip(ctx, fmtItemVal(s, n.s.val), maxW), xText, n.y + 7);
    });
  }

  function clip(ctx, text, maxW) {
    if (maxW <= 8) return '';
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  function onCanvasMove(e) {
    if (!cuLayout) return;
    const rect = cuCanvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const dx = mx - cuLayout.cx, dy = my - cuLayout.cy;
    const dist = Math.hypot(dx, dy);

    // Sudut dinormalkan ke [-π/2, 3π/2) supaya sebanding dengan a0/a1 yang
    // mulai dari jam 12.
    let ang = Math.atan2(dy, dx);
    if (ang < -Math.PI / 2) ang += Math.PI * 2;
    const idx = cuLayout.angles.findIndex(a => ang >= a.a0 && ang < a.a1);
    // Kedua batas beda-beda tiap slice sekarang, jadi jaraknya diuji ke
    // cincin slice yang bersangkutan — bukan ke satu lubang dan satu R
    // global. Tanpa ini, ruang kosong di dalam maupun di luar slice tipis
    // ikut terbaca sebagai hover.
    const hit = (idx !== -1 && dist >= cuLayout.innerR[idx] && dist <= cuLayout.outerR[idx] + 7)
      ? idx : -1;
    if (hit !== cuHover) {
      cuHover = hit;
      cuCanvas.style.cursor = hit === -1 ? 'default' : 'pointer';
      drawDonut();
    }
  }

  // ═══════════════════════════════════════
  //  RANGE PICKER
  // ═══════════════════════════════════════

  function openRangePicker(s, onChange) {
    const dates = cuAllDates();
    if (!dates.length) return;

    const availSet = new Set(dates);
    const allMonths = [...new Set(dates.map(d => d.slice(0, 7)))];
    const cur = rangeDates(s);
    let fromDate = s.from || (cur.length ? cur[0] : dates[dates.length - 1]);
    let toDate = s.to || (cur.length ? cur[cur.length - 1] : dates[dates.length - 1]);
    let clickPhase = 0;
    let calMonth = (fromDate || dates[dates.length - 1]).slice(0, 7);

    closeRangePicker();

    const popup = document.createElement('div');
    popup.className = 'range-picker-popup range-picker-daily cu-range-picker-popup';
    popup.addEventListener('click', e => e.stopPropagation());
    popup.addEventListener('wheel', e => {
      e.preventDefault();
      document.querySelector('.page-content')?.scrollBy({ top: e.deltaY });
    }, { passive: false });

    function renderAll() {
      const hint = clickPhase === 0 ? 'Pilih tanggal mulai' : 'Pilih tanggal akhir';
      popup.innerHTML = `
        <div class="range-picker-header"><span class="range-picker-title">${hint}</span><button class="range-picker-close" id="rpClose">×</button></div>
        <div class="range-daily-summary">
          <div class="range-daily-summary-field ${clickPhase === 0 ? 'is-active' : ''}"><div class="range-daily-summary-label">Dari</div><div class="range-daily-summary-val">${fmtDateFull(fromDate)}</div></div>
          <div class="range-daily-summary-arrow">→</div>
          <div class="range-daily-summary-field ${clickPhase === 1 ? 'is-active' : ''}"><div class="range-daily-summary-label">Sampai</div><div class="range-daily-summary-val">${fmtDateFull(toDate)}</div></div>
        </div>
        <div class="range-cal-panel" id="rpCalPanel"></div>
        <div class="range-picker-footer"><button class="range-picker-reset" id="rpReset">Reset</button><button class="range-picker-apply" id="rpApply" ${!fromDate || !toDate || clickPhase === 1 ? 'disabled' : ''}>Terapkan</button></div>
      `;
      popup.querySelector('#rpClose').addEventListener('click', closeRangePicker);
      popup.querySelector('#rpReset').addEventListener('click', () => {
        closeRangePicker();
        s.from = null; s.to = null;
        onChange();
      });
      popup.querySelector('#rpApply').addEventListener('click', () => {
        if (fromDate && toDate) {
          s.from = fromDate <= toDate ? fromDate : toDate;
          s.to = fromDate <= toDate ? toDate : fromDate;
        } else {
          s.from = null; s.to = null;
        }
        closeRangePicker();
        onChange();
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
        const cell = document.createElement('div');
        cell.className = 'range-cal-dow';
        cell.textContent = d;
        grid.appendChild(cell);
      });
      const firstDay = new Date(yr, mo - 1, 1);
      let startDow = firstDay.getDay(); startDow = startDow === 0 ? 6 : startDow - 1;
      for (let i = 0; i < startDow; i++) {
        grid.appendChild(Object.assign(document.createElement('div'), { className: 'range-cal-cell' }));
      }

      const daysInMonth = new Date(yr, mo, 0).getDate();
      const todayStr = new Date().toISOString().slice(0, 10);
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = calMonth + '-' + String(d).padStart(2, '0');
        const hasData = availSet.has(dateStr);
        const isFuture = dateStr > todayStr;
        const inRange = from && to && dateStr >= from && dateStr <= to;
        const isEndpoint = dateStr === fromDate || dateStr === toDate;
        const cell = document.createElement('div');
        cell.className = 'range-cal-cell' + (!isFuture ? ' available' : '') +
          (!hasData && !isFuture ? ' no-data' : '') +
          (inRange ? ' in-range' : '') + (isEndpoint ? ' is-endpoint' : '');
        cell.innerHTML = '<span>' + d + '</span>';
        if (!isFuture) {
          cell.addEventListener('click', () => {
            if (clickPhase === 0) { fromDate = dateStr; toDate = null; clickPhase = 1; }
            else {
              toDate = dateStr;
              if (toDate < fromDate) { const t = fromDate; fromDate = toDate; toDate = t; }
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
    positionPopup(popup, eid(s, 'RangeBtn'));
    _rangeScrollListener = () => positionPopup(popup, eid(s, 'RangeBtn'));
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
    if (_rangeScrollListener) {
      const sc = document.querySelector('.page-content');
      if (sc) sc.removeEventListener('scroll', _rangeScrollListener);
      _rangeScrollListener = null;
    }
    document.querySelector('.cu-range-picker-popup')?.remove();
  }

  return { render, destroy };
})();
