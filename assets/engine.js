'use strict';

/* ═══════════════════════════ CONSTANTS ═══════════════════════════ */
// Lowest tier first — casualties sponge upward. Confirmed by report 2026-08-28:
// T1 Cataphract wiped 100%, T2 Reptilian Rider lost 23%, every T4 squad lost 0.
export const TIER_KEYS = ['t1', 't2', 't3', 't4', 't5'];
export const TYPE_KEYS = ['inf', 'rng', 'cav'];

export const TIER = {
  t1: { key:'t1', name:'T1', role:'Chaff Layer',   might:4,  hp:10,  atk:10,  max:30000000, step:10000, base:0       },
  t2: { key:'t2', name:'T2', role:'Cushion Layer', might:8,  hp:20,  atk:20,  max:30000000, step:10000, base:1500000 },
  t3: { key:'t3', name:'T3', role:'Filler Layer',  might:20, hp:60,  atk:60,  max:10000000, step:10000, base:0       },
  t4: { key:'t4', name:'T4', role:'Core Layer',    might:36, hp:100, atk:100, max:10000000, step:5000,  base:400000  },
  t5: { key:'t5', name:'T5', role:'Lunar Layer',   might:48, hp:160, atk:160, max:600000,  step:2500,  base:100000  }
};

// Counter triangle: Infantry > Ranged > Cavalry > Infantry
export const TYPE = {
  inf: { key:'inf', name:'Infantry', short:'INF', hp:1.30, atk:0.80, def:1.35, beats:'rng' },
  rng: { key:'rng', name:'Ranged',   short:'RNG', hp:0.80, atk:1.40, def:0.80, beats:'cav' },
  cav: { key:'cav', name:'Cavalry',  short:'CAV', hp:1.00, atk:1.10, def:1.00, beats:'inf' }
};
export const COUNTERED_BY = {};
TYPE_KEYS.forEach((k) => { COUNTERED_BY[TYPE[k].beats] = k; });

export const MARCH = {
  solo:  { key:'solo',  name:'Solo',  min:10000,   max:375000,  step:5000,  base:250000  },
  rally: { key:'rally', name:'Rally', min:2000000, max:2450000, step:25000, base:2450000 }
};

export const PRESETS = {
  mid:   { march:'solo',  size:250000,  stat:450,  def:400,  hp:450,  tier:'t4'   },
  titan: { march:'solo',  size:375000,  stat:1100, def:1000, hp:1100, tier:'t5t4' },
  rally: { march:'rally', size:2450000, stat:1400, def:1250, hp:1400, tier:'t5h'  }
};

// parts are read in TYPE_KEYS order: infantry - ranged - cavalry
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
//  · A damaged wall loses HP more slowly than a full one.
// A trap is roughly a tanky T4-grade defender. Game Wall HP is quoted in its own units,
// so WALL_HP_SCALE converts it into the same effective-HP space the troops fight in.
// Both are estimates pending calibration against wall-up / wall-down report pairs.
export const TRAP = { hp:150, atk:120 };  // per-trap base, estimated
const WALL_HP_SCALE = 80;                 // game Wall HP -> engine EHP
const WALL_EROSION_FLOOR = 0.50;          // a wall at 0% integrity erodes at half rate
const TRAP_VOLLEY = 1.00;                 // pre-battle free strike, in rounds of trap output

export const T5_COST = { food:18000, wood:14000, stone:6000, ore:3600, gear:1, gemsPerGear:12 };
export const HEAL_RATIO = 0.30;

// A wedge fields two lead squads: the anchor plus the type it counters — which is
// exactly the type that hard-counters whatever counters the anchor.
export const STANCE = {
  phalanx: { label:'Phalanx', frontShare:0.72, weights:[1.00] },
  wedge:   { label:'Wedge',   frontShare:0.55, weights:[0.55, 0.45] }
};
export const leadTypes = (type, stance) => (stance === 'wedge' ? [type, TYPE[type].beats] : [type]);

