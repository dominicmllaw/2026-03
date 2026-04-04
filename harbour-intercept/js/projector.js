// HARBOUR INTERCEPT — Projector App
import { db, ref, set, get, onValue, remove } from './firebase-config.js';
import { PHASES } from './round-data.js';

// ── State ─────────────────────────────────────────────────────────────────
let currentPhase        = 'standby';
let revealActive        = false;
let revealAnimationDone = false;
let armourHealth        = 3;    // 3 layers; cracks on each correct majority
let pairsData           = {};

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupTeacherPanel();
  subscribeGame();
  subscribePairs();

  document.addEventListener('keydown', e => {
    if (e.key === 't' || e.key === 'T') togglePanel();
  });

  updateArmour();
});

function togglePanel() {
  document.getElementById('teacher-panel').classList.toggle('hidden');
}

// ── Teacher panel ─────────────────────────────────────────────────────────
function setupTeacherPanel() {
  document.getElementById('btn-phase0').addEventListener('click', () => setPhase('standby'));
  document.getElementById('btn-phase1').addEventListener('click', () => setPhase('phase1'));
  document.getElementById('btn-phase2').addEventListener('click', () => setPhase('phase2'));
  document.getElementById('btn-phase3').addEventListener('click', () => setPhase('phase3'));
  document.getElementById('btn-reveal').addEventListener('click', triggerReveal);
  document.getElementById('btn-reset').addEventListener('click',  resetGame);
}

function setPhase(phase) {
  set(ref(db, 'game/currentPhase'),    phase);
  set(ref(db, 'game/revealTriggered'), false);
}

function triggerReveal() {
  set(ref(db, 'game/revealTriggered'), true);
}

async function resetGame() {
  if (!confirm('Reset ALL game data? This cannot be undone.')) return;
  await set(ref(db, 'game'), { currentPhase: 'standby', revealTriggered: false });
  await remove(ref(db, 'pairs'));
  armourHealth        = 3;
  revealActive        = false;
  revealAnimationDone = false;
  updateArmour();
  document.getElementById('reveal-results').classList.add('hidden');
  document.getElementById('retaliation-overlay').classList.remove('active');
  document.getElementById('submission-counter').textContent = '';
}

// ── Game state subscription ───────────────────────────────────────────────
function subscribeGame() {
  onValue(ref(db, 'game'), snapshot => {
    const game     = snapshot.val() || {};
    const phase    = game.currentPhase    || 'standby';
    const revealed = game.revealTriggered || false;

    currentPhase = phase;

    // On reveal toggle
    if (!revealed && revealActive) {
      // Reveal was reset — clear display
      revealActive        = false;
      revealAnimationDone = false;
      document.getElementById('reveal-results').classList.add('hidden');
      document.getElementById('retaliation-overlay').classList.remove('active');
    }

    revealActive = revealed;

    updatePhaseDisplay(phase);
    updateAnalystDisplay(phase);
    updateSubmissionCounter();

    if (revealed && !revealAnimationDone) {
      showRevealResults();
    }
  });
}

function updatePhaseDisplay(phase) {
  const el = document.getElementById('phase-indicator');
  const labels = {
    standby: 'STANDBY — PREPARING TO LAUNCH',
    phase1:  'PHASE 1 — ROUND A: INELASTIC DEMAND',
    phase2:  'PHASE 2 — ROUND B: ELASTIC DEMAND',
    phase3:  'PHASE 3 — FINAL INTERCEPT',
  };
  el.textContent = labels[phase] || phase.toUpperCase();
  el.className   = `phase-${phase}`;
}

function updateAnalystDisplay(phase) {
  const el = document.getElementById('analyst-display');
  if (phase === 'phase3') {
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// ── Pairs subscription ────────────────────────────────────────────────────
function subscribePairs() {
  onValue(ref(db, 'pairs'), snapshot => {
    pairsData = snapshot.val() || {};
    updateSubmissionCounter();
    if (revealActive && !revealAnimationDone) {
      showRevealResults();
    } else if (revealActive) {
      updateResultDisplay();  // keep counts live without re-triggering animation
    }
  });
}

function updateSubmissionCounter() {
  const el = document.getElementById('submission-counter');
  if (!currentPhase.startsWith('phase')) { el.textContent = ''; return; }

  const phaseKey = currentPhase;
  const total    = Math.max(Object.keys(pairsData).length, 1);
  const submitted = Object.values(pairsData).filter(
    p => p[phaseKey]?.submitted === true
  ).length;

  el.textContent = `${submitted} / ${total} pairs submitted`;
}

// ── Reveal ────────────────────────────────────────────────────────────────
function showRevealResults() {
  revealAnimationDone = true;
  const result = computeResult();
  if (!result) return;

  updateResultDisplay();

  if (result.majorityCorrect) {
    crackArmour();
  } else {
    bossRetaliate();
  }
}

function updateResultDisplay() {
  const result = computeResult();
  if (!result) return;

  const revealEl = document.getElementById('reveal-results');
  revealEl.classList.remove('hidden');

  document.getElementById('result-a').innerHTML =
    `<span class="result-label">${result.labelA}</span>` +
    `<span class="result-number">${result.countA}</span>`;
  document.getElementById('result-b').innerHTML =
    `<span class="result-label">${result.labelB}</span>` +
    `<span class="result-number">${result.countB}</span>`;
}

function computeResult() {
  if (!currentPhase.startsWith('phase')) return null;

  const all = Object.values(pairsData);

  if (currentPhase === 'phase3') {
    const countA = all.filter(p => p.phase3?.raidChoice === 'A').length;
    const countB = all.filter(p => p.phase3?.raidChoice === 'B').length;
    return {
      countA, countB,
      labelA: 'RAID A',
      labelB: 'RAID B',
      majorityCorrect: PHASES[3].correctRaid === 'A' ? countA >= countB : countB >= countA,
    };
  }

  const num     = parseInt(currentPhase.slice(-1));
  const phase   = PHASES[num];
  const countA  = all.filter(p => p[currentPhase]?.target === 'consumer').length;
  const countB  = all.filter(p => p[currentPhase]?.target === 'producer').length;
  const correct = phase.correctTarget;

  return {
    countA, countB,
    labelA: 'CONSUMER SHIELD',
    labelB: 'PRODUCER ARMOUR',
    majorityCorrect:
      (correct === 'consumer' && countA >= countB) ||
      (correct === 'producer' && countB >= countA),
  };
}

// ── Armour / Boss animations ──────────────────────────────────────────────
function updateArmour() {
  for (let i = 1; i <= 3; i++) {
    const layer = document.getElementById(`armour-${i}`);
    if (!layer) continue;
    layer.className = `armour-layer ${i <= armourHealth ? 'armour-intact' : 'armour-cracked'}`;
  }
}

function crackArmour() {
  if (armourHealth <= 0) return;
  const layer = document.getElementById(`armour-${armourHealth}`);
  if (!layer) return;

  layer.classList.add('armour-cracking');
  setTimeout(() => {
    layer.classList.remove('armour-cracking');
    layer.classList.replace('armour-intact', 'armour-cracked');
    armourHealth--;
  }, 950);
}

function bossRetaliate() {
  const overlay = document.getElementById('retaliation-overlay');
  overlay.classList.remove('active');
  // Force reflow so the animation restarts
  void overlay.offsetWidth;
  overlay.classList.add('active');
}
