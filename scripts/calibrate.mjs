// Scores the engine against every real report in test/reports.js. For each attacker it searches
// the stat range the report allows (the player's hints) and prints the best squad-level error.
//   npm run calibrate
import { REPORTS, reportError, withStats } from '../test/reports.js';
import { runSimulation } from '../assets/engine.js';

const range = (a, b, st) => { const o = []; for (let x = a; x <= b + 1e-9; x += st) o.push(x); return o; };

const byAttacker = {};
REPORTS.forEach((r) => { (byAttacker[r.attacker] = byAttacker[r.attacker] || []).push(r); });

let total = 0;
for (const reps of Object.values(byAttacker)) {
  const st = reps[0].stats;                       // reports by the same attacker share one stat set
  const atkStep = st.atk[1] - st.atk[0] <= 200 ? 50 : 100;
  let best = [Infinity];
  for (const a of range(st.atk[0], st.atk[1], atkStep)) for (const d of range(st.def[0], st.def[1], 150)) for (const h of range(st.hp[0], st.hp[1], 150)) {
    const s = { atk: a, def: d, hp: h };
    const errs = reps.map((r) => reportError(r, runSimulation(withStats(r, s))));
    const e = errs.reduce((x, y) => x + y, 0);
    if (e < best[0]) best = [e, s, errs];
  }
  total += best[0];
  reps.forEach((r, i) => console.log(`${r.id}  error ${best[2][i].toFixed(3)}  attacker ${best[1].atk}/${best[1].def}/${best[1].hp}  — ${r.note}`));
}
console.log(`TOTAL ${total.toFixed(3)}`);
