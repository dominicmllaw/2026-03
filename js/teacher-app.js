// Tax Adviser Arena — Teacher Dashboard Controller

import { ROUNDS, TOTAL_GROUPS, PHASE, COLOURS } from './config.js';
import { initDB, set, get, getChildren, onValue, resetGame } from './db.js';
import { simulate } from './simulation.js';
import { scoreSubmission, calculateLeaderboard } from './scoring.js';
import {
  drawSDDiagram, renderScatterPlot, renderLeaderboard,
  renderBurdenComparison, drawBurdenBar,
} from './charts.js';

// ── State ──
let currentRound = 0;
let currentPhase = PHASE.LOBBY;
let allScores = {}; // { groupNum: { 1: score, 2: score, ... } }
let manualScores = {}; // { groupNum: { 1: score, ... } }
let pollTimer = null;

const $ = (id) => document.getElementById(id);

// ── Init ──
async function init() {
  await initDB();
  bindEvents();
  bindTabs();

  // Load existing game state
  const state = await get('game');
  if (state) {
    currentRound = state.currentRound || 0;
    currentPhase = state.phase || PHASE.LOBBY;
  }
  updateUI();

  // Start polling for submissions
  startPolling();
}

function bindEvents() {
  $('btnStartRound').addEventListener('click', startRound);
  $('btnCloseSubmissions').addEventListener('click', closeSubmissions);
  $('btnRevealResults').addEventListener('click', revealResults);
  $('btnNextRound').addEventListener('click', nextRound);
  $('btnEndGame').addEventListener('click', endGame);
  $('btnReset').addEventListener('click', async () => {
    if (confirm('Reset the entire game? All data will be lost.')) {
      await resetGame();
      currentRound = 0;
      currentPhase = PHASE.LOBBY;
      allScores = {};
      updateUI();
    }
  });

  const saveBtn = $('btnSaveManualScores');
  if (saveBtn) saveBtn.addEventListener('click', saveManualScores);
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
  if (nextR > 4) return;

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

async function revealResults() {
  currentPhase = PHASE.REVEAL;
  await set('game/phase', PHASE.REVEAL);

  // Calculate and display results
  const round = ROUNDS[currentRound];
  const submissions = await getChildren(`submissions/${currentRound}`) || {};

  // Run simulation for each group
  const results = {};
  for (const [gNum, sub] of Object.entries(submissions)) {
    const simResult = simulate(round, sub.taxRate);
    const score = scoreSubmission(round, sub, simResult);
    results[gNum] = { submission: sub, simResult, score };

    // Store score
    if (!allScores[gNum]) allScores[gNum] = {};
    allScores[gNum][currentRound] = score.total;
  }

  // Save scores to DB
  await set(`scores`, allScores);

  // Update visualisations
  renderResultsVisuals(round, results);
  updateUI();
}

async function nextRound() {
  if (currentRound >= 4) {
    endGame();
    return;
  }
  currentPhase = PHASE.LOBBY;
  await set('game', {
    currentRound,
    phase: PHASE.LOBBY,
  });
  updateUI();
}

async function endGame() {
  currentRound = 5; // signals game over
  currentPhase = PHASE.REVEAL;
  await set('game', { currentRound: 5, phase: PHASE.REVEAL });
  renderFinalLeaderboard();
  updateUI();
}

// ── UI Updates ──

function updateUI() {
  const round = ROUNDS[currentRound] || null;

  // Phase indicator
  if (currentRound === 0) {
    $('phaseIndicator').textContent = 'Lobby';
  } else if (currentRound > 4) {
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

  // Control buttons
  $('btnStartRound').disabled = currentPhase === PHASE.SUBMIT || currentPhase === PHASE.CLOSED;
  $('btnCloseSubmissions').disabled = currentPhase !== PHASE.SUBMIT;
  $('btnRevealResults').disabled = currentPhase !== PHASE.CLOSED;
  $('btnNextRound').disabled = currentPhase !== PHASE.REVEAL || currentRound > 4;

  // Update start button label
  const nextR = currentRound === 0 ? 1 : (currentPhase === PHASE.REVEAL ? currentRound + 1 : currentRound);
  if (nextR <= 4) {
    const nr = ROUNDS[nextR];
    $('btnStartRound').textContent = `Start Round ${nextR}${nr ? ': ' + nr.subtitle : ''}`;
  } else {
    $('btnStartRound').textContent = 'All rounds complete';
    $('btnStartRound').disabled = true;
    $('btnEndGame').hidden = false;
  }

  // Show end game button if on round 4 reveal
  if (currentRound === 4 && currentPhase === PHASE.REVEAL) {
    $('btnEndGame').hidden = false;
  }

  // Control title
  $('controlRoundTitle').textContent = round
    ? `Round ${round.id}: ${round.subtitle}`
    : 'Game Controls';

  // Manual scoring
  if (currentPhase === PHASE.REVEAL && currentRound >= 1 && currentRound <= 4) {
    setupManualScoring();
  } else {
    $('manualScoringCard').hidden = true;
  }

  // Class stats
  $('classStats').hidden = currentPhase !== PHASE.REVEAL;

  // Draw current S/D diagram for projection
  if (round && currentPhase === PHASE.REVEAL) {
    // Show the "average" tax rate S/D diagram
    drawSDDiagram($('teacherSD'), round, 0, { showShift: false });
  } else if (round) {
    drawSDDiagram($('teacherSD'), round, 0, {});
  }
}

// ── Polling ──

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pollSubmissions, 2000);
}

