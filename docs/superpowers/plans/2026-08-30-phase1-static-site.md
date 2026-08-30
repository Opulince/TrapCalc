# Phase 1: Ship the Static Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-file Lords Mobile trap simulator into a deployable multi-page static site on Cloudflare Pages, with no runtime CSS compilation, a testable simulation engine, and a tip-jar link — no ads yet.

**Architecture:** The one 1,734-line HTML file splits into three layers: a pure zero-DOM simulation engine (`assets/engine.js`), DOM wiring that imports it (`assets/ui.js`), and static page shells (`index.html`, `about.html`, `privacy.html`). Tailwind moves from the runtime Play CDN to a prebuilt stylesheet compiled by the Tailwind v4 CLI. The engine being DOM-free is what makes zero-dependency Node tests possible, and it is the foundation the Phase 3 regression corpus will plug into.

**Tech Stack:** Static HTML/CSS/JS (ES modules, no bundler), Tailwind CSS v4 via `@tailwindcss/cli`, Node 24 built-in `node:test` (zero test dependencies), Cloudflare Pages via `wrangler`.

## Global Constraints

Every task's requirements implicitly include this section. Values copied verbatim from `docs/superpowers/specs/2026-08-30-monetization-design.md`.

- **No ads in this phase.** AdSense comes in Phase 2, after guides exist. Do not add ad slots, ad scripts, or a consent banner.
- **No paywall, no account wall, no login.** The simulator works with zero signup.
- **Full functionality with an ad blocker enabled**, and no nagging about it. No blocker detection.
- **Ko-fi copy is a plain tip jar** — "if this saved your troops". **No claimed running costs.** The site is free to operate; inventing a server bill would be dishonest.
- **Performance budget:** LCP under 2.5s on a mid-range Android over 3G. Under **~100KB JS** before any ad scripts.
- **The simulator must never white-screen.** Errors show a readable message instead.
- **Never build a public "who got zeroed" feed.** (No report display in this phase at all.)
- Running cost assumed **zero** — free Cloudflare tiers, free `*.pages.dev` subdomain. A custom domain is optional and not required.

## File Structure

| Path | Responsibility |
|---|---|
| `index.html` | Simulator page. Body markup + head meta only; no inline CSS or JS. |
| `about.html` | What the tool is, how it's calibrated, Ko-fi link. |
| `privacy.html` | Privacy policy. Required before any analytics or future ads. |
| `assets/engine.js` | **Pure simulation.** Constants, stat math, `runSimulation(cfg)`. Zero DOM references. ES module. |
| `assets/ui.js` | DOM building, rendering, event wiring, app state. Imports `engine.js`. ES module. |
| `assets/app.css` | **Built artifact** from Tailwind CLI. Committed so deploys need no build step. |
| `assets/og.png` | Open Graph card image, 1200×630. |
| `src/input.css` | Tailwind source: `@import`, `@theme` tokens, custom component CSS. |
| `test/engine.test.js` | Engine regression against real battle report 2. |
| `test/site.test.js` | Structural checks: meta tags, no CDN reference, sitemap/robots validity. |
| `package.json` | Scripts (`build`, `test`, `deploy`) and the two Tailwind dev dependencies. |
| `robots.txt`, `sitemap.xml` | Crawl directives and page index. |

**Deleted:** `lmtrapsim2.html` — verified stale (missing `WALL_HP_SCALE`, `activeLeads`, `inAtkDef`; it is an Aug 28 snapshot predating the wall model and the post-review engine fixes).

**Not in this phase:** guide pages. The spec puts them in Phase 2, and shipping empty placeholder routes would create exactly the thin content that gets AdSense applications rejected.

---

### Task 1: Initialize repository and remove the stale file

**Files:**
- Create: `.gitignore`
- Delete: `lmtrapsim2.html`

**Interfaces:**
- Consumes: nothing.
- Produces: a git repo at `G:\.CODE\solotrapcalc` with a baseline commit, so every later task can commit.

- [ ] **Step 1: Initialize the repository**

```bash
cd "G:/.CODE/solotrapcalc"
git init -b main
```

