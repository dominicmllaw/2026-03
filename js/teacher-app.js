// Tax Adviser Arena — Teacher Dashboard Controller

import { ROUNDS, TOTAL_GROUPS, TOTAL_ROUNDS, PHASE, COLOURS } from './config.js';
import { initDB, set, get, getChildren, onValue, resetGame } from './db.js';
import { simulate, computeOptimalRate, generateSchedule } from './simulation.js';
import { scoreSubmission, calculateLeaderboard } from './scoring.js';
import {
  drawSDDiagram, renderScatterPlot, renderLeaderboard,
  renderBurdenComparison, drawBurdenBar,
} from './charts.js';

// ── State ──
let currentRound = 0;
let currentPhase = PHASE.LOBBY;
let allScores = {};
let manualScores = {};
let pollTimer = null;
let revealResults = {}; // { groupNum: { submission, simResult, score } }

const $ = (id) => document.getElementById(id);

// ── Init ──
async function init() {
  await initDB();
  bindEvents();
  bindTabs();

  // Issue 18: Restore state from DB on refresh
  const state = await get('game');
  if (state) {
    currentRound = state.currentRound || 0;
    currentPhase = state.phase || PHASE.LOBBY;

    // If we're in reveal phase, restore reveal results
    if (currentPhase === PHASE.REVEAL && currentRound >= 1 && currentRound <= TOTAL_ROUNDS) {
      const round = ROUNDS[currentRound];
      const submissions = await getChildren(`submissions/${currentRound}`) || {};
      revealResults = {};
      for (const [gNum, sub] of Object.entries(submissions)) {
        const simResult = simulate(round, sub.taxRate);
        const score = scoreSubmission(round, sub, simResult);
        revealResults[gNum] = { submission: sub, simResult, score };
        if (!allScores[gNum]) allScores[gNum] = {};
        allScores[gNum][currentRound] = score.total;
      }
    }

    // Restore scores from previous rounds
    const savedScores = await get('scores');
    if (savedScores) allScores = savedScores;
    const savedManual = await get('manualScores');
    if (savedManual) manualScores = savedManual;
  }

  updateUI();

  // If reveal phase was restored, re-render visuals
  if (currentPhase === PHASE.REVEAL && currentRound >= 1 && currentRound <= TOTAL_ROUNDS) {
    const round = ROUNDS[currentRound];
    if (round && Object.keys(revealResults).length > 0) {
      renderResultsVisuals(round, revealResults);
      setupGroupSelector(revealResults);
      setupScoringUI(round, revealResults);
    }
  }

  startPolling();
}

function bindEvents() {
  $('btnStartRound').addEventListener('click', startRound);
  $('btnCloseSubmissions').addEventListener('click', closeSubmissions);
  $('btnRevealResults').addEventListener('click', doRevealResults);
  $('btnNextRound').addEventListener('click', nextRound);
  $('btnEndGame').addEventListener('click', endGame);
  $('btnSkipTutorial').addEventListener('click', async () => {
    await set('game/skipTutorial', true);
    $('btnSkipTutorial').disabled = true;
    $('btnSkipTutorial').textContent = 'Tutorial Skipped';
  });
  $('btnReset').addEventListener('click', async () => {
    if (confirm('Reset the entire game? All data will be lost.')) {
      await resetGame();
      currentRound = 0;
      currentPhase = PHASE.LOBBY;
      allScores = {};
      manualScores = {};
      revealResults = {};
      updateUI();
    }
  });

  const saveBtn = $('btnSaveManualScores');
  if (saveBtn) saveBtn.addEventListener('click', saveManualScores);

  // Group viewer selector (Issue 5)
  $('groupViewSelect').addEventListener('change', onGroupViewChange);
}

function bindTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      const content = document.getElementById('tab' + target.charAt(0).toUpperCase() + target.slice(1));
      if (content) content.classList.add('active');
    });
  });
}

// ── Game Flow Controls ──

