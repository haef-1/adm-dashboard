/* ═══════════════════════════════════════
   BONELESS.JS — Halaman Chart Departemen "BONELESS"
   ═══════════════════════════════════════

   Isinya cuma config; seluruh halamannya digambar dept-page.js. */

const BonelessPage = createDeptPage({
  pageTitle: 'Boneless',
  kpiTitle: 'Yield Boneless',
  // Yield cuma dari BONELESS BONGKAR: di situ karkas masuk sebagai BAHAN, jadi
  // rasio hasil/bahannya berarti. MIX dan GRAMASI mengolah lanjut keluaran
  // BONGKAR — ikut dijumlah di penyebut, yield-nya jadi terbaca terlalu rendah.
  kpiDepts: ['BONELESS BONGKAR'],
  // Donut dan tabelnya sebaliknya: ketiganya keluaran Boneless, jadi item
  // hasilnya digabung. Nama item yang sama dari dept berbeda menyatu jadi satu
  // baris. GRAMASI belum tentu ada di data yang sudah di-import — kalau begitu
  // dept itu dilewati tanpa error, bukan bikin donutnya kosong.
  itemDepts: ['BONELESS BONGKAR', 'BONELESS MIX', 'BONELESS GRAMASI'],
});