// Real battles run a bounded engagement and end with BOTH sides holding survivors
// (report 08/28/26: attacker kept 84%, defender kept 22%) — so rounds are fixed,
// not fought to a wipe, and the caps that forced near-even exchanges are gone.
const BATTLE_ROUNDS     = 15;
const DAMAGE_SCALE      = 0.05;
const BITE_DEF          = 0.60;   // safety rail only: max share of defender EHP per round
const BITE_ATK          = 0.60;   // safety rail only: max share of attacker EHP per round
const LEAD_BONUS        = 0.15;   // spearhead squads strike harder
const FAMILIAR_PERIOD   = 3;      // familiar talent fires every N rounds
const SUPPORT_FACTOR    = 0.45;
const COUNTER_BONUS     = 1.00;   // +100% => 2x
export const STAT_CAP   = 1600;

const MORALE = {
  frontWeight: 0.75,   // share of drain from phalanx attrition
  armyWeight:  0.25,   // share of drain from overall attrition
  rate:        1.00,   // global drain multiplier
  breakShock:  7,      // flat drain when a phalanx tier layer collapses
  counterPen:  1.20,   // extra drain while being countered
  minOutput:   0.35    // defender damage floor at 0 morale
};

/* ═══════════════════════════ UTIL ═══════════════════════════ */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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
  const o = {};
  TYPE_KEYS.forEach((yk, i) => { o[yk] = L.parts[i] / sum; });
  return o;
}

// A march's lead type IS its composition's dominant type — "Ranged Wedge" is a ranged
// march. Derived here rather than in the UI so the engine has no hidden UI dependency.
export function dominantType(cfg) {
  const share = attackerTypeShare(cfg);
  return TYPE_KEYS.reduce((best, yk) => (share[yk] > share[best] ? yk : best), TYPE_KEYS[0]);
}

// effective bonus for a troop type = its own line + the army-wide line
export const effStat = (cfg, type, col) => cfg.def.stats[type][col] + cfg.def.stats.army[col];

