# Public Site & Monetization Design — LM Trap Simulator

**Date:** 2026-08-30
**Status:** Approved design, ready for implementation planning

## Goal

Publish the Lords Mobile Solo Trap & Rally Defense Simulator as a public website that earns a few
dollars a month, without putting anything behind a paywall.

Explicit target: **a few quick bucks. Not a business.** Running cost is assumed to be zero, so
every dollar is upside rather than cost recovery.

## Constraints

- **No paywall.** No feature is gated behind payment. Ruled out by the owner, and correctly — see
  audience analysis.
- **No account wall.** The simulator works with zero signup.
- **Full functionality with an ad blocker enabled**, and no nagging about it.
- Low maintenance. The upside is capped at a few dollars a month, so no design may cost
  meaningful ongoing effort.

## Audience analysis — the average Lords Mobile player

This drives every decision below.

- LM's population centres are the Philippines, Indonesia, Brazil, MENA and India. Display ad RPM
  in those markets is roughly **$0.50–2**, not the $5–15 quoted for US tech traffic.
- Typical device is a mid-range Android on mobile data. Heavy ad scripts and large JS bundles
  measurably cost users.
- The overwhelming majority spend nothing on the game itself. A paid tier would suppress adoption
  for perhaps $10/month — a bad trade.
- They already tolerate advertising constantly, in-game and on guide channels. A single quiet
  banner is not a reputational problem; interstitials and sticky units are.
- Trap-account players specifically are a small, passionate, detail-obsessed subgroup. They share
  good tools in guild Discords, and they run ad blockers at above-average rates.

## Revenue expectation (honest)

At ~100 sessions/day × ~2 pageviews × $1.50 RPM ≈ **$9/month**.

Realistic band: **$5–20/month**, growing slowly with search traffic. Nothing in this design
reaches $100/month. Any plan that claims otherwise for this niche is wrong.

**Running cost is assumed to be zero.** Cloudflare Pages/Workers/D1 free tiers cover this volume,
and a free `*.pages.dev` subdomain avoids even the domain fee. A custom domain (~$12/year) is
optional and explicitly not required.

Consequence: there is no cost to recover, so Ko-fi is a **plain tip jar**, not a "help me pay the
server" pitch. Do not invent a cost — this audience will spot it, and the honest framing performs
better anyway.

## Chosen approach: ad-light + content flywheel

One unobtrusive ad slot, a Ko-fi link, and a small set of SEO guide pages built from the
project's calibration data.

**Rejected alternatives:**

- *Zero-ads, community-funded* (Ko-fi + a directly sold guild banner). Cleanest page, but income
  is lumpy and requires actively selling the slot. Kept as the documented fallback.
- *Gift-codes hub.* "Lords mobile gift codes" carries far more search volume than any calculator
  term and would raise the ceiling to ~$20–60/month, but it needs constant upkeep and dilutes the
  project's identity. Deferred, not discarded.

## Design

### 1. Site structure

| Path | Purpose |
|---|---|
| `/` | The simulator. The product. |
| `/guides/<slug>` | Six articles (section 4). |
| `/reports` | Aggregate community report view. Phase 3. |
| `/privacy` | Required for AdSense and for report collection. |
| `/about` | What the tool is, how it's calibrated, Ko-fi link. |

### 2. Monetization surfaces

**Ads**

- Exactly **one** responsive slot on the simulator page, positioned **below the results panel** —
  after value is delivered, never before it.
- Guide pages carry the real ad load: one in-content slot, one at the end. Guides are where
  display advertising actually earns; the tool page stays close to clean.
- **Banned:** sticky/anchor units, interstitials, auto-refreshing units, video.
- Ads **lazy-load after results render** and must never delay first paint or the simulate action.
- The simulator remains fully functional with ads blocked. No detection, no prompts.

**Ko-fi**

- Footer link, plus one non-modal line beneath the results after a completed simulation.
- Copy is a straight tip jar: "if this saved your troops." **No claimed running costs** — the site
  is free to operate, and inventing a server bill would be dishonest.
- Expected to be the "whale" channel — rare but occasionally meaningful.

**Consent and compliance**

- AdSense requires a certified CMP for EEA/UK visitors, and a privacy policy regardless.
- Default: use Google's own CMP. Alternative: serve non-personalized ads only, trading some RPM
  for much less complexity.

**Sequencing note:** AdSense rejects thin, low-traffic sites. Guides and some traffic must exist
**before** applying.

### 3. Report uploads and data flow

**Framing.** Nobody uploads data altruistically. The feature is presented as **"Import battle
report"**, which fills the simulator's inputs for the user. They use it because it saves typing
fifteen numbers; the corpus is the by-product.

