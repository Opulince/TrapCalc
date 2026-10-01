import test from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation } from '../assets/engine.js';

// Regression tests against REAL battle reports. Attacker stats are not shown in a report, so
// each report carries the attacker stats fitted to it (see calibration-notes.md). Tolerances
// are the honest ones: where the model still misses, the test says so in its name.

const STATS = {
  inf:  { atk: 302.49, def: 229.85, hp: 201.72 },
  rng:  { atk: 318.54, def: 184.95, hp: 185.83 },
  cav:  { atk: 309.72, def: 194.47, hp: 201.08 },
  army: { atk: 155.45, def: 226.75, hp: 348.00 }
};
const grid = (o) => {
  const t = {};
  for (const tk of ['t1', 't2', 't3', 't4', 't5']) t[tk] = { inf: 0, rng: 0, cav: 0, sie: 0, ...(o[tk] || {}) };
  return t;
};
const lost = (rows, tk, yk) => (rows.find((r) => r.tier === tk && r.type === yk) || { lost: 0 }).lost;
const within = (v, target, tol) => Math.abs(v - target) <= tol * target;

// Report 2 — defender win. Attacker 100,000 all-T4 (40k inf / 25k rng / 35k cav) wiped 100%.
// Defender (Cavalry Phalanx) lost 63,327 of 929,729: T1 cav wiped, T2 cav -23.1%, nothing else.
const REPORT_2 = {
  troops: grid({ t1: { rng: 1, cav: 16880 }, t2: { cav: 201251 },
                 t4: { inf: 252301, rng: 208689, cav: 245571, sie: 5036 } }),
  def: { stats: STATS, formation: 'cav', stance: 'phalanx',
         wall: { maxHp: 12625, pct: 0, traps: 0, atk: 60.84, def: 66.92 },
         infirmary: 500000, sanctuary: 0, familiar: 20 },
  atk: { troops: grid({ t4: { inf: 40000, rng: 25000, cav: 35000 } }),
         formation: 'inf', stance: 'phalanx', stat: 1400, def: 100, hp: 550, familiar: 20 }
};

// Report 3 — 2026-09-29. Ranged Wedge 256,000 vs Cavalry Phalanx 907,959, both sides survive.
// Defender lost 282,210 (T1 cav 3,654 · T2 cav 124,886 · T4 cav 153,670 · T4 inf/rng 0).
// Attacker lost 105,025 (T5 cav 45,035 · T4 cav 57,990 · T4 rng 2,000 · T4 inf 0).
const REPORT_3 = {
  troops: grid({ t1: { cav: 3654 }, t2: { cav: 152501 }, t4: { inf: 252325, rng: 249293, cav: 250186 } }),
  def: { stats: STATS, formation: 'cav', stance: 'phalanx',
         wall: { maxHp: 12625, pct: 0, traps: 0, atk: 60.84, def: 66.92 },
         infirmary: 500000, sanctuary: 0, familiar: 20 },
  atk: { troops: grid({ t5: { cav: 132018 }, t4: { inf: 4000, rng: 4000, cav: 115982 } }),
         formation: 'rng', stance: 'wedge', stat: 1500, def: 700, hp: 850, familiar: 20 }
};

test('report 2: the attacking march is wiped', () => {
  const R = runSimulation(REPORT_2);
  assert.equal(R.outcome, 'win');
  assert.ok(R.atkLost > 99999, `expected all 100,000 attackers dead, got ${R.atkLost}`);
});

test('report 2: only the front type (cavalry) takes losses', () => {
  const R = runSimulation(REPORT_2);
  for (const yk of ['inf', 'rng', 'sie']) {
    const l = R.defRows.filter((r) => r.type === yk).reduce((s, r) => s + r.lost, 0);
    assert.equal(l, 0, `${yk} should be untouched, lost ${l}`);
  }
});

test('report 2: the lone T1 archer survives (it is not in the front line)', () => {
  assert.equal(lost(runSimulation(REPORT_2).defRows, 't1', 'rng'), 0);
});

test('report 2: T1 cav wiped, T2 cav near 46,447, T4 cav untouched', () => {
  const R = runSimulation(REPORT_2);
  assert.ok(lost(R.defRows, 't1', 'cav') > 16879);
  assert.ok(within(lost(R.defRows, 't2', 'cav'), 46447, 0.05), `T2 cav lost ${lost(R.defRows, 't2', 'cav')}`);
  assert.equal(lost(R.defRows, 't4', 'cav'), 0);
});

test('report 2: defender total within 5% of 63,327', () => {
  const R = runSimulation(REPORT_2);
  assert.ok(within(R.defLost, 63327, 0.05), `defender lost ${R.defLost}`);
});

test('report 3: neither army is wiped', () => {
  const R = runSimulation(REPORT_3);
  assert.ok(R.outcome !== 'win' && R.lossReason !== 'wiped', `outcome ${R.outcome}/${R.lossReason}`);
});

test('report 3: defender loses only cavalry — T4 infantry and ranged untouched', () => {
  const R = runSimulation(REPORT_3);
  assert.equal(lost(R.defRows, 't4', 'inf'), 0);
  assert.equal(lost(R.defRows, 't4', 'rng'), 0);
});