async function startRound() {
  const nextR = currentRound + 1;
  if (nextR > TOTAL_ROUNDS) return;

  currentRound = nextR;
  currentPhase = PHASE.SUBMIT;

  await set('game', {
    currentRound,
    phase: currentPhase,
    startedAt: new Date().toISOString(),
  });

  updateUI();
  clearSubmissionTable();
}

async function closeSubmissions() {
  currentPhase = PHASE.CLOSED;
  await set('game/phase', PHASE.CLOSED);
  updateUI();
}

async function doRevealResults() {
  currentPhase = PHASE.REVEAL;
  await set('game/phase', PHASE.REVEAL);

  const round = ROUNDS[currentRound];
  const submissions = await getChildren(`submissions/${currentRound}`) || {};

  // Run simulation for each group
  revealResults = {};
  for (const [gNum, sub] of Object.entries(submissions)) {
    const simResult = simulate(round, sub.taxRate);
    const score = scoreSubmission(round, sub, simResult);
    revealResults[gNum] = { submission: sub, simResult, score };

    if (!allScores[gNum]) allScores[gNum] = {};
    allScores[gNum][currentRound] = score.total;
  }

  await set('scores', allScores);

  renderResultsVisuals(round, revealResults);
  setupGroupSelector(revealResults);
  setupScoringUI(round, revealResults);
  updateUI();
}

// ── Issue 6 FIX: nextRound was not incrementing currentRound properly ──
// Before: set game with same currentRound → start button label was wrong
// Fix: the start button label now always uses currentRound + 1
async function nextRound() {
  if (currentRound >= TOTAL_ROUNDS) {
    endGame();
    return;
  }
  // Stay on same round number — startRound() will increment
  currentPhase = PHASE.LOBBY;
  await set('game', {
    currentRound,
    phase: PHASE.LOBBY,
  });
  revealResults = {};
  updateUI();
}

async function endGame() {
  currentRound = TOTAL_ROUNDS + 1;
  currentPhase = PHASE.REVEAL;
  await set('game', { currentRound: TOTAL_ROUNDS + 1, phase: PHASE.REVEAL });
  renderFinalLeaderboard();
  updateUI();
}

// ── UI Updates ──

function updateUI() {
  const round = ROUNDS[currentRound] || null;

  // Phase indicator
  if (currentRound === 0) {
    $('phaseIndicator').textContent = 'Lobby';
  } else if (currentRound > TOTAL_ROUNDS) {
    $('phaseIndicator').textContent = 'Game Over';
  } else {
    const phaseLabels = {
      [PHASE.SUBMIT]: 'Submitting',
      [PHASE.CLOSED]: 'Closed',
      [PHASE.REVEAL]: 'Reveal',
      [PHASE.LOBBY]: 'Between Rounds',
    };
    $('phaseIndicator').textContent = `Round ${currentRound} — ${phaseLabels[currentPhase] || ''}`;
  }

  // Control buttons — Issue 6 fix: stricter enable conditions
  $('btnStartRound').disabled = currentPhase !== PHASE.LOBBY || currentRound >= TOTAL_ROUNDS;
  $('btnCloseSubmissions').disabled = currentPhase !== PHASE.SUBMIT;
  $('btnRevealResults').disabled = currentPhase !== PHASE.CLOSED;
  $('btnNextRound').disabled = currentPhase !== PHASE.REVEAL || currentRound > TOTAL_ROUNDS;

  // Start button label — Issue 6 fix: always show next round number
  const nextR = currentRound + 1;
  if (nextR <= TOTAL_ROUNDS) {
    const nr = ROUNDS[nextR];
    $('btnStartRound').textContent = `Start Round ${nextR}${nr ? ': ' + nr.subtitle : ''}`;
  } else {
    $('btnStartRound').textContent = 'All rounds complete';
    $('btnStartRound').disabled = true;
    $('btnEndGame').hidden = false;
  }

  if (currentRound === TOTAL_ROUNDS && currentPhase === PHASE.REVEAL) {
    $('btnEndGame').hidden = false;
  }

  // Control title
  $('controlRoundTitle').textContent = round
    ? `Round ${round.id}: ${round.subtitle}`
    : 'Game Controls';

  // Scoring UI visibility
  if (currentPhase === PHASE.REVEAL && currentRound >= 1 && currentRound <= TOTAL_ROUNDS) {
    $('scoringCard').hidden = false;
  } else {
    $('scoringCard').hidden = true;
  }

  // Class stats
  $('classStats').hidden = currentPhase !== PHASE.REVEAL;

  // Group selector visibility
  const isRoundReveal = currentPhase === PHASE.REVEAL && currentRound >= 1 && currentRound <= TOTAL_ROUNDS;
  $('groupSelectorBar').hidden = !isRoundReveal;
  $('dataTablePanel').hidden = !isRoundReveal;
  $('teacherScheduleSection').hidden = !isRoundReveal;

  // Draw current S/D diagram
  if (round && currentPhase === PHASE.REVEAL) {
    // Show model answer by default
    showModelAnswer(round);
  } else if (round) {
    drawSDDiagram($('teacherSD'), round, 0, {});
    $('dataTablePanel').hidden = true;
    $('teacherScheduleSection').hidden = true;
  }
}

