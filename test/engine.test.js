import test from 'node:test';
import assert from 'node:assert/strict';
import { runSimulation } from '../assets/engine.js';

// Real battle report, 2026-08-28. Defender win: attacker 100,000 all-T4 (40k inf /
// 25k rng / 35k cav) wiped 100%. Defender lost 63,327 of 929,729 — every T4 squad
// untouched, T1 wiped, T2 down 23.1%. Wall was down, so traps are inert.
const REPORT_2 = {
  troops: {
    t1: { inf: 0,      rng: 1,      cav: 16880  },
    t2: { inf: 0,      rng: 0,      cav: 201251 },
    t3: { inf: 0,      rng: 0,      cav: 0      },
    t4: { inf: 252301, rng: 208689, cav: 245571 },
    t5: { inf: 0,      rng: 0,      cav: 0      }
  },
  def: {
    stats: {
      inf:  { atk: 302.49, def: 229.85, hp: 201.72 },
      rng:  { atk: 318.54, def: 184.95, hp: 185.83 },
      cav:  { atk: 309.72, def: 194.47, hp: 201.08 },
      army: { atk: 155.45, def: 226.75, hp: 348.00 }
    },
    formation: 'cav',
    stance: 'phalanx',
    wall: { maxHp: 2000000, pct: 0, traps: 0, atk: 60.84, def: 66.92 },
    infirmary: 500000,
    sanctuary: 0,
    retreat: 100,
    familiar: 20
  },
  atk: {
    march: 'solo', total: 100000,
    stat: 650, def: 360, hp: 360,
    lineup: '8-5-7', tierMix: 't4',
    stance: 'phalanx', familiar: 20
  }
};

const tierLoss = (rows, tier) => {
  const r = rows.filter((x) => x.tier === tier);
  const start = r.reduce((s, x) => s + x.start, 0);
  const lost = r.reduce((s, x) => s + x.lost, 0);
  return { start, lost, pct: start > 0 ? (lost / start) * 100 : 0 };
};

test('report 2: the attacking march is wiped', () => {
  const R = runSimulation(REPORT_2);
  assert.equal(R.outcome, 'win');
  assert.ok(R.atkLost > 99000, `expected ~100000 attackers killed, got ${R.atkLost}`);
});

test('report 2: defender total losses land near 63,327', () => {
  const R = runSimulation(REPORT_2);
  assert.ok(R.defLost > 55000 && R.defLost < 72000,
    `expected defender losses near 63327, got ${R.defLost}`);
});

test('report 2: casualties climb the tier ladder — T4 is untouched', () => {
  const R = runSimulation(REPORT_2);
  assert.equal(tierLoss(R.defRows, 't4').lost, 0, 'T4 must take zero losses');
});

test('report 2: T1 is wiped and T2 bleeds about 23%', () => {
  const R = runSimulation(REPORT_2);
  const t1 = tierLoss(R.defRows, 't1');
  const t2 = tierLoss(R.defRows, 't2');
  assert.ok(t1.pct > 99, `expected T1 wiped, got ${t1.pct.toFixed(1)}%`);
  assert.ok(t2.pct > 18 && t2.pct < 29, `expected T2 near 23%, got ${t2.pct.toFixed(1)}%`);
});

test('the engine never mutates the config it is handed', () => {
  const before = JSON.stringify(REPORT_2);
  runSimulation(REPORT_2);
  assert.equal(JSON.stringify(REPORT_2), before);
});

test('a garrison with zero troops of the chosen formation does not insta-lose', () => {
  const cfg = structuredClone(REPORT_2);
  cfg.troops = {
    t1: { inf: 0, rng: 0, cav: 0 }, t2: { inf: 3000000, rng: 0, cav: 0 },
    t3: { inf: 0, rng: 0, cav: 0 }, t4: { inf: 500000, rng: 0, cav: 0 },
    t5: { inf: 0, rng: 0, cav: 0 }
  };
  cfg.def.formation = 'cav'; // owns zero cavalry
  const R = runSimulation(cfg);
  assert.ok(R.rounds > 1, `expected a real fight, ended in ${R.rounds} round(s)`);
});
