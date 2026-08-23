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

  // Ukuran kanvas donut. H_BASE dan R hasil hitungan lebar adalah titik
  // berangkat, bukan harga mati: keduanya dikoreksi fitCallouts() sesuai
  // ruang yang benar-benar dibutuhkan labelnya.
  const H_BASE = 330;      // tinggi kanvas mode callout
  const H_COMPACT = 260;   // tinggi kanvas mode legend
  const H_MAX = 470;       // batas atas pertumbuhan tinggi
  const H_STEP = 30;
  const R_MIN = 70;        // di bawah ini donutnya tidak lagi terbaca
  const R_STEP = 8;

  // Di bawah lebar ini label tidak lagi dibagi ke kiri dan kanan: donutnya
  // digeser merapat ke kiri dan seluruh label memakai satu kolom di kanan.
  // Dua kolom sempit selalu kalah dari satu kolom yang lebar.
  const NARROW_W = 460;
  const EDGE_L = 6;        // jarak donut ke tepi kiri di mode satu kolom
  const MIN_COL = 90;      // kolom teks tersempit yang masih layak dipakai
  // Kalau bahkan pada R_MIN kolom teksnya masih lebih sempit dari MIN_COL,
  // kanvasnya memang tidak muat untuk callout dalam bentuk apa pun — barulah
  // daftar keterangan di bawah donut dipakai.
  const LEGEND_W = 2 * R_MIN + EDGE_L + MIN_COL + 24;

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
  let cuCanvas = null, cuRo = null;
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
    // Kutip ganda ikut di-escape karena hasil esc() juga dipakai di dalam
    // atribut (title nama item pada tabel detail).
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

    // Baris agregat sisanya — pasangan tabel dari slice "Item Lainnya" di
    // donut, jadi kelima baris teratas plus baris ini selalu genap 100%.
    // Saat daftar dibentangkan tiap itemnya sudah punya barisnya sendiri,
    // jadi baris agregatnya ditiadakan.
    const restItems = cuExpanded ? [] : sorted.slice(TOP_N);
    const restVal = restItems.reduce((acc, i) => acc + i[s.unit], 0);

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
          return `<tr>
            <td class="cu-th-no">${i + 1}.</td>
            <td class="cu-td-name" title="${esc(it.name)}">${esc(it.name)}</td>
            <td class="cu-num"><span class="cu-num-val cu-num-qty">${fmtNum(v)}</span></td>
            <td class="cu-num"><span class="cu-num-val cu-num-pct">${fmtPct(pct)}</span></td>
          </tr>`;
        }).join('')}
        ${restItems.length ? `<tr class="cu-row-other">
          <td class="cu-th-no">${shown.length + 1}.</td>
          <td class="cu-td-name" title="Gabungan ${restItems.length} item di luar 5 teratas">Item Lainnya (${restItems.length})</td>
          <td class="cu-num"><span class="cu-num-val cu-num-qty">${fmtNum(restVal)}</span></td>
          <td class="cu-num"><span class="cu-num-val cu-num-pct">${fmtPct(total ? (restVal / total) * 100 : 0)}</span></td>
        </tr>` : ''}
      </tbody>`;

    const rest = sorted.length - TOP_N;
    if (rest > 0) {
      btn.style.display = '';
      btn.textContent = cuExpanded
        ? 'tampilkan 5 teratas saja'
        : 'lihat semua item lainnya (' + rest + ')';
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
      return;
    }
    cuCanvas.style.display = 'block';
    empty.style.display = 'none';

    const CW = wrap.clientWidth;
    if (!CW) return;

    // Tiga tata letak, dipilih menurut lebar yang tersedia:
    //   lebar  → donut di tengah, label terbagi kiri dan kanan
    //   sempit → donut merapat ke kiri, semua label satu kolom di kanan
    //   mepet  → tidak ada ruang untuk callout sama sekali, pakai daftar
    const legendOnly = CW < LEGEND_W;
    const oneSided = !legendOnly && CW < NARROW_W;

    const angles = [];
    let a = -Math.PI / 2;
    for (const sl of slices) {
      const sweep = (sl.pct / 100) * Math.PI * 2;
      angles.push({ a0: a, a1: a + sweep });
      a += sweep;
    }

    const ctx = cuCanvas.getContext('2d');

    // Ukuran donut mengikuti labelnya, bukan sebaliknya: fitCallouts() memilih
    // R terbesar yang masih menulis semua nama utuh, lalu H terkecil yang
    // membuat tumpukan labelnya muat. Di mode daftar tidak ada callout, jadi
    // ukurannya tetap seperti semula.
    let H, R, geom, plan = null;
    if (legendOnly) {
      H = H_COMPACT;
      R = Math.min(CW * 0.34, H * 0.42);
      geom = ringGeometry(slices, CW / 2, H / 2, R);
    } else {
      const fit = fitCallouts(ctx, s, slices, angles, CW, oneSided);
      H = fit.H; R = fit.R; geom = fit.geom; plan = fit.plan;
    }
    const { cx, cy, inner, innerR, outerR } = geom;

    const DPR = devicePixelRatio || 1;
    cuCanvas.width = CW * DPR; cuCanvas.height = H * DPR;
    cuCanvas.style.width = CW + 'px'; cuCanvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, CW, H);

    // ── Slice ──
    slices.forEach((sl, i) => {
      const { a0, a1 } = angles[i];
      ctx.beginPath();
      ctx.arc(cx, cy, outerR[i], a0, a1);
      ctx.arc(cx, cy, innerR[i], a1, a0, true);
      ctx.closePath();
      // Bayangan di tepi dalam — memberi kesan cincin punya ketebalan, bukan
      // pelat datar. Gelapnya luruh dalam INNER_SHADE_SPAN pertama lebar
      // cincin, lalu berhenti di sisa INNER_SHADE_FLOOR, tidak sampai nol.
      const rest = darken(sl.color, INNER_SHADE * INNER_SHADE_FLOOR);
      const grad = ctx.createRadialGradient(cx, cy, innerR[i], cx, cy, outerR[i]);
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
      const rr = (innerR[i] + outerR[i]) / 2;
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
    let fs = R < 100 ? 16 : 18;
    ctx.font = '800 ' + fs + 'px ' + FONT;
    while (fs > 10 && ctx.measureText(totalText).width > holeW) {
      fs -= 1;
      ctx.font = '800 ' + fs + 'px ' + FONT;
    }
    ctx.fillText(totalText, cx, cy + 9);

    if (legendOnly) {
      legendEl.innerHTML = slices.map(sl => `
        <div class="cu-leg">
          <span class="cu-dot" style="background:${sl.color}"></span>
          <span class="cu-leg-name">${esc(sl.name)}${sl.count ? ' (' + sl.count + ')' : ''}</span>
          <span class="cu-leg-val">${fmtItemVal(s, sl.val)}</span>
        </div>`).join('');
      return;
    }
    legendEl.innerHTML = '';

    drawCalloutNodes(ctx, plan.nodes, outerR, cx, cy);
  }

  // Geometri cincin untuk satu kandidat ukuran (pusat + R).
  //
  // Lubang tengah tetap, tepi luar naik-turun berselang-seling supaya
  // membentuk kontur bergelombang. Ketebalannya hiasan, bukan data — besaran
  // tiap slice tetap dibaca dari sudut dan label persennya.
  //
  // Polanya dipatok, bukan diacak: drawDonut() dipanggil ulang tiap resize dan
  // tiap data disegarkan, dan ketebalan acak akan membuat donut berubah bentuk
  // di setiap panggilan itu.
  //
  // Jangkarnya slice bernilai terbesar, bukan indeks 0. Keduanya biasanya
  // sama karena slice sudah terurut menurun, kecuali saat "Item Lainnya"
  // melampaui item teratas — misal 100 item kecil, top-5 cuma 5% dan sisanya
  // 95%. Ia selalu ditaruh paling belakang, jadi tanpa penjangkaran ini slice
  // terbesar di layar justru yang paling tipis.
  function ringGeometry(slices, cx, cy, R) {
    // Batas dalam slice tertebal — sekaligus titik tersempit lubang, karena
    // slice yang lebih tipis menyusut ke arah luar dan melebarkan lubang di
    // sektornya. 0.51 (bukan 0.62) supaya cincinnya cukup tebal untuk
    // menampung selisih kontur; dengan lubang lama selisihnya cuma ~19 px.
    const inner = R * 0.51;
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
    return {
      cx, cy, inner,
      innerR: thick.map(t => midR - t / 2),
      outerR: thick.map(t => midR + t / 2),
    };
  }

  // Hasil pencarian ukuran disimpan. Selain menghemat pengukuran teks yang
  // berulang, ini juga menghentikan putaran umpan balik dengan ResizeObserver:
  // menaikkan H mengubah tinggi kanvas → wrapper berubah ukuran → RO memicu
  // drawDonut() lagi. Dengan lebar yang sama, panggilan kedua memakai hasil
  // yang sama persis, jadi ukurannya langsung diam.
  let _fitCache = null;

  // Mencari ukuran donut yang membuat labelnya muat, dengan satu tuas untuk
  // tiap masalah:
  //
  //   nama terpotong  → masalah lebar → R dikecilkan (kolom teks melebar)
  //   label bertumpuk → masalah tinggi → H ditinggikan
  //
  // R sengaja tidak ikut membesar saat H tumbuh. Rumus lama mengikat R ke
  // H*0.42, jadi menaikkan H demi ruang label justru membesarkan donut dan
  // menggerus balik lebar teks yang baru saja didapat.
  function fitCallouts(ctx, s, slices, angles, CW, oneSided) {
    const key = CW + '|' + (oneSided ? '1' : '2') + '|' + s.unit + '|' +
      slices.map(sl => sl.name + '#' + Math.round(sl.val)).join('|');
    if (_fitCache && _fitCache.key === key) return _fitCache;

    // Di mode satu kolom donutnya menempel ke kiri, jadi mengecilkan R
    // menggeser pusatnya ikut ke kiri: kolom teks melebar dua kali lipat dari
    // tiap piksel R yang dilepas. R terbesarnya dibatasi supaya kolom kanan
    // tidak pernah lebih sempit dari MIN_COL.
    const rMax = oneSided
      ? Math.max(R_MIN, Math.min((CW - EDGE_L - MIN_COL - 24) / 2, H_BASE * 0.42))
      : Math.max(R_MIN, Math.min((CW - 250) / 2, H_BASE * 0.42));

    const geomFor = (R, H) =>
      ringGeometry(slices, oneSided ? EDGE_L + R : CW / 2, H / 2, R);

    // ── Lebar: kecilkan R sampai tidak ada nama yang terpotong ──
    let best = null;
    for (let r = rMax; r >= R_MIN - 0.001; r -= R_STEP) {
      const R = Math.max(r, R_MIN);
      const geom = geomFor(R, H_BASE);
      const plan = planCallouts(ctx, s, slices, angles, geom, R, H_BASE, CW, oneSided);
      // Perbandingannya ketat, jadi saat sama-sama bagus R yang lebih besar
      // yang bertahan — donut sebesar mungkin selama nama tetap utuh.
      if (!best || plan.clipped < best.plan.clipped) best = { R, geom, plan };
      if (!plan.clipped || R === R_MIN) break;
    }

    // ── Tinggi: tinggikan H sampai tumpukan label tidak lagi berdempetan ──
    let H = H_BASE, geom = best.geom, plan = best.plan;
    while (!plan.fits && H + H_STEP <= H_MAX) {
      H += H_STEP;
      geom = geomFor(best.R, H);
      plan = planCallouts(ctx, s, slices, angles, geom, best.R, H, CW, oneSided);
    }

    _fitCache = { key, R: best.R, H, geom, plan };
    return _fitCache;
  }

  const NAME_FONT = '600 11.5px ' + FONT;
  const VAL_FONT = '600 11px ' + FONT;
  const NAME_LINES_MAX = 2;

  // Sudut dinormalkan ke (-π, π] — dipakai untuk membandingkan arah dan
  // menentukan arah putar terpendek.
  function norm(t) {
    while (t <= -Math.PI) t += Math.PI * 2;
    while (t > Math.PI) t -= Math.PI * 2;
    return t;
  }

  // Sudut pangkal garis pada sebuah slice. Garis tidak harus berangkat dari
  // tengah slice — titik mana pun di busurnya sah, dan yang dipilih adalah
  // yang paling dekat ke arah labelnya. Untuk slice yang labelnya jauh
  // berseberangan, ini memindahkan pangkalnya ke tepi slice yang menghadap
  // label sehingga jalurnya jauh lebih pendek — sering malah tidak perlu
  // memutari donut sama sekali.
  //
  // Disisakan pad dari kedua batas supaya pangkalnya tidak jatuh tepat di
  // garis pemisah putih antar slice.
  function anchorAngle(a0, a1, theta) {
    const pad = Math.min((a1 - a0) * 0.25, 0.08);
    const lo = a0 + pad, hi = a1 - pad;
    if (hi <= lo) return (a0 + a1) / 2;
    const t = norm(theta - lo);
    if (t >= 0 && t <= hi - lo) return lo + t;
    return Math.abs(norm(theta - lo)) <= Math.abs(norm(theta - hi)) ? lo : hi;
  }

  // Slice mana yang menempati sudut ini.
  function sliceAt(angles, th) {
    const base = angles[0].a0;
    let t = th;
    while (t < base) t += Math.PI * 2;
    while (t >= base + Math.PI * 2) t -= Math.PI * 2;
    for (let i = 0; i < angles.length; i++) {
      if (t >= angles[i].a0 && t < angles[i].a1) return i;
    }
    return -1;
  }

  // Apakah jalur (polyline) menimpa cincin? Diuji terhadap cincin yang
  // sebenarnya — outerR per slice — bukan terhadap satu lingkaran rata-rata:
  // sebuah garis bisa saja tidak menyelam ke arah pusat tapi tetap lewat di
  // atas cincin slice tetangga yang lebih tebal. Slice miliknya sendiri
  // dikecualikan, karena di situlah garis itu memang berpangkal.
  function pathHitsRing(cx, cy, pts, angles, outerR, own, pad) {
    for (let k = 0; k + 1 < pts.length; k++) {
      const A = pts[k], B = pts[k + 1];
      const steps = Math.max(2, Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) / 6));
      for (let m = 1; m <= steps; m++) {
        const t = m / steps;
        const x = A.x + (B.x - A.x) * t, y = A.y + (B.y - A.y) * t;
        const r = Math.hypot(x - cx, y - cy);
        const idx = sliceAt(angles, Math.atan2(y - cy, x - cx));
        if (idx === -1 || idx === own) continue;
        if (r < outerR[idx] + pad) return true;
      }
    }
    return false;
  }

  // Titik-titik pada kurva kuadratik, untuk diuji seperti polyline biasa.
  function quadPoints(P0, C, P2, n) {
    const out = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, u = 1 - t;
      out.push({
        x: u * u * P0.x + 2 * u * t * C.x + t * t * P2.x,
        y: u * u * P0.y + 2 * u * t * C.y + t * t * P2.y,
      });
    }
    return out;
  }

  // Menghitung posisi, lebar teks, dan pemenggalan nama tiap label untuk satu
  // kandidat geometri — tanpa menggambar apa pun, supaya fitCallouts() bisa
  // mencoba beberapa ukuran sebelum memutuskan.
  function planCallouts(ctx, s, slices, angles, geom, R, H, CW, oneSided) {
    const { cx, cy, outerR } = geom;
    const LINE_H = 14, PAD = 10, MARGIN = 10;
    const LEAD = 18;    // panjang lengan siku di luar tepi slice
    const STUB = 12;    // jarak siku → awal teks
    const CLEAR = 10;   // jarak aman teks dari siluet donut
    const top = MARGIN, bottom = H - MARGIN;

    // Jangkar vertikal semua label memakai radius yang sama, bukan outerR
    // masing-masing. Cincinnya bergelombang, dan kalau jangkarnya ikut
    // bergelombang urutan y bawaan bisa menyimpang dari urutan sudut — padahal
    // urutan itulah yang menjaga garis tidak menyilang.
    const anchorR = R + 16;

    const nodes = slices.map((sl, i) => {
      const mid = (angles[i].a0 + angles[i].a1) / 2;
      let name = sl.name;
      if (sl.count) name += ' (' + sl.count + ')';
      const cos = Math.cos(mid);
      const a = norm(mid);
      const right = oneSided || cos >= 0;

      // Urutan kedatangan label: sejauh apa penghubungnya menempuh keliling
      // cincin, dihitung dari jam 12 menyusuri sisinya sendiri. Dengan label
      // terurut menurut kunci ini, jalur yang satu tidak perlu melangkahi
      // jalur yang lain — itu syarat cukup agar garisnya tidak menyilang.
      //
      // Mode satu kolom memakai sudut apa adanya: slice kiri-atas (a → -π)
      // menempuh jalur terpanjang lewat puncak sehingga labelnya paling atas,
      // dan slice kiri-bawah (a → π) lewat dasar sehingga labelnya paling
      // bawah. Mode dua kolom memakai kunci cermin untuk sisi kirinya.
      const key = oneSided || cos >= 0
        ? a
        : (a <= -Math.PI / 2 ? -Math.PI / 2 - a : Math.PI + Math.PI / 2 - a);

      // Posisi awal harus monoton terhadap key, kalau tidak sapuan perenggangan
      // justru harus menukar urutan. Slice paruh kiri di mode satu kolom tidak
      // punya ketinggian alami di kolom kanan; posisinya diatur belakangan
      // memakai ruang kosong di atas dan di bawah donut.
      const y = cy + Math.sin(mid) * anchorR;

      return {
        i, s: sl, mid, a, key, name, right, y,
        val: fmtItemVal(s, sl.val),
        // Jangkauan horizontal siku bila mengikuti rayonya sendiri. Slice di
        // dekat jam 3/9 menghasilkan nilai ≈ R (seperti sebelumnya), slice di
        // dekat jam 12/6 menghasilkan nilai mendekati nol — di situlah label
        // boleh merapat ke tengah dan memakai lebar kanvas yang selama ini
        // menganggur di atas dan bawah lingkaran.
        //
        // Slice yang berada di paruh kiri pada mode satu kolom tidak punya ray
        // ke kanan sama sekali; posisinya ditentukan siluet donut saja.
        ray: oneSided && cos < 0 ? 0 : Math.abs(cos) * (outerR[i] + LEAD),
        lines: [], valText: '', h: LINE_H * 2, w: 0, maxW: 0, xText: cx,
        aim: a, hugR: R + 6,
      };
    });

    // Slice paruh kiri di mode satu kolom: labelnya tidak bisa berada setinggi
    // slice-nya, jadi ditaruh di pita kosong di atas dan di bawah donut —
    // ruang yang selama ini menganggur — dan dibagi rata memenuhi pita itu.
    //
    // Dua keuntungan sekaligus: label paruh kanan tidak terdesak dari
    // ketinggian aslinya sehingga garisnya tetap pendek dan lurus, dan jalur
    // pelukan yang panjang itu berakhir dekat puncak atau dasar cincin — persis
    // di sebelah labelnya.
    if (oneSided) {
      const fill = (list, y0, y1) => {
        if (!list.length) return;
        const step = (y1 - y0) / list.length;
        list.forEach((n, k) => { n.y = y0 + step * (k + 0.5); });
      };
      const byKey = (x, z) => x.key - z.key;
      fill(nodes.filter(n => n.a < -Math.PI / 2).sort(byKey), top + LINE_H, cy - anchorR);
      fill(nodes.filter(n => n.a > Math.PI / 2).sort(byKey), cy + anchorR, bottom - LINE_H);
    }

    // Mengukur ulang satu label pada posisi y-nya saat ini: seberapa jauh ia
    // harus menyingkir dari donut, berapa lebar teks yang tersisa sampai tepi
    // kanvas, dan berapa baris nama yang muat di lebar itu.
    function measure(n) {
      const dir = n.right ? 1 : -1;
      // Setengah lebar donut pada ketinggian label. Diukur dari tepi blok yang
      // paling dekat ke pusat, jadi tidak ada satu baris pun yang bisa
      // menimpa cincin. Di luar rentang lingkaran nilainya nol — label bebas
      // merapat ke tengah.
      const dy = Math.max(0, Math.abs(n.y - cy) - n.h / 2);
      const silhouette = dy < R ? Math.sqrt(R * R - dy * dy) + CLEAR : 0;
      const off = Math.max(n.ray, silhouette);

      n.xText = cx + dir * (off + STUB);
      n.maxW = (n.right ? CW - n.xText : n.xText) - 6;

      ctx.font = NAME_FONT;
      n.lines = wrapText(ctx, n.name, n.maxW, NAME_LINES_MAX);
      n.h = (n.lines.length + 1) * LINE_H;
      let w = 0;
      n.lines.forEach(l => { w = Math.max(w, ctx.measureText(l).width); });

      ctx.font = VAL_FONT;
      n.valText = clip(ctx, n.val, n.maxW);
      n.w = Math.max(w, ctx.measureText(n.valText).width);
    }

    // Dua label hanya bertabrakan kalau rentang horizontalnya beririsan.
    // Sejak tiap label punya x sendiri, label di jam 12 yang membentang ke
    // tengah dan label di jam 2 yang jauh di kanan boleh duduk berdampingan
    // di ketinggian yang sama.
    function overlapX(a, b) {
      const a0 = a.right ? a.xText : a.xText - a.w;
      const a1 = a.right ? a.xText + a.w : a.xText;
      const b0 = b.right ? b.xText : b.xText - b.w;
      const b1 = b.right ? b.xText + b.w : b.xText;
      return a0 < b1 + 8 && b0 < a1 + 8;
    }

    // Dimatikan spread() begitu satu sisi tidak lagi tertampung pada tinggi
    // kanvas ini.
    let fits = true;

    function spread(side) {
      // Diurutkan menurut key, bukan y: urutan sudut inilah yang harus
      // dipertahankan. Kedua sapuan di bawah hanya menggeser, tidak pernah
      // menukar, jadi urutan itu bertahan sampai akhir.
      const group = nodes.filter(n => n.right === side).sort((a, b) => a.key - b.key);
      if (!group.length) return;

      // Sapuan turun: tiap label didorong ke bawah hanya sampai lepas dari
      // label-label di atasnya yang rentang x-nya beririsan dengannya.
      group.forEach((n, i) => {
        let limit = top + n.h / 2;
        for (let j = 0; j < i; j++) {
          const p = group[j];
          if (overlapX(n, p)) limit = Math.max(limit, p.y + p.h / 2 + PAD + n.h / 2);
        }
        if (n.y < limit) n.y = limit;
      });

      // Sapuan naik: yang tersorong melewati batas bawah ditarik kembali,
      // dengan aturan irisan yang sama.
      for (let i = group.length - 1; i >= 0; i--) {
        const n = group[i];
        let ceiling = bottom - n.h / 2;
        for (let j = group.length - 1; j > i; j--) {
          const q = group[j];
          if (overlapX(n, q)) ceiling = Math.min(ceiling, q.y - q.h / 2 - PAD - n.h / 2);
        }
        if (n.y > ceiling) n.y = ceiling;
      }

      // Masih ada yang terdorong keluar batas atas berarti satu rantai label
      // yang saling beririsan memang lebih tinggi dari kanvasnya. Ditandai
      // tidak muat — fitCallouts() akan mencoba lagi dengan H yang lebih
      // tinggi. Pembagian rata di bawah hanya jaring pengaman untuk saat H
      // sudah mentok di H_MAX.
      if (group.some(n => n.y - n.h / 2 < top - 0.5) && group.length > 1) {
        fits = false;
        const yF = top + group[0].h / 2;
        const yL = bottom - group[group.length - 1].h / 2;
        const step = (yL - yF) / (group.length - 1);
        group.forEach((n, i) => { n.y = yF + i * step; });
      }
    }

    // Ukur → renggangkan → ukur ulang. Pengukuran pertama memakai y bawaan
    // slice; setelah label bergeser, jarak ke siluet donut berubah dan lebar
    // teksnya ikut berubah, jadi keduanya dihitung ulang lalu dirapikan lagi.
    nodes.forEach(measure);
    spread(true); spread(false);
    nodes.forEach(measure);
    fits = true;   // hanya hasil sapuan terakhir yang menentukan
    spread(true); spread(false);

    // ── Jalur penghubung ──
    // Tiga bentuk, dipilih sehemat mungkin:
    //
    //   lurus     garis langsung ke siku lalu mendatar ke label. Bentuk baku,
    //             jalur terpendek, dan yang paling terbaca sebagai panah.
    //   melengkung  kalau garis lurusnya cuma menyerempet tepi donut. Cukup
    //             dibusurkan sedikit keluar — memutari cincin untuk simpangan
    //             sekecil itu justru berlebihan dan malah memancing silang.
    //   memeluk   kalau labelnya benar-benar berseberangan dengan slice-nya,
    //             yang praktis hanya terjadi di mode satu kolom.
    const OBST = R + 3;
    // Jarak bebas garis terhadap cincin. Bukan cuma soal rapi: garis yang
    // menyerempet cincin tetap terhitung "lurus", padahal jalur pelukan
    // tetangganya lewat persis di atasnya. Diberi jarak, kasus seperti itu
    // ikut naik jadi pelukan dan tunduk pada aturan bersarang yang sama.
    const RING_GAP = 3;
    // Simpangan sudut terbesar yang masih ditangani dengan lengkungan. Sengaja
    // kecil: lengkungan itu obat untuk garis yang cuma menyerempet. Kalau
    // simpangannya besar, lengkungannya berubah jadi setengah putaran yang
    // menyapu wilayah jalur lain tanpa ikut aturan bersarang — dan itu justru
    // sumber persilangan. Simpangan besar diserahkan ke pelukan.
    const BOW_MAX = 0.85;

    nodes.forEach(n => {
      const dir = n.right ? 1 : -1;
      n.elbow = { x: n.xText - dir * STUB, y: n.y };
      n.dot = { x: n.xText - dir * 6, y: n.y };

      // Pangkal garis digeser ke titik slice yang paling menghadap labelnya.
      // Di mode dua kolom label selalu ada di sisi slice-nya sendiri, jadi
      // hasilnya praktis tetap di tengah — tampilan lamanya tidak berubah.
      const { a0, a1 } = angles[n.i];
      const dotA = Math.atan2(n.dot.y - cy, n.dot.x - cx);
      n.anchor = anchorAngle(a0, a1, dotA);
      const edge = outerR[n.i] + 2;
      n.p0 = { x: cx + Math.cos(n.anchor) * edge, y: cy + Math.sin(n.anchor) * edge };

      // Coba yang paling murah dulu, naik tingkat hanya kalau jalurnya
      // terbukti menimpa cincin. Pengujiannya pada jalur yang sudah jadi,
      // bukan pada perkiraan — jadi tidak ada kasus yang lolos diam-diam.
      n.hug = false;
      n.bow = null;
      if (pathHitsRing(cx, cy, [n.p0, n.elbow, n.dot], angles, outerR, n.i, RING_GAP)) {
        const delta = norm(dotA - n.anchor);
        if (Math.abs(delta) <= BOW_MAX) {
          // Titik kendali di garis bagi sudut, sejauh perpotongan dua garis
          // singgung lingkaran penghalang. Kurva kuadratik dengan kendali di
          // situ berada di luar lingkaran itu. Kalau ternyata masih menimpa,
          // kendalinya didorong lebih jauh sebelum menyerah ke pelukan.
          for (let push = 0; push < 4 && !n.bow; push++) {
            const rc = Math.min((OBST + 4 + push * 10) / Math.cos(Math.abs(delta) / 2), R * 2.2);
            const t = n.anchor + delta / 2;
            const c = { x: cx + Math.cos(t) * rc, y: cy + Math.sin(t) * rc };
            if (!pathHitsRing(cx, cy, quadPoints(n.p0, c, n.dot, 12), angles, outerR, n.i, RING_GAP)) n.bow = c;
          }
        }
        if (!n.bow) n.hug = true;
      }
    });

    assignHugGeometry(nodes, cx, cy, R);

    // Aturan cincin saja belum cukup: sebuah garis lurus bisa lolos dari cincin
    // tapi tetap dilewati jalur pelukan tetangganya. Daripada menyetel jarak
    // bebas sampai kebetulan pas — nilai yang menembus lubang jarum dan gampang
    // meleset saat datanya berubah — hasilnya diperiksa apa adanya, lalu yang
    // masih menyilang dinaikkan tingkat dan diperiksa lagi.
    for (let round = 0; round < 6; round++) {
      const paths = nodes.map(n => calloutPath(n, cx, cy));
      let changed = false;
      for (let i = 0; i < nodes.length && !changed; i++) {
        for (let j = i + 1; j < nodes.length && !changed; j++) {
          if (!pathsCross(paths[i], paths[j])) continue;
          const A = nodes[i], B = nodes[j];
          // Yang belum memeluk dinaikkan dulu, karena begitu memeluk ia ikut
          // aturan bersarang. Kalau keduanya sudah memeluk, yang jalurnya
          // lebih panjang digeser satu tingkat ke luar.
          const promote = !A.hug ? A : (!B.hug ? B : null);
          if (promote) { promote.hug = true; promote.bow = null; }
          else {
            const outer = Math.abs(A.sweep) >= Math.abs(B.sweep) ? A : B;
            outer.boost = (outer.boost || 0) + 1;
          }
          changed = true;
        }
      }
      if (!changed) break;
      assignHugGeometry(nodes, cx, cy, R);
    }

    // Nama yang masih memakai elipsis berarti kolom teksnya kurang lebar —
    // itu urusan R, bukan H.
    const clipped = nodes.filter(n => n.lines.some(l => l.indexOf('…') !== -1)).length;
    return { nodes, fits, clipped };
  }

  // Sudut tujuan, panjang sapuan, dan radius bersarang tiap jalur pelukan.
  // Jalur yang menyapu sudut pangkal slice lain harus berada di luar jalur
  // slice itu — kalau tidak, lengan radialnya akan menembus busur ini.
  // Kedalamannya dicari dengan relaksasi; boost dipakai perbaikan lanjutan
  // untuk mendorong satu jalur setingkat lagi ke luar.
  function assignHugGeometry(nodes, cx, cy, R) {
    const huggers = nodes.filter(n => n.hug);
    if (!huggers.length) return;

    huggers.forEach(n => {
      const t = Math.max(-1, Math.min(1, (n.y - cy) / (R + 8)));
      const asin = Math.asin(t);
      // Sudut pada siluet cincin yang setinggi label, di sisi label berada.
      n.aim = norm(n.right ? asin : Math.PI - asin);
      // Sapuan jalur bukan cuma busurnya: ruas terakhir menuju label masih
      // menyapu sudut-sudut sesudah ujung busur.
      const dotA = norm(Math.atan2(n.dot.y - cy, n.dot.x - cx));
      const dArc = norm(n.aim - n.anchor);
      const dDot = norm(dotA - n.anchor);
      n.sweep = (dArc >= 0) === (dDot >= 0) && Math.abs(dDot) > Math.abs(dArc) ? dDot : dArc;
      n.depth = n.boost || 0;
    });

    for (let pass = 0; pass < huggers.length + 2; pass++) {
      let moved = false;
      huggers.forEach(j => nodes.forEach(i => {
        if (i === j) return;
        // Yang dibandingkan sudut pangkal, karena di situlah lengan radial
        // tetangga berdiri.
        const t = norm(i.anchor - j.anchor);
        const swept = j.sweep >= 0 ? (t >= 0 && t <= j.sweep) : (t <= 0 && t >= j.sweep);
        const di = i.hug ? i.depth : 0;
        if (swept && j.depth <= di) { j.depth = di + 1; moved = true; }
      }));
      if (!moved) break;
    }

    // Seluruh tingkat harus muat dalam 16px: teks paling dekat mulai di R+22,
    // jadi busur terluar pun masih punya jarak ke huruf.
    const deepest = huggers.reduce((m, n) => Math.max(m, n.depth), 0);
    const gap = deepest ? Math.min(3, 16 / deepest) : 3;
    huggers.forEach(n => { n.hugR = R + 6 + n.depth * gap; });
  }

  // Titik-titik jalur seperti yang nanti digambar — untuk memeriksa
  // persilangan sebelum benar-benar menggambarnya. Pelandaian belokannya
  // diabaikan di sini: kurvanya tetap berada di antara lengan dan busur.
  function calloutPath(n, cx, cy) {
    if (n.hug) {
      const total = norm(n.aim - n.anchor);
      const steps = Math.max(2, Math.ceil(Math.abs(total) / 0.15));
      const pts = [n.p0];
      for (let k = 0; k <= steps; k++) {
        const t = n.anchor + total * (k / steps);
        pts.push({ x: cx + Math.cos(t) * n.hugR, y: cy + Math.sin(t) * n.hugR });
      }
      pts.push(n.elbow, n.dot);
      return pts;
    }
    if (n.bow) return quadPoints(n.p0, n.bow, n.dot, 10);
    return [n.p0, n.elbow, n.dot];
  }

  function segCross(p, p2, q, q2) {
    const side = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const near = (a, b) => Math.abs(a.x - b.x) < 1.5 && Math.abs(a.y - b.y) < 1.5;
    // Ujung yang bersentuhan bukan persilangan.
    if (near(p, q) || near(p, q2) || near(p2, q) || near(p2, q2)) return false;
    const d1 = side(q, q2, p), d2 = side(q, q2, p2);
    const d3 = side(p, p2, q), d4 = side(p, p2, q2);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }

  function pathsCross(A, B) {
    for (let i = 0; i + 1 < A.length; i++) {
      for (let j = 0; j + 1 < B.length; j++) {
        if (segCross(A[i], A[i + 1], B[j], B[j + 1])) return true;
      }
    }
    return false;
  }

  function drawCalloutNodes(ctx, nodes, outerR, cx, cy) {
    const LINE_H = 14;
    const BEND = 0.35;   // radian yang dipakai untuk melandaikan tiap peralihan

    ctx.textBaseline = 'middle';
    nodes.forEach(n => {
      const dir = n.right ? 1 : -1;

      // Jalurnya sudah diputuskan planCallouts(); di sini tinggal digambar.
      ctx.beginPath();
      ctx.moveTo(n.p0.x, n.p0.y);
      if (n.hug) {
        // Garis lurusnya akan menembus donut, jadi memutar menyusuri tepi
        // cincin. Kedua peralihannya dilandaikan dengan kurva kuadratik supaya
        // tidak ada belokan siku: titik kendalinya justru titik sudut yang
        // dulu jadi siku, jadi kurvanya berangkat radial dari tepi slice lalu
        // melunak jadi sejajar cincin — dan begitu pula saat melepasnya
        // menuju label.
        const at = t => ({ x: cx + Math.cos(t) * n.hugR, y: cy + Math.sin(t) * n.hugR });
        const total = norm(n.aim - n.anchor);
        const s = total < 0 ? -1 : 1;
        const bend = Math.min(BEND, Math.abs(total) * 0.45);
        const aIn = n.anchor + s * bend;
        const aOut = n.aim - s * bend;

        const cIn = at(n.anchor), pIn = at(aIn);
        ctx.quadraticCurveTo(cIn.x, cIn.y, pIn.x, pIn.y);
        if (s * norm(aOut - aIn) > 0.01) ctx.arc(cx, cy, n.hugR, aIn, aOut, s < 0);
        const cOut = at(n.aim);
        ctx.quadraticCurveTo(cOut.x, cOut.y, n.elbow.x, n.elbow.y);
        ctx.lineTo(n.dot.x, n.dot.y);
      } else if (n.bow) {
        // Satu lengkungan tunggal langsung ke label — tanpa siku sama sekali.
        ctx.quadraticCurveTo(n.bow.x, n.bow.y, n.dot.x, n.dot.y);
      } else {
        ctx.lineTo(n.elbow.x, n.elbow.y);
        ctx.lineTo(n.dot.x, n.dot.y);
      }
      ctx.strokeStyle = n.s.color;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(n.xText - dir * 6, n.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = n.s.color;
      ctx.fill();

      ctx.textAlign = n.right ? 'left' : 'right';

      // n.y adalah titik tengah blok label, jadi garis siku menunjuk ke
      // tengahnya berapa pun jumlah barisnya.
      const rows = n.lines.length + 1;
      const yFirst = n.y - ((rows - 1) * LINE_H) / 2;

      ctx.font = NAME_FONT;
      ctx.fillStyle = '#1a1d2e';
      n.lines.forEach((ln, li) => ctx.fillText(ln, n.xText, yFirst + li * LINE_H));

      ctx.font = VAL_FONT;
      ctx.fillStyle = '#6b7094';
      ctx.fillText(n.valText, n.xText, yFirst + n.lines.length * LINE_H);
    });
  }

  // Memecah teks jadi paling banyak maxLines baris selebar maxW. Pemenggalan
  // di spasi, sehingga nama panjang ditulis utuh bertingkat, bukan dipotong.
  // Elipsis hanya muncul di dua kasus sisa: satu kata tunggal yang sendirian
  // saja lebih lebar dari kolomnya, dan teks yang bahkan setelah maxLines
  // baris masih bersisa.
  function wrapText(ctx, text, maxW, maxLines) {
    if (maxW <= 8) return [];
    const words = String(text).split(/\s+/).filter(Boolean);
    if (!words.length) return [];

    const lines = [];
    let cur = '';
    for (const w of words) {
      const cand = cur ? cur + ' ' + w : w;
      if (!cur || ctx.measureText(cand).width <= maxW) { cur = cand; continue; }
      lines.push(cur);
      cur = w;
    }
    lines.push(cur);

    const out = lines.slice(0, maxLines);
    // Sisa baris digabung ke baris terakhir supaya potongannya jatuh di
    // ujung nama, bukan menghilangkan kata-kata terakhir tanpa jejak.
    if (lines.length > maxLines) out[maxLines - 1] = lines.slice(maxLines - 1).join(' ');
    return out.map(l => clip(ctx, l, maxW));
  }

  function clip(ctx, text, maxW) {
    if (maxW <= 8) return '';
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
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
