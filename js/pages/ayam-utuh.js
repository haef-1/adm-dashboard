/* ═══════════════════════════════════════
   AYAM-UTUH.JS — Halaman Chart Departemen "AU"
   ═══════════════════════════════════════

   Isinya cuma config; seluruh halamannya digambar dept-page.js. */

const AyamUtuhPage = createDeptPage({
  pageTitle: 'Ayam Utuh',
  kpiTitle: 'Yield Ayam Utuh',
  // Satu departemen saja — seperti Cut Up, yield dan donut membaca daftar yang
  // sama. "AU" itu kode dept di data; yang tampil ke pembaca nama panjangnya.
  kpiDepts: ['AU'],
  itemDepts: ['AU'],
});
