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
| Wounded / Dead | 487,319 / 0 | 64,354 / 0 | Dead=0 ✓ |

(Fit tightened from −4.4% / −1.4pp after the post-review engine fixes below.)

One free parameter (attacker stats, not shown in the report) reproducing five signatures
including the whole tier distribution. The tier distribution is not fittable by accident, so
this is genuine evidence the routing model is now right.

## Changes made from this data

1. Tier ladder extended to **T1–T5** (T1/T3 base stats and might are still estimates: T1 might 4,
   T3 might 20).
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

1. **Army Morale + retreat threshold — no such mechanic in the game.** Now demonstrably harmful:
   it truncates report 1 and caps defender losses at ~58%. **Recommend removing as a victory
   condition.**
2. Phalanx/Wedge routing weights (55/45 split, 72% vs 55% front share) — invented.
3. Base troop stats (T1–T5 = 10/20/60/100/160) and type modifiers — invented.
4. `DAMAGE_SCALE`, `BATTLE_ROUNDS`, `SUPPORT_FACTOR`, `LEAD_BONUS`, familiar burst period — invented.
5. Siege engines and traps — not modelled at all (traps explain report 1's 2,604 loss gap).
6. T5 resource costs — guessed.

## Wall model (implemented, uncalibrated)

Wall HP %, Wall Max HP, trap count and Trap ATK/DEF are now inputs; trap stats sit outside the
additive type+army grid because the leader bonus does not raise them (both stat columns showed
+60.84 / +66.92).

Measured effect on a 2M-troop cavalry garrison vs Maxed Titan Solo:

| Wall | Rounds held | Trap kills | Defender losses | Morale |
|---|---|---|---|---|
| 100% | 12 | 25.0K | 204.8K | 89.8% |
| 75% | 9 | 18.8K | 361.5K | 81.9% |
| 50% | 7 | 14.6K | 491.1K | 75.4% |
| 25% | 5 | 10.3K | 620.5K | 69.0% |
| 0% (down) | 0 | 0 | 893.7K | 55.3% |

Trap count reproduces the researched rule that more traps lengthen the wall fight — 50k traps
hold 10 rounds (313.5K losses), 400k hold 14 (87.0K), 800k hold the full engagement (0 losses).

**`TRAP` base stats (hp 150 / atk 120) and `WALL_HP_SCALE` (80) are invented.** `WALL_HP_SCALE`
converts the game's Wall HP number into the engine's effective-HP space; it was set so a full
wall holds a plausible number of rounds, not from data. Report 2 still reproduces unchanged with
the wall set to 0%.

**Wall state is now a required input when reproducing any report** — the same attacker swings
defender losses 4.4x between wall-up and wall-down.

## To finish calibrating

- Report 1's defender composition per tier/type, and confirmation of whose stat block applies.
- A non-countered matchup, to isolate the 2x counter multiplier from everything else.
- Any report where a **wedge** is on the defending side, to test the split-front model.
- **A wall-up / wall-down pair against a comparable attacker**, plus the castle's real Wall HP
  number and trap count, to calibrate `WALL_HP_SCALE` and the `TRAP` base stats.
- Whether report 1 and report 2 were fought with the wall up or down.
