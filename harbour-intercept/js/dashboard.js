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

function targetLabel(target) {
  return target === 'core' ? 'Core Unit' :
         target === 'body' ? 'Body Armour' :
         target === 'rear' ? 'Rear Section' : '—';
}

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

  let submitted = 0, core = 0, body = 0, rear = 0;

  sorted.forEach(([pairId, pairData]) => {
    const pd  = pairData[`phase${phaseNum}`] || {};
    const num = pairId.replace('pair', '');
    const n1  = pairData.name1 || '—';
    const n2  = pairData.name2 && pairData.name2 !== '—' ? ` + ${pairData.name2}` : '';

    if (pd.submitted) {
      submitted++;
      if (pd.target === 'core') core++;
      if (pd.target === 'body') body++;
      if (pd.target === 'rear') rear++;
    }

    const isCorrect  = pd.submitted && pd.target === phase.correctTarget;
    const correctTd  = pd.submitted
      ? `<td class="${isCorrect ? 'cell-correct' : 'cell-wrong'}">${isCorrect ? 'Yes' : 'No'}</td>`
      : '<td class="cell-pending">—</td>';

    const score = pd.stage2Score != null ? pd.stage2Score : '—';

    const tr = document.createElement('tr');
    if (!pd.submitted) tr.classList.add('row-pending');

    tr.innerHTML = `
      <td>${num}</td>
      <td>${n1}${n2}</td>
      <td class="${pd.s1Complete ? 'cell-correct' : 'cell-pending'}">${pd.s1Complete ? 'Yes' : '—'}</td>
      <td>${pd.eqPrice  != null ? '$' + pd.eqPrice  : '—'}</td>
      <td>${pd.eqQty    != null ? pd.eqQty           : '—'}</td>
      <td>${pd.consumerBurden != null ? '$' + pd.consumerBurden : '—'}</td>
      <td>${score !== '—' ? score + '/10' : '—'}</td>
      <td>${targetLabel(pd.target)}</td>
      ${correctTd}
    `;
    tbody.appendChild(tr);
  });

  summaryEl.textContent =
    `${submitted} / ${sorted.length} submitted · ` +
    `Core Unit: ${core} · Body Armour: ${body} · Rear Section: ${rear}`;
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

  let submitted = 0, core = 0, body = 0, rear = 0;

  sorted.forEach(([pairId, pairData]) => {
    const pd  = pairData.phase3 || {};
    const num = pairId.replace('pair', '');
    const n1  = pairData.name1 || '—';
    const n2  = pairData.name2 && pairData.name2 !== '—' ? ` + ${pairData.name2}` : '';

    if (pd.submitted) {
      submitted++;
      if (pd.target === 'core') core++;
      if (pd.target === 'body') body++;
      if (pd.target === 'rear') rear++;
    }

    const isCorrect = pd.submitted && pd.target === PHASES[3].correctTarget;
    const correctTd = pd.submitted
      ? `<td class="${isCorrect ? 'cell-correct' : 'cell-wrong'}">${isCorrect ? 'Yes' : 'No'}</td>`
      : '<td class="cell-pending">—</td>';

    const score = pd.stage2Score != null ? pd.stage2Score : '—';

    const tr = document.createElement('tr');
    if (!pd.submitted) tr.classList.add('row-pending');

    tr.innerHTML = `
      <td>${num}</td>
      <td>${n1}${n2}</td>
      <td>${score !== '—' ? score + '/10' : '—'}</td>
      <td>${targetLabel(pd.target)}</td>
      ${correctTd}
    `;
    tbody.appendChild(tr);
  });

  summaryEl.textContent =
    `${submitted} / ${sorted.length} submitted · ` +
    `Core Unit: ${core} · Body Armour: ${body} · Rear Section: ${rear}`;
}
