// HARBOUR INTERCEPT — Round Data
// ─────────────────────────────────────────────────────────────────────────────
// Engagement 1 — Object X, $2/unit tax. Ed = Es → equal burden → Core Unit.
// Engagement 2 — Target Y, $3/unit tax. Ed < Es → CB > PB → Rear Section.
// Engagement 3 — Threat Z, $5/unit tax. Ed > Es → PB > CB → Body Armour.
// ─────────────────────────────────────────────────────────────────────────────

export const STUDENTS = [
  'CHAN HO YEUNG',
  'CHAN PAK LAM ANSON',
  'CHAN TING LAI DAISY',
  'CHAN TSANG MING JIMMY',
  'CHEN LIANGXUAN',
  'CHEUNG YING CHI GIGI',
  'CHIU CHUN FAI',
  'CHUNG YUEN MEI IVANA',
  'FENG CHI KIT',
  'HARIS',
  'HUANG DEVON',
  'HUANG YAU WAI',
  'IP CHEUK HIN',
  'KONG HIU YI',
  'KWONG YUK SUM SADIE',
  'LAM WAI CHING',
  'LAW HEI LAM YURI',
  'LAW MAN PAN',
  'LIN KAI NOK',
  'MA KA SHUEN KYLE',
  'PAN ZIHAO JACKO',
  'SIU PAK LAM AARON',
  'TAM CHUN HIN',
  'WONG HOI MAN CRYSTAL',
  'WU CHEUK YAN',
  'XIAO HOI LAM KELLY',
  'XU JIAXIN KARY',
  'YAU LAP MAN',
  'YE YI',
  'YU RAN',
  'YUNG YU LAM',
];

export const PHASES = {
  1: {
    // Engagement 1 — Object X: $2/unit tax. Equal burden (Ed = Es) → Core Unit.
    // P=1–5, Qd=50↓10, Qs=10↑50. Old eq P=$3 Q=30. New eq P=$4 Q=20.
    // CB = $4−$3 = $1. PB = $2−$1 = $1. Equal → Core Unit (中枢部).
    label:    'Engagement 1 — Object X',
    taxLabel: '$2 per unit tax on Object X',
    tax: 2,
    schedule: [
      { price: 1, qd: 50, qs: 10 },
      { price: 2, qd: 40, qs: 20 },
      { price: 3, qd: 30, qs: 30 },  // ← old equilibrium
      { price: 4, qd: 20, qs: 40 },  // ← new equilibrium (Qd = new Qs(S2))
      { price: 5, qd: 10, qs: 50 },
    ],
    oldEqPrice: 3,
    oldEqQty:   30,
    newEqPrice: 4,   // CB = 4 − 3 = 1
    newEqQty:   20,
    consumerBurden:  1,
    producerBurden:  1,
    correctTarget:   'core',       // Ed = Es → Core Unit (中枢部)
    correctElasticity: 'elastic',
    eqPriceOptions:  [1, 2, 3, 4, 5, 6, 7],
    eqQtyOptions:    [10, 15, 20, 25, 30, 35, 40, 45, 50],
  },

  2: {
    // Engagement 2 — Target Y: $3/unit tax. CB > PB (Ed < Es) → Rear Section.
    // Prices descending P=6→2. Old eq P=$3 Q=30. New eq P=$5 Q=20.
    // CB = $5−$3 = $2. PB = $3−$2 = $1. Consumer bears more → Rear Section (後部区画).
    label:    'Engagement 2 — Target Y',
    taxLabel: '$3 per unit tax on Target Y',
    tax: 3,
    schedule: [
      { price: 6, qd: 10, qs: 60 },
      { price: 5, qd: 20, qs: 50 },  // ← new equilibrium
      { price: 4, qd: 25, qs: 40 },
      { price: 3, qd: 30, qs: 30 },  // ← old equilibrium
      { price: 2, qd: 50, qs: 20 },
    ],
    oldEqPrice: 3,
    oldEqQty:   30,
    newEqPrice: 5,    // CB = 5 − 3 = 2; PB = 3 − 2 = 1
    newEqQty:   20,
    consumerBurden:  2,
    producerBurden:  1,
    correctTarget:   'rear',      // Ed < Es → Rear Section (後部区画)
    correctElasticity: 'inelastic',
    eqPriceOptions:  [2, 3, 4, 5, 6, 7, 8],
    eqQtyOptions:    [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
  },

  3: {
    // Engagement 3 — Threat Z: $5/unit tax. Demand-only schedule.
    // Old eq P=$12 Q=140 (given). New eq P=$14 Q=100.
    // CB = $14−$12 = $2. PB = $5−$2 = $3. Producer bears more → Body Armour (装甲部).
    label:    'Engagement 3 — Threat Z',
    taxLabel: '$5 per unit tax on Threat Z',
    tax: 5,
    phaseType: 'demand-only',
    schedule: [
      { price: 11, qd: 160 },
      { price: 12, qd: 140 },  // ← old equilibrium
      { price: 13, qd: 120 },
      { price: 14, qd: 100 },  // ← new equilibrium
      { price: 15, qd: 80  },
    ],
    oldEqPrice: 12,
    oldEqQty:   140,
    newEqPrice: 14,   // CB = 14 − 12 = 2; PB = 5 − 2 = 3
    newEqQty:   100,
    consumerBurden:  2,
    producerBurden:  3,
    correctTarget:   'body',      // Ed > Es → Body Armour (装甲部)
    correctElasticity: 'elastic',
    eqPriceOptions:  [11, 12, 13, 14, 15],
    eqQtyOptions:    [80, 90, 100, 110, 120, 130, 140, 150, 160],
  },
};
