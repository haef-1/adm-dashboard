/* ═══════════════════════════════════════
   KARKAS.JS — Karkas Page Renderer
   ═══════════════════════════════════════ */

const KarkasPage = (() => {
  let selectedDate = null;
  let _nav = null;

  function render(container) {
    selectedDate = Engine.getLastDate();

    container.innerHTML = `
      <div class="page-title">Karkas</div>

      <!-- By Product Section -->
      <div class="section" id="sectionByProduct">
        <div class="section-header">
          <span class="section-title">By Product</span>
          <div id="bpDateNav"></div>
        </div>
        <div id="bpContainer"></div>
      </div>
    `;

    const navContainer = document.getElementById("bpDateNav");
    _nav = DatePicker.createDateNav({
      initialDate: selectedDate,
      onPrev: () => {
        const prev = KPI.getPrevDate(selectedDate);
        if (prev) { selectedDate = prev; renderByProduct(); }
      },
      onNext: () => {
        const next = KPI.getNextDate(selectedDate);
        if (next) { selectedDate = next; renderByProduct(); }
      },
    });
    navContainer.appendChild(_nav.el);

    renderByProduct();
  }

  function renderByProduct() {
    const container = document.getElementById("bpContainer");
    if (!container || !selectedDate) return;

    _nav.setLabel(KPI.formatDate(selectedDate));
    _nav.setPrevEnabled(!!KPI.getPrevDate(selectedDate));
    _nav.setNextEnabled(!!KPI.getNextDate(selectedDate));

    const bp = Engine.getByProductForDate(selectedDate);
    const items = ByProduct.getOrderedItems(bp.items);
    const maxPct = items.length ? Math.max(...items.map((i) => i.pct)) : 1;

    container.innerHTML = `
      <div class="bp-headline">${bp.totalPct.toFixed(2)}%</div>
      ${items.map((item, i) => `
        <div class="bp-bar-row">
          <div class="bp-bar-name" title="${item.name}">${item.name}</div>
          <div class="bp-bar-track">
            <div class="bp-bar-fill" style="width:${((item.pct / maxPct) * 100).toFixed(1)}%;background:${ByProduct.barColor(i, items.length)}"></div>
          </div>
          <div class="bp-bar-pct">${item.pct.toFixed(2)}%</div>
        </div>
      `).join("")}
    `;
  }

  return { render };
})();
