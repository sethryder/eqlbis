// Self-check for the parse + scoring core. Run: npm test (node 22.18+ strips types natively).
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { blendWeights, dmgBonus, hasMeleeTrio, parseInv, parts, r2, rankScore, score, sellables, tierDmg, tierStat, whyDiff } from './logic.ts'
import type { InvEntry, Item, Weights } from './logic.ts'

const inv = parseInv(readFileSync(new URL('../public/Washclof_oggok-Inventory.txt', import.meta.url), 'utf8'))
const by = (s: string) => inv.filter(e => e.source === s).length
assert.equal(by('equipped'), 21)
assert.equal(by('bags'), 17) // includes bag contents (General N-SlotN), excludes Empty + (Exaltation)
assert.equal(by('bank'), 7)
assert.equal(by('stash'), 46)
assert.equal(by('hoard'), 21) // Dragon's Hoard items; -SlotN augment sub-rows skipped
assert.equal(by('depot'), 1)  // Personal-DepotN tradeskill depot

// Alias map: the game's "Deterioriated ..." typo maps to the wiki's spelling
assert.equal(inv.filter(e => e.base === 'Deteriorated Ancient Faydark Longbow').length, 2) // equipped +4, hoard +2
assert.ok(!inv.some(e => e.base.includes('Deterioriated')))

const hoarded = inv.find(e => e.base === 'Slave Trammels')!
assert.deepEqual({ tier: hoarded.tier, source: hoarded.source }, { tier: 2, source: 'hoard' })
assert.equal(inv.find(e => e.source === 'depot')!.base, 'Bone Chips')

const belt = inv.find(e => e.base === 'Crushbone Belt')!
assert.deepEqual({ base: belt.base, tier: belt.tier, loc: belt.loc, source: belt.source }, { base: 'Crushbone Belt', tier: 6, loc: 'Waist', source: 'equipped' })
assert.ok(!inv.some(e => /\(Exaltation\)|^Empty$/.test(e.base)))
assert.ok(!inv.some(e => e.base.endsWith('*')))

// Tier math: +10%/tier floored, min +1/tier; dmg +10%/tier floored, no min
assert.equal(tierStat(3, 6), 9)   // floor(1.8)=1 < 6 -> min kicks in
assert.equal(tierStat(10, 6), 16) // floor(6)=6
assert.equal(tierStat(-2, 6), -2) // negatives un-tiered
// Weapon dmg +10%/tier floored, no minimum — verified in-game (Sword of the
// Lost 15dmg +4 -> 21; Dragoon Dirk 6dmg +2 -> 7; Flaming Fist 6dmg +4 -> 8)
assert.equal(tierDmg(15, 4), 21)
assert.equal(tierDmg(6, 2), 7)
assert.equal(tierDmg(6, 4), 8)
assert.equal(tierDmg(10, 4), 14)

// Trio blend: WAR/CLR/WIZ average, 2dp
const w = blendWeights(['WAR', 'CLR', 'WIZ'], 'balanced', {})
assert.equal(w.AC, 1.57) // (3+1.2+0.5)/3
assert.equal(w.WIS, 1)   // (0+3+0)/3
// Overrides win; presets multiply
assert.equal(blendWeights(['WAR', 'CLR', 'WIZ'], 'balanced', { AC: 9 }).AC, 9)
assert.equal(blendWeights(['WAR'], 'tank', {}).AC, 5.4) // 3 × 1.8
// At the mitigation softcap the trio-blended post-cap return rides along as
// ACRET (EQEmu GetSoftcapReturns; EQL's client cap matches the live table).
// A manual AC override wins outright — no ACRET stacks on top of it.
assert.equal(blendWeights(['MNK', 'SHD', 'SHM'], 'balanced', {}, true).ACRET, 0.3) // (0.3+0.33+0.28)/3
assert.equal(blendWeights(['WIZ'], 'balanced', {}, true).ACRET, 0.25)
assert.equal(blendWeights(['WAR'], 'balanced', {}, true).AC, 3) // AC weight itself untouched
assert.equal(blendWeights(['WAR'], 'balanced', {}).ACRET, undefined)
assert.equal(blendWeights(['WAR'], 'balanced', { AC: 9 }, true).ACRET, undefined)

