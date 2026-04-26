/* ═══════════════════════════════════════
   KPI.JS — KPI Calculations & Calendar
   ═══════════════════════════════════════ */

const KPI = (() => {
  // ── Format date for display ──
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function formatMonthYear(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return months[parseInt(m, 10) - 1] + ' ' + y;
  }

  // ── Navigate to prev/next date with data ──
  function getPrevDate(dateStr) {
    const dates = Engine.getAvailableDates();
    const idx = dates.indexOf(dateStr);
    return idx > 0 ? dates[idx - 1] : null;
  }

  function getNextDate(dateStr) {
    const dates = Engine.getAvailableDates();
    const idx = dates.indexOf(dateStr);
    return (idx >= 0 && idx < dates.length - 1) ? dates[idx + 1] : null;
  }

  // ── Delta formatting ──
  function formatDelta(current, previous, inverted) {
    if (previous === null || previous === undefined) {
      return { text: '—', cls: 'flat' };
    }
    const diff = current - previous;
    if (Math.abs(diff) < 0.005) {
      return { text: '—', cls: 'flat' };
    }
    const sign = diff > 0 ? '+' : '';
    const arrow = diff > 0 ? '▲' : '▼';
    let cls = diff > 0 ? 'up' : 'down';
    if (inverted) cls = diff > 0 ? 'down' : 'up'; // naik = buruk
    return {
      text: arrow + ' ' + sign + diff.toFixed(2) + '%',
      cls,
    };
  }

  function formatDeltaInt(current, previous) {
    if (previous === null || previous === undefined) {
      return { text: '—', cls: 'flat' };
    }
    const diff = current - previous;
    if (diff === 0) return { text: '—', cls: 'flat' };
    const sign = diff > 0 ? '+' : '';
    const arrow = diff > 0 ? '▲' : '▼';
    return {
      text: arrow + ' ' + sign + diff,
      cls: diff > 0 ? 'up' : 'down',
    };
  }

  // ── Calendar heatmap color ──
  function calColor(value, min, max) {
    if (!value) return 'transparent';
    const range = max - min || 1;
    const ratio = Math.max(0, Math.min(1, (value - min) / range));
    // Blue shallow range: #E6F1FB → #C0D9F5 → #9AC1EE → #85B7EB
    const colors = [
      [230, 241, 251], // #E6F1FB
      [192, 217, 245], // #C0D9F5
      [154, 193, 238], // #9AC1EE
      [133, 183, 235], // #85B7EB
    ];
    const idx = ratio * (colors.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, colors.length - 1);
    const t = idx - lo;
    const r = Math.round(colors[lo][0] + (colors[hi][0] - colors[lo][0]) * t);
    const g = Math.round(colors[lo][1] + (colors[hi][1] - colors[lo][1]) * t);
    const b = Math.round(colors[lo][2] + (colors[hi][2] - colors[lo][2]) * t);
    return `rgb(${r},${g},${b})`;
  }

  // ── ISO week number (v3 logic) ──
  function getISOWeek(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  // ── Get weeks in a month (for weekly period selector) ──
  function getWeeksInMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const weeks = [];
    const seen = new Set();

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      const wn = getISOWeek(ds);
      if (!seen.has(wn)) {
        seen.add(wn);
        // Find Monday of this week
        const mon = new Date(d);
        const day = mon.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        mon.setDate(mon.getDate() + diff);
        // Find Sunday
        const sun = new Date(mon);
        sun.setDate(sun.getDate() + 6);
        weeks.push({
          num: wn,
          from: mon.toISOString().slice(0, 10),
          to: sun.toISOString().slice(0, 10),
          label: 'W' + wn,
        });
      }
    }
    return weeks;
  }

  // ── Format number short (1234 → 1.2K) ──
  function fmtShort(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return Math.round(v).toString();
  }

  return {
    formatDate, formatMonthYear,
    getPrevDate, getNextDate,
    formatDelta, formatDeltaInt,
    calColor, getISOWeek, getWeeksInMonth, fmtShort,
  };
})();
