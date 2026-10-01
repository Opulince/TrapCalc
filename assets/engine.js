// Pure, DOM-free Lords Mobile combat engine. runSimulation(cfg) takes { troops, def, atk }
// and never touches the page or mutates its input, so it runs identically in the browser
// and under `node --test`.
//
// What the model rests on — and how sure we are — is kept in calibration-notes.md.

export const TIER_KEYS = ['t1', 't2', 't3', 't4', 't5'];
// The three combat types form the counter triangle; siege is the fourth troop type.
export const COMBAT_KEYS = ['inf', 'rng', 'cav'];
export const TYPE_KEYS = ['inf', 'rng', 'cav', 'sie'];

// Base per-troop stats are engine units, not game numbers. Might is the game's (wiki: Might;
// confirmed to the troop by report 3's might totals).
export const TIER = {
  t1: { key:'t1', name:'T1', role:'Chaff Layer',   might:2,  hp:10,  atk:10,  max:30000000, step:10000, base:0       },
  t2: { key:'t2', name:'T2', role:'Cushion Layer', might:8,  hp:20,  atk:20,  max:30000000, step:10000, base:1500000 },
  t3: { key:'t3', name:'T3', role:'Filler Layer',  might:24, hp:60,  atk:60,  max:10000000, step:10000, base:0       },
  t4: { key:'t4', name:'T4', role:'Core Layer',    might:36, hp:100, atk:100, max:10000000, step:5000,  base:400000  },
  t5: { key:'t5', name:'T5', role:'Lunar Layer',   might:48, hp:160, atk:160, max:600000,  step:2500,  base:100000  }
};

// Counter triangle: Infantry > Ranged > Cavalry > Infantry (player-confirmed, wiki).
// Siege counters TRAPS (wiki: Trap), not troops. Its type multipliers are placeholders.
export const TYPE = {
  inf: { key:'inf', name:'Infantry', short:'INF', hp:1.30, atk:0.80, def:1.35, beats:'rng' },
  rng: { key:'rng', name:'Ranged',   short:'RNG', hp:0.80, atk:1.40, def:0.80, beats:'cav' },
  cav: { key:'cav', name:'Cavalry',  short:'CAV', hp:1.00, atk:1.10, def:1.00, beats:'inf' },
  sie: { key:'sie', name:'Siege',    short:'SIE', hp:1.00, atk:1.00, def:1.00, beats:null  }
};
export const COUNTERED_BY = {};
COMBAT_KEYS.forEach((k) => { COUNTERED_BY[TYPE[k].beats] = k; });

// Trap types (wiki: Trap): each counters one troop type, and every trap is countered by siege.
export const TRAP_KEYS = ['spk', 'twr', 'log'];
export const TRAP_TYPE = {
  spk: { key:'spk', name:'Spikes',       beats:'cav' },
  twr: { key:'twr', name:'Towers',       beats:'rng' },
  log: { key:'log', name:'Rolling Logs', beats:'inf' }
};

export const MARCH = {
  solo:  { key:'solo',  name:'Solo',  min:10000,   max:375000,  step:5000,  base:250000  },
  rally: { key:'rally', name:'Rally', min:2000000, max:2450000, step:25000, base:2450000 }
};

export const PRESETS = {
  mid:   { march:'solo',  size:250000,  stat:450,  def:400,  hp:450,  tier:'t4'   },
  titan: { march:'solo',  size:375000,  stat:1100, def:1000, hp:1100, tier:'t5t4' },
  rally: { march:'rally', size:2450000, stat:1400, def:1250, hp:1400, tier:'t5h'  }
};

// Composition shortcuts used to FILL the attacker's squad grid. parts: inf - rng - cav.
export const LINEUPS = {
  inf:      { label:'Full Infantry', parts:[1, 0, 0] },
  rng:      { label:'Full Ranged',   parts:[0, 1, 0] },
  cav:      { label:'Full Cavalry',  parts:[0, 0, 1] },
  '4-4-2':  { label:'4-4-2 Mix',     parts:[4, 4, 2] },
  '6-5-9':  { label:'6-5-9 Mix',     parts:[6, 5, 9] },
  '4-2-4':  { label:'4-2-4 Mix',     parts:[4, 2, 4] },
  '14-3-3': { label:'14-3-3 Mix',    parts:[14, 3, 3] },
  '8-5-7':  { label:'8-5-7 Mix',     parts:[8, 5, 7] }
};

