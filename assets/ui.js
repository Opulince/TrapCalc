// DOM building, rendering and event wiring. All combat maths lives in engine.js.
import {
  TIER_KEYS, TYPE_KEYS, COMBAT_KEYS, TIER, TYPE, STANCE, MARCH, PRESETS,
  LINEUPS, TIER_MIX, T5_COST, STAT_CAP, TRAP_KEYS, TRAP_TYPE,
  runSimulation, leadTypes, fillTroops, effStat, clamp
} from './engine.js';

/* ═══════════════════════════ STATE ═══════════════════════════ */
// Mirrors the in-game stat screen. Troop-type and Army bonuses stack additively,
// so effective Infantry ATK = inf.atk + army.atk. Defaults are real Leader-Deployed values.
// Trap ATK/DEF are their own stats — the leader bonus does not raise them,
// so they are kept out of the additive type+army grid. Defaults are real values.
// The single source of truth for defender defaults: initial state and Reset both copy it.
const DEF_DEFAULTS = {
  stats: {
    inf:  { atk:302.49, def:229.85, hp:201.72 },
    rng:  { atk:318.54, def:184.95, hp:185.83 },
    cav:  { atk:309.72, def:194.47, hp:201.08 },
    sie:  { atk:0,      def:0,      hp:0      },
    army: { atk:155.45, def:226.75, hp:348.00 }
  },
  formation:'cav', stance:'phalanx',
  // Wall Max HP is the player's boosted wall from report 4 (564,835); trap capacity is the in-game
  // table for their castle level (126,250). The trap split across types is a placeholder.
  wall: { maxHp:564835, pct:100, traps:{ spk:42084, twr:42083, log:42083 }, atk:60.84, def:66.92 },
  infirmary:300000, sanctuary:0, familiar:20,
  mana: { inf:0, rng:0, cav:0 }   // Mana Chamber level per type, 0-6
};

const state = {
  troops: {
    t1: { inf:0,       rng:0,       cav:0,       sie:0 },
    t2: { inf:1500000, rng:1500000, cav:1500000, sie:0 },
    t3: { inf:0,       rng:0,       cav:0,       sie:0 },
    t4: { inf:400000,  rng:400000,  cav:400000,  sie:0 },
    t5: { inf:100000,  rng:100000,  cav:100000,  sie:0 }
  },
  def: structuredClone(DEF_DEFAULTS),
  event: false,   // event battles (Chaos Arena etc.): nobody dies on either side
  // ATK / DEF / HP are independent, exactly as on the defender side. The march itself is a
  // tier x type squad grid; total / lineup / tierMix only drive the Quick Fill shortcut.
  // formation + stance is the lineup the report names, chosen independently of the troops.
  atk: { march:'solo', total:250000, stat:450, def:400, hp:450, lineup:'cav', tierMix:'t4',
         formation:'cav', stance:'phalanx', familiar:20, troops: fillTroops(250000, 'cav', 't4'),
         mana: { inf:0, rng:0, cav:0 } }
};
const refillMarch = () => { state.atk.troops = fillTroops(state.atk.total, state.atk.lineup, state.atk.tierMix); };
const marchTotal = () => TIER_KEYS.reduce((s, tk) => s + TYPE_KEYS.reduce((q, yk) => q + state.atk.troops[tk][yk], 0), 0);
const marchTypeCount = (yk) => TIER_KEYS.reduce((s, tk) => s + state.atk.troops[tk][yk], 0);

const STAT_ROWS = [
  { key:'inf',  label:'Infantry' },
  { key:'rng',  label:'Ranged' },
  { key:'cav',  label:'Cavalry' },
  { key:'army', label:'Army (all)' }
];
const STAT_COLS = [
  { key:'atk', label:'ATK' },
  { key:'def', label:'DEF' },
  { key:'hp',  label:'Max HP' }
];
// effective bonus for a troop type = its own line + the army-wide line

/* ═══════════════════════════ UTIL ═══════════════════════════ */
const $ = (id) => document.getElementById(id);
// the summary stats appear twice: pinned in the header on wider screens, in the page on phones
const setHdr = (key, text) => document.querySelectorAll('[data-hdr="' + key + '"]').forEach((el) => { el.textContent = text; });
const n0 = (v) => Math.round(v).toLocaleString('en-US');

function compact(v) {
  v = Math.round(v); const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(2) + 'T';
  if (a >= 1e9)  return (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6)  return (v / 1e6).toFixed(2) + 'M';
  if (a >= 1e3)  return (v / 1e3).toFixed(1) + 'K';
  return String(v);
}
const pct = (v, d) => (d > 0 ? (v / d) * 100 : 0);
const pctTxt = (v, d, dg) => pct(v, d).toFixed(dg === undefined ? 1 : dg) + '%';


const totalCount = () => TIER_KEYS.reduce((s, t) => s + TYPE_KEYS.reduce((q, y) => q + state.troops[t][y], 0), 0);
const totalMight = () => TIER_KEYS.reduce((s, t) => s + TIER[t].might * TYPE_KEYS.reduce((q, y) => q + state.troops[t][y], 0), 0);
const tierCount  = (t) => TYPE_KEYS.reduce((s, y) => s + state.troops[t][y], 0);
const typeCountOf = (y) => TIER_KEYS.reduce((s, t) => s + state.troops[t][y], 0);


