import test from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation } from '../assets/engine.js';
import { REPORTS, reportError, withStats, grid } from './reports.js';

// Regression tests against REAL battle reports (test/reports.js). Attacker stats are not in a
// report, so each one uses the stats fitted to it within the player's hints. Tolerances are the
// honest ones: where the model still misses, the test name says so.

const FITTED = {
  R2: { atk: 1200, def: 100, hp: 1000 },
  R3: { atk: 1300, def: 100, hp: 1300 },
  R4: { atk: 400,  def: 100, hp: 850 },
  R5: { atk: 650,  def: 250, hp: 250 },   // HADY — one stat set shared by R5 and R6
  R6: { atk: 650,  def: 250, hp: 250 },
  R7: { atk: 1000, def: 100, hp: 850 }    // Maria, held to the 1000-1100 ATK hint
};
const rep = (id) => REPORTS.find((r) => r.id === id);
const sim = (id) => runSimulation(withStats(rep(id), FITTED[id]));
const lost = (rows, tk, yk) => (rows.find((r) => r.tier === tk && r.type === yk) || { lost: 0 }).lost;
const typeLost = (rows, yk) => rows.filter((r) => r.type === yk).reduce((s, r) => s + r.lost, 0);
const within = (v, target, tol) => Math.abs(v - target) <= tol * target;

test('squad-level error per report stays where the fit put it', () => {
  const limit = { R2: 0.05, R3: 0.2, R4: 0.05, R5: 0.1, R6: 0.1, R7: 0.75 };
  for (const r of REPORTS) {
    const e = reportError(r, sim(r.id));
    assert.ok(e <= limit[r.id], `${r.id}: error ${e.toFixed(3)} > ${limit[r.id]}`);
  }
});

test('report 2: march wiped; only cavalry dies, lowest tier first; the T1 archer survives', () => {
  const R = sim('R2');
  assert.equal(R.outcome, 'win');
  assert.ok(R.atkLost > 99999);
  assert.ok(lost(R.defRows, 't1', 'cav') > 16879);
  assert.ok(within(lost(R.defRows, 't2', 'cav'), 46447, 0.03), `T2 cav ${lost(R.defRows, 't2', 'cav')}`);
  assert.equal(lost(R.defRows, 't4', 'cav'), 0);
  for (const yk of ['inf', 'rng', 'sie']) assert.equal(typeLost(R.defRows, yk), 0, yk);
});

test('report 3: the attacking Ranged Wedge loses 2 ranged squads, then cavalry squad by squad', () => {
  const R = sim('R3');
  assert.ok(within(lost(R.atkRows, 't4', 'rng'), 2000, 0.01), `T4 rng ${lost(R.atkRows, 't4', 'rng')}`);
  assert.ok(within(lost(R.atkRows, 't4', 'cav'), 57990, 0.01), `T4 cav ${lost(R.atkRows, 't4', 'cav')}`);
  assert.ok(within(lost(R.atkRows, 't5', 'cav'), 45035, 0.05), `T5 cav ${lost(R.atkRows, 't5', 'cav')}`);
  assert.equal(lost(R.atkRows, 't4', 'inf'), 0);
});

// Known gap: the defender's cavalry phalanx in report 3 lost T2 82% / T4 61%; the model wipes T2.
test('report 3: defender loses only cavalry, T4 cav near 153,670', () => {
  const R = sim('R3');
  assert.equal(typeLost(R.defRows, 'inf'), 0);
  assert.equal(typeLost(R.defRows, 'rng'), 0);
  assert.ok(within(lost(R.defRows, 't4', 'cav'), 153670, 0.05), `T4 cav ${lost(R.defRows, 't4', 'cav')}`);
});

test('report 4: wall destroyed, march wiped, only T1/T2 ranged bleed, nobody dies (event)', () => {
  const R = sim('R4');
  assert.equal(R.outcome, 'win');
  assert.ok(R.wallPctLeft < 0.01);
  assert.ok(lost(R.defRows, 't1', 'rng') > 46076);
  assert.ok(within(lost(R.defRows, 't2', 'rng'), 66513, 0.02), `T2 rng ${lost(R.defRows, 't2', 'rng')}`);
  assert.equal(R.defLost - lost(R.defRows, 't1', 'rng') - lost(R.defRows, 't2', 'rng'), 0);
  assert.equal(R.dead, 0);
  assert.equal(R.atkDead, 0);
});

test('report 5: ranged front bleeds strictly T2 -> T3 -> T4', () => {
  const R = sim('R5');
  assert.ok(lost(R.defRows, 't2', 'rng') > 91566);
  assert.ok(lost(R.defRows, 't3', 'rng') > 159577);
  assert.ok(within(lost(R.defRows, 't4', 'rng'), 45601, 0.25), `T4 rng ${lost(R.defRows, 't4', 'rng')}`);
  assert.equal(R.defLost - typeLost(R.defRows, 'rng'), 0);
});

test('report 6: a defending Ranged Wedge loses half its ranged tier by tier, and no cavalry', () => {
  const R = sim('R6');
  assert.equal(R.outcome, 'win');
  assert.ok(within(lost(R.defRows, 't1', 'rng'), 23038, 0.01), `T1 rng ${lost(R.defRows, 't1', 'rng')}`);
  assert.ok(within(lost(R.defRows, 't2', 'rng'), 79039, 0.01), `T2 rng ${lost(R.defRows, 't2', 'rng')}`);
  assert.ok(within(lost(R.defRows, 't3', 'rng'), 33260, 0.25), `T3 rng ${lost(R.defRows, 't3', 'rng')}`);
  assert.equal(typeLost(R.defRows, 'cav'), 0);
});

// Known gap: in report 7 the garrison's cavalry and the march's cavalry/ranged bled while their
// fronts still stood; the model only reaches the next group once the front is gone.
test('report 7: attacking infantry squads die one after another — T5 infantry exactly 42,500', () => {
  const R = sim('R7');
  assert.ok(within(lost(R.atkRows, 't5', 'inf'), 42500, 0.01), `T5 inf ${lost(R.atkRows, 't5', 'inf')}`);
  // the third squad runs ~14% deeper than real, because the real march also lost cavalry
  assert.ok(within(lost(R.atkRows, 't4', 'inf'), 41862, 0.15), `T4 inf ${lost(R.atkRows, 't4', 'inf')}`);
  assert.ok(R.wallPctLeft < 0.01, 'wall destroyed');
  assert.ok(lost(R.defRows, 't2', 'rng') > 671917 && lost(R.defRows, 't3', 'rng') > 127660);
});

test('the engine never mutates the config it is handed', () => {
  for (const r of REPORTS) {
    const cfg = withStats(r, FITTED[r.id]);
    const before = JSON.stringify(cfg);
    runSimulation(cfg);
    assert.equal(JSON.stringify(cfg), before);
  }
});

test('a garrison with zero troops of the chosen formation does not insta-lose', () => {
  const cfg = withStats(rep('R2'), FITTED.R2);
  cfg.troops = grid({ t2: { inf: 3000000 }, t4: { inf: 500000 } });
  cfg.def.formation = 'cav'; // owns zero cavalry
  const R = runSimulation(cfg);
  assert.ok(R.rounds > 1, `expected a real fight, ended in ${R.rounds} round(s)`);
});
