// Tax Adviser Arena — Student App Controller

import { ROUNDS, TOTAL_GROUPS, PHASE, COLOURS } from './config.js';
import { initDB, set, get, onValue } from './db.js';
import { simulate, computeOptimalRate, generateSchedule } from './simulation.js';
import { scoreSubmission, calculateLeaderboard } from './scoring.js';
import { drawSDDiagram, drawBurdenBar, renderLeaderboard } from './charts.js';

// ── State ──
let groupNumber = null;
let currentRound = 0;
let currentPhase = PHASE.LOBBY;
let timerInterval = null;

// ── DOM refs ──
const $ = (id) => document.getElementById(id);
const screens = {
  lobby: $('screenLobby'),
  intro: $('screenIntro'),
  waiting: $('screenWaiting'),
  submit: $('screenSubmit'),
  submitted: $('screenSubmitted'),
  reveal: $('screenReveal'),
  final: $('screenFinal'),
};

// ── Initialisation ──
async function init() {
  await initDB();
  populateGroupDropdown();
  bindEvents();

  const saved = sessionStorage.getItem('taa_group');
  if (saved) {
    groupNumber = parseInt(saved);
    $('groupSelect').value = groupNumber;
    $('btnJoin').disabled = false;
  }

  pollGameState();
}

function populateGroupDropdown() {
  const sel = $('groupSelect');
  for (let i = 1; i <= TOTAL_GROUPS; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Group ${i}`;
    sel.appendChild(opt);
  }
}

function bindEvents() {
  $('groupSelect').addEventListener('change', (e) => {
    $('btnJoin').disabled = !e.target.value;
  });

  $('btnJoin').addEventListener('click', joinGame);
  $('btnEnterWaiting').addEventListener('click', enterWaitingRoom);
  $('practiceSlider').addEventListener('input', onPracticeSliderChange);
  $('taxSlider').addEventListener('input', onTaxSliderChange);
  $('btnSubmit').addEventListener('click', submitAnswer);

  // Structured justification dropdowns (Issue 7)
  $('justDropdownA').addEventListener('change', checkJustificationComplete);
  $('justDropdownB').addEventListener('change', checkJustificationComplete);

  const burdenSlider = $('burdenSlider');
  if (burdenSlider) {
    burdenSlider.addEventListener('input', () => {
      $('burdenValue').textContent = burdenSlider.value + '%';
    });
  }
}

// ── Navigation ──
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (screens[name]) screens[name].classList.add('active');
}

// ── Join Game ──
function joinGame() {
  groupNumber = parseInt($('groupSelect').value);
  if (!groupNumber) return;

  sessionStorage.setItem('taa_group', groupNumber);
  $('groupBadge').hidden = false;
  $('groupNum').textContent = groupNumber;

  // Show intro/tutorial screen (Issue 13)
  showScreen('intro');
  setupPracticeRound();
}

// ── Practice Round (Issue 13) ──
const PRACTICE_CONFIG = { a: 100, b: 1, c: 0, d: 1 };
// Equilibrium: Q₀ = 100/2 = 50, P₀ = 100 - 50 = 50

function setupPracticeRound() {
  drawSDDiagram($('practiceSD'), PRACTICE_CONFIG, 0, {});
  renderScheduleTable(
    $('practiceScheduleBody'),
    generateSchedule({ ...PRACTICE_CONFIG, schedulePrices: null }, 0),
    false
  );
  $('practiceValue').textContent = '$0';
  $('practiceResults').innerHTML = '<p>Move the slider to see how a tax affects the market.</p>';
}

function onPracticeSliderChange() {
  const t = parseInt($('practiceSlider').value);
  $('practiceValue').textContent = `$${t}`;

  drawSDDiagram($('practiceSD'), PRACTICE_CONFIG, t, {
    showShift: t > 0,
    showRevenue: t > 0,
    showBurden: t > 0,
    showLabels: t > 0,
  });

  if (t > 0) {
    const result = simulate(PRACTICE_CONFIG, t);
    const schedRows = generateSchedule({ ...PRACTICE_CONFIG, schedulePrices: null }, t);
    $('practiceScheduleHead').innerHTML = '<tr><th>P ($)</th><th>Qd</th><th>Qs</th><th>Qs after tax</th></tr>';
    renderScheduleTable($('practiceScheduleBody'), schedRows, true);
    $('practiceResults').innerHTML = `
      <div class="practice-result-grid">
        <div><strong>Consumer price:</strong> $${result.newEquilibrium.Pc}</div>
        <div><strong>Producer price:</strong> $${result.newEquilibrium.Ps}</div>
        <div><strong>New quantity:</strong> ${result.newEquilibrium.Q} units</div>
        <div><strong>Tax revenue:</strong> $${result.revenue}</div>
        <div><strong>Consumer burden:</strong> ${result.consumerBurdenPct}%</div>
        <div><strong>Producer burden:</strong> ${result.producerBurdenPct}%</div>
      </div>
    `;
  } else {
    $('practiceScheduleHead').innerHTML = '<tr><th>P ($)</th><th>Qd (units)</th><th>Qs (units)</th></tr>';
    renderScheduleTable(
      $('practiceScheduleBody'),
      generateSchedule({ ...PRACTICE_CONFIG, schedulePrices: null }, 0),
      false
    );
    $('practiceResults').innerHTML = '<p>Move the slider to see how a tax affects the market.</p>';
  }
}

function enterWaitingRoom() {
  showScreen('waiting');
  $('waitingTitle').textContent = 'You\'re In!';
  $('waitingMessage').textContent = 'Waiting for the teacher to start Round 1…';
}

// Called when teacher clicks "Skip Tutorial" — jumps to waiting
function skipToWaiting() {
  if (screens.intro.classList.contains('active')) {
    enterWaitingRoom();
  }
}

// ── Game State Polling ──
function pollGameState() {
  onValue('game', (state) => {
    if (!state) return;
    const newRound = state.currentRound || 0;
    const newPhase = state.phase || PHASE.LOBBY;

    // Issue 13: teacher skip tutorial
    if (state.skipTutorial) skipToWaiting();

    if (newRound !== currentRound || newPhase !== currentPhase) {
      currentRound = newRound;
      currentPhase = newPhase;
      handleStateChange();
    }
  });

  setInterval(async () => {
    const state = await get('game');
    if (!state) return;
    const newRound = state.currentRound || 0;
    const newPhase = state.phase || PHASE.LOBBY;

    if (state.skipTutorial) skipToWaiting();

    if (newRound !== currentRound || newPhase !== currentPhase) {
      currentRound = newRound;
      currentPhase = newPhase;
      handleStateChange();
    }
  }, 3000);
}

async function handleStateChange() {
  if (!groupNumber) return;

  if (currentRound === 0) {
    showScreen('waiting');
    return;
  }

  if (currentRound > 4) {
    await showFinalResults();
    return;
  }

  const round = ROUNDS[currentRound];
  if (!round) return;

  if (currentPhase === PHASE.SUBMIT) {
    const existing = await get(`submissions/${currentRound}/${groupNumber}`);
    if (existing) {
      showSubmittedScreen(existing);
    } else {
      setupSubmitScreen(round);
    }
  } else if (currentPhase === PHASE.CLOSED) {
    const existing = await get(`submissions/${currentRound}/${groupNumber}`);
    if (existing) {
      showSubmittedScreen(existing);
    } else {
      showScreen('submitted');
      $('submittedSummary').innerHTML = '<p class="warning">You did not submit in time!</p>';
    }
  } else if (currentPhase === PHASE.REVEAL) {
    await showRevealScreen(round);
  }
}

// ── Submit Screen Setup ──
function setupSubmitScreen(round) {
  showScreen('submit');

  // Header
  $('roundBadge').textContent = round.isSubsidy ? 'Bonus Round' : `Round ${round.id}`;
  $('roundTitle').textContent = round.title;
  $('roundSubtitle').textContent = round.subtitle;

  // Scenario
  $('scenarioText').textContent = round.scenario;
  $('demandClue').textContent = round.demandClue;
  $('supplyClue').textContent = round.supplyClue;

  // Target
  if (round.revenueTarget != null) {
    $('targetText').textContent = `Revenue target: Raise at least ${round.revenueTargetLabel} in tax revenue`;
    $('targetBox').hidden = false;
  } else if (round.isSubsidy) {
    $('targetText').textContent = `${round.quantityTargetLabel}. Budget: ${round.subsidyBudgetLabel}`;
    $('targetBox').hidden = false;
  }

  if (round.secondaryTarget) {
    $('secondaryTargetText').textContent = round.secondaryTarget.label;
    $('secondaryTargetText').hidden = false;
  } else {
    $('secondaryTargetText').hidden = true;
  }

  // S/D Preview
  drawSDDiagram($('sdPreview'), round, 0, {});

  // Schedule table — before tax (Issue 2)
  renderScheduleTable($('scheduleBeforeBody'), generateSchedule(round, 0), false);

  // Slider setup
  const slider = $('taxSlider');
  slider.min = round.sliderMin;
  slider.max = round.sliderMax;
  slider.step = round.sliderStep;
  slider.value = round.sliderDefault;
  $('sliderMinLabel').textContent = `$${round.sliderMin}`;
  $('sliderMaxLabel').textContent = `$${round.sliderMax}`;

  if (round.isSubsidy) {
    $('taxSliderLabel').textContent = 'Set your subsidy rate';
  } else {
    $('taxSliderLabel').textContent = 'Set your tax rate';
  }
  onTaxSliderChange();

  // Burden prediction (Issue 9: subsidy terminology)
  const bGroup = $('burdenPredictionGroup');
  if (round.hasBurdenPrediction) {
    bGroup.hidden = false;
    $('burdenSlider').value = 50;
    $('burdenValue').textContent = '50%';
    if (round.isSubsidy) {
      $('burdenSliderLabel').textContent = 'We predict consumers receive ___% of the subsidy benefit';
      $('burdenUnit').textContent = 'consumer benefit';
    } else if (round.burdenPredictionLabel) {
      $('burdenSliderLabel').textContent = round.burdenPredictionLabel;
      $('burdenUnit').textContent = 'consumer burden';
    } else {
      $('burdenSliderLabel').textContent = 'Predict: what % of this tax will consumers bear?';
      $('burdenUnit').textContent = 'consumer burden';
    }
  } else {
    bGroup.hidden = true;
  }

  // Structured justification (Issue 7)
  $('justDropdownA').value = '';
  $('justDropdownB').value = '';
  $('justElaboration').value = '';
  $('justTaxWord').textContent = round.isSubsidy ? ' subsidy' : ' tax';
  $('btnSubmit').disabled = true;
  $('submitHint').textContent = 'Select both dropdowns above to unlock the submit button.';

  // Timer
  if (round.timeLimit) {
    startTimer(round.timeLimit);
  } else {
    $('timerBar').hidden = true;
    clearInterval(timerInterval);
  }
}

function onTaxSliderChange() {
  const val = parseFloat($('taxSlider').value);
  const round = ROUNDS[currentRound];
  if (!round) return;

  $('taxValue').textContent = `$${Math.abs(val).toFixed(2)}`;
  $('taxUnit').textContent = round.unit;
}

// Issue 7: check if both dropdowns are selected
function checkJustificationComplete() {
  const a = $('justDropdownA').value;
  const b = $('justDropdownB').value;
  const ready = a !== '' && b !== '';
  $('btnSubmit').disabled = !ready;
  $('submitHint').textContent = ready ? 'Ready to submit!' : 'Select both dropdowns above to unlock the submit button.';
}

function startTimer(seconds) {
  $('timerBar').hidden = false;
  let remaining = seconds;
  updateTimerDisplay(remaining, seconds);

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    remaining--;
    updateTimerDisplay(remaining, seconds);
    if (remaining <= 0) {
      clearInterval(timerInterval);
      if ($('justDropdownA').value && $('justDropdownB').value) {
        submitAnswer();
      }
    }
  }, 1000);
}

function updateTimerDisplay(remaining, total) {
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  $('timerText').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  $('timerFill').style.width = `${(remaining / total) * 100}%`;
  if (remaining <= 15) {
    $('timerBar').classList.add('timer-warning');
  }
}

// ── Submission ──
async function submitAnswer() {
  const round = ROUNDS[currentRound];
  if (!round || !groupNumber) return;

  let taxRate = parseFloat($('taxSlider').value);
  if (round.isSubsidy) {
    taxRate = -Math.abs(taxRate);
  }

  // Structured justification (Issue 7)
  const justLevel = $('justDropdownA').value;
  const justReason = $('justDropdownB').value;
  const justText = $('justElaboration').value.trim();

  const submission = {
    group: groupNumber,
    round: currentRound,
    taxRate: taxRate,
    justLevel,
    justReason,
    justText,
    // Legacy field for backwards compat
    justification: `We set a ${justLevel} ${round.isSubsidy ? 'subsidy' : 'tax'} because ${justReasonLabel(justReason)}.${justText ? ' ' + justText : ''}`,
    timestamp: new Date().toISOString(),
  };

  if (round.hasBurdenPrediction) {
    submission.burdenPrediction = parseInt($('burdenSlider').value);
  }

  $('btnSubmit').disabled = true;
  $('btnSubmit').textContent = 'Submitting…';

  try {
    await set(`submissions/${currentRound}/${groupNumber}`, submission);
    showSubmittedScreen(submission);
  } catch (e) {
    console.error('Submit failed:', e);
    localStorage.setItem(`taa_backup_${currentRound}_${groupNumber}`, JSON.stringify(submission));
    $('btnSubmit').disabled = false;
    $('btnSubmit').textContent = 'Retry Submit';
    $('submitHint').textContent = 'Submission failed — saved locally. Tap to retry.';
  }

  clearInterval(timerInterval);
}

function justReasonLabel(val) {
  const labels = {
    demand_more_elastic: 'demand is more elastic than supply',
    demand_less_elastic: 'demand is less elastic than supply',
    roughly_equal: 'the elasticity of demand roughly equals that of supply',
  };
  return labels[val] || val;
}

function showSubmittedScreen(submission) {
  showScreen('submitted');
  const round = ROUNDS[currentRound];
  let summary = `<p><strong>${round?.isSubsidy ? 'Subsidy' : 'Tax'} rate:</strong> $${Math.abs(submission.taxRate).toFixed(2)} ${round?.unit || ''}</p>`;
  if (submission.burdenPrediction != null) {
    const label = round?.isSubsidy ? 'Consumer benefit prediction' : 'Consumer burden prediction';
    summary += `<p><strong>${label}:</strong> ${submission.burdenPrediction}%</p>`;
  }
  summary += `<p><strong>Justification:</strong> "${submission.justification}"</p>`;
  $('submittedSummary').innerHTML = summary;
}

// ── Results Reveal ──
async function showRevealScreen(round) {
  showScreen('reveal');

  $('revealRoundBadge').textContent = round.isSubsidy ? 'Bonus Round' : `Round ${round.id}`;
  $('revealTitle').textContent = `${round.title} — Results`;

  // Get this group's submission
  const submission = await get(`submissions/${currentRound}/${groupNumber}`);
  if (!submission) {
    $('resultsGrid').innerHTML = '<p class="warning">No submission recorded for this round.</p>';
    return;
  }

  const taxRate = submission.taxRate;
  const result = simulate(round, taxRate);

  // Model answer (Issue 1)
  const optimalRate = computeOptimalRate(round);
  const displayOptimal = round.isSubsidy ? optimalRate : optimalRate;
  $('modelOptimalRate').textContent = `$${displayOptimal.toFixed(2)}`;
  $('yourRate').textContent = `$${Math.abs(taxRate).toFixed(2)}`;
  $('modelAnswerBanner').hidden = false;

  // S/D diagram
  drawSDDiagram($('sdReveal'), round, taxRate, {
    showShift: true,
    showRevenue: true,
    showBurden: true,
    showLabels: true,
    isSubsidy: round.isSubsidy,
  });

  // Schedule table — after tax/subsidy (Issue 2)
  const afterSchedule = generateSchedule(round, taxRate);
  const afterHead = $('scheduleAfterHead');
  const colName = round.isSubsidy ? 'Qs after subsidy (units)' : 'Qs after tax (units)';
  afterHead.innerHTML = `<tr><th>P ($)</th><th>Qd (units)</th><th>Qs (units)</th><th>${colName}</th></tr>`;
  $('scheduleAfterTitle').textContent = round.isSubsidy
    ? 'After Subsidy: Demand & Supply Schedule'
    : 'After Tax: Demand & Supply Schedule';
  renderScheduleTable($('scheduleAfterBody'), afterSchedule, true);

  // Results grid (Issue 9: subsidy terminology)
  $('resultTaxRateLabel').textContent = round.isSubsidy ? 'Your Subsidy Rate' : 'Your Tax Rate';
  $('resultTaxRate').textContent = `$${Math.abs(taxRate).toFixed(2)}`;
  $('resultPc').textContent = `$${result.newEquilibrium.Pc.toFixed(2)}`;
  $('resultPs').textContent = `$${result.newEquilibrium.Ps.toFixed(2)}`;
  $('resultQt').textContent = result.newEquilibrium.Q.toFixed(1);

  if (round.isSubsidy) {
    $('resultRevenueLabel').textContent = 'Gov Expenditure';
    $('resultRevenue').textContent = `$${result.govCost.toFixed(2)}`;
    $('resultTarget').textContent = round.subsidyBudgetLabel;
  } else {
    $('resultRevenueLabel').textContent = 'Gov Revenue';
    $('resultRevenue').textContent = `$${result.revenue.toFixed(2)}`;
    $('resultTarget').textContent = round.revenueTargetLabel;
  }

  // Burden / benefit bar (Issue 9)
  $('burdenSectionTitle').textContent = round.isSubsidy ? 'Subsidy Benefit Split' : 'Tax Burden Split';
  drawBurdenBar($('burdenBarCanvas'), result.consumerBurdenPct, round.isSubsidy);

  // Prediction section
  const predSection = $('predictionSection');
  if (round.hasBurdenPrediction && submission.burdenPrediction != null) {
    predSection.hidden = false;
    $('predictedBurden').textContent = `${submission.burdenPrediction}%`;
    $('actualBurden').textContent = `${result.consumerBurdenPct}%`;

    const error = Math.abs(submission.burdenPrediction - result.consumerBurdenPct);
    let accuracy;
    if (error <= 5) accuracy = 'Spot on!';
    else if (error <= 15) accuracy = 'Close!';
    else if (error <= 30) accuracy = 'A bit off…';
    else accuracy = 'Surprised? Think about elasticity!';
    $('predictionAccuracy').textContent = accuracy;
  } else {
    predSection.hidden = true;
  }

  // Score
  const scoreResult = scoreSubmission(round, submission, result);
  $('roundScore').textContent = scoreResult.total;
  $('roundScoreMax').textContent = `/ ${scoreResult.maxPossible} (auto) + 20 (justification)`;
}

// ── Schedule table renderer (Issue 2) ──
function renderScheduleTable(tbody, rows, showAfter) {
  tbody.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    if (row.isEquilibrium) tr.classList.add('eq-row');
    if (showAfter && row.isNewEquilibrium) tr.classList.add('new-eq-row');

    let cells = `<td>${row.p}</td><td>${row.qd}</td><td>${row.qs}</td>`;
    if (showAfter && row.qsAfter !== undefined) {
      cells += `<td>${row.qsAfter}</td>`;
    }
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
}

// ── Final Results ──
async function showFinalResults() {
  showScreen('final');

  const allScores = {};
  for (let r = 1; r <= 4; r++) {
    const round = ROUNDS[r];
    if (!round) continue;
    const submissions = await get(`submissions/${r}`) || {};
    for (const [gNum, sub] of Object.entries(submissions)) {
      if (!allScores[gNum]) allScores[gNum] = {};
      const result = simulate(round, sub.taxRate);
      const score = scoreSubmission(round, sub, result);
      allScores[gNum][r] = score.total;
    }
  }

  const leaderboard = calculateLeaderboard(allScores);
  renderLeaderboard($('finalLeaderboard'), leaderboard);

  const myEntry = leaderboard.find(e => e.group === groupNumber);
  const myRank = leaderboard.indexOf(myEntry) + 1;
  if (myEntry) {
    $('finalScore').innerHTML = `
      <h3>Your Group: #${myRank} of ${leaderboard.length}</h3>
      <p class="final-total">Total: ${myEntry.total} points</p>
    `;
  }
}

// ── Start ──
init();