/* ═══════════════════════════ BUILD DOM ═══════════════════════════ */
function buildTiers() {
  $('tierWrap').innerHTML = TIER_KEYS.map((tk) => {
    const t = TIER[tk];
    const rows = TYPE_KEYS.map((yk) => `
      <div class="grid grid-cols-12 items-center gap-x-3 gap-y-1 px-4 py-2.5">
        <div class="col-span-12 flex items-baseline justify-between sm:col-span-3">
          <span class="text-sm font-medium text-slate-300">${TYPE[yk].name}</span>
          <span id="mtm-${tk}-${yk}" class="num text-xs text-slate-400 sm:hidden">0</span>
        </div>
        <div class="col-span-7 sm:col-span-5">
          <input id="sl-${tk}-${yk}" data-tier="${tk}" data-type="${yk}" data-role="slider" type="range"
            min="0" max="${t.max}" step="${t.step}" value="${state.troops[tk][yk]}"
            aria-label="${t.name} ${TYPE[yk].name} count" />
        </div>
        <div class="col-span-5 sm:col-span-2">
          <input id="in-${tk}-${yk}" data-tier="${tk}" data-type="${yk}" data-role="number" type="number"
            min="0" max="${t.max}" step="${t.step}" value="${state.troops[tk][yk]}"
            class="field num w-full px-2 py-1.5 text-right text-sm font-semibold text-slate-100"
            aria-label="${t.name} ${TYPE[yk].name} value" />
        </div>
        <div class="col-span-2 hidden text-right sm:block">
          <span id="mtd-${tk}-${yk}" class="num text-xs font-medium text-slate-300">0</span>
        </div>
      </div>`).join('');

    return `
    <div class="border-t border-slate-800 first:border-t-0">
      <div class="flex items-center justify-between bg-slate-950/40 px-4 py-2">
        <div class="flex items-baseline gap-2">
          <span class="font-mono text-xs font-bold tracking-widest text-accent-300">${t.name}</span>
          <span class="text-xs text-slate-400">${t.might} might</span>
        </div>
        <div class="flex items-baseline gap-4">
          <span id="tc-${tk}" class="num text-xs font-semibold text-slate-200">0</span>
          <span id="tm-${tk}" class="num text-xs font-semibold text-accent-300">0</span>
        </div>
      </div>
      <div class="divide-y divide-slate-800/60">${rows}</div>
    </div>`;
  }).join('');
}

function buildTierMixes() {
  $('inAtkTier').innerHTML = Object.keys(TIER_MIX)
    .map((k) => '<option value="' + k + '">' + TIER_MIX[k].label + '</option>').join('');
}

function buildLineups() {
  $('inAtkLineup').innerHTML = Object.keys(LINEUPS).map((k) => {
    const L = LINEUPS[k];
    const sum = L.parts.reduce((a, b) => a + b, 0) || 1;
    const split = L.parts.filter((p) => p > 0).length > 1
      ? ' — ' + COMBAT_KEYS.map((yk, i) => Math.round(L.parts[i] / sum * 100) + '%').join('/')
      : '';
    return '<option value="' + k + '">' + L.label + split + '</option>';
  }).join('');
}

// The march as the report shows it: one box per tier x type.
function buildAtkGrid() {
  const cols = 'grid grid-cols-[1.75rem_repeat(4,minmax(0,1fr))] gap-1';
  const head = `<div class="${cols} pb-1">
    <span></span>${TYPE_KEYS.map((yk) => `<span class="text-right font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">${TYPE[yk].short}</span>`).join('')}
  </div>`;
  const rows = TIER_KEYS.map((tk) => `
    <div class="${cols} items-center py-0.5">
      <span class="font-mono text-xs font-bold tracking-widest text-rose-300">${TIER[tk].name}</span>
      ${TYPE_KEYS.map((yk) => `
        <input data-atk-tier="${tk}" data-atk-type="${yk}" type="number" min="0" step="1000" value="${state.atk.troops[tk][yk]}"
          class="field rose num w-full px-1 py-1 text-right text-[11px] font-semibold text-rose-200 sm:text-[12px]"
          aria-label="Attacker ${TIER[tk].name} ${TYPE[yk].name}" />`).join('')}
    </div>`).join('');
  $('atkGrid').innerHTML = head + rows;
}

function renderAtkGrid() {
  document.querySelectorAll('[data-atk-tier]').forEach((el) => {
    if (document.activeElement !== el) el.value = Math.round(state.atk.troops[el.dataset.atkTier][el.dataset.atkType]);
  });
  const fill = fillTroops(state.atk.total, state.atk.lineup, state.atk.tierMix);
  const custom = TIER_KEYS.some((tk) => TYPE_KEYS.some((yk) => Math.round(fill[tk][yk]) !== Math.round(state.atk.troops[tk][yk])));
  $('atkGridTag').textContent = n0(marchTotal()) + ' troops' + (custom ? ' · custom' : ' · from quick fill');
}

// Mana level pickers (0-6) for both sides.
function buildMana() {
  document.querySelectorAll('[data-mana-side]').forEach((el) => {
    el.innerHTML = [0, 1, 2, 3, 4, 5, 6].map((l) => '<option value="' + l + '">' + (l ? 'Lv ' + l + ' · +' + (l * 2) + '%' : 'None') + '</option>').join('');
  });
}
function renderMana() {
  document.querySelectorAll('[data-mana-side]').forEach((el) => {
    el.value = String(state[el.dataset.manaSide].mana[el.dataset.manaType] || 0);
  });
}

function buildDefStats() {
  const head = `
    <div class="grid grid-cols-12 items-center gap-x-2 px-4 pb-1 pt-2.5">
      <span class="col-span-3 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Troops</span>
      ${STAT_COLS.map((c) => `<span class="col-span-3 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">${c.label}</span>`).join('')}
    </div>`;

  const rows = STAT_ROWS.map((r) => `
    <div class="grid grid-cols-12 items-center gap-x-2 px-4 py-2 ${r.key === 'army' ? 'bg-slate-950/40' : ''}">
      <span class="col-span-3 text-sm font-medium ${r.key === 'army' ? 'text-accent-300' : 'text-slate-300'}">${r.label}</span>
      ${STAT_COLS.map((c) => `
        <div class="col-span-3">
          <div class="relative">
            <input data-srow="${r.key}" data-scol="${c.key}" type="number" min="0" max="${STAT_CAP}" step="1"
              value="${state.def.stats[r.key][c.key]}"
              class="field num w-full py-1.5 pl-1 pr-4 text-right text-[13px] font-semibold text-slate-100"
              aria-label="${r.label} ${c.label} percent" />
            <span class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">%</span>
          </div>
        </div>`).join('')}
    </div>`).join('');

  const eff = `
    <div class="px-4 py-2.5">
      <div class="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Effective (type + army)</div>
      <div id="defEff" class="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3"></div>
    </div>`;

  $('defStatWrap').innerHTML = head + rows + eff;
}

