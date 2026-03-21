// Tax Adviser Arena — Student App Controller

import { ROUNDS, TOTAL_GROUPS, PHASE, COLOURS } from './config.js';
import { initDB, set, get, onValue } from './db.js';
import { simulate } from './simulation.js';
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

  // Restore group from session
  const saved = sessionStorage.getItem('taa_group');
  if (saved) {
    groupNumber = parseInt(saved);
    $('groupSelect').value = groupNumber;
    $('btnJoin').disabled = false;
  }

  // Listen for game state changes
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
  $('taxSlider').addEventListener('input', onTaxSliderChange);
  $('justification').addEventListener('input', onJustificationInput);
  $('btnSubmit').addEventListener('click', submitAnswer);

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

  showScreen('waiting');
  $('waitingTitle').textContent = 'You\'re In!';
  $('waitingMessage').textContent = 'Waiting for the teacher to start Round 1…';
}

// ── Game State Polling ──
function pollGameState() {
  // Listen to game state
  onValue('game', (state) => {
    if (!state) return;
    const newRound = state.currentRound || 0;
    const newPhase = state.phase || PHASE.LOBBY;

    if (newRound !== currentRound || newPhase !== currentPhase) {
      currentRound = newRound;
      currentPhase = newPhase;
      handleStateChange();
    }
  });

  // Fallback: poll every 3s if onValue doesn't fire
  setInterval(async () => {
    const state = await get('game');
    if (!state) return;
    const newRound = state.currentRound || 0;
    const newPhase = state.phase || PHASE.LOBBY;

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
    // Game over — show final leaderboard
    await showFinalResults();
    return;
  }

  const round = ROUNDS[currentRound];
  if (!round) return;

  if (currentPhase === PHASE.SUBMIT) {
    // Check if already submitted this round
    const existing = await get(`submissions/${currentRound}/${groupNumber}`);
    if (existing) {
      showSubmittedScreen(existing);
    } else {
      setupSubmitScreen(round);
    }
  } else if (currentPhase === PHASE.CLOSED) {
    // Submissions closed, waiting for reveal
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
    $('targetText').textContent = `🎯 Revenue target: Raise at least ${round.revenueTargetLabel} in tax revenue`;
    $('targetBox').hidden = false;
  } else if (round.isSubsidy) {
    $('targetText').textContent = `🎯 ${round.quantityTargetLabel}. Budget: ${round.subsidyBudgetLabel}`;
    $('targetBox').hidden = false;
  }

  if (round.secondaryTarget) {
    $('secondaryTargetText').textContent = `⚠️ ${round.secondaryTarget.label}`;
    $('secondaryTargetText').hidden = false;
  } else {
    $('secondaryTargetText').hidden = true;
  }

  // S/D Preview (original curves only)
  drawSDDiagram($('sdPreview'), round, 0, {});

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
    onTaxSliderChange(); // update display
  } else {
    $('taxSliderLabel').textContent = 'Set your tax rate';
    onTaxSliderChange();
  }

  // Burden prediction
  const bGroup = $('burdenPredictionGroup');
  if (round.hasBurdenPrediction) {
    bGroup.hidden = false;
    $('burdenSlider').value = 50;
    $('burdenValue').textContent = '50%';
    if (round.burdenPredictionLabel) {
      $('burdenSliderLabel').textContent = round.burdenPredictionLabel;
    } else {
      $('burdenSliderLabel').textContent = 'Predict: what % of this tax will consumers bear?';
    }
  } else {
    bGroup.hidden = true;
  }

  // Reset form
  $('justification').value = '';
  $('charCount').textContent = '0';
  $('btnSubmit').disabled = true;
  $('submitHint').textContent = 'Fill in the justification to unlock the submit button.';

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

  if (round.isSubsidy) {
    $('taxValue').textContent = `$${Math.abs(val).toFixed(2)}`;
    $('taxUnit').textContent = round.unit;
  } else {
    $('taxValue').textContent = `$${val.toFixed(2)}`;
    $('taxUnit').textContent = round.unit;
  }
}

