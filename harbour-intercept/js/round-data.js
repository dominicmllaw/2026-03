// HARBOUR INTERCEPT — Round Data
// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 source: HKDSE 2019 Paper 1 Q14 (2019-14) — imported soybeans tariff
//   Demand given in question. Supply derived from equilibria: Qs = 200P − 1600.
//   Old eq P=$11, Q=600. After $3 tariff: new eq P_c=$13, Q=400. CB=$2, PB=$1.
//
// Phase 2 source: HKDSE 1994 Paper 1 Q8–9 (1994-08/09) — wine tax (complete)
//   Both Qd and Qs given. Old eq P=$34, Q=70.
//   After $6 tax: new eq P_c=$36, Q=60. CB=$2, PB=$4.
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
    // 1994 DSE Q8–9: $6/unit tax on wine. Complete schedule (Qd and Qs both given).
    // Old eq P=$34, Q=70. After $6 tax: new eq P_c=$36, Q=60. CB=$2, PB=$4.
    // S1 gate: Row 0 pre-filled (P=$30+$6=$36). New eq row visible: P=$36, Qd=60=Qs(P=30)=60.
    taxLabel: '$6 per unit tax on wine',
    tax: 6,
    schedule: [
      { price: 30, qd: 90, qs: 60 },  // Row 0 — pre-filled (new price = $36)
      { price: 32, qd: 80, qs: 65 },
      { price: 34, qd: 70, qs: 70 },  // ← old equilibrium
      { price: 36, qd: 60, qs: 75 },
      { price: 38, qd: 50, qs: 80 },
    ],
    oldEqPrice: 34,
    oldEqQty:   70,
    newEqPrice: 36,   // CB = 36 − 34 = 2
    newEqQty:   60,
    consumerBurden: 2,
    producerBurden: 4,
    correctTarget: 'producer',  // Producer Armour
    eqPriceOptions: [30, 32, 34, 36, 38, 40, 42, 44],
    eqQtyOptions:   [50, 55, 60, 65, 70, 75, 80, 85, 90],
  },
  3: {
    label: 'Final Intercept — PED = 0',
    tax: 3,
    cardA: { newPrice: 15, cb: 3, pb: 0, correct: true  },  // Correct
    cardB: { newPrice: 14, cb: 2, pb: 1, correct: false },  // Misconception
    correctRaid: 'A',
  },
};