// ── Model Answer Display (Issue 1) ──

function showModelAnswer(round) {
  const optRate = computeOptimalRate(round);
  const result = simulate(round, optRate);

  // Diagram
  drawSDDiagram($('teacherSD'), round, optRate, {
    showShift: true,
    showRevenue: true,
    showBurden: true,
    showLabels: true,
  });

  // Data table
  $('dataTableTitle').textContent = `Model Answer — Optimal Tax: $${optRate.toFixed(2)}`;
  renderDataTable(round, result, optRate);

  // Schedule tables
  renderTeacherSchedules(round, optRate);

  // Diagram info
  $('diagramInfo').textContent = `Model answer: optimal tax rate = $${optRate.toFixed(2)}`;
}

function showGroupResult(round, groupNum) {
  const entry = revealResults[groupNum];
  if (!entry) return;

  const { submission, simResult } = entry;
  const taxRate = submission.taxRate;

  // Diagram
  drawSDDiagram($('teacherSD'), round, taxRate, {
    showShift: true,
    showRevenue: true,
    showBurden: true,
    showLabels: true,
  });

  // Data table
  $('dataTableTitle').textContent = `Group ${groupNum} — Tax: $${Math.abs(taxRate).toFixed(2)}`;
  renderDataTable(round, simResult, taxRate);

  // Schedule tables
  renderTeacherSchedules(round, taxRate);

  // Info
  $('diagramInfo').textContent = `Group ${groupNum}: tax = $${Math.abs(taxRate).toFixed(2)} | Justification: ${submission.justification || '—'}`;
}

// ── Data Table (Issue 5C) ──

function renderDataTable(round, result, taxRate) {
  const tbody = $('dataTableBody');
  const rows = [];

  rows.push(['Original Price (P\u2080)', `$${result.freeMarket.P.toFixed(2)}`]);
  rows.push(['Original Quantity (Q\u2080)', `${result.freeMarket.Q.toFixed(1)} units`]);
  rows.push(['Tax per unit (t)', `$${Math.abs(taxRate).toFixed(2)}`]);
  rows.push(['New Consumer Price (P\u2081)', `$${result.newEquilibrium.Pc.toFixed(2)}`]);
  rows.push(['New Producer Price (P\u2082)', `$${result.newEquilibrium.Ps.toFixed(2)}`]);
  rows.push(['New Quantity (Q\u2081)', `${result.newEquilibrium.Q.toFixed(1)} units`]);
  rows.push(['Tax Revenue (t \u00d7 Q\u2081)', `$${result.revenue.toFixed(2)}`]);
  rows.push(['Consumer Tax Burden (P\u2081 \u2212 P\u2080) \u00d7 Q\u2081', `$${result.consumerBurdenDollars.toFixed(2)}`]);
  rows.push(['Producer Tax Burden (P\u2080 \u2212 P\u2082) \u00d7 Q\u2081', `$${result.producerBurdenDollars.toFixed(2)}`]);

  tbody.innerHTML = rows.map(([label, val]) =>
    `<tr><td class="dt-label">${label}</td><td class="dt-value">${val}</td></tr>`
  ).join('');
}

