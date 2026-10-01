// Real battle reports as engine configs, with the real per-squad losses. Shared by the
// regression tests and the calibration script. Not a test file itself (no .test.js suffix).
//
// Attacker stats never appear in a report, so each report carries a stat RANGE the fit may
// search: a player hint where one exists, otherwise a wide default.

const TIERS = ['t1', 't2', 't3', 't4', 't5'];
export const grid = (o = {}) => {
  const t = {};
  for (const tk of TIERS) t[tk] = { inf: 0, rng: 0, cav: 0, sie: 0, ...(o[tk] || {}) };
  return t;
};

// The player's Leader-Deployed stat block (normal war gear, effective ~460-475% ATK).
export const PLAYER_STATS = {
  inf:  { atk: 302.49, def: 229.85, hp: 201.72 },
  rng:  { atk: 318.54, def: 184.95, hp: 185.83 },
  cav:  { atk: 309.72, def: 194.47, hp: 201.08 },
  sie:  { atk: 0,      def: 0,      hp: 0      },
  army: { atk: 155.45, def: 226.75, hp: 348.00 }
};
// Report 7 was fought without war gear: "closer to 230 than my normal 480" — scaled down.
const scaled = (s, f) => Object.fromEntries(Object.entries(s).map(([k, v]) =>
  [k, { atk: v.atk * f, def: v.def * f, hp: v.hp * f }]));
export const PLAYER_STATS_NO_GEAR = scaled(PLAYER_STATS, 230 / 480);

const WIDE = { atk: [300, 1600], def: [100, 1600], hp: [100, 1600] };
const wallDown = { maxHp: 564835, pct: 0, traps: 0, atk: 60.84, def: 66.92 };

