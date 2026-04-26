/* ═══════════════════════════════════════
   DATEPICKER.JS — Date Navigation & Pickers
   ═══════════════════════════════════════ */

const DatePicker = (() => {

  // ── Create a simple date navigator ──
  function createDateNav(opts) {
    // opts: { id, initialDate, onPrev, onNext, onClick }
    const wrap = document.createElement('div');
    wrap.className = 'date-nav';
    wrap.id = opts.id || '';
    wrap.innerHTML = `
      <button class="date-nav-btn" data-dir="prev">‹</button>
      <span class="date-nav-label">${KPI.formatDate(opts.initialDate || '')}</span>
      <button class="date-nav-btn" data-dir="next">›</button>
    `;

    const label = wrap.querySelector('.date-nav-label');
    const prevBtn = wrap.querySelector('[data-dir="prev"]');
    const nextBtn = wrap.querySelector('[data-dir="next"]');

    prevBtn.addEventListener('click', () => opts.onPrev?.());
    nextBtn.addEventListener('click', () => opts.onNext?.());
    if (opts.onClick) label.addEventListener('click', () => opts.onClick());

    return {
      el: wrap,
      setLabel(text) { label.textContent = text; },
      setPrevEnabled(v) { prevBtn.disabled = !v; },
      setNextEnabled(v) { nextBtn.disabled = !v; },
    };
  }

  // ── Create month navigator (for calendar) ──
  function createMonthNav(opts) {
    const wrap = document.createElement('div');
    wrap.className = 'date-nav';
    wrap.innerHTML = `
      <button class="date-nav-btn" data-dir="prev">‹</button>
      <span class="date-nav-label">${KPI.formatMonthYear(opts.initialMonth || '')}</span>
      <button class="date-nav-btn" data-dir="next">›</button>
    `;

    const label = wrap.querySelector('.date-nav-label');
    const prevBtn = wrap.querySelector('[data-dir="prev"]');
    const nextBtn = wrap.querySelector('[data-dir="next"]');

    prevBtn.addEventListener('click', () => opts.onPrev?.());
    nextBtn.addEventListener('click', () => opts.onNext?.());

    return {
      el: wrap,
      setLabel(text) { label.textContent = text; },
      setPrevEnabled(v) { prevBtn.disabled = !v; },
      setNextEnabled(v) { nextBtn.disabled = !v; },
    };
  }

  // ── Create date range navigator (for chart) ──
  function createRangeNav(opts) {
    const wrap = document.createElement('div');
    wrap.className = 'date-nav';
    wrap.innerHTML = `
      <button class="date-nav-btn" data-dir="prev">‹</button>
      <span class="date-nav-label">${opts.label || ''}</span>
      <button class="date-nav-btn" data-dir="next">›</button>
    `;

    const label = wrap.querySelector('.date-nav-label');
    const prevBtn = wrap.querySelector('[data-dir="prev"]');
    const nextBtn = wrap.querySelector('[data-dir="next"]');

    prevBtn.addEventListener('click', () => opts.onPrev?.());
    nextBtn.addEventListener('click', () => opts.onNext?.());
    if (opts.onClick) label.addEventListener('click', () => opts.onClick());

    return {
      el: wrap,
      setLabel(text) { label.textContent = text; },
      setPrevEnabled(v) { prevBtn.disabled = !v; },
      setNextEnabled(v) { nextBtn.disabled = !v; },
    };
  }

  // ── Create custom animated select ──
  function createCustomSelect(options, initialValue, onChange) {
    const initial = options.find(o => o.value === initialValue) || options[0];

    const wrap = document.createElement('div');
    wrap.className = 'custom-select';
    wrap.innerHTML = `
      <div class="custom-select-trigger">
        <span class="custom-select-label">${initial.label}</span>
        <svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="custom-select-dropdown">
        ${options.map(o => `
          <div class="custom-select-option${o.value === initialValue ? ' selected' : ''}" data-value="${o.value}">
            ${o.label}
          </div>`).join('')}
      </div>
    `;

    let value = initial.value;
    const trigger = wrap.querySelector('.custom-select-trigger');
    const labelEl = wrap.querySelector('.custom-select-label');
    const dropdown = wrap.querySelector('.custom-select-dropdown');

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = wrap.classList.contains('open');
      document.querySelectorAll('.custom-select.open').forEach(s => s.classList.remove('open'));
      if (!isOpen) wrap.classList.add('open');
    });

    function attachOptionListeners() {
      dropdown.querySelectorAll('.custom-select-option').forEach(opt => {
        opt.addEventListener('click', () => {
          value = opt.dataset.value;
          labelEl.textContent = opt.textContent.trim();
          dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          wrap.classList.remove('open');
          onChange(value);
        });
      });
    }
    attachOptionListeners();

    document.addEventListener('click', () => wrap.classList.remove('open'));

    return {
      el: wrap,
      getValue: () => value,
      updateOptions(newOptions, newValue) {
        const sel = newOptions.find(o => o.value === newValue) ? newValue : (newOptions[0]?.value || '');
        value = sel;
        labelEl.textContent = (newOptions.find(o => o.value === sel) || newOptions[0])?.label || '';
        dropdown.innerHTML = newOptions.map(o =>
          `<div class="custom-select-option${o.value === sel ? ' selected' : ''}" data-value="${o.value}">${o.label}</div>`
        ).join('');
        attachOptionListeners();
      },
    };
  }

  return { createDateNav, createMonthNav, createRangeNav, createCustomSelect };
})();