function renderDefEff() {
  const el = $('defEff');
  if (!el) return;
  el.innerHTML = COMBAT_KEYS.map((yk) => `
    <div class="rounded-md bg-slate-950/40 px-2 py-1.5">
      <div class="text-[11px] font-semibold text-slate-300">${TYPE[yk].name}</div>
      <div class="num text-[11px] text-slate-400">
        ATK ${effStat(state, yk, 'atk').toFixed(0)}% · DEF ${effStat(state, yk, 'def').toFixed(0)}% · HP ${effStat(state, yk, 'hp').toFixed(0)}%
      </div>
    </div>`).join('');
}

/* ═══════════════════════════ RENDER ═══════════════════════════ */
function renderTroops() {
  TIER_KEYS.forEach((tk) => {
    TYPE_KEYS.forEach((yk) => {
      const v = state.troops[tk][yk];
      const sl = $('sl-' + tk + '-' + yk), inp = $('in-' + tk + '-' + yk);
      if (document.activeElement !== sl) sl.value = v;
      if (document.activeElement !== inp) inp.value = v;
      const m = v * TIER[tk].might;
      $('mtd-' + tk + '-' + yk).textContent = compact(m) + ' might';
      $('mtm-' + tk + '-' + yk).textContent = compact(v) + ' · ' + compact(m) + ' might';
    });
    $('tc-' + tk).textContent = compact(tierCount(tk)) + ' units';
    $('tm-' + tk).textContent = compact(tierCount(tk) * TIER[tk].might);
  });

  const tc = totalCount();
  $('sumCount').textContent   = n0(tc);
  $('sumMight').textContent   = n0(totalMight());
  setHdr('count', compact(tc));
  setHdr('might', compact(totalMight()));
  $('sumFront').textContent   = compact(typeCountOf(state.def.formation)) + ' ' + TYPE[state.def.formation].short;
  $('sumCushion').textContent = pctTxt(tierCount('t1') + tierCount('t2') + tierCount('t3'), tc, 1);
}

function renderLunar() {
  const t5 = tierCount('t5');
  $('gearT5Total').textContent = n0(t5);
  $('costGear').textContent  = n0(t5 * T5_COST.gear);
  $('costFood').textContent  = compact(t5 * T5_COST.food);
  $('costWood').textContent  = compact(t5 * T5_COST.wood);
  $('costStone').textContent = compact(t5 * T5_COST.stone);
  $('costOre').textContent   = compact(t5 * T5_COST.ore);
  $('costGems').textContent  = compact(t5 * T5_COST.gear * T5_COST.gemsPerGear);
  setHdr('gear', compact(t5 * T5_COST.gear));
}

function renderWall() {
  const w = state.def.wall;
  const up = w.pct > 0;
  if (document.activeElement !== $('slWallPct')) $('slWallPct').value = w.pct;
  if (document.activeElement !== $('inWallPct')) $('inWallPct').value = w.pct;
  $('wallTag').textContent = up ? 'Wall Up · ' + w.pct + '%' : 'Wall Down';
  $('wallTag').className = 'font-mono text-[10px] uppercase tracking-widest ' +
    (up ? 'text-accent-300' : 'text-rose-400');
}

function renderFormation() {
  document.querySelectorAll('.formBtn').forEach((b) => {
    const on = b.dataset.form === state.def.formation;
    b.className = 'formBtn px-2 py-2.5 text-xs font-semibold transition ' +
      (on ? 'bg-accent-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100');
  });
  document.querySelectorAll('.defStanceBtn').forEach((b) => {
    const on = b.dataset.stance === state.def.stance;
    b.className = 'defStanceBtn px-2 py-2 text-xs font-semibold transition ' +
      (on ? 'bg-accent-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100');
  });

  const f = TYPE[state.def.formation];
  const st = STANCE[state.def.stance];
  setHdr('form', f.short + ' ' + st.label);
  $('formTag').textContent = f.name + ' ' + st.label;
}

function renderMarch() {
  const m = MARCH[state.atk.march];
  const sl = $('slAtkTotal'), inp = $('inAtkTotal');
  sl.min = m.min; sl.max = m.max; sl.step = m.step;
  inp.min = m.min; inp.max = m.max; inp.step = m.step;
  state.atk.total = clamp(state.atk.total, m.min, m.max);
  if (document.activeElement !== sl) sl.value = state.atk.total;
  if (document.activeElement !== inp) inp.value = state.atk.total;

  document.querySelectorAll('.marchBtn').forEach((b) => {
    const on = b.dataset.march === state.atk.march;
    b.className = 'marchBtn px-2 py-2.5 text-xs font-semibold transition ' +
      (on ? 'bg-rose-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100');
  });
  $('marchTag').textContent = m.name + ' · ' + n0(marchTotal());
}