export const TIER_MIX = {
  t5:    { label:'100% T5',            mix:{ t5:1.00 } },
  t5h:   { label:'80% T5 / 20% T4',    mix:{ t5:0.80, t4:0.20 } },
  t5t4:  { label:'60% T5 / 40% T4',    mix:{ t5:0.60, t4:0.40 } },
  t4:    { label:'100% T4',            mix:{ t4:1.00 } },
  t4t3:  { label:'60% T4 / 40% T3',    mix:{ t4:0.60, t3:0.40 } },
  t3:    { label:'100% T3',            mix:{ t3:1.00 } },
  chaff: { label:'T4/T2 chaff mix',    mix:{ t4:0.40, t2:0.60 } },
  t2:    { label:'100% T2',            mix:{ t2:1.00 } },
  t1:    { label:'100% T1',            mix:{ t1:1.00 } }
};

// ── Castle Wall ─────────────────────────────────────────────────────────────
// Researched rules (Lords Mobile wiki + guides):
//  · Traps fight ONLY while Wall HP > 0. At 0 the traps are useless and the march
//    starts attacking the troops inside the turf.
//  · Traps strike BEFORE the armies trade damage — the defender's free first hit.
//  · Incoming damage splits between wall and traps in proportion to their HP, so more
//    traps pull damage off the wall and lengthen the wall fight.
//  · A damaged wall loses HP more slowly than a full one — a CONSEQUENCE of the split
//    above (less wall HP = smaller share of the hit), not a separate multiplier.
// WALL_HP_SCALE converts the game's Wall HP into the engine's effective-HP space. Report 4: a
// 564,835 HP wall (castle table 12,625 + defense research) fell in the first round or two, which
// needs a scale of about 100 or less; 80 is used. TRAP stats are still uncalibrated.
export const TRAP = { hp:150, atk:120 };        // per-trap base, estimated
const WALL_HP_SCALE = 80;               // game Wall HP -> engine EHP (report 4: <= ~100)
const TRAP_VOLLEY = 1.00;                // pre-battle free strike, in rounds of trap output

// Recovery rules (Lords Mobile wiki: Infirmary, Sanctuary; Guides by T):
//  · Attackers fighting outside their turf: 60% of losses are wounded (highest tiers first,
//    while their infirmary has room), 40% die. Reports 1 and 3 match to the troop.
//  · Defenders in their turf: every casualty is wounded while the infirmary has room.
//  · Overflow beyond the infirmary dies, except 80% (when defending) goes to the Sanctuary
//    if it has space. Divine Providence is a free-revive 10% slice of the dead.
// The attacker's infirmary space is not an input, so it is assumed to have room.
export const ATK_WOUNDED_SHARE = 0.60;
export const SANCTUARY_DEF_SHARE = 0.80;
export const DIVINE_PROVIDENCE_SHARE = 0.10;

// Mana Chamber (in-game text): each troop type can be charged to raise its basic attributes,
// +2% troop power per Mana level, levels 1-6 (inf / rng / cav; siege cannot be charged).
// Might is unaffected (report 7's might totals match the plain per-tier values).
// Modelled as x(1 + 2% x level) on both ATK and survivability — whether DEF and HP are
// boosted separately is not stated.
export const MANA_STEP = 0.02;
export const MANA_MAX = 6;
const manaMult = (mana, yk) => (yk === 'sie' ? 1 : 1 + MANA_STEP * clamp(num((mana || {})[yk]), 0, MANA_MAX));

export const T5_COST = { food:18000, wood:14000, stone:6000, ore:3600, gear:1, gemsPerGear:12 };
export const HEAL_RATIO = 0.30;

// Formation = lead type + stance, chosen independently of what the march contains (in-game
// you can send any troops in any phalanx or wedge). A wedge puts two types in front: the
// anchor plus the type it counters (report 3: a Ranged Wedge lost only ranged and cavalry).
export const STANCE = {
  phalanx: { label:'Phalanx' },
  wedge:   { label:'Wedge' }
};
export const leadTypes = (type, stance) => (stance === 'wedge' ? [type, TYPE[type].beats] : [type]);

// Battle lines, front to back. Reports 2 and 3 show losses ONLY in the front type(s) while
// the front still stands; siege sits at the very back, which is why a few thousand siege can
// keep a march from being wiped (and its leader from being captured).
export function battleLines(formation, stance) {
  const front = leadTypes(formation, stance);
  return [front, COMBAT_KEYS.filter((y) => front.indexOf(y) < 0), ['sie']];
}

export const STAT_CAP = 1600;
const BATTLE_ROUNDS   = 15;
const FAMILIAR_PERIOD = 3;      // familiar talent fires every N rounds
const COUNTER_BONUS   = 1.00;   // +100% => 2x

