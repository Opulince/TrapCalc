import test from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation, PARAMS } from '../assets/engine.js';

// Regression tests for the code-review fixes. Each one pins a bug that shipped before.

const TIERS = ['t1', 't2', 't3', 't4', 't5'];

const STATS = {
  inf:  { atk: 302.49, def: 229.85, hp: 201.72 },
  rng:  { atk: 318.54, def: 184.95, hp: 185.83 },
  cav:  { atk: 309.72, def: 194.47, hp: 201.08 },
  army: { atk: 155.45, def: 226.75, hp: 348.00 }
};

// A mixed garrison facing a maxed Titan solo, wall up.
const BASE = {
  troops: {
    t1: { inf: 0,       rng: 0,       cav: 0       },
    t2: { inf: 1500000, rng: 1500000, cav: 1500000 },
    t3: { inf: 0,       rng: 0,       cav: 0       },
    t4: { inf: 400000,  rng: 400000,  cav: 400000  },
    t5: { inf: 100000,  rng: 100000,  cav: 100000  }
  },
  def: {
    stats: STATS, formation: 'cav', stance: 'phalanx',
    wall: { maxHp: 2000000, pct: 100, traps: 200000, atk: 60.84, def: 66.92 },
    infirmary: 300000, dp: 30, retreat: 38, familiar: 20
  },
  atk: {
    march: 'solo', total: 375000, stat: 1100, def: 1000, hp: 1100,
    lineup: 'cav', tierMix: 't5t4', stance: 'phalanx', familiar: 20
  }
};

const cfgWith = (mut) => { const c = structuredClone(BASE); mut(c); return c; };

test('trap kills are only the traps\' share — zero traps means zero trap kills', () => {
  const R = runSimulation(cfgWith((c) => { c.def.wall.traps = 0; }));
  assert.ok(R.wallRounds > 0, 'wall should stand for at least one round');
  assert.ok(R.wallKills > 0, 'the garrison still kills while the wall stands');
  assert.equal(R.trapKills, 0);
});

test('trap kills never exceed kills made while the wall stood', () => {
  const R = runSimulation(BASE);
  assert.ok(R.trapKills > 0);
  assert.ok(R.trapKills <= R.wallKills + 1e-6);
  assert.ok(R.trapVolleyKills <= R.trapKills + 1e-6);
});

test('wall % is measured against max HP, not the starting HP', () => {
  const R = runSimulation(cfgWith((c) => { c.def.wall.pct = 25; }));
  assert.ok(Math.abs(R.wallStartPct - 25) < 1e-9, `start should read 25%, got ${R.wallStartPct}`);
  assert.ok(R.wallPctLeft <= 25 + 1e-9, `a 25% wall cannot end above 25%, got ${R.wallPctLeft}`);
});

test('a damaged wall loses HP more slowly than a full one (HP-proportional split)', () => {
  // Same attacker, same traps: round 1 incoming is identical, only the wall's HP differs.
  const full = runSimulation(BASE).log[0];
  const hurt = runSimulation(cfgWith((c) => { c.def.wall.pct = 25; })).log[0];
  assert.equal(full.atkDmg, hurt.atkDmg);
  const fullLoss = 100 - full.wallPct;   // percentage points of max HP lost in round 1
  const hurtLoss = 25 - hurt.wallPct;
  assert.ok(hurtLoss < fullLoss, `25% wall lost ${hurtLoss}pp vs full wall ${fullLoss}pp`);
});

// Wall down, chaff-heavy garrison, attacker strong enough to win on attrition.
const ATTRITION = cfgWith((c) => {
  c.troops = {
    t1: { inf: 0, rng: 0, cav: 0 }, t2: { inf: 300000, rng: 300000, cav: 300000 },
    t3: { inf: 0, rng: 0, cav: 0 }, t4: { inf: 50000,  rng: 50000,  cav: 50000  },
    t5: { inf: 0, rng: 0, cav: 0 }
  };
  c.def.wall.pct = 0; c.def.retreat = 100;
  Object.assign(c.atk, { stat: 1000, def: 1000, hp: 1000, tierMix: 't5', lineup: 'inf' });
});

test('a time-out loss with morale left is reported as attrition, not morale collapse', () => {
  const R = runSimulation(ATTRITION);
  assert.equal(R.outcome, 'loss');
  assert.equal(R.rounds, 15);
  assert.ok(R.morale > 0, `morale should still be standing, got ${R.morale}`);
  assert.equal(R.lossReason, 'attrition');
});

// The fitted drain rate rarely empties morale on its own, so these force a fast drain to
// check that a collapse is reported correctly — on either side.
const withFastMorale = (fn) => {
  const keep = PARAMS.morale.rate;
  PARAMS.morale.rate = 4;
  try { return fn(); } finally { PARAMS.morale.rate = keep; }
};

test('a mid-battle defender morale collapse is reported as morale', () => {
  const R = withFastMorale(() => runSimulation(ATTRITION));
  assert.equal(R.outcome, 'loss');
  assert.ok(R.rounds < 15);
  assert.equal(R.lossReason, 'morale');
  assert.equal(R.morale, 0);
});

test('an attacker whose morale hits 0 retreats instead of being wiped', () => {
  // a small march into a big garrison, wall down
  const R = withFastMorale(() => runSimulation(cfgWith((c) => {
    c.def.wall.pct = 0;
    Object.assign(c.atk, { total: 60000, stat: 300, def: 300, hp: 300, tierMix: 't4', lineup: 'inf' });
  })));
  assert.equal(R.outcome, 'retreat');
  assert.equal(R.atkMorale, 0);
  assert.ok(R.atkSurv > 0, 'a retreating march keeps survivors');
});

test('non-loss outcomes carry no loss reason', () => {
  assert.equal(runSimulation(BASE).lossReason, null);
});

test('an empty formation type fights exactly like picking the type that is actually there', () => {
  // Infantry-only garrison: choosing Cavalry (owns none) must not drop it to support output.
  const infOnly = (form) => cfgWith((c) => {
    c.def.wall.pct = 0;
    TIERS.forEach((tk) => { c.troops[tk].rng = 0; c.troops[tk].cav = 0; });
    c.def.formation = form;
  });
  const asCav = runSimulation(infOnly('cav'));
  const asInf = runSimulation(infOnly('inf'));
  assert.equal(asCav.atkLost, asInf.atkLost);
  assert.equal(asCav.defLost, asInf.defLost);
  assert.equal(asCav.outcome, asInf.outcome);
});