// Score: Crushbone Belt at flat weights = AC 3 + STR 2 + SV 5×0.3 = 6.5
const flat = blendWeights([], 'balanced', {})
const item: Item = { name: 'Crushbone Belt', type: 'Armor', slots: ['Waist'], classes: [], level: 0, ac: 3, hp: 0, mana: 0, dmg: 0, dly: 0, stats: { STR: 2, SV: 5 }, skill: '', icon: 971, zones: ['Crushbone'], flags: ['MAGIC'] }
assert.equal(score(item, 0, flat), 6.5)
// Softcapped AC: non-shield AC scales by ACRET; shield AC bypasses the cap
// (EQEmu ACSum grows the softcap by shield AC 1:1)
const capped = { ...flat, ACRET: 0.25 }
assert.equal(score(item, 0, capped), 4.25) // AC 3×0.25 + STR 2 + SV 1.5
const buckler: Item = { ...item, name: 'Test Buckler', slots: ['Secondary'], stats: {}, skill: 'Shield' }
assert.equal(score(buckler, 0, capped), 3) // full AC despite the cap
for (const ci of [item, buckler]) {
  const sum = parts(ci, 0, capped).reduce((s, p) => s + p.val, 0)
  assert.ok(Math.abs(sum - score(ci, 0, capped)) < 1e-9, 'capped parts drift on ' + ci.name)
}
// Tiered scores gain +1 SV Void/tier: tier × 0.3 × w.SV(1) on top of stats.
// Weapon DPS term: (2×5dmg + 8 bonus)/25dly × 10 × w.DPS(1) = 7.2; tier 6
// dmg 5+floor(3)=8 -> (16+8)/25 × 10 = 9.6, +1.8 void
const wpn: Item = { ...item, name: 'Test Blade', slots: ['Primary'], ac: 0, stats: {}, dmg: 5, dly: 25, skill: '1H Slashing' }
assert.equal(r2(score(wpn, 0, flat)), 7.2)
assert.equal(r2(score(wpn, 6, flat)), 11.4)
// Damage bonus: mainhand melee only. Ranged attacks get none in this era;
// slow 2H gains the 40+/45+ delay brackets (EQEmu GetWeaponDamageBonus at 50).
assert.equal(dmgBonus('1H Slashing', 20), 8)
assert.equal(dmgBonus('Archery', 40), 0)
assert.equal(dmgBonus('Throwing', 25), 0)
assert.equal(dmgBonus('2H Slashing', 27), 9)
assert.equal(dmgBonus('2H Slashing', 30), 14)
assert.equal(dmgBonus('2H Blunt', 40), 15)
assert.equal(dmgBonus('2H Blunt', 44), 16)
assert.equal(dmgBonus('2H Blunt', 45), 18)
assert.equal(r2(score({ ...wpn, skill: '2H Slashing', dmg: 20, dly: 40 }, 0, flat)), 13.75) // (40+15)/40×10
assert.equal(r2(score({ ...wpn, skill: 'Archery', dmg: 20, dly: 40 }, 0, flat)), 5) // 40/40×10×0.5, no bonus
// Combat procs are a flat 2 × w.DPS credit; clickies get nothing
assert.equal(r2(score({ ...wpn, effect: 'Ykesha (Combat, Casting Time: Instant) at Level 37' }, 0, flat)), 9.2)
assert.equal(r2(score({ ...wpn, effect: 'Gate (Any Slot/Can Equip, Casting Time: 3.0)' }, 0, flat)), 7.2)
// Weapon dmg/proc only count where the weapon can swing: a melee piercer
// scored for the Range slot is a stat stick; a bow in Range keeps its credit
assert.equal(score({ ...wpn, skill: 'Piercing' }, 0, flat, 'Range'), 0)
assert.equal(score({ ...wpn, skill: 'Archery' }, 0, flat, 'Range'), 2) // 10/25×10×0.5
// Never-shoot builds (w.RANGED = 0): bows/throwing lose DPS credit but keep
// stats; melee weapon credit is untouched
const noRng = { ...flat, RANGED: 0 }
assert.equal(score({ ...wpn, skill: 'Archery' }, 0, noRng, 'Range'), 0)
assert.equal(score({ ...wpn, skill: 'Archery', stats: { STA: 4 } }, 0, noRng, 'Range'), 4)
assert.equal(r2(score(wpn, 0, noRng)), 7.2)
assert.equal(blendWeights(['MNK'], 'balanced', {}, false, true).RANGED, 0)
assert.equal(blendWeights(['MNK'], 'balanced', {}, false, false).RANGED, undefined)
// ...and combat procs on ranged weapons are muted too (they only fire when
// shot); melee weapon and worn armor procs keep their credit
assert.equal(score({ ...wpn, skill: 'Archery', effect: 'Ykesha (Combat, Casting Time: Instant)' }, 0, noRng, 'Range'), 0)
assert.equal(r2(score({ ...wpn, effect: 'Ykesha (Combat, Casting Time: Instant)' }, 0, noRng)), 9.2)
assert.equal(score({ ...item, ac: 0, stats: {}, effect: 'Anarchy (Combat)' }, 0, noRng, 'Chest'), 2)
{
  const bow = { ...wpn, skill: 'Archery', stats: { STA: 4 }, effect: 'Ykesha (Combat, Casting Time: Instant)' }
  for (const wx of [noRng, { ...flat, RANGED: 0.5 }]) {
    const sum = parts(bow, 0, wx, 'Range').reduce((s, p) => s + p.val, 0)
    assert.ok(Math.abs(sum - score(bow, 0, wx, 'Range')) < 1e-9, 'noRanged parts drift')
  }
}
// Offhand credit is gated on someone actually dual wielding: blendWeights
// zeroes OFFHAND for no-DW trios and for the shield-tank toggle, muting
// Secondary weapon dmg + proc credit (stats survive); Primary is untouched.
assert.equal(blendWeights(['SHD', 'CLR', 'ENC'], 'balanced', {}).OFFHAND, 0)
assert.equal(blendWeights(['ROG', 'SHM', 'ENC'], 'balanced', {}).OFFHAND, undefined)
assert.equal(blendWeights(['ROG', 'SHM', 'ENC'], 'balanced', {}, false, false, true).OFFHAND, 0)
assert.equal(blendWeights([], 'balanced', {}).OFFHAND, undefined)
const noOff = { ...flat, OFFHAND: 0 }
assert.equal(score(wpn, 0, noOff, 'Secondary'), 0)
assert.equal(score({ ...wpn, effect: 'Ykesha (Combat, Casting Time: Instant)' }, 0, noOff, 'Secondary'), 0)
assert.equal(score({ ...wpn, stats: { STA: 4 } }, 0, noOff, 'Secondary'), 4)
assert.equal(r2(score(wpn, 0, noOff, 'Primary')), 7.2)

