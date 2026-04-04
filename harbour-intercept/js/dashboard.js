// HARBOUR INTERCEPT — Dashboard App
import { db, ref, onValue } from './firebase-config.js';
import { PHASES } from './round-data.js';

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  onValue(ref(db, 'game'), snap => {
    const phase = (snap.val() || {}).currentPhase || 'standby';
    document.getElementById('game-status').textContent =
      `STATUS: ${phase.toUpperCase()}`;
  });

  onValue(ref(db, 'pairs'), snap => {
    const pairs = snap.val() || {};
    renderPhase12Table(1, pairs);
    renderPhase12Table(2, pairs);
    renderPhase3Table(pairs);
  });
});

// ── Phase 1 & 2 tables ────────────────────────────────────────────────────
function renderPhase12Table(phaseNum, pairs) {
  const tbody     = document.getElementById(`phase${phaseNum}-tbody`);
  const summaryEl = document.getElementById(`phase${phaseNum}-summary`);
  const phase     = PHASES[phaseNum];
  tbody.innerHTML = '';

  const sorted = Object.entries(pairs).sort(([a], [b]) => a.localeCompare(b));
  if (sorted.length === 0) {
    summaryEl.textContent = 'No data yet.';
    return;
  }

  let submitted = 0, consumers = 0, producers = 0;

  sorted.forEach(([pairId, pairData]) => {
    const pd  = pairData[`phase${phaseNum}`] || {};
    const num = pairId.replace('pair', '');
    const n1  = pairData.name1 || '—';
    const n2  = pairData.name2 && pairData.name2 !== '—' ? ` + ${pairData.name2}` : '';

    if (pd.submitted) {
      submitted++;
      if (pd.target === 'consumer') consumers++;
      if (pd.target === 'producer') producers++;
    }

    const targetLabel =
      pd.target === 'consumer' ? 'Consumer Shield' :
      pd.target === 'producer' ? 'Producer Armour' : '—';

    const isCorrect  = pd.submitted && pd.target === phase.correctTarget;
    const correctTd  = pd.submitted
      ? `<td class="${isCorrect ? 'cell-correct' : 'cell-wrong'}">${isCorrect ? 'Yes' : 'No'}</td>`
      : '<td class="cell-pending">—</td>';

    const tr = document.createElement('tr');
    if (!pd.submitted) tr.classList.add('row-pending');

    tr.innerHTML = `
      <td>${num}</td>
      <td>${n1}${n2}</td>
      <td class="${pd.s1Complete ? 'cell-correct' : 'cell-pending'}">${pd.s1Complete ? 'Yes' : '—'}</td>
      <td>${pd.eqPrice  != null ? '$' + pd.eqPrice  : '—'}</td>
      <td>${pd.eqQty    != null ? pd.eqQty           : '—'}</td>
      <td>${pd.consumerBurden != null ? '$' + pd.consumerBurden : '—'}</td>
      <td>${targetLabel}</td>
      ${correctTd}
    `;
    tbody.appendChild(tr);
  });

  summaryEl.textContent =
    `${submitted} / ${sorted.length} submitted · ` +
    `Consumer Shield: ${consumers} · Producer Armour: ${producers}`;
}

// ── Phase 3 table ─────────────────────────────────────────────────────────
function renderPhase3Table(pairs) {
  const tbody     = document.getElementById('phase3-tbody');
  const summaryEl = document.getElementById('phase3-summary');
  tbody.innerHTML = '';

  const sorted = Object.entries(pairs).sort(([a], [b]) => a.localeCompare(b));
  if (sorted.length === 0) {
    summaryEl.textContent = 'No data yet.';
    return;
  }

  let submitted = 0, raidA = 0, raidB = 0;

  sorted.forEach(([pairId, pairData]) => {
    const pd  = pairData.phase3 || {};
    const num = pairId.replace('pair', '');
    const n1  = pairData.name1 || '—';
    const n2  = pairData.name2 && pairData.name2 !== '—' ? ` + ${pairData.name2}` : '';

    if (pd.submitted) {
      submitted++;
      if (pd.raidChoice === 'A') raidA++;
      if (pd.raidChoice === 'B') raidB++;
    }

    const isCorrect = pd.submitted && pd.raidChoice === PHASES[3].correctRaid;
    const correctTd = pd.submitted
      ? `<td class="${isCorrect ? 'cell-correct' : 'cell-wrong'}">${isCorrect ? 'Yes' : 'No'}</td>`
      : '<td class="cell-pending">—</td>';

    const tr = document.createElement('tr');
    if (!pd.submitted) tr.classList.add('row-pending');

    tr.innerHTML = `
      <td>${num}</td>
      <td>${n1}${n2}</td>
      <td>${pd.raidChoice ? 'Analyst ' + pd.raidChoice : '—'}</td>
      ${correctTd}
    `;
    tbody.appendChild(tr);
  });

  summaryEl.textContent =
    `${submitted} / ${sorted.length} submitted · ` +
    `Raid A: ${raidA} · Raid B: ${raidB}`;
}