Expected: `Initialized empty Git repository in G:/.CODE/solotrapcalc/.git/`

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.wrangler/
.DS_Store
```

- [ ] **Step 3: Commit the current state as a baseline**

Commit the working simulator *before* any restructuring, so the pre-refactor behaviour is recoverable.

```bash
git add -A
git commit -m "chore: baseline — single-file simulator, calibration notes, specs"
```

- [ ] **Step 4: Verify the stale file is genuinely stale**

```bash
grep -c "WALL_HP_SCALE\|activeLeads\|inAtkDef" lmtrapsim2.html
```

Expected: `0` — confirming it predates the wall model and the post-review fixes.

- [ ] **Step 5: Delete it and commit**

```bash
git rm lmtrapsim2.html
git commit -m "chore: remove stale lmtrapsim2.html snapshot"
```

- [ ] **Step 6: Branch for the phase-1 work**

Keeps `main` at the pre-refactor baseline so the original single-file simulator stays recoverable.

```bash
git checkout -b phase-1
git branch --show-current
```

Expected: `phase-1`. All later tasks commit here.

---

### Task 2: Node test harness and the engine regression test (failing)

**Files:**
- Create: `package.json`
- Create: `test/engine.test.js`

**Interfaces:**
- Consumes: nothing yet.
- Produces: the exact contract `assets/engine.js` must satisfy in Task 3 —
  `runSimulation(cfg) -> { outcome, rounds, defRows, defLost, defSurv, atkRows, atkLost, atkSurv, atkStart, morale, wounded, overflow, revived, dead, wallRounds, wallKills, ... }`
  where `defRows` and `atkRows` are arrays of `{ tier, type, start, lost, surv }`.
  `cfg` has the shape `{ troops, def, atk }` documented in the test below.

- [ ] **Step 1: Create `package.json`**

`"type": "module"` is required so `node:test` can `import` the ES-module engine.

```json
{
  "name": "lm-trap-simulator",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tailwindcss -i ./src/input.css -o ./assets/app.css --minify",
    "test": "node --test test/*.test.js",
    "deploy": "npm run build && wrangler pages deploy ."
  },
  "devDependencies": {
    "@tailwindcss/cli": "^4.0.0",
    "tailwindcss": "^4.0.0"
  }
}
```

- [ ] **Step 2: Write the failing engine regression test**

This encodes real battle report 2 from `calibration-notes.md`. Expected values are the verified simulator output: attacker wiped 100%, defender loses ~64.4K, T1 100%, T2 ~23.6%, T4 exactly 0.

Create `test/engine.test.js`:

```js
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
    dp: 30,
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
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module ... assets/engine.js`. This is correct; the engine does not exist yet.

- [ ] **Step 4: Commit**

```bash
git add package.json test/engine.test.js
git commit -m "test: add engine regression test from real battle report 2"
```

---

### Task 3: Extract the pure simulation engine

**Files:**
- Create: `assets/engine.js`
- Read from: `lords-mobile-trap-simulator.html:469-1731` (the existing IIFE)

**Interfaces:**
- Consumes: the `cfg` contract from Task 2.
- Produces, for `assets/ui.js` in Task 4 — all named exports:
  - Constants: `TIER_KEYS`, `TYPE_KEYS`, `TIER`, `TYPE`, `COUNTERED_BY`, `STANCE`, `MARCH`, `PRESETS`, `LINEUPS`, `TIER_MIX`, `TRAP`, `T5_COST`, `STAT_CAP`, `HEAL_RATIO`
  - Functions: `runSimulation(cfg)`, `leadTypes(type, stance)`, `attackerTierShare(cfg)`, `attackerTypeShare(cfg)`, `dominantType(cfg)`, `effStat(cfg, type, col)`, `unitEhp(tk, yk, hpPct, defPct)`, `unitAtk(tk, yk, atkPct)`, `clamp(v, lo, hi)`

- [ ] **Step 1: Copy the engine half of the IIFE into the new module**

```bash
cd "G:/.CODE/solotrapcalc"
mkdir -p assets
sed -n '470,1731p' lords-mobile-trap-simulator.html > /tmp/iife-body.js
```

From `/tmp/iife-body.js`, move into `assets/engine.js` **only** these regions, in order — they are contiguous blocks in the original, identified by their section banner comments:

1. The `CONSTANTS` block: `TIER_KEYS` through `MORALE` (includes `TIER`, `TYPE`, `COUNTERED_BY`, `STANCE`, `leadTypes`, `MARCH`, `PRESETS`, `LINEUPS`, `TIER_MIX`, `TRAP`, `WALL_EROSION_FLOOR`, `TRAP_VOLLEY`, `WALL_HP_SCALE`, `T5_COST`, `HEAL_RATIO`, `DAMAGE_SCALE`, `BITE_DEF`, `BITE_ATK`, `LEAD_BONUS`, `FAMILIAR_PERIOD`, `BATTLE_ROUNDS`, `SUPPORT_FACTOR`, `COUNTER_BONUS`, `STAT_CAP`, `MORALE`).
2. `clamp`, `unitEhp`, `unitAtk`.
3. The whole `runSimulation` function.

Everything else (state, `$`, `n0`, `compact`, `pct`, `pctTxt`, all `build*`/`render*` functions, all event wiring, `doSim`, the INIT block) stays behind for `assets/ui.js`.

- [ ] **Step 2: Convert the four state-reading helpers to take `cfg`**

These currently close over the module-level `state`. In `assets/engine.js` they must be pure. Replace them with exactly:

```js
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

