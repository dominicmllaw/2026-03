// HARBOUR INTERCEPT — Student App
import { db, ref, set, get, onValue } from './firebase-config.js';
import { STUDENTS, PHASES } from './round-data.js';

// ── Module-level state ────────────────────────────────────────────────────
let pairId          = null;
let currentPhaseNum = null;
let gamePhase       = null;   // last-handled phase, avoids duplicate runs

const s1State = {
  attempts: {},
  correct:  {},
};

const solveState = {
  eqPrice: null,
  eqQty:   null,
  cb:      null,
  pb:      null,
};

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

  n1Sel.addEventListener('change', () => {
    const chosen = n1Sel.value;
    Array.from(n2Sel.options).forEach(opt => {
      opt.disabled = (opt.value !== '—' && opt.value === chosen);
    });
    if (n2Sel.value === chosen) n2Sel.value = '';
    checkEnterReady();
  });

  pairSel.addEventListener('change', checkEnterReady);
  n2Sel.addEventListener('change', checkEnterReady);
  document.getElementById('btn-enter').addEventListener('click', onPairEnter);
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
      // Teacher pressed RESET — clear registration and return to pair select
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
  currentPhaseNum    = num;
  s1State.attempts   = {};
  s1State.correct    = {};   // all rows require student input
  solveState.eqPrice = null;
  solveState.eqQty   = null;
  solveState.cb      = null;
  solveState.pb      = null;
  buildS1Gate(num);
}

// ── S1 Gate ───────────────────────────────────────────────────────────────
function buildS1Gate(num) {
  const phase = PHASES[num];

  const badge = document.getElementById('s1-phase-badge');
  badge.textContent = `PHASE ${num}`;
  badge.className   = `phase-badge phase-badge-${num}`;

  // Clean up any Phase 3 qty-form injected by a previous run
  const oldForm = document.getElementById('phase3-qty-form');
  if (oldForm) oldForm.remove();

  if (phase.phaseType === 'demand-only') {
    buildDemandOnlyGate(num, phase);
  } else {
    buildSupplyShiftGate(num, phase);
  }

  showScreen('screen-s1gate');
}