/* ═══════════════════════════ ENGINE ═══════════════════════════ */
export function runSimulation(cfg) {
  const S = cfg;
  // Never write through to the caller's config — the UI reuses one object across runs.
  const troops = structuredClone(cfg.troops);

  const def = {};
  TYPE_KEYS.forEach((yk) => {
    def[yk] = {};
    TIER_KEYS.forEach((tk) => {
      const c = troops[tk][yk];
      def[yk][tk] = { tier:tk, type:yk, start:c, count:c,
                      ehp:unitEhp(tk, yk, effStat(cfg, yk, 'hp'), effStat(cfg, yk, 'def')),
                      atk:unitAtk(tk, yk, effStat(cfg, yk, 'atk')) };
    });
  });

  const tierShare = attackerTierShare(cfg), typeShare = attackerTypeShare(cfg);
  const atkUnits = [];
  Object.keys(tierShare).forEach((tk) => {
    TYPE_KEYS.forEach((yk) => {
      const c = S.atk.total * tierShare[tk] * typeShare[yk];
      if (c <= 0) return;
      atkUnits.push({ tier:tk, type:yk, start:c, count:c,
                      ehp:unitEhp(tk, yk, S.atk.hp, S.atk.def), atk:unitAtk(tk, yk, S.atk.stat) });
    });
  });

  const typeEhp   = (yk) => TIER_KEYS.reduce((s, tk) => s + def[yk][tk].count * def[yk][tk].ehp, 0);
  const typeAlive = (yk) => TIER_KEYS.reduce((s, tk) => s + def[yk][tk].count, 0);
  const defAlive  = () => TYPE_KEYS.reduce((s, yk) => s + typeAlive(yk), 0);
  const atkAlive  = () => atkUnits.reduce((s, u) => s + u.count, 0);
  const atkEhpNow = () => atkUnits.reduce((s, u) => s + u.count * u.ehp, 0);


  // Casualties climb the tier ladder GLOBALLY, not per type. Report 2026-08-28 proves it:
  // every T4 squad — infantry, ranged and cavalry alike — took 0 losses while T1 was wiped
  // and T2 bled 23%. So the lowest surviving tier of the whole army absorbs first; only when
  // it is gone does damage reach the tier above. Within a tier, the lead squads eat frontShare.
  // fronts: [{type, weight}] — one entry for a phalanx, two for a wedge
  function damageDefender(dmg, fronts, frontShare) {
    const cellEhp = (yk, tk) => def[yk][tk].count * def[yk][tk].ehp;

    for (let i = 0; i < TIER_KEYS.length && dmg > 1e-9; i++) {
      const tk = TIER_KEYS[i];
      const alive = TYPE_KEYS.filter((yk) => def[yk][tk].count > 0);
      if (!alive.length) continue;

      const cap = alive.reduce((s, yk) => s + cellEhp(yk, tk), 0);
      const take = Math.min(dmg, cap);
      dmg -= take;

      const frontHere = fronts.filter((fr) => alive.indexOf(fr.type) >= 0);
      const fSum = frontHere.reduce((s, fr) => s + fr.weight, 0) || 1;
      const others = alive.filter((yk) => !frontHere.some((fr) => fr.type === yk));
      const oEhp = others.reduce((s, yk) => s + cellEhp(yk, tk), 0);

      const share = {};
      alive.forEach((yk) => { share[yk] = 0; });
      if (frontHere.length && others.length) {
        frontHere.forEach((fr) => { share[fr.type] += take * frontShare * (fr.weight / fSum); });
        others.forEach((yk) => { share[yk] += oEhp > 0 ? take * (1 - frontShare) * (cellEhp(yk, tk) / oEhp) : 0; });
      } else if (frontHere.length) {
        frontHere.forEach((fr) => { share[fr.type] += take * (fr.weight / fSum); });
      } else {
        others.forEach((yk) => { share[yk] += oEhp > 0 ? take * (cellEhp(yk, tk) / oEhp) : 0; });
      }

      // apply, gathering any overkill to spread across what still stands in this tier
      let over = 0;
      alive.forEach((yk) => {
        const u = def[yk][tk], c = cellEhp(yk, tk), d = share[yk];
        if (d >= c) { over += d - c; u.count = 0; } else { u.count -= d / u.ehp; }
      });
      let guard = 0;
      while (over > 1e-9 && guard++ < 4) {
        const rem = TYPE_KEYS.filter((yk) => def[yk][tk].count > 0);
        if (!rem.length) break;
        const tot = rem.reduce((s, yk) => s + cellEhp(yk, tk), 0);
        const chunk = Math.min(over, tot);
        over -= chunk;
        let next = 0;
        rem.forEach((yk) => {
          const u = def[yk][tk], c = cellEhp(yk, tk), d = chunk * (cellEhp(yk, tk) / tot);
          if (d >= c) { next += d - c; u.count = 0; } else { u.count -= d / u.ehp; }
        });
        over += next;
      }
      dmg += over;  // whatever this tier could not swallow climbs to the next
    }
  }

  // The march climbs the same global tier ladder as the garrison: its lowest surviving
  // tier absorbs first, so a 60/40 T5/T4 march loses every T4 before a single T5 falls.
  function damageAttacker(dmg) {
    for (let i = 0; i < TIER_KEYS.length && dmg > 1e-9; i++) {
      const tk = TIER_KEYS[i];
      let guard = 0;
      while (dmg > 1e-9 && guard++ < 4) {
        const alive = atkUnits.filter((u) => u.tier === tk && u.count > 0);
        if (!alive.length) break;
        const tot = alive.reduce((s, u) => s + u.count * u.ehp, 0);
        if (tot <= 0) break;
        const chunk = Math.min(dmg, tot);
        dmg -= chunk;
        alive.forEach((u) => {
          u.count = Math.max(0, u.count - (chunk * ((u.count * u.ehp) / tot)) / u.ehp);
        });
      }
    }
  }

  const formation = S.def.formation;
  const defStance = STANCE[S.def.stance] || STANCE.phalanx;
  const atkStance = STANCE[S.atk.stance] || STANCE.phalanx;
  const defLeads = leadTypes(formation, S.def.stance);
  const atkLeads = leadTypes(dominantType(cfg), S.atk.stance);
  // an attacker wedge spreads its hit wider, so less of it lands on one squad
  const frontShare = atkStance.frontShare;
  const isLead = {};
  defLeads.forEach((yk) => { isLead[yk] = true; });
  const isAtkLead = {};
  atkLeads.forEach((yk) => { isAtkLead[yk] = true; });

  // If the chosen formation type is empty, whatever squads actually stand in for it become
  // the front — otherwise a garrison with no cavalry "loses" on round 1 with 90M troops left.
  const activeLeads = defLeads.filter((yk) => typeAlive(yk) > 0).length
    ? defLeads.filter((yk) => typeAlive(yk) > 0)
    : TYPE_KEYS.filter((yk) => typeAlive(yk) > 0);
  const frontOf = () => activeLeads.reduce((s, yk) => s + typeAlive(yk), 0);
  const frontStart = frontOf() || 1;
  const armyStart = defAlive() || 1;
  const atkStartTotal = atkUnits.reduce((s, u) => s + u.start, 0) || 1;
  const retreatAt = clamp(S.def.retreat, 1, 100) / 100;
  // engagement throughput: neither side can chew through a whole army in one exchange
  const defBite = TYPE_KEYS.reduce((s, yk) => s + typeEhp(yk), 0) * BITE_DEF;
  const atkBite = atkEhpNow() * BITE_ATK;
  const collapsed = {};
  // ── wall state ──────────────────────────────────────────────────────────
  const W = S.def.wall;
  const wallMaxHp = Math.max(0, W.maxHp);
  let wallHp = wallMaxHp * WALL_HP_SCALE * clamp(W.pct, 0, 100) / 100;
  const wallStartHp = wallHp;
  const trapStart = Math.max(0, W.traps);
  let trapCount = trapStart;
  const trapEhpEach = TRAP.hp * (1 + W.def / 100);
  const trapOutput = () => trapCount * TRAP.atk * (1 + W.atk / 100) * DAMAGE_SCALE;
  const wallStood = wallHp > 0.5;
  let wallRounds = 0, wallKills = 0, trapVolleyKills = 0;

  // Traps get the first hit in, before the armies ever trade damage.
  if (wallStood && trapCount > 0) {
    const before = atkAlive();
    damageAttacker(trapOutput() * TRAP_VOLLEY);
    trapVolleyKills = before - atkAlive();
    wallKills += trapVolleyKills;
  }

  let morale = 100, round = 0, outcome = null, burstRounds = 0;
  const log = [];

  while (round < BATTLE_ROUNDS) {
    round++;
    const burst = round % FAMILIAR_PERIOD === 0;
    if (burst) burstRounds++;

    // live lead squads and their share of the incoming hit
    let fronts = defLeads.map((yk, i) => ({ type:yk, weight:defStance.weights[i] || 0 }))
                         .filter((fr) => typeAlive(fr.type) > 0);
    if (!fronts.length) {
      fronts = [{ type: TYPE_KEYS.filter((yk) => typeAlive(yk) > 0)[0] || formation, weight:1 }];
    }
    const wSum = fronts.reduce((s, fr) => s + fr.weight, 0) || 1;

    const aEhp = atkEhpNow();
    const shares = { inf:0, rng:0, cav:0 };
    if (aEhp > 0) atkUnits.forEach((u) => { shares[u.type] += (u.count * u.ehp) / aEhp; });

    // counter bonus is weighted by how much of the hit lands on each lead squad
    let atkDmg = 0;
    atkUnits.forEach((u) => {
      if (u.count <= 0) return;
      let cw = 0;
      fronts.forEach((fr) => { if (TYPE[u.type].beats === fr.type) cw += fr.weight / wSum; });
      atkDmg += u.count * u.atk * (1 + COUNTER_BONUS * cw) * (isAtkLead[u.type] ? 1 + LEAD_BONUS : 1);
    });
    // burst lands after the throughput cap — that is what makes it a burst
    atkDmg = Math.min(atkDmg * DAMAGE_SCALE, defBite) * (burst ? 1 + S.atk.familiar / 100 : 1);

    const moraleOutput = MORALE.minOutput + (1 - MORALE.minOutput) * (morale / 100);
    let defDmg = 0;
    TYPE_KEYS.forEach((yk) => {
      const mult = 1 + COUNTER_BONUS * (shares[TYPE[yk].beats] || 0);
      const support = isLead[yk] ? 1 : SUPPORT_FACTOR;  // every lead squad fights at full output
      TIER_KEYS.forEach((tk) => {
        const u = def[yk][tk];
        if (u.count > 0) defDmg += u.count * u.atk * support * mult;
      });
    });
    defDmg = Math.min(defDmg * DAMAGE_SCALE * moraleOutput, atkBite) * (burst ? 1 + S.def.familiar / 100 : 1);

    const frontBefore = frontOf(), armyBefore = defAlive();

    // While the wall stands the march is fighting the wall and its traps, not the
    // garrison. Traps add their output; incoming damage splits between wall and traps
    // by HP share, and only what breaches the wall reaches the troops.
    const wallUp = wallHp > 0.5;
    if (wallUp) {
      wallRounds++;
      const beforeAtk = atkAlive();
      damageAttacker(defDmg + trapOutput());
      wallKills += beforeAtk - atkAlive();

      const trapPool = trapCount * trapEhpEach;
      const mitigated = atkDmg / (1 + W.def / 100);      // wall/trap DEF soaks part of the hit
      const wallShare = (wallHp + trapPool) > 0 ? wallHp / (wallHp + trapPool) : 1;

      // a battered wall erodes more slowly than a pristine one
      const erosion = WALL_EROSION_FLOOR + (1 - WALL_EROSION_FLOOR) * (wallStartHp > 0 ? wallHp / wallStartHp : 0);
      const toWall = mitigated * wallShare * erosion;
      const toTraps = mitigated * (1 - wallShare);

      const wallAbsorbed = Math.min(wallHp, toWall);
      wallHp -= wallAbsorbed;
      const trapAbsorbed = Math.min(trapPool, toTraps);
      trapCount = Math.max(0, trapCount - trapAbsorbed / trapEhpEach);

      // anything the wall and traps could not swallow breaches through to the garrison
      const breach = (toWall - wallAbsorbed) + (toTraps - trapAbsorbed);
      if (breach > 1e-9) damageDefender(breach * (1 + W.def / 100), fronts, frontShare);
    } else {
      damageAttacker(defDmg);
      damageDefender(atkDmg, fronts, frontShare);
    }

    const frontLost = frontBefore - frontOf();
    const armyLost = armyBefore - defAlive();
    let drain = 100 * ((frontLost / frontStart) * MORALE.frontWeight + (armyLost / armyStart) * MORALE.armyWeight) * MORALE.rate;
    activeLeads.forEach((yk) => TIER_KEYS.forEach((tk) => {
      const key = yk + tk, u = def[yk][tk];
      if (!collapsed[key] && u.start > 0 && u.count <= 0) { collapsed[key] = true; drain += MORALE.breakShock; }
    }));
    let counterPressure = 0;
    fronts.forEach((fr) => { counterPressure += (shares[COUNTERED_BY[fr.type]] || 0) * (fr.weight / wSum); });
    drain *= 1 + (MORALE.counterPen - 1) * counterPressure;
    morale = Math.max(0, morale - drain);
    if (frontOf() <= 0.5) morale = 0;

    const lossRatio = 1 - atkAlive() / atkStartTotal;
    log.push({ r:round, engaged: wallUp ? 'WALL' : fronts.map((fr) => TYPE[fr.type].short).join('+'), burst,
               atkDmg, defDmg, morale, atkLeft:atkAlive(), frontLeft:frontOf(), lossRatio,
               wallPct: wallStartHp > 0 ? (wallHp / wallStartHp) * 100 : 0 });

    if (atkAlive() <= 0.5) { outcome = 'win'; break; }
    if (lossRatio >= retreatAt) { outcome = 'retreat'; break; }
    if (morale <= 0) { outcome = 'loss'; break; }
  }
  // engagement ran its full length with both sides still standing — judge on attrition
  if (!outcome) {
    const defLossPct = 1 - defAlive() / armyStart;
    outcome = (1 - atkAlive() / atkStartTotal) >= retreatAt ? 'retreat'
            : (defLossPct >= 0.60 || frontOf() <= 0.5) ? 'loss'
            : 'held';
  }

  const defRows = [];
  let defLost = 0, defSurv = 0, mightLost = 0;
  TIER_KEYS.forEach((tk) => TYPE_KEYS.forEach((yk) => {
    const u = def[yk][tk];
    const lost = Math.max(0, u.start - u.count), surv = Math.max(0, u.count);
    defRows.push({ tier:tk, type:yk, start:u.start, lost, surv });
    defLost += lost; defSurv += surv; mightLost += lost * TIER[tk].might;
  }));

  const atkRows = [];
  let atkLost = 0, atkSurv = 0, atkStart = 0, atkMightLost = 0;
  atkUnits.forEach((u) => {
    const lost = Math.max(0, u.start - u.count);
    atkRows.push({ tier:u.tier, type:u.type, start:u.start, lost, surv:Math.max(0, u.count) });
    atkLost += lost; atkSurv += Math.max(0, u.count); atkStart += u.start; atkMightLost += lost * TIER[u.tier].might;
  });

  let capacity = Math.max(0, S.def.infirmary);
  const ward = {}, overflowByTier = {};
  TIER_KEYS.slice().reverse().forEach((tk) => {
    const lostTier = defRows.filter((r) => r.tier === tk).reduce((s, r) => s + r.lost, 0);
    const take = Math.min(capacity, lostTier);
    ward[tk] = take; capacity -= take; overflowByTier[tk] = lostTier - take;
  });
  const wounded = TIER_KEYS.reduce((s, tk) => s + ward[tk], 0);
  const overflow = TIER_KEYS.reduce((s, tk) => s + overflowByTier[tk], 0);
  const dpRate = clamp(S.def.dp, 0, 100) / 100;
  const revived = overflow * dpRate;
  const dead = overflow - revived;

  const t5Wounded = ward.t5;
  const t5Dead = overflowByTier.t5 * (1 - dpRate);
  const bill = (n, ratio) => ({
    gear: n * T5_COST.gear, food: n * T5_COST.food * ratio, wood: n * T5_COST.wood * ratio,
    stone: n * T5_COST.stone * ratio, ore: n * T5_COST.ore * ratio
  });

  return {
    outcome, rounds:round, formation, log, morale,
    defRows, defLost, defSurv, mightLost, armyStart,
    atkRows, atkLost, atkSurv, atkStart, atkMightLost,
    ward, overflowByTier, wounded, overflow, revived, dead,
    healCost: bill(t5Wounded, HEAL_RATIO), rebuildCost: bill(t5Dead, 1),
    t5Wounded, t5Dead, burstRounds,
    wallStood, wallStartHp:wallStartHp / WALL_HP_SCALE, wallHpLeft:wallHp / WALL_HP_SCALE, wallMaxHp,
    wallPctLeft: wallStartHp > 0 ? (wallHp / wallStartHp) * 100 : 0,
    wallRounds, wallKills, trapVolleyKills,
    trapStart, trapLeft:trapCount, trapLost:Math.max(0, trapStart - trapCount),
    defLeads: activeLeads, defStanceLabel: defStance.label, atkStanceLabel: atkStance.label,
    retreatPct: retreatAt * 100, lossPct: (1 - atkAlive() / atkStartTotal) * 100,
    frontStart, frontLeft: frontOf()
  };
}