async function pollSubmissions() {
  if (currentRound < 1 || currentRound > 4) return;
  if (currentPhase !== PHASE.SUBMIT && currentPhase !== PHASE.CLOSED) return;

  const submissions = await getChildren(`submissions/${currentRound}`) || {};
  const count = Object.keys(submissions).length;

  // Update counter
  $('counterText').textContent = `${count} / ${TOTAL_GROUPS} groups submitted`;
  $('counterFill').style.width = `${(count / TOTAL_GROUPS) * 100}%`;

  // Update table
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

  // ── S/D Diagram — show with average tax rate ──
  const avgTax = entries.reduce((s, [, r]) => s + r.submission.taxRate, 0) / entries.length;
  drawSDDiagram($('teacherSD'), round, avgTax, {
    showShift: true,
    showRevenue: true,
    showBurden: true,
    showLabels: true,
  });

  // ── Scatter Plot ──
  const scatterData = entries.map(([gNum, r]) => ({
    group: parseInt(gNum),
    x: Math.abs(r.submission.taxRate),
    y: r.simResult.revenue,
  }));

  renderScatterPlot($('scatterChart'), scatterData, {
    xLabel: round.isSubsidy ? 'Subsidy Rate ($)' : 'Tax Rate ($)',
    yLabel: round.isSubsidy ? 'Government Cost ($)' : 'Government Revenue ($)',
    targetY: round.revenueTarget,
    onClickGroup: (g) => highlightGroup(g),
  });

  // ── Leaderboard ──
  const leaderboard = calculateLeaderboard(allScores);
  renderLeaderboard($('leaderboardChart'), leaderboard);

  // ── Burden Comparison (if applicable) ──
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

  // ── Outlier Flags ──
  const outlierHtml = findOutliers(round, results);
  $('outlierFlags').innerHTML = outlierHtml;

  // ── Class Stats ──
  $('classStats').hidden = false;
  $('statAvgTax').textContent = `$${Math.abs(avgTax).toFixed(2)}`;
  const avgRevenue = entries.reduce((s, [, r]) => s + r.simResult.revenue, 0) / entries.length;
  $('statAvgRevenue').textContent = `$${avgRevenue.toFixed(2)}`;
  // Burden is the same for all groups (depends on elasticity, not tax rate)
  const sampleResult = entries[0][1].simResult;
  $('statAvgBurden').textContent = `Consumer ${sampleResult.consumerBurdenPct}% / Producer ${sampleResult.producerBurdenPct}%`;
}

