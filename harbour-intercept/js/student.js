// HARBOUR INTERCEPT — Student App
import { db, ref, set, get, onValue } from './firebase-config.js';
import { STUDENTS, PHASES } from './round-data.js';

// ── Module-level state ────────────────────────────────────────────────────
let takenNames      = new Set();   // names already registered in other pairs
let takenPairs      = new Set();   // pair IDs already registered
let pairId          = null;
let currentPhaseNum = null;
let gamePhase       = null;   // last-handled phase, avoids duplicate runs

const s1State = {
  attempts: {},
  correct:  {},
};

const solveState = {
  eqPrice:        null,
  eqQty:          null,
  eqPriceOld:     null,
  eqQtyOld:       null,
  cb:             null,
  pb:             null,
  taxRevenue:     null,
  newTotalRev:    null,
  elasticity:     null,
  totalCB:        null,
  stage2Score:    0,
};

// ── Stage timer ───────────────────────────────────────────────────────────
const STAGE_DURATION = (2 * 60 + 30) * 1000;   // 2 minutes 30 seconds
let timerInterval = null;

function startTimer(fillId, onExpiry) {
  stopTimer();
  const fill    = document.getElementById(fillId);
  if (!fill) return;
  const endTime = Date.now() + STAGE_DURATION;

  fill.style.transition = 'none';
  fill.style.width      = '100%';
  fill.className        = 'timer-bar-fill';

  timerInterval = setInterval(() => {
    const remaining = endTime - Date.now();
    const pct       = Math.max(0, remaining / STAGE_DURATION * 100);

    fill.style.transition = 'width 0.5s linear';
    fill.style.width      = pct + '%';
    fill.className        = 'timer-bar-fill' +
      (pct < 20 ? ' danger' : pct < 45 ? ' warning' : '');

    // EVA-style alert in last 15 seconds
    if (remaining > 0 && remaining <= 15000) {
      document.body.classList.add('eva-alert');
    } else {
      document.body.classList.remove('eva-alert');
    }

    if (remaining <= 0) {
      stopTimer();
      fill.style.width = '0%';
      onExpiry();
    }
  }, 500);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  document.body.classList.remove('eva-alert');
}

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  pairId = localStorage.getItem('pairId');

  if (pairId && localStorage.getItem('name1')) {
    updateStandbyBadge();
    showScreen('screen-standby');
    subscribeGame();
  } else {
    initPairSelect();
    showScreen('screen-pair-select');
  }

  document.body.classList.remove('loading');
});

