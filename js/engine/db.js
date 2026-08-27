/* ═══════════════════════════════════════
   DB.JS — Supabase Persistence Layer
   ═══════════════════════════════════════ */

const DB = (() => {
  const SUPABASE_URL = 'https://wklvhvdxodplketkgwui.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_jDJEuI7JTk2NmMJS5dxSyw_xOapAE0y';

  let sb = null;

  function getClient() {
    if (!sb) sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return sb;
  }

  async function open() {
    getClient();
  }

  async function upsertByDate(rows, lookups) {
    const client = getClient();

    const byMonth = {};
    rows.forEach(r => {
      const ym = r[8].slice(0, 7);
      if (!byMonth[ym]) byMonth[ym] = [];
      byMonth[ym].push(r);
    });

    const importedDates = [...new Set(rows.map(r => r[8]))];
    let totalInserted = 0;
    let totalReplaced = 0;

    for (const ym of Object.keys(byMonth)) {
      const { data: existing } = await client
        .from('monthly_data')
        .select('rows')
        .eq('month', ym)
        .single();

      let existingRows = existing ? existing.rows : [];

      const newDates = new Set(byMonth[ym].map(r => r[8]));
      const replaced = existingRows.filter(r => newDates.has(r[8])).length;
      totalReplaced += replaced;

      existingRows = existingRows.filter(r => !newDates.has(r[8]));
      const merged = [...existingRows, ...byMonth[ym]];

      await client
        .from('monthly_data')
        .upsert({ month: ym, rows: merged, updated_at: new Date().toISOString() }, { onConflict: 'month' });

      totalInserted += byMonth[ym].length;
    }

    // Update months index
    const { data: existingMeta } = await client
      .from('meta')
      .select('value')
      .eq('key', 'months')
      .single();

    const existingMonths = existingMeta ? existingMeta.value.months || [] : [];
    const allMonths = [...new Set([...existingMonths, ...Object.keys(byMonth)])].sort();

    await client
      .from('meta')
      .upsert({ key: 'months', value: { months: allMonths }, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    // Save lookups
    if (lookups) {
      await client
        .from('meta')
        .upsert({ key: 'lookups', value: lookups, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }

    return { inserted: totalInserted, replaced: totalReplaced, dates: importedDates, months: allMonths };
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

  async function loadMonth(ym) {
    const { data, error } = await getClient()
      .from('monthly_data')
      .select('rows')
      .eq('month', ym)
      .single();

    if (error || !data) return [];
    return data.rows;
  }

  async function getMonths() {
    const { data, error } = await getClient()
      .from('meta')
      .select('value')
      .eq('key', 'months')
      .single();

    if (error || !data) return [];
    return data.value.months || [];
  }

  async function getLookups() {
    const { data, error } = await getClient()
      .from('meta')
      .select('value')
      .eq('key', 'lookups')
      .single();

    if (error || !data) return {};
    return data.value;
  }

  // ── Kamus material → kategori (tabel dept_categorized) ──
  // Reference data, bukan data harian: tabelnya kecil (puluhan baris) dan
  // tidak ikut siklus import bulanan, jadi diambil sekali saja waktu boot.
  //
  // Gagal ambil tidak dianggap fatal — yang memakainya cuma section Dept Card
  // Perform di halaman Boneless, dan lebih baik section itu bilang kamusnya
  // belum ada daripada seluruh app gagal boot karena satu tabel tambahan.
  async function getDeptCategories() {
    const { data, error } = await getClient()
      .from('dept_categorized')
      .select('mat, category');

    if (error || !data) {
      console.warn('[DB] dept_categorized tidak terbaca:', error && error.message);
      return [];
    }
    return data;
  }

  // Upsert murni, tanpa delete lebih dulu. Tabelnya dipakai bersama semua dept
  // dan tidak punya kolom dept, jadi tidak ada yang bisa dipakai membatasi
  // penghapusan — mengosongkan tabel tiap import berarti file Cut Up nanti
  // menghapus material Boneless. Konsekuensinya material yang dicoret dari
  // xlsx tetap tinggal di tabel; membuangnya lewat Supabase, manual.
  async function upsertDeptCategories(rows) {
    const client = getClient();
    const now = new Date().toISOString();
    const payload = rows.map(r => ({
      mat: r.mat, category: r.category, matdesc: r.matdesc || null, updated_at: now,
    }));

    // Dipotong supaya satu request tidak membengkak waktu kamusnya tumbuh
    // mencakup dept lain.
    const CHUNK = 500;
    for (let i = 0; i < payload.length; i += CHUNK) {
      const { error } = await client
        .from('dept_categorized')
        .upsert(payload.slice(i, i + CHUNK), { onConflict: 'mat' });
      if (error) throw new Error(error.message);
    }
    return { saved: payload.length };
  }

  async function getMeta(key) {
    if (key === 'months') return getMonths();
    if (key === 'lookups') return getLookups();
    return null;
  }

  async function setMeta() {}

  async function count() {
    const months = await getMonths();
    if (months.length === 0) return 0;
    let total = 0;
    for (const ym of months) {
      const rows = await loadMonth(ym);
      total += rows.length;
    }
    return total;
  }

  async function clearAll() {
    const client = getClient();
    await client.from('monthly_data').delete().neq('month', '');
    // Hanya key milik data produksi. Jangan pakai .neq('key','') — itu ikut
    // menghapus tta_lookups, padahal tta_monthly_data masih memakainya.
    await client.from('meta').delete().in('key', ['months', 'lookups']);
    return { deleted: true };
  }

  return {
    open, getClient, upsertByDate, loadAll, loadMonth, getMeta, setMeta, count, clearAll,
    getDeptCategories, upsertDeptCategories,
  };
})();
