# Calibration Notes

Ground truth from real battle reports. Constants in `assets/engine.js` (`PARAMS`) are fitted to
these, not to intuition, and `test/engine.test.js` replays the reports on every `npm test`.
Anything not listed here as *confirmed* is still an estimate.

## Confirmed game rules

- **Counter triangle:** Infantry > Ranged > Cavalry > Infantry. (Player-confirmed 2026-08-28.)
- **Lineup is independent of composition.** Any troops can march in any phalanx or wedge
  (player-confirmed). Report 3 proves it: a "Ranged Wedge" that was 97% cavalry. *Correction:*
  these notes used to say the lead type was the march's majority type — wrong.
- **Losses hit the FRONT type(s) first, not the lowest tier of the whole army.** *Correction:* this
  used to say "global tier ladder". Report 3 disproves it: the defender (Cavalry Phalanx) lost
  only cavalry — T4 infantry and ranged lost exactly 0 while T4 cavalry lost 61%. The attacker
  (Ranged Wedge = ranged + cavalry in front) lost only ranged and cavalry; infantry lost 0. Report
  2 fits the same rule (every loss was cavalry), which also explains its surviving T1 Archer —
  ranged, so never in the line of fire.
- **Inside the front, lowest tier first — strictly, in 2 of 3 reports.** Report 2: T1 cav wiped,
  T2 cav −23%, T4 cav 0. Report 4: T1 rng wiped, T2 rng −42%, T3 and T4 rng exactly 0. Report 3 is
  the exception (T4 cav 61% dead with T2 cav at 82%; attacker T5 lost 34% with T4 at 50%) — and the
  only one with an attacking **wedge**. The model is strict; the wedge question is open.
- **Siege sits at the back.** Player experience: 10k T1 siege can be all that keeps a march from
  being wiped and its leader captured. The model reproduces this only if a finishing blow does
  not carry over into the next line in the same round (`PARAMS.lineSpill = false`).
- **Morale is on both sides** (player-confirmed, NamuWiki): an army retreats at 0%.
- **Event battles (Chaos Arena): nobody dies** on either side (player-confirmed; report 4: 378,000
  attackers lost, all wounded, 0 dead). The app has an "Event battle" switch for this.
- **Stats stack additively:** effective Infantry ATK = troop-type Infantry ATK + Army ATK.
  Only the **Leader Deployed** column counts.
- **Battles are bounded** and can end with both sides holding survivors (report 1), or with one
  side wiped (report 2).
- **Defender casualties become Wounded up to infirmary capacity;** Dead = 0 when capacity covers it.
- **Attacker casualties split 60% wounded / 40% dead**, highest tiers wounded first (wiki: Infirmary).
  Reports 1 and 3 match to the troop: 24,139 / 16,093 of 40,232 and 63,015 / 42,010 of 105,025.
- **Infirmary overflow (defending):** 80% goes to the Sanctuary while it has space; Divine Providence
  revives a free 10% of the dead (wiki: Infirmary, Sanctuary). Now modelled with a Sanctuary Capacity
  input. Divine Providence's own capacity cap is not modelled.
- **Might per troop:** T1 2 · T2 8 · T3 24 · T4 36 · T5 48 (wiki: Might). Report 3's might totals
  match to the point: attacker 4,321,320 and defender 6,538,516 (old T1 = 4 would be off by 7,308).
- **Total Losses can exceed wounded + dead** — the gap is destroyed traps, not modelled. Report 3
  has no gap, so its traps were probably not engaged (wall down) — unconfirmed.
- **Trap types** (wiki: Trap): spikes counter cavalry, towers counter ranged, rolling logs counter
  infantry, and **siege counters every trap**. Modelled; trap tiers are not.
