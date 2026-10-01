# Calibration Notes

Ground truth from real battle reports. Constants in `lords-mobile-trap-simulator.html` should be
fitted to these, not to intuition. Anything not listed here as *confirmed* is still an estimate.

## Confirmed game rules

- **Counter triangle:** Infantry > Ranged > Cavalry > Infantry. (Player-confirmed 2026-08-28.)
- **Lineup naming:** a march is `<Type> <Phalanx|Wedge>`. "Ranged Wedge" means the march *is*
  ranged — lead type is not separable from composition. (Fixed in UI; spearhead now derives
  from the lineup.)
- **Casualties climb the tier ladder GLOBALLY, not per troop type.** Report 2 is decisive: every
  T4 squad (infantry, ranged AND cavalry) took 0 losses while T1 was wiped 100% and T2 bled 23%.
  The lowest surviving tier of the whole army absorbs first, regardless of type. The engine was
  rewritten to match — this was the single biggest modelling error found.
- **Stats stack additively:** effective Infantry ATK = troop-type Infantry ATK + Army ATK.
  Only the **Leader Deployed** column counts.
- **Battles are bounded** and can end with both sides holding survivors (report 1), or with one
  side wiped (report 2).
- **Defender casualties become Wounded up to infirmary capacity;** Dead = 0 when capacity covers it.
- **Attacker casualties split 60% wounded / 40% dead**, highest tiers wounded first (wiki: Infirmary).
  Report 1 matches to the troop: 24,139 / 16,093 of 40,232. Now modelled.
- **Infirmary overflow (defending):** 80% goes to the Sanctuary while it has space; Divine Providence
  revives a free 10% of the dead (wiki: Infirmary, Sanctuary). Now modelled with a Sanctuary Capacity
  input. Divine Providence's own capacity cap is not modelled.
- **Might per troop:** T1 2 · T2 8 · T3 24 · T4 36 · T5 48 (wiki: Might). Now in the app.
- **Casualty order:** "Lords Mobile will always kill the weakest troops first" — independent
  confirmation of the global tier ladder below.
- **Total Losses can exceed wounded + dead** — the gap is destroyed traps, not modelled.
- **Siege engines exist** (Destroyer T4) and are not modelled.
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

**Status: DOES NOT REPRODUCE.** With a guessed composition, defender losses plateau at 56–60%
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

**Status: REPRODUCES WELL.** Modelled 924,693 (siege omitted), attacker ATK/DEF/HP fitted at
650 / 360 / 360, `BATTLE_ROUNDS = 15`, retreat disabled, infirmary 500,000:

| Signature | Real | Sim | Error |
|---|---|---|---|
| Outcome | attacker wiped | LEADER CAPTURED, 100% killed | ✓ |
| Defender total losses | 63,327 | 64,354 | +1.7% |
| T1 lost | 100% | 100.0% | ✓ |
| T2 lost | 23.1% | 23.6% | +0.5pp |
| T4 lost | 0% | 0.0% | ✓ |
| Wounded / Dead | not recorded / 0 | 64,354 / 0 | Dead=0 ✓ |

(Fit tightened from −4.4% / −1.4pp after the post-review engine fixes below.)

*Correction:* this table used to list real Wounded as 487,319 — that is report 1's defender figure.
Report 2's total losses were only 63,327, so its wounded count was never recorded here.

*Caveat:* the 1 T1 Archer survived while T1 Cataphract was wiped. Under a strict global ladder it
should have died too — most likely rounding on a single troop, but it is a data point against
"tier is all that matters".

One free parameter (attacker stats, not shown in the report) reproducing five signatures
including the whole tier distribution. The tier distribution is not fittable by accident, so
this is genuine evidence the routing model is now right.

## Changes made from this data