// Tiers apply per resist (min +1/tier each), not once to the summed SV
// bucket: +2 to all five resists at tier 5 = 5 × tierStat(2,5)=7 → 35,
// not tierStat(10,5)=15. Untiered items keep the bucket as-is.
const veil: Item = { ...item, name: 'Test Veil', ac: 0, stats: { SV: 10 }, resists: { FIRE: 2, COLD: 2, MAGIC: 2, DISEASE: 2, POISON: 2 } }
assert.equal(r2(score(veil, 5, flat)), 12) // 35×0.3 + 5 SV Void×0.3
assert.equal(score(veil, 0, flat), 3)

// Worn haste: 21% × 2.5 × w.DPS(1) = 52.5; flat +1%/tier -> 27 × 2.5 = 67.5
const sash: Item = { ...item, name: 'Test Sash', ac: 0, stats: {}, haste: 21 }
assert.equal(score(sash, 0, flat), 52.5)
assert.equal(score(sash, 6, flat), 69.3) // 67.5 + 1.8 void
// Endurance: token era weight — 10 × 0.05 × w.DPS(1) = 0.5; tiers as a stat
const crown: Item = { ...item, name: 'Test Crown', ac: 0, stats: {}, end: 10 }
assert.equal(score(crown, 0, flat), 0.5)
assert.equal(r2(score(crown, 6, flat)), 2.6) // tierStat(10,6)=16 -> 0.8, + 1.8 void
// Worn regen: 6 HP regen × 6 × w.HP(1) = 36; regen <10 so tiers add +1/tier
const tunic: Item = { ...item, name: 'Test Tunic', ac: 0, stats: {}, hpRegen: 6 }
assert.equal(score(tunic, 0, flat), 36)
assert.equal(score(tunic, 3, flat), 54.9) // tierStat(6,3)=9 × 6 + 0.9 void
// Classic regen lives in effect strings (Fungi = 15 HP/tick, FT N = N mana/tick)
assert.equal(score({ ...tunic, hpRegen: 0, effect: 'Fungal Regrowth (Worn)' }, 0, flat), 90)
assert.equal(score({ ...tunic, hpRegen: 0, effect: 'Flowing Thought I (Worn)' }, 0, flat), 6)
assert.equal(score({ ...tunic, hpRegen: 0, effect: 'Flowing Thought III (Worn)' }, 0, flat), 18)
assert.equal(score({ ...tunic, hpRegen: 0, effect: 'Ultravision (Worn)' }, 0, flat), 0)
// Worn combat procs on armor (no dmg/dly) count in any slot; weapon procs
// only where the weapon swings
assert.equal(score({ ...tunic, hpRegen: 0, effect: 'Anarchy (Combat)' }, 0, flat, 'Chest'), 2)
assert.equal(score({ ...wpn, effect: 'Ykesha (Combat, Casting Time: Instant)' }, 0, flat, 'Range'), 0)
// Focus effects: flat 10 × w.MANA(1) credit
assert.equal(score({ ...tunic, hpRegen: 0, focus: 'Improved Healing I' }, 0, flat), 10)
// Item weight must NOT enter ranking: a per-item wt penalty (tried once for
// monk weight caps) made a stats-less 0.1wt candle "Best Owned" over a real
// bow — the in-game cap is on total kit weight, not per item.
const heavy: Item = { ...item, name: 'Test Breastplate', slots: ['Chest'], wt: 9 }
assert.equal(rankScore({ ...heavy, wt: 0 }, 0, flat, 'Chest', ['MNK']), rankScore(heavy, 0, flat, 'Chest', ['MNK']))

