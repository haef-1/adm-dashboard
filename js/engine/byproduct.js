/* ═══════════════════════════════════════
   BYPRODUCT.JS — ByProduct Calculations
   ═══════════════════════════════════════ */

// ByProduct logic is handled in Engine.getByProductForDate()
// This file reserved for future by-product specific logic
// (fixed order, grouping, etc.)

const ByProduct = (() => {
  // Fixed display order (to be provided by user)
  // For now, sort by kg descending as default
  const FIXED_ORDER = [];

  function getOrderedItems(items) {
    if (FIXED_ORDER.length > 0) {
      // Sort by fixed order
      return items.sort((a, b) => {
        const ia = FIXED_ORDER.indexOf(a.name);
        const ib = FIXED_ORDER.indexOf(b.name);
        if (ia === -1 && ib === -1) return b.kg - a.kg;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    }
    // Default: sort descending by kg
    return items.sort((a, b) => b.kg - a.kg);
  }

  // Purple gradient for bars (intensity varies)
  function barColor(index, total) {
    const base = [139, 92, 246]; // #8b5cf6
    const minAlpha = 0.4;
    const maxAlpha = 1.0;
    const alpha = total <= 1 ? 1 : maxAlpha - (index / (total - 1)) * (maxAlpha - minAlpha);
    return `rgba(${base[0]},${base[1]},${base[2]},${alpha})`;
  }

  return { getOrderedItems, barColor, FIXED_ORDER };
})();
