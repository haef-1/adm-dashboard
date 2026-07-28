/* ═══════════════════════════════════════
   TTA-DB.JS — TTA Supabase Persistence Layer

   Tabel : tta_monthly_data (month PK, rows jsonb, updated_at)
   Meta  : tta_months, tta_create_months, tta_lookups

   Memakai client yang sama dengan DB.js — satu koneksi, satu sesi login.
   ═══════════════════════════════════════ */

const TTADB = (() => {
  const TABLE = 'tta_monthly_data';
  const K_MONTHS = 'tta_months';
  const K_CREATE_MONTHS = 'tta_create_months';
  const K_LOOKUPS = 'tta_lookups';

  const DATE_IDX = 9;   // Proses Order Date — partition key
  const DLAG_IDX = 10;  // createDate - date, in days

  function getClient() {
    return DB.getClient();
  }

  // ── Bulan berdasarkan Create Date (date + dLag) ──
  function _createMonth(r) {
    return TTAEngine.addDays(r[DATE_IDX], r[DLAG_IDX]).slice(0, 7);
  }

  async function _getMetaValue(key) {
    const { data, error } = await getClient()
      .from('meta')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return null;
    return data.value;
  }

  async function _setMetaValue(key, value) {
    await getClient()
      .from('meta')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  }

  async function upsertByDate(rows, lookups) {
    const client = getClient();

    // ── Kelompokkan per bulan Proses Order Date ──
    const byMonth = {};
    rows.forEach(r => {
      const ym = r[DATE_IDX].slice(0, 7);
      if (!byMonth[ym]) byMonth[ym] = [];
      byMonth[ym].push(r);
    });

    const importedDates = [...new Set(rows.map(r => r[DATE_IDX]))];
    let totalInserted = 0;
    let totalReplaced = 0;

    for (const ym of Object.keys(byMonth)) {
      const { data: existing } = await client
        .from(TABLE)
        .select('rows')
        .eq('month', ym)
        .maybeSingle();

      let existingRows = existing ? existing.rows : [];

      // Tanggal yang di-import menimpa tanggal yang sama di DB.
      const newDates = new Set(byMonth[ym].map(r => r[DATE_IDX]));
      const replaced = existingRows.filter(r => newDates.has(r[DATE_IDX])).length;
      totalReplaced += replaced;

      existingRows = existingRows.filter(r => !newDates.has(r[DATE_IDX]));
      const merged = [...existingRows, ...byMonth[ym]];

      const { error } = await client
        .from(TABLE)
        .upsert({ month: ym, rows: merged, updated_at: new Date().toISOString() }, { onConflict: 'month' });
      if (error) throw error;

      totalInserted += byMonth[ym].length;
    }

    // ── Index bulan (Proses Order Date) ──
    const existingMonths = (await _getMetaValue(K_MONTHS))?.months || [];
    const allMonths = [...new Set([...existingMonths, ...Object.keys(byMonth)])].sort();
    await _setMetaValue(K_MONTHS, { months: allMonths });

    // ── Index bulan kedua (Create Date) ──
    const existingCreate = (await _getMetaValue(K_CREATE_MONTHS))?.months || [];
    const newCreate = new Set(rows.map(_createMonth));
    const allCreateMonths = [...new Set([...existingCreate, ...newCreate])].sort();
    await _setMetaValue(K_CREATE_MONTHS, { months: allCreateMonths });

    // ── Kamus ──
    if (lookups) await _setMetaValue(K_LOOKUPS, lookups);

    return {
      inserted: totalInserted,
      replaced: totalReplaced,
      dates: importedDates,
      months: allMonths,
      createMonths: allCreateMonths,
    };
  }

  async function loadMonth(ym) {
    const { data, error } = await getClient()
      .from(TABLE)
      .select('rows')
      .eq('month', ym)
      .maybeSingle();

    if (error || !data) return [];
    return data.rows;
  }

  async function loadAll() {
    const months = await getMonths();
    let all = [];
    for (const ym of months) {
      const rows = await loadMonth(ym);
      all = all.concat(rows);
    }
    return all;
  }

  async function getMonths() {
    return (await _getMetaValue(K_MONTHS))?.months || [];
  }

  async function getCreateMonths() {
    return (await _getMetaValue(K_CREATE_MONTHS))?.months || [];
  }

  async function getLookups() {
    return (await _getMetaValue(K_LOOKUPS)) || {};
  }

  async function count() {
    const { data, error } = await getClient()
      .from(TABLE)
      .select('month, rows');
    if (error || !data) return 0;
    return data.reduce((sum, r) => sum + (r.rows ? r.rows.length : 0), 0);
  }

  // Hanya menghapus data TTA — tabel monthly_data & meta lama tidak tersentuh.
  async function clearAll() {
    const client = getClient();
    await client.from(TABLE).delete().neq('month', '');
    await client.from('meta').delete().in('key', [K_MONTHS, K_CREATE_MONTHS, K_LOOKUPS]);
    return { deleted: true };
  }

  return {
    getClient, upsertByDate, loadMonth, loadAll,
    getMonths, getCreateMonths, getLookups, count, clearAll,
  };
})();
