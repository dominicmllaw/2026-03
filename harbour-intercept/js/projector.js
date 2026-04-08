// HARBOUR INTERCEPT — Projector App
import { db, ref, set, onValue, remove } from './firebase-config.js';
import { PHASES } from './round-data.js';

// ── State ─────────────────────────────────────────────────────────────────
let currentPhase        = 'standby';
let revealActive        = false;
let revealAnimationDone = false;
let pairsData           = {};
let revealedPhases      = {};   // tracks which phases have been revealed

const STAGE_DURATION = (2 * 60 + 30) * 1000;   // 2 minutes 30 seconds
let projectorBlinkInterval = null;

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
  if (phase !== 'standby') {
    set(ref(db, 'game/stageStartedAt'), Date.now());
  } else {
    stopProjectorBlink();
  }
}

function triggerReveal() {
  // Mark current phase as revealed (so HP updates only now)
  if (currentPhase.startsWith('phase')) {
    revealedPhases[currentPhase] = true;
    set(ref(db, `game/revealedPhases/${currentPhase}`), true);
  }
  set(ref(db, 'game/revealTriggered'), true);
  stopProjectorBlink();
}

async function resetGame() {
  if (!confirm('Reset ALL game data? This cannot be undone.')) return;
  revealedPhases = {};
  stopProjectorBlink();
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
  const egAmmo   = document.getElementById('endgame-ammo-summary');
  const egPilots = document.getElementById('endgame-best-pilots');
  if (egAmmo)   { egAmmo.classList.add('hidden');   egAmmo.innerHTML   = ''; }
  if (egPilots) { egPilots.classList.add('hidden'); egPilots.innerHTML = ''; }
  document.getElementById('submission-counter').textContent = '';
  const ammoSection = document.getElementById('ammo-summary');
  if (ammoSection) { ammoSection.classList.add('hidden'); }
  const ammoTbody = document.getElementById('ammo-tbody');
  if (ammoTbody) { ammoTbody.innerHTML = ''; }
}

// ── Game state subscription ───────────────────────────────────────────────
function subscribeGame() {
  onValue(ref(db, 'game'), snapshot => {
    const game         = snapshot.val() || {};
    const phase        = game.currentPhase    || 'standby';
    const revealed     = game.revealTriggered || false;
    const stageStartAt = game.stageStartedAt  || null;

    // Sync revealed phases from Firebase (persists across page reloads)
    revealedPhases = game.revealedPhases || {};

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

    // Drive the projector EVA blink from phase start time
    if (phase !== 'standby' && !revealed && stageStartAt) {
      startProjectorBlinkTimer(stageStartAt);
    } else {
      stopProjectorBlink();
    }

    if (revealed && !revealAnimationDone) {
      showRevealResults();
    }
  });
}

