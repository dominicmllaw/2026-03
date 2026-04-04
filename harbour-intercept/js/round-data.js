// HARBOUR INTERCEPT — Round Data
// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER schedules. Replace with DSE-sourced data when ready.
// All equilibria verified to produce integer values.
// Phase 1: Demand Qd = −5P + 90  | Supply Qs = 10P − 90
// Phase 2: Demand Qd = −10P + 180 | Supply Qs = 5P − 30
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
    label: 'Round A — Inelastic Demand',
    tax: 3,
    schedule: [
      { price: 10, qd: 40, qs: 10 },  // Row 0 — pre-filled example
      { price: 12, qd: 30, qs: 30 },  // Old equilibrium
      { price: 14, qd: 20, qs: 50 },
      { price: 16, qd: 10, qs: 70 },
      { price: 18, qd:  0, qs: 90 },
    ],
    oldEqPrice: 12,
    oldEqQty:   30,
    newEqPrice: 14,   // CB = 14 − 12 = 2
    newEqQty:   20,
    consumerBurden: 2,
    producerBurden: 1,
    correctTarget: 'consumer',  // Consumer Shield
    eqPriceOptions: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    eqQtyOptions:   [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
  },
  2: {
    label: 'Round B — Elastic Demand',
    tax: 3,
    schedule: [
      { price: 10, qd: 80, qs: 20 },  // Row 0 — pre-filled example
      { price: 12, qd: 60, qs: 30 },
      { price: 14, qd: 40, qs: 40 },  // Old equilibrium
      { price: 16, qd: 20, qs: 50 },
      { price: 18, qd:  0, qs: 60 },
    ],
    oldEqPrice: 14,
    oldEqQty:   40,
    newEqPrice: 15,   // CB = 15 − 14 = 1  (P=15 falls between table rows)
    newEqQty:   30,
    consumerBurden: 1,
    producerBurden: 2,
    correctTarget: 'producer',  // Producer Armour
    eqPriceOptions: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    eqQtyOptions:   [0, 10, 20, 30, 40, 50, 60, 70, 80],
  },
  3: {
    label: 'Final Intercept — PED = 0',
    tax: 3,
    cardA: { newPrice: 15, cb: 3, pb: 0, correct: true  },  // Correct
    cardB: { newPrice: 14, cb: 2, pb: 1, correct: false },  // Misconception
    correctRaid: 'A',
  },
};
