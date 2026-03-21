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

// Linear S/D model: Pd = a - b*Q (demand), Ps = c + d*Q (supply)
// Consumer burden % = d/(b+d) * 100
// Producer burden % = b/(b+d) * 100
//
// Calibration notes:
// - b small relative to d → inelastic demand → consumers bear more
// - b large relative to d → elastic demand → producers bear more

export const ROUNDS = [
  null, // index 0 unused (rounds are 1-indexed)

  // ── Round 1: Tobacco Tax (Inelastic Demand, No Prediction) ──
  {
    id: 1,
    title: 'The Easy Win',
    subtitle: 'Tobacco Tax',
    market: 'Cigarettes',
    scenario: 'Hong Kong is considering an additional unit tax on cigarettes. A pack currently costs around HK$60. The government wants to raise revenue from this market.',
    demandClue: 'Research shows that most smokers find it extremely difficult to quit — cigarette demand is very unresponsive to price changes.',
    supplyClue: 'Tobacco companies can adjust production volume without major cost changes.',
    unit: 'HK$ per pack',
    // Demand: very inelastic (b=0.15), Supply: relatively elastic (d=0.60)
    // Consumer burden = 0.60/(0.15+0.60) = 80%
    // Producer burden = 0.15/(0.15+0.60) = 20%
    a: 75,    // demand intercept
    b: 0.15,  // demand slope (small = inelastic)
    c: 45,    // supply intercept
    d: 0.60,  // supply slope (large = elastic)
    // Equilibrium: Q* = (75-45)/(0.15+0.60) = 40, P* = 75-0.15*40 = 69
    // Actual P* = 69 (close enough to $60 context; the $60 is "current" before this additional tax)
    sliderMin: 1,
    sliderMax: 20,
    sliderStep: 0.5,
    sliderDefault: 5,
    revenueTarget: 300,  // Target revenue in HK$
    revenueTargetLabel: 'HK$300',
    secondaryTarget: null,
    hasBurdenPrediction: false,
    timeLimit: null, // no timer for round 1
  },

  // ── Round 2: Sugary Drinks Tax (Elastic Demand, With Prediction) ──
  {
    id: 2,
    title: 'The Surprise',
    subtitle: 'Sugary Drinks Tax',
    market: 'Bottled soft drinks',
    scenario: 'Hong Kong is considering a sugar tax on bottled soft drinks. A bottle currently costs around HK$10. The government wants to raise the same revenue target as Round 1.',
    demandClue: 'Consumers can easily switch to water, tea, or sugar-free alternatives — demand is very responsive to price changes.',
    supplyClue: 'Bottling companies have fixed factory costs but can adjust output moderately.',
    unit: 'HK$ per bottle',
    // Demand: relatively elastic (b=0.80), Supply: moderately elastic (d=0.40)
    // Consumer burden = 0.40/(0.80+0.40) = 33%
    // Producer burden = 0.80/(0.80+0.40) = 67%
    a: 22,
    b: 0.80,
    c: 2,
    d: 0.40,
    // Equilibrium: Q* = (22-2)/(0.80+0.40) = 16.67, P* = 22-0.80*16.67 = 8.67
    sliderMin: 1,
    sliderMax: 15,
    sliderStep: 0.5,
    sliderDefault: 3,
    revenueTarget: 300,  // Same target as R1 — the surprise!
    revenueTargetLabel: 'HK$300',
    secondaryTarget: null,
    hasBurdenPrediction: true,
    timeLimit: null,
  },

  // ── Round 3: Plastic Bag Levy (Dual Target, Speed Challenge) ──
  {
    id: 3,
    title: 'The Boss Round',
    subtitle: 'Plastic Bag Levy',
    market: 'Plastic shopping bags',
    scenario: 'Hong Kong wants to further increase its plastic bag levy (currently HK$1 per bag). You must hit TWO targets: raise enough revenue AND keep the consumer price increase manageable.',
    demandClue: 'Many shoppers already bring reusable bags — demand is moderately responsive to price.',
    supplyClue: 'Plastic bags are extremely cheap to produce — supply is highly responsive.',
    unit: 'HK$ per bag',
    // Demand: moderately elastic (b=0.50), Supply: highly elastic (d=2.00)
    // Consumer burden = 2.00/(0.50+2.00) = 80%
    // Producer burden = 0.50/(0.50+2.00) = 20%
    a: 8,
    b: 0.50,
    c: 0.5,
    d: 2.00,
    // Equilibrium: Q* = (8-0.5)/(0.50+2.00) = 3.0, P* = 8-0.50*3.0 = 6.5
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
    timeLimit: 120, // 2 minutes — speed pressure
  },

  // ── Bonus Round: Transport Subsidy (Subsidy Trap) ──
  {
    id: 4,
    title: 'The Subsidy Trap',
    subtitle: 'Elderly Minibus Subsidy',
    market: 'Minibus fares for elderly',
    scenario: 'The government wants to subsidise minibus fares for elderly passengers. A ride currently costs around HK$5. Set a per-ride subsidy to increase ridership. But who really benefits — the elderly or the operators?',
    demandClue: 'Elderly residents rely heavily on minibuses for daily errands — they have limited alternatives.',
    supplyClue: 'Minibus operators can add extra routes during peak hours if profitable.',
    unit: 'HK$ per ride (subsidy)',
    // Demand: relatively inelastic (b=0.20), Supply: moderately elastic (d=0.60)
    // Consumer benefit share = d/(b+d) = 0.60/0.80 = 75% — but this is the PRODUCER share for subsidy
    // Wait — for a subsidy, the incidence is the same formula:
    // Consumer gets benefit proportional to supply elasticity: d/(b+d) = 75%
    // Producer gets benefit proportional to demand elasticity: b/(b+d) = 25%
    // Hmm, but the brief says producers should capture a significant share.
    // Let me flip: make demand more elastic relative to supply.
    // Actually: consumer benefit from subsidy = d/(b+d), producer benefit = b/(b+d)
    // If demand is inelastic (b small), consumers get MORE benefit.
    // For the "subsidy trap" to work (producers capture more), we need b > d.
    // So: elderly demand inelastic but SUPPLY also inelastic (operators can't easily expand)
    // Revised: b=0.60 (demand somewhat elastic-ish), d=0.20 (supply inelastic)
    // Consumer benefit = 0.20/(0.60+0.20) = 25%, Producer benefit = 75% — yes!
    // This creates the "operators capture the subsidy" surprise.
    a: 12,
    b: 0.60,
    c: 1,
    d: 0.20,
    // Equilibrium: Q* = (12-1)/(0.60+0.20) = 13.75, P* = 12-0.60*13.75 = 3.75
    sliderMin: 0.5,
    sliderMax: 5,
    sliderStep: 0.25,
    sliderDefault: 2,
    revenueTarget: null, // No revenue target for subsidy
    subsidyBudget: 30,
    subsidyBudgetLabel: 'HK$30',
    quantityTarget: 3, // Increase ridership by at least 3 rides
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