// Primary ranks weapons ratio-first for melee trios: the user's 14/30 stiletto
// must outrank a 10/30 stat stick despite the stick's higher raw score.
const stick: Item = { ...item, name: 'Test Stick', slots: ['Primary'], ac: 0, dmg: 10, dly: 30, stats: { WIS: 15 }, skill: '1H Blunt' }
const blade: Item = { ...item, name: 'Test Fast Blade', slots: ['Primary'], ac: 0, dmg: 14, dly: 30, stats: {}, skill: 'Piercing' }
assert.ok(score(stick, 0, flat) > score(blade, 0, flat))
assert.ok(rankScore(blade, 0, flat, 'Primary', ['ROG', 'SHM', 'ENC']) > rankScore(stick, 0, flat, 'Primary', ['ROG', 'SHM', 'ENC']))
// ...but a pure caster/priest trio keeps score order, and other slots always do
assert.ok(rankScore(stick, 0, flat, 'Primary', ['CLR', 'WIZ', 'ENC']) > rankScore(blade, 0, flat, 'Primary', ['CLR', 'WIZ', 'ENC']))
// Secondary is ratio-first too when the trio can dual wield (the offhand swings);
// a trio with no dual-wielder keeps score order — its offhand weapon never swings.
assert.ok(rankScore(blade, 0, flat, 'Secondary', ['ROG', 'SHM', 'ENC']) > rankScore(stick, 0, flat, 'Secondary', ['ROG', 'SHM', 'ENC']))
assert.ok(rankScore(stick, 0, flat, 'Secondary', ['SHD', 'SHM', 'ENC']) > rankScore(blade, 0, flat, 'Secondary', ['SHD', 'SHM', 'ENC']))
// ...and the shield-tank toggle (OFFHAND 0) drops the boost even for dual-
// wield trios, so shields/stat items aren't buried under every weapon.
assert.ok(rankScore(stick, 0, noOff, 'Secondary', ['ROG', 'SHM', 'ENC']) > rankScore(blade, 0, noOff, 'Secondary', ['ROG', 'SHM', 'ENC']))
assert.ok(hasMeleeTrio(['BRD']) && !hasMeleeTrio(['CLR', 'WIZ']))
// The boost needs a melee/hybrid member who can actually HOLD the item: a
// CLR-only blade in a WAR/CLR/WIZ trio ranks stat-first (the cleric ranks
// stat sticks, the warrior can't equip it), in Primary and Secondary both.
const clrBlade: Item = { ...blade, name: 'Test Cleric Mace', classes: ['CLR'] }
assert.ok(rankScore(clrBlade, 0, flat, 'Primary', ['WAR', 'CLR', 'WIZ']) < rankScore(blade, 0, flat, 'Primary', ['WAR', 'CLR', 'WIZ']))
assert.ok(rankScore(stick, 0, flat, 'Primary', ['WAR', 'CLR', 'WIZ']) > rankScore(clrBlade, 0, flat, 'Primary', ['WAR', 'CLR', 'WIZ']))
assert.ok(rankScore(clrBlade, 0, flat, 'Secondary', ['ROG', 'CLR', 'WIZ']) < rankScore(blade, 0, flat, 'Secondary', ['ROG', 'CLR', 'WIZ']))
// Rogue trios rank Primary piercers with a backstab term (+125/dmg): a 12/26
// piercer must outrank a 14/28 slasher (which wins on white damage alone) for
// rogues, while a rogue-less melee trio keeps them in white-damage order.
const pierce: Item = { ...item, name: 'Test Dirk', slots: ['Primary'], ac: 0, stats: {}, dmg: 12, dly: 26, skill: 'Piercing' }
const slash: Item = { ...item, name: 'Test Saber', slots: ['Primary'], ac: 0, stats: {}, dmg: 14, dly: 28, skill: '1H Slashing' }
assert.ok(rankScore(pierce, 0, flat, 'Primary', ['ROG']) > rankScore(slash, 0, flat, 'Primary', ['ROG']))
assert.ok(rankScore(slash, 0, flat, 'Primary', ['WAR']) > rankScore(pierce, 0, flat, 'Primary', ['WAR']))
// ...and only for piercers the rogue can equip: a WAR-only lance gets no boost
assert.ok(rankScore({ ...pierce, classes: ['WAR'] }, 0, flat, 'Primary', ['ROG', 'WAR']) < rankScore(pierce, 0, flat, 'Primary', ['ROG', 'WAR']))