// Phase 1 & 2: fill in New Qty Supplied column
function buildSupplyShiftGate(num, phase) {
  document.querySelector('#s1-table thead').innerHTML = `
    <tr>
      <th>Price ($)</th><th>Qd</th><th>Original Qs</th><th>New Qty Supplied</th>
    </tr>`;

  const taxLabel = phase.taxLabel || `$${phase.tax} per unit tax on producers`;
  document.getElementById('s1-instruction').textContent =
    `The government imposes a ${taxLabel}. ` +
    `Supply decreases. For each price, find the quantity supplied at the ` +
    `seller's net price (price − $${phase.tax}). ` +
    `If that price is not shown in the table, enter /.`;

  const tbody = document.querySelector('#s1-table tbody');
  tbody.innerHTML = '';

  const qsValues = [...new Set(phase.schedule.map(r => r.qs))].sort((a, b) => a - b);
  const optHtml  = ['/', ...qsValues]
    .map(v => `<option value="${v}">${v}</option>`)
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

// Phase 3: demand-only — students identify old and new equilibrium quantities
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

  const optHtml = phase.eqQtyOptions.map(v => `<option value="${v}">${v}</option>`).join('');
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
    solveState.eqPrice = phase.newEqPrice;
    solveState.eqQty   = phase.newEqQty;
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

// ── Solve screen ──────────────────────────────────────────────────────────
function buildSolveScreen(num) {
  const phase = PHASES[num];

  const badge = document.getElementById('solve-phase-badge');
  badge.textContent = `PHASE ${num}`;
  badge.className   = `phase-badge phase-badge-${num}`;

  const tableBlock = `
    <div class="table-scroll" style="margin-bottom:20px">
      ${buildScheduleTableHTML(num)}
    </div>`;

  const cbBlock = `
    <div class="form-group">
      <label for="input-cb">Consumer burden per unit ($)</label>
      <p class="hint-text">Consumer burden = New price − $${phase.oldEqPrice} (old equilibrium price)</p>
      <input type="number" id="input-cb" min="0" max="${phase.tax}" step="1"
             placeholder="Enter a whole number">
    </div>
    <div id="burden-confirm" class="burden-confirm hidden"></div>
    <button id="btn-solve-submit" class="btn btn-primary" disabled>CONFIRM →</button>`;

  if (phase.phaseType === 'demand-only') {
    // Eq P and Q already known from gate — just confirm CB
    document.getElementById('solve-form-container').innerHTML =
      tableBlock +
      `<div class="info-box">
        Old equilibrium: P = $${phase.oldEqPrice}, Q = ${phase.oldEqQty}<br>
        New equilibrium: P = $${phase.newEqPrice}, Q = ${phase.newEqQty}<br>
        Tax: $${phase.tax}
      </div>` +
      cbBlock;
  } else {
    document.getElementById('solve-form-container').innerHTML =
      tableBlock +
      `<div class="form-group">
        <label for="sel-eq-price">New equilibrium price ($)</label>
        <select id="sel-eq-price">
          <option value="">— Select —</option>
          ${phase.eqPriceOptions.map(v => `<option value="${v}">$${v}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="sel-eq-qty">New equilibrium quantity</label>
        <select id="sel-eq-qty">
          <option value="">— Select —</option>
          ${phase.eqQtyOptions.map(v => `<option value="${v}">${v}</option>`).join('')}
        </select>
      </div>` +
      cbBlock;

    document.getElementById('sel-eq-price').addEventListener('change', validateSolve);
    document.getElementById('sel-eq-qty').addEventListener('change', validateSolve);
  }

  document.getElementById('input-cb').addEventListener('input', validateSolve);
  document.getElementById('btn-solve-submit').addEventListener('click', onSolveConfirm, { once: true });

  showScreen('screen-solve');
}

function validateSolve() {
  const phase   = PHASES[currentPhaseNum];
  const cbRaw   = document.getElementById('input-cb').value.trim();
  const cbVal   = parseInt(cbRaw);
  const confirm = document.getElementById('burden-confirm');
  const btn     = document.getElementById('btn-solve-submit');

  let priceOk = true, qtyOk = true;

  if (phase.phaseType !== 'demand-only') {
    const eqPriceEl = document.getElementById('sel-eq-price');
    const eqQtyEl   = document.getElementById('sel-eq-qty');
    const eqPrice   = parseInt(eqPriceEl.value);
    const eqQty     = parseInt(eqQtyEl.value);
    priceOk = !isNaN(eqPrice) && eqPrice === phase.newEqPrice;
    qtyOk   = !isNaN(eqQty)   && eqQty   === phase.newEqQty;
    eqPriceEl.classList.toggle('field-wrong', eqPriceEl.value !== '' && !priceOk);
    eqQtyEl.classList.toggle('field-wrong',   eqQtyEl.value   !== '' && !qtyOk);
  }

  if (cbRaw === '' || isNaN(cbVal) || cbVal < 0 || cbVal > phase.tax) {
    confirm.className = 'burden-confirm hidden';
    btn.disabled = true;
    return;
  }

  const pb   = phase.tax - cbVal;
  const cbOk = cbVal === phase.consumerBurden;

  if (cbOk) {
    confirm.textContent = `CB $${cbVal} + PB $${pb} = Tax $${phase.tax} ✓`;
    confirm.className   = 'burden-confirm burden-correct';
    solveState.cb = cbVal;
    solveState.pb = pb;
  } else {
    confirm.textContent = `CB $${cbVal} + PB $${pb} = Tax $${phase.tax} — check your calculation`;
    confirm.className   = 'burden-confirm burden-wrong';
  }

  btn.disabled = !(priceOk && qtyOk && cbOk);
}

function onSolveConfirm() {
  if (PHASES[currentPhaseNum].phaseType !== 'demand-only') {
    solveState.eqPrice = parseInt(document.getElementById('sel-eq-price').value);
    solveState.eqQty   = parseInt(document.getElementById('sel-eq-qty').value);
  }
  // demand-only: eqPrice/eqQty already set in buildDemandOnlyGate
  buildTargetScreen(currentPhaseNum);
}

// ── Target screen ─────────────────────────────────────────────────────────
function buildTargetScreen(num) {
  const badge = document.getElementById('target-phase-badge');
  badge.textContent = `PHASE ${num}`;
  badge.className   = `phase-badge phase-badge-${num}`;

  const btnC = document.getElementById('btn-consumer');
  const btnP = document.getElementById('btn-producer');
  btnC.disabled = false;
  btnP.disabled = false;
  btnC.onclick  = () => onTargetSelect('consumer');
  btnP.onclick  = () => onTargetSelect('producer');

  showScreen('screen-target');
}

async function onTargetSelect(target) {
  document.getElementById('btn-consumer').disabled = true;
  document.getElementById('btn-producer').disabled = true;

  const phase = PHASES[currentPhaseNum];
  const data  = {
    s1Complete:     true,
    eqPrice:        solveState.eqPrice,
    eqQty:          solveState.eqQty,
    consumerBurden: solveState.cb,
    producerBurden: solveState.pb,
    target,
    targetCorrect:  target === phase.correctTarget,
    submitted:      true,
  };

  await set(ref(db, `pairs/${pairId}/phase${currentPhaseNum}`), data);
  showLocked(currentPhaseNum);
}

// ── Locked screen ─────────────────────────────────────────────────────────
function showLocked(phaseNum) {
  const el = document.getElementById('locked-summary');
  if (solveState.cb !== null) {
    el.textContent =
      `Phase ${phaseNum} · New Eq: P=$${solveState.eqPrice} Q=${solveState.eqQty} · ` +
      `CB $${solveState.cb} + PB $${solveState.pb} = Tax $${PHASES[phaseNum].tax}`;
  } else {
    el.textContent = `Phase ${phaseNum} submitted.`;
  }
  showScreen('screen-locked');
}
