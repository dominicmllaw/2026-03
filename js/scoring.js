// Tax Adviser Arena — Scoring Engine

import { simulate } from './simulation.js';

/**
 * Score a group's submission for a round.
 *
 * @param {Object} roundConfig - Round configuration from config.js
 * @param {Object} submission - { taxRate, burdenPrediction, justification }
 * @param {Object} simResult - Output from simulate()
 * @returns {Object} { total, breakdown: { revenue, secondary, prediction }, maxPossible }
 */
export function scoreSubmission(roundConfig, submission, simResult) {
  const breakdown = {
    revenue: 0,
    secondary: 0,
    prediction: 0,
  };

  // ── 1. Revenue target closeness (0–40 points) ──
  if (roundConfig.revenueTarget != null) {
    const target = roundConfig.revenueTarget;
    const actual = simResult.revenue;
    const error = Math.abs(actual - target);
    const errorPct = target > 0 ? (error / target) * 100 : 0;

    if (errorPct <= 5) breakdown.revenue = 40;
    else if (errorPct <= 10) breakdown.revenue = 35;
    else if (errorPct <= 20) breakdown.revenue = 28;
    else if (errorPct <= 35) breakdown.revenue = 20;
    else if (errorPct <= 50) breakdown.revenue = 12;
    else if (errorPct <= 75) breakdown.revenue = 5;
    else breakdown.revenue = 0;
  }

  // ── 2. Secondary target (0–20 points, Round 3 only) ──
  if (roundConfig.secondaryTarget) {
    const st = roundConfig.secondaryTarget;
    if (st.type === 'maxPriceIncrease') {
      const priceIncrease = simResult.priceChange;
      if (priceIncrease <= st.value) {
        breakdown.secondary = 20;
      } else {
        const overBy = priceIncrease - st.value;
        const overPct = (overBy / st.value) * 100;
        if (overPct <= 10) breakdown.secondary = 15;
        else if (overPct <= 25) breakdown.secondary = 10;
        else if (overPct <= 50) breakdown.secondary = 5;
      }
    }
  }

  // ── 3. Burden prediction accuracy (0–20 points, Rounds 2–3) ──
  if (roundConfig.hasBurdenPrediction && submission.burdenPrediction != null) {
    const predicted = submission.burdenPrediction;
    const actual = simResult.consumerBurdenPct;
    const error = Math.abs(predicted - actual);

    if (error <= 5) breakdown.prediction = 20;
    else if (error <= 10) breakdown.prediction = 16;
    else if (error <= 15) breakdown.prediction = 12;
    else if (error <= 25) breakdown.prediction = 8;
    else if (error <= 35) breakdown.prediction = 4;
    else breakdown.prediction = 0;
  }

  // Justification points (0–20) are teacher-awarded manually, not auto-scored

  const total = breakdown.revenue + breakdown.secondary + breakdown.prediction;
  const maxPossible = 40 +
    (roundConfig.secondaryTarget ? 20 : 0) +
    (roundConfig.hasBurdenPrediction ? 20 : 0);

  return { total, breakdown, maxPossible };
}

/**
 * Calculate the leaderboard from all rounds' scores.
 * @param {Object} allScores - { groupNumber: { r1: n, r2: n, ... } }
 * @returns {Array} Sorted array of { group, total, rounds }
 */
export function calculateLeaderboard(allScores) {
  const entries = Object.entries(allScores).map(([group, rounds]) => {
    const total = Object.values(rounds).reduce((sum, s) => sum + (s || 0), 0);
    return { group: parseInt(group), total, rounds };
  });
  entries.sort((a, b) => b.total - a.total);
  return entries;
}
