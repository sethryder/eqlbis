# Stat weight rationale (community-tuned Aug 2026)

The `W` tables and fixed coefficients in `src/logic.ts` are calibrated from
classic-era EQ community research (P99 wiki/forums, TAKP wiki, Monkly-Business,
Safehouse, Almar's, EQProgression). EQL runs classic content (no expansions),
so we use the classic-era stance: stats are far from caps, buffs are weak, AC
softcaps are unreachable — primary stats and AC keep full marginal value, and
the WIS/INT-past-200 and AC-softcap diminishing returns are deliberately NOT
modeled.

## Hard conversion rates (the anchors)

| Fact | Rate | Source |
|---|---|---|
| Worn haste | 1% ≈ 1% auto-attack DPS (delay ÷ (1+haste), no rounding); only the highest worn item counts, never stacks with other worn haste | P99 Haste Guide, TAKP Haste Stacking |
| STR → damage | +10 STR ≈ +1% DPS below caps (2/3 Offense per point above 75) | P99 t-140321; EQEmu attack.cpp |
| Worn ATK | 1 ATK = 1.5 STR (not present on EQL items — unscored) | same |
| STA → HP | WAR ~5–6/pt, knights ~4–5, monk/rogue/bard ~3–4, priests ~3, casters ~2.4 (level-scaled) | P99 Game Mechanics |
| WIS/INT → mana | ~10–11 mana/pt at 50–60; halves past 200 (unreachable in classic gear) | P99 Game Mechanics |
| AGI | ~0.25 effective AC/pt above 75; huge cliff below 75 (66→75 ≈ 45 AC) | TAKP mitigation formula; P99 Statistics |
| DEX | procs: PPM = DEX/170 + 0.5 (offhand half); ~0.2–0.5% DPS per 10 DEX with proc weapons, ~0 without | P99 Weapon Procs |
| AC vs HP | 1 AC ≈ 5 HP leveling / ~3 HP raid for tanks (Raev/Danth parse consensus; dissenters say 10–12) | Sakuragi's Warrior Guide; P99 t-83382 |
| CHA | ENC charm/mez/lull only (major); BRD lull (minor, "overstated" for charm); no effect on faction; merchant cap 104 | P99 Statistics; bard threads t-189838/t-273287 |
| Resists | ~6 pts = 1% resist chance; ≈ HP in value for raid melee/tanks (rogue lists: haste > STR > resists > STA) | P99 t-97161; EQEmu |
| Worn regen | 1/tick = 10/min; community treats FT1 as 50–100+ mana of pool; Fungi (15/tick) > any AC chest for non-raid melee | P99 t-286757; Druids Grove |
| Endurance | near-worthless in era (discs timer-gated pre-OoW) | P99 t-248 |

## How the score() coefficients encode this

- **HP/mana 0.2/pt**: at equal weights 1 AC = 5 HP (tank consensus), and with
  `w.MANA = w.WIS/2`, 10 mana = 1 WIS — both conversions consistent.
- **Haste 2.5 × w.DPS per %**: sized so FBSS (21%) beats any pure stat belt for
  melee and 41% belts rank near-BiS, matching P99/TAKP lists. Below the
  parse-exact ~7× because spell haste dilutes worn haste and score also prices
  survivability. Non-stacking caveat: only the highest worn item counts
  in-game; per-slot ranking is unaffected, but summing scores across slots
  would double-count haste.
- **Regen 6 × w (= 30× pool)**: splits Alla's old 15× floor and the raid-flow
  50–100× estimate.
- **Endurance 0.05 × w.DPS**: token; bump if EQL adds endurance-cost discs.
- **Resists 0.3 × w.SV** with per-class SV weights ~1 for melee/tanks (raid
  fear/AE checks), 0.5 casters.

## Per-class notes

- **WAR**: AC = HP top priority (healer type is the community tiebreak), STA
  next (only stat worth gearing on tanks), DEX for procs/aggro, STR moderate
  (classic-only — raid-era "STR is wasted" assumes Velious buff-capping), MR
  matters (fear fights).
- **PAL/SHD**: as WAR minus a step; small WIS/INT+mana (PAL raid backstop
  healer > SHD snap-aggro insurance).
- **MNK**: AC/HP first among stats (best leather-class AC returns; P99: "AC >
  HP > STR/STA"), DPS weight 3 (weapons/haste dominate), MR for pullers.
- **ROG**: canonical "41% haste > STR > resists > HP > STA"; DEX procs-only;
  AGI nothing.
- **BER**: STR/DEX/ATK-focused (official class guide), DPS 3.
- **RNG**: STR 2 (melee + P99 archery uses STR), balanced HP/AC (eats hits at
  #2 aggro), small WIS.
- **BRD**: MR is the raid currency (SV 1.2), DEX (procs + fewer missed notes),
  CHA real but cheap-to-cap (0.8), STR ~weight only.
- **BST**: melee-first ("90% of damage is melee"), WIS deliberate third.
- **CLR/DRU**: WIS 3 > mana > HP; CLR keeps a little AC (4/3 priest AC mult,
  gets beat on), DRU less.
- **SHM**: HP 1.8 — Canni makes HP effectively mana at ~1.6:1.
- **NEC**: HP 1.8 — Lich; "your HP is your mana".
- **WIZ/MAG**: INT > mana > HP (MAG slightly HP-favored per Kurrat's guide);
  AC near-zero for int casters.
- **ENC**: CHA 2 (charm/mez — P99 weights it heavily, TAKP much less; middle
  ground), INT 2.5, HP 1.5 ("most gear-dependent int caster, gets beat on").

## Weapon scoring

Real main-hand DPS is `(2×dmg + damage bonus) / delay` (delay in tenths), not
plain ratio — a flat level-based bonus lands on every main-hand swing (starts
L28; off-hand never gets it), which favors fast weapons and delay-bracketed 2H:

- 1H bonus at 50: `floor((50-25)/3)` = **8**; 2H = 9 under 28 delay, **14** at
  28+. At 60: 1H 11; 2H 12 / ~30 / ~38 / 49 by delay bracket (Lucy table via
  EQEmu). `dmgBonus()` is calibrated at the level-50 cap — retune if it rises.
- **Rogue backstab** hits for ~25× piercer damage (max, at 50, ~37× at 60)
  every ~10s ≈ 1.25 DPS per damage point — rogue-trio Primary ranking counts
  piercer damage a second time. The custom "Backstab DMG" item stat *replaces*
  weapon damage in that calc (catalog: Rib-bone Stiletto 4dmg/7bs). Community
  check: Vyemm's Fang (13/17) main-hand beats Ragebringer (15/25) on white
  damage despite RB's bigger backstab — ratio-first holds, and it does here.
- **Procs**: PPM = DEX/170 + 0.5 (delay-independent), so a typical 50–100dd
  proc ≈ 2 DPS — scored as a flat `2 × w.DPS` tiebreaker for items with a
  `(Combat…)` effect. Proc text is prose, so per-proc damage isn't parsed.
- **Ranged half-credit**: bow/thrown damage is halved in-game (full only for
  rangers vs stationary targets) and pre-AA archery is utility-grade.
- **Slot gating**: weapon damage and procs only score where the weapon can
  swing (Primary/Secondary; Range/Ammo for ranged) — a piercer viewed in the
  Range slot is a stat stick.
- **Not modeled** (build choices, like shield-vs-dual-wield): the offhand
  forfeited by choosing a 2H, dual-wield/double-attack rates, monk bare-fist
  baseline (14/26 at 60 — some mid H2H weapons are worse than empty hands).

## Other scored effects and adjustments

- **Worn regen in effect strings**: Fungal Regrowth = 15 HP/tick, worn
  Regeneration = 9, Flowing Thought I = 1 mana/tick — mapped via `WORN_REGEN`
  since the catalog's regen fields are populated on only 4 items.
- **Focus effects**: flat `10 × w.MANA` credit (w.MANA proxies how much a
  build casts); focus strings aren't graded into tiers.
- **Best Owned haste dedup**: worn haste never stacks, so any owned item with
  less haste than the best owned haste piece has its haste credit stripped
  during the Best Owned assignment (per-slot browsing still shows full value).
- **Still unscored by choice**: clicky effects (594 items — player-preference
  utility, surfaced by the Effects tab), bard instrument modifiers (mod values
  not in the scrape), worn damage shields (Aura of Battle, 7 items), monk
  weight caps (a per-item `wt` penalty was tried and reverted — it made a
  stats-less candle "Best Owned" over a real bow; the in-game cap is on total
  kit weight, which per-slot ranking can't see, and it's unconfirmed EQL even
  applies monk weight caps to trios).

Weapon sources: P99 Game Mechanics (damage bonus, DW/DA), Lucy dmgbonus table
via eqemulator.org t=26293, P99 Skill_Backstab + t-60673 (Ragebringer 553 max
BS check), P99 Weapon_Procs, P99 t=357949 / narkive "DPS Formula" (the
community calculator this mirrors), P99 Skill_Archery + t-201521.

## Key sources

- P99 Haste Guide: https://wiki.project1999.com/Haste_Guide
- P99 Game Mechanics / Statistics: https://wiki.project1999.com/Game_Mechanics
- TAKP AC softcaps: https://wiki.takp.info/index.php/AC_Softcaps_by_Class
- TAKP haste stacking: https://wiki.takp.info/wiki/Haste_Stacking
- Sakuragi's Warrior Guide (AC:HP parses): https://wiki.project1999.com/Sakuragi's_Warrior_Guide
- Rogue priorities: https://www.project1999.com/forums/archive/index.php/t-97161.html
- STR/ATK math: https://www.project1999.com/forums/archive/index.php/t-140321.html
- Shaman STA vs WIS: https://wiki.project1999.com/Shaman:_Stamina_vs._Wisdom
- Loraen's Enchanter Guide: https://wiki.project1999.com/Loraen%27s_Enchanter_Guide
- Kurrat's Magician Guide: https://wiki.project1999.com/Kurrat%27s_all_in_one_Magician_Guide
- Undercon's SK/Paladin guides, Thrasos' Bard Guide, Monkly-Business
  Progression Gear List, Almar's Classic-PoR class guides, EQProgression
  class 101s/BiS lists.
