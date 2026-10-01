import test from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation, emptyTroops } from '../assets/engine.js';

// Mechanics added in Batch 3: battle lines, siege, typed traps, independent formation.

const STATS = {
  inf:  { atk: 302.49, def: 229.85, hp: 201.72 },
  rng:  { atk: 318.54, def: 184.95, hp: 185.83 },
  cav:  { atk: 309.72, def: 194.47, hp: 201.08 },
  army: { atk: 155.45, def: 226.75, hp: 348.00 }
};
const grid = (o) => {
  const t = emptyTroops();
  for (const tk of Object.keys(o)) Object.assign(t[tk], o[tk]);
  return t;
};
const typeLost = (rows, yk) => rows.filter((r) => r.type === yk).reduce((s, r) => s + r.lost, 0);

// report 2's garrison, wall down
const GARRISON = {
  troops: grid({ t1: { rng: 1, cav: 16880 }, t2: { cav: 201251 },
                 t4: { inf: 252301, rng: 208689, cav: 245571, sie: 5036 } }),
  def: { stats: STATS, formation: 'cav', stance: 'phalanx',
         wall: { maxHp: 12625, pct: 0, traps: 0, atk: 60.84, def: 66.92 },
         infirmary: 500000, sanctuary: 0, familiar: 20 }
};
const march = (troops, extra = {}) => ({
  ...structuredClone(GARRISON),
  atk: { troops, formation: 'inf', stance: 'phalanx', stat: 1300, def: 400, hp: 550, familiar: 20, ...extra }
});
const MARCH_125K = { t4: { inf: 50000, rng: 31250, cav: 43750 } };   // 40/25/35 split

test('a march wiped in the last round has its leader captured', () => {
  const R = runSimulation(march(grid(MARCH_125K)));
  assert.equal(R.outcome, 'win');
  assert.equal(R.rounds, 15);
});

test('10k T1 siege at the back saves the same march from capture', () => {
  const troops = grid(MARCH_125K);
  troops.t1.sie = 10000;
  const R = runSimulation(march(troops));
  assert.notEqual(R.outcome, 'win');
  assert.equal(typeLost(R.atkRows, 'sie'), 0, 'siege is the last line and is never reached');
  assert.ok(R.atkSurv >= 10000);
});

test('the back line takes nothing while the lines in front still stand', () => {
  // report 3's march with 10k siege: its front survives, so siege must be untouched
  const troops = grid({ t5: { cav: 132018 }, t4: { inf: 4000, rng: 4000, cav: 115982, sie: 10000 } });
  const cfg = march(troops, { formation: 'rng', stance: 'wedge', stat: 1000, def: 400, hp: 1150 });
  cfg.troops = grid({ t1: { cav: 3654 }, t2: { cav: 152501 }, t4: { inf: 252325, rng: 249293, cav: 250186 } });
  const R = runSimulation(cfg);
  assert.ok(R.atkLost > 0);
  assert.equal(typeLost(R.atkRows, 'sie'), 0);
  assert.equal(typeLost(R.atkRows, 'inf'), 0, 'infantry is the second line behind a ranged wedge');
});

test('formation is independent of composition: a 97%-cavalry Ranged Wedge leads with ranged + cavalry', () => {
  const troops = grid({ t5: { cav: 132018 }, t4: { inf: 4000, rng: 4000, cav: 115982 } });
  const R = runSimulation(march(troops, { formation: 'rng', stance: 'wedge' }));
  assert.deepEqual(R.atkLeads, ['rng', 'cav']);
  assert.equal(R.atkStart, 256000, 'the squad grid is used exactly as entered');
});

// a wall-up fight against a small all-cavalry march
const WALL_UP = (traps, atkTroops) => {
  const cfg = march(atkTroops, { formation: 'cav', stance: 'phalanx', stat: 1000, def: 400, hp: 1150 });
  cfg.def.wall = { maxHp: 564835, pct: 100, atk: 60.84, def: 66.92, traps };
  return cfg;
};

test('spikes counter cavalry: they out-kill towers and logs against a cavalry march', () => {
  const kills = (k) => runSimulation(WALL_UP({ spk: 0, twr: 0, log: 0, [k]: 126250 },
    grid({ t4: { cav: 120000 } }))).trapKills;
  assert.ok(kills('spk') > 1.5 * kills('twr'), `spikes ${kills('spk')} vs towers ${kills('twr')}`);
  assert.ok(kills('spk') > 1.5 * kills('log'), `spikes ${kills('spk')} vs logs ${kills('log')}`);
});

test('siege counters traps: swapping 20% of a march to siege destroys more traps', () => {
  const traps = { spk: 42084, twr: 42083, log: 42083 };
  const noSiege = runSimulation(WALL_UP(traps, grid({ t4: { cav: 80000 } })));
  const withSiege = runSimulation(WALL_UP(traps, grid({ t4: { cav: 64000, sie: 16000 } })));
  assert.ok(noSiege.trapLeft > 0, 'scenario must leave traps standing to compare');
  assert.ok(withSiege.trapLost > noSiege.trapLost, `${withSiege.trapLost} vs ${noSiege.trapLost}`);
});

test('a plain trap number is split evenly across the three trap types', () => {
  const R = runSimulation(WALL_UP(90000, grid({ t4: { cav: 1000 } })));
  assert.deepEqual(R.trapStartBy, { spk: 30000, twr: 30000, log: 30000 });
});
