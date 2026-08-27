/* ═══════════════════════════════════════
   DEPT-PAGE.JS — Halaman chart per departemen
   ═══════════════════════════════════════

   Satu halaman dipakai beberapa departemen: Cut Up, Boneless, dan nanti
   Parting/AU/MDM. Yang membedakan cuma dept mana yang dibaca dan apa judulnya
   — sisanya (chart yield, donut 5 besar, tabel, picker rentang) sama persis,
   jadi semuanya tinggal di sini dan tiap halaman cuma membawa config.

   cfg = {
     pageTitle,   judul halaman
     kpiTitle,    judul chart yield
     kpiDepts,    dept yang dihitung yield-nya
     itemDepts,   dept yang item hasilnya masuk donut + tabel
     cards,       OPSIONAL — section kartu kategori di kolom samping:
                  { title, pv, defaultDept, deptOptions }
                  deptOptions = [{ value, label, depts? }]; depts diisi cuma
                  untuk entri gabungan seperti ALL BONELESS.
   }

   Dua daftar dept, bukan satu: pada Boneless yield cuma dihitung dari BONELESS
   BONGKAR (di situ karkas masuk jadi bahan), sementara donutnya menggabungkan
   hasil dari BONGKAR + MIX + GRAMASI. Pada Cut Up keduanya sama saja.

   cfg.cards cuma diisi halaman Boneless. Halaman tanpa kunci itu tidak
   merender pembungkus .cu-split sama sekali, jadi DOM-nya persis seperti
   sebelum section ini ada.

   Id DOM dan class CSS-nya berawalan "cu" — sisa dari waktu file ini masih
   khusus Cut Up. Tidak diganti karena tidak pernah bentrok: satu halaman
   dirender sendirian ke #pageContent, dan navbar memanggil destroy() lebih
   dulu. */