function onJustificationInput() {
  const len = $('justification').value.trim().length;
  $('charCount').textContent = len;
  const enough = len >= 10;
  $('btnSubmit').disabled = !enough;
  $('submitHint').textContent = enough ? 'Ready to submit!' : `At least 10 characters needed (${10 - len} more)`;
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
      // Auto-submit if justification is filled, otherwise just close
      if ($('justification').value.trim().length >= 10) {
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
  // For subsidy round, store as negative
  if (round.isSubsidy) {
    taxRate = -Math.abs(taxRate);
  }

  const submission = {
    group: groupNumber,
    round: currentRound,
    taxRate: taxRate,
    justification: $('justification').value.trim(),
    timestamp: new Date().toISOString(),
  };

  if (round.hasBurdenPrediction) {
    submission.burdenPrediction = parseInt($('burdenSlider').value);
  }

  // Disable submit button
  $('btnSubmit').disabled = true;
  $('btnSubmit').textContent = 'Submitting…';

  try {
    await set(`submissions/${currentRound}/${groupNumber}`, submission);
    showSubmittedScreen(submission);
  } catch (e) {
    console.error('Submit failed:', e);
    // Save locally for retry
    localStorage.setItem(`taa_backup_${currentRound}_${groupNumber}`, JSON.stringify(submission));
    $('btnSubmit').disabled = false;
    $('btnSubmit').textContent = 'Retry Submit';
    $('submitHint').textContent = 'Submission failed — saved locally. Tap to retry.';
  }

  clearInterval(timerInterval);
}

function showSubmittedScreen(submission) {
  showScreen('submitted');
  const round = ROUNDS[currentRound];
  let summary = `<p><strong>Tax rate:</strong> $${Math.abs(submission.taxRate).toFixed(2)} ${round?.unit || ''}</p>`;
  if (submission.burdenPrediction != null) {
    summary += `<p><strong>Consumer burden prediction:</strong> ${submission.burdenPrediction}%</p>`;
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

  // Animate S/D diagram
  drawSDDiagram($('sdReveal'), round, taxRate, {
    showShift: true,
    showRevenue: true,
    showBurden: true,
    showLabels: true,
  });

  // Results grid
  $('resultTaxRate').textContent = `$${Math.abs(taxRate).toFixed(2)}`;
  $('resultPc').textContent = `$${result.newEquilibrium.Pc.toFixed(2)}`;
  $('resultPs').textContent = `$${result.newEquilibrium.Ps.toFixed(2)}`;
  $('resultQt').textContent = result.newEquilibrium.Q.toFixed(1);

  if (round.isSubsidy) {
    $('resultRevenue').textContent = `$${result.govCost.toFixed(2)} cost`;
    $('resultTarget').textContent = round.subsidyBudgetLabel;
  } else {
    $('resultRevenue').textContent = `$${result.revenue.toFixed(2)}`;
    $('resultTarget').textContent = round.revenueTargetLabel;
  }

  // Burden bar
  drawBurdenBar($('burdenBarCanvas'), result.consumerBurdenPct);

  // Prediction section
  const predSection = $('predictionSection');
  if (round.hasBurdenPrediction && submission.burdenPrediction != null) {
    predSection.hidden = false;
    $('predictedBurden').textContent = `${submission.burdenPrediction}%`;
    $('actualBurden').textContent = `${result.consumerBurdenPct}%`;

    const error = Math.abs(submission.burdenPrediction - result.consumerBurdenPct);
    let accuracy;
    if (error <= 5) accuracy = '🎯 Spot on!';
    else if (error <= 15) accuracy = '👍 Close!';
    else if (error <= 30) accuracy = '🤔 A bit off…';
    else accuracy = '😮 Surprised? Think about elasticity!';
    $('predictionAccuracy').textContent = accuracy;
  } else {
    predSection.hidden = true;
  }

  // Score
  const scoreResult = scoreSubmission(round, submission, result);
  $('roundScore').textContent = scoreResult.total;
  $('roundScoreMax').textContent = `/ ${scoreResult.maxPossible} (auto) + 20 (justification)`;
}

// ── Final Results ──
async function showFinalResults() {
  showScreen('final');

  // Gather all scores
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

  // Show this group's position
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
