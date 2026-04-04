// HARBOUR INTERCEPT — Round Data
// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 source: HKDSE 2019 Paper 1 Q14 (2019-14) — imported soybeans tariff
//   Demand given in question. Supply derived from equilibria: Qs = 200P − 1600.
//   Old eq P=$11, Q=600. After $3 tariff: new eq P_c=$13, Q=400. CB=$2, PB=$1.
//
// Phase 2 source: HKDSE 2003 Paper 1 Q11 (2003-11) — Good X, $3/unit tax
//   Supply derived from equilibria: Qs = 10P + 20. Old eq P=$12, Q=140.
//   After $3 tax: new eq P_c=$13, Q=120. CB=$1, PB=$2.
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
    label:    'Round A — Inelastic Demand',
    // 2019 DSE Q14: $3/unit tariff on imported soybeans. Demand elastic < supply.
    // Supply column derived: Qs = 200P − 1600 (verified at old and new equilibria).
    taxLabel: '$3 per unit tariff on imported soybeans',
    tax: 3,
    schedule: [
      { price: 10, qd:  700, qs:   400 },  // Row 0 — pre-filled (new price = $13)
      { price: 11, qd:  600, qs:   600 },  // ← old equilibrium
      { price: 12, qd:  500, qs:   800 },
      { price: 13, qd:  400, qs:  1000 },
      { price: 14, qd:  300, qs:  1200 },
    ],
    oldEqPrice: 11,
    oldEqQty:   600,
    newEqPrice: 13,   // CB = 13 − 11 = 2
    newEqQty:   400,
    consumerBurden: 2,
    producerBurden: 1,
    correctTarget: 'consumer',  // Consumer Shield
    eqPriceOptions: [10, 11, 12, 13, 14, 15, 16, 17],
    eqQtyOptions:   [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200],
  },
  2: {
    label:    'Round B — Elastic Demand',
    // 2003 DSE Q11: $3/unit tax on Good X. Supply derived from equilibria (Qs = 10P + 20).
    // Old eq P=$12, Q=140. After $3 tax: new eq P_c=$13, Q=120. CB=$1, PB=$2.
    // Same tax ($3) and price range (P=10–14) as Phase 1 — only elasticity differs.
    taxLabel: '$3 per unit tax on producers',
    tax: 3,
    schedule: [
      { price: 10, qd: 180, qs: 120 },
      { price: 11, qd: 160, qs: 130 },
      { price: 12, qd: 140, qs: 140 },  // ← old equilibrium
      { price: 13, qd: 120, qs: 150 },
      { price: 14, qd: 100, qs: 160 },
    ],
    oldEqPrice: 12,
    oldEqQty:   140,
    newEqPrice: 13,   // CB = 13 − 12 = 1; PB = 3 − 1 = 2
    newEqQty:   120,
    consumerBurden: 1,
    producerBurden: 2,
    correctTarget: 'producer',  // Producer Armour
    eqPriceOptions: [10, 11, 12, 13, 14, 15, 16, 17],
    eqQtyOptions:   [100, 110, 120, 130, 140, 150, 160, 170, 180],
  },
  3: {
    label:    'Final Intercept — PED = 0',
    // Constructed scenario: perfectly inelastic demand (Qd constant at 60).
    // Students discover that ALL burden falls on consumers when PED = 0.
    // Old eq P=$14, Q=60. After $3 tax: new eq P_c=$17, Q=60. CB=$3, PB=$0.
    taxLabel: '$3 per unit tax on producers',
    tax: 3,
    schedule: [
      { price: 13, qd: 60, qs: 50 },
      { price: 14, qd: 60, qs: 60 },  // ← old equilibrium
      { price: 15, qd: 60, qs: 70 },
      { price: 16, qd: 60, qs: 80 },
      { price: 17, qd: 60, qs: 90 },
    ],
    oldEqPrice: 14,
    oldEqQty:   60,
    newEqPrice: 17,   // CB = 17 − 14 = 3 = full tax; PB = 0
    newEqQty:   60,
    consumerBurden: 3,
    producerBurden: 0,
    correctTarget: 'consumer',  // Consumer Shield — ALL burden on consumers
    eqPriceOptions: [13, 14, 15, 16, 17, 18, 19, 20],
    eqQtyOptions:   [50, 55, 60, 65, 70, 75, 80, 85, 90],
  },
};