function createDeptPage(cfg) {
  // Lima warna pertama untuk lima item teratas, warna terakhir khusus
  // "Item Lainnya" — indeksnya dipatok, bukan diambil berurutan, supaya
  // slice agregat itu tetap ungu meski itemnya kurang dari lima.
  const COLORS = ['#3b7ddd', '#f2622a', '#10b981', '#f59e0b', '#85B7EB'];
  const COLOR_OTHER = '#8b5cf6';

  const TOP_N = 5;
  const FONT = "'Plus Jakarta Sans', Helvetica, Arial, sans-serif";
  const MONO = "'JetBrains Mono', ui-monospace, monospace";

  // ── Chart KPI ──
  const KPI_BARS = 7;   // periode terbanyak yang digambar
  // Warna identitas tiap seri, bukan warna isinya. Bahan dan Hasil memakainya
  // di tepi batang saja; isinya versi muda yang dibuat tint() — lihat
  // FILL_TINT. Lolos validator palet: pita lightness, chroma, pemisahan CVD
  // (ΔE 24,7 deutan), dan penglihatan normal (ΔE 30,8).
  //
  // Yield biru tosca. Terhadap kuning Hasil jaraknya jauh di mata mana pun.
  // Yang perlu dijaga justru terhadap biru Bahan: di mata deutan
  // keduanya sama-sama luruh ke biru-lavender (#9d9dda lawan #6f6fdd), jadi
  // yang memisahkan tinggal terang-gelapnya — dan itu memang lebar. Bentuknya
  // menambah satu lapis lagi: garis bertitik lawan batang.
  //
  // Kontrasnya terhadap latar 2,37:1, di bawah 3:1. Ditebus tebal garisnya
  // yang 3px dan titik 8px — dua-duanya jauh di atas ukuran di mana ambang itu
  // benar-benar menggigit.
  const KPI_COLORS = { bahan: '#3b7ddd', hasil: '#e0a500', yield: '#00b8d9' };
  const AXIS_LINE = '#e2e5ef';   // = --border

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

  // Section kartu tidak menawarkan Ayam Proses: kartunya membandingkan hasil
  // terhadap bahan yang masuk, dan itu cuma berarti kalau ayam di kedua sisi
  // satu jenis. 'AYAM PROSES' di jalur hitung berarti "semua pv digabung".
  const PV_CARD_OPTIONS = PV_OPTIONS.filter(o => o.value !== 'AYAM PROSES');

  // ── State per section ──
  // KPI dan chart punya filter sendiri-sendiri: mengubah tanggal di satu
  // section tidak menggeser yang lain, sama seperti Overview yang memisahkan
  // navigasi tanggal KPI dari kontrol grafik Bahan.
  //
  // win = lebar jendela tetap dalam hari produksi. Section KPI memakainya
  // karena chartnya memang bekerja dalam jendela 7 periode: tombol ‹ › selalu
  // melangkah selebar itu, dan jendelanya selalu kembali selebar itu berapa
  // pun rentang yang terakhir dipilih di picker. Section donut tidak punya
  // lebar tetap — jendelanya persis seperti yang dipilih.
  //
  // depts = dept yang dibaca section itu. Karena daftar tanggalnya diturunkan
  // dari dept-nya sendiri, kedua section bisa punya hari produksi yang tidak
  // persis sama — dan itu memang yang dimau: tombol ‹ › di section KPI tidak
  // boleh mendarat di hari yang tidak punya baris dept yang dihitung yield-nya.
  const SC = {
    kpi:   { key: 'kpi',   unit: 'kg', pv: 'AYAM BARU',   from: null, to: null, win: KPI_BARS, depts: cfg.kpiDepts },
    chart: { key: 'chart', unit: 'kg', pv: 'AYAM PROSES', from: null, to: null, win: 0, depts: cfg.itemDepts },
  };

  // Section kartu kategori cuma ada di halaman yang memintanya lewat cfg.cards
  // — sekarang hanya Boneless. Berbeda dari dua section di atas, dept-nya
  // dipilih user lewat dropdown, jadi s.depts berubah selagi halaman terbuka.
  if (cfg.cards) {
    SC.cards = {
      key: 'cards', unit: 'kg', pv: cfg.cards.pv || 'AYAM BARU',
      from: null, to: null, win: 0,
      depts: deptsFor(cfg.cards.defaultDept),
      dept: cfg.cards.defaultDept,
    };
  }

  // Satu entri dropdown bisa menunjuk lebih dari satu dept: 'ALL BONELESS'
  // menjumlah ketiga sub-deptnya. Nilai lain menunjuk dirinya sendiri.
  function deptsFor(value) {
    const opt = (cfg.cards && cfg.cards.deptOptions || []).find(o => o.value === value);
    return (opt && opt.depts) || [value];
  }

  const sections = () => (cfg.cards ? [SC.kpi, SC.chart, SC.cards] : [SC.kpi, SC.chart]);

  let cuExpanded = false;
  let cuDetailOpen = false;   // tabel menggantikan donut
  let cuCanvas = null, cuRo = null, catRo = null;
  let _kpiChart = null, _kpiActive = -1, _kpiPinned = false;
  // Skala sumbu kiri yang sedang berlaku. Dibaca afterBuildTicks, yang dipanggil
  // Chart.js dari dalam — tidak bisa lewat closure config, karena jalur update
  // memakai ulang config lama dan closure-nya masih menunjuk skala yang usang.
  let _kpiScale = null;
  let _rangeDocListener = null, _rangeScrollListener = null;
  // Kedua cache di-key per daftar dept: satu halaman bisa punya dua scope yang
  // berbeda, dan tanpa itu jawaban section yang satu terpakai oleh yang lain.
  let _datesCache = new Map(), _datesRawLen = -1;
  let _aggCache = new Map(), _aggRawLen = -1;
  let _catCache = new Map(), _catRawLen = -1;
  // Kartu yang sedang diangkat di kipas. Disimpan di luar render supaya
  // pilihannya tidak hilang tiap section digambar ulang.
  let _catActive = -1;

  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  // Id elemen diturunkan dari nama section supaya dua salinan kontrol yang
  // identik tidak pernah bertabrakan id-nya.
  function eid(s, name) { return 'cu' + s.key.charAt(0).toUpperCase() + s.key.slice(1) + name; }
  function el(s, name) { return document.getElementById(eid(s, name)); }

  // ═══════════════════════════════════════
  //  DATA
  // ═══════════════════════════════════════

  // Indeks lookup dari daftar nama dept. Nama yang belum pernah muncul di data
  // yang di-import — mis. dept yang baru dipakai pabrik lain — dilewati begitu
  // saja: sisanya tetap terbaca, bukan seluruh sectionnya jadi kosong.
  function deptIdx(depts) {
    const L = Engine.getLookups();
    const set = new Set();
    for (let i = 0; i < depts.length; i++) {
      const d = L.dept.indexOf(depts[i]);
      if (d !== -1) set.add(d);
    }
    return set;
  }

  // Daftar tanggal dibatasi pada hari yang benar-benar punya baris dept itu.
  // Kalau memakai Engine.getAvailableDates(), tombol ‹ › bisa mendarat di
  // hari yang cuma berisi departemen lain dan seluruh halaman terbaca nol.
  function cuAllDates(depts) {
    const raw = Engine.getRawDB();
    if (_datesRawLen !== raw.length) { _datesCache = new Map(); _datesRawLen = raw.length; }
    const key = depts.join('|');
    const hit = _datesCache.get(key);
    if (hit) return hit;

    const dIdx = deptIdx(depts);
    const set = new Set();
    if (dIdx.size) {
      for (let i = 0; i < raw.length; i++) if (dIdx.has(raw[i][0])) set.add(raw[i][8]);
    }
    const out = [...set].sort();
    _datesCache.set(key, out);
    return out;
  }

  // Tanpa rentang tersimpan, section berjendela tetap mundur selebar
  // jendelanya (KPI: 7 hari produksi terakhir) dan section biasa mengambil
  // hari terakhir saja. Bawaannya ditaruh di sini, bukan di render(), supaya
  // tombol Reset di picker ikut kembali ke bawaan yang sama.
  function rangeDates(s) {
    const dates = cuAllDates(s.depts);
    if (!dates.length) return [];
    if (!s.from || !s.to) return dates.slice(-(s.win || 1));
    return dates.filter(d => d >= s.from && d <= s.to);
  }

  // Satu lintasan atas baris dept yang diminta: total BAHAN, total HASIL, dan
  // rincian HASIL per material. Beberapa dept sekaligus dijumlah jadi satu:
  // item bernama sama dari dept berbeda menyatu di satu baris, karena
  // identitas item dipatok ke r[4] (indeks matdesc) — bukan ke dept-nya.
  // R_MAT dan R_MATDESC tumbuh terpisah saat import, jadi R_MAT[r[4]] bukan
  // kode material dari baris yang sama.
  function cuAggregate(dateArr, pv, depts) {
    const raw = Engine.getRawDB();
    if (_aggRawLen !== raw.length) { _aggCache = new Map(); _aggRawLen = raw.length; }
    const key = depts.join('|') + '|' + pv + '|' + dateArr.join(',');
    const hit = _aggCache.get(key);
    if (hit) return hit;

    const L = Engine.getLookups();
    const dIdx = deptIdx(depts);
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

    if (dIdx.size && (pvAll || pI !== -1)) {
      const rows = Engine.getRowsForDates(dateArr);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!dIdx.has(r[0])) continue;
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

  // Rincian HASIL per kategori produk, dengan BAHAN dept sebagai penyebutnya.
  // Terpisah dari cuAggregate() karena identitas barisnya beda: di sini yang
  // dipakai KODE material (r[3] → lookup mat), bukan deskripsinya (r[4]).
  // Deskripsi dua SKU bisa berbeda-beda ejaannya, kodenya tidak.
  //
  // Kamus kategorinya datar dan tidak mengenal dept — dept yang dipilih user
  // menyaring baris di sini, bukan kamusnya. Karena itu 'ALL BONELESS' tidak
  // butuh jalur sendiri: ia cuma daftar dept yang lebih panjang.
  //
  // Yang tidak ketemu di kamus tidak dibuang diam-diam tapi dijumlah sendiri:
  // kalau format kodenya ternyata tidak cocok, angkanya muncul sebagai
  // peringatan di bawah kartu, bukan sebagai kartu yang diam-diam kekecilan.
  function catAggregate(dateArr, pv, depts) {
    const raw = Engine.getRawDB();
    if (_catRawLen !== raw.length) { _catCache = new Map(); _catRawLen = raw.length; }
    // Versi kamus ikut jadi kunci: hasil lama tidak berlaku lagi begitu
    // kamusnya di-import ulang, dan panjang RAW_DB tidak berubah waktu itu.
    const key = Engine.getDeptCategoriesVersion() + '|' + depts.join('|') + '|' + pv + '|' + dateArr.join(',');
    const hit = _catCache.get(key);
    if (hit) return hit;

    const L = Engine.getLookups();
    const catOf = Engine.getCatByMatIndex();
    const dIdx = deptIdx(depts);
    const hI = L.mvt.indexOf('HASIL');
    const bI = L.mvt.indexOf('BAHAN');
    // Penyebutnya persis penyebut yield di chart atas: BAHAN dept ini, tanpa
    // sloc PACKAGING. Jadi jumlah seluruh kategori = yield yang sama.
    const packI = L.sloc.indexOf('PACKAGING');
    const pvAll = pv === 'AYAM PROSES';
    const pI = pvAll ? -1 : L.pv.indexOf(pv);
    // Penggabungan kategori dikerjakan di sini, bukan di kamusnya: isi tabel
    // tetap sama persis dengan file sumbernya, dan pasangan mana yang dibaca
    // jadi satu kartu bisa diubah lewat config tanpa import ulang.
    const merge = (cfg.cards && cfg.cards.merge) || {};

    let bahanKg = 0, hasilKg = 0, lainKg = 0;
    const map = new Map();

    if (dIdx.size && (pvAll || pI !== -1)) {
      const rows = Engine.getRowsForDates(dateArr);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!dIdx.has(r[0])) continue;
        if (!pvAll && r[1] !== pI) continue;
        if (r[5] === bI) {
          if (r[9] === packI) continue;
          bahanKg += r[7];
          continue;
        }
        if (r[5] !== hI) continue;
        hasilKg += r[7];
        const raw = catOf[r[3]];
        if (!raw) { lainKg += r[7]; continue; }
        const cat = merge[raw] || raw;
        map.set(cat, (map.get(cat) || 0) + r[7]);
      }
    }

    // Urut menurun — itu urutan kartunya di kipas, yang terbesar paling kiri.
    const cats = [...map.entries()]
      .map(([name, kg]) => ({ name, kg, pct: bahanKg ? (kg / bahanKg) * 100 : 0 }))
      .sort((a, b) => b.kg - a.kg);

    const out = { bahanKg, hasilKg, lainKg, cats };
    _catCache.set(key, out);
    return out;
  }

  // Yield selalu berbasis KG apapun toggle-nya: di dept olahan kolom BRD sisi
  // HASIL berisi hitungan potongan, bukan ekor, jadi rasionya tidak sebanding
  // dengan BRD di sisi BAHAN.
  //
  // Dipotong ke bawah pada 2 desimal — dipotong, bukan dibulatkan — dan itu
  // pula angka yang dipakai menggambar titiknya. Jadi yang tertulis sama dengan
  // yang digambar: dua periode berlabel sama pasti duduk di tinggi yang sama.
  // Kalau nilainya dibiarkan presisi penuh, selisih 0,01pp saja sudah berjarak
  // ±3px pada jendela sumbu kanan yang sesempit sekarang.
  function cuYield(agg) {
    if (!agg.bahanKg) return null;
    return Math.floor((agg.hasilKg / agg.bahanKg) * 10000) / 100;
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

  // Kebalikan darken(): mencampur warna ke arah putih. Isi batang Bahan dan
  // Hasil dibuat dari sini, bukan dari warna terpisah — jadi warna serinya
  // tetap satu sumber, dan isi pucat itu selalu versi muda dari warna yang
  // sama dengan tepinya.
  function tint(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const m = v => Math.round(v + (255 - v) * k);
    return 'rgb(' + m((n >> 16) & 255) + ',' + m((n >> 8) & 255) + ',' + m(n & 255) + ')';
  }

  // Seberapa muda isi batang dibanding warna serinya. Pada 0,5 tinta gelap di
  // dalam batang dapat kontras 8,8:1 (Bahan) dan 11,3:1 (Hasil) — jauh di atas
  // ambang 4,5:1, jadi angka 9px pun aman terbaca.
  const FILL_TINT = 0.5;

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

  // withUnit false untuk section KPI: sumbu kirinya memang kg, dan yield selalu
  // berbasis kg, jadi toggle BRD/KG di situ tidak berarti apa-apa.
  //
  // opts.deptOptions mengisi pemilih dept — cuma section kartu yang punya,
  // karena cuma di situ dept-nya dipilih user alih-alih dipatok config.
  function controlsHtml(s, withUnit, opts) {
    const o = opts || {};
    return `
      <div class="section-header cu-header">
        <div class="section-header-controls cu-controls">
          ${withUnit ? `
          <div class="toggle-group" id="${eid(s, 'MetricToggle')}">
            <button class="toggle-btn" data-metric="brd">BRD</button>
            <button class="toggle-btn" data-metric="kg">KG</button>
          </div>` : ''}
          ${o.deptOptions ? `<div id="${eid(s, 'DeptWrap')}"></div>` : ''}
          <div id="${eid(s, 'PvWrap')}"></div>
          <div class="spacer"></div>
          <div id="${eid(s, 'RangeNav')}"></div>
        </div>
      </div>`;
  }

  function bindControls(s, onChange, opts) {
    const o = opts || {};
    const toggle = el(s, 'MetricToggle');
    if (toggle) toggle.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.metric === s.unit);
      btn.addEventListener('click', () => {
        s.unit = btn.dataset.metric;
        toggle.querySelectorAll('.toggle-btn')
          .forEach(b => b.classList.toggle('active', b.dataset.metric === s.unit));
        onChange();
      });
    });

    // Dept diganti berarti hari produksinya bisa berbeda: rentang yang sedang
    // dipegang belum tentu punya baris di dept yang baru. Dikembalikan ke
    // default kalau begitu, alasan yang sama dengan pemeriksaan di render().
    const deptWrap = el(s, 'DeptWrap');
    if (deptWrap && o.deptOptions) {
      const deptSel = DatePicker.createCustomSelect(o.deptOptions, s.dept, val => {
        s.dept = val;
        s.depts = deptsFor(val);
        const dates = cuAllDates(s.depts);
        if (s.from && s.to && !dates.some(d => d >= s.from && d <= s.to)) { s.from = null; s.to = null; }
        onChange();
      });
      deptWrap.appendChild(deptSel.el);
    }

    const pvSel = DatePicker.createCustomSelect(o.pvOptions || PV_OPTIONS, s.pv, val => {
      s.pv = val;
      onChange();
    });
    el(s, 'PvWrap').appendChild(pvSel.el);
  }

  function render(container) {
    destroy();
    cuExpanded = false;

    // Rentang yang tersimpan bisa jadi sudah tidak punya data setelah import
    // baru; kembalikan ke default daripada menampilkan halaman kosong. Diperiksa
    // per section: keduanya bisa membaca dept yang berbeda, jadi hari produksinya
    // pun tidak selalu sama.
    sections().forEach(s => {
      const dates = cuAllDates(s.depts);
      if (s.from && s.to && !dates.some(d => d >= s.from && d <= s.to)) { s.from = null; s.to = null; }
    });


    container.innerHTML = `
      <div class="page-title">${esc(cfg.pageTitle)}</div>

      ${cfg.cards ? `<div class="cu-split">
      <div class="cu-split-side">
        <div class="section" id="cuCardSection">
          ${controlsHtml(SC.cards, false, { deptOptions: cfg.cards.deptOptions, pvOptions: PV_CARD_OPTIONS })}
          <div class="cu-body">
            <div class="cu-card-title cu-kpi-title">${esc(cfg.cards.title)}</div>
            <div class="dc-stack" id="cuCatStack"></div>
            <div class="cu-kpi-note" id="cuCatNote"></div>
            <div class="cu-empty" id="cuCatEmpty">Tidak ada data untuk periode ini</div>
          </div>
        </div>
      </div>
      <div class="cu-split-main">` : ''}

      <div class="section" id="cuKpiSection">
        ${controlsHtml(SC.kpi, false)}
        <div class="cu-body">
          <div class="cu-card-title cu-kpi-title">${esc(cfg.kpiTitle)}</div>
          <div class="cu-kpi-wrap" id="cuKpiWrap"><canvas id="cuKpiCanvas"></canvas></div>
          <!-- Legend HTML, bukan legend bawaan Chart.js: tiga seri berarti
               identitasnya tidak boleh bersandar pada warna saja. Satuan tiap
               sumbu tidak ikut di sini — digambar di ujung atas garis
               sumbunya masing-masing. -->
          <div class="cu-kpi-legend">
            <span class="cu-leg-key"><i style="background:${tint(KPI_COLORS.bahan, FILL_TINT)};border-color:${KPI_COLORS.bahan}"></i>Bahan</span>
            <span class="cu-leg-key"><i style="background:${tint(KPI_COLORS.hasil, FILL_TINT)};border-color:${KPI_COLORS.hasil}"></i>Hasil</span>
            <span class="cu-leg-key"><i class="dot" style="background:${KPI_COLORS.yield}"></i>Yield</span>
          </div>
          <div class="cu-kpi-note" id="cuKpiNote"></div>
          <div class="cu-empty" id="cuKpiEmpty">Tidak ada data untuk periode ini</div>
        </div>
      </div>

      <div class="section" id="cuChartSection">
        ${controlsHtml(SC.chart, true)}
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

      ${cfg.cards ? `</div></div>` : ''}
    `;

    bindControls(SC.kpi, refreshKpi);
    bindControls(SC.chart, refreshChart);
    if (cfg.cards) {
      bindControls(SC.cards, refreshCats, {
        deptOptions: cfg.cards.deptOptions, pvOptions: PV_CARD_OPTIONS,
      });
    }

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

    // Kipasnya dihitung ulang tiap kolomnya berubah lebar — termasuk waktu
    // layoutnya berpindah dari dua kolom ke menumpuk di 1100px, di mana
    // lebar yang tersedia melonjak.
    if (cfg.cards) {
      const stack = document.getElementById('cuCatStack');
      if (stack) {
        catRo = new ResizeObserver(() => requestAnimationFrame(() => {
          fitFan(stack, stack.children.length);
        }));
        catRo.observe(stack);
      }
    }

    refreshKpi();
    refreshChart();
    if (cfg.cards) refreshCats();
  }

  function refreshKpi() {
    renderRangeNav(SC.kpi, refreshKpi);
    renderKpiChart();
  }

  function refreshChart() {
    renderRangeNav(SC.chart, refreshChart);
    renderTable();
    drawDonut();
  }

  function refreshCats() {
    renderRangeNav(SC.cards, refreshCats);
    renderCatCards();
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
    if (catRo) { catRo.disconnect(); catRo = null; }
    cuCanvas = null;
    destroyKpiChart();
  }

  // ── Navigasi rentang ──
  function renderRangeNav(s, onChange) {
    const nav = el(s, 'RangeNav');
    if (!nav) return;
    const dates = cuAllDates(s.depts);
    const cur = rangeDates(s);
    const atStart = !cur.length || dates.indexOf(cur[0]) <= 0;
    const atEnd = !cur.length || dates.indexOf(cur[cur.length - 1]) >= dates.length - 1;

    // Section berjendela tetap tidak punya tombol geser — cukup tombol
    // rentangnya saja, seperti grafik persebaran bahan di Overview. Jendelanya
    // memang selalu 7 periode terakhir, jadi menggesernya per hari tidak
    // berarti apa-apa untuk chartnya.
    nav.innerHTML = s.win
      ? `<button class="chart-range-btn" id="${eid(s, 'RangeBtn')}">${esc(rangeLabel(s))}</button>`
      : `
      <div class="date-nav cu-range-nav">
        <button class="date-nav-btn" id="${eid(s, 'Prev')}" ${atStart ? 'disabled' : ''}>‹</button>
        <button class="chart-range-btn" id="${eid(s, 'RangeBtn')}">${esc(rangeLabel(s))}</button>
        <button class="date-nav-btn" id="${eid(s, 'Next')}" ${atEnd ? 'disabled' : ''}>›</button>
      </div>`;

    if (!s.win) {
      el(s, 'Prev').addEventListener('click', () => shift(s, -1, onChange));
      el(s, 'Next').addEventListener('click', () => shift(s, 1, onChange));
    }
    el(s, 'RangeBtn').addEventListener('click', e => {
      e.stopPropagation();
      openRangePicker(s, onChange);
    });
  }

  // Geser jendela sejauh panjangnya sendiri, dihitung dalam hari produksi.
  // Hanya dipakai section donut; section KPI tidak punya tombol geser.
  function shift(s, dir, onChange) {
    const dates = cuAllDates(s.depts);
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

  // Satu titik data per periode. Yield dihitung dari jumlahnya, bukan dari
  // rata-rata yield harian: merata-ratakan rasio memberi angka yang salah
  // begitu volume tiap hari tidak sama.
  function kpiSeries(s) {
    const all = rangeDates(s);
    const dates = all.slice(-KPI_BARS);
    return {
      hidden: all.length - dates.length,
      points: dates.map(d => {
        const agg = cuAggregate([d], s.pv, s.depts);
        return {
          date: d,
          label: fmtDateShort(d),
          bahan: agg.bahanKg,
          hasil: agg.hasilKg,
          yield: cuYield(agg),
        };
      }),
    };
  }

  // Membulatkan ke atas ke angka yang enak dibaca. Langkahnya sengaja rapat:
  // dengan tangga 1/2/2,5/5 yang lazim, batas 26.154 melompat ke 50.000 dan
  // batangnya tergencet jadi separuh tinggi yang seharusnya.
  const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

  function niceCeil(v) {
    if (!(v > 0)) return 1;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / mag;
    return (NICE_STEPS.find(st => f <= st + 1e-9) || 10) * mag;
  }

  // Jarak antar label sumbu kiri. Dilepas ke Chart.js, sumbunya cuma terbagi
  // empat — pada batas 80.000 itu berarti kelipatan 20.000 saja, terlalu jarang
  // untuk menaksir tinggi batang. Yang dicari: pembagi y1max yang jatuh di
  // angka bulat dan membelah sumbu jadi 6–12 bagian. Batas atasnya tidak
  // digeser, jadi tinggi batang relatif terhadap titik yield tidak berubah.
  const TICK_UNITS = [1, 1.5, 2, 2.5, 3, 4, 5];

  // 190px plot dibagi 12 masih menyisakan ~15px per label pada font 9px, tapi
  // yang enak dibaca ada di sekitar 9 — itu yang dijadikan sasaran, dan yang
  // paling dekat ke situ yang dipakai.
  const TICK_TARGET = 9;

  // Memilih langkah tick sumbu kiri: pembagi y1max yang jatuh di angka bulat
  // dan membelah sumbu jadi sebanyak mungkin bagian mendekati TICK_TARGET.
  function niceDiv(max) {
    let best = null;
    for (let n = 6; n <= 12; n++) {
      const step = max / n;
      const mag = Math.pow(10, Math.floor(Math.log10(step) + 1e-9));
      const f = step / mag;
      if (!TICK_UNITS.some(u => Math.abs(f - u) < 1e-9)) continue;
      const d = Math.abs(n - TICK_TARGET);
      if (!best || d < best.d) best = { d, n, step };
    }
    // Tidak ada pembagi bulat — biar Chart.js yang memilih seperti sebelumnya.
    return best ? { step: best.step, count: best.n + 1 } : { step: undefined, count: 5 };
  }

  // Batas kedua sumbu. Sumbu kanan dipatok sesempit yang diminta — yield
  // terendah −0,5 sampai tertinggi +0,1 — supaya selisih antar periode yang
  // cuma sepersekian poin tetap terbaca sebagai lekukan garis.
  //
  // Jendela sesempit itu menaruh titik yield di mana saja sepanjang tinggi plot,
  // jadi aturan lama "titik selalu di atas batang" tidak bisa lagi dipenuhi
  // tanpa memipihkan batang jadi sisa. Sumbu kiri karena itu kembali ke headroom
  // biasa: batangnya memakai tinggi plot sebagaimana adanya, dan garis yield
  // boleh melintasinya.
  function kpiScales(points) {
    const bars = points.reduce((m, p) => Math.max(m, p.bahan, p.hasil), 0);
    const ys = points.map(p => p.yield).filter(v => v !== null);
    const y1max = niceCeil(bars * 1.15) || 1;

    // Tanpa satu pun yield, sumbu kanan cuma jadi bingkai kosong: 0–100 dengan
    // langkah 20. Kelipatan 0,1 di rentang selebar itu berarti seribu tick.
    if (!ys.length) return y1Ticks({ y1max, y2min: 0, y2max: 100, y2step: 20, y2count: 6 });

    const lo = Math.min(...ys), hi = Math.max(...ys);
    // Kedua batas dijatuhkan ke kelipatan Y2_STEP terdekat ke arah luar, jadi
    // −0,5 dan +0,1 itu marjin minimum, bukan angka mati. Tanpa ini batasnya
    // jatuh di pecahan seperti 64,73 dan seluruh tangga label ikut miring.
    // Jepit 0..100 sekadar penjaga: yield di luar itu tidak mungkin, dan pada
    // data nyata (Cut Up 65–75%) jepitannya memang tidak pernah kena.
    const y2min = Math.max(0, snapDown(lo - 0.5));
    const y2max = Math.min(100, snapUp(hi + 0.1));
    return y1Ticks({
      y1max,
      y2min,
      y2max,
      y2step: Y2_STEP,
      // Jumlah label kalau setiap kelipatan ditulis. Dipakai sebagai
      // maxTicksLimit; kalau rentang yieldnya lebar sehingga selabel 0,1 tidak
      // muat, autoSkip Chart.js yang melewati sebagian — kelipatannya tetap
      // jatuh di 0,1 (jadi 0,2 atau 0,3), bukan bergeser ke angka pecahan.
      y2count: Math.round((y2max - y2min) / Y2_STEP) + 1,
    });
  }

  // Kelipatan label sumbu kanan, dalam poin persen.
  const Y2_STEP = 0.1;

  // Pembulatan ke kelipatan Y2_STEP, ke bawah untuk batas bawah dan ke atas
  // untuk batas atas. Hasilnya dinormalkan ke tiga desimal supaya galat pecahan
  // biner (0,1 tidak bulat di basis dua) tidak ikut terbawa ke nilai tick.
  const snapDown = v => Math.round(Math.floor(v / Y2_STEP + 1e-9) * Y2_STEP * 1e3) / 1e3;
  const snapUp = v => Math.round(Math.ceil(v / Y2_STEP - 1e-9) * Y2_STEP * 1e3) / 1e3;

  // Langkah sumbu kiri selalu diturunkan dari y1max yang sudah jadi, jadi kedua
  // jalan keluar kpiScales() memakai aturan yang sama. Sumbunya berangkat dari
  // nol: semua batang menunjuk ke atas.
  function y1Ticks(sc) {
    const d = niceDiv(sc.y1max);
    sc.y1min = 0;
    sc.y1step = d.step;
    sc.y1count = d.count;
    return sc;
  }

  function renderKpiChart() {
    const wrap = document.getElementById('cuKpiWrap');
    const canvas = document.getElementById('cuKpiCanvas');
    const empty = document.getElementById('cuKpiEmpty');
    const note = document.getElementById('cuKpiNote');
    if (!wrap || !canvas || !empty) return;

    const { points, hidden } = kpiSeries(SC.kpi);
    const hasData = points.some(p => p.bahan > 0 || p.hasil > 0);

    wrap.style.display = hasData ? '' : 'none';
    empty.style.display = hasData ? 'none' : 'block';
    if (note) {
      note.textContent = hidden > 0
        ? 'Menampilkan ' + points.length + ' hari produksi terakhir dari ' + (points.length + hidden) + ' hari terpilih'
        : '';
    }
    if (!hasData) { destroyKpiChart(); return; }

    const sc = kpiScales(points);
    _kpiScale = sc;
    const cfg = kpiChartConfig(points, sc);

    // Chart.js hanya dibuat sekali; pembaruan berikutnya menimpa datanya
    // supaya batangnya bergerak, bukan berkedip dari nol.
    if (_kpiChart) {
      _kpiChart.data.labels = cfg.data.labels;
      cfg.data.datasets.forEach((ds, i) => { _kpiChart.data.datasets[i].data = ds.data; });
      _kpiChart.options.scales.y.max = sc.y1max;
      _kpiChart.options.scales.y.min = sc.y1min;
      _kpiChart.options.scales.y.ticks.stepSize = sc.y1step;
      _kpiChart.options.scales.y.ticks.maxTicksLimit = sc.y1count;
      _kpiChart.options.scales.y2.min = sc.y2min;
      _kpiChart.options.scales.y2.max = sc.y2max;
      _kpiChart.options.scales.y2.ticks.stepSize = sc.y2step;
      _kpiChart.options.scales.y2.ticks.maxTicksLimit = sc.y2count;
      _kpiChart.$cuPoints = points;
      _kpiChart.update();
      return;
    }
    _kpiChart = new Chart(canvas.getContext('2d'), cfg);
    _kpiChart.$cuPoints = points;

    // onHover tidak pernah terpanggil saat kursor keluar kanvas, jadi garis
    // bidiknya harus dibersihkan sendiri — kecuali sedang dikunci lewat tap.
    canvas.addEventListener('mouseleave', () => {
      if (_kpiPinned || _kpiActive === -1) return;
      _kpiActive = -1;
      if (_kpiChart) _kpiChart.draw();
    });
  }

  function destroyKpiChart() {
    if (_kpiChart) { _kpiChart.destroy(); _kpiChart = null; }
    _kpiScale = null;
    _kpiActive = -1;
    _kpiPinned = false;
  }

  // Nilai tiap batang, ditulis tegak di atas batangnya. Tegak karena dengan 7
  // periode × 3 batang, angka mendatar pasti bertabrakan di layar ponsel.
  //
  // Tintanya gelap, bukan warna serinya — identitas seri sudah dibawa batangnya
  // sendiri, dan isi batang yang pucat itu memang disiapkan untuk menampung
  // tinta segelap ini. Satu-satunya yang tetap redup: angka batang yang terlalu
  // pendek, yang terpaksa melayang di luar batangnya (lihat di bawah).
  const kpiBarLabelPlugin = {
    id: 'cuKpiBarLabels',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;

      ctx.save();
      ctx.font = '700 9px ' + MONO;
      ctx.textBaseline = 'middle';

      // Satuan tiap sumbu, di ujung atas garisnya masing-masing.
      ctx.fillStyle = '#9498b3';
      ctx.textAlign = 'left';
      ctx.fillText('kg', chartArea.left, chartArea.top - 10);
      ctx.textAlign = 'right';
      ctx.fillText('%', chartArea.right, chartArea.top - 10);

      [0, 1].forEach(di => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach((bar, i) => {
          const v = chart.data.datasets[di].data[i];
          if (!v) return;
          const text = fmtNum(v);
          const w = ctx.measureText(text).width;
          const barH = bar.base - bar.y;

          if (barH >= w + 14) {
            // Muat di dalam batang: menempel di bawah ujung atasnya. textAlign
            // right membuat teks memanjang ke bawah setelah diputar.
            ctx.save();
            // Tinta gelap untuk kedua seri: isi batangnya sudah dipucatkan
            // justru supaya angka ini bisa hitam. Dipatok sama untuk keduanya
            // walau kuning Hasil lebih terang dari biru Bahan — pasangan itu
            // dibaca sekaligus, jadi tintanya tidak boleh berbeda.
            ctx.fillStyle = '#1a1d2e';
            ctx.textAlign = 'right';
            ctx.translate(bar.x, bar.y + 7);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(text, 0, 0);
            ctx.restore();
            return;
          }

          // Batang terlalu pendek untuk memuat angkanya — ditulis di atasnya
          // dengan tinta redup daripada dihilangkan. Batasnya tepi kanvas,
          // bukan tepi plot: strip padding di atas plot memang untuk ini.
          if (bar.y - 4 < w + 8) return;
          ctx.save();
          ctx.fillStyle = '#6b7094';
          ctx.textAlign = 'left';
          ctx.translate(bar.x, bar.y - 6);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(text, 0, 0);
          ctx.restore();
        });
      });

      ctx.restore();
    },
  };

  // Garis bidik + nilai yield periode aktif. Tooltip bawaan Chart.js dimatikan
  // supaya isinya bisa dipilih sendiri — sama seperti grafik Trafic Bahan di
  // Overview.
  const kpiCrosshairPlugin = {
    id: 'cuKpiCrosshair',
    afterDatasetsDraw(chart) {
      const pts = chart.$cuPoints || [];
      const p = pts[_kpiActive];
      if (!p) return;
      const { ctx, chartArea, scales } = chart;
      const x = scales.x.getPixelForValue(_kpiActive);

      ctx.save();
      ctx.strokeStyle = 'rgba(26,29,46,0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      if (p.yield === null) { ctx.restore(); return; }
      const y = scales.y2.getPixelForValue(p.yield);

      // Halo di titiknya, bukan titik yang membesar: ukurannya tetap sama
      // dengan titik lain jadi nilainya tidak terbaca berubah.
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,184,217,0.22)';   // = KPI_COLORS.yield
      ctx.fill();

      // Nilainya saja, tanpa kotak: angkanya melayang di atas titik. Warnanya
      // warna seri yield supaya jelas angka milik garis yang mana.
      // Nilainya sudah dipotong 2 desimal di cuYield(), jadi toFixed(2) di sini
      // hanya menjaga nol di belakang — bukan pembulatan kedua.
      const text = p.yield.toFixed(2) + '%';
      ctx.font = '700 11px ' + FONT;
      const w = ctx.measureText(text).width;

      // Di atas titik, membalik ke bawah kalau mepet tepi atas; sisi kiri-kanan
      // dijepit ke dalam area plot supaya angkanya tidak terpotong di ujung.
      let tx = Math.min(Math.max(x, chartArea.left + w / 2), chartArea.right - w / 2);
      let ty = y - 16;
      if (ty - 6 < chartArea.top) ty = y + 16;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Garis luar putih tipis: tanpa kotak, angkanya bisa jatuh di atas batang,
      // dan ini yang menjaga bentuk hurufnya tetap terbaca di sana.
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, tx, ty);
      ctx.fillStyle = KPI_COLORS.yield;
      ctx.fillText(text, tx, ty);
      ctx.restore();
    },
  };

  function kpiChartConfig(points, sc) {
    const bar = (label, key, color) => ({
      type: 'bar',
      label,
      yAxisID: 'y',
      order: 1,
      data: points.map(p => p[key]),
      // Kedua batang berisi warna muda: yang gelap di chart ini tinggal
      // angkanya, dan itu memang yang harus dibaca duluan. Isi sepucat itu cuma
      // berjarak 1,9:1 (Bahan) dan 1,5:1 (Hasil) dari latar
      // kartu — sendirian ia larut ke dalam putihnya. Tepinya karena itu
      // memakai warna seri yang penuh: itu yang menegaskan bentuk batangnya,
      // sekaligus menjaga identitas warnanya tetap terbaca seperti sebelumnya.
      backgroundColor: tint(color, FILL_TINT),
      borderColor: color,
      borderWidth: 1,
      // Chart.js memucatkan batang yang di-hover secara bawaan. Warna hover
      // dipatok sama dengan warna batangnya supaya tidak ada yang berubah saat
      // disentuh: penanda periode aktif sudah dibawa garis bidik + angka yield.
      hoverBackgroundColor: tint(color, FILL_TINT),
      hoverBorderColor: color,
      hoverBorderWidth: 1,
      borderRadius: 4,
      borderSkipped: false,
      // Batangnya dilebarkan: celah dalam sepasang tinggal cukup untuk
      // memisahkan warnanya, dan celah antar periode secukupnya supaya kedua
      // batang masih terbaca sebagai satu kelompok.
      barPercentage: 0.9,
      categoryPercentage: 0.84,
    });

    return {
      type: 'bar',
      data: {
        labels: points.map(p => p.label),
        datasets: [
          bar('Bahan', 'bahan', KPI_COLORS.bahan),
          bar('Hasil', 'hasil', KPI_COLORS.hasil),
          {
            // Chart.js menggambar dataset dari order TERBESAR ke terkecil
            // (_drawDatasets berjalan mundur atas larik yang sudah diurutkan
            // menaik), jadi order terkecil yang tampil paling atas. Yield
            // karena itu 0, di bawah kedua batang yang order-nya 1 — kalau
            // dibalik, garisnya tertimbun batang setiap kali melintasinya.
            type: 'line',
            label: 'Yield',
            yAxisID: 'y2',
            order: 0,
            data: points.map(p => p.yield),
            borderColor: KPI_COLORS.yield,
            borderWidth: 3,
            tension: 0.3,
            spanGaps: true,
            // 4px radius = penanda 8px, batas bawah ukuran yang masih terbaca
            // dan bisa disentuh; di bawah itu titiknya mulai hilang di layar
            // ponsel.
            pointRadius: 4,
            pointHoverRadius: 4,
            pointBackgroundColor: KPI_COLORS.yield,
            // Cincin warna permukaan supaya dua titik berdekatan tidak menyatu.
            pointBorderColor: '#fff',
            pointBorderWidth: 1.5,
            // Sama seperti batangnya: titik yang di-hover tidak berubah warna.
            pointHoverBackgroundColor: KPI_COLORS.yield,
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 1.5,
          },
        ],
      },
      plugins: [kpiBarLabelPlugin, kpiCrosshairPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450, easing: 'easeInOutQuart' },
        interaction: { mode: 'index', intersect: false },
        // Strip di atas plot untuk label nilai yang tegak itu — sama seperti
        // TOTAL_LABEL_PAD pada chart bahan per departemen.
        layout: { padding: { top: 34, right: 2 } },
        onHover: (_e, els, chart) => {
          if (_kpiPinned) return;
          const i = els.length ? els[0].index : -1;
          if (i !== _kpiActive) { _kpiActive = i; chart.draw(); }
        },
        // Di ponsel tidak ada hover, jadi tap mengunci periodenya; tap lagi
        // melepas. Pola yang sama dipakai grafik Trafic Bahan.
        onClick: (_e, els, chart) => {
          const i = els.length ? els[0].index : -1;
          if (i < 0 || (_kpiPinned && _kpiActive === i)) {
            _kpiPinned = false;
            _kpiActive = i < 0 ? -1 : i;
          } else {
            _kpiPinned = true;
            _kpiActive = i;
          }
          chart.draw();
        },
        plugins: {
          legend: { display: false },   // legend-nya HTML, di atas kanvas
          tooltip: { enabled: false },
        },
        scales: {
          // Ketiga sumbu diberi garis; nilainya --border ditulis langsung
          // karena kanvas tidak bisa membaca var(--…).
          x: {
            grid: { display: false },
            border: { display: true, color: AXIS_LINE, width: 1 },
            ticks: {
              font: { family: MONO, size: 9, weight: 700 },
              color: '#6b7094',
              // Dibiarkan memiring sendiri saat tanggalnya tidak muat mendatar
              // — perilaku bawaan Chart.js, dan itu pula yang dipakai chart
              // bahan per departemen. autoSkip mati supaya ketujuh tanggalnya
              // tetap tertulis, tidak ada yang dilewati.
              maxRotation: 50,
              autoSkip: false,
            },
          },
          y: {
            position: 'left',
            min: sc.y1min,
            max: sc.y1max,
            // Garis nol dipertegas: itu dasar batang Bahan dan Hasil, jadi ia
            // yang membuat tinggi tiap batang terbaca. Sisanya tetap kisi samar
            // seperti sebelumnya.
            grid: {
              color: c => (c.tick && c.tick.value === 0 ? 'rgba(26,29,46,0.22)' : 'rgba(0,0,0,0.04)'),
              lineWidth: c => (c.tick && c.tick.value === 0 ? 1 : 0.5),
            },
            border: { display: true, color: AXIS_LINE, width: 1 },
            ticks: {
              font: { family: MONO, size: 9 },
              color: '#6b7094',
              // stepSize dan maxTicksLimit menunjuk pembagian yang sama; kalau
              // hanya salah satunya diisi, Chart.js masih menghitung ulang
              // jaraknya sendiri dan kembali ke kelipatan yang jarang.
              stepSize: sc.y1step,
              maxTicksLimit: sc.y1count,
              // Semua label dibuat selebar label terpanjang. Fontnya monospace,
              // jadi spasi di depan menyamakan lebarnya persis — "0" tidak lagi
              // berdiri sendiri sebagai label satu digit di antara yang enam.
              callback: (v, _i, ticks) => {
                const w = ticks.reduce((m, t) => Math.max(m, fmtNum(t.value).length), 0);
                return fmtNum(v).padStart(w);
              },
            },
          },
          y2: {
            position: 'right',
            min: sc.y2min,
            max: sc.y2max,
            grid: { display: false },
            border: { display: true, color: AXIS_LINE, width: 1 },
            ticks: {
              font: { family: MONO, size: 9 },
              color: '#6b7094',
              // Sama seperti sumbu kiri: stepSize dan maxTicksLimit menunjuk
              // pembagian yang sama, kalau tidak Chart.js menghitung ulang
              // jaraknya sendiri dan kembali ke kelipatan yang lebih jarang.
              stepSize: sc.y2step,
              maxTicksLimit: sc.y2count,
              callback: v => v.toFixed(1) + '%',
            },
          },
        },
      },
    };
  }

  // ═══════════════════════════════════════
  //  KARTU KATEGORI (DEPT CARD PERFORM)
  // ═══════════════════════════════════════

  // Kartu kategori disusun sebagai kipas: tiap kartu menutupi sisi kanan kartu
  // sebelumnya, dibaca kiri ke kanan, yang terbesar paling kiri. Dalam keadaan
  // diam yang terlihat cuma sebilah nama; kartu yang disorot terangkat penuh
  // dan mendorong tetangga kanannya, jadi yang terbaca tidak pernah terpotong.
  //
  // HTML, bukan kanvas: isinya cuma teks, dan sebagai flex biasa ia ikut
  // menyesuaikan diri saat kolomnya menyempit di layar kecil.
  // Jarak antar kartu dihitung, bukan dipatok. Satu angka tetap tidak bisa
  // benar di dua tempat sekaligus: kolomnya cuma memuat ~470px di 1100px tapi
  // hampir 900px di 1920px, dan jumlah kategorinya sendiri berubah menurut
  // dept yang dipilih. Dipatok, kipasnya kalau tidak terpotong ya menyisakan
  // kolom setengah kosong.
  //
  // Lebar kipasnya karena itu selalu pas selebar kolomnya — dan karena tidak
  // pernah melebihi kolom, tidak ada scrollbar yang perlu dimunculkan.
  // Lebar kartu maupun tumpangannya diurus CSS sepenuhnya (flex:1 1 0 +
  // --dc-overlap), jadi yang tersisa di sini cuma satu hal yang tidak bisa
  // dihitung CSS: lebar BILAH yang terlihat saat kartunya diam, karena itu
  // bergantung pada jumlah kategori.
  //
  //   a = (W − ov) / n
  //
  // Dipakai untuk menyetel ukuran label persen di pojok kiri bawah — di
  // kolom sempit bilahnya cuma ~27px dan angka seukuran penuh tidak muat.
  function fitFan(stack, n) {
    if (!stack || n < 1) return;
    const avail = stack.clientWidth;
    if (!avail) return;
    const ov = parseFloat(getComputedStyle(stack).getPropertyValue('--dc-overlap')) || 0;
    const advance = n < 2 ? avail : Math.max(0, (avail - ov) / n);
    stack.style.setProperty('--dc-advance', advance + 'px');
  }

  function renderCatCards() {
    const stack = document.getElementById('cuCatStack');
    const note = document.getElementById('cuCatNote');
    const empty = document.getElementById('cuCatEmpty');
    if (!stack || !empty) return;

    const s = SC.cards;
    const agg = catAggregate(rangeDates(s), s.pv, s.depts);
    const hasData = agg.cats.length > 0;

    stack.style.display = hasData ? '' : 'none';
    empty.style.display = hasData ? 'none' : 'block';
    // Kamusnya sendiri yang belum ada, bukan datanya — bedakan, kalau tidak
    // orang mencari-cari data produksi yang sebenarnya ada.
    empty.textContent = Engine.hasDeptCategories()
      ? 'Tidak ada data untuk periode ini'
      : 'Kamus kategori material belum di-import';

    // Susunan memusat, bukan menurun dari kiri: yang terbesar duduk di tengah,
    // lalu makin ke tepi makin kecil ke dua arah. agg.cats sudah urut menurun,
    // jadi tinggal dibagikan berselang-seling — yang ganjil ke kanan, yang
    // genap ke kiri.
    const arranged = [];
    let centerPos = 0;
    agg.cats.forEach((c, i) => {
      if (i > 0 && i % 2 === 0) { arranged.unshift(c); centerPos++; }
      else arranged.push(c);
    });

    // Yang menentukan sisi mana yang tertutup itu z-index, bukan marginnya —
    // margin negatifnya seragam ke kiri seperti sebelumnya. z naik menuju
    // tengah, jadi:
    //   kiri tengah  kartu kanannya di atas -> yang tersisa bilah KIRI
    //   kanan tengah kartu kirinya di atas  -> yang tersisa bilah KANAN
    // Karena itu labelnya ikut berpindah sisi, mengikuti bilah yang terlihat.
    const n = arranged.length;

    // Kartu terbesar terangkat sejak awal — itu yang paling ingin dibaca, dan
    // di tengah ia memang sudah paling atas.
    _catActive = centerPos;

    // Kartunya digambar polos; puncak tumpukan, sisi label, dan kartu yang
    // terangkat semuanya dipasang applyShape() di bawah — satu tempat, supaya
    // ketiganya tidak bisa saling bertentangan.
    stack.innerHTML = arranged.map((c, i) => `
      <div class="dc-card" data-i="${i}" tabindex="0" role="button"
           aria-label="${esc(c.name)} ${esc(fmtPct(c.pct, 2))}">
        <div class="dc-card-name">${esc(c.name)}</div>
        <div class="dc-card-val">${esc(fmtPct(c.pct, 2))}</div>
      </div>`).join('');

    // Sentuh tidak pernah memicu :hover, jadi kartunya juga bisa diangkat
    // dengan klik/tap. Satu saja yang terangkat: klik kartu lain memindahkan
    // angkatannya, klik kartu yang sama menurunkannya kembali.
    fitFan(stack, n);

    // Yang terangkat SELALU tepat satu, dan dikendalikan satu class saja —
    // bukan .is-active untuk kartu tengah ditambah :hover untuk yang disorot.
    // Dua jalur itu bisa menyala berbarengan, dan dua kartu terangkat
    // sekaligus bukan yang dimaksud.
    //
    // Kartu terbesar cuma nilai DEFAULT-nya: menyorot kartu lain memindahkan
    // angkatan ke situ (yang tengah ikut menutup), dan begitu kursornya
    // meninggalkan kipas, angkatannya kembali ke kartu terbesar.
    const cards = [...stack.querySelectorAll('.dc-card')];

    // Puncak tumpukan mengikuti kartu yang sedang terbuka, tidak dipatok di
    // tengah. Dipatok, kartu terbesar tidak pernah ikut tertutup: z-nya tetap
    // tertinggi, jadi ia terus tampil selebar penuh walau angkatannya sudah
    // pindah — terlihat seperti dua kartu terbuka sekaligus.
    //
    // Sisi label ikut dihitung ulang terhadap puncak yang sama: yang di kiri
    // puncak tertutup dari kanan (bilah KIRI), yang di kanan tertutup dari
    // kiri (bilah KANAN). Kalau sisinya dipatok sementara puncaknya berpindah,
    // label sebagian kartu justru bersembunyi di balik tetangganya.
    const applyShape = (peak) => {
      cards.forEach((c, j) => {
        c.style.setProperty('--dc-z', n - Math.abs(j - peak));
        c.classList.toggle('is-left', j < peak);
        c.classList.toggle('is-right', j > peak);
        c.classList.toggle('is-active', j === peak);
      });
    };

    const lift = (i) => { _catActive = i; applyShape(i); };
    lift(centerPos);

    cards.forEach((card, i) => {
      // mouseenter, bukan mouseover: yang kedua ikut menyala lagi tiap kursor
      // berpindah antar anak elemen di dalam kartu yang sama.
      card.addEventListener('mouseenter', () => lift(i));
      // Sentuh tidak pernah memicu mouseenter, jadi tap dilayani terpisah.
      card.addEventListener('click', () => lift(i));
      card.addEventListener('focus', () => lift(i));
    });

    // mouseleave pada wadahnya, bukan pada tiap kartu: berpindah antar kartu
    // tidak keluar dari kipas, jadi angkatannya tidak berkedip di tengah.
    stack.addEventListener('mouseleave', () => lift(centerPos));
    stack.addEventListener('focusout', (e) => {
      if (!stack.contains(e.relatedTarget)) lift(centerPos);
    });

    if (!note) return;
    if (!hasData) { note.textContent = ''; return; }

    // Dua angka penutup: berapa yang terbaca sebagai kategori, dan berapa yang
    // tidak. Yang kedua penjaga kalau kode material di kamus ternyata tidak
    // sama bentuknya dengan yang ada di data produksi — tanpa itu selisihnya
    // cuma tampak sebagai kartu-kartu yang diam-diam kekecilan.
    const total = agg.cats.reduce((a, c) => a + c.pct, 0);
    const lainPct = agg.bahanKg ? (agg.lainKg / agg.bahanKg) * 100 : 0;
    note.textContent = agg.cats.length + ' kategori · total ' + fmtPct(total, 2)
      + (agg.lainKg > 0
        ? ' · ' + fmtNum(agg.lainKg) + ' kg (' + fmtPct(lainPct, 2) + ') tanpa kategori'
        : '');
  }

  // ═══════════════════════════════════════
  //  TABEL
  // ═══════════════════════════════════════

  function renderTable() {
    const table = document.getElementById('cuTable');
    const btn = document.getElementById('cuMoreBtn');
    if (!table || !btn) return;
    const s = SC.chart;

    const agg = cuAggregate(rangeDates(s), s.pv, s.depts);
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

    const agg = cuAggregate(rangeDates(s), s.pv, s.depts);
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
      // Cincinnya ikut menyempit di kanvas sempit, jadi angkanya dikecilkan
      // bersama teks callout — kalau tidak, persennya hampir setebal cincin.
      ctx.font = CALLOUT_TYPE[oneSided || legendOnly ? 'narrow' : 'wide'].pct;
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

    drawCalloutNodes(ctx, plan.nodes, outerR, cx, cy, plan.type);
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

  // Ukuran teks callout. Di kanvas sempit huruf dikecilkan — bukan cuma biar
  // tidak sesak: tiap piksel lebar kolom di sana mahal, dan huruf yang lebih
  // kecil membuat lebih banyak karakter muat per baris, sehingga nama utuh
  // lebih sering tercapai tanpa mengecilkan donutnya.
  const CALLOUT_TYPE = {
    wide: { name: NAME_FONT, val: VAL_FONT, lineH: 14, pct: '700 13px ' + FONT },
    narrow: { name: '600 10px ' + FONT, val: '600 9px ' + FONT, lineH: 12, pct: '700 11px ' + FONT },
  };
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
    const type = CALLOUT_TYPE[oneSided ? 'narrow' : 'wide'];
    const LINE_H = type.lineH;
    const PAD = 10, MARGIN = 10;
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

      ctx.font = type.name;
      n.lines = wrapText(ctx, n.name, n.maxW, NAME_LINES_MAX);
      n.h = (n.lines.length + 1) * LINE_H;
      let w = 0;
      n.lines.forEach(l => { w = Math.max(w, ctx.measureText(l).width); });

      ctx.font = type.val;
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
    return { nodes, fits, clipped, type };
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

  function drawCalloutNodes(ctx, nodes, outerR, cx, cy, type) {
    const LINE_H = type.lineH;
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

      ctx.font = type.name;
      ctx.fillStyle = '#1a1d2e';
      n.lines.forEach((ln, li) => ctx.fillText(ln, n.xText, yFirst + li * LINE_H));

      ctx.font = type.val;
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
    const dates = cuAllDates(s.depts);
    if (!dates.length) return;
    const MAX = s.win || 0;   // 0 = tanpa batas

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
        <div class="range-picker-header"><span class="range-picker-title">${hint}${MAX ? ` <span class="range-picker-hint">(maks ${MAX} data)</span>` : ''}</span><button class="range-picker-close" id="rpClose">×</button></div>
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

        // Section berjendela tetap membatasi pilihan sebanyak jendelanya:
        // sesudah tanggal mulai dipilih, tanggal yang membuat rentangnya
        // melebihi batas dimatikan — sama seperti picker harian di Overview.
        let tooFar = false;
        if (MAX && !isFuture && clickPhase === 1 && fromDate) {
          const lo = fromDate < dateStr ? fromDate : dateStr;
          const hi = fromDate < dateStr ? dateStr : fromDate;
          if (dates.filter(x => x >= lo && x <= hi).length > MAX) tooFar = true;
        }

        const cell = document.createElement('div');
        cell.className = 'range-cal-cell' + (!isFuture && !tooFar ? ' available' : '') +
          (!hasData && !isFuture && !tooFar ? ' no-data' : '') +
          (inRange ? ' in-range' : '') + (isEndpoint ? ' is-endpoint' : '') +
          (tooFar && !isFuture ? ' too-far' : '');
        cell.innerHTML = '<span>' + d + '</span>';
        if (!isFuture && !tooFar) {
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
}