function updatePhaseDisplay(phase) {
  const el = document.getElementById('phase-indicator');
  const labels = {
    standby: 'STANDBY — HOLDING PATTERN',
    phase1:  'ENGAGEMENT 1 — OBJECT X',
    phase2:  'ENGAGEMENT 2 — TARGET Y',
    phase3:  'ENGAGEMENT 3 — THREAT Z',
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
function getBossMaxHP() {
  const n = Object.keys(pairsData).length;
  return n > 0 ? Math.ceil(n * 30 * 0.6) : 0;
}

function computeHP() {
  const maxHP = getBossMaxHP();
  let damage = 0;
  Object.values(pairsData).forEach(pair => {
    [1, 2, 3].forEach(n => {
      // Only count damage from phases that have been revealed
      if (!revealedPhases[`phase${n}`]) return;
      const p = pair[`phase${n}`];
      if (p?.targetCorrect === true) {
        damage += (p.stage2Score ?? 0);
      }
    });
  });
  return Math.max(0, maxHP - damage);
}

function updateHPBar() {
  const maxHP = getBossMaxHP();
  const hp    = computeHP();
  const pct   = maxHP > 0 ? hp / maxHP * 100 : 100;
  document.getElementById('hp-bar-fill').style.width = pct + '%';
  document.getElementById('hp-value').textContent    = maxHP > 0 ? `${hp} / ${maxHP}` : '— / —';
  document.getElementById('hp-bar-fill').className   =
    pct > 60 ? 'hp-high' : pct > 30 ? 'hp-mid' : 'hp-low';
}

// ── Reveal ────────────────────────────────────────────────────────────────
function showRevealResults() {
  revealAnimationDone = true;
  const result = computeResult();
  if (!result) return;

  // Compute damage dealt in this phase before updating bar
  let phaseDamage = 0;
  Object.values(pairsData).forEach(pair => {
    const p = pair[currentPhase];
    if (p?.targetCorrect === true) phaseDamage += (p.stage2Score ?? 0);
  });

  updateResultDisplay();
  updateHPBar();
  updateAmmoTable();

  if (phaseDamage > 0) {
    triggerImpactEffect(phaseDamage);
  }

  if (!result.majorityCorrect) {
    bossRetaliate();
  }

  if (currentPhase === 'phase3') {
    setTimeout(checkEndGame, 2500);
  }
}

function triggerImpactEffect(damage) {
  const flash  = document.getElementById('impact-flash');
  const boss   = document.getElementById('boss-display');
  const popup  = document.getElementById('damage-popup');

  // White flash
  if (flash) {
    flash.classList.add('impact-flash-active');
    setTimeout(() => flash.classList.remove('impact-flash-active'), 300);
  }

  // Boss shake (slight delay so flash hits first)
  if (boss) {
    setTimeout(() => {
      boss.classList.add('boss-shaking');
      setTimeout(() => boss.classList.remove('boss-shaking'), 600);
    }, 150);
  }

  // Floating damage number
  if (popup) {
    setTimeout(() => {
      popup.textContent = `−${damage} HP`;
      popup.classList.remove('active');
      void popup.offsetWidth; // reflow to restart animation
      popup.classList.add('active');
      setTimeout(() => {
        popup.classList.remove('active');
        popup.textContent = '';
      }, 2000);
    }, 200);
  }
}

function updateResultDisplay() {
  const result = computeResult();
  if (!result) return;

  updateAmmoTable();
  document.getElementById('reveal-results').classList.remove('hidden');

  document.getElementById('result-a').innerHTML =
    `<span class="result-label">CORE UNIT 中枢部</span>` +
    `<span class="result-number">${result.countCore}</span>`;
  document.getElementById('result-b').innerHTML =
    `<span class="result-label">BODY ARMOUR 装甲部</span>` +
    `<span class="result-number">${result.countBody}</span>`;
  document.getElementById('result-c').innerHTML =
    `<span class="result-label">REAR SECTION 後部区画</span>` +
    `<span class="result-number">${result.countRear}</span>`;
}

function computeResult() {
  if (!currentPhase.startsWith('phase')) return null;

  const num       = parseInt(currentPhase.slice(-1));
  const phase     = PHASES[num];
  const all       = Object.values(pairsData);
  const countCore = all.filter(p => p[currentPhase]?.target === 'core').length;
  const countBody = all.filter(p => p[currentPhase]?.target === 'body').length;
  const countRear = all.filter(p => p[currentPhase]?.target === 'rear').length;
  const correct   = phase.correctTarget;
  const correctCount =
    correct === 'core' ? countCore :
    correct === 'body' ? countBody : countRear;
  const total = countCore + countBody + countRear;

  return {
    countCore, countBody, countRear,
    majorityCorrect: total > 0 && correctCount >= total / 2,
  };
}

// ── Boss retaliation ──────────────────────────────────────────────────────
function bossRetaliate() {
  const overlay = document.getElementById('retaliation-overlay');
  overlay.classList.remove('active');
  void overlay.offsetWidth;
  overlay.classList.add('active');
}

// ── End game (shown after Engagement 3 reveal) ────────────────────────────
function checkEndGame() {
  const hp      = computeHP();
  const overlay = document.getElementById('endgame-overlay');
  overlay.classList.remove('hidden', 'victory', 'defeat');

  if (hp <= 0) {
    document.getElementById('endgame-title').textContent    = 'ANGEL NEUTRALISED';
    document.getElementById('endgame-subtitle').textContent =
      'The unit successfully identified tax incidence. Mission complete.';
    overlay.classList.add('victory');
  } else {
    document.getElementById('endgame-title').textContent    = 'CONTAINMENT BREACH';
    document.getElementById('endgame-subtitle').textContent =
      `Angel survives with ${hp} HP. More pairs need to intercept correctly next time.`;
    overlay.classList.add('defeat');
  }

  renderEndgameAmmoSummary();
  renderBestPilots();
}

function renderEndgameAmmoSummary() {
  const section  = document.getElementById('endgame-ammo-summary');
  if (!section) return;

  const revealed = [1, 2, 3].filter(n => revealedPhases[`phase${n}`]);
  if (revealed.length === 0) { section.classList.add('hidden'); return; }

  let rows = '';
  revealed.forEach(n => {
    let total = 0, hit = 0, missed = 0;
    Object.values(pairsData).forEach(pair => {
      const p     = pair[`phase${n}`];
      if (!p) return;
      const score = p.stage2Score ?? 0;
      total += score;
      if (p.targetCorrect) hit    += score;
      else                  missed += score;
    });
    rows += `<tr>
      <td>ENG. ${n}</td>
      <td>${total}</td>
      <td class="ammo-hit">${hit}</td>
      <td class="ammo-miss">${missed}</td>
    </tr>`;
  });

  section.classList.remove('hidden');
  section.innerHTML = `
    <div class="eg-section-title">AMMO SUMMARY</div>
    <table class="eg-ammo-table">
      <thead><tr>
        <th>Engagement</th><th>Total</th><th>HIT</th><th>MISSED</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderBestPilots() {
  const section = document.getElementById('endgame-best-pilots');
  if (!section) return;

  // Sum hit ammo across all 3 engagements per pair
  const scores = Object.entries(pairsData).map(([id, pair]) => {
    let totalHit = 0;
    [1, 2, 3].forEach(n => {
      const p = pair[`phase${n}`];
      if (p?.targetCorrect === true) totalHit += (p.stage2Score ?? 0);
    });
    return {
      id,
      num:   parseInt(id.replace('pair', '')),
      name1: pair.name1 || '',
      name2: (pair.name2 && pair.name2 !== '—') ? pair.name2 : null,
      totalHit,
    };
  });

  const withHits = scores.filter(s => s.totalHit > 0)
    .sort((a, b) => b.totalHit - a.totalHit);

  if (withHits.length === 0) { section.classList.add('hidden'); return; }

  // Up to 3 distinct score values → rank groups
  const distinctScores = [...new Set(withHits.map(s => s.totalHit))].slice(0, 3);
  const rankGroups     = distinctScores.map(score =>
    withHits.filter(s => s.totalHit === score)
  );
  // rankGroups[0]=rank1, [1]=rank2, [2]=rank3

  const rankLabels = ['1ST', '2ND', '3RD'];

  function renderSlot(rankIdx) {
    const group = rankGroups[rankIdx];
    if (!group || group.length === 0) return '';
    const score    = group[0].totalHit;
    const label    = rankLabels[rankIdx];
    const cssClass = `podium-rank-${rankIdx + 1}`;
    const namesHtml = group.map(p => `
      <div class="podium-pair-label">PAIR ${p.num}</div>
      <div class="podium-pair-name">${p.name1}${p.name2 ? '<br>' + p.name2 : ''}</div>`
    ).join('<hr style="border-color:#334155;margin:6px 0;">');

    return `
      <div class="podium-slot ${cssClass}">
        <div class="podium-names-area">${namesHtml}</div>
        <div class="podium-pedestal">
          <div class="podium-rank-label">${label}</div>
          <div class="podium-score">${score}</div>
          <div class="podium-score-label">HIT</div>
        </div>
      </div>`;
  }

  // DOM order: rank2 (left), rank1 (centre), rank3 (right)
  section.classList.remove('hidden');
  section.innerHTML = `
    <div class="eg-section-title">BEST PILOTS</div>
    <div class="podium">
      ${renderSlot(1)}
      ${renderSlot(0)}
      ${renderSlot(2)}
    </div>`;
}

// ── Ammo summary table ────────────────────────────────────────────────────
function updateAmmoTable() {
  const section = document.getElementById('ammo-summary');
  const tbody   = document.getElementById('ammo-tbody');
  if (!section || !tbody) return;

  const revealed = [1, 2, 3].filter(n => revealedPhases[`phase${n}`]);
  if (revealed.length === 0) { section.classList.add('hidden'); return; }

  section.classList.remove('hidden');
  tbody.innerHTML = '';

  revealed.forEach(n => {
    let total = 0, hit = 0, missed = 0;
    Object.values(pairsData).forEach(pair => {
      const p     = pair[`phase${n}`];
      if (!p) return;
      const score = p.stage2Score ?? 0;
      total += score;
      if (p.targetCorrect) hit    += score;
      else                  missed += score;
    });
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>ENG. ${n}</td>
      <td>${total}</td>
      <td class="ammo-hit">${hit}</td>
      <td class="ammo-miss">${missed}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Projector EVA blink timer ─────────────────────────────────────────────
function startProjectorBlinkTimer(stageStartedAt) {
  stopProjectorBlink();
  const endTime = stageStartedAt + STAGE_DURATION;

  projectorBlinkInterval = setInterval(() => {
    const remaining = endTime - Date.now();
    if (remaining > 0 && remaining <= 15000) {
      document.body.classList.add('eva-alert');
    } else {
      document.body.classList.remove('eva-alert');
    }
    if (remaining <= 0) {
      stopProjectorBlink();
    }
  }, 500);
}

function stopProjectorBlink() {
  if (projectorBlinkInterval) {
    clearInterval(projectorBlinkInterval);
    projectorBlinkInterval = null;
  }
  document.body.classList.remove('eva-alert');
}
