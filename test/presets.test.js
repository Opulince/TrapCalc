import test from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_PRESETS, TIER_KEYS, COMBAT_KEYS, runSimulation } from '../assets/engine.js';
import { REPORTS, reportError, withStats } from './reports.js';

// Squad-level error each report reaches with its fitted attacker stats (npm run calibrate, 2026-10-03).
const FIT_ERROR = { R2: 0.005, R3: 0.126, R4: 0.001, R5: 0.039, R6: 0.053, R7: 0.685 };

for (const [key, p] of Object.entries(REPORT_PRESETS)) {
  const rep = REPORTS.find((r) => r.id === p.report);

  test(`${key}: march matches report ${p.report} (siege left out)`, () => {
    assert.ok(rep, `no report ${p.report}`);
    const a = rep.cfg.atk;
    assert.equal(p.formation, a.formation);
    assert.equal(p.stance, a.stance);
    for (const yk of COMBAT_KEYS) assert.equal(p.mana, (a.mana || {})[yk] || 0, `mana ${yk}`);
    for (const tk of TIER_KEYS) for (const yk of COMBAT_KEYS) {
      assert.equal((p.troops[tk] || {})[yk] || 0, a.troops[tk][yk], `${tk} ${yk}`);
    }
  });

  test(`${key}: its stats reproduce report ${p.report} as well as the fit did`, () => {
    const err = reportError(rep, runSimulation(withStats(rep, { atk: p.stat, def: p.def, hp: p.hp })));
    assert.ok(err <= FIT_ERROR[p.report] + 0.001, `error ${err.toFixed(3)} vs fitted ${FIT_ERROR[p.report]}`);
  });
}

test('presets carry no player names', () => {
  const names = /rambo|hady|maria|tomas|chelbi|apxahre7i|\[sip\]|\[osi\]|\[l\*c\]/i;
  for (const p of Object.values(REPORT_PRESETS)) assert.ok(!names.test(p.label), p.label);
});