export const effStat = (cfg, type, col) => cfg.def.stats[type][col] + cfg.def.stats.army[col];
```

- [ ] **Step 3: Rewrite the `runSimulation` signature and its internal references**

Change the declaration and drop the closure read:

```js
export function runSimulation(cfg) {
  const S = cfg;
```

(The original body already starts `const S = state;` — replacing that single line with the parameter is the whole change.)

Then fix every call inside the body that previously read module state:

| Original | Replacement |
|---|---|
| `attackerTierShare()` | `attackerTierShare(cfg)` |
| `attackerTypeShare()` | `attackerTypeShare(cfg)` |
| `effStat(yk, 'hp')` | `effStat(cfg, yk, 'hp')` |
| `effStat(yk, 'def')` | `effStat(cfg, yk, 'def')` |
| `effStat(yk, 'atk')` | `effStat(cfg, yk, 'atk')` |
| `leadTypes(S.atk.formation, S.atk.stance)` | `leadTypes(dominantType(cfg), S.atk.stance)` |

- [ ] **Step 4: Guarantee the engine never mutates its input**

The engine writes to `u.count` on objects it builds itself, but `atkUnits`/`def` are constructed from `cfg` values by copy, so no mutation should occur. Add the defensive clone at the top of `runSimulation` anyway, immediately after `const S = cfg;`:

```js
  // Never write through to the caller's config — the UI reuses one object across runs.
  const troops = structuredClone(cfg.troops);
```

Then change the garrison build loop to read `troops[tk][yk]` instead of `S.troops[tk][yk]`.

- [ ] **Step 5: Add the export list and confirm zero DOM references**

```bash
grep -n "document\.\|window\.\|\$(" assets/engine.js
```

Expected: **no output.** Any hit means UI code was moved in by mistake — remove it.

- [ ] **Step 6: Run the tests**

```bash
npm test
```

Expected: all 6 tests PASS. If `report 2: defender total losses` fails, the extraction dropped a tuning constant — diff the constants block against the original lines 470-560.

- [ ] **Step 7: Commit**

```bash
git add assets/engine.js
git commit -m "refactor: extract pure DOM-free simulation engine"
```

---

### Task 4: Extract the UI module

**Files:**
- Create: `assets/ui.js`
- Read from: `lords-mobile-trap-simulator.html:469-1731`

**Interfaces:**
- Consumes: every export from `assets/engine.js` listed in Task 3.
- Produces: a module that self-initializes on load and wires `#btnSim` / `#btnSimMobile`. No exports.

- [ ] **Step 1: Create `assets/ui.js` with the engine import**

First line of the file:

```js
import {
  TIER_KEYS, TYPE_KEYS, TIER, TYPE, COUNTERED_BY, STANCE, MARCH, PRESETS,
  LINEUPS, TIER_MIX, T5_COST, STAT_CAP,
  runSimulation, leadTypes, attackerTierShare, attackerTypeShare, dominantType,
  effStat, clamp
} from './engine.js';
```

- [ ] **Step 2: Move the remaining IIFE body in**

Everything from `/tmp/iife-body.js` that Task 3 did *not* take: the `state` object, `STAT_ROWS`, `STAT_COLS`, `$`, `n0`, `compact`, `pct`, `pctTxt`, `totalCount`, `totalMight`, `tierCount`, `typeCountOf`, `lineupSplitText`, all `build*` and `render*` functions, `lossRow`, `renderResults`, all event listeners, `doSim`, and the INIT calls.

Drop the enclosing `(function () { 'use strict'; ... })();` wrapper — ES modules are already scoped and strict.

- [ ] **Step 3: Update every call site for the new `cfg`-taking signatures**

| Original | Replacement |
|---|---|
| `attackerTierShare()` | `attackerTierShare(state)` |
| `attackerTypeShare()` | `attackerTypeShare(state)` |
| `effStat(yk, 'atk')` | `effStat(state, yk, 'atk')` |
| `runSimulation()` | `runSimulation(state)` |

In `renderAttacker`, replace the inline dominant-type derivation with the engine's:

```js
    state.atk.formation = dominantType(state);
```

- [ ] **Step 4: Make a thrown simulation impossible to white-screen**

Replace the body of `doSim` with:

```js
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
```

- [ ] **Step 5: Verify the JS budget**

```bash
du -b assets/engine.js assets/ui.js | tail -1
```

Expected: combined well under 100,000 bytes (the original inline script is ~55KB).

- [ ] **Step 6: Commit**

```bash
git add assets/ui.js
git commit -m "refactor: extract UI module importing the engine"
```

---

### Task 5: Replace the Tailwind Play CDN with a prebuilt stylesheet

**Files:**
- Create: `src/input.css`
- Create: `assets/app.css` (build output)
- Modify: `package.json` (already has the scripts from Task 2)

**Interfaces:**
- Consumes: the class names present in `index.html`, `about.html`, `privacy.html`, `assets/ui.js`.
- Produces: `assets/app.css`, the single stylesheet every page links.

**Why this matters:** the Play CDN ships a compiler that builds CSS in the browser on every page load — the single worst thing on this plan's target device. All 171 class tokens are literal strings (verified; no computed class names), so a static build loses nothing.

- [ ] **Step 1: Install the Tailwind v4 CLI**

```bash
npm install
```

Expected: `@tailwindcss/cli` and `tailwindcss` installed, `node_modules/` created and gitignored.

- [ ] **Step 2: Create `src/input.css`**

The v4 `@theme` block replaces the old inline `tailwind.config`. `darkMode: 'class'` is deliberately **not** carried over — the page uses zero `dark:` variants (verified), so it was dead config. The custom CSS below is lifted verbatim from the original `<style>` block, lines 28-67.

```css
@import "tailwindcss";

@source "../index.html";
@source "../about.html";
@source "../privacy.html";
@source "../assets/ui.js";

@theme {
  --color-accent-50:  #ecfeff;
  --color-accent-100: #cffafe;
  --color-accent-200: #a5f3fc;
  --color-accent-300: #67e8f9;
  --color-accent-400: #22d3ee;
  --color-accent-500: #06b6d4;
  --color-accent-600: #0891b2;
  --color-accent-700: #0e7490;
  --color-accent-800: #155e75;
  --color-accent-900: #164e63;
  --color-accent-950: #083344;

  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
               "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

html { -webkit-text-size-adjust: 100%; }
body { background: #020617; }
.num { font-variant-numeric: tabular-nums; }

input[type=range] {
  -webkit-appearance: none; appearance: none; background: transparent;
  width: 100%; height: 20px; cursor: pointer; --thumb: #06b6d4;
}
input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 999px; background: #1e293b; }
input[type=range]::-moz-range-track { height: 4px; border-radius: 999px; background: #1e293b; }
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; margin-top: -6px;
  width: 16px; height: 16px; border-radius: 999px; background: var(--thumb);
  border: 3px solid #020617; box-shadow: 0 0 0 1px var(--thumb);
}
input[type=range]::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 999px; background: var(--thumb);
  border: 3px solid #020617; box-shadow: 0 0 0 1px var(--thumb);
}
input[type=range].rose { --thumb: #f43f5e; }

input[type=number] { -moz-appearance: textfield; }
input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

.field {
  background: transparent; border: 1px solid #1e293b; border-radius: 6px;
  outline: none; transition: border-color .15s, box-shadow .15s;
}
.field:focus { border-color: #06b6d4; box-shadow: 0 0 0 1px rgba(6,182,212,.35); }
.field.rose:focus { border-color: #f43f5e; box-shadow: 0 0 0 1px rgba(244,63,94,.35); }

::-webkit-scrollbar { width: 9px; height: 9px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: #334155; }

.bar { transition: width .5s cubic-bezier(.22,1,.36,1); }
.fade { animation: fade .3s ease-out both; }
@keyframes fade { from { opacity:0; transform: translateY(5px); } to { opacity:1; transform:none; } }
```

- [ ] **Step 3: Build the stylesheet**

```bash
npm run build
```

Expected: `assets/app.css` created. Verify the custom accent colour survived the theme migration:

```bash
grep -c "06b6d4" assets/app.css
```

Expected: `1` or more. A `0` means the `@theme` block did not take effect.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/input.css assets/app.css
git commit -m "build: compile Tailwind ahead of time, drop the runtime CDN"
```

---

### Task 6: Build the page shells

**Files:**
- Create: `index.html`, `about.html`, `privacy.html`
- Create: `test/site.test.js`
- Delete: `lords-mobile-trap-simulator.html` (superseded by `index.html`)

**Interfaces:**
- Consumes: `assets/app.css`, `assets/ui.js`, `assets/og.png`.
- Produces: three routes Cloudflare Pages serves at `/`, `/about`, `/privacy`.

- [ ] **Step 1: Write the failing structural test**

Create `test/site.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const PAGES = ['index.html', 'about.html', 'privacy.html'];
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('every page exists', () => {
  for (const p of PAGES) assert.ok(existsSync(new URL(`../${p}`, import.meta.url)), `${p} missing`);
});

test('no page loads the Tailwind Play CDN', () => {
  for (const p of PAGES) {
    assert.ok(!read(p).includes('cdn.tailwindcss.com'),
      `${p} still references the runtime CDN`);
  }
});

test('no page carries inline style or script blocks', () => {
  for (const p of PAGES) {
    const html = read(p);
    assert.ok(!/<style[\s>]/i.test(html), `${p} has an inline <style> block`);
    assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/i.test(html), `${p} has an inline <script> block`);
  }
});