// ── Helpers ───────────────────────────────────────────────────────────────
function showScreen(id) {
  stopTimer();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function updateStandbyBadge() {
  const n1  = localStorage.getItem('name1') || '';
  const n2  = localStorage.getItem('name2') || '';
  const num = pairId.replace('pair', '');
  let badge = `PAIR ${num}`;
  if (n1) badge += ` · ${n1}`;
  if (n2 && n2 !== '—') badge += ` + ${n2}`;
  document.getElementById('standby-pair-badge').textContent = badge;
}

// ── Pair selection ────────────────────────────────────────────────────────
function refreshPairDropdown() {
  const pairSel = document.getElementById('pair-select');
  if (!pairSel) return;
  Array.from(pairSel.options).forEach(opt => {
    if (opt.value === '') return;
    opt.disabled = takenPairs.has(opt.value);
  });
  const selected = pairSel.options[pairSel.selectedIndex];
  if (selected && selected.disabled) pairSel.value = '';
}

function refreshNameDropdowns() {
  const n1Sel = document.getElementById('name1-select');
  const n2Sel = document.getElementById('name2-select');
  if (!n1Sel || !n2Sel) return;
  const selfChosen = n1Sel.value;
  [n1Sel, n2Sel].forEach((sel, idx) => {
    Array.from(sel.options).forEach(opt => {
      if (opt.value === '' || opt.value === '—') return;
      const takenByOther = takenNames.has(opt.value);
      const isSelf       = (idx === 1 && opt.value === selfChosen);
      opt.disabled = takenByOther || isSelf;
    });
  });
  // Deselect any currently-selected value that is now disabled
  [n1Sel, n2Sel].forEach(sel => {
    const selected = sel.options[sel.selectedIndex];
    if (selected && selected.disabled) sel.value = '';
  });
  checkEnterReady();
}

function initPairSelect() {
  const pairSel = document.getElementById('pair-select');
  for (let i = 1; i <= 16; i++) {
    const num = String(i).padStart(2, '0');
    pairSel.appendChild(new Option(`Pair ${num}`, `pair${num}`));
  }

  const n1Sel = document.getElementById('name1-select');
  const n2Sel = document.getElementById('name2-select');

  STUDENTS.forEach(name => n1Sel.appendChild(new Option(name, name)));

  n2Sel.appendChild(new Option('— (solo)', '—'));
  STUDENTS.forEach(name => n2Sel.appendChild(new Option(name, name)));

  n1Sel.addEventListener('change', refreshNameDropdowns);
  pairSel.addEventListener('change', () => {
    // Re-compute taken names excluding the newly selected pair
    refreshNameDropdowns();
  });
  n2Sel.addEventListener('change', checkEnterReady);
  document.getElementById('btn-enter').addEventListener('click', onPairEnter);

  // Real-time listener: disable pairs and names already claimed
  onValue(ref(db, 'pairs'), snap => {
    const data          = snap.val() || {};
    const currentPairId = document.getElementById('pair-select').value;
    takenNames = new Set();
    takenPairs = new Set();
    Object.entries(data).forEach(([pid, pair]) => {
      // A pair is "taken" if it has at least one registered name
      if (pair.name1 && pair.name1 !== '—') {
        takenPairs.add(pid);
      }
      if (pid === currentPairId) return;
      if (pair.name1 && pair.name1 !== '—') takenNames.add(pair.name1);
      if (pair.name2 && pair.name2 !== '—') takenNames.add(pair.name2);
    });
    refreshPairDropdown();
    refreshNameDropdowns();
  });
}

function checkEnterReady() {
  const ready = document.getElementById('pair-select').value &&
                document.getElementById('name1-select').value &&
                document.getElementById('name2-select').value;
  document.getElementById('btn-enter').disabled = !ready;
}

async function onPairEnter() {
  const id = document.getElementById('pair-select').value;
  const n1 = document.getElementById('name1-select').value;
  const n2 = document.getElementById('name2-select').value;

  // Last-resort guard against race conditions
  const snap    = await get(ref(db, 'pairs'));
  const data    = snap.val() || {};

  // Check if this pair slot is already taken
  const existingPair = data[id];
  if (existingPair && existingPair.name1 && existingPair.name1 !== '—') {
    alert(`Pair ${id.replace('pair', '')} is already registered. Please choose a different pair.`);
    return;
  }

  const claimed = Object.entries(data)
    .filter(([pid]) => pid !== id)
    .flatMap(([, pair]) => [pair.name1, pair.name2])
    .filter(Boolean);
  if (claimed.includes(n1) || (n2 !== '—' && claimed.includes(n2))) {
    alert('One or both names are already registered in another pair. Please choose different names.');
    return;
  }

  pairId = id;
  localStorage.setItem('pairId', pairId);
  localStorage.setItem('name1', n1);
  localStorage.setItem('name2', n2);

  await set(ref(db, `pairs/${pairId}/name1`), n1);
  await set(ref(db, `pairs/${pairId}/name2`), n2);

  // Snapshot current resetAt so we don't get bounced back immediately
  const gameSnap = await get(ref(db, 'game/resetAt'));
  localStorage.setItem('game_resetAt', String(gameSnap.val() || 0));

  updateStandbyBadge();
  showScreen('screen-standby');
  subscribeGame();
}

// ── Game state subscription ───────────────────────────────────────────────
function subscribeGame() {
  onValue(ref(db, 'game'), snapshot => {
    const game    = snapshot.val() || {};
    const resetAt = game.resetAt || 0;
    const stored  = parseInt(localStorage.getItem('game_resetAt') || '0');

    if (resetAt !== stored) {
      localStorage.removeItem('pairId');
      localStorage.removeItem('name1');
      localStorage.removeItem('name2');
      localStorage.setItem('game_resetAt', String(resetAt));
      location.reload();
      return;
    }

    handleGameChange(game.currentPhase || 'standby');
  });
}

async function handleGameChange(phase) {
  if (phase === gamePhase) return;
  gamePhase = phase;

  if (phase === 'standby') {
    showScreen('screen-standby');
    return;
  }

  if (phase === 'phase1' || phase === 'phase2' || phase === 'phase3') {
    const num  = parseInt(phase.slice(-1));
    const snap = await get(ref(db, `pairs/${pairId}/phase${num}/submitted`));
    if (snap.val() === true) {
      showLocked(num);
    } else {
      startPhase(num);
    }
  }
}

// ── Phase start ───────────────────────────────────────────────────────────
function startPhase(num) {
  currentPhaseNum = num;
  s1State.attempts   = {};
  s1State.correct    = {};
  solveState.eqPrice     = null;
  solveState.eqQty       = null;
  solveState.eqPriceOld  = null;
  solveState.eqQtyOld    = null;
  solveState.cb          = null;
  solveState.pb          = null;
  solveState.taxRevenue  = null;
  solveState.newTotalRev = null;
  solveState.elasticity  = null;
  solveState.totalCB     = null;
  solveState.stage2Score = 0;
  buildS1Gate(num);
}

// ── Phase badge helper ────────────────────────────────────────────────────
function setPhaseBadge(id, num) {
  const el = document.getElementById(id);
  el.textContent = `ENG. ${num}`;
  el.className   = `phase-badge phase-badge-${num}`;
}

// ── S1 Gate ───────────────────────────────────────────────────────────────
function buildS1Gate(num) {
  const phase = PHASES[num];

  setPhaseBadge('s1-phase-badge', num);

  const oldForm = document.getElementById('phase3-qty-form');
  if (oldForm) oldForm.remove();

  if (phase.phaseType === 'demand-only') {
    buildDemandOnlyGate(num, phase);
  } else {
    buildSupplyShiftGate(num, phase);
  }

  showScreen('screen-s1gate');
  startTimer('timer-s1', () => {
    // Freeze all inputs; force-enable the proceed button
    document.querySelectorAll('#screen-s1gate input, #screen-s1gate select')
      .forEach(el => { el.disabled = true; });
    const btn = document.getElementById('btn-s1-unlock');
    if (btn) btn.disabled = false;
  });
}

// Engagements 1 & 2: fill in New Qty Supplied column
function buildSupplyShiftGate(num, phase) {
  document.querySelector('#s1-table thead').innerHTML = `
    <tr>
      <th>Price ($)</th><th>Qd</th><th>Original Qs</th><th>New Qty Supplied</th>
    </tr>`;

  document.getElementById('s1-instruction').textContent =
    `The government imposes a ${phase.taxLabel}. ` +
    `Supply decreases. For each price, find the quantity supplied at the ` +
    `seller's net price (price − $${phase.tax}). ` +
    `If that price is not shown in the table, enter /.`;

  const tbody = document.querySelector('#s1-table tbody');
  tbody.innerHTML = '';

  const qsValues = [...new Set(phase.schedule.map(r => r.qs))].sort((a, b) => a - b);
  const optHtml  = ['/', ...qsValues]
    .map(v => `<option value="${v}">${v === '/' ? '/' : v + ' units'}</option>`)
    .join('');

  phase.schedule.forEach((row, i) => {
    const sellerPrice = row.price - phase.tax;
    const match       = phase.schedule.find(r => r.price === sellerPrice);
    const correctNew  = match ? String(match.qs) : '/';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>$${row.price}</td>
      <td>${row.qd}</td>
      <td>${row.qs}</td>
      <td>
        <select class="s1-sel" data-row="${i}" data-correct="${correctNew}">
          <option value="">—</option>
          ${optHtml}
        </select>
        <div class="row-hint hidden" id="hint-row-${i}">
          <img src="assets/hint-s1.png"
               alt="Hint: find Qs at seller price $${sellerPrice}"
               onerror="this.style.display='none'">
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.s1-sel').forEach(sel =>
    sel.addEventListener('change', onS1Change)
  );

  const oldBtn   = document.getElementById('btn-s1-unlock');
  const freshBtn = oldBtn.cloneNode(true);
  freshBtn.disabled    = true;
  freshBtn.textContent = 'UNLOCK →';
  oldBtn.parentNode.replaceChild(freshBtn, oldBtn);
  freshBtn.addEventListener('click', onS1Unlock, { once: true });
}

// Engagement 3: demand-only — students identify old and new equilibrium quantities
function buildDemandOnlyGate(num, phase) {
  document.querySelector('#s1-table thead').innerHTML =
    '<tr><th>Price ($)</th><th>Qd</th></tr>';

  document.getElementById('s1-instruction').textContent =
    `A ${phase.taxLabel} is imposed. ` +
    `The old equilibrium price is $${phase.oldEqPrice} and the new equilibrium price is $${phase.newEqPrice}. ` +
    `Using the demand schedule below, find the old and new equilibrium quantities.`;

  const tbody = document.querySelector('#s1-table tbody');
  tbody.innerHTML = '';
  phase.schedule.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>$${row.price}</td><td>${row.qd}</td>`;
    tbody.appendChild(tr);
  });

  const oldBtn   = document.getElementById('btn-s1-unlock');
  const freshBtn = oldBtn.cloneNode(true);
  freshBtn.disabled    = true;
  freshBtn.textContent = 'PROCEED →';
  oldBtn.parentNode.replaceChild(freshBtn, oldBtn);

  const optHtml = phase.eqQtyOptions.map(v => `<option value="${v}">${v} units</option>`).join('');
  const qForm   = document.createElement('div');
  qForm.id      = 'phase3-qty-form';
  qForm.innerHTML = `
    <div class="form-group">
      <label>Old equilibrium quantity (at P = $${phase.oldEqPrice})</label>
      <select id="sel-old-qty">
        <option value="">— Select —</option>
        ${optHtml}
      </select>
    </div>
    <div class="form-group">
      <label>New equilibrium quantity (at P = $${phase.newEqPrice})</label>
      <select id="sel-new-qty">
        <option value="">— Select —</option>
        ${optHtml}
      </select>
    </div>
  `;
  freshBtn.parentNode.insertBefore(qForm, freshBtn);

  function checkDemandGate() {
    const oldSel = document.getElementById('sel-old-qty');
    const newSel = document.getElementById('sel-new-qty');
    const oldOk  = parseInt(oldSel.value) === phase.oldEqQty;
    const newOk  = parseInt(newSel.value) === phase.newEqQty;
    oldSel.classList.toggle('field-wrong', oldSel.value !== '' && !oldOk);
    newSel.classList.toggle('field-wrong', newSel.value !== '' && !newOk);
    freshBtn.disabled = !(oldOk && newOk);
  }

  document.getElementById('sel-old-qty').addEventListener('change', checkDemandGate);
  document.getElementById('sel-new-qty').addEventListener('change', checkDemandGate);

  freshBtn.addEventListener('click', async () => {
    await set(ref(db, `pairs/${pairId}/phase${num}/s1Complete`), true);
    buildSolveScreen(num);
  }, { once: true });
}

function onS1Change(e) {
  const sel     = e.target;
  const rowIdx  = parseInt(sel.dataset.row);
  const correct = sel.dataset.correct;
  const chosen  = sel.value;

  if (!chosen) return;

  if (chosen === correct) {
    sel.classList.remove('s1-wrong');
    sel.classList.add('s1-correct');
    sel.disabled = true;
    s1State.correct[rowIdx] = true;
  } else {
    sel.classList.remove('s1-correct');
    sel.classList.add('s1-wrong');
    s1State.correct[rowIdx] = false;
    s1State.attempts[rowIdx] = (s1State.attempts[rowIdx] || 0) + 1;
    if (s1State.attempts[rowIdx] >= 2) {
      const hint = document.getElementById(`hint-row-${rowIdx}`);
      if (hint) hint.classList.remove('hidden');
    }
  }

  const phase      = PHASES[currentPhaseNum];
  const allCorrect = phase.schedule.every((_, i) => s1State.correct[i] === true);
  const btn        = document.getElementById('btn-s1-unlock');
  if (btn) btn.disabled = !allCorrect;
}

async function onS1Unlock() {
  await set(ref(db, `pairs/${pairId}/phase${currentPhaseNum}/s1Complete`), true);
  buildSolveScreen(currentPhaseNum);
}

// ── Schedule table helper (reused on solve screen) ────────────────────────
function buildScheduleTableHTML(num) {
  const phase = PHASES[num];

  if (phase.phaseType === 'demand-only') {
    let html = `<table class="schedule-table">
      <thead><tr><th>Price ($)</th><th>Qd</th></tr></thead><tbody>`;
    phase.schedule.forEach(row => {
      const isOld = row.price === phase.oldEqPrice;
      const isNew = row.price === phase.newEqPrice;
      html += `<tr${(isOld || isNew) ? ' class="eq-row"' : ''}>
        <td>$${row.price}</td><td>${row.qd}</td>
      </tr>`;
    });
    return html + '</tbody></table>';
  }

  let html = `
    <table class="schedule-table">
      <thead><tr>
        <th>Price ($)</th><th>Qd</th><th>Original Qs</th><th>New Qty Supplied</th>
      </tr></thead>
      <tbody>
  `;
  phase.schedule.forEach(row => {
    const sellerPrice = row.price - phase.tax;
    const match       = phase.schedule.find(r => r.price === sellerPrice);
    const newQs       = match ? String(match.qs) : '/';
    const isEq        = String(row.qd) === newQs;
    html += `<tr${isEq ? ' class="eq-row"' : ''}>
      <td>$${row.price}</td>
      <td>${row.qd}</td>
      <td>${row.qs}</td>
      <td><strong>${newQs}</strong></td>
    </tr>`;
  });
  html += '</tbody></table>';
  return html;
}

// ── Solve screen (Stage 2 — Payload Loading) ──────────────────────────────
function buildSolveScreen(num) {
  const phase = PHASES[num];

  setPhaseBadge('solve-phase-badge', num);

  const tableBlock = `
    <div class="table-scroll" style="margin-bottom:14px">
      ${buildScheduleTableHTML(num)}
    </div>`;

  const givenBox = `
    <div class="s2-given-box">
      <span class="s2-given-label">GIVEN</span>${phase.taxLabel}
    </div>`;

  // All 10 ammo circles start empty for every engagement
  const ammoCnt    = 10;
  const circlesHTML = Array.from({ length: ammoCnt }, (_, i) =>
    `<div class="ammo-circle" id="ammo-${i}"></div>`
  ).join('');

  const ammoHeader = `
    <div class="ammo-header">
      <div class="ammo-row">${circlesHTML}</div>
      <div class="ammo-count" id="ammo-count">AMMO: 0 / 10</div>
    </div>`;

  document.getElementById('solve-form-container').innerHTML =
    tableBlock +
    givenBox +
    ammoHeader +
    buildActiveFields(phase) +
    `<button id="btn-solve-submit" class="btn btn-primary">FIRE (0/10) →</button>`;

  initAmmoSystem(num);

  showScreen('screen-solve');
  startTimer('timer-solve', () => {
    document.querySelectorAll('#screen-solve input, #screen-solve select')
      .forEach(el => { el.disabled = true; });
    document.getElementById('btn-solve-submit').disabled = false;
  });
}

// Build the 10-field worksheet — all engagements use all 10 inputs
function buildActiveFields(phase) {
  const priceOpts = (phase.eqPriceOptions || []).map(v =>
    `<option value="${v}">$${v}</option>`).join('');
  const qtyOpts   = (phase.eqQtyOptions   || []).map(v =>
    `<option value="${v}">${v} units</option>`).join('');

  const elasticityOpts = `
    <option value="">— Select —</option>
    <option value="elastic">Elastic</option>
    <option value="unit">Unit Elastic</option>
    <option value="inelastic">Inelastic</option>`;

  return `
    <div class="form-group">
      <label>① Old equilibrium price — P₁ ($)</label>
      <select id="s2-p1">
        <option value="">— Select —</option>
        ${priceOpts}
      </select>
    </div>
    <div class="form-group">
      <label>② Old equilibrium quantity — Q₁ (units)</label>
      <select id="s2-q1">
        <option value="">— Select —</option>
        ${qtyOpts}
      </select>
    </div>
    <div class="form-group">
      <label>③ New equilibrium price — P₂ ($)</label>
      <select id="s2-p2">
        <option value="">— Select —</option>
        ${priceOpts}
      </select>
    </div>
    <div class="form-group">
      <label>④ New equilibrium quantity — Q₂ (units)</label>
      <select id="s2-q2">
        <option value="">— Select —</option>
        ${qtyOpts}
      </select>
    </div>
    <div class="form-group">
      <label>⑤ Unit tax — t ($)</label>
      <input type="number" id="s2-t" min="0" step="1">
    </div>
    <div class="form-group">
      <label>⑥ Tax revenue — t × Q₂ ($)</label>
      <input type="number" id="s2-taxrev" min="0" step="1">
    </div>
    <div class="form-group">
      <label>⑦ New total revenue — P₂ × Q₂ ($)</label>
      <input type="number" id="s2-ntr" min="0" step="1">
    </div>
    <div class="form-group">
      <label>⑧ Elasticity of demand</label>
      <select id="s2-elas">${elasticityOpts}</select>
    </div>
    <div class="form-group">
      <label>⑨ Consumer burden total — CB × Q₂ ($)</label>
      <input type="number" id="s2-cbtot" min="0" step="1">
    </div>
    <div class="form-group">
      <label>⑩ Consumer burden per unit — P₂ − P₁ ($)</label>
      <input type="number" id="s2-cbunit" min="0" step="1">
    </div>`;
}

// ── Ammo system ───────────────────────────────────────────────────────────
let ammoMap = [];

function initAmmoSystem(num) {
  const phase = PHASES[num];
  ammoMap     = [
    { id: 's2-p1',     expected: phase.oldEqPrice,                      circleIdx: 0, type: 'select' },
    { id: 's2-q1',     expected: phase.oldEqQty,                        circleIdx: 1, type: 'select' },
    { id: 's2-p2',     expected: phase.newEqPrice,                      circleIdx: 2, type: 'select' },
    { id: 's2-q2',     expected: phase.newEqQty,                        circleIdx: 3, type: 'select' },
    { id: 's2-t',      expected: phase.tax,                              circleIdx: 4, type: 'number' },
    { id: 's2-taxrev', expected: phase.tax * phase.newEqQty,            circleIdx: 5, type: 'number' },
    { id: 's2-ntr',    expected: phase.newEqPrice * phase.newEqQty,     circleIdx: 6, type: 'number' },
    { id: 's2-elas',   expected: phase.correctElasticity,                circleIdx: 7, type: 'select' },
    { id: 's2-cbtot',  expected: phase.consumerBurden * phase.newEqQty, circleIdx: 8, type: 'number' },
    { id: 's2-cbunit', expected: phase.consumerBurden,                   circleIdx: 9, type: 'number' },
  ];

  updateAmmoDisplay(0);

  ammoMap.forEach(({ id, type }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(type === 'select' ? 'change' : 'input', checkAmmo);
  });

  document.getElementById('btn-solve-submit')
    .addEventListener('click', onSolveConfirm, { once: true });
}

function checkAmmo() {
  ammoMap.forEach(({ id, expected, circleIdx, type }) => {
    const el  = document.getElementById(id);
    if (!el) return;
    const val = type === 'select' ? el.value : parseInt(el.value);
    const ok  = type === 'select' ? val === String(expected) : val === expected;
    const circle = document.getElementById(`ammo-${circleIdx}`);
    if (!circle) return;
    if (el.value === '' || (type !== 'select' && isNaN(val))) {
      circle.className = 'ammo-circle';
    } else {
      circle.className = ok ? 'ammo-circle correct' : 'ammo-circle wrong';
    }
  });

  updateAmmoDisplay(0);
}

function updateAmmoDisplay(autoAmmo) {
  let green = autoAmmo;
  ammoMap.forEach(({ id, expected, type }) => {
    const el  = document.getElementById(id);
    if (!el) return;
    const val = type === 'select' ? el.value : parseInt(el.value);
    const ok  = type === 'select' ? val === String(expected) : val === expected;
    if (ok) green++;
  });

  solveState.stage2Score = green;

  const countEl = document.getElementById('ammo-count');
  if (countEl) countEl.textContent = `AMMO: ${green} / 10`;
  const fireBtn = document.getElementById('btn-solve-submit');
  if (fireBtn) fireBtn.textContent = `FIRE (${green}/10) →`;
}

function onSolveConfirm() {
  const phase = PHASES[currentPhaseNum];

  solveState.eqPriceOld = parseInt(document.getElementById('s2-p1')?.value);
  solveState.eqQtyOld   = parseInt(document.getElementById('s2-q1')?.value);
  solveState.eqPrice    = parseInt(document.getElementById('s2-p2')?.value);
  solveState.eqQty      = parseInt(document.getElementById('s2-q2')?.value);

  solveState.taxRevenue  = parseInt(document.getElementById('s2-taxrev')?.value);
  solveState.newTotalRev = parseInt(document.getElementById('s2-ntr')?.value);
  solveState.elasticity  = document.getElementById('s2-elas')?.value;
  solveState.totalCB     = parseInt(document.getElementById('s2-cbtot')?.value);
  solveState.cb          = parseInt(document.getElementById('s2-cbunit')?.value);
  solveState.pb          = isNaN(solveState.cb) ? null : phase.tax - solveState.cb;

  buildTargetScreen(currentPhaseNum);
}

// ── Target screen (Stage 3 — Target Selection) ────────────────────────────
function buildTargetScreen(num) {
  setPhaseBadge('target-phase-badge', num);

  const btnCore = document.getElementById('btn-core');
  const btnBody = document.getElementById('btn-body');
  const btnRear = document.getElementById('btn-rear');

  btnCore.disabled = false;
  btnBody.disabled = false;
  btnRear.disabled = false;
  btnCore.onclick  = () => onTargetSelect('core');
  btnBody.onclick  = () => onTargetSelect('body');
  btnRear.onclick  = () => onTargetSelect('rear');

  showScreen('screen-target');
  startTimer('timer-target', () => {
    // No inputs to freeze; buttons stay available
  });
}

async function onTargetSelect(target) {
  document.getElementById('btn-core').disabled = true;
  document.getElementById('btn-body').disabled = true;
  document.getElementById('btn-rear').disabled = true;

  const phase = PHASES[currentPhaseNum];
  const data  = {
    s1Complete:     true,
    eqPriceOld:     isNaN(solveState.eqPriceOld) ? null : solveState.eqPriceOld,
    eqQtyOld:       isNaN(solveState.eqQtyOld)   ? null : solveState.eqQtyOld,
    eqPrice:        isNaN(solveState.eqPrice)     ? null : solveState.eqPrice,
    eqQty:          isNaN(solveState.eqQty)       ? null : solveState.eqQty,
    consumerBurden: isNaN(solveState.cb)          ? null : solveState.cb,
    producerBurden: isNaN(solveState.pb)          ? null : solveState.pb,
    taxRevenue:     isNaN(solveState.taxRevenue)  ? null : solveState.taxRevenue,
    newTotalRev:    isNaN(solveState.newTotalRev) ? null : solveState.newTotalRev,
    elasticity:     solveState.elasticity || null,
    stage2Score:    solveState.stage2Score,
    target,
    targetCorrect:  target === phase.correctTarget,
    submitted:      true,
  };

  await set(ref(db, `pairs/${pairId}/phase${currentPhaseNum}`), data);
  showLocked(currentPhaseNum);
}

// ── Locked screen ─────────────────────────────────────────────────────────
function showLocked(phaseNum) {
  const phase = PHASES[phaseNum];
  const el    = document.getElementById('locked-summary');
  const score = solveState.stage2Score;
  const cb    = solveState.cb;
  const pb    = solveState.pb;

  let summary = `Engagement ${phaseNum}`;
  if (!isNaN(solveState.eqPrice)) {
    summary += ` · New Eq: P=$${solveState.eqPrice} Q=${solveState.eqQty} units`;
  }
  if (!isNaN(cb)) {
    summary += ` · CB $${cb} + PB $${pb} = Tax $${phase.tax}`;
  }
  summary += ` · Ammo: ${score}/10`;

  el.textContent = summary;
  showScreen('screen-locked');
}