// ── Schedule Tables for Teacher (Issue 2) ──

function renderTeacherSchedules(round, taxRate) {
  // Before tax
  const beforeRows = generateSchedule(round, 0);
  const beforeBody = $('teacherScheduleBeforeBody');
  beforeBody.innerHTML = '';
  beforeRows.forEach(row => {
    const tr = document.createElement('tr');
    if (row.isEquilibrium) tr.classList.add('eq-row');
    tr.innerHTML = `<td>${row.p}</td><td>${row.qd}</td><td>${row.qs}</td>`;
    beforeBody.appendChild(tr);
  });

  // After tax
  const afterRows = generateSchedule(round, taxRate);
  const afterBody = $('teacherScheduleAfterBody');
  afterBody.innerHTML = '';
  $('teacherScheduleAfterHead').innerHTML = '<tr><th>P ($)</th><th>Qd (units)</th><th>Qs (units)</th><th>Qs after tax (units)</th></tr>';
  $('teacherScheduleAfterTitle').textContent = 'After Tax';
  afterRows.forEach(row => {
    const tr = document.createElement('tr');
    if (row.isEquilibrium) tr.classList.add('eq-row');
    if (row.isNewEquilibrium) tr.classList.add('new-eq-row');
    tr.innerHTML = `<td>${row.p}</td><td>${row.qd}</td><td>${row.qs}</td><td>${row.qsAfter !== undefined ? row.qsAfter : ''}</td>`;
    afterBody.appendChild(tr);
  });
}

// ── Group Selector (Issue 5A) ──

function setupGroupSelector(results) {
  const sel = $('groupViewSelect');
  sel.innerHTML = '<option value="model">Model Answer</option>';

  const groups = Object.keys(results).sort((a, b) => parseInt(a) - parseInt(b));
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = `Group ${g}`;
    sel.appendChild(opt);
  });

  $('groupSelectorBar').hidden = false;
  sel.value = 'model';
}

function onGroupViewChange() {
  const val = $('groupViewSelect').value;
  const round = ROUNDS[currentRound];
  if (!round) return;

  if (val === 'model') {
    showModelAnswer(round);
  } else {
    showGroupResult(round, val);
  }
}

// ── Scoring UI (Issue 8) ──

function setupScoringUI(round, results) {
  const container = $('scoringRows');
  container.innerHTML = '';

  const sorted = Object.entries(results).sort(([a], [b]) => parseInt(a) - parseInt(b));

  sorted.forEach(([gNum, { submission }]) => {
    const row = document.createElement('div');
    row.className = 'scoring-row';
    row.dataset.group = gNum;

    const existing = manualScores[gNum]?.[currentRound];

    row.innerHTML = `
      <div class="scoring-group-label">G${gNum}</div>
      <div class="scoring-justification" title="Click to expand">
        <span class="scoring-just-summary">${escapeHtml(submission.justification?.substring(0, 60) || '—')}</span>
        <div class="scoring-just-full" hidden>${escapeHtml(submission.justification || '—')}</div>
      </div>
      <div class="scoring-buttons">
        <button class="score-btn ${existing === 0 ? 'active' : ''}" data-group="${gNum}" data-score="0">0</button>
        <button class="score-btn ${existing === 10 ? 'active' : ''}" data-group="${gNum}" data-score="10">10</button>
        <button class="score-btn ${existing === 20 ? 'active' : ''}" data-group="${gNum}" data-score="20">20</button>
      </div>
    `;

    // Toggle full justification
    const justDiv = row.querySelector('.scoring-justification');
    justDiv.addEventListener('click', () => {
      const full = justDiv.querySelector('.scoring-just-full');
      const summary = justDiv.querySelector('.scoring-just-summary');
      if (full.hidden) {
        full.hidden = false;
        summary.hidden = true;
      } else {
        full.hidden = true;
        summary.hidden = false;
      }
    });

    // Score buttons
    row.querySelectorAll('.score-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const g = btn.dataset.group;
        const s = parseInt(btn.dataset.score);

        // Toggle: if already active, deselect
        const wasActive = btn.classList.contains('active');
        row.querySelectorAll('.score-btn').forEach(b => b.classList.remove('active'));
        if (!wasActive) {
          btn.classList.add('active');
          if (!manualScores[g]) manualScores[g] = {};
          manualScores[g][currentRound] = s;
        } else {
          if (manualScores[g]) delete manualScores[g][currentRound];
        }

        // Auto-save
        autoSaveScore(g, s, wasActive);
      });
    });

    container.appendChild(row);
  });
}

