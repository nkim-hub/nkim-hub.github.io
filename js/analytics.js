// Charts for analytics.html, drawn with D3 (one chart library, loaded from cdnjs).
// Firm charts combine the synthetic archive (js/case-history.js) with the live cases (js/data.js);
// court charts use published statewide figures. Each chart draws the first time it scrolls into view,
// so the page is usable before every chart has been built.

(() => {
  // ---------- Real data: Judicial Council of California, 2026 Court Statistics Report, Appendix F ----------
  // Fiscal years 2015–16 through 2024–25 (the report revises earlier years, so all ten come from this edition).
  const fiscalLabels = ['2015–16', '2016–17', '2017–18', '2018–19', '2019–20', '2020–21', '2021–22', '2022–23', '2023–24', '2024–25'];

  const filings = {
    otherCivil: [140384, 144422, 151684, 159734, 148587, 152634, 157890, 174449, 189101, 188924],
    motorVehicle: [35103, 38838, 41832, 42249, 43176, 44558, 39006, 40104, 46812, 49326],
    otherInjury: [21518, 22342, 23463, 23275, 22865, 23374, 22495, 39068, 40567, 59077],
    smallClaimsAppeals: [4716, 4450, 4129, 3649, 2560, 1866, 2425, 2217, 2306, 2207],
  };
  // Total unlimited civil = sum of all four case types. The report's printed totals for 2015–16 through 2018–19
  // leave out small claims appeals, so the totals are computed here to count every year the same way.
  filings.total = fiscalLabels.map(
    (_, i) => filings.otherCivil[i] + filings.motorVehicle[i] + filings.otherInjury[i] + filings.smallClaimsAppeals[i]
  );

  // General unlimited civil cases disposed of in less than 12 and 24 months (percent).
  const speed = {
    within12: [64, 66, 64, 69, 71, 65, 62, 60, 62, 65],
    within24: [83, 84, 85, 90, 91, 88, 84, 82, 82, 86],
  };

  // ---------- Colors ----------
  // Practice areas keep one color each, drawn from the site's navy and gold. The fixed order keeps every
  // pair distinguishable, including for color-blind readers (checked with a palette validator).
  const AREAS = HB.practiceAreas;
  const AREA_COLORS = ['#1b2f55', '#c9a54a', '#6f8fc0', '#7d621c', '#b9c8de', '#2e5e8c'];
  const AREA_SHORT = {
    'Business Law': 'Business',
    'Real Estate': 'Real estate',
    'Personal Injury': 'Injury',
    'Estate Planning': 'Estate',
    'Negotiation & Mediation': 'Mediation',
    'Employment Counsel': 'Employment',
  };
  const areaColor = (area) => AREA_COLORS[AREAS.indexOf(area)] || '#8a93a3';
  // Open-case stages are ordered, so they step through one blue ramp.
  const STAGES = ['Intake', 'Active', 'In Litigation'];
  const STAGE_COLORS = ['#7f9cc7', '#3f5f91', '#1b2f55'];
  const COURT_SERIES = [
    { key: 'otherCivil', label: 'Non-injury cases (contracts, business, property, employment)', short: 'Non-injury', color: '#1b2f55' },
    { key: 'motorVehicle', label: 'Motor vehicle injury, damage, or death', short: 'Motor vehicle', color: '#c9a54a' },
    { key: 'otherInjury', label: 'Non-vehicle injury, damage, or death', short: 'Other injury', color: '#7f9cc7' },
  ];
  const INK = '#121a2b';
  const NAVY = '#1b2f55';
  const GOLD = '#c9a54a';
  const SURFACE = '#ffffff';

  const SOURCES = ['Client referral', 'Professional referral', 'Online search', 'Returning client', 'Not recorded'];
  const OUTCOMES = ['Settled', 'Completed', 'Trial verdict', 'Dismissed or withdrawn', 'Still open'];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const number = new Intl.NumberFormat('en-US');
  const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
  const pct = (v) => `${Math.round(v * 100)}%`;

  // ---------- Dates and small statistics ----------
  const DAY = 86400000;
  const toTime = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const monthKey = (iso) => iso.slice(0, 7);

  function addMonths(key, n) {
    return new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7);
  }

  function monthLabel(key, long) {
    const m = +key.slice(5, 7) - 1;
    return long ? `${MONTH_NAMES[m]} ${key.slice(0, 4)}` : `${MONTH_NAMES[m].slice(0, 3)} ’${key.slice(2, 4)}`;
  }

  function quarterOf(key) {
    return `${key.slice(0, 4)} Q${Math.floor((+key.slice(5, 7) - 1) / 3) + 1}`;
  }

  const quarterLabel = (q) => `${q.slice(5)} ’${q.slice(2, 4)}`;

  function quantile(values, p) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * p;
    const lo = Math.floor(pos);
    return sorted[lo] + (sorted[Math.ceil(pos)] - sorted[lo]) * (pos - lo);
  }

  const sum = (list, fn) => list.reduce((s, d) => s + fn(d), 0);

  // ---------- Case data ----------
  const archive = typeof HB_HISTORY !== 'undefined' ? HB_HISTORY.cases : [];
  const live = HB.loadCases().map((c) => ({
    ...c,
    resolved: '',
    source: 'Not recorded',
    outcome: HB.isOpen(c) ? 'Still open' : c.status === 'Settled' ? 'Settled' : 'Completed',
    fees: Number(c.fees) || 0,
  }));
  const allCases = archive.concat(live).filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.opened || ''));

  // The window ends with the latest month that has new cases (never in the future), and covers three years.
  const thisMonth = new Date().toISOString().slice(0, 7);
  let endKey = monthKey(allCases.reduce((max, c) => (c.opened > max ? c.opened : max), '2000-01-01'));
  if (endKey > thisMonth) endKey = thisMonth;
  if (archive.length && endKey < HB_HISTORY.months[HB_HISTORY.months.length - 1]) endKey = HB_HISTORY.months[HB_HISTORY.months.length - 1];
  const allMonths = Array.from({ length: 36 }, (_, i) => addMonths(endKey, i - 35));

  const state = { attorney: '', range: 36 };

  // Everything the firm charts need for the current attorney and time range.
  function slice() {
    const cases = state.attorney ? allCases.filter((c) => c.attorney === state.attorney) : allCases;
    const months = allMonths.slice(-state.range);
    const first = months[0];
    const last = months[months.length - 1];
    const inWindow = (iso) => !!iso && monthKey(iso) >= first && monthKey(iso) <= last;
    return {
      cases,
      months,
      opened: cases.filter((c) => inWindow(c.opened)),
      resolved: cases
        .filter((c) => inWindow(c.resolved))
        .map((c) => ({ ...c, days: Math.max(1, Math.round((toTime(c.resolved) - toTime(c.opened)) / DAY)) })),
      open: cases.filter(HB.isOpen),
    };
  }

  function monthlyCounts(cases, months) {
    const index = new Map(months.map((k, i) => [k, i]));
    const rows = months.map((key) => Object.fromEntries([['key', key], ...AREAS.map((a) => [a, 0])]));
    cases.forEach((c) => {
      const i = index.get(monthKey(c.opened));
      if (i !== undefined && c.area in rows[i]) rows[i][c.area] += 1;
    });
    return rows;
  }

  function flowData(cases) {
    const counts = new Map();
    const add = (a, b) => {
      const k = `${a}\u0000${b}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    };
    cases.forEach((c) => {
      if (!AREAS.includes(c.area)) return;
      add(SOURCES.includes(c.source) ? c.source : 'Not recorded', c.area);
      add(c.area, OUTCOMES.includes(c.outcome) ? c.outcome : 'Still open');
    });
    const links = [...counts].map(([k, value]) => {
      const [source, target] = k.split('\u0000');
      return { source, target, value };
    });
    const used = new Set(links.flatMap((l) => [l.source, l.target]));
    const nodes = [
      ...SOURCES.map((name) => ({ name, col: 0 })),
      ...AREAS.map((name) => ({ name, col: 1 })),
      ...OUTCOMES.map((name) => ({ name, col: 2 })),
    ].filter((n) => used.has(n.name));
    const order = new Map(nodes.map((n, i) => [n.name, i]));
    links.sort((a, b) => order.get(a.source) - order.get(b.source) || order.get(a.target) - order.get(b.target));
    return { nodes, links };
  }

  // Each area's intake in each calendar month, as an index where 100 is that area's average month.
  function seasonData(s) {
    const occurrences = Array(12).fill(0);
    s.months.forEach((k) => {
      occurrences[+k.slice(5, 7) - 1] += 1;
    });
    return AREAS.map((area) => {
      const counts = Array(12).fill(0);
      const inArea = s.opened.filter((c) => c.area === area);
      inArea.forEach((c) => {
        counts[+c.opened.slice(5, 7) - 1] += 1;
      });
      const overall = inArea.length / s.months.length;
      const avgs = counts.map((n, m) => (occurrences[m] ? n / occurrences[m] : null));
      // A centered three-month average (wrapping December into January) separates the seasonal
      // pattern from month-to-month noise in small counts.
      const cells = avgs.map((avg, m) => {
        const window = [avgs[(m + 11) % 12], avg, avgs[(m + 1) % 12]].filter((v) => v !== null);
        const smooth = avg === null ? null : window.reduce((a, b) => a + b, 0) / window.length;
        return { area, month: m, avg, index: overall && smooth !== null ? Math.round((smooth / overall) * 100) : null };
      });
      return { area, total: inArea.length, cells };
    });
  }

  function workloadData() {
    return HB.attorneys.map((a) => {
      const open = allCases.filter((c) => c.attorney === a.id && HB.isOpen(c));
      const row = { id: a.id, name: a.name, total: open.length };
      STAGES.forEach((st) => {
        row[st] = open.filter((c) => c.status === st).length;
      });
      return row;
    });
  }

  function feesData(s) {
    const quarters = [...new Set(s.months.map(quarterOf))];
    const rows = quarters.map((q) => Object.fromEntries([['key', q], ...AREAS.map((a) => [a, 0])]));
    const index = new Map(quarters.map((q, i) => [q, i]));
    s.resolved.forEach((c) => {
      const i = index.get(quarterOf(c.resolved.slice(0, 7)));
      if (i !== undefined && c.area in rows[i]) rows[i][c.area] += c.fees;
    });
    rows.forEach((r) => {
      r.total = sum(AREAS, (a) => r[a]);
    });
    return rows;
  }

  // ---------- Data tables (shown under each chart for accessibility) ----------
  function buildTable(headers, rowsData, caption) {
    const table = document.createElement('table');
    table.className = 'data-table';
    if (caption) table.createCaption().textContent = caption;
    const thead = table.createTHead().insertRow();
    headers.forEach((h, i) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      if (i > 0) th.className = 'num';
      thead.append(th);
    });
    const tbody = table.createTBody();
    rowsData.forEach((r) => {
      const tr = tbody.insertRow();
      r.forEach((v, i) => {
        const cell = i === 0 ? document.createElement('th') : tr.insertCell();
        if (i === 0) {
          cell.scope = 'row';
          tr.append(cell);
        } else {
          cell.className = 'num';
        }
        cell.textContent = typeof v === 'number' ? number.format(v) : v;
      });
    });
    return table;
  }

  function renderTable(containerId, headers, rowsData) {
    document.getElementById(containerId).replaceChildren(buildTable(headers, rowsData));
  }

  function updateFirmTables(s) {
    const areaHeads = AREAS.map((a) => AREA_SHORT[a]);

    const months = monthlyCounts(s.opened, s.months);
    renderTable('intakeTable', ['Month', ...areaHeads, 'Total'], months.map((r) => [monthLabel(r.key), ...AREAS.map((a) => r[a]), sum(AREAS, (a) => r[a])]).reverse());

    const flow = flowData(s.opened);
    const val = (a, b) => (flow.links.find((l) => l.source === a && l.target === b) || { value: 0 }).value;
    const sources = SOURCES.filter((src) => flow.nodes.some((n) => n.name === src));
    document.getElementById('flowTable').replaceChildren(
      buildTable(['Referral source', ...areaHeads], sources.map((src) => [src, ...AREAS.map((a) => val(src, a))]), 'Matters by referral source and practice area'),
      buildTable(['Practice area', ...OUTCOMES], AREAS.map((a) => [a, ...OUTCOMES.map((o) => val(a, o))]), 'Matters by practice area and outcome')
    );

    renderTable(
      'swarmTable',
      ['Practice area', 'Resolved', '25th percentile (days)', 'Median (days)', '75th percentile (days)', 'Fees earned'],
      AREAS.map((a) => {
        const days = s.resolved.filter((c) => c.area === a).map((c) => c.days);
        const fmt = (p) => (days.length ? Math.round(quantile(days, p)) : '—');
        return [a, days.length, fmt(0.25), fmt(0.5), fmt(0.75), HB.money.format(sum(s.resolved.filter((c) => c.area === a), (c) => c.fees))];
      })
    );

    const season = seasonData(s);
    renderTable('seasonTable', ['Month', ...areaHeads], MONTH_NAMES.map((m, i) => [m, ...season.map((r) => (r.cells[i].index === null ? '—' : r.cells[i].index))]));

    renderTable('workloadTable', ['Attorney', ...STAGES, 'Total open'], workloadData().map((r) => [r.name, ...STAGES.map((st) => r[st]), r.total]));

    renderTable('feesTable', ['Quarter', ...areaHeads, 'Total'], feesData(s).map((r) => [quarterLabel(r.key), ...AREAS.map((a) => compactMoney.format(r[a])), compactMoney.format(r.total)]).reverse());
  }

  renderTable(
    'filingsTable',
    ['Fiscal year', 'Non-injury', 'Motor vehicle injury, damage, or death', 'Non-vehicle injury, damage, or death', 'Total'],
    fiscalLabels.map((fy, i) => [fy, filings.otherCivil[i], filings.motorVehicle[i], filings.otherInjury[i], filings.total[i]]).reverse()
  );
  renderTable(
    'speedTable',
    ['Fiscal year', 'Resolved within 12 months', 'Resolved within 24 months'],
    fiscalLabels.map((fy, i) => [fy, `${speed.within12[i]}%`, `${speed.within24[i]}%`]).reverse()
  );

  // ---------- Filters ----------
  const filter = document.getElementById('attorneyFilter');
  filter.append(new Option('All attorneys', ''));
  HB.attorneys.forEach((a) => filter.append(new Option(a.name, a.id)));

  // A row of toggle buttons that behaves as one radio group (arrow keys move between options).
  function setupSeg(groupId, onChange) {
    const group = document.getElementById(groupId);
    const buttons = [...group.querySelectorAll('button')];
    const select = (btn, focus) => {
      buttons.forEach((b) => {
        const on = b === btn;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      if (focus) btn.focus();
      onChange(btn.dataset.value);
    };
    buttons.forEach((b) => {
      b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1;
      b.addEventListener('click', () => select(b));
      b.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        select(buttons[(buttons.indexOf(b) + step + buttons.length) % buttons.length], true);
      });
    });
  }

  // ---------- KPI tiles ----------
  function kpiValues(s) {
    const last12 = allMonths.slice(-12);
    const prior12 = allMonths.slice(-24, -12);
    const countIn = (months) => s.cases.filter((c) => months.includes(monthKey(c.opened))).length;
    const recent = countIn(last12);
    const before = countIn(prior12);

    const openAt = s.months.map((k) => {
      const end = toTime(`${addMonths(k, 1)}-01`) - DAY;
      return s.cases.filter((c) => {
        if (toTime(c.opened) > end) return false;
        if (c.resolved) return toTime(c.resolved) > end;
        return HB.isOpen(c);
      }).length;
    });

    // Median days to resolve over a rolling three months, so the trend line is not dominated by single cases.
    const rollingDays = s.months.map((k, i) => {
      const window = s.months.slice(Math.max(0, i - 2), i + 1);
      const days = s.resolved.filter((c) => window.includes(monthKey(c.resolved))).map((c) => c.days);
      return days.length ? quantile(days, 0.5) : null;
    });
    const monthlyFees = s.months.map((k) => sum(s.resolved.filter((c) => monthKey(c.resolved) === k), (c) => c.fees));
    const fees = sum(s.resolved, (c) => c.fees);

    return {
      newMatters: s.opened.length,
      perMonth: s.opened.length / s.months.length,
      yoy: before ? (recent - before) / before : null,
      newSpark: monthlyCounts(s.opened, s.months).map((r) => sum(AREAS, (a) => r[a])),
      open: s.open.length,
      litigating: s.open.filter((c) => c.status === 'In Litigation').length,
      openSpark: openAt,
      medianDays: quantile(s.resolved.map((c) => c.days), 0.5),
      resolvedCount: s.resolved.length,
      daysSpark: rollingDays,
      fees,
      feeAvg: s.resolved.length ? fees / s.resolved.length : 0,
      feesSpark: monthlyFees,
    };
  }

  function setSub(id, parts) {
    const el = document.getElementById(id);
    el.replaceChildren(
      ...parts.map((p) => {
        if (typeof p === 'string') return document.createTextNode(p);
        const span = document.createElement('span');
        span.className = `delta ${p.dir}`;
        span.textContent = p.text;
        return span;
      })
    );
  }

  function countUp(el, to, fmt) {
    const from = el.hbValue || 0;
    el.hbValue = to;
    if (el.hbTimer) el.hbTimer.stop();
    if (reduceMotion || typeof d3 === 'undefined') {
      el.textContent = fmt(to);
      return;
    }
    const interp = d3.interpolateNumber(from, to);
    el.hbTimer = d3.timer((elapsed) => {
      const k = Math.min(1, elapsed / 700);
      el.textContent = fmt(interp(d3.easeCubicOut(k)));
      if (k === 1) el.hbTimer.stop();
    });
  }

  function updateKpis(s) {
    const k = kpiValues(s);
    const whole = (v) => number.format(Math.round(v));
    countUp(document.getElementById('kpiNew'), k.newMatters, whole);
    const subNew = [`${k.perMonth.toFixed(1)} a month`];
    if (k.yoy !== null) {
      const up = k.yoy >= 0;
      subNew.push(' · ', { dir: up ? 'up' : 'down', text: `${up ? '▲' : '▼'} ${Math.abs(Math.round(k.yoy * 100))}%` }, ' last 12 months vs. prior year');
    }
    setSub('kpiNewSub', subNew);

    countUp(document.getElementById('kpiOpen'), k.open, whole);
    setSub('kpiOpenSub', [`${k.litigating} in litigation`]);

    const days = document.getElementById('kpiDays');
    if (k.medianDays === null) {
      days.textContent = '—';
      days.hbValue = 0;
    } else {
      countUp(days, k.medianDays, whole);
    }
    setSub('kpiDaysSub', [`Across ${number.format(k.resolvedCount)} resolved matters`]);

    countUp(document.getElementById('kpiFees'), k.fees, (v) => compactMoney.format(v));
    setSub('kpiFeesSub', [k.resolvedCount ? `${HB.money.format(k.feeAvg)} average per resolved matter` : 'No resolved matters']);

    if (typeof d3 !== 'undefined') {
      sparkline('sparkNew', k.newSpark);
      sparkline('sparkOpen', k.openSpark);
      sparkline('sparkDays', k.daysSpark);
      sparkline('sparkFees', k.feesSpark);
    }

    const who = state.attorney ? HB.attorneyName(state.attorney) : 'all attorneys';
    document.getElementById('scopeNote').textContent = `${number.format(k.newMatters)} matters opened ${monthLabel(s.months[0])} – ${monthLabel(s.months[s.months.length - 1])}, ${who}`;
  }

  // ---------- Fallback if D3 could not load ----------
  if (typeof d3 === 'undefined') {
    document.querySelectorAll('.chart-box').forEach((box) => {
      box.innerHTML = '<p class="empty-state">The chart library could not load. The data table below shows the same numbers.</p>';
      box.style.height = 'auto';
    });
    document.querySelectorAll('.chart-card details').forEach((d) => {
      d.open = true;
    });
    document.querySelectorAll('.spark, .legend-chips, #filingsView').forEach((el) => {
      el.hidden = true;
    });
    const refresh = () => {
      const s = slice();
      updateKpis(s);
      updateFirmTables(s);
    };
    filter.addEventListener('change', () => {
      state.attorney = filter.value;
      refresh();
    });
    setupSeg('rangeFilter', (v) => {
      state.range = Number(v);
      refresh();
    });
    refresh();
    return;
  }

  // ---------- Shared chart pieces ----------
  const ms = (t) => (reduceMotion ? 0 : t);

  function frame(el, m) {
    const width = el.clientWidth;
    const height = el.clientHeight;
    d3.select(el).selectAll('.viz-empty').remove();
    const svg = d3
      .select(el)
      .selectAll('svg')
      .data([null])
      .join('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('aria-hidden', 'true');
    const g = svg
      .selectAll('g.plot')
      .data([null])
      .join('g')
      .attr('class', 'plot')
      .attr('transform', `translate(${m.left},${m.top})`);
    return { el, svg, g, m, width, height, iw: Math.max(10, width - m.left - m.right), ih: Math.max(10, height - m.top - m.bottom) };
  }

  function empty(el, message) {
    d3.select(el).selectAll('svg').remove();
    d3.select(el).selectAll('.viz-empty').data([null]).join('div').attr('class', 'viz-empty').text(message);
  }

  function yAxis(g, y, iw, tr, fmt, ticks = 5) {
    g.selectAll('g.viz-grid')
      .data([null])
      .join('g')
      .attr('class', 'viz-grid')
      .transition(tr)
      .call(d3.axisLeft(y).ticks(ticks).tickSize(-iw).tickFormat(''));
    g.selectAll('g.viz-axis.y')
      .data([null])
      .join('g')
      .attr('class', 'viz-axis y')
      .transition(tr)
      .call(d3.axisLeft(y).ticks(ticks).tickSize(0).tickPadding(8).tickFormat(fmt));
  }

  function xAxis(g, axis, ih) {
    g.selectAll('g.viz-axis.x')
      .data([null])
      .join('g')
      .attr('class', 'viz-axis x')
      .attr('transform', `translate(0,${ih})`)
      .call(axis.tickSizeOuter(0).tickSize(0).tickPadding(10));
  }

  // A bar with a 4px rounded data end; the baseline end stays square.
  function hBar(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w, h / 2));
    return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(w - r)}Z`;
  }

  function vBar(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, h, w / 2));
    return `M${x},${y + h}v${-(h - r)}a${r},${r} 0 0 1 ${r},${-r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}Z`;
  }

  // Draws a path from start to end, like a pen stroke.
  function drawOn(selection, delay = 0, duration = 900) {
    if (reduceMotion) return;
    selection.each(function draw() {
      const len = this.getTotalLength();
      d3.select(this)
        .attr('stroke-dasharray', `${len} ${len}`)
        .attr('stroke-dashoffset', len)
        .transition()
        .delay(delay)
        .duration(duration)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0)
        .on('end', function clear() {
          d3.select(this).attr('stroke-dasharray', null);
        });
    });
  }

  function legend(containerId, items, shape = 'box') {
    const box = document.getElementById(containerId);
    box.replaceChildren(
      ...items.map((it) => {
        const span = document.createElement('span');
        const key = document.createElement('i');
        if (shape === 'line') key.className = 'line';
        key.style.background = it.color;
        span.append(key, document.createTextNode(it.label));
        return span;
      })
    );
  }

  // ---------- Tooltip (one for the page; values lead, labels follow) ----------
  const tip = document.createElement('div');
  tip.className = 'viz-tip';
  tip.setAttribute('aria-hidden', 'true');
  document.body.append(tip);

  function showTip(x, y, title, rows, foot) {
    const head = document.createElement('p');
    head.className = 'tip-title';
    head.textContent = title;
    const parts = [head];
    rows.forEach((r) => {
      const row = document.createElement('div');
      row.className = 'tip-row';
      if (r.color) {
        const key = document.createElement('i');
        key.style.background = r.color;
        row.append(key);
      }
      const b = document.createElement('b');
      b.textContent = r.value;
      const label = document.createElement('span');
      label.textContent = r.label;
      row.append(b, label);
      parts.push(row);
    });
    if (foot) {
      const f = document.createElement('p');
      f.className = 'tip-foot';
      f.textContent = foot;
      parts.push(f);
    }
    tip.replaceChildren(...parts);
    tip.classList.add('show');
    const pad = 14;
    const rect = tip.getBoundingClientRect();
    let left = x + pad;
    if (left + rect.width > window.innerWidth - 8) left = x - rect.width - pad;
    let top = y + pad;
    if (top + rect.height > window.innerHeight - 8) top = y - rect.height - pad;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  }

  function hideTip() {
    tip.classList.remove('show');
  }

  window.addEventListener('scroll', hideTip, { passive: true });

  function sparkline(id, values) {
    const el = document.getElementById(id);
    const w = el.clientWidth || 200;
    const h = 34;
    const svg = d3.select(el).attr('viewBox', `0 0 ${w} ${h}`);
    const defined = values.filter((v) => v !== null);
    if (!defined.length) {
      svg.selectAll('*').remove();
      return;
    }
    const [lo, hi] = d3.extent(defined);
    const x = d3.scaleLinear([0, values.length - 1], [2, w - 5]);
    const y = d3.scaleLinear(lo === hi ? [lo - 1, hi + 1] : [lo, hi], [h - 4, 4]);
    const line = d3.line().defined((v) => v !== null).x((_, i) => x(i)).y((v) => y(v)).curve(d3.curveMonotoneX);
    const area = d3.area().defined((v) => v !== null).x((_, i) => x(i)).y0(h).y1((v) => y(v)).curve(d3.curveMonotoneX);
    svg.selectAll('path.a').data([values]).join('path').attr('class', 'a').attr('fill', NAVY).attr('fill-opacity', 0.07).attr('d', area);
    const path = svg
      .selectAll('path.l')
      .data([values])
      .join('path')
      .attr('class', 'l')
      .attr('fill', 'none')
      .attr('stroke', NAVY)
      .attr('stroke-opacity', 0.55)
      .attr('stroke-width', 1.5)
      .attr('d', line);
    drawOn(path, 0, 800);
    let lastI = values.length - 1;
    while (lastI > 0 && values[lastI] === null) lastI -= 1;
    svg
      .selectAll('circle')
      .data([lastI])
      .join('circle')
      .attr('r', 3.5)
      .attr('fill', GOLD)
      .attr('stroke', SURFACE)
      .attr('stroke-width', 2)
      .attr('cx', (i) => x(i))
      .attr('cy', (i) => y(values[i]));
  }

  // ---------- Chart 1: new matters per month (stacked area with crosshair) ----------
  const intake = { hidden: new Set(), ctx: null, monthsKey: '', index: null };

  function drawIntake(animate) {
    const el = document.getElementById('intakeChart');
    const s = slice();
    const rows = monthlyCounts(s.opened, s.months);
    const f = frame(el, { top: 14, right: 18, bottom: 28, left: 40 });
    const { svg, g, iw, ih } = f;
    const visible = (a) => !intake.hidden.has(a);
    const series = d3.stack().keys(AREAS).value((d, k) => (visible(k) ? d[k] : 0))(rows);
    const maxTotal = d3.max(rows, (r) => sum(AREAS.filter(visible), (a) => r[a])) || 1;
    const x = d3.scalePoint(s.months, [0, iw]);
    const y = d3.scaleLinear([0, maxTotal], [ih, 0]).nice(5);
    const tr = svg.transition().duration(animate ? ms(700) : 0).ease(d3.easeCubicInOut);

    yAxis(g, y, iw, tr, d3.format('d'));
    const step = s.months.length > 24 ? 6 : 3;
    xAxis(g, d3.axisBottom(x).tickValues(s.months.filter((_, i) => (s.months.length - 1 - i) % step === 0)).tickFormat((k) => monthLabel(k)), ih);

    const reshape = intake.monthsKey !== s.months.join();
    intake.monthsKey = s.months.join();

    const clip = svg.selectAll('defs').data([null]).join('defs').selectAll('clipPath').data([null]).join('clipPath').attr('id', 'intakeClip');
    const clipRect = clip.selectAll('rect').data([null]).join('rect').attr('x', -4).attr('y', -12).attr('height', ih + 24);
    if (reshape && animate && !reduceMotion) {
      clipRect.attr('width', 0).transition().duration(1100).ease(d3.easeCubicInOut).attr('width', iw + 8);
    } else {
      clipRect.attr('width', iw + 8);
    }

    const area = d3
      .area()
      .x((_, i) => x(s.months[i]))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveMonotoneX);
    const layers = g.selectAll('g.layers').data([null]).join('g').attr('class', 'layers').attr('clip-path', 'url(#intakeClip)');
    const paths = layers
      .selectAll('path')
      .data(series, (d) => d.key)
      .join('path')
      .attr('fill', (d) => areaColor(d.key))
      .attr('fill-opacity', 0.9)
      .attr('stroke', SURFACE)
      .attr('stroke-width', 1.5)
      .attr('stroke-linejoin', 'round');
    if (reshape) paths.attr('d', area);
    else paths.transition(tr).attr('d', area);

    const focus = g.selectAll('g.focus').data([null]).join('g').attr('class', 'focus').attr('pointer-events', 'none').style('display', 'none');
    focus.selectAll('line').data([null]).join('line').attr('y1', 0).attr('y2', ih).attr('stroke', INK).attr('stroke-opacity', 0.5);

    intake.ctx = { f, x, y, rows, series, months: s.months, visible };
    const stepPx = iw / Math.max(1, s.months.length - 1);
    g.selectAll('rect.overlay')
      .data([null])
      .join('rect')
      .attr('class', 'overlay')
      .attr('width', iw)
      .attr('height', ih)
      .attr('fill', 'transparent')
      .on('pointermove', (e) => {
        const [px] = d3.pointer(e, g.node());
        showIntakeAt(Math.round(px / stepPx), e.clientX, e.clientY);
      })
      .on('pointerleave', hideIntake);
  }

  function showIntakeAt(i, clientX, clientY) {
    const c = intake.ctx;
    if (!c) return;
    const idx = Math.max(0, Math.min(c.months.length - 1, i));
    intake.index = idx;
    const key = c.months[idx];
    const px = c.x(key);
    const focus = c.f.g.select('g.focus').style('display', null);
    focus.select('line').attr('x1', px).attr('x2', px);
    const tops = c.series.filter((sr) => c.visible(sr.key));
    focus
      .selectAll('circle')
      .data(tops, (d) => d.key)
      .join('circle')
      .attr('r', 4)
      .attr('cx', px)
      .attr('cy', (d) => c.y(d[idx][1]))
      .attr('fill', (d) => areaColor(d.key))
      .attr('stroke', SURFACE)
      .attr('stroke-width', 2);
    const row = c.rows[idx];
    const shown = AREAS.filter(c.visible);
    const total = sum(shown, (a) => row[a]);
    let cx = clientX;
    let cy = clientY;
    if (cx === undefined) {
      const r = c.f.el.getBoundingClientRect();
      cx = r.left + c.f.m.left + px;
      cy = r.top + c.f.m.top + c.y(total);
    }
    showTip(
      cx,
      cy,
      monthLabel(key, true),
      shown
        .slice()
        .reverse()
        .map((a) => ({ value: number.format(row[a]), label: a, color: areaColor(a) })),
      `${number.format(total)} new matters`
    );
  }

  function hideIntake() {
    intake.index = null;
    if (intake.ctx) intake.ctx.f.g.select('g.focus').style('display', 'none');
    hideTip();
  }

  (() => {
    const el = document.getElementById('intakeChart');
    el.addEventListener('keydown', (e) => {
      if (!intake.ctx) return;
      const n = intake.ctx.months.length;
      const moves = { ArrowRight: 1, ArrowLeft: -1 };
      let next;
      if (e.key in moves) next = (intake.index === null ? n - 1 : intake.index + moves[e.key]);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      else if (e.key === 'Escape') return hideIntake();
      else return;
      e.preventDefault();
      showIntakeAt(next);
    });
    el.addEventListener('blur', hideIntake);

    const box = document.getElementById('intakeLegend');
    AREAS.forEach((a) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', 'true');
      const key = document.createElement('i');
      key.style.background = areaColor(a);
      btn.append(key, document.createTextNode(a));
      btn.addEventListener('click', () => {
        const hiding = !intake.hidden.has(a);
        if (hiding && intake.hidden.size === AREAS.length - 1) return; // keep at least one area visible
        if (hiding) intake.hidden.add(a);
        else intake.hidden.delete(a);
        btn.setAttribute('aria-pressed', String(!hiding));
        drawIntake(true);
      });
      box.append(btn);
    });
  })();

  // ---------- Chart 2: referral source → practice area → outcome (Sankey) ----------
  function drawFlow(animate) {
    const el = document.getElementById('flowChart');
    const s = slice();
    if (typeof d3.sankey !== 'function') return empty(el, 'This diagram could not load. The data table below shows the same numbers.');
    if (!s.opened.length) return empty(el, 'No matters were opened in this period.');
    const data = flowData(s.opened);
    const f = frame(el, { top: 0, right: 0, bottom: 0, left: 0 });
    const { g, width, height } = f;
    g.selectAll('*').remove();

    const graph = d3
      .sankey()
      .nodeId((d) => d.name)
      .nodeAlign(d3.sankeyJustify)
      .nodeWidth(12)
      .nodePadding(14)
      .nodeSort(null)
      .linkSort(null)
      .extent([
        [150, 8],
        [width - 190, height - 8],
      ])({ nodes: data.nodes.map((d) => ({ ...d })), links: data.links.map((d) => ({ ...d })) });

    const total = s.opened.length;
    const linkColor = (l) => areaColor(l.source.col === 1 ? l.source.name : l.target.name);
    const links = g
      .append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('stroke', linkColor)
      .attr('stroke-opacity', 0.38)
      .attr('stroke-width', (d) => Math.max(1, d.width));
    if (animate) {
      drawOn(links.filter((l) => l.source.col === 0), 0, 750);
      drawOn(links.filter((l) => l.source.col === 1), 450, 750);
    }

    const nodes = g
      .append('g')
      .selectAll('rect')
      .data(graph.nodes)
      .join('rect')
      .attr('x', (d) => d.x0)
      .attr('width', (d) => d.x1 - d.x0)
      .attr('fill', (d) => (d.col === 1 ? areaColor(d.name) : '#4f5868'));
    if (animate && !reduceMotion) {
      nodes
        .attr('y', (d) => (d.y0 + d.y1) / 2)
        .attr('height', 0)
        .transition()
        .delay((d) => d.col * 350)
        .duration(500)
        .ease(d3.easeCubicOut)
        .attr('y', (d) => d.y0)
        .attr('height', (d) => Math.max(1, d.y1 - d.y0));
    } else {
      nodes.attr('y', (d) => d.y0).attr('height', (d) => Math.max(1, d.y1 - d.y0));
    }

    const labels = g
      .append('g')
      .attr('pointer-events', 'none')
      .selectAll('text')
      .data(graph.nodes)
      .join('text')
      .attr('class', 'viz-label viz-halo')
      .attr('x', (d) => (d.col === 0 ? d.x0 - 8 : d.x1 + 8))
      .attr('y', (d) => (d.y0 + d.y1) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => (d.col === 0 ? 'end' : 'start'));
    labels.append('tspan').text((d) => (d.col === 1 ? AREA_SHORT[d.name] : d.name));
    labels
      .append('tspan')
      .attr('dx', 6)
      .attr('font-weight', 600)
      .text((d) => number.format(d.value));

    const highlight = (pred) => links.attr('stroke-opacity', (l) => (pred(l) ? 0.72 : 0.07));
    const reset = () => {
      links.attr('stroke-opacity', 0.38);
      hideTip();
    };
    links
      .on('pointerenter', (e, l) => highlight((x) => x === l))
      .on('pointermove', (e, l) =>
        showTip(e.clientX, e.clientY, `${l.source.name} → ${l.target.name}`, [{ value: number.format(l.value), label: 'matters', color: linkColor(l) }], `${pct(l.value / l.source.value)} of ${l.source.name}`)
      )
      .on('pointerleave', reset);
    nodes
      .style('cursor', 'default')
      .on('pointerenter', (e, d) => highlight((l) => l.source === d || l.target === d))
      .on('pointermove', (e, d) => showTip(e.clientX, e.clientY, d.name, [{ value: number.format(d.value), label: 'matters' }], `${pct(d.value / total)} of all matters in this period`))
      .on('pointerleave', reset);
  }

  // ---------- Chart 3: time to resolution (beeswarm) ----------
  const swarmCache = new Map();

  function drawSwarm(animate) {
    const el = document.getElementById('swarmChart');
    const s = slice();
    if (!s.resolved.length) return empty(el, 'No matters were resolved in this period.');
    const f = frame(el, { top: 8, right: 16, bottom: 30, left: 112 });
    const { g, iw, ih } = f;
    g.selectAll('*').remove();

    const band = d3.scaleBand(AREAS, [0, ih]).paddingInner(0.06);
    const x = d3.scaleLog([7, 1500], [0, iw]).clamp(true);
    const feeCap = quantile(s.resolved.map((c) => c.fees), 0.98) || 1;
    const r = d3.scaleSqrt([0, feeCap], [2.2, 8]).clamp(true);

    // Laying out ~1,000 dots takes a moment, so each layout is computed once and reused.
    const key = `${state.attorney}|${state.range}|${Math.round(iw)}|${Math.round(ih)}`;
    let nodes = swarmCache.get(key);
    if (!nodes) {
      nodes = s.resolved.map((d, i) => {
        const ty = band(d.area) + band.bandwidth() / 2;
        return { d, r: r(d.fees), tx: x(d.days), ty, x: x(d.days), y: ty + ((i * 7919) % 13) - 6 };
      });
      const sim = d3
        .forceSimulation(nodes)
        .force('x', d3.forceX((n) => n.tx).strength(0.9))
        .force('y', d3.forceY((n) => n.ty).strength(0.1))
        .force('collide', d3.forceCollide((n) => n.r + 0.6).iterations(2))
        .stop();
      for (let i = 0; i < 120; i += 1) sim.tick();
      nodes.forEach((n) => {
        const top = band(n.d.area);
        n.y = Math.max(top + n.r, Math.min(top + band.bandwidth() - n.r, n.y));
      });
      swarmCache.set(key, nodes);
    }

    const ticks = [
      [7, '1 wk'],
      [30, '1 mo'],
      [90, '3 mo'],
      [180, '6 mo'],
      [365, '1 yr'],
      [730, '2 yr'],
      [1095, '3 yr'],
    ];
    g.append('g')
      .attr('class', 'viz-grid')
      .selectAll('line')
      .data(ticks)
      .join('line')
      .attr('x1', (t) => x(t[0]))
      .attr('x2', (t) => x(t[0]))
      .attr('y1', 0)
      .attr('y2', ih);
    xAxis(g, d3.axisBottom(x).tickValues(ticks.map((t) => t[0])).tickFormat((v) => ticks.find((t) => t[0] === v)[1]), ih);

    g.append('g')
      .selectAll('line')
      .data(AREAS.slice(1))
      .join('line')
      .attr('x1', -f.m.left + 8)
      .attr('x2', iw)
      .attr('y1', (a) => band(a) - (band.step() - band.bandwidth()) / 2)
      .attr('y2', (a) => band(a) - (band.step() - band.bandwidth()) / 2)
      .attr('stroke', '#e6eaf0');

    const rowLabels = g
      .append('g')
      .selectAll('text')
      .data(AREAS)
      .join('text')
      .attr('class', 'viz-label')
      .attr('x', -14)
      .attr('y', (a) => band(a) + band.bandwidth() / 2)
      .attr('text-anchor', 'end');
    rowLabels.append('tspan').attr('class', 'strong').attr('font-weight', 600).attr('dy', '-0.2em').text((a) => AREA_SHORT[a]);
    rowLabels
      .append('tspan')
      .attr('x', -14)
      .attr('dy', '1.25em')
      .attr('fill', '#4f5868')
      .attr('font-size', 11)
      .text((a) => `${number.format(nodes.filter((n) => n.d.area === a).length)} resolved`);

    const dots = g
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('fill', (n) => areaColor(n.d.area))
      .attr('fill-opacity', 0.82)
      .attr('stroke', SURFACE)
      .attr('stroke-width', 0.75)
      .attr('cx', (n) => n.x);
    if (animate && !reduceMotion) {
      dots
        .attr('cy', (n) => n.ty)
        .attr('r', 0)
        .transition()
        .delay((n) => (n.x / iw) * 700)
        .duration(550)
        .ease(d3.easeCubicOut)
        .attr('cy', (n) => n.y)
        .attr('r', (n) => n.r);
    } else {
      dots.attr('cy', (n) => n.y).attr('r', (n) => n.r);
    }

    const medians = AREAS.map((a) => ({ a, m: quantile(nodes.filter((n) => n.d.area === a).map((n) => n.d.days), 0.5) })).filter((d) => d.m !== null);
    const medG = g.append('g').attr('pointer-events', 'none');
    // A white casing keeps the tick visible over dark dots.
    [
      [SURFACE, 5],
      [INK, 2],
    ].forEach(([stroke, width]) => {
      medG
        .append('g')
        .selectAll('line')
        .data(medians)
        .join('line')
        .attr('x1', (d) => x(d.m))
        .attr('x2', (d) => x(d.m))
        .attr('y1', (d) => band(d.a) + 3)
        .attr('y2', (d) => band(d.a) + band.bandwidth() - 3)
        .attr('stroke', stroke)
        .attr('stroke-width', width)
        .attr('stroke-linecap', 'round');
    });
    medG
      .selectAll('text')
      .data(medians)
      .join('text')
      .attr('class', 'viz-label viz-halo')
      .attr('font-size', 11)
      .attr('x', (d) => x(d.m) + 6)
      .attr('y', (d) => band(d.a) + 11)
      .text((d) => `median ${number.format(Math.round(d.m))} days`);
    if (animate && !reduceMotion) medG.attr('opacity', 0).transition().delay(900).duration(400).attr('opacity', 1);

    const ring = g.append('circle').attr('fill', 'none').attr('stroke', INK).attr('stroke-width', 2).attr('pointer-events', 'none').style('display', 'none');
    const delaunay = d3.Delaunay.from(nodes, (n) => n.x, (n) => n.y);
    g.append('rect')
      .attr('width', iw)
      .attr('height', ih)
      .attr('fill', 'transparent')
      .on('pointermove', (e) => {
        const [px, py] = d3.pointer(e, g.node());
        const n = nodes[delaunay.find(px, py)];
        if (!n || Math.hypot(n.x - px, n.y - py) > 24) {
          ring.style('display', 'none');
          return hideTip();
        }
        ring.style('display', null).attr('cx', n.x).attr('cy', n.y).attr('r', n.r + 3);
        const c = n.d;
        showTip(
          e.clientX,
          e.clientY,
          `${c.id} · ${c.area}`,
          [
            { value: `${number.format(c.days)} days`, label: 'to resolve', color: areaColor(c.area) },
            { value: HB.money.format(c.fees), label: 'fees earned' },
            { value: c.outcome, label: '' },
          ],
          `${HB.formatDate(c.opened)} – ${HB.formatDate(c.resolved)} · ${HB.attorneyName(c.attorney)}`
        );
      })
      .on('pointerleave', () => {
        ring.style('display', 'none');
        hideTip();
      });
  }

  // ---------- Chart 4: seasonality (heatmap, one navy ramp: the darker the cell, the busier the month) ----------
  const seasonColor = d3
    .scaleSequential()
    .domain([75, 125])
    .interpolator(d3.piecewise(d3.interpolateRgb, ['#eef2f8', '#c3d0e3', '#7f9cc7', '#3f5f91', '#1b2f55']))
    .clamp(true);

  function drawSeason(animate) {
    const el = document.getElementById('seasonChart');
    const s = slice();
    if (!s.opened.length) return empty(el, 'No matters were opened in this period.');
    const data = seasonData(s);
    const f = frame(el, { top: 20, right: 4, bottom: 46, left: 78 });
    const { svg, g, iw, ih } = f;
    g.selectAll('*').remove();
    const xb = d3.scaleBand(d3.range(12), [0, iw]);
    const yb = d3.scaleBand(AREAS, [0, ih]);

    g.append('g')
      .selectAll('text')
      .data(d3.range(12))
      .join('text')
      .attr('class', 'viz-label muted')
      .attr('font-size', 11)
      .attr('x', (m) => xb(m) + xb.bandwidth() / 2)
      .attr('y', -7)
      .attr('text-anchor', 'middle')
      .text((m) => (iw / 12 > 30 ? MONTH_NAMES[m].slice(0, 3) : MONTH_NAMES[m][0]));
    g.append('g')
      .selectAll('text')
      .data(AREAS)
      .join('text')
      .attr('class', 'viz-label')
      .attr('x', -8)
      .attr('y', (a) => yb(a) + yb.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text((a) => AREA_SHORT[a]);

    const cells = g
      .append('g')
      .selectAll('rect')
      .data(data.flatMap((row) => row.cells))
      .join('rect')
      .attr('x', (d) => xb(d.month) + 1)
      .attr('y', (d) => yb(d.area) + 1)
      .attr('width', xb.bandwidth() - 2)
      .attr('height', yb.bandwidth() - 2)
      .attr('rx', 2)
      .attr('fill', (d) => (d.index === null ? '#f4f5f7' : seasonColor(d.index)));
    if (animate && !reduceMotion) {
      cells
        .attr('opacity', 0)
        .transition()
        .delay((d) => d.month * 35 + AREAS.indexOf(d.area) * 25)
        .duration(350)
        .attr('opacity', 1);
    }
    cells
      .on('pointerenter', function lift() {
        d3.select(this).attr('stroke', INK).attr('stroke-width', 1.5);
      })
      .on('pointermove', (e, d) =>
        showTip(
          e.clientX,
          e.clientY,
          `${d.area} · ${MONTH_NAMES[d.month]}`,
          d.index === null
            ? [{ value: '—', label: 'not in this period' }]
            : [
                { value: String(d.index), label: 'index (100 = average month)' },
                { value: d.avg.toFixed(1), label: 'new matters in an average ' + MONTH_NAMES[d.month] },
              ]
        )
      )
      .on('pointerleave', function drop() {
        d3.select(this).attr('stroke', null);
        hideTip();
      });

    // Scale legend
    const defs = svg.selectAll('defs').data([null]).join('defs');
    const grad = defs.selectAll('linearGradient').data([null]).join('linearGradient').attr('id', 'seasonGrad');
    grad
      .selectAll('stop')
      .data(d3.range(0, 1.0001, 0.125))
      .join('stop')
      .attr('offset', (t) => `${t * 100}%`)
      .attr('stop-color', (t) => seasonColor(75 + t * 50));
    const lw = Math.min(220, iw);
    const lg = g.append('g').attr('transform', `translate(${(iw - lw) / 2},${ih + 16})`);
    lg.append('rect').attr('width', lw).attr('height', 8).attr('rx', 2).attr('fill', 'url(#seasonGrad)');
    [
      [0, 'Quieter', 'start'],
      [0.5, 'Average', 'middle'],
      [1, 'Busier', 'end'],
    ].forEach(([t, text, anchor]) => {
      lg.append('text').attr('class', 'viz-label muted').attr('font-size', 11).attr('x', t * lw).attr('y', 24).attr('text-anchor', anchor).text(text);
    });
  }

  // ---------- Chart 5: open caseload by attorney (stacked bars by stage) ----------
  legend('workloadLegend', STAGES.map((st, i) => ({ label: st, color: STAGE_COLORS[i] })));

  function drawWorkload(animate) {
    const el = document.getElementById('workloadChart');
    const data = workloadData();
    const f = frame(el, { top: 4, right: 40, bottom: 24, left: 128 });
    const { svg, g, iw, ih } = f;
    const y = d3.scaleBand(data.map((d) => d.id), [0, ih]).padding(0.3);
    const x = d3.scaleLinear([0, d3.max(data, (d) => d.total) || 1], [0, iw]).nice(4);
    const tr = svg.transition().duration(animate ? ms(650) : 0).ease(d3.easeCubicOut);
    const barH = Math.min(24, y.bandwidth());
    const yTop = (id) => y(id) + (y.bandwidth() - barH) / 2;

    g.selectAll('g.viz-grid')
      .data([null])
      .join('g')
      .attr('class', 'viz-grid')
      .attr('transform', `translate(0,${ih})`)
      .transition(tr)
      .call(d3.axisBottom(x).ticks(4).tickSize(-ih).tickFormat(''));
    g.selectAll('g.viz-axis.x')
      .data([null])
      .join('g')
      .attr('class', 'viz-axis x')
      .attr('transform', `translate(0,${ih})`)
      .transition(tr)
      .call(d3.axisBottom(x).ticks(4).tickSize(0).tickPadding(8).tickSizeOuter(0));

    g.selectAll('text.name')
      .data(data, (d) => d.id)
      .join('text')
      .attr('class', 'name viz-label')
      .attr('x', -10)
      .attr('y', (d) => y(d.id) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-weight', (d) => (d.id === state.attorney ? 600 : 400))
      .text((d) => d.name);

    const segs = data.flatMap((d) => {
      let x0 = 0;
      const last = [...STAGES].reverse().find((st) => d[st] > 0);
      return STAGES.map((st, i) => {
        const seg = { key: `${d.id}-${st}`, row: d, stage: st, color: STAGE_COLORS[i], x0, x1: x0 + d[st], isLast: st === last };
        x0 += d[st];
        return seg;
      });
    });
    const dim = (seg) => (state.attorney && seg.row.id !== state.attorney ? 0.3 : 1);
    const path = (seg) => hBar(x(seg.x0), yTop(seg.row.id), Math.max(0, x(seg.x1) - x(seg.x0) - (seg.isLast ? 0 : 2)), barH, seg.isLast ? 4 : 0);
    g.selectAll('path.seg')
      .data(segs, (d) => d.key)
      .join((enter) => enter.append('path').attr('class', 'seg').attr('d', (seg) => hBar(0, yTop(seg.row.id), 0, barH, 0)))
      .attr('fill', (seg) => seg.color)
      .on('pointerenter', function lift() {
        d3.select(this).attr('fill-opacity', 0.8);
      })
      .on('pointermove', (e, seg) =>
        showTip(e.clientX, e.clientY, seg.row.name, [{ value: number.format(seg.row[seg.stage]), label: seg.stage, color: seg.color }], `${number.format(seg.row.total)} open cases`)
      )
      .on('pointerleave', function drop() {
        d3.select(this).attr('fill-opacity', 1);
        hideTip();
      })
      .transition(tr)
      .delay((seg) => (animate ? data.indexOf(seg.row) * 60 : 0))
      .attr('d', (seg) => path(seg))
      .attr('opacity', dim);

    g.selectAll('text.total')
      .data(data, (d) => d.id)
      .join('text')
      .attr('class', 'total viz-label strong')
      .attr('font-weight', 600)
      .attr('y', (d) => y(d.id) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .transition(tr)
      .attr('x', (d) => x(d.total) + 8)
      .attr('opacity', (d) => (state.attorney && d.id !== state.attorney ? 0.4 : 1))
      .text((d) => d.total);

    document.getElementById('workloadSub').textContent = state.attorney
      ? `Every open case today, by stage. ${HB.attorneyName(state.attorney)} is highlighted.`
      : 'Every open case today, by stage';
  }

  // ---------- Chart 6: fees earned per quarter (stacked columns) ----------
  legend('feesLegend', AREAS.map((a) => ({ label: a, color: areaColor(a) })));

  function drawFees(animate) {
    const el = document.getElementById('feesChart');
    const s = slice();
    const rows = feesData(s);
    const f = frame(el, { top: 22, right: 8, bottom: 28, left: 52 });
    const { svg, g, iw, ih } = f;
    const x = d3.scaleBand(rows.map((r) => r.key), [0, iw]).padding(0.3);
    const y = d3.scaleLinear([0, d3.max(rows, (r) => r.total) || 1], [ih, 0]).nice(5);
    const tr = svg.transition().duration(animate ? ms(700) : 0).ease(d3.easeCubicOut);
    const bw = Math.min(36, x.bandwidth());
    const bx = (key) => x(key) + (x.bandwidth() - bw) / 2;

    yAxis(g, y, iw, tr, (v) => compactMoney.format(v));
    xAxis(g, d3.axisBottom(x).tickFormat(quarterLabel), ih);

    const segs = rows.flatMap((r) => {
      let y0 = 0;
      const last = [...AREAS].reverse().find((a) => r[a] > 0);
      return AREAS.map((a) => {
        const seg = { key: `${r.key}-${a}`, row: r, area: a, y0, y1: y0 + r[a], isLast: a === last };
        y0 += r[a];
        return seg;
      });
    });
    const segPath = (seg) => {
      const h = Math.max(0, y(seg.y0) - y(seg.y1) - (seg.y0 > 0 ? 2 : 0));
      return vBar(bx(seg.row.key), y(seg.y1), bw, h, seg.isLast ? 4 : 0);
    };
    const bars = g.selectAll('g.bars').data([null]).join('g').attr('class', 'bars');
    bars
      .selectAll('path')
      .data(segs, (d) => d.key)
      .join(
        (enter) => enter.append('path').attr('d', (seg) => vBar(bx(seg.row.key), ih, bw, 0, 0)),
        (update) => update,
        (exit) => exit.transition(tr).attr('opacity', 0).remove()
      )
      .attr('fill', (seg) => areaColor(seg.area))
      .attr('pointer-events', 'none')
      .transition(tr)
      .delay((seg) => (animate ? rows.indexOf(seg.row) * 45 : 0))
      .attr('d', segPath)
      .attr('opacity', 1);

    // Label only the busiest quarter and the latest one.
    const maxRow = rows.reduce((m, r) => (r.total > m.total ? r : m), rows[0]);
    const labelled = rows.filter((r) => r === maxRow || r === rows[rows.length - 1]);
    g.selectAll('text.total')
      .data(labelled, (d) => d.key)
      .join('text')
      .attr('class', 'total viz-label strong')
      .attr('font-weight', 600)
      .attr('font-size', 11)
      .attr('text-anchor', 'middle')
      .attr('x', (r) => x(r.key) + x.bandwidth() / 2)
      .text((r) => compactMoney.format(r.total))
      .transition(tr)
      .attr('y', (r) => y(r.total) - 7);

    const hover = g.selectAll('g.hover').data([null]).join('g').attr('class', 'hover');
    hover
      .selectAll('rect')
      .data(rows, (d) => d.key)
      .join('rect')
      .attr('x', (r) => x(r.key) - (x.step() - x.bandwidth()) / 2)
      .attr('width', x.step())
      .attr('y', 0)
      .attr('height', ih)
      .attr('fill', 'transparent')
      .on('pointermove', (e, r) => {
        bars.selectAll('path').attr('opacity', (seg) => (seg.row === r ? 1 : 0.4));
        showTip(
          e.clientX,
          e.clientY,
          `${r.key.slice(5)} ${r.key.slice(0, 4)}`,
          [...AREAS].reverse().filter((a) => r[a] > 0).map((a) => ({ value: compactMoney.format(r[a]), label: a, color: areaColor(a) })),
          `${HB.money.format(r.total)} total`
        );
      })
      .on('pointerleave', () => {
        bars.selectAll('path').attr('opacity', 1);
        hideTip();
      });
  }

  // ---------- Court chart 1: filings by case type (counts or growth index) ----------
  const court = { view: 'count' };

  function drawFilings(animate) {
    const el = document.getElementById('filingsChart');
    const isIndex = court.view === 'index';
    const f = frame(el, { top: 14, right: isIndex ? 150 : 12, bottom: 28, left: 48 });
    const { g, iw, ih } = f;
    g.selectAll('*').remove();
    legend('filingsLegend', COURT_SERIES.map((sr) => ({ label: sr.label, color: sr.color })), isIndex ? 'line' : 'box');
    document.getElementById('filingsSub').textContent = isIndex
      ? 'Filings in each year relative to FY 2015–16 (100 = same as 2015–16)'
      : 'Statewide filings, fiscal years 2015–16 to 2024–25';

    if (!isIndex) {
      const x = d3.scaleBand(fiscalLabels, [0, iw]).padding(0.3);
      const y = d3.scaleLinear([0, d3.max(filings.total)], [ih, 0]).nice(5);
      yAxis(g, y, iw, null, (v) => `${v / 1000}k`);
      xAxis(g, d3.axisBottom(x), ih);
      const bw = Math.min(44, x.bandwidth());
      const bx = (i) => x(fiscalLabels[i]) + (x.bandwidth() - bw) / 2;
      const segs = fiscalLabels.flatMap((_, i) => {
        let y0 = 0;
        return COURT_SERIES.map((sr, j) => {
          const v = filings[sr.key][i];
          const seg = { i, sr, y0, y1: y0 + v, isLast: j === COURT_SERIES.length - 1 };
          y0 += v;
          return seg;
        });
      });
      const segPath = (seg) => vBar(bx(seg.i), y(seg.y1), bw, Math.max(0, y(seg.y0) - y(seg.y1) - (seg.y0 > 0 ? 2 : 0)), seg.isLast ? 4 : 0);
      const bars = g
        .append('g')
        .selectAll('path')
        .data(segs)
        .join('path')
        .attr('fill', (seg) => seg.sr.color)
        .attr('pointer-events', 'none');
      if (animate && !reduceMotion) {
        bars
          .attr('d', (seg) => vBar(bx(seg.i), ih, bw, 0, 0))
          .transition()
          .delay((seg) => seg.i * 60)
          .duration(650)
          .ease(d3.easeCubicOut)
          .attr('d', segPath);
      } else {
        bars.attr('d', segPath);
      }
      g.append('text')
        .attr('class', 'viz-label strong')
        .attr('font-weight', 600)
        .attr('font-size', 11)
        .attr('text-anchor', 'middle')
        .attr('x', bx(9) + bw / 2)
        .attr('y', y(filings.otherCivil[9] + filings.motorVehicle[9] + filings.otherInjury[9]) - 7)
        .text(compactMoney.format(filings.total[9]).replace('$', ''));
      g.append('g')
        .selectAll('rect')
        .data(fiscalLabels)
        .join('rect')
        .attr('x', (fy) => x(fy) - (x.step() - x.bandwidth()) / 2)
        .attr('width', x.step())
        .attr('height', ih)
        .attr('fill', 'transparent')
        .on('pointermove', (e, fy) => {
          const i = fiscalLabels.indexOf(fy);
          bars.attr('opacity', (seg) => (seg.i === i ? 1 : 0.4));
          showTip(
            e.clientX,
            e.clientY,
            `FY ${fy}`,
            [...COURT_SERIES].reverse().map((sr) => ({ value: number.format(filings[sr.key][i]), label: sr.short, color: sr.color })),
            `Total unlimited civil: ${number.format(filings.total[i])}`
          );
        })
        .on('pointerleave', () => {
          bars.attr('opacity', 1);
          hideTip();
        });
      return;
    }

    const series = COURT_SERIES.map((sr) => ({ ...sr, values: filings[sr.key].map((v) => (v / filings[sr.key][0]) * 100) }));
    const x = d3.scalePoint(fiscalLabels, [0, iw]).padding(0.2);
    const y = d3.scaleLinear([d3.min(series, (sr) => d3.min(sr.values)) * 0.9, d3.max(series, (sr) => d3.max(sr.values)) * 1.04], [ih, 0]).nice(5);
    yAxis(g, y, iw, null, (v) => v);
    xAxis(g, d3.axisBottom(x), ih);
    g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', y(100)).attr('y2', y(100)).attr('stroke', '#9aa3b2');
    const line = d3
      .line()
      .x((_, i) => x(fiscalLabels[i]))
      .y((v) => y(v))
      .curve(d3.curveMonotoneX);
    const lines = g
      .append('g')
      .selectAll('path')
      .data(series)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', (sr) => sr.color)
      .attr('stroke-width', 2)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('d', (sr) => line(sr.values));
    if (animate) drawOn(lines, 0, 1100);

    // End labels; when two lines finish close together, labels move apart and a leader line keeps them attached.
    const ends = series.map((sr) => ({ sr, y: y(sr.values[9]), ly: y(sr.values[9]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i += 1) ends[i].ly = Math.max(ends[i].ly, ends[i - 1].ly + 16);
    const lastX = x(fiscalLabels[9]);
    const endG = g.append('g');
    endG
      .selectAll('circle')
      .data(ends)
      .join('circle')
      .attr('cx', lastX)
      .attr('cy', (d) => d.y)
      .attr('r', 4)
      .attr('fill', (d) => d.sr.color)
      .attr('stroke', SURFACE)
      .attr('stroke-width', 2);
    endG
      .selectAll('line')
      .data(ends)
      .join('line')
      .attr('x1', lastX + 6)
      .attr('x2', lastX + 14)
      .attr('y1', (d) => d.y)
      .attr('y2', (d) => d.ly)
      .attr('stroke', '#9aa3b2');
    const endText = endG
      .selectAll('text')
      .data(ends)
      .join('text')
      .attr('class', 'viz-label')
      .attr('x', lastX + 18)
      .attr('y', (d) => d.ly)
      .attr('dy', '0.35em');
    endText.append('tspan').attr('font-weight', 600).text((d) => `${(d.sr.values[9] / 100).toFixed(2)}×`);
    endText.append('tspan').attr('dx', 6).attr('fill', '#4f5868').text((d) => d.sr.short);
    if (animate && !reduceMotion) endG.attr('opacity', 0).transition().delay(950).duration(300).attr('opacity', 1);

    crosshair(f, fiscalLabels.map((fy) => x(fy)), (i, e) => {
      const dots = series.map((sr) => ({ y: y(sr.values[i]), color: sr.color }));
      showTip(
        e.clientX,
        e.clientY,
        `FY ${fiscalLabels[i]}`,
        series.map((sr) => ({ value: Math.round(sr.values[i]).toString(), label: `${sr.short} (${number.format(filings[sr.key][i])})`, color: sr.color })),
        'Index: FY 2015–16 = 100'
      );
      return dots;
    });
  }

  // A vertical hairline that snaps to the nearest year, with dots on each line.
  function crosshair(f, xs, onShow) {
    const { g, iw, ih } = f;
    const focus = g.append('g').attr('pointer-events', 'none').style('display', 'none');
    const rule = focus.append('line').attr('y1', 0).attr('y2', ih).attr('stroke', INK).attr('stroke-opacity', 0.45);
    g.append('rect')
      .attr('width', iw)
      .attr('height', ih)
      .attr('fill', 'transparent')
      .on('pointermove', (e) => {
        const [px] = d3.pointer(e, g.node());
        const i = d3.leastIndex(xs, (v) => Math.abs(v - px));
        const dots = onShow(i, e);
        focus.style('display', null);
        rule.attr('x1', xs[i]).attr('x2', xs[i]);
        focus
          .selectAll('circle')
          .data(dots)
          .join('circle')
          .attr('cx', xs[i])
          .attr('cy', (d) => d.y)
          .attr('r', 4)
          .attr('fill', (d) => d.color)
          .attr('stroke', SURFACE)
          .attr('stroke-width', 2);
      })
      .on('pointerleave', () => {
        focus.style('display', 'none');
        hideTip();
      });
  }

  // ---------- Court chart 2: share resolved within 12 and 24 months ----------
  const SPEED_SERIES = [
    { key: 'within24', label: 'Within 24 months', color: NAVY },
    { key: 'within12', label: 'Within 12 months', color: GOLD },
  ];
  legend('speedLegend', SPEED_SERIES.map((sr) => ({ label: sr.label, color: sr.color })), 'line');

  function drawSpeed(animate) {
    const el = document.getElementById('speedChart');
    const f = frame(el, { top: 22, right: 118, bottom: 28, left: 44 });
    const { g, iw, ih } = f;
    g.selectAll('*').remove();
    const x = d3.scalePoint(fiscalLabels, [0, iw]).padding(0.2);
    const y = d3.scaleLinear([50, 100], [ih, 0]);
    yAxis(g, y, iw, null, (v) => `${v}%`);
    xAxis(g, d3.axisBottom(x), ih);

    // Shade the pandemic year, when courts closed or slowed and filings backed up.
    const covidX = x('2020–21');
    const half = x.step() / 2;
    const covid = g.append('g').attr('pointer-events', 'none');
    covid.append('rect').attr('x', covidX - half).attr('width', x.step()).attr('y', 0).attr('height', ih).attr('fill', '#eef1f5');
    covid
      .append('text')
      .attr('class', 'viz-label muted')
      .attr('font-size', 11)
      .attr('x', covidX)
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .text('COVID-19 year');
    g.selectAll('g.viz-grid').raise();
    g.selectAll('g.viz-axis').raise();

    const xi = (_, i) => x(fiscalLabels[i]);
    const band = g
      .append('path')
      .attr('fill', NAVY)
      .attr('fill-opacity', 0.08)
      .attr(
        'd',
        d3
          .area()
          .x(xi)
          .y0((_, i) => y(speed.within12[i]))
          .y1((_, i) => y(speed.within24[i]))
          .curve(d3.curveMonotoneX)(fiscalLabels)
      );
    if (animate && !reduceMotion) band.attr('opacity', 0).transition().delay(600).duration(600).attr('opacity', 1);

    const line = d3.line().x(xi).y((v) => y(v)).curve(d3.curveMonotoneX);
    const lines = g
      .append('g')
      .selectAll('path')
      .data(SPEED_SERIES)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', (sr) => sr.color)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('d', (sr) => line(speed[sr.key]));
    if (animate) drawOn(lines, 0, 1200);

    const lastX = x(fiscalLabels[9]);
    const endG = g.append('g');
    endG
      .selectAll('circle')
      .data(SPEED_SERIES)
      .join('circle')
      .attr('cx', lastX)
      .attr('cy', (sr) => y(speed[sr.key][9]))
      .attr('r', 4)
      .attr('fill', (sr) => sr.color)
      .attr('stroke', SURFACE)
      .attr('stroke-width', 2);
    const endText = endG
      .selectAll('text')
      .data(SPEED_SERIES)
      .join('text')
      .attr('class', 'viz-label')
      .attr('x', lastX + 10)
      .attr('y', (sr) => y(speed[sr.key][9]))
      .attr('dy', '0.35em');
    endText.append('tspan').attr('font-weight', 600).text((sr) => `${speed[sr.key][9]}%`);
    endText.append('tspan').attr('dx', 6).attr('fill', '#4f5868').text((sr) => sr.label.replace('Within ', ''));
    if (animate && !reduceMotion) endG.attr('opacity', 0).transition().delay(1100).duration(300).attr('opacity', 1);

    crosshair(f, fiscalLabels.map((fy) => x(fy)), (i, e) => {
      showTip(
        e.clientX,
        e.clientY,
        `FY ${fiscalLabels[i]}`,
        SPEED_SERIES.map((sr) => ({ value: `${speed[sr.key][i]}%`, label: `resolved ${sr.label.toLowerCase()}`, color: sr.color }))
      );
      return SPEED_SERIES.map((sr) => ({ y: y(speed[sr.key][i]), color: sr.color }));
    });
  }

  // ---------- Lazy drawing: each chart draws the first time it nears the viewport ----------
  const charts = [];

  function register(id, draw, firm) {
    const el = document.getElementById(id);
    charts.push({ el, draw, firm, seen: false, width: 0 });
  }

  register('intakeChart', drawIntake, true);
  register('flowChart', drawFlow, true);
  register('swarmChart', drawSwarm, true);
  register('seasonChart', drawSeason, true);
  register('workloadChart', drawWorkload, true);
  register('feesChart', drawFees, true);
  register('filingsChart', drawFilings, false);
  register('speedChart', drawSpeed, false);

  const byEl = (el) => charts.find((c) => c.el === el);

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const c = byEl(entry.target);
        if (!entry.isIntersecting || c.seen) return;
        c.seen = true;
        c.width = c.el.clientWidth;
        c.draw(true);
        io.unobserve(c.el);
      });
    },
    { rootMargin: '0px 0px -60px 0px' }
  );
  charts.forEach((c) => io.observe(c.el));

  let resizeTimer;
  const sparkEl = document.getElementById('sparkNew');
  let sparkWidth = sparkEl.clientWidth;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      charts.forEach((c) => {
        if (c.seen && c.el.clientWidth !== c.width) {
          c.width = c.el.clientWidth;
          c.draw(false);
        }
      });
      if (sparkEl.clientWidth !== sparkWidth) {
        sparkWidth = sparkEl.clientWidth;
        const k = kpiValues(slice());
        sparkline('sparkNew', k.newSpark);
        sparkline('sparkOpen', k.openSpark);
        sparkline('sparkDays', k.daysSpark);
        sparkline('sparkFees', k.feesSpark);
      }
    }, 150);
  });
  charts.forEach((c) => ro.observe(c.el));
  ro.observe(sparkEl);

  function updateFirm() {
    hideTip();
    const s = slice();
    updateKpis(s);
    updateFirmTables(s);
    charts.forEach((c) => {
      if (c.firm && c.seen) c.draw(true);
    });
  }

  filter.addEventListener('change', () => {
    state.attorney = filter.value;
    updateFirm();
  });
  setupSeg('rangeFilter', (v) => {
    state.range = Number(v);
    updateFirm();
  });
  setupSeg('filingsView', (v) => {
    court.view = v;
    hideTip();
    const c = byEl(document.getElementById('filingsChart'));
    if (c.seen) drawFilings(true);
  });

  updateFirm();
})();