- **Castle Wall capacity** (in-game table, player's castle): level 25 = 125,000 traps / 12,500 Wall
  HP; the player's current level = **126,250 traps / 12,625 Wall HP** before research boosts.
  The defense research tree raises wall HP enormously: report 4 shows **564,835 Wall HP**.
- **Castle Wall (researched, wiki + guides):**
  - Traps fight **only while Wall HP > 0**. At 0 HP traps are inert and the march begins
    attacking the troops inside the turf.
  - Traps strike **before** the armies trade damage — the defender's free first hit.
  - Incoming damage **splits between wall and traps in proportion to their HP**, so more traps
    pull damage off the wall and lengthen the wall fight.
  - **A damaged wall loses HP more slowly** than a full one.
  - Wall damage is gated on attacker ATK vs Wall DEF; if the attacker cannot out-damage wall
    DEF the wall is never touched. (Modelled as DEF mitigation, not a hard gate.)
  - After a successful invasion the wall burns 20 min and stops self-healing.

## Defender stat block (player, Leader Deployed)

| | ATK | DEF | Max HP |
|---|---|---|---|
| Infantry | 302.49 | 229.85 | 201.72 |
| Ranged | 318.54 | 184.95 | 185.83 |
| Cavalry | 309.72 | 194.47 | 201.08 |
| Army (all) | 155.45 | 226.75 | 348.00 |

Effective: Infantry 457.94 / 456.60 / 549.72 · Ranged 473.99 / 411.70 / 533.83 ·
Cavalry 465.17 / 421.22 / 549.08. These are now the app defaults.

## Report 1 — 2026-08-28 06:07, attacker win

`[sip]RAMBO 77 attacked Turf` — Ranged Wedge 254,800 vs Cavalry Phalanx 627,729.

| | Attacker | Defender |
|---|---|---|
| Total Losses | 40,232 (15.8%) | 489,923 (78.0%) |
| Wounded / Dead | 24,139 / 16,093 | 487,319 / 0 |
| Survived | 214,568 (84%) | 140,410 (22%) |
| Might lost | 1,638,912 (40.7/troop ⇒ T4/T5) | 11,344,952 (23.2/troop ⇒ T2-heavy) |

Exchange ratio **12.2 : 1**. Attacker held the counter (Ranged > Cavalry).

**Unknowns:** attacker stats; defender's per-tier composition; whether the stat block above
belongs to this defender.

**Status (pre-line-model engine): DOES NOT REPRODUCE.** With a guessed composition, defender losses plateau at 56–60%
across attacker stats 900–1500 (target 78%) and attacker losses run 1.8–6.9% (target 15.8%).
The plateau is **Army Morale hitting 0 and ending the engagement early** — the invented mechanic
truncating the battle before the real loss level is reached.

## Report 2 — defender win

Attacker 100,000, all T4: 40,000 inf / 25,000 rng / 35,000 cav (8-5-7 lineup). Wiped 100%.

| Defender squad | Size | Lost | % |
|---|---|---|---|
| Heroic Fighter (T4 inf) | 252,301 | 0 | 0% |
| Heroic Cannoneer (T4 rng) | 208,689 | 0 | 0% |
| Ancient Drake Rider (T4 cav) | 245,571 | 0 | 0% |
| Destroyer (T4 siege) | 5,036 | 0 | 0% |
| Reptilian Rider (T2 cav) | 201,251 | 46,447 | 23.1% |
| Archer (T1 rng) | 1 | 0 | 0% |
| Cataphract (T1 cav) | 16,880 | 16,880 | 100% |
| **Total** | **929,729** | **63,327** | **6.8%** |

**Status (line model, 2026-10-01): reproduces, with one known gap.** Attacker formation not
recorded — assumed Infantry Phalanx (its largest type). Siege 5,036 and the 1 Archer now included.
Fitted attacker ATK / DEF / HP: 1300 / 400 / 550.

| Signature | Real | Sim | Error |
|---|---|---|---|
| Outcome | attacker wiped | LEADER CAPTURED, 100% killed | ✓ |
| Only cavalry dies (inf/rng/siege 0) | yes | yes | ✓ |
| T1 Archer survives | yes | yes | ✓ |
| T1 cav lost | 16,880 | 16,880 | ✓ |
| T2 cav lost | 46,447 | 46,393 | −0.1% |
| T4 cav lost | **0** | **11,158** | gap |
| Defender total | 63,327 | 74,431 | +17.5% |

The previous "global ladder" fit hit +1.7% here, but that model got report 3 structurally wrong
(it killed T4 infantry/ranged and no T5), so it is retired.

*Correction:* this table used to list real Wounded as 487,319 — that is report 1's defender figure.
Report 2's total losses were only 63,327, so its wounded count was never recorded here.

## Report 3 — 2026-09-29 06:13, both sides survive

`[OSI]APXAHrE7I attacked Turf` — **Ranged Wedge 256,000** vs **Cavalry Phalanx 907,959** (the same
defender account as report 2). Wall state not recorded; total losses = wounded + dead exactly,
which suggests no traps were lost.

| Squad | Attacker size | Lost | Defender size | Lost |
|---|---|---|---|---|
| T5 cav (Luminary Lion Force) | 132,018 | 45,035 (34.1%) | – | – |
| T4 inf (Heroic Fighter) | 4,000 | 0 | 252,325 | 0 |
| T4 rng (Heroic Cannoneer) | 4,000 | 2,000 (50.0%) | 249,293 | 0 |
| T4 cav (Ancient Drake Rider) | 115,982 | 57,990 (50.0%) | 250,186 | 153,670 (61.4%) |
| T2 cav (Reptilian Rider) | – | – | 152,501 | 124,886 (81.9%) |
| T1 cav (Cataphract) | – | – | 3,654 | 3,654 (100%) |
| **Total** | **256,000** | **105,025** (63,015 W / 42,010 D) | **907,959** | **282,210** (all wounded) |

**Status: reproduces in shape, one tier split off.** Fitted attacker ATK / DEF / HP 1000 / 400 / 1150,
wall down, infirmary 500,000:

| Signature | Real | Sim | Error |
|---|---|---|---|
| Neither army wiped | yes | yes (FRONTLINE HELD, 15 rounds) | ✓ |
| Defender T4 inf / rng | 0 / 0 | 0 / 0 | ✓ |
| Defender T4 cav | 153,670 | 152,497 | −0.8% |
| Defender T2 cav | 124,886 (82%) | 152,501 (100%) | +22% |
| Defender total | 282,210 | 308,652 | +9.4% |
| Attacker T4 inf | 0 | 0 | ✓ |
| Attacker T4 cav | 57,990 | 58,937 | +1.6% |
| Attacker T4 rng | 2,000 | 2,578 | +29% (small squad) |
| Attacker T5 cav | 45,035 | 38,784 | −13.9% |
| Attacker total | 105,025 | 100,300 | −4.5% |

## Report 4 — Chaos Arena, defender win (wall destroyed, 0 traps)

`#529 [L*C]TOMAS CHELBI attacked Turf` — **Ranged Phalanx 378,000** (T5 cav 135,044 + T4 cav 242,956)
vs **Ranged Phalanx 2,221,034** behind a **564,835 HP wall** with 0 traps. Event kingdom: no deaths.

| Defender squad | Size | Lost |
|---|---|---|
| T4 inf / rng / cav / Destroyer | 328,727 / 339,867 / 330,724 / 18,308 | 0 |
| T3 inf / rng / cav | 143,400 / 159,578 / 131,110 | 0 |
| T2 inf / **rng** / cav | 163,278 / **158,080** / 166,474 | 0 / **66,513** / 0 |
| T1 inf / **rng** / cav | 59,138 / **46,077** / 19,059 | 0 / **46,077** / 0 |
| rows cut off the screenshot | 157,214 | 0 (entered as siege) |

Attacker wiped (378,000, all wounded). Wall 564,835 → 0. Might totals match to the point again.
Defender stat block not shown — the player's is used.

**What it changed:**
- **`WALL_HP_SCALE` 12,673 → 80.** At 12,673 the wall survived at 95% and the defender lost 0.
  It only falls with a scale of about 100 or less. (Batch 3 wrongly assumed the castle table's
  12,625 was the whole wall HP and scaled up to compensate.)
- **Tier order inside the front is strict** (`PARAMS.spread` 0.9 → 0) — see the fit below.

**Status: reproduces.** Fitted attacker 400 / 250 / 550: wiped in 13 rounds, wall falls in round 5,
defender lost 111,823 (−0.7%): T1 rng 46,077 ✓, T2 rng 65,746 (−1.2%), everything else 0 ✓.

## Fit (2026-10-01, reports 2 + 3 + 4)

| Within-front order | R2 | R3 | R4 | Total |
|---|---|---|---|---|
| Spread 0.9 (Batch 3) | – | – | 0.42 | 0.77 |
| **Strict (spread 0), damage scale 0.075** | **0.01** | 0.53 | **0.01** | **0.54** |

Current reproduction: report 2 defender 62,829 vs 63,327 (−0.8%, T4 cav 0 ✓); report 4 −0.7%;
report 3 defender T4 cav 153,579 vs 153,670 ✓ but T2 cav 100% vs 82% and attacker T5 0 vs 45,035.
Option kept open: spread only against an attacking wedge — needs a second wedge report.

### Earlier fit (reports 2 + 3 only, superseded)


Both reports scored together, attacker stats free per report (they are not in the reports).
Error = Σ|sim − real| per squad ÷ that side's real total losses.

| Model | Best total error |
|---|---|
| Old: global tier ladder + 72%/55% front shares | 1.01 (report 2: 0.007, report 3: 1.006) |
| Line model, base tier stats, damage scale 0.05 | 0.64 (attacker pinned at the 1,600% ATK cap) |
| **Line model, damage scale 0.125, spread 0.9, support 0.7, morale rate 0.5** | **0.35** (0.18 + 0.18) |
| Line model with the guide's tier ratios (T4 = 2.25 T2) | 0.86 — worse, rejected |

Findings from the fit:
- **Front routing is the big win** — it is what makes report 3's per-type zeros come out right.
  The trade-off is real: the old model matched report 2 almost perfectly and report 3 not at all;
  the new one is ~18% off on each.
- **The guide's tier strength ratios fit worse** than the engine's, so the base tier stats stay.
- **Morale drains slowly** (rate 0.5): in both reports the battle is better explained by the
  15-round limit than by a morale break. Morale still exists on both sides and can end a battle.
- `lineSpill` on or off fits equally well; off is chosen because it reproduces the siege anecdote.
- Many parameter combinations sit within 0.01 of the best — two reports cannot pin them down.

## Changes made from this data

1. Tier ladder extended to **T1–T5** (T1/T3 base stats are still estimates; might is now the
   game's T1 2 / T3 24).
2. **Global tier-ladder casualty routing** replacing per-type routing. *(Superseded by 8.)*
3. Defender stats rebuilt as the game's 12-field grid (3 types × ATK/DEF/HP + Army row),
   stacking additively; DEF now multiplies survivability instead of being a token factor.
4. Attacker spearhead derived from lineup instead of a separate control. *(Superseded by 8.)*
5. Solo march floor lowered 200,000 → 10,000 (report 2's march was 100,000).
6. Added 8-5-7 lineup (40/25/35).
7. Per-round throughput caps removed (they made a 12:1 exchange impossible); engagement fixed at
   15 rounds with a new `FRONTLINE HELD` outcome.

8. **Line-based routing** (Batch 3, 2026-10-01): front type(s) → other combat types → siege;
   lineup independent of composition; attacker entered squad by squad; morale on both sides;
   the "% of march killed" retreat threshold removed; typed traps; siege counters traps; wall
   defaults to the in-game 12,625 HP / 126,250 traps.

## Post-review engine fixes (all verified)

- Infirmary/Sanctuary totals summed only T5/T4/T2, silently dropping every T1 and T3 casualty
  while still spending ward capacity on them. Now sums the full ladder.
- Attacker survivability derived DEF and HP from one "attack stats" number, squaring a single
  input. The march now has its own **ATK / DEF / Max HP**, verified independent and monotonic
  (DEF 400→1600 cuts attacker deaths 196.9K→65.3K; HP 450→1400 cuts them 196.9K→81.5K).
- Attacker casualties ignored the tier ladder. (Superseded by the line model: both armies now
  route damage the same way.)
- Picking a formation type with zero troops forced morale to 0 on round 1 and lost instantly
  regardless of army size. Morale now follows the squads actually holding the line.
- Attacker tier mixes extended to the full T1–T5 ladder (was T4/T5 only).

## Still wrong / still invented

1. **Report 3's tier mixing.** Strict order fits reports 2 and 4 almost exactly but misses report 3
   (the only attacking wedge). Whether wedges spread damage across tiers is untested.
2. **Morale formula** — the mechanic is real, its drain formula (front/army weights, collapse
   shock, counter penalty) is invented; only the overall rate is fitted.
3. Base troop stats (T1–T5 = 10/20/60/100/160) and type modifiers — invented; tested against the
   guide's ratios, which fit worse.
4. `BATTLE_ROUNDS` (15), familiar burst period, bite cap, the 60%-loss time-out rule — invented.
5. **Siege troop stats** — placeholders (neutral multipliers). Siege's position (back line) and
   its trap counter are sourced; how hard it hits troops is not.
6. **Traps and wall** — `TRAP` stats, `WALL_HP_SCALE` and trap tiers are uncalibrated (see below).
7. T5 resource costs — guessed. Confirmed only that T5 = T4 + 1 Luminous Gear (1:1), so a rebuilt
   T5 also consumes a T4, which the rebuild bill ignores.
8. Report 2's attacker formation is assumed (Infantry Phalanx).

## Wall model (implemented, uncalibrated)

Wall HP %, Wall Max HP, trap counts per type and Trap ATK/DEF are inputs; trap stats sit outside
the additive type+army grid because the leader bonus does not raise them (both stat columns showed
+60.84 / +66.92). Wall Max HP defaults to the player's 564,835; `WALL_HP_SCALE` = 80 (report 4).
*The measured table below predates that fix (it used scale 12,673) — re-measure before quoting.*

**Fixed after code review:** an extra erosion multiplier slowed damaged walls on top of the
HP-proportional wall/trap split, which already produces that effect (counted twice); Trap DEF was
applied both to trap HP and as damage mitigation (counted twice); "Trap Kills" included every kill
the garrison made while the wall stood; wall % was relative to starting HP, not max HP.

Measured, app defaults (6M mixed garrison, 126,250 traps split evenly, 12,625 Wall HP) vs the
Maxed Titan Solo preset (375k, 60% T5 / 40% T4 cavalry):

| Wall | Rounds held | Trap kills | All kills while wall stood | Defender losses |
|---|---|---|---|---|
| 100% | 4 | 0.8K | 56.7K | 752.4K |
| 75% | 3 | 0.7K | 43.4K | 828.8K |
| 50% | 3 | 0.6K | 43.3K | 904.4K |
| 25% | 2 | 0.5K | 27.2K | 979.1K |
| 0% (down) | 0 | 0 | 0 | 1,088.3K |

The wall falls faster than before because the fitted damage scale (0.125, was 0.05) makes every
attacker hit harder, and the trap default dropped from 200k to the real 126,250.

**Red flag:** traps still do ~1–2% of the kills. For trap accounts that is very unlikely to match
the game. Every wall/trap number above is uncalibrated until there is a wall-up report.

**Wall state is a required input when reproducing any report.**

## To finish calibrating

- **A wall-up report WITH traps** (counts per type), to calibrate the `TRAP` stats and trap
  output. Report 4 pinned the wall scale but had 0 traps. Highest value now.
- **A report where the attacker used a wedge**, to settle whether wedges spread damage across tiers.
- More reports with full per-squad tables — each one tightens `PARAMS` and decides the tier-split
  question (report 2 strict vs report 3 mixed).
- A report with **siege** in either army, and one where the defender used a **wedge**.
- Report 2's attacker lineup (assumed Infantry Phalanx) and report 3's wall state.
- Report 1's defender composition per tier/type.