test('every page has a title, description and canonical', () => {
  for (const p of PAGES) {
    const html = read(p);
    assert.match(html, /<title>[^<]{10,70}<\/title>/, `${p} title missing or wrong length`);
    assert.match(html, /<meta name="description" content="[^"]{50,160}"/, `${p} description missing or wrong length`);
    assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+"/, `${p} canonical missing`);
  }
});

test('every page has Open Graph tags for Discord unfurling', () => {
  for (const p of PAGES) {
    const html = read(p);
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
      assert.ok(html.includes(`property="${tag}"`), `${p} missing ${tag}`);
    }
    assert.ok(html.includes('name="twitter:card"'), `${p} missing twitter:card`);
  }
});

test('the tip jar never claims a running cost', () => {
  const banned = /server cost|hosting cost|pay the server|keep the lights|running costs/i;
  for (const p of PAGES) {
    assert.ok(!banned.test(read(p)), `${p} claims a cost the site does not have`);
  }
});

test('no ad or consent scripts ship in phase 1', () => {
  const banned = /adsbygoogle|googlesyndication|pagead|funding-choices/i;
  for (const p of PAGES) assert.ok(!banned.test(read(p)), `${p} contains ad code`);
});

test('robots.txt and sitemap.xml are consistent', () => {
  const robots = read('robots.txt');
  const sitemap = read('sitemap.xml');
  assert.match(robots, /Sitemap: https:\/\/\S+\/sitemap\.xml/);
  for (const route of ['/', '/about', '/privacy']) {
    assert.ok(sitemap.includes(`<loc>https://lm-trap-sim.pages.dev${route}</loc>`),
      `sitemap missing ${route}`);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npm test
```

Expected: FAIL — `index.html missing`.

- [ ] **Step 3: Build `index.html`**

Take `lords-mobile-trap-simulator.html` and make exactly these changes:

1. Delete line 7 (the CDN `<script>`), lines 8-26 (the inline `tailwind.config`), and lines 27-68 (the `<style>` block).
2. Delete lines 468-1732 (the inline `<script>` IIFE).
3. In `<head>`, after the `<title>`, insert:

```html
<meta name="description" content="Free Lords Mobile trap simulator. Model solo marches and full rallies against your garrison, wall and traps, and see exactly which tiers die." />
<link rel="canonical" href="https://lm-trap-sim.pages.dev/" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://lm-trap-sim.pages.dev/" />
<meta property="og:title" content="Lords Mobile Trap Simulator" />
<meta property="og:description" content="Model solo marches and rallies against your trap. See which tiers die, what your wall changes, and whether you hold." />
<meta property="og:image" content="https://lm-trap-sim.pages.dev/assets/og.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="stylesheet" href="/assets/app.css" />
```

4. Immediately before `</body>`, insert:

```html
<script type="module" src="/assets/ui.js"></script>
```

5. Immediately before the closing `</main>`, insert the tip jar and nav footer:

```html
  <footer class="mx-auto mt-8 max-w-[1500px] border-t border-slate-800 px-4 py-6 text-xs text-slate-400">
    <p>
      Free, no signup, no paywall. If this saved your troops,
      <a class="font-semibold text-accent-300 underline-offset-2 hover:underline"
         href="https://ko-fi.com/YOUR_KOFI_HANDLE" rel="noopener" target="_blank">buy me a coffee</a>.
    </p>
    <p class="mt-2">
      <a class="hover:text-slate-200" href="/about">About &amp; how it's calibrated</a> ·
      <a class="hover:text-slate-200" href="/privacy">Privacy</a>
    </p>
  </footer>
```

Replace `YOUR_KOFI_HANDLE` with the real Ko-fi handle. If there is no Ko-fi account yet, create one first — a dead link is worse than no link.

- [ ] **Step 4: Create `about.html`**

Same `<head>` pattern as `index.html` with its own title/description/canonical/OG URL (`/about`), the same stylesheet link, **no** `ui.js` script, and this body:

```html
<body class="min-h-screen font-sans text-slate-200 antialiased">
  <main class="mx-auto max-w-3xl px-4 py-10">
    <h1 class="text-xl font-semibold text-slate-50">About this simulator</h1>
    <p class="mt-4 text-sm leading-relaxed text-slate-300">
      This is a combat simulator for Lords Mobile trap accounts. It models a solo march or a full
      rally hitting your garrison, and reports which troops die, which survive, what your wall and
      traps absorbed, and where your casualties land between the infirmary and the sanctuary.
    </p>
    <h2 class="mt-8 text-base font-semibold text-slate-50">How it's calibrated</h2>
    <p class="mt-3 text-sm leading-relaxed text-slate-300">
      The engine is fitted against real battle reports, not guesswork. One report established that
      casualties climb the tier ladder globally — every T4 squad took zero losses while T1 was wiped
      and T2 bled 23% — and the engine was rewritten to match. It currently reproduces that report's
      total losses to within 2% and its tier distribution to within half a percentage point.
    </p>
    <h2 class="mt-8 text-base font-semibold text-slate-50">What is still guesswork</h2>
    <p class="mt-3 text-sm leading-relaxed text-slate-300">
      Base per-tier troop stats, the phalanx and wedge damage split, the wall HP conversion and the
      trap base stats are estimates. Army morale is a modelling device, not a real game mechanic.
      Treat relative comparisons as reliable and absolute numbers as indicative.
    </p>
    <p class="mt-8 text-sm text-slate-300">
      Free, no signup, no paywall. If it saved your troops,
      <a class="font-semibold text-accent-300 underline-offset-2 hover:underline"
         href="https://ko-fi.com/YOUR_KOFI_HANDLE" rel="noopener" target="_blank">buy me a coffee</a>.
    </p>
    <p class="mt-6 text-xs text-slate-400">
      <a class="hover:text-slate-200" href="/">← Back to the simulator</a> ·
      <a class="hover:text-slate-200" href="/privacy">Privacy</a>
    </p>
  </main>
</body>
```

- [ ] **Step 5: Create `privacy.html`**

Same head pattern, canonical `/privacy`, body:

```html
<body class="min-h-screen font-sans text-slate-200 antialiased">
  <main class="mx-auto max-w-3xl px-4 py-10">
    <h1 class="text-xl font-semibold text-slate-50">Privacy</h1>
    <p class="mt-4 text-sm leading-relaxed text-slate-300">
      This site does not ask you to sign up, and it does not store anything you type into the
      simulator. Every calculation runs entirely in your browser; your troop counts and stats are
      never sent anywhere.
    </p>
    <h2 class="mt-8 text-base font-semibold text-slate-50">Analytics</h2>
    <p class="mt-3 text-sm leading-relaxed text-slate-300">
      The site uses Cloudflare Web Analytics, which is cookieless and does not fingerprint or track
      visitors across sites. It records aggregate page views only. There is no Google Analytics and
      there are no advertising cookies.
    </p>
    <h2 class="mt-8 text-base font-semibold text-slate-50">Changes</h2>
    <p class="mt-3 text-sm leading-relaxed text-slate-300">
      If advertising is ever added, this page will be updated before it goes live, and any consent
      requirements will be honoured at that time.
    </p>
    <p class="mt-6 text-xs text-slate-400">
      <a class="hover:text-slate-200" href="/">← Back to the simulator</a> ·
      <a class="hover:text-slate-200" href="/about">About</a>
    </p>
  </main>
</body>
```

- [ ] **Step 6: Delete the superseded single file and run the tests**

```bash
git rm lords-mobile-trap-simulator.html
npm test
```

Expected: `robots.txt`/`sitemap.xml` test FAILS (Task 7 creates them); all other site tests and all 6 engine tests PASS.

- [ ] **Step 7: Rebuild the stylesheet now that the pages exist**

**This step is load-bearing.** Task 5 compiled `assets/app.css` while `index.html`,
`about.html` and `privacy.html` did not yet exist, so Tailwind's `@source` globs matched
nothing and every utility used only in page markup is missing from the stylesheet. Rebuilding
against the real pages is what makes the site render.

```bash
npm run build
```

Verify a class that appears **only** in the page markup, never in `assets/ui.js`, is now present:

```bash
grep -c "backdrop-blur-xl" assets/app.css
```

Expected: `1` or more. A `0` means the `@source` paths in `src/input.css` do not resolve —
check they are relative to `src/`, not the project root.

- [ ] **Step 8: Commit**

```bash
git add index.html about.html privacy.html test/site.test.js assets/app.css
git commit -m "feat: split the simulator into index, about and privacy pages"
```

---

### Task 7: Crawl files, Open Graph image, and analytics

**Files:**
- Create: `robots.txt`, `sitemap.xml`, `assets/og.png`
- Modify: `index.html`, `about.html`, `privacy.html` (analytics snippet)

**Interfaces:**
- Consumes: the three page routes from Task 6.
- Produces: a crawlable, unfurlable, measurable site.

- [ ] **Step 1: Create `robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://lm-trap-sim.pages.dev/sitemap.xml
```

- [ ] **Step 2: Create `sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://lm-trap-sim.pages.dev/</loc><priority>1.0</priority></url>
  <url><loc>https://lm-trap-sim.pages.dev/about</loc><priority>0.5</priority></url>
  <url><loc>https://lm-trap-sim.pages.dev/privacy</loc><priority>0.3</priority></url>
</urlset>
```

- [ ] **Step 3: Produce the Open Graph image**

Discord is the primary distribution channel and unfurls every link, so this is not decoration. Capture the simulator with results showing at 1200×630 and save as `assets/og.png`.

Capture it with headless Chrome, which needs no extra dependency:

```bash
npx --yes puppeteer-core --version 2>/dev/null || npm install --no-save puppeteer
node -e "
const puppeteer=require('puppeteer');
(async()=>{
  const b=await puppeteer.launch();
  const p=await b.newPage();
  await p.setViewport({width:1200,height:630});
  await p.goto('file://'+process.cwd().replace(/\\/g,'/')+'/index.html');
  await p.click('#btnSimMobile').catch(()=>{});
  await new Promise(r=>setTimeout(r,600));
  await p.screenshot({path:'assets/og.png'});
  await b.close();
})();
"
```

Verify it is a real image under 300KB:

```bash
file assets/og.png && du -h assets/og.png
```

Expected: `PNG image data, 1200 x 630`, size under 300K.

- [ ] **Step 4: Add Cloudflare Web Analytics to all three pages**

Cookieless, so it needs no consent banner. Insert immediately before `</body>` on each page, replacing the token after creating the site in the Cloudflare dashboard:

```html
<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "YOUR_CF_BEACON_TOKEN"}'></script>
```

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: all engine and site tests PASS, including the robots/sitemap consistency test.

- [ ] **Step 6: Commit**

```bash
git add robots.txt sitemap.xml assets/og.png index.html about.html privacy.html
git commit -m "feat: add robots, sitemap, OG card and cookieless analytics"
```

---

### Task 8: Deploy to Cloudflare Pages and verify the budget

**Files:**
- Modify: none (deployment only)

**Interfaces:**
- Consumes: the whole built site.
- Produces: a live `https://lm-trap-sim.pages.dev`.

- [ ] **Step 1: Deploy**

```bash
npx wrangler pages deploy . --project-name=lm-trap-sim
```

This prompts for a browser login on first run. Expected output ends with a deployment URL.

- [ ] **Step 2: Verify every route serves**

```bash
for r in "" about privacy sitemap.xml robots.txt assets/app.css assets/ui.js assets/engine.js; do
  printf "%-22s %s\n" "/$r" "$(curl -s -o /dev/null -w '%{http_code}' https://lm-trap-sim.pages.dev/$r)"
done
```

Expected: `200` for all eight.

- [ ] **Step 3: Confirm the runtime CDN is gone from production**

```bash
curl -s https://lm-trap-sim.pages.dev/ | grep -c "cdn.tailwindcss.com"
```

Expected: `0`.

- [ ] **Step 4: Check the JS budget against the constraint**

```bash
for f in assets/ui.js assets/engine.js assets/app.css; do
  printf "%-20s %s bytes\n" "$f" "$(curl -s https://lm-trap-sim.pages.dev/$f | wc -c)"
done
```

Expected: `ui.js` + `engine.js` combined **under 100,000 bytes**. If over, the extraction pulled in something it should not have.

- [ ] **Step 5: Run a mobile Lighthouse audit**

```bash
npx lighthouse https://lm-trap-sim.pages.dev/ --preset=desktop --quiet --chrome-flags="--headless" --only-categories=performance --form-factor=mobile --throttling-method=simulate --output=json --output-path=./lighthouse.json
node -e "const r=require('./lighthouse.json');console.log('LCP', r.audits['largest-contentful-paint'].displayValue, '| perf', r.categories.performance.score*100)"
```

Expected: LCP **under 2.5s**, performance score 90+. The CDN removal is what buys this; if LCP is still over budget, the OG image or the CSS is the next thing to check.

- [ ] **Step 6: Verify the simulator works with an ad blocker enabled**

Open the live URL in a browser with uBlock Origin active. Run a simulation. Expected: results render normally, no console errors, no prompts about the blocker.

- [ ] **Step 7: Commit and tag**

```bash
git add -A
git commit -m "chore: phase 1 deployment verified"
git tag phase-1
```

---

## Self-Review

**Spec coverage:**

| Spec requirement (Phase 1) | Task |
|---|---|
| Split single file into `/`, `/about`, `/privacy` | 6 |
| Replace Tailwind Play CDN with prebuilt CSS | 5 |
| Open Graph cards | 6 (tags), 7 (image) |
| `sitemap.xml`, `robots.txt` | 7 |
| Ko-fi tip jar, no claimed costs | 6, enforced by test in 6 |
| Cloudflare Web Analytics | 7 |
| No ads this phase | Enforced by test in 6 |
| Free `*.pages.dev` subdomain | 8 |
| LCP < 2.5s, JS < 100KB | 8 (steps 4-5) |
| Ad blocker safe | 8 (step 6) |
| Simulator never white-screens | 4 (step 4) |
| Delete stale `lmtrapsim2.html` | 1 |

Two deliberate deviations, both recorded above: **guide placeholder routes are dropped** (Phase 2 owns guides; empty routes are the thin content that gets AdSense rejected), and **the engine/UI split was added** (not named in the spec, but required — the CDN removal forces the JS out of the HTML anyway, and a DOM-free engine is what makes the spec's own testing requirement achievable, plus it is the seam Phase 3's regression corpus plugs into).

**Placeholder scan:** Three values are intentionally left for the implementer because they cannot be known until an external account exists — `YOUR_KOFI_HANDLE`, `YOUR_CF_BEACON_TOKEN`, and the `lm-trap-sim` project name if taken. Each is called out at its use site with what to do. No "TBD", no "add error handling", no "similar to Task N".

**Type consistency:** `runSimulation(cfg)` returns the same field names the Task 2 test asserts (`outcome`, `atkLost`, `defLost`, `defRows[{tier,type,start,lost,surv}]`, `rounds`). `effStat(cfg, type, col)` has the same argument order in Tasks 3 and 4. `dominantType(cfg)` is defined in Task 3 and consumed in Task 4. `attackerTierShare(cfg)` returns `.mix` in both.