// parts() must never drift from score(): sum of contributions == score, across
// every term branch (weapon+tier, haste, end, regen, worn effects, proc, focus).
for (const [ci, t, sl] of [
  [item, 0], [item, 6], [wpn, 0], [wpn, 6], [sash, 6], [crown, 6], [tunic, 3],
  [{ ...tunic, hpRegen: 0, effect: 'Fungal Regrowth (Worn)' }, 0],
  [{ ...tunic, hpRegen: 0, effect: 'Flowing Thought III (Worn)' }, 2],
  [{ ...wpn, effect: 'Ykesha (Combat, Casting Time: Instant)' }, 0, 'Primary'],
  [{ ...wpn, skill: 'Archery' }, 0, 'Range'],
  [{ ...tunic, hpRegen: 0, focus: 'Improved Healing I', manaRegen: 2 }, 1],
] as [Item, number, string?][]) {
  const sum = parts(ci, t, flat, sl).reduce((s, p) => s + p.val, 0)
  assert.ok(Math.abs(sum - score(ci, t, flat, sl)) < 1e-9, 'parts drift on ' + ci.name)
}
// ...including the offhand-muted, per-resist-tier, and slow-2H branches
for (const [ci, t, sl, wx] of [
  [wpn, 0, 'Secondary', noOff],
  [{ ...wpn, effect: 'Ykesha (Combat, Casting Time: Instant)' }, 0, 'Secondary', noOff],
  [veil, 5, undefined, flat],
  [{ ...wpn, skill: '2H Blunt', dmg: 20, dly: 45 }, 0, undefined, flat],
] as [Item, number, string | undefined, Weights][]) {
  const sum = parts(ci, t, wx, sl).reduce((s, p) => s + p.val, 0)
  assert.ok(Math.abs(sum - score(ci, t, wx, sl)) < 1e-9, 'parts drift on ' + ci.name)
}
// whyDiff: biggest contribution delta first, signed toward the first item
const why = whyDiff(stick, 0, blade, 0, flat)
assert.equal(why[0][0], 'WIS')  // stick's WIS 15 is the biggest mover
assert.equal(r2(why[0][1]), 15)
assert.ok(why.some(([k, v]) => k === 'DPS' && v < 0)) // blade wins on DPS

// sellables: an item is safe only when NO class's best owned loadout uses it.
// CLR belts fill Waist(1) + Any Slot(2), so the 4th-best is safe; the WAR-only
// belt is WAR's sole option (kept); the clicky is outclassed but never safe.
{
  const mkBelt = (name: string, ac: number, classes: string[] = ['CLR'], extra: Partial<Item> = {}): Item =>
    ({ name, type: 'Armor', slots: ['Waist'], classes, level: 0, ac, hp: 0, mana: 0, dmg: 0, dly: 0, stats: {}, skill: '', icon: 0, zones: [], flags: [], ...extra })
  const belts = [
    mkBelt('Belt A', 20), mkBelt('Belt B', 15), mkBelt('Belt C', 10), mkBelt('Belt D', 1),
    mkBelt('War Girdle', 1, ['WAR']),
    mkBelt('Click Belt', 1, ['CLR'], { effect: 'Minor Healing (Must Equip, Casting Time: Instant)' }),
  ]
  const byName = new Map(belts.map(ci => [ci.name.toLowerCase(), ci]))
  const pool: InvEntry[] = belts.map(ci => ({ base: ci.name, tier: 0, loc: 'Bank 1', source: 'bank', count: 1 }))
  assert.deepEqual([...sellables(pool, e => byName.get(e.base.toLowerCase()))].sort(), ['belt d'])
}

console.log('logic self-check OK —', inv.length, 'entries parsed')
