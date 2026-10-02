// Shareable links: the simulator's inputs packed into the URL hash. DOM-free so it runs under
// `node --test`. Only values that differ from the defaults are stored, so a link stays short and
// the default setup is a bare URL. Format: #s=1.<base64url JSON>, versioned for later changes.
import {
  TIER_KEYS, TYPE_KEYS, COMBAT_KEYS, TIER, STANCE, MARCH, LINEUPS, TIER_MIX, TRAP_KEYS, STAT_CAP,
  MANA_MAX, clamp
} from './engine.js';

const VERSION = '1';
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Leaves of `cur` that differ from `base`. Returns undefined when nothing differs.
export function diff(base, cur) {
  if (!isObj(base)) return base === cur ? undefined : cur;
  const out = {};
  for (const k of Object.keys(base)) {
    if (!(k in cur)) continue;
    const d = diff(base[k], cur[k]);
    if (d !== undefined) out[k] = d;
  }
  return Object.keys(out).length ? out : undefined;
}

// A copy of `base` with `patch` applied. Shaped by `base`: unknown keys are dropped and a value is
// only taken when its type matches the default's — a link is untrusted input.
export function merge(base, patch) {
  if (isObj(base)) {
    const out = {};
    for (const k of Object.keys(base)) out[k] = merge(base[k], isObj(patch) ? patch[k] : undefined);
    return out;
  }
  if (typeof base === 'number') return Number.isFinite(patch) ? patch : base;
  if (typeof base === typeof patch) return patch;
  return base;
}

const pick = (v, allowed, fallback) => (Object.prototype.hasOwnProperty.call(allowed, v) ? v : fallback);
const inList = (v, list, fallback) => (list.indexOf(v) >= 0 ? v : fallback);
// Upper bounds for inputs that have none in the UI, so a doctored link cannot push the engine
// into Infinity / NaN. Both sit far above anything in the game.
const MAX_CELL = 1e7, MAX_WALL_HP = 1e9;

// Clamp a merged state to what the inputs themselves allow. Siege is not an input, so it is 0.
export function sanitize(s, defaults) {
  TIER_KEYS.forEach((tk) => TYPE_KEYS.forEach((yk) => {
    s.troops[tk][yk] = yk === 'sie' ? 0 : Math.round(clamp(s.troops[tk][yk], 0, TIER[tk].max));
    s.atk.troops[tk][yk] = yk === 'sie' ? 0 : Math.round(clamp(s.atk.troops[tk][yk], 0, MAX_CELL));
  }));
  Object.keys(s.def.stats).forEach((row) => Object.keys(s.def.stats[row]).forEach((col) => {
    s.def.stats[row][col] = row === 'sie' ? 0 : clamp(s.def.stats[row][col], 0, STAT_CAP);
  }));
  const D = s.def, A = s.atk;
  D.formation = inList(D.formation, COMBAT_KEYS, defaults.def.formation);
  D.stance = pick(D.stance, STANCE, defaults.def.stance);
  D.wall.pct = clamp(D.wall.pct, 0, 100);
  D.wall.maxHp = clamp(D.wall.maxHp, 0, MAX_WALL_HP);
  D.wall.atk = clamp(D.wall.atk, 0, STAT_CAP);
  D.wall.def = clamp(D.wall.def, 0, STAT_CAP);
  TRAP_KEYS.forEach((k) => { D.wall.traps[k] = Math.round(clamp(D.wall.traps[k], 0, MAX_CELL)); });
  D.infirmary = clamp(D.infirmary, 0, MAX_WALL_HP);
  D.sanctuary = clamp(D.sanctuary, 0, MAX_WALL_HP);
  D.familiar = clamp(D.familiar, 0, 35);
  A.march = pick(A.march, MARCH, defaults.atk.march);
  A.total = Math.round(clamp(A.total, MARCH[A.march].min, MARCH[A.march].max));
  A.stat = Math.round(clamp(A.stat, 0, STAT_CAP));
  A.def = clamp(A.def, 0, STAT_CAP);
  A.hp = clamp(A.hp, 0, STAT_CAP);
  A.lineup = pick(A.lineup, LINEUPS, defaults.atk.lineup);
  A.tierMix = pick(A.tierMix, TIER_MIX, defaults.atk.tierMix);
  A.formation = inList(A.formation, COMBAT_KEYS, defaults.atk.formation);
  A.stance = pick(A.stance, STANCE, defaults.atk.stance);
  A.familiar = clamp(A.familiar, 0, 35);
  [D.mana, A.mana].forEach((m) => COMBAT_KEYS.forEach((yk) => { m[yk] = Math.round(clamp(m[yk], 0, MANA_MAX)); }));
  return s;
}

const toB64url = (str) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (str) => atob(str.replace(/-/g, '+').replace(/_/g, '/'));

// The hash for a state, or '' when it is the default setup.
export function encodeState(defaults, state) {
  const d = diff(defaults, state);
  return d === undefined ? '' : 's=' + VERSION + '.' + toB64url(JSON.stringify(d));
}

// A full, sanitized state from a hash, or null when the hash is not a valid share link.
export function decodeState(defaults, hash) {
  const m = /^#?s=(\d+)\.([A-Za-z0-9_-]+)$/.exec(hash || '');
  if (!m || m[1] !== VERSION) return null;
  let patch;
  try { patch = JSON.parse(fromB64url(m[2])); } catch { return null; }
  if (!isObj(patch)) return null;
  return sanitize(merge(defaults, patch), defaults);
}
