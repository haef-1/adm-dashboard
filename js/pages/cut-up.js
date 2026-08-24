/* ═══════════════════════════════════════
   CUT-UP.JS — Halaman Chart Departemen "CUT UP"
   ═══════════════════════════════════════

   Isinya cuma config; seluruh halamannya digambar dept-page.js. */

const CutUpPage = createDeptPage({
  pageTitle: 'Cut Up',
  kpiTitle: 'Yield Cut Up',
  // Cut Up satu departemen saja, jadi yield dan donut membaca daftar yang sama.
  kpiDepts: ['CUT UP'],
  itemDepts: ['CUT UP'],
});
