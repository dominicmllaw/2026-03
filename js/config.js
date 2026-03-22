// Tax Adviser Arena — Game Configuration
// All round parameters, targets, and constants

export const TOTAL_GROUPS = 16;

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
// Interpretation:
//   Larger b (steeper inverse demand) → MORE consumer burden
//   Larger d (steeper inverse supply) → MORE producer burden
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

export const ROUNDS = [
  null, // index 0 unused (rounds are 1-indexed)

  // ═══════════════════════════════════════════════════════════════
  // Round 1: Tobacco Tax — Inelastic Demand, Elastic Supply
  // ═══════════════════════════════════════════════════════════════
  // Consumer burden = b/(b+d) = 2.0/2.5 = 80%
  // PED at eq = P₀/(b·Q₀) = 60/(2.0×60) = 0.50  → inelastic ✓
  // PES at eq = P₀/(d·Q₀) = 60/(0.5×60) = 2.00  → elastic ✓
  // Equilibrium at P₀=60 < a/2=90 → lower half of D curve ✓
  // Supply intercept c=30>0 → elastic supply ✓
  {
    id: 1,
    title: 'The Easy Win',
    subtitle: 'Tobacco Tax',
    market: 'Cigarettes',
    scenario: 'Hong Kong is considering an additional unit tax on cigarettes. A pack currently costs around HK$60. The government wants to raise revenue from this market.',
    demandClue: 'Research shows that most smokers find it extremely difficult to quit — cigarette demand is very unresponsive to price changes.',
    supplyClue: 'Tobacco companies can easily scale production up or down at low cost — supply is very responsive to price.',
    demandElasticity: 'inelastic',
    supplyElasticity: 'elastic',
    unit: 'HK$ per pack',
    a: 180,    // demand intercept
    b: 2.0,    // demand slope (large = inelastic = steep)
    c: 30,     // supply intercept (positive = elastic supply)
    d: 0.5,    // supply slope (small = elastic = gentle)
    // Equilibrium: Q₀ = (180−30)/(2.0+0.5) = 60,  P₀ = 180 − 2.0×60 = 60
    schedulePrices: [20, 40, 60, 80, 100],
    sliderMin: 1,
    sliderMax: 20,
    sliderStep: 0.5,
    sliderDefault: 5,
    revenueTarget: 300,
    revenueTargetLabel: 'HK$300',
    secondaryTarget: null,
    hasBurdenPrediction: false,
    timeLimit: null,
  },

  // ═══════════════════════════════════════════════════════════════
  // Round 2: Sugary Drinks Tax — Elastic Demand, Inelastic Supply
  // ═══════════════════════════════════════════════════════════════
  // Consumer burden = b/(b+d) = 0.15/0.45 = 33%
  // PED at eq = P₀/(b·Q₀) = 10/(0.15×53.33) = 1.25  → elastic ✓
  // PES at eq = P₀/(d·Q₀) = 10/(0.30×53.33) = 0.63  → inelastic ✓
  // Equilibrium at P₀=10 > a/2=9 → upper half of D curve ✓
  // Supply intercept c=−6<0 → inelastic supply ✓
  {
    id: 2,
    title: 'The Surprise',
    subtitle: 'Sugary Drinks Tax',
    market: 'Bottled soft drinks',
    scenario: 'Hong Kong is considering a sugar tax on bottled soft drinks. A bottle currently costs around HK$10. The government wants to raise the same revenue target as Round 1.',
    demandClue: 'Consumers can easily switch to water, tea, or sugar-free alternatives — demand is very responsive to price changes.',
    supplyClue: 'Bottling companies have committed to expensive factory equipment and long-term sugar contracts — it is costly to change output levels.',
    demandElasticity: 'elastic',
    supplyElasticity: 'inelastic',
    unit: 'HK$ per bottle',
    a: 18,
    b: 0.15,
    c: -6,
    d: 0.30,
    // Equilibrium: Q₀ = (18+6)/(0.15+0.30) = 53.33,  P₀ = 18 − 0.15×53.33 = 10
    schedulePrices: [3, 6, 10, 13, 16],
    sliderMin: 1,
    sliderMax: 15,
    sliderStep: 0.5,
    sliderDefault: 3,
    revenueTarget: 300,
    revenueTargetLabel: 'HK$300',
    secondaryTarget: null,
    hasBurdenPrediction: true,
    timeLimit: null,
  },

  // ═══════════════════════════════════════════════════════════════
  // Round 3: Plastic Bag Levy — Elastic Demand, Elastic Supply
  // ═══════════════════════════════════════════════════════════════
  // Consumer burden = b/(b+d) = 0.50/1.00 = 50% — roughly even split
  // PED at eq = P₀/(b·Q₀) = 4.5/(0.5×7) = 1.29  → elastic ✓
  // PES at eq = P₀/(d·Q₀) = 4.5/(0.5×7) = 1.29  → elastic ✓
  // Equilibrium at P₀=4.5 > a/2=4 → upper half of D curve ✓
  // Supply intercept c=1>0 → elastic supply ✓
  {
    id: 3,
    title: 'The Boss Round',
    subtitle: 'Plastic Bag Levy',
    market: 'Plastic shopping bags',
    scenario: 'Hong Kong wants to further increase its plastic bag levy. A bag currently has a market price of about HK$4.50. You must hit TWO targets: raise enough revenue AND keep the consumer price increase manageable.',
    demandClue: 'Many shoppers already bring reusable bags — demand is quite responsive to price changes.',
    supplyClue: 'Plastic bags are extremely cheap to produce and producers can easily adjust output — supply is also very responsive.',
    demandElasticity: 'elastic',
    supplyElasticity: 'elastic',
    unit: 'HK$ per bag',
    a: 8,
    b: 0.50,
    c: 1,
    d: 0.50,
    // Equilibrium: Q₀ = (8−1)/(0.5+0.5) = 7,  P₀ = 8 − 0.5×7 = 4.5
    schedulePrices: [1.5, 3, 4.5, 6, 7.5],
    sliderMin: 0.5,
    sliderMax: 5,
    sliderStep: 0.25,
    sliderDefault: 1,
    revenueTarget: 5,
    revenueTargetLabel: 'HK$5',
    secondaryTarget: {
      type: 'maxPriceIncrease',
      value: 2.0,
      label: 'Keep consumer price increase below HK$2.00',
    },
    hasBurdenPrediction: true,
    timeLimit: 120,
  },

  // ═══════════════════════════════════════════════════════════════
  // Bonus Round: Transport Subsidy — Inelastic Demand, Very Inelastic Supply
  // ═══════════════════════════════════════════════════════════════
  // The "subsidy trap": producers capture most benefit because supply
  // is even more inelastic than demand.
  //
  // Consumer benefit = b/(b+d) = 0.30/1.00 = 30%
  // Producer benefit = d/(b+d) = 0.70/1.00 = 70%  ← operators capture most!
  //
  // PED at eq = P₀/(b·Q₀) = 5.4/(0.30×22) = 0.82  → inelastic ✓
  // PES at eq = P₀/(d·Q₀) = 5.4/(0.70×22) = 0.35  → very inelastic ✓
  // Equilibrium at P₀=5.4 < a/2=6 → lower half of D curve ✓
  // Supply intercept c=−10<0 → inelastic supply ✓
  //
  // Since PES < PED (supply more inelastic), producers are the
  // more inelastic side → they capture MORE of the subsidy benefit.
  {
    id: 4,
    title: 'The Subsidy Trap',
    subtitle: 'Elderly Minibus Subsidy',
    market: 'Minibus fares for elderly',
    scenario: 'The government wants to subsidise minibus fares for elderly passengers. A ride currently costs around HK$5. Set a per-ride subsidy to increase ridership. But who really benefits — the elderly or the operators?',
    demandClue: 'Elderly residents rely heavily on minibuses for daily errands — they have very limited alternatives and will keep riding regardless of small price changes.',
    supplyClue: 'Minibus operators face strict licensing regulations and high fixed costs — it is very difficult to add more routes or vehicles, even when demand rises.',
    demandElasticity: 'inelastic',
    supplyElasticity: 'very inelastic',
    unit: 'HK$ per ride (subsidy)',
    a: 12,
    b: 0.30,
    c: -10,
    d: 0.70,
    // Equilibrium: Q₀ = (12+10)/(0.30+0.70) = 22,  P₀ = 12 − 0.30×22 = 5.4
    schedulePrices: [2, 4, 5.4, 8, 10],
    sliderMin: 0.5,
    sliderMax: 5,
    sliderStep: 0.25,
    sliderDefault: 2,
    revenueTarget: null,
    subsidyBudget: 80,
    subsidyBudgetLabel: 'HK$80',
    quantityTarget: 3,
    quantityTargetLabel: 'Increase ridership by at least 3 rides',
    secondaryTarget: null,
    hasBurdenPrediction: true,
    burdenPredictionLabel: 'Who benefits more from the subsidy?',
    isSubsidy: true,
    timeLimit: null,
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
