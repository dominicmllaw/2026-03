// Tax Adviser Arena — Game Configuration
// All round parameters, targets, and constants

export const TOTAL_GROUPS = 16;
export const TOTAL_ROUNDS = 4;

// Firebase configuration — replace with your project's config before deployment
export const FIREBASE_CONFIG = {
  // To use Firebase: create a project at console.firebase.google.com,
  // enable Realtime Database, set rules to public read/write,
  // and paste your config here.
  apiKey: '',
  authDomain: '',
  databaseURL: '',
  projectId: '',
};

// ── Linear S/D model ──
//
// Inverse demand: Pd = a - b·Q   (b = |slope| of inverse demand)
// Inverse supply: Ps = c + d·Q   (d = slope of inverse supply)
//
// Equilibrium: Q₀ = (a−c)/(b+d),  P₀ = a − b·Q₀
//
// Tax incidence (CORRECT formula):
//   Consumer burden share = b / (b + d)
//   Producer burden share = d / (b + d)
//
// Point elasticities at equilibrium:
//   PED = P₀ / (b · Q₀)     — inelastic if < 1, elastic if > 1
//   PES = P₀ / (d · Q₀)     — inelastic if < 1, elastic if > 1
//
// For HKDSE consistency (Issue 10):
//   PED < 1 ⟺ P₀ < a/2  (equilibrium in lower half of demand curve)
//   PED > 1 ⟺ P₀ > a/2  (equilibrium in upper half of demand curve)
//   PES > 1 ⟺ c > 0     (supply has positive P-intercept)
//   PES < 1 ⟺ c < 0     (supply has positive Q-intercept)
//
// Issue 11: All key values are integers or clean one-decimal values.
//   Design rule: b and d chosen so 1/b and 1/d each have ≤ 1 decimal digit.
//   b+d chosen from {2, 2.5, 5} so 1/(b+d) is clean.
//   b/(b+d) is a clean decimal (0.2, 0.5, 0.8, etc.).
//   Model answer tax rate is always an integer.
//   Slider step is $1 throughout.