function renderAttacker() {
  renderMarch();

  const slS = $('slAtkStat'), inS = $('inAtkStat');
  state.atk.stat = clamp(state.atk.stat, 0, STAT_CAP);
  if (document.activeElement !== slS) slS.value = state.atk.stat;
  if (document.activeElement !== inS) inS.value = state.atk.stat;
  $('inAtkLineup').value = state.atk.lineup;
  $('inAtkTier').value = state.atk.tierMix;
  if (document.activeElement !== $('inAtkDef')) $('inAtkDef').value = state.atk.def;
  if (document.activeElement !== $('inAtkHp')) $('inAtkHp').value = state.atk.hp;
  $('atkLineupName').textContent = TYPE[state.atk.formation].name + ' ' + STANCE[state.atk.stance].label;
  if (document.activeElement !== $('slAtkFam')) $('slAtkFam').value = state.atk.familiar;
  if (document.activeElement !== $('inAtkFam')) $('inAtkFam').value = state.atk.familiar;

  document.querySelectorAll('.atkStanceBtn').forEach((b) => {
    const on = b.dataset.atkstance === state.atk.stance;
    b.className = 'atkStanceBtn px-2 py-2 text-xs font-semibold transition ' +
      (on ? 'bg-rose-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100');
  });
  document.querySelectorAll('.atkFormBtn').forEach((b) => {
    const on = b.dataset.atkform === state.atk.formation;
    b.className = 'atkFormBtn px-2 py-2 text-xs font-semibold transition ' +
      (on ? 'bg-rose-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-slate-100');
  });
  renderAtkGrid();

  $('atkPreview').innerHTML = TYPE_KEYS.map((yk) => {
    const c = marchTypeCount(yk);
    const on = c > 0;
    return `
    <div class="px-4 py-2.5">
      <div class="font-mono text-[9px] uppercase tracking-[0.18em] ${on ? 'text-rose-400/90' : 'text-slate-500'}">${TYPE[yk].short}</div>
      <div class="num text-sm font-semibold ${on ? 'text-rose-200' : 'text-slate-500'}">${compact(c)}</div>
    </div>`;
  }).join('');

  document.querySelectorAll('.presetBtn').forEach((b) => {
    const p = PRESETS[b.dataset.preset];
    const on = state.atk.march === p.march && state.atk.total === p.size && state.atk.stat === p.stat &&
               state.atk.def === p.def && state.atk.hp === p.hp && state.atk.tierMix === p.tier &&
               $('atkGridTag').textContent.indexOf('custom') < 0;
    b.className = 'presetBtn px-3 py-2.5 text-left transition ' +
      (on ? 'bg-rose-500/15 text-rose-100 ring-1 ring-inset ring-rose-500/50' : 'bg-slate-900 text-slate-200 hover:bg-slate-800');
  });

  // Front against front: the share of each front made of the other side's counter.
  const defFront = leadTypes(state.def.formation, state.def.stance);
  const atkFront = leadTypes(state.atk.formation, state.atk.stance);
  const defN = (yk) => TIER_KEYS.reduce((s, tk) => s + state.troops[tk][yk], 0);
  const frontShare = (types, nOf) => {
    const n = types.reduce((s, y) => s + nOf(y), 0) || 1;
    const o = {}; types.forEach((y) => { o[y] = nOf(y) / n; }); return o;
  };
  const dS = frontShare(defFront, defN), aS = frontShare(atkFront, marchTypeCount);
  let defCounters = 0, atkCounters = 0;
  defFront.forEach((d) => atkFront.forEach((a) => {
    if (TYPE[d].beats === a) defCounters += dS[d] * aS[a];
    if (TYPE[a].beats === d) atkCounters += dS[d] * aS[a];
  }));
  $('matchup').innerHTML = defCounters > atkCounters
    ? '<span class="font-semibold text-accent-300">Favourable</span> · your front counters theirs'
    : atkCounters > defCounters
    ? '<span class="font-semibold text-rose-400">Countered</span> · their front counters yours'
    : '<span class="font-semibold text-slate-200">Neutral fronts</span>';
}

function renderAll() { renderTroops(); renderLunar(); renderWall(); renderFormation(); renderAttacker(); renderDefEff(); renderMana(); }


/* ═══════════════════════════ RESULTS UI ═══════════════════════════ */
function lossRow(label, lost, start) {
  const p = clamp(pct(lost, start), 0, 100);
  return `
  <tr class="border-t border-slate-800/60">
    <td class="whitespace-nowrap py-2 pr-3 text-sm text-slate-300">${label}</td>
    <td class="num py-2 pr-3 text-right text-sm text-slate-400">${compact(start)}</td>
    <td class="num py-2 pr-3 text-right text-sm font-semibold text-rose-400">${compact(lost)}</td>
    <td class="num py-2 pr-3 text-right text-sm font-semibold text-accent-300">${compact(start - lost)}</td>
    <td class="py-2" style="min-width:88px">
      <div class="flex items-center gap-2">
        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div class="bar h-full bg-rose-500" style="width:${p}%"></div>
        </div>
        <span class="num w-9 text-right text-xs text-slate-400">${p.toFixed(0)}%</span>
      </div>
    </td>
  </tr>`;
}