async function autoSaveScore(groupNum, score, wasRemoved) {
  // Update allScores with manual score
  if (!allScores[groupNum]) allScores[groupNum] = {};

  // Get the base auto-score
  const entry = revealResults[groupNum];
  if (entry) {
    const baseScore = entry.score.total;
    const manual = wasRemoved ? 0 : score;
    allScores[groupNum][currentRound] = baseScore + manual;
  }

  await set('scores', allScores);
  await set('manualScores', manualScores);

  // Refresh leaderboard
  const leaderboard = calculateLeaderboard(allScores);
  renderLeaderboard($('leaderboardChart'), leaderboard);
}

async function saveManualScores() {
  // Batch save (in case auto-save missed anything)
  for (const [g, rounds] of Object.entries(manualScores)) {
    if (rounds[currentRound] != null && allScores[g]) {
      const entry = revealResults[g];
      if (entry) {
        allScores[g][currentRound] = entry.score.total + rounds[currentRound];
      }
    }
  }

  await set('scores', allScores);
  await set('manualScores', manualScores);

  const leaderboard = calculateLeaderboard(allScores);
  renderLeaderboard($('leaderboardChart'), leaderboard);
}

// ── Polling ──

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pollSubmissions, 2000);
}

async function pollSubmissions() {
  if (currentRound < 1 || currentRound > TOTAL_ROUNDS) return;
  if (currentPhase !== PHASE.SUBMIT && currentPhase !== PHASE.CLOSED) return;

  const submissions = await getChildren(`submissions/${currentRound}`) || {};
  const count = Object.keys(submissions).length;

  $('counterText').textContent = `${count} / ${TOTAL_GROUPS} groups submitted`;
  $('counterFill').style.width = `${(count / TOTAL_GROUPS) * 100}%`;

  updateSubmissionTable(submissions);
}

function clearSubmissionTable() {
  $('submissionTableBody').innerHTML = '';
  $('counterText').textContent = `0 / ${TOTAL_GROUPS} groups submitted`;
  $('counterFill').style.width = '0%';
}