function findOutliers(round, results) {
  const entries = Object.entries(results);
  if (entries.length < 3) return '';

  const flags = [];

  // Highest revenue
  const byRevenue = [...entries].sort(([, a], [, b]) => b.simResult.revenue - a.simResult.revenue);
  const highest = byRevenue[0];
  flags.push(`<div class="outlier">🏆 <strong>Group ${highest[0]}</strong> raised the most revenue: $${highest[1].simResult.revenue.toFixed(2)}</div>`);

  // Biggest price increase
  const byPrice = [...entries].sort(([, a], [, b]) => b.simResult.priceChange - a.simResult.priceChange);
  const priciest = byPrice[0];
  if (priciest[1].simResult.priceChange > 0) {
    flags.push(`<div class="outlier">📈 <strong>Group ${priciest[0]}</strong> caused the biggest price increase: +$${priciest[1].simResult.priceChange.toFixed(2)}</div>`);
  }

  // Most surprised (burden prediction, if applicable)
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
        flags.push(`<div class="outlier">😮 <strong>Group ${mostSurprised[0]}</strong> was most surprised — predicted ${mostSurprised[1].submission.burdenPrediction}%, actual was ${mostSurprised[1].simResult.consumerBurdenPct}%!</div>`);
      }
    }
  }

  // Lowest tax rate with decent revenue
  const lowestTax = [...entries].sort(([, a], [, b]) => Math.abs(a.submission.taxRate) - Math.abs(b.submission.taxRate));
  const lt = lowestTax[0];
  if (round.revenueTarget && lt[1].simResult.revenue >= round.revenueTarget * 0.8) {
    flags.push(`<div class="outlier">🎯 <strong>Group ${lt[0]}</strong> used the lowest tax ($${Math.abs(lt[1].submission.taxRate).toFixed(2)}) and still nearly hit the target!</div>`);
  }

  return flags.join('');
}

function highlightGroup(groupNum) {
  // Show a brief highlight
  const flag = document.createElement('div');
  flag.className = 'highlight-flag';
  flag.innerHTML = `<strong>Group ${groupNum}</strong> selected — ask them to explain their strategy!`;
  $('outlierFlags').prepend(flag);
  setTimeout(() => flag.remove(), 5000);
}

// ── Manual Scoring ──

function setupManualScoring() {
  $('manualScoringCard').hidden = false;
  const container = $('manualScoringInputs');
  container.innerHTML = '';

  for (let g = 1; g <= TOTAL_GROUPS; g++) {
    const div = document.createElement('div');
    div.className = 'manual-score-row';
    const existing = manualScores[g]?.[currentRound] || '';
    div.innerHTML = `
      <label>G${g}:</label>
      <input type="number" class="manual-score-input" data-group="${g}" min="0" max="20" value="${existing}" placeholder="0–20">
    `;
    container.appendChild(div);
  }
}

async function saveManualScores() {
  const inputs = document.querySelectorAll('.manual-score-input');
  inputs.forEach(input => {
    const g = input.dataset.group;
    const val = parseInt(input.value) || 0;
    if (!manualScores[g]) manualScores[g] = {};
    manualScores[g][currentRound] = Math.min(20, Math.max(0, val));

    // Add to allScores
    if (allScores[g] && allScores[g][currentRound] != null) {
      allScores[g][currentRound] += manualScores[g][currentRound];
    }
  });

  await set('scores', allScores);
  await set('manualScores', manualScores);

  // Refresh leaderboard
  const leaderboard = calculateLeaderboard(allScores);
  renderLeaderboard($('leaderboardChart'), leaderboard);

  alert('Manual scores saved!');
}

// ── Final Leaderboard ──

async function renderFinalLeaderboard() {
  const leaderboard = calculateLeaderboard(allScores);
  renderLeaderboard($('leaderboardChart'), leaderboard);

  // Switch to leaderboard tab
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