**Mechanism (v1): text paste, not OCR.** A textarea plus four fields — wall up/down, defender
formation, attacker lineup, outcome. OCR is explicitly rejected for v1: client-side Tesseract is
~2MB of JS and slow on exactly the low-end devices this audience uses, and server-side OCR costs
money per image. Revisit only if upload volume justifies it.

**Stack.** Cloudflare Pages (static) + Worker + D1 for the reports table. Free at this volume and
edge-hosted, which matters given the SEA/LATAM user distribution. Text rows are tiny — 10,000
reports is a few megabytes. Screenshot storage is the only real cost driver and is deferred.

**Abuse control.** An open write endpoint will be spammed. Cloudflare Turnstile, per-IP rate
limiting, hard payload size caps, and a moderation queue — **nothing appears publicly until
approved**.

**Privacy, and an LM-specific social rule.** Reports contain player names, guild tags and
coordinates.

- Strip player names on ingest by default.
- **Never build a public "who got zeroed" feed.** It would generate real drama and turn the guild
  Discords — the best distribution channel — against the site.
- Public views stay aggregate: "traps with X stats survive Y% of Titan solos."

**Engineering value.** Each report is a regression test. Report 2 in `calibration-notes.md` caught
a modelling error that no amount of reasoning had found. A simulator scored against hundreds of
real battles is not casually cloneable, and that is what makes it canonical — which is what
produces the traffic the ads depend on.

### 4. Content plan

Six guides, all substantially drafted already in `calibration-notes.md`:

1. **How Lords Mobile combat actually works** — counter triangle, tier absorption, wall and traps.
   Anchor page.
2. **Why your wall status changes your losses 4×** — researched wall/trap rules plus measured
   figures.
3. **Why your T4 never dies: how casualties climb the tier ladder** — the T1-wiped / T2-partial /
   T4-untouched finding, evidenced by a real report. No existing source explains this.
4. **How big a trap holds a Titan solo?** — tables generated by the simulator.
5. **Infirmary, Sanctuary and Divine Providence explained.**
6. **T5 Lunar gear costs.**

Each guide ends with a link into the simulator pre-filled with that scenario.

**Discord-first detail:** proper Open Graph cards. The primary distribution channel is guild
Discord, which unfurls links; a titled card with a screenshot materially outperforms a bare URL.
Plus per-page title/meta, `sitemap.xml`, `robots.txt`.

### 5. Measurement and the kill criterion

- **Cloudflare Web Analytics** — free, cookieless, and requires no consent banner (unlike GA4).
- Track: sessions, which guides bring search traffic, simulate-button clicks, upload count,
  revenue per page.
- **Decision rule, set now:** if after three months the guides are not producing search traffic,
  ads will not clear a few dollars. Drop to the zero-ads fallback rather than degrading the page
  for nothing.

### 6. Non-functional requirements

- **Performance:** LCP under 2.5s on a mid-range Android over 3G. Replace the Tailwind Play CDN
  (which compiles CSS in-browser at runtime) with a prebuilt stylesheet. Under ~100KB JS before ad
  scripts. This is the single largest UX win for this audience and costs nothing.
- **Error handling:** the simulator must never white-screen. The run is wrapped in try/catch
  (already implemented on the button); show a readable error. A failed upload must never lose the
  user's pasted text.
- **Testing:** the report corpus is the regression suite. A script replays every stored report
  through the engine and prints error-vs-actual, run before each deploy, so future tuning cannot
  silently break an earned calibration.

## Phases

Each phase is a separate implementation plan.

- **Phase 1 — Ship the static site.** Split the single file into `/` plus guide pages, replace the
  Tailwind CDN with prebuilt CSS, add OG cards, sitemap, robots, privacy and about pages, Ko-fi
  link, analytics. No ads yet. *This is the first implementation plan.*
- **Phase 2 — Content.** Write the six guides, with pre-filled simulator links. Apply to AdSense
  once traffic exists, then add the ad slots.
- **Phase 3 — Report uploads.** Worker + D1 + Turnstile, import-to-simulator flow, moderation
  queue, aggregate `/reports` view, regression-suite script.

## Open questions

- Whether to bother with a custom domain at all, or ship on a free `*.pages.dev` subdomain.
- Whether to run Google's CMP or restrict to non-personalized ads.
- ~~Whether the existing `lmtrapsim2.html` is a dead variant that should be deleted before the
  split.~~ Resolved: verified stale and deleted (commit `d545d8c`).

## Out of scope (YAGNI)

- User accounts, saved profiles, login of any kind.
- Screenshot upload and OCR.
- A public per-player report feed.
- Gift-codes hub (deferred; revisit only if the ceiling needs raising).
- Any paid tier.