// Tunable model constants, fitted against real battle reports (see calibration-notes.md).
// Exported so the calibration script can sweep them; the app never changes them.
// Fitted 2026-10-01 to reports 2-7 (test/reports.js), attacker stats held to the player's hints
// (HADY ~600 ATK shared by reports 5 and 6, Maria 1000-1100): total squad-level error 0.89, down
// from 2.93 for the pre-squad engine. Report 7 is the known miss (see calibration-notes.md).
export const PARAMS = {
  damageScale:   0.10,   // converts ATK into damage per round
  bite:          0.60,   // safety rail: max share of the target's starting EHP per round
  support:       0.45,   // output of squads outside the front line
  // How squads under fire share a hit. The garrison's engaged squads take it side by side
  // (reports 2/4/5/7: the front type bleeds tier by tier evenly across its 4 squads); the
  // march's squads go one after another (report 7: two attacking infantry squads wiped whole,
  // T5 included, while the third had only started). See SQUADS below.
  squadMode:     { def:'parallel', atk:'sequential' },
  // Does a hit that finishes off one group of squads carry on into the next group in the same
  // round? Player experience says no: a few thousand T1 siege at the back can stop a march
  // from being wiped (and its leader captured).
  lineSpill:     false,
  morale: {
    frontWeight: 0.75,   // share of drain from front-line attrition
    armyWeight:  0.25,   // share of drain from overall attrition
    rate:        0.50,   // global drain multiplier
    breakShock:  7,      // flat drain when a front-line tier squad is wiped out
    counterPen:  1.20,   // extra drain while the front is being countered
    minOutput:   0.35    // damage floor at 0 morale
  }
};

/* ═══════════════════════════ HELPERS ═══════════════════════════ */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v) => (Number.isFinite(v) ? v : 0);

// HP% and DEF% both multiply survivability, the way players reason about them
export function unitEhp(tk, yk, hpPct, defPct) {
  const t = TIER[tk], y = TYPE[yk];
  return t.hp * y.hp * (1 + hpPct / 100) * (1 + (defPct || 0) / 100) * y.def;
}
export function unitAtk(tk, yk, atkPct) {
  return TIER[tk].atk * TYPE[yk].atk * (1 + atkPct / 100);
}

export const attackerTierShare = (cfg) => (TIER_MIX[cfg.atk.tierMix] || TIER_MIX.t4).mix;

export function attackerTypeShare(cfg) {
  const L = LINEUPS[cfg.atk.lineup] || LINEUPS.cav;
  const sum = L.parts.reduce((a, b) => a + b, 0) || 1;
  const o = { sie:0 };
  COMBAT_KEYS.forEach((yk, i) => { o[yk] = L.parts[i] / sum; });
  return o;
}

// An empty tier x type grid.
export const emptyTroops = () => {
  const o = {};
  TIER_KEYS.forEach((tk) => { o[tk] = { inf:0, rng:0, cav:0, sie:0 }; });
  return o;
};

// Fill a squad grid from a total + composition shortcut + tier mix (the presets use this).
export function fillTroops(total, lineupKey, tierMixKey) {
  const o = emptyTroops();
  const L = LINEUPS[lineupKey] || LINEUPS.cav;
  const sum = L.parts.reduce((a, b) => a + b, 0) || 1;
  const mix = (TIER_MIX[tierMixKey] || TIER_MIX.t4).mix;
  Object.keys(mix).forEach((tk) => COMBAT_KEYS.forEach((yk, i) => {
    o[tk][yk] = Math.round(total * mix[tk] * (L.parts[i] / sum));
  }));
  return o;
}

// The march as a tier x type grid. An explicit atk.troops wins; older configs that only give
// total + lineup + tierMix are still accepted.
export function attackerTroops(cfg) {
  const A = cfg.atk;
  if (A.troops) {
    const o = emptyTroops();
    TIER_KEYS.forEach((tk) => TYPE_KEYS.forEach((yk) => { o[tk][yk] = Math.max(0, num((A.troops[tk] || {})[yk])); }));
    return o;
  }
  const o = emptyTroops(), tierShare = attackerTierShare(cfg), typeShare = attackerTypeShare(cfg);
  Object.keys(tierShare).forEach((tk) => COMBAT_KEYS.forEach((yk) => {
    o[tk][yk] = num(A.total) * tierShare[tk] * typeShare[yk];
  }));
  return o;
}

// Most common combat type in a grid — only a fallback when no formation is given.
export function dominantType(troops) {
  const n = (yk) => TIER_KEYS.reduce((s, tk) => s + num((troops[tk] || {})[yk]), 0);
  return COMBAT_KEYS.reduce((best, yk) => (n(yk) > n(best) ? yk : best), COMBAT_KEYS[0]);
}

