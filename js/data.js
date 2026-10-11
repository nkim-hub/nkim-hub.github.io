// Shared sample data for Halloway & Brisk LLP.
// Used by managecases.html (CRUD) and analytics.html (charts).
// Case edits are saved in the browser's localStorage so both pages see the same records.

const HB = (() => {
  const STORAGE_KEY = 'hb-cases-v1';

  const practiceAreas = [
    'Business Law',
    'Real Estate',
    'Personal Injury',
    'Estate Planning',
    'Negotiation & Mediation',
    'Employment Counsel',
  ];

  // Ordered the way a matter moves through the firm.
  const statuses = ['Intake', 'Active', 'In Litigation', 'Settled', 'Closed'];

  const attorneys = [
    { id: 'MH', name: 'Melissa Halloway', title: 'Managing Partner', area: 'Business Law' },
    { id: 'DB', name: 'Daniel Brisk', title: 'Founding Partner', area: 'Real Estate' },
    { id: 'PR', name: 'Priya Raman', title: 'Partner', area: 'Personal Injury' },
    { id: 'SO', name: 'Samuel Oyelaran', title: 'Senior Associate', area: 'Employment Counsel' },
    { id: 'EV', name: 'Elena Vásquez', title: 'Associate', area: 'Estate Planning' },
    { id: 'KL', name: 'Kevin Liu', title: 'Associate', area: 'Negotiation & Mediation' },
  ];

  // Fictional clients and matters (sample data for the student project).
  const seedCases = [
    { id: 'HB-1001', client: 'Mission Street Roasters LLC', area: 'Business Law', attorney: 'MH', status: 'Active', opened: '2025-10-06', nextDate: '2026-10-21', fees: 18500, notes: 'Supplier contract dispute; demand letter sent.' },
    { id: 'HB-1002', client: 'Grace Okafor', area: 'Estate Planning', attorney: 'EV', status: 'Closed', opened: '2025-10-14', nextDate: '', fees: 3200, notes: 'Revocable living trust and pour-over will signed.' },
    { id: 'HB-1003', client: 'Dogpatch Fabrication Inc.', area: 'Employment Counsel', attorney: 'SO', status: 'Settled', opened: '2025-11-03', nextDate: '', fees: 22000, notes: 'Wage-and-hour claim resolved at mediation.' },
    { id: 'HB-1004', client: 'Luis & Ana Moreno', area: 'Real Estate', attorney: 'DB', status: 'Closed', opened: '2025-11-17', nextDate: '', fees: 4800, notes: 'Condo purchase in Bernal Heights closed on schedule.' },
    { id: 'HB-1005', client: 'Theo Brandt', area: 'Personal Injury', attorney: 'PR', status: 'In Litigation', opened: '2025-12-01', nextDate: '2026-11-09', fees: 46000, notes: 'Cyclist struck by delivery van; complaint filed in SF Superior Court.' },
    { id: 'HB-1006', client: 'Sunset Dental Group', area: 'Business Law', attorney: 'MH', status: 'Closed', opened: '2025-12-09', nextDate: '', fees: 9600, notes: 'Partnership buy-out agreement drafted and executed.' },
    { id: 'HB-1007', client: 'Harbor & Pine Co-op', area: 'Negotiation & Mediation', attorney: 'KL', status: 'Settled', opened: '2026-01-12', nextDate: '', fees: 7400, notes: 'Board dispute between members settled in two sessions.' },
    { id: 'HB-1008', client: 'Margaret Chen', area: 'Estate Planning', attorney: 'EV', status: 'Active', opened: '2026-01-20', nextDate: '2026-10-15', fees: 5200, notes: 'Probate of father\'s estate; inventory due to court.' },
    { id: 'HB-1009', client: 'Ravi Patel', area: 'Personal Injury', attorney: 'PR', status: 'Settled', opened: '2026-02-02', nextDate: '', fees: 31000, notes: 'Slip-and-fall at retail store; settled before filing.' },
    { id: 'HB-1010', client: 'Bayline Logistics Corp.', area: 'Employment Counsel', attorney: 'SO', status: 'Active', opened: '2026-02-16', nextDate: '2026-10-28', fees: 15800, notes: 'Handbook rewrite and manager training for 2027 law changes.' },
    { id: 'HB-1011', client: 'Nob Hill Property Partners', area: 'Real Estate', attorney: 'DB', status: 'In Litigation', opened: '2026-03-04', nextDate: '2026-12-02', fees: 38500, notes: 'Commercial lease default; unlawful detainer pending.' },
    { id: 'HB-1012', client: 'Jasmine Ortiz', area: 'Personal Injury', attorney: 'PR', status: 'Active', opened: '2026-03-18', nextDate: '2026-10-30', fees: 27500, notes: 'Rear-end collision on I-280; treatment ongoing.' },
    { id: 'HB-1013', client: 'Fog City Brewing LLC', area: 'Business Law', attorney: 'MH', status: 'Settled', opened: '2026-04-01', nextDate: '', fees: 12900, notes: 'Trademark coexistence agreement negotiated.' },
    { id: 'HB-1014', client: 'Walter & June Kim', area: 'Estate Planning', attorney: 'EV', status: 'Closed', opened: '2026-04-13', nextDate: '', fees: 3600, notes: 'Wills, health care directives, and powers of attorney.' },
    { id: 'HB-1015', client: 'Presidio Learning Center', area: 'Employment Counsel', attorney: 'SO', status: 'In Litigation', opened: '2026-04-27', nextDate: '2026-11-18', fees: 29800, notes: 'Former employee retaliation claim; discovery underway.' },
    { id: 'HB-1016', client: 'Daniela Russo', area: 'Real Estate', attorney: 'DB', status: 'Active', opened: '2026-05-11', nextDate: '2026-10-09', fees: 5400, notes: 'Title defect on inherited duplex; quiet title review.' },
    { id: 'HB-1017', client: 'Embarcadero Tech Partners', area: 'Business Law', attorney: 'MH', status: 'In Litigation', opened: '2026-05-26', nextDate: '2026-10-24', fees: 52000, notes: 'Breach of software license; motion hearing scheduled.' },
    { id: 'HB-1018', client: 'Aaron Feldman', area: 'Personal Injury', attorney: 'PR', status: 'Intake', opened: '2026-06-08', nextDate: '2026-10-12', fees: 0, notes: 'Dog bite in Glen Park; gathering medical records.' },
    { id: 'HB-1019', client: 'Castro Street Florist', area: 'Negotiation & Mediation', attorney: 'KL', status: 'Active', opened: '2026-06-22', nextDate: '2026-10-19', fees: 6200, notes: 'Landlord rent dispute; mediation session booked.' },
    { id: 'HB-1020', client: 'Helen Abernathy', area: 'Estate Planning', attorney: 'EV', status: 'Active', opened: '2026-07-07', nextDate: '2026-11-04', fees: 4400, notes: 'Special needs trust for grandson.' },
    { id: 'HB-1021', client: 'Golden Gate Movers Inc.', area: 'Employment Counsel', attorney: 'SO', status: 'Intake', opened: '2026-07-21', nextDate: '2026-10-08', fees: 0, notes: 'Contractor vs. employee classification review.' },
    { id: 'HB-1022', client: 'Ingrid Solberg', area: 'Real Estate', attorney: 'DB', status: 'Active', opened: '2026-08-05', nextDate: '2026-10-27', fees: 6100, notes: 'Home sale with tenant-occupied in-law unit.' },
    { id: 'HB-1023', client: 'Marcus Delgado', area: 'Personal Injury', attorney: 'PR', status: 'Intake', opened: '2026-08-25', nextDate: '2026-10-14', fees: 0, notes: 'Muni bus collision; government claim deadline tracked.' },
    { id: 'HB-1024', client: 'Outer Richmond Bakery', area: 'Business Law', attorney: 'MH', status: 'Intake', opened: '2026-09-15', nextDate: '2026-10-07', fees: 0, notes: 'Entity conversion from sole proprietorship to LLC.' },
  ];

  function clone(list) {
    return list.map((c) => ({ ...c }));
  }

  function loadCases() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      // Storage blocked or corrupted: fall back to the sample data.
    }
    return clone(seedCases);
  }

  function saveCases(cases) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
      return true;
    } catch (err) {
      return false;
    }
  }

  function resetCases() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      // Nothing to clear.
    }
    return clone(seedCases);
  }

  function nextId(cases) {
    const max = cases.reduce((m, c) => Math.max(m, parseInt(c.id.replace(/\D/g, ''), 10) || 0), 1000);
    return `HB-${max + 1}`;
  }

  function attorneyName(id) {
    const a = attorneys.find((x) => x.id === id);
    return a ? a.name : 'Unassigned';
  }

  function isOpen(c) {
    return c.status !== 'Settled' && c.status !== 'Closed';
  }

  function statusClass(status) {
    return 'status-' + status.toLowerCase().replace('in ', '');
  }

  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return {
    practiceAreas,
    statuses,
    attorneys,
    loadCases,
    saveCases,
    resetCases,
    nextId,
    attorneyName,
    isOpen,
    statusClass,
    money,
    formatDate,
  };
})();