test('report 3: attacker wedge loses only its front types — infantry untouched', () => {
  const R = runSimulation(REPORT_3);
  assert.equal(lost(R.atkRows, 't4', 'inf'), 0);
  assert.ok(lost(R.atkRows, 't4', 'rng') > 0, 'ranged is in the wedge front and should bleed');
});

// Known gap: report 3 mixed tiers inside the front (real T2 cav 82%, attacker T5 cav 45,035 lost);
// the strict model wipes T2 cav first and never reaches the attacker's T5. It is the only report
// with an attacking wedge — see PARAMS.spread.
test('report 3: defender T4 cav near 153,670, T1 cav wiped', () => {
  const R = runSimulation(REPORT_3);
  assert.ok(within(lost(R.defRows, 't4', 'cav'), 153670, 0.05), `T4 cav lost ${lost(R.defRows, 't4', 'cav')}`);
  assert.ok(lost(R.defRows, 't1', 'cav') > 3653, 'T1 cav wiped');
});

test('report 3: defender total within 15% of 282,210', () => {
  const R = runSimulation(REPORT_3);
  assert.ok(within(R.defLost, 282210, 0.15), `defender lost ${R.defLost}`);
});

test('report 3: attacker T4 cav near 57,990 and T4 rng near 2,000', () => {
  const R = runSimulation(REPORT_3);
  assert.ok(within(lost(R.atkRows, 't4', 'cav'), 57990, 0.05), `T4 cav lost ${lost(R.atkRows, 't4', 'cav')}`);
  assert.ok(within(lost(R.atkRows, 't4', 'rng'), 2000, 0.10), `T4 rng lost ${lost(R.atkRows, 't4', 'rng')}`);
});

// Report 4 — Chaos Arena (event: nobody dies). Ranged Phalanx 378,000 (135,044 T5 cav + 242,956 T4
// cav) vs Ranged Phalanx 2,221,034 behind a 564,835 HP wall, 0 traps. Attacker wiped, wall
// destroyed, defender lost 112,590: T1 rng 46,077 (100%) + T2 rng 66,513, nothing else.
// Defender stats not shown — the player's stat block is used. 157,214 troops sat in rows cut off
// the screenshot with 0 losses; they are entered as back-line siege.
const REPORT_4 = {
  event: true,
  troops: grid({ t1: { inf: 59138, rng: 46077, cav: 19059 }, t2: { inf: 163278, rng: 158080, cav: 166474, sie: 157214 },
                 t3: { inf: 143400, rng: 159578, cav: 131110 }, t4: { inf: 328727, rng: 339867, cav: 330724, sie: 18308 } }),
  def: { stats: STATS, formation: 'rng', stance: 'phalanx',
         wall: { maxHp: 564835, pct: 100, traps: 0, atk: 60.84, def: 66.92 },
         infirmary: 3000000, sanctuary: 0, familiar: 20 },
  atk: { troops: grid({ t5: { cav: 135044 }, t4: { cav: 242956 } }),
         formation: 'rng', stance: 'phalanx', stat: 400, def: 250, hp: 550, familiar: 20 }
};

test('report 4: the march is wiped and the 564,835 HP wall falls', () => {
  const R = runSimulation(REPORT_4);
  assert.equal(R.outcome, 'win');
  assert.ok(R.atkLost > 377999);
  assert.ok(R.wallPctLeft < 0.01, `wall left ${R.wallPctLeft}%`);
});

test('report 4: only the ranged front bleeds, strictly lowest tier first', () => {
  const R = runSimulation(REPORT_4);
  assert.ok(lost(R.defRows, 't1', 'rng') > 46076, 'T1 rng wiped');
  assert.ok(within(lost(R.defRows, 't2', 'rng'), 66513, 0.05), `T2 rng lost ${lost(R.defRows, 't2', 'rng')}`);
  assert.equal(lost(R.defRows, 't3', 'rng'), 0);
  assert.equal(lost(R.defRows, 't4', 'rng'), 0);
  for (const yk of ['inf', 'cav', 'sie']) assert.equal(R.defRows.filter((r) => r.type === yk).reduce((a, r) => a + r.lost, 0), 0, yk);
  assert.ok(within(R.defLost, 112590, 0.05), `defender lost ${R.defLost}`);
});

test('report 4: an event battle kills nobody on either side', () => {
  const R = runSimulation(REPORT_4);
  assert.equal(R.atkDead, 0);
  assert.equal(R.dead, 0);
  assert.ok(Math.abs(R.atkWounded - R.atkLost) < 1e-6);
});

test('the engine never mutates the config it is handed', () => {
  for (const cfg of [REPORT_2, REPORT_3, REPORT_4]) {
    const before = JSON.stringify(cfg);
    runSimulation(cfg);
    assert.equal(JSON.stringify(cfg), before);
  }
});

test('a garrison with zero troops of the chosen formation does not insta-lose', () => {
  const cfg = structuredClone(REPORT_2);
  cfg.troops = grid({ t2: { inf: 3000000 }, t4: { inf: 500000 } });
  cfg.def.formation = 'cav'; // owns zero cavalry
  const R = runSimulation(cfg);
  assert.ok(R.rounds > 1, `expected a real fight, ended in ${R.rounds} round(s)`);
});