1. Tier ladder extended to **T1–T5** (T1/T3 base stats are still estimates; might is now the
   game's T1 2 / T3 24).
2. **Global tier-ladder casualty routing** replacing per-type routing.
3. Defender stats rebuilt as the game's 12-field grid (3 types × ATK/DEF/HP + Army row),
   stacking additively; DEF now multiplies survivability instead of being a token factor.
4. Attacker spearhead derived from lineup instead of a separate control.
5. Solo march floor lowered 200,000 → 10,000 (report 2's march was 100,000).
6. Added 8-5-7 lineup (40/25/35).
7. Per-round throughput caps removed (they made a 12:1 exchange impossible); engagement fixed at
   15 rounds with a new `FRONTLINE HELD` outcome.

## Post-review engine fixes (all verified)

- Infirmary/Sanctuary totals summed only T5/T4/T2, silently dropping every T1 and T3 casualty
  while still spending ward capacity on them. Now sums the full ladder.
- Attacker survivability derived DEF and HP from one "attack stats" number, squaring a single
  input. The march now has its own **ATK / DEF / Max HP**, verified independent and monotonic
  (DEF 400→1600 cuts attacker deaths 196.9K→65.3K; HP 450→1400 cuts them 196.9K→81.5K).
- Attacker casualties ignored the tier ladder. The march now climbs it too — a 60/40 T5/T4 march
  loses all T4 before a single T5 falls.
- Picking a formation type with zero troops forced morale to 0 on round 1 and lost instantly
  regardless of army size. Morale now follows the squads actually holding the line.
- Attacker tier mixes extended to the full T1–T5 ladder (was T4/T5 only).

## Still wrong / still invented

1. **Army Morale + retreat threshold.** *Correction:* morale IS a real mechanic — NamuWiki: both
   armies have morale, and an army retreats when it hits 0%. What is invented here is the shape:
   only the defender has morale, while the attacker retreats on a "% of march killed" threshold.
   The game has both sides on morale. The current drain model still truncates report 1 and caps
   defender losses at ~58%, so its *form* is wrong even though the mechanic exists.
2. Phalanx/Wedge routing weights (55/45 split, 72% vs 55% front share) — invented.
3. Base troop stats (T1–T5 = 10/20/60/100/160) and type modifiers — invented.
4. `DAMAGE_SCALE`, `BATTLE_ROUNDS`, `SUPPORT_FACTOR`, `LEAD_BONUS`, familiar burst period — invented.
5. Siege engines — not modelled. Siege engines **counter every trap type** (wiki: Trap), so an
   attacker bringing siege is the biggest missing piece for a trap simulator.
6. Trap types — traps are modelled as one typeless unit, but the game has tiers and types:
   Spikes counter cavalry, towers counter ranged, Rolling Logs counter infantry.
7. T5 resource costs — guessed. Confirmed only that T5 = T4 + 1 Luminous Gear (1:1), so a rebuilt
   T5 also consumes a T4, which the rebuild bill ignores.
8. Tier strength ratios — a 2018 guide gives base 1 T4 = 1.5 T3 = 2.25 T2 = 4.5 T1. The engine's
   tier HP makes T4 worth 1.67 T3 / 5 T2 / 10 T1, i.e. T1/T2 about twice as fragile as the game.
9. Attacker spearhead is derived from the majority troop type. Guides say the chosen formation
   decides the vanguard, which suggests it is set independently in the game. Unconfirmed.

## Wall model (implemented, uncalibrated)

Wall HP %, Wall Max HP, trap count and Trap ATK/DEF are inputs; trap stats sit outside the
additive type+army grid because the leader bonus does not raise them (both stat columns showed
+60.84 / +66.92).

**Fixed after code review:** an extra erosion multiplier slowed damaged walls on top of the
HP-proportional wall/trap split, which already produces that effect (counted twice); Trap DEF was
applied both to trap HP and as damage mitigation (counted twice); "Trap Kills" included every kill
the garrison made while the wall stood; wall % was relative to starting HP, not max HP.

Measured effect, app defaults (6M mixed garrison, 200k traps, 2M Wall Max HP) vs the Maxed Titan
Solo preset:

| Wall | Rounds held | Trap kills | All kills while wall stood | Defender losses | Morale |
|---|---|---|---|---|---|
| 100% | 9 | 0.8K | 49.1K | 357.5K | 88.3% |
| 75% | 7 | 0.7K | 37.9K | 451.3K | 85.2% |
| 50% | 5 | 0.6K | 26.7K | 545.3K | 82.1% |
| 25% | 3 | 0.4K | 16.6K | 639.6K | 79.1% |
| 0% (down) | 0 | 0 | 0 | 805.7K | 73.6% |

Trap count still lengthens the wall fight: 50k traps hold 8 rounds (411.0K losses), 200k hold 9
(357.5K), 400k hold 10 (286.1K), 800k hold 13 (143.1K).

**Two red flags:**
- Traps do ~2% of the kills; the garrison does the rest. For trap accounts that is very unlikely
  to match the game — `TRAP` base stats (hp 150 / atk 120) are invented.
- The wiki lists a level 25 Castle Wall at **12,500 max Wall HP and 125,000 trap capacity**. The
  app default (2,000,000) and `WALL_HP_SCALE` (80) were tuned around a number that may not be the
  in-game one. Check the real wall screen before tuning.

Report 2 still reproduces unchanged with the wall at 0%.

**Wall state is a required input when reproducing any report** — the same attacker swings
defender losses 2.3x between wall-up and wall-down.

## To finish calibrating

- Report 1's defender composition per tier/type, and confirmation of whose stat block applies.
- A non-countered matchup, to isolate the 2x counter multiplier from everything else.
- Any report where a **wedge** is on the defending side, to test the split-front model.
- **A wall-up / wall-down pair against a comparable attacker**, plus the castle's real Wall HP
  number and trap count, to calibrate `WALL_HP_SCALE` and the `TRAP` base stats.
- Whether report 1 and report 2 were fought with the wall up or down.