export function attackerFormation(cfg) {
  return COMBAT_KEYS.indexOf(cfg.atk.formation) >= 0 ? cfg.atk.formation : dominantType(attackerTroops(cfg));
}

// effective bonus for a troop type = its own line + the army-wide line
export const effStat = (cfg, type, col) => num((cfg.def.stats[type] || {})[col]) + num(cfg.def.stats.army[col]);

// Trap counts by type. A plain number (older configs) is split evenly across the three.
export function trapCounts(wall) {
  const t = wall.traps;
  const o = {};
  if (typeof t === 'number') TRAP_KEYS.forEach((k) => { o[k] = Math.max(0, t) / TRAP_KEYS.length; });
  else TRAP_KEYS.forEach((k) => { o[k] = Math.max(0, num((t || {})[k])); });
  return o;
}

/* ═══════════════════════════ ARMY ═══════════════════════════ */
const EPS = 1e-9;

// Every troop type fights as SQUADS squads (wiki: 4 squads per type), and each squad holds an
// equal share of every tier of that type. Inside a squad the lowest tier dies first. This is
// what produces the exact halves and quarters in the reports (report 6: T1 and T2 ranged lost
// exactly 50%; report 7: T3 cavalry exactly 25%, attacking T5 infantry exactly 50%).
export const SQUADS = 4;

// Groups of squads, front to back. Phalanx: the 4 lead squads. Wedge: 2 lead squads, then 2
// squads of the type it counters, then the other 2 + 2 (report 6: a Ranged Wedge lost half
// its ranged tier by tier and no cavalry; report 3: an attacking Ranged Wedge lost 2 of 4
// ranged squads, then cavalry). Then the other combat types, then siege at the back.
function squadGroups(formation, stance) {
  const front = leadTypes(formation, stance), all = [0, 1, 2, 3];
  const g = stance === 'wedge'
    ? [[[front[0], [0, 1]]], [[front[1], [0, 1]]], [[front[0], [2, 3]], [front[1], [2, 3]]]]
    : [[[front[0], all]]];
  g.push(COMBAT_KEYS.filter((y) => front.indexOf(y) < 0).map((y) => [y, all]));
  g.push([['sie', all]]);
  return g;
}

function buildArmy(troops, statOf, formation, stance, mode, mana) {
  const cells = [];
  TIER_KEYS.forEach((tk) => TYPE_KEYS.forEach((yk) => {
    const c = Math.max(0, num((troops[tk] || {})[yk]));
    const s = statOf(yk), m = manaMult(mana, yk);
    for (let q = 0; q < SQUADS; q++) {
      cells.push({ tier:tk, type:yk, squad:q, start:c / SQUADS, count:c / SQUADS,
                   ehp:unitEhp(tk, yk, s.hp, s.def) * m, atk:unitAtk(tk, yk, s.atk) * m });
    }
  }));
  const army = { cells, mode, lines: battleLines(formation, stance) };
  army.groups = squadGroups(formation, stance).map((g) =>
    cells.filter((u) => g.some(([y, qs]) => u.type === y && qs.indexOf(u.squad) >= 0)));
  army.alive = () => cells.reduce((s, u) => s + u.count, 0);
  army.aliveOf = (types) => cells.reduce((s, u) => s + (types.indexOf(u.type) >= 0 ? u.count : 0), 0);
  army.ehp = () => cells.reduce((s, u) => s + u.count * u.ehp, 0);
  const groupAlive = (g) => g.reduce((s, u) => s + u.count, 0);
  // the group currently taking hits: the first one with anyone left in it
  army.currentGroup = () => army.groups.find((g) => groupAlive(g) > 0.5) || army.groups[0];
  army.currentLine = () => TYPE_KEYS.filter((y) => army.currentGroup().some((u) => u.type === y && u.count > 0));
  army.start = army.alive();
  // The front for output and morale: the formation's front, or — if the march/garrison owns
  // none of it — the first line that actually has troops.
  army.front = army.lines.find((types) => army.aliveOf(types) > 0.5) || army.lines[0];
  army.frontStart = army.aliveOf(army.front);
  return army;
}

// Count share of each type among the squads currently taking hits.
function lineShares(army) {
  const g = army.currentGroup();
  const n = g.reduce((s, u) => s + u.count, 0);
  const o = { inf:0, rng:0, cav:0, sie:0 };
  if (n > 0) g.forEach((u) => { o[u.type] += u.count / n; });
  return o;
}