export const ROUNDS = [
  null, // index 0 unused (rounds are 1-indexed)

  // ═══════════════════════════════════════════════════════════════
  // Round 1: Tobacco Tax — Inelastic Demand, Elastic Supply
  // ═══════════════════════════════════════════════════════════════
  // Inverse demand: Pd = 90 - 5Q   → Direct: Qd = 18 - 0.2P
  // Inverse supply: Ps = 7.5 + 2.5Q → Direct: Qs = -3 + 0.4P
  //
  // Q₀ = (90-7.5)/(5+2.5) = 82.5/7.5 = 11,  P₀ = 90 - 5×11 = $35
  // Consumer burden = b/(b+d) = 5/7.5 = 2/3 ≈ 67%
  // PED = 35/(5×11) = 35/55 ≈ 0.64 → inelastic ✓
  // PES = 35/(2.5×11) = 35/27.5 ≈ 1.27 → elastic ✓
  // P₀ = 35 < 45 = a/2 → lower half ✓ (HKDSE: PED < 1)
  // c = 7.5 > 0 → elastic supply ✓
  //
  // Integer check (b=5, d=2.5, a=90, c=7.5, price step=$5):
  //   Qd = (90-P)/5 → integer for all P = 5k ✓
  //   Qs = (P-7.5)/2.5 → integer for all P = 5k (since P-7.5 is multiple of 2.5) ✓
  //
  // Model answer t = $15 (multiple of $5 ✓):
  //   Qt = (82.5-15)/7.5 = 9,  Pc = 90-45 = $45,  Ps = $30
  //   Revenue = 15 × 9 = $135  ← target
  //   Consumer price rise = $10 (2/3 of $15) ✓
  //   After-tax equilibrium Pc = $45 is on table row ✓
  //   Qs after-tax column = original Qs shifted down 3 rows (15÷5=3) ✓
  {
    id: 1,
    title: 'The Easy Win',
    subtitle: 'Tobacco Tax',
    market: 'Cigarettes',
    scenario: 'Hong Kong is considering an additional unit tax on cigarettes. A pack currently costs around HK$35. The government wants to raise revenue from this market.',
    demandClue: 'Research shows that most smokers find it extremely difficult to quit — cigarette demand is very unresponsive to price changes.',
    supplyClue: 'Tobacco companies can easily scale production up or down at low cost — supply is very responsive to price.',
    demandElasticity: 'inelastic',
    supplyElasticity: 'elastic',
    unit: 'HK$ per pack',
    a: 90,
    b: 5,
    c: 7.5,
    d: 2.5,
    // Equilibrium: Q₀ = 11, P₀ = $35
    scheduleMin: 15,
    scheduleMax: 55,
    scheduleStep: 5,
    sliderMin: 5,
    sliderMax: 30,
    sliderStep: 5,
    sliderDefault: 5,
    revenueTarget: 135,
    revenueTargetLabel: 'HK$135',
    secondaryTarget: null,
    hasBurdenPrediction: false,
    timeLimit: null,
    sliderZones: { green: [15, 15], amber: [10, 20], red: [5, 30] },
  },

  // ═══════════════════════════════════════════════════════════════
  // Round 2: Sugary Drinks Tax — Elastic Demand, Inelastic Supply
  // ═══════════════════════════════════════════════════════════════
  // Inverse demand: Pd = 80 - 2.5Q   → Direct: Qd = 32 - 0.4P
  // Inverse supply: Ps = -10 + 5Q    → Direct: Qs = 2 + 0.2P  (wait: Qs=(P+10)/5=-(-10)/5+P/5 = 2+0.2P)
  //
  // Q₀ = (80+10)/(2.5+5) = 90/7.5 = 12,  P₀ = 80 - 2.5×12 = $50
  // Producer burden = d/(b+d) = 5/7.5 = 2/3 ≈ 67%
  // PED = 50/(2.5×12) = 50/30 ≈ 1.67 → elastic ✓
  // PES = 50/(5×12) = 50/60 ≈ 0.83 → inelastic ✓
  // P₀ = 50 > 40 = a/2 → upper half ✓ (HKDSE: PED > 1)
  // c = -10 < 0 → inelastic supply ✓
  //
  // Integer check (b=2.5, d=5, a=80, c=-10, price step=$5):
  //   Qd = (80-P)/2.5 → integer for all P = 5k (since 80-P is multiple of 5, 5/2.5=2) ✓
  //   Qs = (P+10)/5  → integer for all P = 5k (since P+10 is multiple of 5) ✓
  //
  // "The Surprise": same optimal tax as R1 ($15), but producers bear most of the burden!
  //
  // Model answer t = $15 (multiple of $5 ✓):
  //   Qt = (90-15)/7.5 = 10,  Pc = 80-25 = $55,  Ps = $40
  //   Revenue = 15 × 10 = $150  ← target
  //   Consumer price rise = $5 (1/3 of $15) ✓
  //   Producer price fall = $10 (2/3 of $15) ✓
  //   After-tax equilibrium Pc = $55 is on table row ✓
  //   Qs after-tax column = original Qs shifted down 3 rows (15÷5=3) ✓
  {
    id: 2,
    title: 'The Surprise',
    subtitle: 'Sugary Drinks Tax',
    market: 'Bottled soft drinks',
    scenario: 'Hong Kong is considering a sugar tax on bottled soft drinks. A bottle currently costs around HK$50. The government wants to raise revenue from this market.',
    demandClue: 'Consumers can easily switch to water, tea, or sugar-free alternatives — demand is very responsive to price changes.',
    supplyClue: 'Bottling companies have committed to expensive factory equipment and long-term sugar contracts — it is very difficult to change output levels.',
    demandElasticity: 'elastic',
    supplyElasticity: 'very inelastic',
    unit: 'HK$ per bottle',
    a: 80,
    b: 2.5,
    c: -10,
    d: 5,
    // Equilibrium: Q₀ = 12, P₀ = $50
    scheduleMin: 30,
    scheduleMax: 70,
    scheduleStep: 5,
    sliderMin: 5,
    sliderMax: 25,
    sliderStep: 5,
    sliderDefault: 5,
    revenueTarget: 150,
    revenueTargetLabel: 'HK$150',
    secondaryTarget: null,
    hasBurdenPrediction: true,
    timeLimit: null,
    sliderZones: { green: [15, 15], amber: [10, 20], red: [5, 25] },
  },

  // ═══════════════════════════════════════════════════════════════
  // Round 3: Plastic Bag Levy — Moderate-High Elastic Demand, Highly Elastic Supply
  // ═══════════════════════════════════════════════════════════════
  // Inverse demand: Pd = 50 - 2Q   → Direct: Qd = 25 - 0.5P
  // Inverse supply: Ps = 20 + 1Q   → Direct: Qs = -20 + P
  //
  // Q₀ = (50-20)/(2+1) = 30/3 = 10,  P₀ = 50 - 2×10 = $30
  // Consumer burden = b/(b+d) = 2/3 ≈ 67%
  // PED = 30/(2×10) = 1.50 → moderate-high elastic ✓
  // PES = 30/(1×10) = 3.00 → highly elastic ✓
  // P₀ = 30 > 25 = a/2 → upper half ✓ (HKDSE: PED > 1)
  // c = 20 > 0 → elastic supply ✓
  //
  // Key insight: highly elastic supply means producers easily exit → burden falls on CONSUMERS
  // even though demand is also elastic. The dual target forces students to balance both goals.
  //
  // Integer check (b=2, d=1, a=50, c=20, price step=$2):
  //   Qd = (50-P)/2 → integer for all P = even ✓
  //   Qs = P-20     → integer for all integer P ✓
  //
  // "The Speed Round": DUAL TARGET — hit revenue AND keep consumer price rise ≤ $4.
  //
  // Model answer t = $6 (multiple of $2 ✓):
  //   Qt = (30-6)/3 = 8,  Pc = 50-16 = $34,  Ps = $28
  //   Revenue = 6 × 8 = $48  ← primary target (binding)
  //   ΔPc = $4 = 2/3 × $6 ≤ $4 ← secondary target (binding)
  //   Both targets hit simultaneously — any higher tax violates the price cap ✓
  //   After-tax equilibrium Pc = $34 is on table row ✓
  //   Qs after-tax column = original Qs shifted down 3 rows (6÷2=3) ✓
  {
    id: 3,
    title: 'The Speed Round',
    subtitle: 'Plastic Bag Levy',
    market: 'Plastic carrier bags (per pack)',
    scenario: 'Hong Kong wants to raise its plastic bag levy. Packs currently sell for about HK$30. You must hit TWO targets simultaneously: raise enough revenue AND keep the consumer price increase manageable. Clock is ticking!',
    demandClue: 'Many shoppers already carry reusable bags and can easily switch — demand is moderately responsive to price changes.',
    supplyClue: 'Plastic bag manufacturers can scale output up or down almost instantly — supply is extremely responsive to price.',
    demandElasticity: 'moderately elastic',
    supplyElasticity: 'highly elastic',
    unit: 'HK$ per pack',
    a: 50,
    b: 2,
    c: 20,
    d: 1,
    // Equilibrium: Q₀ = 10, P₀ = $30
    scheduleMin: 20,
    scheduleMax: 40,
    scheduleStep: 2,
    sliderMin: 2,
    sliderMax: 12,
    sliderStep: 2,
    sliderDefault: 2,
    revenueTarget: 48,
    revenueTargetLabel: 'HK$48',
    secondaryTarget: {
      type: 'maxPriceIncrease',
      value: 4,
      label: 'Keep consumer price increase at or below HK$4',
    },
    hasBurdenPrediction: true,
    timeLimit: 90,
    sliderZones: { green: [6, 6], amber: [4, 8], red: [2, 12] },
  },

  // ═══════════════════════════════════════════════════════════════
  // Round 4: Life-Saving Medicine Tax — Perfectly Inelastic Demand
  // ═══════════════════════════════════════════════════════════════
  // Perfectly inelastic demand: Qd = 20 at ALL prices (vertical demand curve, Ed = 0)
  // Inverse supply: Ps = 10 + 1·Q  →  Direct: Qs = P − 10
  //
  // Equilibrium: Qs = Q₀ = 20  →  P₀ = 10 + 20 = $30
  // Consumer burden = b/(b+d) = 100% (vertical demand → all tax shifted to consumers)
  // Producer burden = 0% (producers receive unchanged net price = P₀)
  // PES = P₀/(d×Q₀) = 30/(1×20) = 1.50 → elastic supply ✓
  //
  // Special case rules:
  //   Qd column = 20 in every table row (same number throughout) ✓
  //   After-tax: Qt = Q₀ = 20 (unchanged), Pc = P₀ + t, Ps = P₀ (no change)
  //   Revenue = t × Q₀ = t × 20 (grows linearly with t — no deadweight loss!)
  //
  // Integer check (d=1, c=10, price step=$5):
  //   Qd = 20 (constant — trivially integer) ✓
  //   Qs = P − 10 → integer for all integer P ✓
  //
  // Model answer t = $5 (multiple of $5 ✓):
  //   Qt = 20 (unchanged), Pc = $35, Ps = $30
  //   Revenue = 5 × 20 = $100  ← target
  //   Consumer price rise = $5 = full tax ✓
  //   After-tax equilibrium Pc = $35 is on table row ✓
  //   Qs after-tax column = original Qs shifted down 1 row (5÷5=1) ✓
  //   No new rows added ✓
  {
    id: 4,
    title: 'The Aha Moment',
    subtitle: 'Medicine Tax',
    market: 'Life-saving medicine (insulin)',
    scenario: 'The government is considering a unit tax on a life-saving medicine (insulin for diabetic patients). The medicine currently costs HK$30 per dose. Can you hit the revenue target — and who will really pay?',
    demandClue: 'Patients need this medicine to survive — they will buy the same quantity regardless of price. Demand is completely unresponsive to price.',
    supplyClue: 'Pharmaceutical companies can adjust production levels relatively easily — supply is responsive to price.',
    demandElasticity: 'perfectly inelastic',
    supplyElasticity: 'elastic',
    unit: 'HK$ per dose',
    perfectlyInelastic: true,
    fixedQuantity: 20,
    c: 10,
    d: 1,
    // Equilibrium: Q₀ = 20, P₀ = $30
    scheduleMin: 20,
    scheduleMax: 45,
    scheduleStep: 5,
    sliderMin: 5,
    sliderMax: 15,
    sliderStep: 5,
    sliderDefault: 5,
    revenueTarget: 100,
    revenueTargetLabel: 'HK$100',
    secondaryTarget: null,
    hasBurdenPrediction: true,
    timeLimit: null,
    sliderZones: { green: [5, 5], amber: [5, 10], red: [5, 15] },
  },
];

// Colour palette
export const COLOURS = {
  demand: '#2563eb',        // blue
  supply: '#dc2626',        // red
  supplyShifted: '#16a34a', // green (after tax/subsidy)
  revenue: 'rgba(251, 191, 36, 0.4)',  // yellow (tax revenue area)
  consumerBurden: '#f97316', // orange
  producerBurden: '#8b5cf6', // purple
  primary: '#2563eb',
  accent: '#f59e0b',
  success: '#16a34a',
  danger: '#dc2626',
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#1e293b',
  textMuted: '#64748b',
};

// Game phases
export const PHASE = {
  LOBBY: 'lobby',
  SUBMIT: 'submit',
  CLOSED: 'closed',
  REVEAL: 'reveal',
};
