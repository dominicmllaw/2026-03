// Tax Adviser Arena — Simulation Engine
// Calculates equilibrium outcomes for linear S/D model with unit tax

/**
 * Simulate the effect of a unit tax on a market.
 *
 * Standard model:
 *   Demand (inverse): Pd = a - b·Q
 *   Supply (inverse): Ps = c + d·Q
 *   Tax wedge: Pc = Ps + t
 *
 * Perfectly inelastic demand (Ed = 0):
 *   Demand: Q = fixedQuantity (vertical line)
 *   Supply: Ps = c + d·Q
 *   Tax: Qt = Q₀ (unchanged), Pc = P₀ + t, Ps = P₀
 *   Consumer burden = 100%
 *
 * @param {Object} roundConfig - Round configuration from config.js
 * @param {number} taxRate - Per-unit tax (positive)
 * @returns {Object} Simulation results
 */
export function simulate(roundConfig, taxRate) {
  const t = taxRate;

  // ── Perfectly inelastic demand (Ed = 0) ──
  if (roundConfig.perfectlyInelastic) {
    const { c, d, fixedQuantity } = roundConfig;
    const Q0 = fixedQuantity;
    const P0 = c + d * Q0;
    const Qt = Q0; // quantity never changes
    const Pc = P0 + t; // full tax passed to consumers
    const Ps = P0; // producer price unchanged
    const revenue = t * Qt;

    return {
      freeMarket: { P: round2(P0), Q: round2(Q0) },
      newEquilibrium: { Pc: round2(Pc), Ps: round2(Ps), Q: round2(Qt) },
      taxRate: round2(t),
      revenue: round2(revenue),
      govCost: 0,
      consumerBurdenPct: t !== 0 ? 100 : 0,
      producerBurdenPct: 0,
      consumerBurdenDollars: round2(Math.abs(Pc - P0) * Qt),
      producerBurdenDollars: 0,
      quantityChange: 0,
      priceChange: round2(t),
      priceChangePct: round2((t / P0) * 100),
      curves: { c, d, Q0: round2(Q0), P0: round2(P0), Qt: round2(Qt), perfectlyInelastic: true, fixedQuantity },
    };
  }

  // ── Standard linear model ──
  const { a, b, c, d } = roundConfig;

  // Free-market equilibrium
  const Q0 = (a - c) / (b + d);
  const P0 = a - b * Q0;

  // With tax
  let Qt = (a - c - t) / (b + d);
  if (Qt < 0) Qt = 0; // market shutdown

  const Pc = a - b * Qt;       // price consumers pay
  const Ps = Pc - t;            // price producers receive

  // Revenue
  const revenue = t * Qt;

  // Burden analysis
  // CORRECT formula: consumer share = b / (b + d)
  let consumerBurdenPct = 0;
  let producerBurdenPct = 0;
  let consumerBurdenDollars = 0;
  let producerBurdenDollars = 0;

  if (t !== 0 && Qt > 0) {
    consumerBurdenPct = Math.round((b / (b + d)) * 100);
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

    // After tax
    newEquilibrium: { Pc: round2(Pc), Ps: round2(Ps), Q: round2(Qt) },

    // Tax details
    taxRate: round2(t),
    revenue: round2(revenue),
    govCost: 0,

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
 * @param {Object} roundConfig - { a, b, c, d } or { perfectlyInelastic, fixedQuantity, c, d }
 * @param {number} taxRate - tax amount
 * @returns {Object} Arrays of {x, y} points for demand, supply, and shifted supply
 */
export function generateCurvePoints(roundConfig, taxRate = 0) {
  // ── Perfectly inelastic demand ──
  if (roundConfig.perfectlyInelastic) {
    const { c, d, fixedQuantity } = roundConfig;
    const Q0 = fixedQuantity;
    const P0 = c + d * Q0;
    const qMax = Q0 * 1.6;
    const pMax = (P0 + Math.abs(taxRate) + 5) * 1.3;

    // Demand: vertical line at Q0
    const demand = [
      { x: round2(Q0), y: 0 },
      { x: round2(Q0), y: round2(pMax) },
    ];

    // Supply: normal upward-sloping
    const supply = [];
    const supplyShifted = [];
    const steps = 60;
    const dq = qMax / steps;
    for (let i = 0; i <= steps; i++) {
      const q = i * dq;
      const ps = c + d * q;
      if (ps >= 0 && ps <= pMax) supply.push({ x: round2(q), y: round2(ps) });
      if (taxRate !== 0) {
        const psShifted = ps + taxRate;
        if (psShifted >= 0 && psShifted <= pMax) {
          supplyShifted.push({ x: round2(q), y: round2(psShifted) });
        }
      }
    }

    return { demand, supply, supplyShifted };
  }

  // ── Standard linear model ──
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
    if (ps >= 0 && ps <= a * 1.2) supply.push({ x: round2(q), y: round2(ps) });
    if (taxRate !== 0) {
      const psShifted = c + d * q + taxRate;
      if (psShifted >= 0 && psShifted <= a * 1.2) {
        supplyShifted.push({ x: round2(q), y: round2(psShifted) });
      }
    }
  }

  return { demand, supply, supplyShifted };
}

/**
 * Compute the optimal tax rate for a round.
 * @param {Object} roundConfig
 * @returns {number} Optimal tax rate
 */
export function computeOptimalRate(roundConfig) {
  // Perfectly inelastic: Revenue = t * Q₀ → t = R / Q₀
  if (roundConfig.perfectlyInelastic) {
    if (roundConfig.revenueTarget != null) {
      return round2(roundConfig.revenueTarget / roundConfig.fixedQuantity);
    }
    return 0;
  }

  const { a, b, c, d } = roundConfig;
  const k = a - c; // demand-supply intercept gap
  const s = b + d; // sum of slopes

  // Find minimum tax to hit revenue target
  if (roundConfig.revenueTarget != null) {
    const R = roundConfig.revenueTarget;
    // Revenue = t * (k - t) / s = R
    // t^2 - kt + Rs = 0
    const disc = k * k - 4 * R * s;

    if (disc < 0) {
      // Target unreachable — return tax that maximises revenue (Laffer peak)
      return round2(k / 2);
    }

    let t = (k - Math.sqrt(disc)) / 2; // smaller root = minimum tax for target

    // Check secondary target constraint (e.g., max price increase)
    if (roundConfig.secondaryTarget) {
      const st = roundConfig.secondaryTarget;
      if (st.type === 'maxPriceIncrease') {
        const maxT = st.value * s / b;
        if (t > maxT) t = maxT;
      }
    }

    return round2(t);
  }

  return 0;
}

/**
 * Generate a demand/supply schedule table for a round.
 *
 * @param {Object} roundConfig
 * @param {number} taxRate - 0 for before-tax schedule, nonzero for after-tax
 * @returns {Array} Rows of { p, qd, qs, qsAfter?, isEquilibrium, isNewEquilibrium? }
 */
export function generateSchedule(roundConfig, taxRate = 0) {
  // ── Perfectly inelastic demand ──
  if (roundConfig.perfectlyInelastic) {
    const { c, d, fixedQuantity } = roundConfig;
    const Q0 = fixedQuantity;
    const P0 = round2(c + d * Q0);
    const Pc = round2(P0 + taxRate);

    // Generate prices around equilibrium
    let prices = roundConfig.schedulePrices
      ? [...roundConfig.schedulePrices]
      : autoSchedulePrices(P0, P0 * 2.5, c);

    if (!prices.some(p => Math.abs(p - P0) < 0.05)) prices.push(P0);
    if (taxRate !== 0 && !prices.some(p => Math.abs(p - Pc) < 0.05)) prices.push(Pc);
    prices.sort((x, y) => x - y);

    return prices.map(p => {
      const row = {
        p: round1(p),
        qd: round1(Q0), // always Q0 — perfectly inelastic
        qs: round1(Math.max(0, (p - c) / d)),
        isEquilibrium: Math.abs(p - P0) < 0.05,
      };
      if (taxRate !== 0) {
        row.qsAfter = round1(Math.max(0, (p - c - taxRate) / d));
        row.isNewEquilibrium = Math.abs(p - Pc) < 0.05;
      }
      return row;
    });
  }

  // ── Standard linear model ──
  const { a, b, c, d } = roundConfig;
  const Q0 = (a - c) / (b + d);
  const P0 = round2(a - b * Q0);

  // Use config-defined prices or auto-generate
  let prices = roundConfig.schedulePrices
    ? [...roundConfig.schedulePrices]
    : autoSchedulePrices(P0, a, c);

  // Ensure equilibrium price is included
  if (!prices.some(p => Math.abs(p - P0) < 0.05)) {
    prices.push(P0);
  }

  // For after-tax, also include the new consumer price
  if (taxRate !== 0) {
    const Qt = Math.max(0, (a - c - taxRate) / (b + d));
    const Pc = round2(a - b * Qt);
    if (Qt > 0 && !prices.some(p => Math.abs(p - Pc) < 0.05)) {
      prices.push(Pc);
    }
  }

  prices.sort((x, y) => x - y);

  return prices.map(p => {
    const qd = Math.max(0, (a - p) / b);
    const qs = Math.max(0, (p - c) / d);
    const row = {
      p: round1(p),
      qd: round1(qd),
      qs: round1(qs),
      isEquilibrium: Math.abs(p - P0) < 0.05,
    };

    if (taxRate !== 0) {
      row.qsAfter = round1(Math.max(0, (p - c - taxRate) / d));
      const Qt = Math.max(0, (a - c - taxRate) / (b + d));
      const Pc = a - b * Qt;
      row.isNewEquilibrium = Math.abs(p - Pc) < 0.05;
    }

    return row;
  });
}

/**
 * Auto-generate schedule prices from curve parameters.
 */
function autoSchedulePrices(P0, a, c) {
  const pMin = Math.max(0, c, P0 * 0.3);
  const pMax = Math.min(a, P0 * 1.8);
  const range = pMax - pMin;
  const step = niceStep(range / 4);
  const prices = [];
  const start = Math.ceil(pMin / step) * step;
  for (let p = start; p <= pMax + step * 0.1; p += step) {
    if (p > 0) prices.push(round1(p));
  }
  // Limit to ~5-7 prices
  if (prices.length > 7) {
    const keep = [];
    const stride = Math.ceil(prices.length / 5);
    for (let i = 0; i < prices.length; i += stride) keep.push(prices[i]);
    return keep;
  }
  return prices;
}

function niceStep(rough) {
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;
  if (residual <= 1.5) return magnitude;
  if (residual <= 3.5) return 2 * magnitude;
  if (residual <= 7.5) return 5 * magnitude;
  return 10 * magnitude;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