// One squad takes a hit, lowest tier first. Returns the overkill.
function hitSquad(cells, dmg) {
  for (const u of cells) {               // cells are kept in tier order T1 -> T5
    if (dmg <= EPS) break;
    if (u.count <= 0) continue;
    const cap = u.count * u.ehp;
    if (dmg >= cap - EPS) { dmg -= cap; u.count = 0; } else { u.count -= dmg / u.ehp; dmg = 0; }
  }
  return Math.max(0, dmg);
}

// A group of squads takes a hit: side by side (equal shares, overkill re-shared) or one
// squad after another. Returns the overkill once the whole group is gone.
function hitGroup(group, dmg, mode) {
  const squads = [];
  group.forEach((u) => {
    const key = u.type + u.squad;
    let sq = squads.find((x) => x.key === key);
    if (!sq) squads.push(sq = { key, cells: [] });
    sq.cells.push(u);
  });
  const alive = (sq) => sq.cells.some((u) => u.count > 0);
  if (mode === 'sequential') {
    for (const sq of squads) { if (dmg <= EPS) break; if (alive(sq)) dmg = hitSquad(sq.cells, dmg); }
    return dmg;
  }
  let guard = 0;
  while (dmg > EPS && guard++ < 50) {
    const live = squads.filter(alive);
    if (!live.length) break;
    const share = dmg / live.length;
    dmg = live.reduce((over, sq) => over + hitSquad(sq.cells, share), 0);
  }
  return dmg;
}

// Damage into an army, group by group: the next group is only reached once the one in front of
// it is gone — and, unless PARAMS.lineSpill, not until the next round. Returns the damage left.
function applyDamage(army, dmg) {
  for (const g of army.groups) {
    if (!g.some((u) => u.count > 0)) continue;     // this group is already gone
    dmg = hitGroup(g, dmg, army.mode);
    if (dmg <= EPS || !PARAMS.lineSpill) return Math.max(0, dmg);
  }
  return dmg;
}

// Raw output of an army against a target line, before scaling. Front squads fight at full
// output, everyone else at PARAMS.support; a counter doubles damage against the share of
// the target line it counters.
function armyOutput(army, targetShares) {
  let out = 0;
  army.cells.forEach((u) => {
    if (u.count <= 0) return;
    const beats = TYPE[u.type].beats;
    const mult = 1 + COUNTER_BONUS * (beats ? targetShares[beats] : 0);
    const support = army.front.indexOf(u.type) >= 0 ? 1 : PARAMS.support;
    out += u.count * u.atk * support * mult;
  });
  return out;
}

// Same-formula morale for both sides (in-game, both armies have morale and retreat at 0%).
function makeMorale(army) {
  const M = PARAMS.morale;
  const collapsed = {};
  const m = { value:100 };
  m.output = () => M.minOutput + (1 - M.minOutput) * (m.value / 100);
  // frontBefore/aliveBefore are counts at the start of the round; enemyShares is the
  // composition of the line attacking this army's front.
  m.drain = (frontBefore, aliveBefore, enemyShares) => {
    const frontLost = frontBefore - army.aliveOf(army.front);
    const armyLost = aliveBefore - army.alive();
    let d = 100 * ((army.frontStart > 0 ? frontLost / army.frontStart : 0) * M.frontWeight +
                   (army.start > 0 ? armyLost / army.start : 0) * M.armyWeight) * M.rate;
    army.front.forEach((yk) => TIER_KEYS.forEach((tk) => {
      const sq = army.cells.filter((u) => u.type === yk && u.tier === tk);
      const key = yk + tk;
      if (!collapsed[key] && sq[0].start > 0 && sq.every((u) => u.count <= 0)) { collapsed[key] = true; d += M.breakShock; }
    }));
    // how much of the front is being hit by its counter
    const fn = army.aliveOf(army.front) || 1;
    let pressure = 0;
    army.cells.forEach((u) => {
      if (army.front.indexOf(u.type) >= 0 && u.count > 0 && COUNTERED_BY[u.type]) pressure += (u.count / fn) * (enemyShares[COUNTERED_BY[u.type]] || 0);
    });
    d *= 1 + (M.counterPen - 1) * pressure;
    m.value = Math.max(0, m.value - d);
  };
  return m;
}

