import test from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation, TIER } from '../assets/engine.js';

// Recovery rules from the Lords Mobile wiki (Infirmary, Sanctuary) — see engine.js.

const STATS = {
  inf:  { atk: 302.49, def: 229.85, hp: 201.72 },
  rng:  { atk: 318.54, def: 184.95, hp: 185.83 },
  cav:  { atk: 309.72, def: 194.47, hp: 201.08 },
  army: { atk: 155.45, def: 226.75, hp: 348.00 }
};
// Wall down, chaff garrison vs a T5/T4 Titan — heavy losses on both sides.
const BASE = {
  troops: {
    t1: { inf: 0, rng: 0, cav: 0 }, t2: { inf: 300000, rng: 300000, cav: 300000 },
    t3: { inf: 0, rng: 0, cav: 0 }, t4: { inf: 50000,  rng: 50000,  cav: 50000  },
    t5: { inf: 0, rng: 0, cav: 0 }
  },
  def: {
    stats: STATS, formation: 'cav', stance: 'phalanx',
    wall: { maxHp: 2000000, pct: 0, traps: 0, atk: 60.84, def: 66.92 },
    infirmary: 100000, sanctuary: 0, retreat: 100, familiar: 20
  },
  atk: {
    march: 'solo', total: 375000, stat: 700, def: 700, hp: 700,
    lineup: 'cav', tierMix: 't5t4', stance: 'phalanx', familiar: 20
  }
};
const cfgWith = (mut) => { const c = structuredClone(BASE); mut(c); return c; };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

test('might per troop matches the game: T1 2, T2 8, T3 24, T4 36, T5 48', () => {
  assert.deepEqual(['t1', 't2', 't3', 't4', 't5'].map((t) => TIER[t].might), [2, 8, 24, 36, 48]);
});

test('attacker losses split 60% wounded / 40% dead', () => {
  const R = runSimulation(BASE);
  assert.ok(R.atkLost > 1000, `need real attacker losses, got ${R.atkLost}`);
  assert.ok(near(R.atkWounded, R.atkLost * 0.6));
  assert.ok(near(R.atkDead, R.atkLost * 0.4));
  const rowSum = R.atkRows.reduce((s, r) => s + r.wounded + r.dead, 0);
  assert.ok(near(rowSum, R.atkLost));
});

test('attacker wounded slots go to the highest tier first', () => {
  const R = runSimulation(BASE);
  const by = (tk, k) => R.atkRows.filter((r) => r.tier === tk).reduce((s, r) => s + r[k], 0);
  // T4 absorbs first, so T5 losses are small: all T5 losses fit inside the 60% quota
  assert.ok(by('t5', 'lost') < R.atkLost * 0.6, 'scenario must have T5 losses below the quota');
  assert.ok(near(by('t5', 'wounded'), by('t5', 'lost')), 'every T5 loss should be wounded');
  assert.ok(by('t4', 'dead') > 0, 'the 40% dead must come from the lower tier');
});

test('report 1 ratio: 40,232 losses -> 24,139 wounded / 16,093 dead', () => {
  // the rule reproduces the real report to the troop
  assert.equal(Math.round(40232 * 0.6), 24139);
  assert.equal(40232 - 24139, 16093);
});

test('no sanctuary: overflow dies, minus a free 10% Divine Providence revive', () => {
  const R = runSimulation(BASE);
  assert.ok(R.overflow > 0, 'scenario must overflow the infirmary');
  assert.equal(R.sanctuary, 0);
  assert.ok(near(R.divine, R.overflow * 0.1));
  assert.ok(near(R.dead, R.overflow * 0.9));
});

test('ample sanctuary takes 80% of the overflow when defending', () => {
  const R = runSimulation(cfgWith((c) => { c.def.sanctuary = 1e9; }));
  assert.ok(near(R.sanctuary, R.overflow * 0.8));
  assert.ok(near(R.divine, R.overflow * 0.2 * 0.1));
  assert.ok(near(R.dead, R.overflow * 0.2 * 0.9));
});

test('sanctuary capacity caps what it can take', () => {
  const R = runSimulation(cfgWith((c) => { c.def.sanctuary = 1000; }));
  assert.equal(R.sanctuary, 1000);
  assert.ok(near(R.wounded + R.sanctuary + R.divine + R.dead, R.defLost));
});

test('every defender casualty is accounted for exactly once', () => {
  for (const sanctuary of [0, 5000, 1e9]) {
    const R = runSimulation(cfgWith((c) => { c.def.sanctuary = sanctuary; }));
    assert.ok(near(R.wounded + R.sanctuary + R.divine + R.dead, R.defLost), `sanctuary ${sanctuary}`);
  }
});
