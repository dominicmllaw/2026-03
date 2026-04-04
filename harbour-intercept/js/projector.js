// HARBOUR INTERCEPT — Projector App
import { db, ref, set, onValue, remove } from './firebase-config.js';
import { PHASES } from './round-data.js';

// ── State ─────────────────────────────────────────────────────────────────
let currentPhase        = 'standby';
let revealActive        = false;
let revealAnimationDone = false;
let pairsData           = {};

// Total HP = 15 pairs × 3 phases × 60% win threshold = 27
// Each correct answer across any phase deducts 1 HP.
const BOSS_MAX_HP = Math.round(15 * 3 * 0.6);   // 27

// ── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupTeacherPanel();
  subscribeGame();
  subscribePairs();

  document.addEventListener('keydown', e => {
    if (e.key === 't' || e.key === 'T') togglePanel();
  });

  updateHPBar();
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
  await set(ref(db, 'game'), { currentPhase: 'standby', revealTriggered: false, resetAt: Date.now() });
  await remove(ref(db, 'pairs'));
  pairsData           = {};
  revealActive        = false;
  revealAnimationDone = false;
  updateHPBar();
  document.getElementById('reveal-results').classList.add('hidden');
  document.getElementById('retaliation-overlay').classList.remove('active');
  const eg = document.getElementById('endgame-overlay');
  eg.classList.add('hidden');
  eg.classList.remove('victory', 'defeat');
  document.getElementById('submission-counter').textContent = '';
}

// ── Game state subscription ───────────────────────────────────────────────
function subscribeGame() {
  onValue(ref(db, 'game'), snapshot => {
    const game     = snapshot.val() || {};
    const phase    = game.currentPhase    || 'standby';
    const revealed = game.revealTriggered || false;

    currentPhase = phase;

    if (!revealed && revealActive) {
      revealActive        = false;
      revealAnimationDone = false;
      document.getElementById('reveal-results').classList.add('hidden');
      document.getElementById('retaliation-overlay').classList.remove('active');
    }

    revealActive = revealed;

    updatePhaseDisplay(phase);
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
    phase3:  'PHASE 3 — FINAL INTERCEPT: PED = 0',
  };
  el.textContent = labels[phase] || phase.toUpperCase();
  el.className   = `phase-${phase}`;
}

// ── Pairs subscription ────────────────────────────────────────────────────
function subscribePairs() {
  onValue(ref(db, 'pairs'), snapshot => {
    pairsData = snapshot.val() || {};
    updateSubmissionCounter();
    updateHPBar();
    if (revealActive && !revealAnimationDone) {
      showRevealResults();
    } else if (revealActive) {
      updateResultDisplay();
    }
  });
}

function updateSubmissionCounter() {
  const el = document.getElementById('submission-counter');
  if (!currentPhase.startsWith('phase')) { el.textContent = ''; return; }

  const total     = Math.max(Object.keys(pairsData).length, 1);
  const submitted = Object.values(pairsData).filter(
    p => p[currentPhase]?.submitted === true
  ).length;

  el.textContent = `${submitted} / ${total} pairs submitted`;
}

// ── HP Bar ────────────────────────────────────────────────────────────────
function computeHP() {
  let correct = 0;
  Object.values(pairsData).forEach(pair => {
    if (pair.phase1?.targetCorrect === true) correct++;
    if (pair.phase2?.targetCorrect === true) correct++;
    if (pair.phase3?.targetCorrect === true) correct++;
  });
  return Math.max(0, BOSS_MAX_HP - correct);
}

function updateHPBar() {
  const hp  = computeHP();
  const pct = BOSS_MAX_HP > 0 ? hp / BOSS_MAX_HP * 100 : 100;
  document.getElementById('hp-bar-fill').style.width = pct + '%';
  document.getElementById('hp-value').textContent    = `${hp} / ${BOSS_MAX_HP}`;
  document.getElementById('hp-bar-fill').className   =
    pct > 60 ? 'hp-high' : pct > 30 ? 'hp-mid' : 'hp-low';
}

// ── Reveal ────────────────────────────────────────────────────────────────
function showRevealResults() {
  revealAnimationDone = true;
  const result = computeResult();
  if (!result) return;

  updateResultDisplay();
  updateHPBar();   // animate HP bar dropping on correct reveals

  if (!result.majorityCorrect) {
    bossRetaliate();
  }

  if (currentPhase === 'phase3') {
    setTimeout(checkEndGame, 2500);
  }
}

function updateResultDisplay() {
  const result = computeResult();
  if (!result) return;

  document.getElementById('reveal-results').classList.remove('hidden');
  document.getElementById('result-a').innerHTML =
    `<span class="result-label">${result.labelA}</span>` +
    `<span class="result-number">${result.countA}</span>`;
  document.getElementById('result-b').innerHTML =
    `<span class="result-label">${result.labelB}</span>` +
    `<span class="result-number">${result.countB}</span>`;
}

function computeResult() {
  if (!currentPhase.startsWith('phase')) return null;

  const num    = parseInt(currentPhase.slice(-1));
  const phase  = PHASES[num];
  const all    = Object.values(pairsData);
  const countA = all.filter(p => p[currentPhase]?.target === 'consumer').length;
  const countB = all.filter(p => p[currentPhase]?.target === 'producer').length;
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

// ── Boss retaliation ──────────────────────────────────────────────────────
function bossRetaliate() {
  const overlay = document.getElementById('retaliation-overlay');
  overlay.classList.remove('active');
  void overlay.offsetWidth;   // force reflow so animation restarts
  overlay.classList.add('active');
}

// ── End game (shown after Phase 3 reveal) ─────────────────────────────────
function checkEndGame() {
  const hp      = computeHP();
  const overlay = document.getElementById('endgame-overlay');
  overlay.classList.remove('hidden', 'victory', 'defeat');

  if (hp <= 0) {
    document.getElementById('endgame-title').textContent    = 'HARBOUR SECURED';
    document.getElementById('endgame-subtitle').textContent =
      'The class exposed the tax burden. Mission complete.';
    overlay.classList.add('victory');
  } else {
    document.getElementById('endgame-title').textContent    = 'HARBOUR LOST';
    document.getElementById('endgame-subtitle').textContent =
      `Boss survives with ${hp} HP. More pairs need to intercept correctly next time.`;
    overlay.classList.add('defeat');
  }
}
