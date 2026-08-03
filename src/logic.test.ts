// Self-check for the parse + scoring core. Run: npm test (node 22.18+ strips types natively).
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { blendWeights, hasMeleeTrio, parseInv, rankScore, score, tierDmg, tierStat } from './logic.ts'
import type { Item } from './logic.ts'

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

// Tier math: +10%/tier floored, min +1/tier; dmg +5%/tier
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
assert.equal(w.AC, 1.77) // (3+1.5+0.8)/3
assert.equal(w.WIS, 1)   // (0+3+0)/3
// Overrides win; presets multiply
assert.equal(blendWeights(['WAR', 'CLR', 'WIZ'], 'balanced', { AC: 9 }).AC, 9)
assert.equal(blendWeights(['WAR'], 'tank', {}).AC, 5.4) // 3 × 1.8

// Score: Crushbone Belt at flat weights = AC 3 + STR 2 + SV 5×0.3 = 6.5
const flat = blendWeights([], 'balanced', {})
const item: Item = { name: 'Crushbone Belt', type: 'Armor', slots: ['Waist'], classes: [], level: 0, ac: 3, hp: 0, mana: 0, dmg: 0, dly: 0, stats: { STR: 2, SV: 5 }, skill: '', icon: 971, zones: ['Crushbone'], flags: ['MAGIC'] }
assert.equal(score(item, 0, flat), 6.5)
// Tiered scores gain +1 SV Void/tier: tier × 0.3 × w.SV(1) on top of stats.
// Weapon DPS term: 5dmg/25dly × 20 × w.DPS(1) = 4; tier 6 dmg 5+floor(3)=8 -> 6.4, +1.8 void
const wpn: Item = { ...item, name: 'Test Blade', slots: ['Primary'], ac: 0, stats: {}, dmg: 5, dly: 25, skill: '1H Slashing' }
assert.equal(score(wpn, 0, flat), 4)
assert.equal(score(wpn, 6, flat), 8.2)
// Worn haste: 21% × 0.5 × w.DPS(1) = 10.5; flat +1%/tier -> 27 × 0.5 = 13.5
const sash: Item = { ...item, name: 'Test Sash', ac: 0, stats: {}, haste: 21 }
assert.equal(score(sash, 0, flat), 10.5)
assert.equal(score(sash, 6, flat), 15.3) // 13.5 + 1.8 void
// Endurance: like HP but on the DPS weight — 10 × 0.1 × 1 = 1; tiers as a stat
const crown: Item = { ...item, name: 'Test Crown', ac: 0, stats: {}, end: 10 }
assert.equal(score(crown, 0, flat), 1)
assert.equal(score(crown, 6, flat), 3.4) // tierStat(10,6)=16 -> 1.6, + 1.8 void
// Worn regen: 6 HP regen × 1.5 × w.HP(1) = 9; regen <10 so tiers add +1/tier
const tunic: Item = { ...item, name: 'Test Tunic', ac: 0, stats: {}, hpRegen: 6 }
assert.equal(score(tunic, 0, flat), 9)
assert.equal(score(tunic, 3, flat), 14.4) // tierStat(6,3)=9 × 1.5 + 0.9 void

// Primary ranks weapons ratio-first for melee trios: the user's 14/30 stiletto
// must outrank a 10/30 stat stick despite the stick's higher raw score.
const stick: Item = { ...item, name: 'Test Stick', slots: ['Primary'], ac: 0, dmg: 10, dly: 30, stats: { WIS: 15 }, skill: '1H Blunt' }
const blade: Item = { ...item, name: 'Test Fast Blade', slots: ['Primary'], ac: 0, dmg: 14, dly: 30, stats: {}, skill: 'Piercing' }
assert.ok(score(stick, 0, flat) > score(blade, 0, flat))
assert.ok(rankScore(blade, 0, flat, 'Primary', ['ROG', 'SHM', 'ENC']) > rankScore(stick, 0, flat, 'Primary', ['ROG', 'SHM', 'ENC']))
// ...but a pure caster/priest trio keeps score order, and other slots always do
assert.ok(rankScore(stick, 0, flat, 'Primary', ['CLR', 'WIZ', 'ENC']) > rankScore(blade, 0, flat, 'Primary', ['CLR', 'WIZ', 'ENC']))
assert.ok(rankScore(stick, 0, flat, 'Secondary', ['ROG', 'SHM', 'ENC']) > rankScore(blade, 0, flat, 'Secondary', ['ROG', 'SHM', 'ENC']))
assert.ok(hasMeleeTrio(['BRD']) && !hasMeleeTrio(['CLR', 'WIZ']))

console.log('logic self-check OK —', inv.length, 'entries parsed')