function renderResults(R) {
  const win = R.outcome === 'win' || R.outcome === 'retreat' || R.outcome === 'held';
  const wrap = $('resultsWrap');
  const headline = R.outcome === 'win' ? 'LEADER CAPTURED'
                 : R.outcome === 'retreat' ? 'MARCH REPELLED'
                 : R.outcome === 'held' ? 'FRONTLINE HELD'
                 : 'ZEROED / BURNED';

  const banner = `
  <div class="fade overflow-hidden rounded-xl border ${win ? 'border-accent-500/50' : 'border-rose-500/50'} bg-slate-900/60">
    <div class="border-b ${win ? 'border-accent-500/30 bg-accent-500/10' : 'border-rose-500/30 bg-rose-500/10'} px-4 py-3.5">
      <div class="font-mono text-[10px] uppercase tracking-[0.22em] ${win ? 'text-accent-300' : 'text-rose-300'}">Battle Result</div>
      <div class="mt-0.5 text-lg font-bold tracking-tight ${win ? 'text-accent-200' : 'text-rose-200'}">
        ${headline}
      </div>
    </div>

    <div class="px-4 py-3">
      <div class="mb-1.5 flex items-baseline justify-between">
        <span class="text-sm font-medium text-slate-300">Army Morale</span>
        <span class="num text-sm font-semibold ${R.morale > 50 ? 'text-accent-300' : R.morale > 20 ? 'text-amber-300' : 'text-rose-400'}">${R.morale.toFixed(1)}%</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-slate-800">
        <div class="bar h-full ${R.morale > 50 ? 'bg-accent-500' : R.morale > 20 ? 'bg-amber-500' : 'bg-rose-500'}" style="width:${clamp(R.morale, 0, 100)}%"></div>
      </div>

      <div class="mb-1.5 mt-3 flex items-baseline justify-between">
        <span class="text-sm font-medium text-slate-300">Enemy Morale</span>
        <span class="num text-sm font-semibold text-rose-300">${R.atkMorale.toFixed(1)}% <span class="text-slate-400">· ${R.lossPct.toFixed(1)}% of march lost</span></span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-slate-800">
        <div class="bar h-full bg-rose-500" style="width:${clamp(R.atkMorale, 0, 100)}%"></div>
      </div>
    </div>

    <div class="grid grid-cols-2 divide-x divide-y divide-slate-800 border-t border-slate-800 sm:grid-cols-4 sm:divide-y-0">
      <div class="px-4 py-2.5">
        <div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Rounds</div>
        <div class="num text-sm font-semibold text-slate-100">${R.rounds}</div>
      </div>
      <div class="px-4 py-2.5">
        <div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Enemy Losses</div>
        <div class="num text-sm font-semibold text-accent-300">${compact(R.atkLost)}</div>
        <div class="num text-[11px] text-slate-400">${compact(R.atkDead)} dead · ${compact(R.atkWounded)} wounded</div>
      </div>
      <div class="px-4 py-2.5">
        <div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Own Losses</div>
        <div class="num text-sm font-semibold text-rose-400">${compact(R.defLost)}</div>
      </div>
      <div class="px-4 py-2.5">
        <div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Might Lost</div>
        <div class="num text-sm font-semibold text-rose-400">${compact(R.mightLost)}</div>
      </div>
    </div>
  </div>`;

  const defTable = `
  <div class="fade overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
    <div class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
      <div>
        <div class="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">05 — Casualties</div>
        <h3 class="text-sm font-semibold text-slate-50">Defender Squad Breakdown</h3>
      </div>
      <span class="num text-xs font-semibold text-slate-300">${pctTxt(R.defLost, R.armyStart, 1)} of garrison</span>
    </div>
    <div class="overflow-x-auto px-4 py-1">
      <table class="w-full min-w-[440px]">
        <thead>
          <tr class="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">
            <th class="py-2 text-left font-medium">Unit</th>
            <th class="py-2 text-right font-medium">Start</th>
            <th class="py-2 text-right font-medium">Lost</th>
            <th class="py-2 text-right font-medium">Alive</th>
            <th class="py-2 text-left font-medium">Loss Rate</th>
          </tr>
        </thead>
        <tbody>
          ${TIER_KEYS.filter((tk) => R.defRows.some((r) => r.tier === tk && r.start > 0)).map((tk) => {
            const rows = R.defRows.filter((r) => r.tier === tk && r.start > 0);
            const s = rows.reduce((a, r) => a + r.start, 0);
            const l = rows.reduce((a, r) => a + r.lost, 0);
            return `
            <tr class="border-t border-slate-800">
              <td colspan="5" class="pb-1 pt-3">
                <span class="font-mono text-xs font-bold tracking-widest text-accent-300">${TIER[tk].name}</span>
                <span class="ml-2 text-xs text-slate-400">${compact(l)} / ${compact(s)} lost · ${pctTxt(l, s, 1)}</span>
              </td>
            </tr>` + rows.map((r) => lossRow(TYPE[r.type].name, r.lost, r.start)).join('');
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="grid grid-cols-2 divide-x divide-slate-800 border-t border-slate-800">
      <div class="px-4 py-2.5">
        <div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Inflicted Losses</div>
        <div class="num text-sm font-semibold text-accent-300">${n0(R.atkLost)} · ${compact(R.atkMightLost)} might</div>
        <div class="num text-[11px] text-slate-400">${n0(R.atkDead)} dead · ${n0(R.atkWounded)} wounded</div>
      </div>
      <div class="px-4 py-2.5">
        <div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Survived Troops</div>
        <div class="num text-sm font-semibold text-slate-100">${n0(R.defSurv)}</div>
      </div>
    </div>
  </div>`;

  const atkTable = `
  <div class="fade overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
    <div class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
      <div>
        <div class="font-mono text-[10px] uppercase tracking-[0.22em] text-rose-400/90">06 — March Report</div>
        <h3 class="text-sm font-semibold text-slate-50">Attacker Losses</h3>
      </div>
      <span class="num text-xs font-semibold text-slate-300">${compact(R.atkSurv)} survived</span>
    </div>
    <div class="overflow-x-auto px-4 py-1">
      <table class="w-full min-w-[440px]">
        <thead>
          <tr class="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">
            <th class="py-2 text-left font-medium">Unit</th>
            <th class="py-2 text-right font-medium">Sent</th>
            <th class="py-2 text-right font-medium">Lost</th>
            <th class="py-2 text-right font-medium">Left</th>
            <th class="py-2 text-left font-medium">Loss Rate</th>
          </tr>
        </thead>
        <tbody>
          ${R.atkRows.map((r) => lossRow(TIER[r.tier].name + ' ' + TYPE[r.type].name, r.lost, r.start)).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  const wallPanel = `
  <div class="fade overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
    <div class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
      <div>
        <div class="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">Castle Wall</div>
        <h3 class="text-sm font-semibold text-slate-50">${R.wallStood ? (R.wallHpLeft > 0.5 ? 'Wall Held' : 'Wall Breached') : 'Wall Was Already Down'}</h3>
      </div>
      <span class="num text-xs font-semibold ${R.wallHpLeft > 0.5 ? 'text-accent-300' : 'text-rose-400'}">
        ${R.wallStood ? R.wallPctLeft.toFixed(1) + '% HP left' : 'no wall'}
      </span>
    </div>
    <div class="px-4 py-3">
      <div class="h-2 overflow-hidden rounded-full bg-slate-800">
        <div class="bar h-full ${R.wallHpLeft > 0.5 ? 'bg-accent-500' : 'bg-rose-500'}" style="width:${clamp(R.wallPctLeft, 0, 100)}%"></div>
      </div>
    </div>
    <div class="grid grid-cols-2 divide-x divide-y divide-slate-800 border-t border-slate-800 sm:grid-cols-4 sm:divide-y-0">
      <div class="px-4 py-2.5">
        <div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Wall HP</div>
        <div class="num text-sm font-semibold text-slate-100">${compact(R.wallHpLeft)} / ${compact(R.wallMaxHp)}</div>
      </div>
      <div class="px-4 py-2.5">
        <div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Rounds Held</div>
        <div class="num text-sm font-semibold text-slate-100">${R.wallRounds} / ${R.rounds}</div>
      </div>
      <div class="px-4 py-2.5">
        <div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Traps Lost</div>
        <div class="num text-sm font-semibold text-rose-400">${n0(R.trapLost)} / ${n0(R.trapStart)}</div>
        <div class="num text-[11px] text-slate-400">${TRAP_KEYS.filter((k) => R.trapStartBy[k] > 0).map((k) => TRAP_TYPE[k].name + ' ' + compact(R.trapLostBy[k])).join(' · ')}</div>
      </div>
      <div class="px-4 py-2.5">
        <div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">Trap Kills</div>
        <div class="num text-sm font-semibold text-accent-300">${compact(R.trapKills)}</div>
      </div>
    </div>
  </div>`;

  const wardCap = Math.max(0, state.def.infirmary);
  const wardFill = clamp(pct(R.wounded, wardCap || 1), 0, 100);

  const tile = (label, value, cls) => `
      <div class="px-4 py-3">
        <div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">${label}</div>
        <div class="num text-base font-bold ${cls}">${n0(value)}</div>
      </div>`;
  // resource bills only show when there is something to pay
  const bills = [['T5 Heal Bill', R.t5Wounded, R.healCost], ['T5 Rebuild Bill', R.t5Dead, R.rebuildCost]].filter(([, n]) => n > 0.5);

  const wardCard = `
  <div class="fade overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
    <div class="border-b border-slate-800 px-4 py-3">
      <div class="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">07 — Recovery</div>
      <h3 class="text-sm font-semibold text-slate-50">Medical Ward &amp; Sanctuary</h3>
    </div>

    <div class="px-4 py-3.5">
      <div class="mb-1.5 flex items-baseline justify-between">
        <span class="text-sm font-medium text-slate-300">Infirmary</span>
        <span class="num text-sm text-slate-300">${n0(R.wounded)} / ${n0(wardCap)}</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-slate-800">
        <div class="bar h-full bg-accent-500" style="width:${wardFill}%"></div>
      </div>
    </div>

    <div class="grid grid-cols-2 divide-x divide-y divide-slate-800 border-t border-slate-800 sm:grid-cols-4 sm:divide-y-0">
      ${tile('Wounded', R.wounded, 'text-accent-300')}
      ${tile('Sanctuary', R.sanctuary, 'text-slate-100')}
      ${tile('Divine Providence', R.divine, 'text-amber-300')}
      ${tile('Dead', R.dead, 'text-rose-400')}
    </div>
    ${bills.length ? `
    <div class="grid grid-cols-1 divide-y divide-slate-800 border-t border-slate-800 ${bills.length > 1 ? 'sm:grid-cols-2 sm:divide-x sm:divide-y-0' : ''}">
      ${bills.map(([title, n, c]) => `
        <div class="px-4 py-3">
          <div class="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-400">${title} · ${compact(n)} units</div>
          <div class="mt-1.5 grid grid-cols-5 gap-2 text-center">
            ${[['Gear', c.gear], ['Food', c.food], ['Timber', c.wood], ['Stone', c.stone], ['Ore', c.ore]].map(([k, v]) => `
              <div>
                <div class="num text-xs font-semibold text-slate-100">${compact(v)}</div>
                <div class="font-mono text-[9px] uppercase tracking-wider text-slate-400">${k}</div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>` : ''}
  </div>`;

  const step = Math.max(1, Math.ceil(R.log.length / 10));
  const sample = [];
  for (let i = 0; i < R.log.length; i += step) sample.push(R.log[i]);
  if (sample[sample.length - 1] !== R.log[R.log.length - 1]) sample.push(R.log[R.log.length - 1]);

  const logCard = `
  <div class="fade overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
    <div class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
      <div>
        <div class="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">08 — Telemetry</div>
        <h3 class="text-sm font-semibold text-slate-50">Combat Log</h3>
      </div>
      <span class="text-xs text-slate-400">${R.rounds} rounds · every ${step} · <span class="text-amber-300">*</span> familiar burst (${R.burstRounds})</span>
    </div>
    <div class="overflow-x-auto px-4 py-1">
      <table class="w-full min-w-[460px] font-mono text-xs">
        <thead>
          <tr class="text-[9px] uppercase tracking-[0.16em] text-slate-400">
            <th class="py-2 text-left font-medium">Rnd</th>
            <th class="py-2 text-left font-medium">Front</th>
            <th class="py-2 text-right font-medium">Atk Dmg</th>
            <th class="py-2 text-right font-medium">Def Dmg</th>
            <th class="py-2 text-right font-medium">March</th>
            <th class="py-2 text-right font-medium">Front</th>
            <th class="py-2 text-right font-medium">Morale</th>
            <th class="py-2 text-right font-medium">Enemy</th>
          </tr>
        </thead>
        <tbody>
          ${sample.map((l) => `
            <tr class="border-t border-slate-800/60">
              <td class="py-1.5 text-slate-400">${l.r}${l.burst ? '<span class="text-amber-300" title="Familiar talent fired">*</span>' : ''}</td>
              <td class="py-1.5 text-accent-300">${l.engaged}</td>
              <td class="py-1.5 text-right text-rose-400">${compact(l.atkDmg)}</td>
              <td class="py-1.5 text-right text-accent-300">${compact(l.defDmg)}</td>
              <td class="py-1.5 text-right text-slate-300">${compact(l.atkLeft)}</td>
              <td class="py-1.5 text-right text-slate-300">${compact(l.frontLeft)}</td>
              <td class="py-1.5 text-right ${l.morale > 50 ? 'text-slate-300' : l.morale > 20 ? 'text-amber-300' : 'text-rose-400'}">${l.morale.toFixed(0)}%</td>
              <td class="py-1.5 text-right text-rose-300">${l.atkMorale.toFixed(0)}%</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  wrap.innerHTML = banner + wallPanel + defTable + atkTable + wardCard + logCard;
  wrap.scrollIntoView({ behavior:'smooth', block:'start' });
}

/* ═══════════════════════════ EVENTS ═══════════════════════════ */
$('tierWrap').addEventListener('input', (e) => {
  const el = e.target, role = el.dataset.role;
  if (role !== 'slider' && role !== 'number') return;
  const tk = el.dataset.tier, yk = el.dataset.type;
  let v = Number(el.value);
  if (!isFinite(v) || v < 0) v = 0;
  v = clamp(v, 0, TIER[tk].max);
  state.troops[tk][yk] = Math.round(v);
  renderTroops(); renderLunar();
});

$('defStatWrap').addEventListener('input', (e) => {
  const el = e.target, row = el.dataset.srow, col = el.dataset.scol;
  if (!row || !col) return;
  let v = Number(el.value);
  if (!isFinite(v) || v < 0) v = 0;
  state.def.stats[row][col] = clamp(v, 0, STAT_CAP);
  renderDefEff();
});

document.querySelectorAll('.formBtn').forEach((b) => b.addEventListener('click', () => {
  state.def.formation = b.dataset.form;
  renderFormation(); renderTroops(); renderAttacker();
}));

document.querySelectorAll('[data-wall]').forEach((el) => el.addEventListener('input', (e) => {
  const k = e.target.dataset.wall;
  let v = Number(e.target.value);
  if (!isFinite(v) || v < 0) v = 0;
  if (k === 'pct') v = clamp(v, 0, 100);
  if (k === 'atk' || k === 'def') v = clamp(v, 0, STAT_CAP);
  state.def.wall[k] = v;
  document.querySelectorAll('[data-wall="' + k + '"]').forEach((o) => { if (o !== e.target) o.value = v; });
  renderWall();
}));

document.querySelectorAll('[data-trap]').forEach((el) => el.addEventListener('input', (e) => {
  let v = Number(e.target.value);
  if (!isFinite(v) || v < 0) v = 0;
  state.def.wall.traps[e.target.dataset.trap] = Math.round(v);
  renderWall();
}));

document.querySelectorAll('.defStanceBtn').forEach((b) => b.addEventListener('click', () => {
  state.def.stance = b.dataset.stance;
  renderFormation(); renderTroops(); renderAttacker();
}));

document.querySelectorAll('.atkStanceBtn').forEach((b) => b.addEventListener('click', () => {
  state.atk.stance = b.dataset.atkstance;
  renderAttacker();
}));

document.querySelectorAll('.atkFormBtn').forEach((b) => b.addEventListener('click', () => {
  state.atk.formation = b.dataset.atkform;
  renderAttacker();
}));

// editing a squad box makes the march custom; quick fill no longer drives it until used again
$('atkGrid').addEventListener('input', (e) => {
  const el = e.target, tk = el.dataset.atkTier, yk = el.dataset.atkType;
  if (!tk || !yk) return;
  let v = Number(el.value);
  if (!isFinite(v) || v < 0) v = 0;
  state.atk.troops[tk][yk] = Math.round(v);
  renderAttacker();
});

document.querySelectorAll('[data-fam]').forEach((el) => el.addEventListener('input', (e) => {
  const side = e.target.dataset.fam;
  const v = clamp(Number(e.target.value) || 0, 0, 35);
  if (side === 'def') state.def.familiar = v; else state.atk.familiar = v;
  document.querySelectorAll('[data-fam="' + side + '"]').forEach((o) => { if (o !== e.target) o.value = v; });
}));

document.querySelectorAll('.marchBtn').forEach((b) => b.addEventListener('click', () => {
  const m = b.dataset.march;
  if (state.atk.march === m) return;
  state.atk.march = m;
  state.atk.total = MARCH[m].base;
  refillMarch();
  renderAttacker();
}));

document.querySelectorAll('.presetBtn').forEach((b) => b.addEventListener('click', () => {
  const p = PRESETS[b.dataset.preset];
  state.atk.march = p.march;
  state.atk.total = p.size;
  state.atk.stat = p.stat;
  state.atk.def = p.def;
  state.atk.hp = p.hp;
  state.atk.tierMix = p.tier;
  refillMarch();
  renderAttacker();
}));

['slAtkTotal', 'inAtkTotal'].forEach((id) => $(id).addEventListener('input', (e) => {
  const m = MARCH[state.atk.march];
  let v = Number(e.target.value);
  if (!isFinite(v)) v = m.base;
  state.atk.total = Math.round(clamp(v, m.min, m.max));
  if (id === 'inAtkTotal') $('slAtkTotal').value = state.atk.total;
  else $('inAtkTotal').value = state.atk.total;
  refillMarch();
  renderAttacker();
}));

['slAtkStat', 'inAtkStat'].forEach((id) => $(id).addEventListener('input', (e) => {
  let v = Number(e.target.value);
  if (!isFinite(v) || v < 0) v = 0;
  state.atk.stat = Math.round(clamp(v, 0, STAT_CAP));
  if (id === 'inAtkStat') $('slAtkStat').value = state.atk.stat;
  else $('inAtkStat').value = state.atk.stat;
  renderAttacker();
}));

$('inAtkDef').addEventListener('input', (e) => {
  state.atk.def = clamp(Number(e.target.value) || 0, 0, STAT_CAP); renderAttacker();
});
$('inAtkHp').addEventListener('input', (e) => {
  state.atk.hp = clamp(Number(e.target.value) || 0, 0, STAT_CAP); renderAttacker();
});

$('inAtkLineup').addEventListener('change', (e) => { state.atk.lineup = e.target.value; refillMarch(); renderAttacker(); });
$('inAtkTier').addEventListener('change', (e) => { state.atk.tierMix = e.target.value; refillMarch(); renderAttacker(); });
document.querySelectorAll('[data-mana-side]').forEach((el) => el.addEventListener('change', (e) => {
  state[e.target.dataset.manaSide].mana[e.target.dataset.manaType] = clamp(Number(e.target.value) || 0, 0, 6);
}));
$('inEvent').addEventListener('change', (e) => { state.event = e.target.checked; });
$('inInfirmary').addEventListener('input', (e) => { state.def.infirmary = Math.max(0, Number(e.target.value) || 0); });
$('inSanctuary').addEventListener('input', (e) => { state.def.sanctuary = Math.max(0, Number(e.target.value) || 0); });

$('btnResetTroops').addEventListener('click', () => {
  // the baseline garrison has no siege — that row is opt-in
  TIER_KEYS.forEach((tk) => TYPE_KEYS.forEach((yk) => { state.troops[tk][yk] = yk === 'sie' ? 0 : TIER[tk].base; }));
  renderTroops(); renderLunar();
});
$('btnResetStats').addEventListener('click', () => {
  // Reset restores every defender setting except the chosen formation type.
  state.def = Object.assign(structuredClone(DEF_DEFAULTS), { formation: state.def.formation });
  buildDefStats(); renderAll(); syncAllInputs();
});

// The value the engine will actually use for a given number input. Typing out of range is
// clamped in state immediately, but the box kept showing the raw text until something else
// re-rendered — so the screen could disagree with the simulation.
function canonicalValue(el) {
  const d = el.dataset;
  if (d.role === 'slider' || d.role === 'number') return state.troops[d.tier][d.type];
  if (d.srow) return state.def.stats[d.srow][d.scol];
  if (d.wall) return state.def.wall[d.wall];
  if (d.fam) return d.fam === 'def' ? state.def.familiar : state.atk.familiar;
  if (d.trap) return state.def.wall.traps[d.trap];
  if (d.atkTier) return state.atk.troops[d.atkTier][d.atkType];
  return {
    inAtkTotal: state.atk.total, slAtkTotal: state.atk.total,
    inAtkStat: state.atk.stat, slAtkStat: state.atk.stat,
    inAtkDef: state.atk.def, inAtkHp: state.atk.hp,
    inInfirmary: state.def.infirmary, inSanctuary: state.def.sanctuary
  }[el.id];
}
function syncInput(el) {
  const v = canonicalValue(el);
  if (v !== undefined && Number(el.value) !== v) el.value = v;
}
function syncAllInputs() { document.querySelectorAll('input').forEach(syncInput); }
// 'change' fires when an edit is committed (blur / Enter), never mid-typing
document.addEventListener('change', (e) => { if (e.target.tagName === 'INPUT') syncInput(e.target); });

function doSim(btn) {
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'RESOLVING…';
  setTimeout(() => {
    try {
      renderResults(runSimulation(state));
    } catch (err) {
      console.error(err);
      $('resultsWrap').innerHTML =
        '<div class="rounded-xl border border-rose-500/50 bg-slate-900/60 p-4">' +
        '<div class="font-mono text-[10px] uppercase tracking-[0.22em] text-rose-300">Simulation error</div>' +
        '<p class="mt-1 text-sm text-slate-300">Something broke while resolving this battle. ' +
        'Your inputs are untouched — adjust a value and try again.</p></div>';
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  }, 80);
}
$('btnSim').addEventListener('click', (e) => doSim(e.currentTarget));
$('btnSimMobile').addEventListener('click', (e) => doSim(e.currentTarget));

/* ═══════════════════════════ INIT ═══════════════════════════ */
try {
  buildTiers();
  buildLineups();
  buildTierMixes();
  buildDefStats();
  buildAtkGrid();
  buildMana();
  renderAll();
  syncAllInputs();
} catch (err) {
  console.error(err);
  const main = document.querySelector('main');
  if (main) {
    main.innerHTML =
      '<div class="rounded-xl border border-rose-500/50 bg-slate-900/60 p-4">' +
      '<div class="font-mono text-[10px] uppercase tracking-[0.22em] text-rose-300">Failed to load</div>' +
      '<p class="mt-1 text-sm text-slate-300">Something broke while setting up the simulator. ' +
      'Try reloading the page — nothing you entered was lost.</p></div>';
  }
}
