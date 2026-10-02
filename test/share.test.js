import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState, diff, merge } from '../assets/share.js';
import { fillTroops, runSimulation } from '../assets/engine.js';

// Same shape as the app's state in assets/ui.js.
const DEFAULTS = {
  troops: {
    t1: { inf: 0,       rng: 0,       cav: 0,       sie: 0 },
    t2: { inf: 1500000, rng: 1500000, cav: 1500000, sie: 0 },
    t3: { inf: 0,       rng: 0,       cav: 0,       sie: 0 },
    t4: { inf: 400000,  rng: 400000,  cav: 400000,  sie: 0 },
    t5: { inf: 100000,  rng: 100000,  cav: 100000,  sie: 0 }
  },
  def: {
    stats: {
      inf: { atk: 302.49, def: 229.85, hp: 201.72 }, rng: { atk: 318.54, def: 184.95, hp: 185.83 },
      cav: { atk: 309.72, def: 194.47, hp: 201.08 }, sie: { atk: 0, def: 0, hp: 0 },
      army: { atk: 155.45, def: 226.75, hp: 348.00 }
    },
    formation: 'cav', stance: 'phalanx',
    wall: { maxHp: 564835, pct: 100, traps: { spk: 42084, twr: 42083, log: 42083 }, atk: 60.84, def: 66.92 },
    infirmary: 300000, sanctuary: 0, familiar: 20, mana: { inf: 0, rng: 0, cav: 0 }
  },
  event: false,
  atk: { march: 'solo', total: 250000, stat: 450, def: 400, hp: 450, lineup: 'cav', tierMix: 't4',
         formation: 'cav', stance: 'phalanx', familiar: 20, troops: fillTroops(250000, 'cav', 't4'),
         mana: { inf: 0, rng: 0, cav: 0 } }
};
const fresh = () => structuredClone(DEFAULTS);
// build a share hash from an arbitrary (possibly hostile) patch object
const hashOf = (patch) => '#s=1.' + btoa(JSON.stringify(patch)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

test('the default setup is a bare URL', () => {
  assert.equal(encodeState(DEFAULTS, fresh()), '');
});

test('a changed setup round-trips exactly', () => {
  const s = fresh();
  s.troops.t2.cav = 750000; s.def.formation = 'rng'; s.def.stance = 'wedge'; s.def.wall.pct = 0;
  s.def.wall.traps.spk = 90000; s.def.mana.cav = 3; s.event = true;
  s.atk.march = 'rally'; s.atk.total = 2450000; s.atk.stat = 1400; s.atk.tierMix = 't5h';
  s.atk.troops = fillTroops(2450000, '4-4-2', 't5h');
  const back = decodeState(DEFAULTS, '#' + encodeState(DEFAULTS, s));
  assert.deepEqual(back, s);
  // and it simulates identically
  assert.deepEqual(runSimulation(back), runSimulation(s));
});

test('links only carry what changed, so they stay short', () => {
  const s = fresh(); s.atk.stat = 1100;
  assert.deepEqual(diff(DEFAULTS, s), { atk: { stat: 1100 } });
  assert.ok(encodeState(DEFAULTS, s).length < 40);
});

test('decoding never mutates the defaults it is given', () => {
  const before = JSON.stringify(DEFAULTS);
  decodeState(DEFAULTS, hashOf({ troops: { t2: { cav: 1 } }, atk: { stat: 999 } }));
  assert.equal(JSON.stringify(DEFAULTS), before);
});

test('broken or foreign hashes are rejected, not half-applied', () => {
  for (const h of ['', '#', '#about', '#s=1.', '#s=1.!!!', '#s=2.' + hashOf({ atk: { stat: 1 } }).slice(5),
                   '#s=1.' + btoa('not json'), hashOf([1, 2, 3]), hashOf('text'), hashOf(null)]) {
    assert.equal(decodeState(DEFAULTS, h), null, h);
  }
});

test('a doctored link is clamped to what the inputs allow', () => {
  const s = decodeState(DEFAULTS, hashOf({
    troops: { t5: { cav: 1e12, inf: -50 }, t1: { sie: 99999 } },
    def: { stats: { inf: { atk: 99999 }, sie: { atk: 500 } }, wall: { pct: 250, maxHp: 1e300, traps: { spk: -3 } },
           formation: 'sie', stance: 'turtle', familiar: 90, mana: { cav: 40 } },
    atk: { march: 'rally', total: 5, stat: -10, lineup: 'nope', tierMix: '__proto__', troops: { t4: { cav: 1e300, sie: 7 } },
           mana: { inf: 2.6 } }
  }));
  assert.equal(s.troops.t5.cav, 600000, 'T5 capped at the slider max');
  assert.equal(s.troops.t5.inf, 0);
  assert.equal(s.troops.t1.sie, 0, 'siege is not an input');
  assert.equal(s.def.stats.inf.atk, 1600);
  assert.equal(s.def.stats.sie.atk, 0);
  assert.equal(s.def.wall.pct, 100);
  assert.equal(s.def.wall.maxHp, 1e9);
  assert.equal(s.def.wall.traps.spk, 0);
  assert.equal(s.def.formation, 'cav', 'siege is not a formation');
  assert.equal(s.def.stance, 'phalanx');
  assert.equal(s.def.familiar, 35);
  assert.equal(s.def.mana.cav, 6);
  assert.equal(s.atk.total, 2000000, 'clamped into the rally range');
  assert.equal(s.atk.stat, 0);
  assert.equal(s.atk.lineup, 'cav');
  assert.equal(s.atk.tierMix, 't4', 'inherited object keys are not valid choices');
  assert.equal(s.atk.troops.t4.cav, 1e7);
  assert.equal(s.atk.troops.t4.sie, 0);
  assert.equal(s.atk.mana.inf, 3);
  // whatever came in, the engine still produces finite numbers
  const R = runSimulation(s);
  assert.ok(Number.isFinite(R.defLost) && Number.isFinite(R.atkLost));
});

test('wrong types and unknown keys are ignored', () => {
  const s = decodeState(DEFAULTS, hashOf({
    troops: { t2: { cav: '123' }, t9: { inf: 5 } }, event: 'yes', def: { wall: 7, extra: { a: 1 } },
    atk: { stat: null, def: true, troops: 'grid' }, polluted: { x: 1 }
  }));
  assert.equal(s.troops.t2.cav, 1500000);
  assert.equal(s.troops.t9, undefined);
  assert.equal(s.event, false);
  assert.deepEqual(s.def.wall, DEFAULTS.def.wall);
  assert.equal(s.def.extra, undefined);
  assert.equal(s.atk.stat, 450);
  assert.equal(s.atk.def, 400);
  assert.deepEqual(s.atk.troops, DEFAULTS.atk.troops);
  assert.equal(s.polluted, undefined);
});

test('merge keeps the default shape even for a hostile __proto__ key', () => {
  const patch = JSON.parse('{"__proto__": {"polluted": true}, "atk": {"stat": 600}}');
  const m = merge(DEFAULTS, patch);
  assert.equal(({}).polluted, undefined, 'Object.prototype untouched');
  assert.equal(m.atk.stat, 600);
});
