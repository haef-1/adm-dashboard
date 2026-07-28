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

  function _invalidate() { _daysPromise = null; }

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
      _invalidate();
    } catch (err) {
      console.warn('[TTATraffic] gagal memperbarui ringkasan:', err.message);
    }
  }

  return { FILTER_ID, getDays, rebuild, applyImportedRows, filterSets, bucketsFromRows, _invalidate };
})();