/* ═══════════════════════════ ENGINE ═══════════════════════════ */
export function runSimulation(cfg) {
  const S = cfg;
  const P = PARAMS;

  const defFormation = COMBAT_KEYS.indexOf(S.def.formation) >= 0 ? S.def.formation : 'inf';
  const defStanceKey = STANCE[S.def.stance] ? S.def.stance : 'phalanx';
  const atkFormation = attackerFormation(cfg);
  const atkStanceKey = STANCE[S.atk.stance] ? S.atk.stance : 'phalanx';

  // structuredClone inside: never write through to the caller's config
  const D = buildArmy(structuredClone(S.troops), (yk) => ({
    atk:effStat(cfg, yk, 'atk'), def:effStat(cfg, yk, 'def'), hp:effStat(cfg, yk, 'hp') }), defFormation, defStanceKey,
    P.squadMode.def, S.def.mana);
  const A = buildArmy(attackerTroops(cfg), () => ({ atk:num(S.atk.stat), def:num(S.atk.def), hp:num(S.atk.hp) }),
    atkFormation, atkStanceKey, P.squadMode.atk, S.atk.mana);

  const defMorale = makeMorale(D), atkMorale = makeMorale(A);
  // engagement throughput: neither side can chew through a whole army in one exchange
  const defBite = D.ehp() * P.bite;
  const atkBite = A.ehp() * P.bite;

  // ── wall state ──────────────────────────────────────────────────────────
  const W = S.def.wall;
  const wallMaxHp = Math.max(0, num(W.maxHp));
  const wallMaxEhp = wallMaxHp * WALL_HP_SCALE;
  let wallHp = wallMaxEhp * clamp(num(W.pct), 0, 100) / 100;
  const wallStartHp = wallHp;
  const trapStartBy = trapCounts(W);
  const traps = Object.assign({}, trapStartBy);
  const trapTotal = () => TRAP_KEYS.reduce((s, k) => s + traps[k], 0);
  const trapStart = trapTotal();
  const trapDefMult = 1 + num(W.def) / 100;
  const trapEhpEach = TRAP.hp;
  // each trap type hits its counter type twice as hard, weighted by the line it is hitting
  const trapOutput = () => {
    const sh = lineShares(A);
    return TRAP_KEYS.reduce((s, k) => s + traps[k] * TRAP.atk * (1 + num(W.atk) / 100) *
      (1 + COUNTER_BONUS * (sh[TRAP_TYPE[k].beats] || 0)), 0) * P.damageScale;
  };
  const wallStood = wallHp > 0.5;
  // wallKills = every attacker killed while the wall stood; trapKills = the part the traps did
  let wallRounds = 0, wallKills = 0, trapKills = 0, trapVolleyKills = 0;

  // Traps get the first hit in, before the armies ever trade damage.
  if (wallStood && trapStart > 0) {
    const before = A.alive();
    applyDamage(A, trapOutput() * TRAP_VOLLEY);
    trapVolleyKills = before - A.alive();
    wallKills += trapVolleyKills;
    trapKills += trapVolleyKills;
  }

  let round = 0, outcome = null, lossReason = null, burstRounds = 0;
  const log = [];

  while (round < BATTLE_ROUNDS) {
    round++;
    const burst = round % FAMILIAR_PERIOD === 0;
    if (burst) burstRounds++;

    const defShares = lineShares(D), atkShares = lineShares(A);

    // attacker output, against the garrison's current line
    let atkDmg = armyOutput(A, defShares) * P.damageScale * atkMorale.output();
    atkDmg = Math.min(atkDmg, defBite) * (burst ? 1 + num(S.atk.familiar) / 100 : 1);
    // garrison output, against the march's current line
    let defDmg = armyOutput(D, atkShares) * P.damageScale * defMorale.output();
    defDmg = Math.min(defDmg, atkBite) * (burst ? 1 + num(S.def.familiar) / 100 : 1);

    const dFront = D.aliveOf(D.front), dAlive = D.alive();
    const aFront = A.aliveOf(A.front), aAlive = A.alive();

    const wallUp = wallHp > 0.5;
    if (wallUp) {
      // The march fights the wall and its traps; only what breaks through reaches the troops.
      wallRounds++;
      // Measured at the start of the round, like every other output. Against the wall, troop
      // counters do not apply — only siege's counter against traps (its share hits them 2x).
      const siegeOut = A.cells.reduce((s, u) => s + (u.type === 'sie' ? u.count * u.atk * (A.front.indexOf('sie') >= 0 ? 1 : P.support) : 0), 0);
      const plainOut = armyOutput(A, { inf:0, rng:0, cav:0, sie:0 });
      const siegeBoost = plainOut > 0 ? 1 + COUNTER_BONUS * (siegeOut / plainOut) : 1;
      let wallDmg = plainOut * P.damageScale * atkMorale.output();
      wallDmg = Math.min(wallDmg, defBite) * (burst ? 1 + num(S.atk.familiar) / 100 : 1);

      const beforeAtk = A.alive();
      const trapDmg = trapOutput();
      applyDamage(A, defDmg + trapDmg);
      const killed = beforeAtk - A.alive();
      wallKills += killed;
      // one combined hit, so credit the kills to traps by their share of the damage
      trapKills += (defDmg + trapDmg) > 0 ? killed * (trapDmg / (defDmg + trapDmg)) : 0;

      const trapPool = trapTotal() * trapEhpEach;
      const mitigated = wallDmg / trapDefMult;   // Trap DEF soaks part of the hit, applied once
      const wallShare = (wallHp + trapPool) > 0 ? wallHp / (wallHp + trapPool) : 1;
      const toWall = mitigated * wallShare;
      const toTraps = mitigated * (1 - wallShare) * siegeBoost;

      const wallAbsorbed = Math.min(wallHp, toWall);
      wallHp -= wallAbsorbed;
      const trapAbsorbed = Math.min(trapPool, toTraps);
      const trapsKilled = trapAbsorbed / trapEhpEach;
      const tNow = trapTotal();
      // trap losses are shared by count across the trap types
      if (tNow > 0) TRAP_KEYS.forEach((k) => { traps[k] = Math.max(0, traps[k] - trapsKilled * (traps[k] / tNow)); });

      // anything the wall and traps could not swallow breaches through to the garrison
      const breach = (toWall - wallAbsorbed) + (toTraps - trapAbsorbed) / siegeBoost;
      if (breach > EPS) applyDamage(D, breach * trapDefMult);
    } else {
      applyDamage(A, defDmg);
      applyDamage(D, atkDmg);
    }

    defMorale.drain(dFront, dAlive, atkShares);
    atkMorale.drain(aFront, aAlive, defShares);

    const line = (army) => army.currentLine().filter((y) => army.aliveOf([y]) > 0.5).map((y) => TYPE[y].short).join('+') || '-';
    log.push({ r:round, engaged: wallUp ? 'WALL' : line(D), burst,
               atkDmg, defDmg, morale:defMorale.value, atkMorale:atkMorale.value,
               atkLeft:A.alive(), frontLeft:D.aliveOf(D.front), lossRatio:1 - A.alive() / (A.start || 1),
               wallPct: wallMaxEhp > 0 ? (wallHp / wallMaxEhp) * 100 : 0 });

    // the defender is favoured on a same-round tie, as before
    if (A.alive() <= 0.5) { outcome = 'win'; break; }
    if (D.alive() <= 0.5) { outcome = 'loss'; lossReason = 'wiped'; break; }
    if (atkMorale.value <= 0) { outcome = 'retreat'; break; }
    if (defMorale.value <= 0) { outcome = 'loss'; lossReason = 'morale'; break; }
  }
  // engagement ran its full length with both sides still standing — judge on attrition
  if (!outcome) {
    const defLossPct = 1 - D.alive() / (D.start || 1);
    outcome = defLossPct >= 0.60 ? 'loss' : 'held';
    // a time-out loss is NOT a morale collapse — say which rule actually ended it
    if (outcome === 'loss') lossReason = 'attrition';
  }

  // report rows are per tier x type, summed over the type's squads
  const rowsOf = (army) => {
    const rows = [];
    TIER_KEYS.forEach((tk) => TYPE_KEYS.forEach((yk) => {
      const sq = army.cells.filter((u) => u.tier === tk && u.type === yk);
      const start = sq.reduce((s, u) => s + u.start, 0), left = sq.reduce((s, u) => s + Math.max(0, u.count), 0);
      rows.push({ tier:tk, type:yk, start, lost:Math.max(0, start - left), surv:left });
    }));
    return rows;
  };

  const defRows = rowsOf(D);
  const defLost = defRows.reduce((s, r) => s + r.lost, 0);
  const defSurv = defRows.reduce((s, r) => s + r.surv, 0);
  const mightLost = defRows.reduce((s, r) => s + r.lost * TIER[r.tier].might, 0);
  const armyStart = D.start || 1;

  const atkRows = rowsOf(A).filter((r) => r.start > 0);
  atkRows.forEach((r) => { r.wounded = 0; r.dead = 0; });
  const atkLost = atkRows.reduce((s, r) => s + r.lost, 0);
  const atkSurv = atkRows.reduce((s, r) => s + r.surv, 0);
  const atkStart = atkRows.reduce((s, r) => s + r.start, 0);
  const atkMightLost = atkRows.reduce((s, r) => s + r.lost * TIER[r.tier].might, 0);
  // 60% of the march's losses are wounded, and the wounded slots go to the highest tiers
  // first; within a tier they are shared in proportion to each squad's losses.
  // Event battles (e.g. Chaos Arena): troops on both sides are wounded, never killed.
  const noDeaths = !!S.event;
  let atkWoundQuota = atkLost * (noDeaths ? 1 : ATK_WOUNDED_SHARE);
  TIER_KEYS.slice().reverse().forEach((tk) => {
    const rows = atkRows.filter((r) => r.tier === tk);
    const lostTier = rows.reduce((s, r) => s + r.lost, 0);
    const take = Math.min(atkWoundQuota, lostTier);
    atkWoundQuota -= take;
    rows.forEach((r) => {
      r.wounded = lostTier > 0 ? take * (r.lost / lostTier) : 0;
      r.dead = r.lost - r.wounded;
    });
  });
  const atkWounded = atkRows.reduce((s, r) => s + r.wounded, 0);
  const atkDead = atkLost - atkWounded;

  let capacity = noDeaths ? Infinity : Math.max(0, num(S.def.infirmary));
  const ward = {}, overflowByTier = {};
  TIER_KEYS.slice().reverse().forEach((tk) => {
    const lostTier = defRows.filter((r) => r.tier === tk).reduce((s, r) => s + r.lost, 0);
    const take = Math.min(capacity, lostTier);
    ward[tk] = take; capacity -= take; overflowByTier[tk] = lostTier - take;
  });
  const wounded = TIER_KEYS.reduce((s, tk) => s + ward[tk], 0);
  const overflow = TIER_KEYS.reduce((s, tk) => s + overflowByTier[tk], 0);
  // Overflow: 80% goes to the Sanctuary while it has space; the rest dies.
  const sanctuaryCap = Math.max(0, num(S.def.sanctuary));
  const sanctuary = Math.min(overflow * SANCTUARY_DEF_SHARE, sanctuaryCap);
  const fallen = overflow - sanctuary;
  // Divine Providence revives a free 10% of the fallen; the rest is gone for good.
  const divine = fallen * DIVINE_PROVIDENCE_SHARE;
  const dead = fallen - divine;
  // tier mix of the overflow is unknown inside the sanctuary, so it is shared pro rata
  const deadRate = overflow > 0 ? dead / overflow : 0;

  const t5Wounded = ward.t5;
  const t5Dead = overflowByTier.t5 * deadRate;
  const bill = (n, ratio) => ({
    gear: n * T5_COST.gear, food: n * T5_COST.food * ratio, wood: n * T5_COST.wood * ratio,
    stone: n * T5_COST.stone * ratio, ore: n * T5_COST.ore * ratio
  });

  const trapLeftBy = {}, trapLostBy = {};
  TRAP_KEYS.forEach((k) => { trapLeftBy[k] = traps[k]; trapLostBy[k] = Math.max(0, trapStartBy[k] - traps[k]); });

  return {
    outcome, lossReason, rounds:round, formation:defFormation, log, event:noDeaths,
    morale:defMorale.value, atkMorale:atkMorale.value,
    defRows, defLost, defSurv, mightLost, armyStart,
    atkRows, atkLost, atkSurv, atkStart, atkMightLost, atkWounded, atkDead,
    ward, overflowByTier, wounded, overflow, sanctuary, sanctuaryCap, divine, dead,
    healCost: bill(t5Wounded, HEAL_RATIO), rebuildCost: bill(t5Dead, 1),
    t5Wounded, t5Dead, burstRounds,
    wallStood, wallStartHp:wallStartHp / WALL_HP_SCALE, wallHpLeft:wallHp / WALL_HP_SCALE, wallMaxHp,
    // both percentages are of MAX wall HP, so a wall that starts at 25% reads as 25%
    wallStartPct: wallMaxEhp > 0 ? (wallStartHp / wallMaxEhp) * 100 : 0,
    wallPctLeft: wallMaxEhp > 0 ? (wallHp / wallMaxEhp) * 100 : 0,
    wallRounds, wallKills, trapKills, trapVolleyKills,
    trapStart, trapLeft:trapTotal(), trapLost:Math.max(0, trapStart - trapTotal()), trapStartBy, trapLeftBy, trapLostBy,
    defLeads: D.front, atkLeads: A.front, atkFormation,
    defStanceLabel: STANCE[defStanceKey].label, atkStanceLabel: STANCE[atkStanceKey].label,
    lossPct: (1 - A.alive() / (A.start || 1)) * 100,
    frontStart: D.frontStart, frontLeft: D.aliveOf(D.front)
  };
}