function updateSubmissionTable(submissions) {
  const tbody = $('submissionTableBody');
  tbody.innerHTML = '';

  const sorted = Object.entries(submissions)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));

  for (const [gNum, sub] of sorted) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>G${gNum}</strong></td>
      <td>$${Math.abs(sub.taxRate).toFixed(2)}</td>
      <td class="justification-cell">${escapeHtml(sub.justification?.substring(0, 80) || '—')}</td>
    `;
    tbody.appendChild(tr);
  }
}

// ── Results Visualisations ──

function renderResultsVisuals(round, results) {
  const entries = Object.entries(results);
  if (entries.length === 0) return;

  // Scatter Plot
  const scatterData = entries.map(([gNum, r]) => ({
    group: parseInt(gNum),
    x: Math.abs(r.submission.taxRate),
    y: r.simResult.revenue,
  }));

  renderScatterPlot($('scatterChart'), scatterData, {
    xLabel: 'Tax Rate ($)',
    yLabel: 'Government Revenue ($)',
    targetY: round.revenueTarget,
    onClickGroup: (g) => {
      $('groupViewSelect').value = g.toString();
      onGroupViewChange();
      // Switch to diagram tab
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelector('[data-tab="diagram"]').classList.add('active');
      $('tabDiagram').classList.add('active');
    },
  });

  // Leaderboard
  const leaderboard = calculateLeaderboard(allScores);
  renderLeaderboard($('leaderboardChart'), leaderboard);

  // Burden Comparison
  if (round.hasBurdenPrediction) {
    const burdenData = entries
      .filter(([, r]) => r.submission.burdenPrediction != null)
      .map(([gNum, r]) => ({
        group: parseInt(gNum),
        predicted: r.submission.burdenPrediction,
        actual: r.simResult.consumerBurdenPct,
      }))
      .sort((a, b) => a.group - b.group);

    renderBurdenComparison($('burdenCompareChart'), burdenData);
  }

  // Outlier Flags
  $('outlierFlags').innerHTML = findOutliers(round, results);

  // Class Stats
  $('classStats').hidden = false;
  const avgTax = entries.reduce((s, [, r]) => s + Math.abs(r.submission.taxRate), 0) / entries.length;
  $('statAvgTax').textContent = `$${avgTax.toFixed(2)}`;
  const avgRevenue = entries.reduce((s, [, r]) => s + r.simResult.revenue, 0) / entries.length;
  $('statAvgRevenue').textContent = `$${avgRevenue.toFixed(2)}`;
  const sampleResult = entries[0][1].simResult;
  $('statAvgBurden').textContent = `Consumer burden ${sampleResult.consumerBurdenPct}% / Producer burden ${sampleResult.producerBurdenPct}%`;
}

function findOutliers(round, results) {
  const entries = Object.entries(results);
  if (entries.length < 3) return '';

  const flags = [];

  const byRevenue = [...entries].sort(([, a], [, b]) => b.simResult.revenue - a.simResult.revenue);
  const highest = byRevenue[0];
  flags.push(`<div class="outlier"><strong>Group ${highest[0]}</strong> raised the most revenue: $${highest[1].simResult.revenue.toFixed(2)}</div>`);

  const byPrice = [...entries].sort(([, a], [, b]) => Math.abs(b.simResult.priceChange) - Math.abs(a.simResult.priceChange));
  const priciest = byPrice[0];
  if (Math.abs(priciest[1].simResult.priceChange) > 0) {
    flags.push(`<div class="outlier"><strong>Group ${priciest[0]}</strong> caused the biggest price increase: $${Math.abs(priciest[1].simResult.priceChange).toFixed(2)}</div>`);
  }

  if (round.hasBurdenPrediction) {
    const withPrediction = entries.filter(([, r]) => r.submission.burdenPrediction != null);
    if (withPrediction.length > 0) {
      const bySurprise = [...withPrediction].sort(([, a], [, b]) => {
        const errA = Math.abs(a.submission.burdenPrediction - a.simResult.consumerBurdenPct);
        const errB = Math.abs(b.submission.burdenPrediction - b.simResult.consumerBurdenPct);
        return errB - errA;
      });
      const mostSurprised = bySurprise[0];
      const err = Math.abs(mostSurprised[1].submission.burdenPrediction - mostSurprised[1].simResult.consumerBurdenPct);
      if (err > 15) {
        flags.push(`<div class="outlier"><strong>Group ${mostSurprised[0]}</strong> was most surprised — predicted ${mostSurprised[1].submission.burdenPrediction}%, actual was ${mostSurprised[1].simResult.consumerBurdenPct}%!</div>`);
      }
    }
  }

  return flags.join('');
}

// ── Final Leaderboard ──

async function renderFinalLeaderboard() {
  const leaderboard = calculateLeaderboard(allScores);
  renderLeaderboard($('leaderboardChart'), leaderboard);

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="leaderboard"]').classList.add('active');
  $('tabLeaderboard').classList.add('active');
}

// ── Helpers ──

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Start ──
init();
