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
  // Dept Card Perform: sumbangan tiap kategori produk terhadap bahan yang
  // masuk. Cuma halaman ini yang punya — halaman dept lain tidak menyetel
  // cfg.cards, jadi sectionnya tidak dirender sama sekali di sana.
  //
  // Dept-nya dipilih user di sini, tidak dipatok seperti kpiDepts. ALL BONELESS
  // menjumlah ketiganya: angkanya TIDAK sebanding dengan yield BONGKAR di chart
  // atas, karena MIX dan GRAMASI mengolah lanjut keluaran BONGKAR — keluaran
  // yang sama masuk penyebut dua kali. Naik atau turunnya tiap persen
  // tergantung bauran produk masing-masing sub-dept, jadi jangan dibaca
  // sebagai yield; gunanya melihat komposisi kategori seluruh Boneless.
  cards: {
    title: 'Showcase Hasil Boneless',
    pv: 'AYAM BARU',
    // Kategori yang dibaca berpasangan, digabung jadi satu kartu. Digabung
    // waktu menghitung, bukan di tabel dept_categorized — kamusnya tetap
    // menyimpan BB, BSB, BL, BSL terpisah seperti di file sumbernya, jadi
    // pasangan ini bisa diubah atau dilepas tanpa import ulang.
    merge: {
      'BB':  'BB/BSB',
      'BSB': 'BB/BSB',
      'BL':  'BL/BSL',
      'BSL': 'BL/BSL',
    },
    // Singkatan label kartu, dipetakan per KATA dan cuma memengaruhi tulisan di
    // bilah kartu — nama kategori di kamus, di perhitungan, dan di aria-label
    // tetap utuh. "CINCANG CAMPUR" ditulis tegak di bilah selebar ~27px pasti
    // terpotong; "C. CAMPUR" muat.
    abbr: {
      'CINCANG': 'C.',
      'TULANG':  'TL.',
    },
    defaultDept: 'BONELESS BONGKAR',
    deptOptions: [
      { value: 'BONELESS BONGKAR', label: 'Boneless Bongkar' },
      { value: 'BONELESS GRAMASI', label: 'Boneless Gramasi' },
      { value: 'BONELESS MIX',     label: 'Boneless Mix' },
      { value: 'ALL BONELESS',     label: 'All Boneless',
        depts: ['BONELESS BONGKAR', 'BONELESS GRAMASI', 'BONELESS MIX'] },
    ],
  },
});
