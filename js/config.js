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
  // Pd = 130 - 4Q,  Ps = 5 + 1Q
  // Q₀ = (130-5)/5 = 25,  P₀ = 130 - 100 = 30
  // Consumer burden = b/(b+d) = 4/5 = 80%
  // PED = 30/(4×25) = 0.30 → inelastic ✓
  // PES = 30/(1×25) = 1.20 → elastic ✓
  // P₀ = 30 < 65 = a/2 → lower half ✓ (HKDSE: PED < 1)
  // c = 5 > 0 → elastic supply ✓
  //
  // Model answer t = $15:
  //   Qt = (125-15)/5 = 22,  Pc = 130-88 = 42,  Ps = 27
  //   Revenue = 15 × 22 = $330  ← target
  //   Consumer price rise = $12 (80% of $15) ✓
  //   All values are integers ✓
  //
  // Clean-value check: Qt shifts by 0.2/$ tax, Pc by 0.8/$, Ps by 0.2/$
  // All one-decimal for every integer tax rate ✓
  {
    id: 1,
    title: 'The Easy Win',
    subtitle: 'Tobacco Tax',
    market: 'Cigarettes',
    scenario: 'Hong Kong is considering an additional unit tax on cigarettes. A pack currently costs around HK$30. The government wants to raise revenue from this market.',
    demandClue: 'Research shows that most smokers find it extremely difficult to quit — cigarette demand is very unresponsive to price changes.',
    supplyClue: 'Tobacco companies can easily scale production up or down at low cost — supply is very responsive to price.',
    demandElasticity: 'inelastic',
    supplyElasticity: 'elastic',
    unit: 'HK$ per pack',
    a: 130,
    b: 4,
    c: 5,
    d: 1,
    // Equilibrium: Q₀ = 25, P₀ = $30
    scheduleMin: 10,
    scheduleMax: 50,
    scheduleStep: 5,
    sliderMin: 1,
    sliderMax: 20,
    sliderStep: 1,
    sliderDefault: 5,
    revenueTarget: 330,
    revenueTargetLabel: 'HK$330',
    secondaryTarget: null,
    hasBurdenPrediction: false,
    timeLimit: null,
    sliderZones: { green: [1, 12], amber: [13, 17], red: [18, 20] },
  },

  // ═══════════════════════════════════════════════════════════════
  // Round 2: Sugary Drinks Tax — Elastic Demand, Inelastic Supply
  // ═══════════════════════════════════════════════════════════════
  // Pd = 110 - 2Q,  Ps = -15 + 3Q
  // Q₀ = (110+15)/5 = 25,  P₀ = 110 - 50 = 60
  // Consumer burden = b/(b+d) = 2/5 = 40%
  // PED = 60/(2×25) = 1.20 → elastic ✓
  // PES = 60/(3×25) = 0.80 → inelastic ✓
  // P₀ = 60 > 55 = a/2 → upper half ✓ (HKDSE: PED > 1)
  // c = -15 < 0 → inelastic supply ✓
  //
  // "The Surprise": same target as R1 ($330), same optimal tax ($15),
  // but burden is only 40% on consumers vs 80% in R1!
  //
  // Model answer t = $15:
  //   Qt = (125-15)/5 = 22,  Pc = 110-44 = 66,  Ps = 51
  //   Revenue = 15 × 22 = $330  ← same target as R1
  //   Consumer price rise = $6 (40% of $15) ✓
  //   All values are integers ✓
  //
  // Clean-value check: Qt shifts by 0.2/$ tax, Pc by 0.4/$, Ps by 0.6/$
  {
    id: 2,
    title: 'The Surprise',
    subtitle: 'Sugary Drinks Tax',
    market: 'Bottled soft drinks',
    scenario: 'Hong Kong is considering a sugar tax on bottled soft drinks. A bottle currently costs around HK$60. The government wants to raise the same revenue target as Round 1.',
    demandClue: 'Consumers can easily switch to water, tea, or sugar-free alternatives — demand is very responsive to price changes.',
    supplyClue: 'Bottling companies have committed to expensive factory equipment and long-term sugar contracts — it is very difficult to change output levels.',
    demandElasticity: 'elastic',
    supplyElasticity: 'very inelastic',
    unit: 'HK$ per bottle',
    a: 110,
    b: 2,
    c: -15,
    d: 3,
    // Equilibrium: Q₀ = 25, P₀ = $60
    scheduleMin: 40,
    scheduleMax: 80,
    scheduleStep: 5,
    sliderMin: 1,
    sliderMax: 15,
    sliderStep: 1,
    sliderDefault: 5,
    revenueTarget: 330,
    revenueTargetLabel: 'HK$330',
    secondaryTarget: null,
    hasBurdenPrediction: true,
    timeLimit: null,
    sliderZones: { green: [1, 10], amber: [11, 13], red: [14, 15] },
  },

  // ═══════════════════════════════════════════════════════════════
  // Round 3: Plastic Bag Levy — Equal Elasticities (both > 1)
  // ═══════════════════════════════════════════════════════════════
  // Pd = 22 - 1Q,  Ps = 2 + 1Q
  // Q₀ = (22-2)/2 = 10,  P₀ = 22 - 10 = 12
  // Consumer burden = b/(b+d) = 1/2 = 50%
  // PED = 12/(1×10) = 1.20 → elastic ✓
  // PES = 12/(1×10) = 1.20 → elastic ✓
  // b = d → exactly symmetric → exactly 50/50 burden split ✓
  // c = 2 > 0 → elastic supply ✓
  //
  // "Boss Round": must hit revenue target AND keep price increase low.
  //
  // Model answer t = $2:
  //   Qt = (20-2)/2 = 9,  Pc = 22-9 = 13,  Ps = 11
  //   Revenue = 2 × 9 = $18  ← target
  //   ΔPc = $1 ≤ $1.50 secondary target ✓
  //   All values are integers ✓
  //
  // Clean-value check: Qt shifts by 0.5/$ tax, Pc by 0.5/$, Ps by 0.5/$
  {
    id: 3,
    title: 'The Boss Round',
    subtitle: 'Plastic Bag Levy',
    market: 'Plastic shopping bags',
    scenario: 'Hong Kong wants to further increase its plastic bag levy. A bag currently has a market price of about HK$12. You must hit TWO targets: raise enough revenue AND keep the consumer price increase manageable.',
    demandClue: 'Many shoppers already bring reusable bags — demand is quite responsive to price changes.',
    supplyClue: 'Plastic bags are extremely cheap to produce and producers can easily adjust output — supply is also very responsive.',
    demandElasticity: 'elastic',
    supplyElasticity: 'elastic',
    unit: 'HK$ per bag',
    a: 22,
    b: 1,
    c: 2,
    d: 1,
    // Equilibrium: Q₀ = 10, P₀ = $12
    scheduleMin: 5,
    scheduleMax: 18,
    scheduleStep: 1,
    sliderMin: 1,
    sliderMax: 5,
    sliderStep: 1,
    sliderDefault: 1,
    revenueTarget: 18,
    revenueTargetLabel: 'HK$18',
    secondaryTarget: {
      type: 'maxPriceIncrease',
      value: 1.5,
      label: 'Keep consumer price increase below HK$1.50',
    },
    hasBurdenPrediction: true,
    timeLimit: 120,
    sliderZones: { green: [1, 2], amber: [3, 4], red: [5, 5] },
  },

  // ═══════════════════════════════════════════════════════════════
  // Round 4: Life-Saving Medicine Tax — Perfectly Inelastic Demand
  // ═══════════════════════════════════════════════════════════════
  // Perfectly inelastic demand (Ed = 0): Q fixed at 20 units regardless of price
  // Supply: Ps = 10 + 1·Q → P₀ = 10 + 20 = $30
  //
  // Consumer burden = 100% (vertical demand curve → all tax passed to consumers)
  // PES = P₀ / (d × Q₀) = 30 / (1 × 20) = 1.5 → elastic supply ✓
  //
  // Model answer t = $5:
  //   Qt = 20 (unchanged), Pc = 30 + 5 = $35, Ps = $30
  //   Revenue = 5 × 20 = $100  ← target
  //   Consumer burden = 100%, Producer burden = 0%
  //   All values are integers ✓
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
    sliderMin: 1,
    sliderMax: 10,
    sliderStep: 1,
    sliderDefault: 3,
    revenueTarget: 100,
    revenueTargetLabel: 'HK$100',
    secondaryTarget: null,
    hasBurdenPrediction: true,
    timeLimit: null,
    sliderZones: { green: [1, 4], amber: [5, 7], red: [8, 10] },
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
