// Generator for the synthetic case history of Halloway & Brisk LLP.
// Run tools/export-case-history.html to rebuild data/case-history.csv and js/case-history.js from it.
// It uses a fixed seed, so every run produces the same records.
// Volumes, seasonality, durations, outcomes, and fees follow common patterns in small California
// civil practices (notes on each practice area below). None of it is real client data.

const HB_HISTORY = (() => {
  const AS_OF = '2026-10-10';
  const START_YEAR = 2023;
  const START_MONTH = 10; // October 2023
  const MONTHS = 36;
  // Matters opened in the 18 months before the window are generated too, so the window starts with a
  // realistic carried-over caseload instead of an empty firm.
  const WARM_UP = 18;

  // ---------- Seeded random numbers (mulberry32) ----------
  let seed = 20231001;
  function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function pick(weights) {
    const total = weights.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [value, w] of weights) {
      r -= w;
      if (r <= 0) return value;
    }
    return weights[weights.length - 1][0];
  }

  function normal() {
    const u = 1 - rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function logNormal(median, sigma) {
    return median * Math.exp(sigma * normal());
  }

  function poisson(lambda) {
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= rand();
    } while (p > limit);
    return k - 1;
  }

  // ---------- Dates (UTC so time zones never shift a day) ----------
  const DAY = 86400000;
  const toTime = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const toIso = (t) => new Date(t).toISOString().slice(0, 10);
  const asOfTime = toTime(AS_OF);

  // ---------- Practice-area models ----------
  // rate: new matters per month at the start of the archive. growth: yearly change in intake.
  // season: Jan..Dec multipliers. tracks: kinds of matter in the area, each with its own
  // duration (median days, spread), fees (median dollars, spread), and outcome mix.
  const models = {
    // Formations and contracts cluster in January and before year end; disputes take 6-9 months.
    'Business Law': {
      rate: 5,
      growth: 0.06,
      season: [1.3, 1.1, 1.05, 1, 1, 0.95, 0.85, 0.85, 1, 1.05, 1, 0.85],
      lawyers: [['MH', 0.75], ['KL', 0.25]],
      sources: [['Returning client', 0.35], ['Professional referral', 0.3], ['Client referral', 0.2], ['Online search', 0.15]],
      tracks: [
        { share: 0.6, litigated: false, days: [75, 0.6], fee: [7000, 0.6], outcomes: [['Completed', 1]] },
        { share: 0.4, litigated: true, days: [220, 0.55], fee: [28000, 0.6], outcomes: [['Settled', 0.8], ['Trial verdict', 0.04], ['Dismissed or withdrawn', 0.16]] },
      ],
    },
    // Home sales peak in spring and summer. High mortgage rates held 2023-24 volume down before a 2025-26 recovery.
    'Real Estate': {
      rate: 4.5,
      growth: 0,
      cycle: (m) => (m < 0 ? 0.9 : m < 12 ? 0.85 : m < 24 ? 0.95 : 1.12),
      season: [0.7, 0.85, 1.1, 1.25, 1.3, 1.25, 1.15, 1.05, 0.95, 0.9, 0.8, 0.65],
      lawyers: [['DB', 0.8], ['MH', 0.2]],
      sources: [['Client referral', 0.3], ['Professional referral', 0.35], ['Online search', 0.2], ['Returning client', 0.15]],
      tracks: [
        { share: 0.7, litigated: false, days: [50, 0.4], fee: [4500, 0.3], outcomes: [['Completed', 1]] },
        { share: 0.3, litigated: true, days: [180, 0.6], fee: [22000, 0.6], outcomes: [['Settled', 0.7], ['Trial verdict', 0.06], ['Dismissed or withdrawn', 0.24]] },
      ],
    },
    // Injury claims rise with summer travel and the holidays, and are growing fastest (statewide filings
    // rose 2.6x in three years). Most settle before a lawsuit; litigated cases run 18-24 months.
    // Fees are contingent: one third of the recovery before suit, 40% after.
    'Personal Injury': {
      rate: 7,
      growth: 0.16,
      season: [0.95, 0.85, 0.9, 0.95, 1.05, 1.15, 1.2, 1.15, 1, 0.95, 1, 1.1],
      lawyers: [['PR', 0.65], ['KL', 0.2], ['SO', 0.15]],
      sources: [['Online search', 0.35], ['Client referral', 0.25], ['Professional referral', 0.25], ['Returning client', 0.15]],
      tracks: [
        { share: 0.62, litigated: false, days: [270, 0.35], contingency: 1 / 3, outcomes: [['Settled', 0.9], ['Dismissed or withdrawn', 0.1]] },
        { share: 0.38, litigated: true, days: [600, 0.3], contingency: 0.4, outcomes: [['Settled', 0.9], ['Trial verdict', 0.07], ['Dismissed or withdrawn', 0.03]] },
      ],
    },
    // Highest volume, lowest fees. New Year resolutions and pre-holiday travel drive planning; probate takes about a year.
    'Estate Planning': {
      rate: 7.5,
      growth: 0.05,
      season: [1.4, 1.1, 1, 0.9, 0.95, 0.9, 0.85, 0.85, 0.95, 1.05, 1.1, 0.95],
      lawyers: [['EV', 0.85], ['DB', 0.15]],
      sources: [['Client referral', 0.35], ['Online search', 0.3], ['Professional referral', 0.2], ['Returning client', 0.15]],
      tracks: [
        { share: 0.85, litigated: false, days: [35, 0.45], flatFee: [[2800, 0.3], [3600, 0.35], [4500, 0.25], [6500, 0.1]], outcomes: [['Completed', 1]] },
        { share: 0.15, litigated: false, days: [330, 0.3], fee: [9000, 0.4], outcomes: [['Completed', 1]] },
      ],
    },
    // Short matters; roughly four in five reach an agreement.
    'Negotiation & Mediation': {
      rate: 2.5,
      growth: 0.1,
      season: [1.1, 1.05, 1, 1, 1, 0.9, 0.85, 0.85, 1.05, 1.1, 1.05, 0.8],
      lawyers: [['KL', 0.85], ['MH', 0.15]],
      sources: [['Professional referral', 0.4], ['Client referral', 0.25], ['Returning client', 0.2], ['Online search', 0.15]],
      tracks: [{ share: 1, litigated: false, days: [60, 0.5], fee: [6000, 0.4], outcomes: [['Settled', 0.78], ['Dismissed or withdrawn', 0.22]] }],
    },
    // Terminations follow year-end reviews, so claims peak in Q1. New California laws each January drive advisory work.
    'Employment Counsel': {
      rate: 3.5,
      growth: 0.12,
      season: [1.35, 1.2, 1.05, 0.95, 0.95, 0.9, 0.85, 0.9, 1, 1, 0.95, 0.85],
      lawyers: [['SO', 0.8], ['PR', 0.2]],
      sources: [['Online search', 0.3], ['Professional referral', 0.3], ['Client referral', 0.2], ['Returning client', 0.2]],
      tracks: [
        { share: 0.5, litigated: false, days: [45, 0.5], fee: [6000, 0.5], outcomes: [['Completed', 1]] },
        { share: 0.5, litigated: true, days: [360, 0.45], fee: [35000, 0.55], outcomes: [['Settled', 0.75], ['Trial verdict', 0.05], ['Dismissed or withdrawn', 0.2]] },
      ],
    },
  };

  function roundTo(value, step) {
    return Math.max(step, Math.round(value / step) * step);
  }

  function makeCase(area, model, openedTime) {
    const track = pick(model.tracks.map((t) => [t, t.share]));
    const outcome = pick(track.outcomes);

    let days = logNormal(track.days[0], track.days[1]);
    if (outcome === 'Trial verdict') days *= 1.3;
    if (outcome === 'Dismissed or withdrawn') days *= 0.5;
    days = Math.max(3, Math.round(days));

    let fees;
    if (track.contingency) {
      const recovery = Math.min(2500000, logNormal(55000, 0.9));
      fees = outcome === 'Dismissed or withdrawn' ? 0 : roundTo(recovery * track.contingency, 100);
    } else if (track.flatFee) {
      fees = pick(track.flatFee);
    } else {
      fees = roundTo(logNormal(track.fee[0], track.fee[1]), 100);
      if (outcome === 'Dismissed or withdrawn') fees = roundTo(fees * 0.5, 100);
    }

    const resolvedTime = openedTime + days * DAY;
    const isOpen = resolvedTime > asOfTime;
    const elapsed = Math.round((asOfTime - openedTime) / DAY);
    let status;
    if (isOpen) status = elapsed < 21 ? 'Intake' : track.litigated && elapsed > 90 ? 'In Litigation' : 'Active';
    else status = outcome === 'Settled' ? 'Settled' : 'Closed';

    return {
      area,
      attorney: pick(model.lawyers),
      status,
      opened: toIso(openedTime),
      resolved: isOpen ? '' : toIso(resolvedTime),
      outcome: isOpen ? 'Still open' : outcome,
      source: pick(model.sources),
      fees,
      litigated: track.litigated,
    };
  }

  // ---------- Generate month by month ----------
  const cases = [];
  const months = [];
  for (let m = -WARM_UP; m < MONTHS; m += 1) {
    const first = Date.UTC(START_YEAR, START_MONTH - 1 + m, 1);
    const next = Date.UTC(START_YEAR, START_MONTH + m, 1);
    const daysInMonth = Math.round((next - first) / DAY);
    const calMonth = new Date(first).getUTCMonth();
    if (m >= 0) months.push(toIso(first).slice(0, 7));

    Object.entries(models).forEach(([area, model]) => {
      const trend = Math.pow(1 + model.growth, m / 12) * (model.cycle ? model.cycle(m) : 1);
      const count = poisson(model.rate * trend * model.season[calMonth]);
      for (let i = 0; i < count; i += 1) {
        // Intake happens on weekdays.
        let day;
        do {
          day = first + Math.floor(rand() * daysInMonth) * DAY;
        } while ([0, 6].includes(new Date(day).getUTCDay()));
        if (day <= asOfTime) cases.push(makeCase(area, model, day));
      }
    });
  }

  cases.sort((a, b) => a.opened.localeCompare(b.opened));
  const perYear = {};
  cases.forEach((c) => {
    const yy = c.opened.slice(2, 4);
    perYear[yy] = (perYear[yy] || 0) + 1;
    c.id = `HB-${yy}-${String(perYear[yy]).padStart(3, '0')}`;
  });

  return { asOf: AS_OF, months, cases };
})();