export const REPORTS = [
  {
    id: 'R2', note: 'Defender win. 100k all-T4 8-5-7 march wiped; lineup not recorded (Infantry Phalanx assumed).',
    attacker: 'R2', stats: WIDE,
    cfg: {
      troops: grid({ t1: { rng: 1, cav: 16880 }, t2: { cav: 201251 }, t4: { inf: 252301, rng: 208689, cav: 245571, sie: 5036 } }),
      def: { stats: PLAYER_STATS, formation: 'cav', stance: 'phalanx', wall: wallDown, infirmary: 500000, sanctuary: 0, familiar: 20 },
      atk: { troops: grid({ t4: { inf: 40000, rng: 25000, cav: 35000 } }), formation: 'inf', stance: 'phalanx', familiar: 20 }
    },
    real: { def: { t1cav: 16880, t2cav: 46447 }, defTotal: 63327, atk: 'wiped', atkTotal: 100000 }
  },
  {
    id: 'R3', note: 'Ranged Wedge 256k (mana 1) vs Cavalry Phalanx 908k, both survive.',
    attacker: 'R3', stats: WIDE,
    cfg: {
      troops: grid({ t1: { cav: 3654 }, t2: { cav: 152501 }, t4: { inf: 252325, rng: 249293, cav: 250186 } }),
      def: { stats: PLAYER_STATS, formation: 'cav', stance: 'phalanx', wall: wallDown, infirmary: 500000, sanctuary: 0, familiar: 20 },
      atk: { troops: grid({ t5: { cav: 132018 }, t4: { inf: 4000, rng: 4000, cav: 115982 } }), formation: 'rng', stance: 'wedge',
             mana: { inf: 1, rng: 1, cav: 1 }, familiar: 20 }
    },
    real: { def: { t1cav: 3654, t2cav: 124886, t4cav: 153670 }, defTotal: 282210,
            atk: { t5cav: 45035, t4rng: 2000, t4cav: 57990 }, atkTotal: 105025 }
  },
  {
    id: 'R4', note: 'Chaos Arena. 378k T5/T4 cavalry in a Ranged Phalanx wiped; 564,835 HP wall destroyed, 0 traps.',
    attacker: 'TOMAS', stats: WIDE,
    cfg: {
      event: true,
      troops: grid({ t1: { inf: 59138, rng: 46077, cav: 19059, sie: 157214 }, t2: { inf: 163278, rng: 158080, cav: 166474 },
                     t3: { inf: 143400, rng: 159578, cav: 131110 }, t4: { inf: 328727, rng: 339867, cav: 330724, sie: 18308 } }),
      def: { stats: PLAYER_STATS, formation: 'rng', stance: 'phalanx', wall: { ...wallDown, pct: 100 }, infirmary: 3000000, sanctuary: 0, familiar: 20 },
      atk: { troops: grid({ t5: { cav: 135044 }, t4: { cav: 242956 } }), formation: 'rng', stance: 'phalanx', familiar: 20 }
    },
    real: { def: { t1rng: 46077, t2rng: 66513 }, defTotal: 112590, atk: 'wiped', atkTotal: 378000, wallFalls: true }
  },
  {
    id: 'R5', note: 'Chaos Arena. HADY (~600 ATK) Infantry Phalanx 378k wiped vs Ranged Phalanx, wall down.',
    attacker: 'HADY', stats: { atk: [550, 650], def: [100, 1600], hp: [100, 1600] },
    cfg: {
      event: true,
      troops: grid({ t1: { inf: 59138, cav: 19059, sie: 157214 }, t2: { inf: 163278, rng: 91567, cav: 166474 },
                     t3: { inf: 143400, rng: 159578, cav: 131110 }, t4: { inf: 328727, rng: 339867, cav: 330724, sie: 18308 } }),
      def: { stats: PLAYER_STATS, formation: 'rng', stance: 'phalanx', wall: wallDown, infirmary: 3000000, sanctuary: 0, familiar: 20 },
      atk: { troops: grid({ t4: { inf: 374902, sie: 3098 } }), formation: 'inf', stance: 'phalanx', familiar: 20 }
    },
    real: { def: { t2rng: 91567, t3rng: 159578, t4rng: 45601 }, defTotal: 296746, atk: 'wiped', atkTotal: 378000 }
  },
  {
    id: 'R6', note: 'Chaos Arena. HADY Infantry Phalanx 378k wiped vs Ranged WEDGE (same garrison as R4), wall down.',
    attacker: 'HADY', stats: { atk: [550, 650], def: [100, 1600], hp: [100, 1600] },
    cfg: {
      event: true,
      troops: grid({ t1: { inf: 59138, rng: 46077, cav: 19059, sie: 157214 }, t2: { inf: 163278, rng: 158080, cav: 166474 },
                     t3: { inf: 143400, rng: 159578, cav: 131110 }, t4: { inf: 328727, rng: 339867, cav: 330724, sie: 18308 } }),
      def: { stats: PLAYER_STATS, formation: 'rng', stance: 'wedge', wall: wallDown, infirmary: 3000000, sanctuary: 0, familiar: 20 },
      atk: { troops: grid({ t4: { inf: 123493, rng: 150396, cav: 104111 } }), formation: 'inf', stance: 'phalanx', familiar: 20 }
    },
    real: { def: { t1rng: 23038, t2rng: 79039, t3rng: 33260 }, defTotal: 135337, atk: 'wiped', atkTotal: 378000 }
  },
  {
    id: 'R7', note: 'Max account (mana 3, ~1000-1100 ATK) Infantry Phalanx 390k vs Ranged Phalanx 3.68M without war gear; wall + 13,719 traps destroyed.',
    attacker: 'MARIA', stats: { atk: [1000, 1100], def: [100, 1600], hp: [100, 1600] },
    cfg: {
      troops: grid({ t1: { inf: 40608, rng: 60975, cav: 46073, sie: 88664 }, t2: { inf: 671188, rng: 671918, cav: 681324 },
                     t3: { inf: 114718, rng: 127661, cav: 104886 }, t4: { inf: 351422, rng: 345234, cav: 347511, sie: 27645 } }),
      def: { stats: PLAYER_STATS_NO_GEAR, formation: 'rng', stance: 'phalanx', wall: { ...wallDown, pct: 100, traps: 13719 },
             infirmary: 69227, sanctuary: 0, familiar: 20 },
      atk: { troops: grid({ t5: { inf: 85000, rng: 60000, cav: 60000 }, t4: { inf: 80000, rng: 50000, cav: 49000, sie: 6000 } }),
             formation: 'inf', stance: 'phalanx', mana: { inf: 3, rng: 3, cav: 3 }, familiar: 20 }
    },
    real: { def: { t1rng: 60975, t1cav: 46073, t2rng: 671918, t2cav: 362146, t3rng: 127661, t3cav: 26221, t4rng: 228161, t4cav: 12769 },
            defTotal: 1535924,
            atk: { t5inf: 42500, t5cav: 25951, t4inf: 41862, t4rng: 600, t4cav: 24500 }, atkTotal: 135413, wallFalls: true }
  }
];

const lostOf = (rows) => {
  const o = {};
  rows.forEach((r) => { o[r.tier + r.type] = (o[r.tier + r.type] || 0) + r.lost; });
  return o;
};

// Squad-level error of one simulated report: Σ|sim − real| over every squad, divided by that
// side's real total losses, summed over both sides (+1 if the wall should fall and did not).
export function reportError(rep, R) {
  const dSim = lostOf(R.defRows);
  const keys = new Set([...Object.keys(dSim), ...Object.keys(rep.real.def)]);
  let dErr = 0;
  keys.forEach((k) => { dErr += Math.abs((dSim[k] || 0) - (rep.real.def[k] || 0)); });
  let aErr;
  if (rep.real.atk === 'wiped') {
    aErr = Math.abs(R.atkLost - rep.real.atkTotal) / rep.real.atkTotal;
  } else {
    const aSim = lostOf(R.atkRows);
    const ak = new Set([...Object.keys(aSim), ...Object.keys(rep.real.atk)]);
    let s = 0;
    ak.forEach((k) => { s += Math.abs((aSim[k] || 0) - (rep.real.atk[k] || 0)); });
    aErr = s / rep.real.atkTotal;
  }
  const wall = rep.real.wallFalls && R.wallPctLeft > 0.5 ? 1 : 0;
  return dErr / rep.real.defTotal + aErr + wall;
}

export const withStats = (rep, s) => {
  const c = structuredClone(rep.cfg);
  Object.assign(c.atk, { stat: s.atk, def: s.def, hp: s.hp });
  return c;
};
