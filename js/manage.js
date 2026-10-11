// Mock CRUD for client matters on managecases.html.
// Create: the form adds a case. Read: the table lists, searches, filters, sorts, and shows details.
// Update: Edit loads a case into the form. Delete: removes a case after confirmation.

(() => {
  let cases = HB.loadCases();
  let editingId = null;
  let pendingDeleteId = null;
  let sort = { key: 'id', dir: 'desc' };

  const form = document.getElementById('caseForm');
  const formTitle = document.getElementById('formTitle');
  const modeBadge = document.getElementById('modeBadge');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const rows = document.getElementById('caseRows');
  const resultCount = document.getElementById('resultCount');
  const search = document.getElementById('q');
  const filterArea = document.getElementById('filterArea');
  const filterStatus = document.getElementById('filterStatus');
  const filterAttorney = document.getElementById('filterAttorney');
  const viewDialog = document.getElementById('viewDialog');
  const confirmDialog = document.getElementById('confirmDialog');
  const toastEl = document.getElementById('toast');

  // ---------- Setup ----------

  function fillSelect(select, items, placeholder) {
    select.innerHTML = '';
    select.append(new Option(placeholder, ''));
    items.forEach(([value, label]) => select.append(new Option(label, value)));
  }

  const areaItems = HB.practiceAreas.map((a) => [a, a]);
  const statusItems = HB.statuses.map((s) => [s, s]);
  const attorneyItems = HB.attorneys.map((a) => [a.id, a.name]);

  fillSelect(form.elements.area, areaItems, 'Choose…');
  fillSelect(form.elements.attorney, attorneyItems, 'Choose…');
  fillSelect(form.elements.status, statusItems, 'Choose…');
  fillSelect(filterArea, areaItems, 'All areas');
  fillSelect(filterStatus, statusItems, 'All statuses');
  fillSelect(filterAttorney, attorneyItems, 'All attorneys');

  // Each attorney leads one practice area, so choosing one fills in the other.
  form.elements.area.addEventListener('change', () => {
    const lead = HB.attorneys.find((a) => a.area === form.elements.area.value);
    form.elements.attorney.value = lead ? lead.id : '';
    check('attorney');
  });

  form.elements.attorney.addEventListener('change', () => {
    const lead = HB.attorneys.find((a) => a.id === form.elements.attorney.value);
    form.elements.area.value = lead ? lead.area : '';
    check('area');
  });

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function setDefaults() {
    form.elements.status.value = 'Intake';
    form.elements.opened.value = today();
  }

  // ---------- Feedback ----------

  let toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  function persist() {
    if (!HB.saveCases(cases)) {
      toast('Changes apply to this visit only, because this browser is blocking saved data.');
    }
  }

  // ---------- Validation ----------

  const rules = {
    client: (v) => (v.trim().length >= 2 ? '' : 'Enter the client’s name.'),
    area: (v) => (v ? '' : 'Choose a practice area.'),
    attorney: (v) => (v ? '' : 'Choose the lead attorney.'),
    status: (v) => (v ? '' : 'Choose a status.'),
    opened: (v) => (v ? '' : 'Enter the date the case was opened.'),
    nextDate: (v) => (!v || !form.elements.opened.value || v >= form.elements.opened.value ? '' : 'The next date cannot be before the date opened.'),
    fees: (v) => (v === '' || Number(v) >= 0 ? '' : 'Fees cannot be negative.'),
  };

  const errorIds = { client: 'f-client', area: 'f-area', attorney: 'f-attorney', status: 'f-status', opened: 'f-opened', nextDate: 'f-next', fees: 'f-fees' };

  function check(name) {
    const el = form.elements[name];
    const error = rules[name](el.value);
    el.setAttribute('aria-invalid', error ? 'true' : 'false');
    document.getElementById(`${errorIds[name]}-error`).textContent = error;
    return !error;
  }

  function clearErrors() {
    Object.keys(rules).forEach((name) => {
      form.elements[name].removeAttribute('aria-invalid');
      document.getElementById(`${errorIds[name]}-error`).textContent = '';
    });
  }

  Object.keys(rules).forEach((name) => {
    form.elements[name].addEventListener('change', () => check(name));
  });

  // ---------- Read: render table ----------

  function visibleCases() {
    const q = search.value.trim().toLowerCase();
    const list = cases.filter((c) => {
      if (filterArea.value && c.area !== filterArea.value) return false;
      if (filterStatus.value && c.status !== filterStatus.value) return false;
      if (filterAttorney.value && c.attorney !== filterAttorney.value) return false;
      if (q && !`${c.id} ${c.client} ${c.notes}`.toLowerCase().includes(q)) return false;
      return true;
    });

    const valueOf = (c) => {
      if (sort.key === 'attorney') return HB.attorneyName(c.attorney);
      if (sort.key === 'status') return HB.statuses.indexOf(c.status);
      if (sort.key === 'fees') return Number(c.fees) || 0;
      if (sort.key === 'nextDate') return c.nextDate || '9999';
      return String(c[sort.key]).toLowerCase();
    };

    return list.sort((a, b) => {
      const x = valueOf(a);
      const y = valueOf(b);
      const order = x < y ? -1 : x > y ? 1 : 0;
      return sort.dir === 'asc' ? order : -order;
    });
  }

  function cell(text, className) {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function actionButton(label, action, id, extra = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn-link ${extra}`.trim();
    btn.textContent = label;
    btn.dataset.action = action;
    btn.dataset.id = id;
    btn.setAttribute('aria-label', `${label} ${id}`);
    return btn;
  }

  function render(flashId) {
    const list = visibleCases();
    rows.innerHTML = '';

    if (!list.length) {
      const tr = document.createElement('tr');
      const td = cell(cases.length ? 'No cases match your search or filters.' : 'No cases yet. Add one with the form above, or reset the sample data.', 'empty-state');
      td.colSpan = 9;
      tr.append(td);
      rows.append(tr);
    }

    list.forEach((c) => {
      const tr = document.createElement('tr');
      if (c.id === flashId) tr.className = 'flash';

      const statusTd = document.createElement('td');
      const pill = document.createElement('span');
      pill.className = `status ${HB.statusClass(c.status)}`;
      pill.textContent = c.status;
      statusTd.append(pill);

      const actions = document.createElement('td');
      const wrap = document.createElement('div');
      wrap.className = 'row-actions';
      wrap.append(actionButton('View', 'view', c.id), actionButton('Edit', 'edit', c.id), actionButton('Delete', 'delete', c.id, 'danger'));
      actions.append(wrap);

      tr.append(
        cell(c.id),
        cell(c.client),
        cell(c.area),
        cell(HB.attorneyName(c.attorney)),
        statusTd,
        cell(HB.formatDate(c.opened)),
        cell(HB.formatDate(c.nextDate)),
        cell(c.fees ? HB.money.format(c.fees) : '—', 'num'),
        actions
      );
      rows.append(tr);
    });

    const open = cases.filter(HB.isOpen).length;
    resultCount.textContent = `Showing ${list.length} of ${cases.length} cases · ${open} open`;

    document.querySelectorAll('#caseTable th[data-key]').forEach((th) => {
      th.setAttribute('aria-sort', th.dataset.key === sort.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
    });
  }

  [search, filterArea, filterStatus, filterAttorney].forEach((el) => el.addEventListener('input', () => render()));

  document.querySelectorAll('#caseTable th[data-key] .sort-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.closest('th').dataset.key;
      sort = { key, dir: sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc' };
      render();
    });
  });

  // ---------- Create & Update ----------

  function setMode(id) {
    editingId = id;
    const editing = Boolean(id);
    formTitle.textContent = editing ? `Edit case ${id}` : 'Add a new case';
    modeBadge.textContent = editing ? 'Update' : 'Create';
    modeBadge.classList.toggle('editing', editing);
    saveBtn.textContent = editing ? 'Save changes' : 'Add case';
    cancelBtn.hidden = !editing;
  }

  function startEdit(id) {
    const c = cases.find((x) => x.id === id);
    if (!c) return;
    clearErrors();
    setMode(id);
    ['client', 'area', 'attorney', 'status', 'opened', 'nextDate', 'notes'].forEach((k) => {
      form.elements[k].value = c[k] || '';
    });
    form.elements.fees.value = c.fees || '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.elements.client.focus({ preventScroll: true });
  }

  function stopEdit() {
    form.reset();
    clearErrors();
    setMode(null);
    setDefaults();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const failed = Object.keys(rules).filter((name) => !check(name));
    if (failed.length) {
      form.elements[failed[0]].focus();
      return;
    }

    const record = {
      client: form.elements.client.value.trim(),
      area: form.elements.area.value,
      attorney: form.elements.attorney.value,
      status: form.elements.status.value,
      opened: form.elements.opened.value,
      nextDate: form.elements.nextDate.value,
      fees: Number(form.elements.fees.value) || 0,
      notes: form.elements.notes.value.trim(),
    };

    let savedId;
    if (editingId) {
      cases = cases.map((c) => (c.id === editingId ? { ...c, ...record } : c));
      savedId = editingId;
      toast(`Case ${savedId} updated.`);
    } else {
      savedId = HB.nextId(cases);
      cases.push({ id: savedId, ...record });
      toast(`Case ${savedId} added for ${record.client}.`);
    }

    persist();
    stopEdit();
    render(savedId);
  });

  cancelBtn.addEventListener('click', stopEdit);

  form.addEventListener('reset', () => {
    // Let the browser clear the fields first, then restore defaults and the current mode.
    setTimeout(() => {
      clearErrors();
      if (!editingId) setDefaults();
    });
  });

  // ---------- Row actions: view, edit, delete ----------

  function showDetails(id) {
    const c = cases.find((x) => x.id === id);
    if (!c) return;
    const body = document.getElementById('viewBody');
    body.innerHTML = '';
    const fields = [
      ['Case ID', c.id],
      ['Client', c.client],
      ['Practice area', c.area],
      ['Lead attorney', HB.attorneyName(c.attorney)],
      ['Status', c.status],
      ['Opened', HB.formatDate(c.opened)],
      ['Next date', HB.formatDate(c.nextDate)],
      ['Estimated fees', c.fees ? HB.money.format(c.fees) : '—'],
      ['Notes', c.notes || '—'],
    ];
    fields.forEach(([label, value]) => {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      body.append(dt, dd);
    });
    document.getElementById('viewTitle').textContent = `${c.client}`;
    document.getElementById('viewEditBtn').dataset.id = c.id;
    viewDialog.showModal();
  }

  rows.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'view') showDetails(id);
    if (action === 'edit') startEdit(id);
    if (action === 'delete') {
      const c = cases.find((x) => x.id === id);
      pendingDeleteId = id;
      document.getElementById('confirmTitle').textContent = 'Delete case?';
      document.getElementById('confirmText').textContent = `This removes ${c.id} (${c.client}) from the case list.`;
      document.getElementById('confirmBtn').textContent = 'Delete case';
      confirmDialog.showModal();
    }
  });

  document.getElementById('viewEditBtn').addEventListener('click', (event) => {
    viewDialog.close();
    startEdit(event.currentTarget.dataset.id);
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    pendingDeleteId = '__reset__';
    document.getElementById('confirmTitle').textContent = 'Reset sample data?';
    document.getElementById('confirmText').textContent = 'This replaces all cases, including your changes, with the original 24 sample cases.';
    document.getElementById('confirmBtn').textContent = 'Reset data';
    confirmDialog.showModal();
  });

  document.getElementById('confirmBtn').addEventListener('click', () => {
    if (pendingDeleteId === '__reset__') {
      cases = HB.resetCases();
      stopEdit();
      toast('Sample data restored.');
    } else if (pendingDeleteId) {
      cases = cases.filter((c) => c.id !== pendingDeleteId);
      persist();
      if (editingId === pendingDeleteId) stopEdit();
      toast(`Case ${pendingDeleteId} deleted.`);
    }
    pendingDeleteId = null;
    confirmDialog.close();
    render();
  });

  document.querySelectorAll('dialog [data-close]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });

  // ---------- Start ----------

  setDefaults();
  render();
})();
