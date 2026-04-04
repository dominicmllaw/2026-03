// HARBOUR INTERCEPT — Round Data
// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 source: HKDSE 2019 Paper 1 Q14 (2019-14) — imported soybeans tariff
//   Demand given in question. Supply derived from equilibria: Qs = 200P − 1600.
//   Old eq P=$11, Q=600. After $3 tariff: new eq P_c=$13, Q=400. CB=$2, PB=$1.
//
// Phase 2 source: DSE exam — Good Y, $3/unit tax. Both Qd and Qs given.
//   Prices in descending order (6→2). Old eq P=$3, Q=30.
//   After $3 tax: new eq P_c=$5, Q=20. CB=$2, PB=$1.
//
// Phase 3 source: DSE exam — Good Z, $3/unit tax. Demand schedule only.
//   Old eq P=$12 (given), Q=140. New eq P=$13 (given), Q=120. CB=$1, PB=$2.
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
    label:    'Round B — Good Y',
    // DSE exam: $3/unit tax on Good Y. Both schedules given. Prices descending.
    // Old eq P=$3, Q=30. After $3 tax: new eq P_c=$5, Q=20. CB=$2, PB=$1.
    taxLabel: '$3 per unit tax on Good Y',
    tax: 3,
    schedule: [
      { price: 6, qd: 10, qs: 60 },
      { price: 5, qd: 20, qs: 50 },
      { price: 4, qd: 25, qs: 40 },
      { price: 3, qd: 30, qs: 30 },  // ← old equilibrium
      { price: 2, qd: 50, qs: 20 },
    ],
    oldEqPrice: 3,
    oldEqQty:   30,
    newEqPrice: 5,    // CB = 5 − 3 = 2; PB = 3 − 2 = 1
    newEqQty:   20,
    consumerBurden: 2,
    producerBurden: 1,
    correctTarget: 'consumer',  // Consumer Shield
    eqPriceOptions: [2, 3, 4, 5, 6, 7, 8],
    eqQtyOptions:   [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
  },
  3: {
    label:    'Final Intercept — Good Z',
    // DSE exam: $3/unit tax on Good Z. Demand schedule only (no supply given).
    // Old eq P=$12 and new eq P=$13 given; students read Q from demand table.
    // Old eq Q=140, new eq Q=120. CB=$1, PB=$2.
    taxLabel: '$3 per unit tax on Good Z',
    tax: 3,
    phaseType: 'demand-only',   // no supply column — different gate flow
    schedule: [
      { price: 11, qd: 160 },
      { price: 12, qd: 140 },  // ← old equilibrium
      { price: 13, qd: 120 },  // ← new equilibrium
      { price: 14, qd: 100 },
    ],
    oldEqPrice: 12,
    oldEqQty:   140,
    newEqPrice: 13,   // CB = 13 − 12 = 1; PB = 3 − 1 = 2
    newEqQty:   120,
    consumerBurden: 1,
    producerBurden: 2,
    correctTarget: 'producer',  // Producer Armour
    eqQtyOptions:  [100, 110, 120, 130, 140, 150, 160],
  },
};
