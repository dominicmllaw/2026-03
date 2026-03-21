// Tax Adviser Arena — Simulation Engine
// Calculates equilibrium outcomes for linear S/D model with unit tax/subsidy

/**
 * Simulate the effect of a unit tax or subsidy on a market.
 *
 * Model:
 *   Demand (inverse): Pd = a - b·Q
 *   Supply (inverse): Ps = c + d·Q
 *   Tax wedge: Pc = Ps + t  (t > 0 = tax, t < 0 = subsidy)
 *
 * @param {Object} roundConfig - Round configuration from config.js
 * @param {number} taxRate - Per-unit tax (positive) or subsidy (negative)
 * @returns {Object} Simulation results
 */
export function simulate(roundConfig, taxRate) {
  const { a, b, c, d } = roundConfig;
  const t = taxRate;

  // Free-market equilibrium
  const Q0 = (a - c) / (b + d);
  const P0 = a - b * Q0;

  // With tax/subsidy
  let Qt = (a - c - t) / (b + d);
  if (Qt < 0) Qt = 0; // market shutdown

  const Pc = a - b * Qt;       // price consumers pay
  const Ps = Pc - t;            // price producers receive

  // Revenue (tax) or cost (subsidy)
  const revenue = t * Qt;
  const govCost = t < 0 ? Math.abs(t) * Qt : 0; // subsidy cost to government

  // Burden analysis (only meaningful when t !== 0 and Qt > 0)
  let consumerBurdenPct = 0;
  let producerBurdenPct = 0;
  let consumerBurdenDollars = 0;
  let producerBurdenDollars = 0;

  if (t !== 0 && Qt > 0) {
    // For tax (t > 0): consumer pays more, producer receives less
    // For subsidy (t < 0): consumer pays less (benefit), producer receives more (benefit)
    // The % split is the same formula either way
    consumerBurdenPct = Math.round((d / (b + d)) * 100);
    producerBurdenPct = 100 - consumerBurdenPct;

    consumerBurdenDollars = Math.abs(Pc - P0) * Qt;
    producerBurdenDollars = Math.abs(P0 - Ps) * Qt;
  }

  // Quantity change
  const quantityChange = Qt - Q0;

  // Consumer price change
  const priceChange = Pc - P0;

  return {
    // Free market
    freeMarket: { P: round2(P0), Q: round2(Q0) },

    // After tax/subsidy
    newEquilibrium: { Pc: round2(Pc), Ps: round2(Ps), Q: round2(Qt) },

    // Tax/subsidy details
    taxRate: round2(t),
    revenue: round2(revenue),
    govCost: round2(govCost),

    // Burden split
    consumerBurdenPct,
    producerBurdenPct,
    consumerBurdenDollars: round2(consumerBurdenDollars),
    producerBurdenDollars: round2(producerBurdenDollars),

    // Changes
    quantityChange: round2(quantityChange),
    priceChange: round2(priceChange),
    priceChangePct: round2((priceChange / P0) * 100),

    // Curve data for charting
    curves: {
      a, b, c, d,
      Q0: round2(Q0),
      P0: round2(P0),
      Qt: round2(Qt),
    },
  };
}

/**
 * Generate points for plotting S/D curves.
 * @param {Object} roundConfig - { a, b, c, d }
 * @param {number} taxRate - tax/subsidy amount
 * @returns {Object} Arrays of {x, y} points for demand, supply, and shifted supply
 */
export function generateCurvePoints(roundConfig, taxRate = 0) {
  const { a, b, c, d } = roundConfig;
  const Q0 = (a - c) / (b + d);
  const qMax = Q0 * 1.6;
  const steps = 60;
  const dq = qMax / steps;

  const demand = [];
  const supply = [];
  const supplyShifted = [];

  for (let i = 0; i <= steps; i++) {
    const q = i * dq;
    const pd = a - b * q;
    const ps = c + d * q;
    if (pd >= 0) demand.push({ x: round2(q), y: round2(pd) });
    if (ps <= a * 1.2) supply.push({ x: round2(q), y: round2(ps) });
    if (taxRate !== 0) {
      const psShifted = c + d * q + taxRate;
      if (psShifted >= 0 && psShifted <= a * 1.2) {
        supplyShifted.push({ x: round2(q), y: round2(psShifted) });
      }
    }
  }

  return { demand, supply, supplyShifted };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
