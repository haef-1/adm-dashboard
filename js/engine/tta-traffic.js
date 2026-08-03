/* ═══════════════════════════════════════
   TTA-TRAFFIC.JS — Ringkasan Trafic Bahan per Jam

   Chart trafic hanya butuh 24 angka per hari, tapi menghitungnya dari data
   mentah berarti mengunduh ±1 MB per bulan yang 77% isinya dibuang filter.
   Modul ini menyimpan hasil hitungnya di meta.tta_traffic_hourly:

     seluruh 9 bulan mentah  8,96 MB  →  ringkasan  ±45 KB

   Bentuk tersimpan:
     { filter: "<id filter>", days: { "YYYY-MM-DD": [[24 ekor], [24 kg]] } }

   `filter` ikut disimpan supaya ringkasan yang dibuat dengan aturan lama
   ketahuan basi dan dibangun ulang, bukan dipakai diam-diam.
   ═══════════════════════════════════════ */

const TTATraffic = (() => {
  const META_KEY = 'tta_traffic_hourly';

  // Naikkan versinya kalau aturan filter di bawah berubah.
  const FILTER_ID = 'pv:1A01+1A05|md:KARKAS*|v1';

  const PV = ['1A01', '1A05'];
  const MD_PREFIX = 'KARKAS';

  let _daysPromise = null;
  const _detailMonths = new Map(); // 'YYYY-MM' → promise rincian per material

  function _invalidate() { _daysPromise = null; _detailMonths.clear(); }

  // ── Index kamus yang lolos filter ──
  function filterSets() {
    const L = TTAEngine.getLookups();
    const pvOk = new Set();
    (L.pv || []).forEach((v, i) => { if (PV.includes(v)) pvOk.add(i); });
    const mdOk = new Set();
    (L.md || []).forEach((v, i) => { if (String(v).startsWith(MD_PREFIX)) mdOk.add(i); });
    return { pvOk, mdOk };
  }

  // ── Baris mentah → { tanggal: [[24 ekor], [24 kg]] } ──
  function bucketsFromRows(rows, sets) {
    const F = TTAEngine.F;
    const days = {};
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!sets.pvOk.has(r[F.PV]) || !sets.mdOk.has(r[F.MD])) continue;
      const d = r[F.DATE];
      let rec = days[d];
      if (!rec) rec = days[d] = [new Array(24).fill(0), new Array(24).fill(0)];
      rec[0][r[F.HOUR]] += r[F.EKOR];
      rec[1][r[F.HOUR]] += r[F.KG];
    }
    // Kg dibulatkan — satu desimal pun tidak berarti untuk grafik per jam,
    // dan pembulatan memangkas ukuran payload cukup banyak.
    for (const d in days) days[d][1] = days[d][1].map(v => Math.round(v));
    return days;
  }

  // ── Bangun ulang dari seluruh bulan (lambat, idealnya sekali saja) ──
  async function rebuild(onProgress) {
    await TTADB.ensureLookups();
    const sets = filterSets();
    const months = await TTADB.ensureMonths();
    const days = {};

    for (let i = 0; i < months.length; i++) {
      onProgress?.(i + 1, months.length, months[i]);
      // Sengaja lewat loadMonth, bukan ensureMonth: baris mentahnya cukup
      // dibaca sekali lalu dibuang, tidak perlu menumpuk 158rb baris di memori.
      const rows = await TTADB.loadMonth(months[i]);
      Object.assign(days, bucketsFromRows(rows, sets));
    }
    return days;
  }

  async function _save(days) {
    await TTADB.getClient()
      .from('meta')
      .upsert(
        { key: META_KEY, value: { filter: FILTER_ID, days }, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
  }

  // ── Ambil ringkasan; bangun dulu kalau belum ada / sudah basi ──
  function getDays(onProgress) {
    if (!_daysPromise) {
      _daysPromise = (async () => {
        const { data } = await TTADB.getClient()
          .from('meta')
          .select('value')
          .eq('key', META_KEY)
          .maybeSingle();

        const val = data?.value;
        if (val && val.filter === FILTER_ID && val.days) return val.days;

        const days = await rebuild(onProgress);
        // Viewer tidak punya izin tulis ke meta — biarkan gagal diam-diam,
        // ringkasannya tetap terpakai selama sesi ini.
        try { await _save(days); } catch (err) {
          console.warn('[TTATraffic] ringkasan tidak tersimpan:', err.message);
        }
        return days;
      })().catch(err => { _daysPromise = null; throw err; });
    }
    return _daysPromise;
  }

  // ── Rincian per material untuk satu tanggal ──
  // Ringkasan harian sengaja TIDAK menyimpan pecahan per material: dengan
  // belasan ukuran karkas payload-nya ikut naik belasan kali lipat, padahal
  // hanya dibutuhkan saat panel detail dibuka. Jadi baris mentah satu bulan
  // (±1 MB) diunduh sesuai kebutuhan, dipecah untuk SELURUH tanggal di bulan
  // itu sekaligus, lalu barisnya dibuang — menekan ‹ › dalam bulan yang sama
  // tidak menyentuh jaringan lagi.
  function detailFromRows(rows, sets) {
    const F = TTAEngine.F;
    const L = TTAEngine.getLookups();
    const MD = L.md || [];
    const DEPT = L.dept || [];
    const days = {};

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!sets.pvOk.has(r[F.PV]) || !sets.mdOk.has(r[F.MD])) continue;
      const d = r[F.DATE];
      let rec = days[d];
      if (!rec) rec = days[d] = new Map();
      let cell = rec.get(r[F.MD]);
      if (!cell) {
        rec.set(r[F.MD], (cell = {
          ekor: new Array(24).fill(0),
          kg: new Array(24).fill(0),
          // Satu sel bisa berisi transfer ke beberapa departemen sekaligus,
          // jadi tujuannya dikumpulkan sebagai himpunan per jam.
          dept: new Array(24),
        }));
      }
      const h = r[F.HOUR];
      cell.ekor[h] += r[F.EKOR];
      cell.kg[h] += r[F.KG];
      if (r[F.TUJUAN] !== -1) {
        (cell.dept[h] || (cell.dept[h] = new Set())).add(r[F.TUJUAN]);
      }
    }

    // Map → array terurut ukuran karkas ("KARKAS 1.2-1.3" → 1.2), supaya
    // barisnya membaca dari yang paling ringan ke yang paling berat.
    const out = {};
    for (const d in days) {
      out[d] = [...days[d].entries()]
        .map(([mdIdx, cell]) => ({
          md: MD[mdIdx],
          hours: [cell.ekor, cell.kg.map(v => Math.round(v))],
          dept: cell.dept.map(s => (s ? [...s].map(i => DEPT[i]) : null)),
        }))
        .sort((a, b) => {
          const na = parseFloat(String(a.md).replace(/[^\d.]/g, ' ').trim());
          const nb = parseFloat(String(b.md).replace(/[^\d.]/g, ' ').trim());
          if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
          return String(a.md).localeCompare(String(b.md), 'id');
        });
    }
    return out;
  }

  // → [{ md, hours: [[24 ekor], [24 kg]] }], kosong kalau tanggalnya nihil.
  function getDayDetail(date) {
    const ym = String(date).slice(0, 7);
    let p = _detailMonths.get(ym);
    if (!p) {
      p = (async () => {
        await TTADB.ensureLookups();
        const rows = await TTADB.loadMonth(ym);
        return detailFromRows(rows, filterSets());
      })().catch(err => { _detailMonths.delete(ym); throw err; });
      _detailMonths.set(ym, p);
    }
    return p.then(days => days[date] || []);
  }

  // ── Dipanggil setelah import: timpa hanya tanggal yang baru masuk ──
  // Import mengganti satu tanggal secara utuh, jadi menghitung ulang ember
  // tanggal itu dari baris yang baru saja diimpor sudah pasti benar —
  // tidak perlu membangun ulang seluruh ringkasan.
  async function applyImportedRows(rows) {
    try {
      const { data } = await TTADB.getClient()
        .from('meta')
        .select('value')
        .eq('key', META_KEY)
        .maybeSingle();

      const val = data?.value;
      // Belum ada ringkasan? Biarkan — nanti dibangun saat pertama dibutuhkan.
      if (!val || val.filter !== FILTER_ID || !val.days) return;

      const fresh = bucketsFromRows(rows, filterSets());
      const days = val.days;

      // Tanggal yang diimpor tapi tidak menyisakan baris lolos filter harus
      // dihapus, bukan dibiarkan memakai angka lama.
      for (const d of new Set(rows.map(r => r[TTAEngine.F.DATE]))) delete days[d];
      Object.assign(days, fresh);

      await _save(days);
    } catch (err) {
      console.warn('[TTATraffic] gagal memperbarui ringkasan:', err.message);
    } finally {
      // Di luar try: baris mentahnya sudah berubah apa pun nasib ringkasan di
      // atas, jadi cache _detailMonths pasti basi. Jalur return awal (ringkasan
      // belum pernah dibuat) dan jalur error dulu melewati ini dan meninggalkan
      // rincian material bulan itu memakai angka sebelum import.
      _invalidate();
    }
  }

  return {
    FILTER_ID, getDays, getDayDetail, rebuild, applyImportedRows,
    filterSets, bucketsFromRows, detailFromRows, _invalidate,
  };
})();
