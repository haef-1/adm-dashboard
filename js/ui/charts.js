/* ═══════════════════════════════════════
   CHARTS.JS — Chart.js Wrapper Utilities
   ═══════════════════════════════════════ */

const Charts = (() => {
  const instances = {};
  const observers = {};

  function destroy(id) {
    if (observers[id]) {
      observers[id].disconnect();
      delete observers[id];
    }
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  // ── Plugin: labels di tengah tiap segment + total di atas bar ──
  const VERT_THRESHOLD = 28; // bar width (px) below which labels go vertical

  const stackedLabelsPlugin = {
    id: 'stackedBarLabels',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      const datasets = chart.data.datasets;
      if (!datasets.length) return;
      const n = chart.data.labels.length;
      const isDesktop = window.innerWidth > 860;
      const fontSize = isDesktop ? (n > 5 ? 11 : 12) : (n > 5 ? 9 : 10);

      // Label tengah tiap segment
      datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        meta.data.forEach((bar, bi) => {
          const value = ds.data[bi];
          if (!value) return;
          const { x, y, base, width } = bar.getProps(['x', 'y', 'base', 'width'], true);
          const segH = Math.abs(base - y);
          const barW = width || 0;
          const text = KPI.fmtShort(value);

          if (barW >= VERT_THRESHOLD) {
            // Horizontal label
            if (segH < 14) return;
            ctx.save();
            ctx.font = `700 ${fontSize}px 'JetBrains Mono'`;
            ctx.fillStyle = '#fff';
            ctx.shadowColor = 'rgba(0,0,0,0.55)';
            ctx.shadowBlur = 3;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, (y + base) / 2);
            ctx.restore();
          } else if (barW >= 10) {
            // Vertical label (rotated -90°)
            if (segH < 28) return;
            ctx.save();
            ctx.translate(x, (y + base) / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.font = `700 ${fontSize}px 'JetBrains Mono'`;
            ctx.fillStyle = '#fff';
            ctx.shadowColor = 'rgba(0,0,0,0.55)';
            ctx.shadowBlur = 3;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 0, 0);
            ctx.restore();
          }
        });
      });

      // Total di atas keseluruhan bar
      const meta0 = chart.getDatasetMeta(0);
      chart.data.labels.forEach((_, bi) => {
        let total = 0, topY = Infinity;
        datasets.forEach((ds, di) => {
          total += ds.data[bi] || 0;
          const bar = chart.getDatasetMeta(di).data[bi];
          if (bar) topY = Math.min(topY, bar.getProps(['y'], true).y);
        });
        if (!total || topY === Infinity) return;
        const bar0 = meta0.data[bi];
        if (!bar0) return;
        const { x } = bar0.getProps(['x'], true);
        ctx.save();
        ctx.font = `700 ${fontSize}px 'JetBrains Mono'`;
        ctx.fillStyle = '#4a4f6a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(KPI.fmtShort(total), x, topY - 4);
        ctx.restore();
      });
    },
  };

  // ── Plugin: gap + rounded corners per segment ──
  const SEG_GAP = 1;
  const SEG_R = 5;

  function fillRoundRect(ctx, x, y, w, h, tl, tr, br, bl) {
    const r = Math.min(SEG_R, w / 2, h / 2);
    const rtl = tl ? r : 0, rtr = tr ? r : 0;
    const rbr = br ? r : 0, rbl = bl ? r : 0;
    ctx.beginPath();
    ctx.moveTo(x + rtl, y);
    ctx.lineTo(x + w - rtr, y);
    if (rtr) ctx.quadraticCurveTo(x + w, y, x + w, y + rtr); else ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - rbr);
    if (rbr) ctx.quadraticCurveTo(x + w, y + h, x + w - rbr, y + h); else ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + rbl, y + h);
    if (rbl) ctx.quadraticCurveTo(x, y + h, x, y + h - rbl); else ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + rtl);
    if (rtl) ctx.quadraticCurveTo(x, y, x + rtl, y); else ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  }

  const gapRoundPlugin = {
    id: 'gapRound',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;

      chart.data.labels.forEach((_, bi) => {
        const segs = [];
        chart.data.datasets.forEach((ds, di) => {
          if (!ds.data[bi]) return;
          const el = chart.getDatasetMeta(di).data[bi];
          if (!el) return;
          const ex = el.x, ey = el.y, ebase = el.base, ew = el.width;
          const segY = Math.min(ey, ebase);
          const segH = Math.abs(ebase - ey);
          if (segH < 1) return;
          segs.push({ color: ds.backgroundColor, x: ex - ew / 2, w: ew, y: segY, h: segH });
        });

        if (!segs.length) return;

        // Bottommost segment first (largest bottom edge = CUT UP)
        segs.sort((a, b) => (b.y + b.h) - (a.y + a.h));

        segs.forEach((seg, i) => {
          const isBottom = i === 0;
          const { color, x, w, y } = seg;
          const fullH = seg.h;
          const drawnH = fullH - (isBottom ? 0 : SEG_GAP);
          if (drawnH < 2) return;

          // Erase the full original segment area (removes Chart.js square bar)
          ctx.save();
          ctx.clearRect(x - 1, y - 1, w + 2, fullH + 2);
          // Draw rounded segment
          ctx.fillStyle = color;
          // CUT UP: top rounded only | others: top + bottom rounded
          fillRoundRect(ctx, x, y, w, drawnH,
            /* tl */ true, /* tr */ true,
            /* br */ !isBottom, /* bl */ !isBottom
          );
          ctx.restore();
        });
      });
    },
  };

  // ── Stacked bar chart (Bahan per Dept) ──
  function buildStackedBar(canvasId, data) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    // data: { labels: ['24 Mar', ...], datasets: [{ label, data, color }] }
    const deptColors = {
      'CUT UP': '#34d399',
      'BONELESS': '#60a5fa',
      'AU': '#fbbf24',
      'PARTING': '#f472b6',
    };

    const n = data.labels.length;
    const barPct  = n <= 3 ? 0.45 : n <= 5 ? 0.55 : n <= 7 ? 0.65 : 0.75;
    const catPct  = n <= 3 ? 0.5  : n <= 5 ? 0.65 : n <= 7 ? 0.75 : 0.85;

    const datasets = data.datasets.map(ds => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: deptColors[ds.label] || '#888',
      borderRadius: 0,
      borderSkipped: false,
      barPercentage: barPct,
      categoryPercentage: catPct,
    }));

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels: data.labels, datasets },
      plugins: [gapRoundPlugin, stackedLabelsPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { family: "'Plus Jakarta Sans'", size: 11, weight: '600' },
              color: '#6b7094',
            },
          },
          y: {
            stacked: true,
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.04)', lineWidth: 0.5 },
            border: { display: false },
            ticks: {
              font: { family: "'JetBrains Mono'", size: 10 },
              color: '#9498b3',
              callback: v => KPI.fmtShort(v),
            },
          },
        },
      },
    });

    // ResizeObserver: resize chart saat container berubah lebar
    const canvas = document.getElementById(canvasId);
    if (canvas && window.ResizeObserver) {
      const ro = new ResizeObserver(() => instances[canvasId]?.resize());
      ro.observe(canvas.parentElement);
      observers[canvasId] = ro;
    }

    return instances[canvasId];
  }

  // ── SVG Donut (progressive fill) ──
  function renderDonut(containerId, pct) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const size = 72;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    // Gradient blue: #85B7EB → #378ADD
    container.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs>
          <linearGradient id="donutGrad_${containerId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#85B7EB"/>
            <stop offset="100%" stop-color="#378ADD"/>
          </linearGradient>
        </defs>
        <circle cx="${size/2}" cy="${size/2}" r="${radius}"
          fill="none" stroke="#e2e5ef" stroke-width="${strokeWidth}"/>
        <circle cx="${size/2}" cy="${size/2}" r="${radius}"
          fill="none" stroke="url(#donutGrad_${containerId})" stroke-width="${strokeWidth}"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
          stroke-linecap="round"
          transform="rotate(-90 ${size/2} ${size/2})"
          style="transition: stroke-dashoffset 0.8s ease;"/>
      </svg>
      <div class="donut-label">${pct.toFixed(1)}%</div>
    `;
  }

  return { destroy, buildStackedBar, renderDonut, instances };
})();
