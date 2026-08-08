// Pure data + math for EQL BiS — no DOM. Ported 1:1 from the design handoff
// (docs/design_handoff_eql_bis_finder). Kept separate from App.tsx so it can
// run under plain `node` for the self-check (src/logic.test.ts).

export type Item = {
  name: string; type: string; slots: string[]; classes: string[]; level: number;
  ac: number; hp: number; mana: number; dmg: number; dly: number; haste?: number;
  stats: Record<string, number>; skill: string; icon: number; zones: string[]; flags: string[];
  // tooltip extras from the wiki scrape (absent in the hand-made seed catalog)
  resists?: Record<string, number>; wt?: number; size?: string; races?: string[]; effect?: string; focus?: string;
  vendors?: string[]; notes?: string;
  end?: number; backstab?: number; charges?: number; range?: string; deity?: string;
  hpRegen?: number; manaRegen?: number; endRegen?: number;
}
export type InvSource = 'equipped' | 'bags' | 'bank' | 'stash' | 'hoard' | 'depot'
export type InvEntry = { base: string; tier: number; loc: string; source: InvSource; count: number }
export type Weights = Record<string, number>

export const CLASSES = [
  { code: 'ENC', name: 'Enchanter', group: 'Casters' }, { code: 'MAG', name: 'Magician', group: 'Casters' },
  { code: 'NEC', name: 'Necromancer', group: 'Casters' }, { code: 'WIZ', name: 'Wizard', group: 'Casters' },
  { code: 'CLR', name: 'Cleric', group: 'Priests' }, { code: 'DRU', name: 'Druid', group: 'Priests' },
  { code: 'SHM', name: 'Shaman', group: 'Priests' },
  { code: 'BER', name: 'Berserker', group: 'Melee' }, { code: 'MNK', name: 'Monk', group: 'Melee' },
  { code: 'ROG', name: 'Rogue', group: 'Melee' }, { code: 'WAR', name: 'Warrior', group: 'Melee' },
  { code: 'BRD', name: 'Bard', group: 'Hybrids' }, { code: 'BST', name: 'Beastlord', group: 'Hybrids' },
  { code: 'PAL', name: 'Paladin', group: 'Hybrids' }, { code: 'RNG', name: 'Ranger', group: 'Hybrids' },
  { code: 'SHD', name: 'Shadow Knight', group: 'Hybrids' },
]

export const KEYS = ['AC', 'HP', 'MANA', 'STR', 'STA', 'AGI', 'DEX', 'WIS', 'INT', 'CHA', 'SV', 'DPS']

// Per-class weight tables — community-tuned Aug 2026 from classic-era EQ
// research (P99/TAKP wikis + forums, Monkly-Business, Safehouse, Almar's,
// EQProgression). Sources and full rationale: docs/stat-weights.md.
// Calibration anchors (classic era: stats far from caps, weak buffs):
//   1 AC ≈ 5 HP for tanks (Raev/Danth parses) → w.AC = w.HP (HP scores 0.2/pt)
//   w.STA ≈ class HP-per-STA × 0.2 × w.HP (WAR ~5/pt … casters ~2.4/pt)
//   1 WIS/INT ≈ 10 mana → w.MANA = w.WIS/2 (mana scores 0.2/pt)
//   AGI ≈ worthless above 75 (~0.25 eff. AC/pt) → token weight
//   CHA only works for ENC charm/mez (major) and BRD lull (minor)
//   Resists ≈ HP for raid melee/tanks (rogue lists rank SV above HP)
export const W: Record<string, Weights> = {
  WAR: { AC: 3, HP: 3, STR: 1, STA: 2.5, AGI: 0.3, DEX: 1, SV: 1, DPS: 2 },
  CLR: { AC: 1.2, HP: 1.2, MANA: 1.5, STA: 0.7, WIS: 3, SV: 0.5, DPS: 0.2 },
  PAL: { AC: 2.5, HP: 2.5, MANA: 0.4, STR: 1, STA: 2, AGI: 0.3, DEX: 0.8, WIS: 0.8, SV: 1, DPS: 1.5 },
  RNG: { AC: 2, HP: 2, MANA: 0.3, STR: 2, STA: 1.5, AGI: 0.3, DEX: 1.2, WIS: 0.5, SV: 1, DPS: 2.5 },
  SHD: { AC: 2.5, HP: 2.5, MANA: 0.3, STR: 1, STA: 2, AGI: 0.3, DEX: 0.8, INT: 0.5, SV: 1, DPS: 1.5 },
  DRU: { AC: 0.8, HP: 1.2, MANA: 1.5, STA: 0.7, WIS: 3, SV: 0.5, DPS: 0.2 },
  MNK: { AC: 2.5, HP: 2, STR: 1.5, STA: 1.5, AGI: 0.3, DEX: 0.8, SV: 1, DPS: 3 },
  BRD: { AC: 1.5, HP: 1.5, STR: 0.5, STA: 1.2, AGI: 0.3, DEX: 1.5, CHA: 0.8, SV: 1.2, DPS: 1.5 },
  ROG: { AC: 1.2, HP: 1.5, STR: 2, STA: 1, AGI: 0.2, DEX: 0.8, SV: 1, DPS: 3 },
  SHM: { AC: 1, HP: 1.8, MANA: 1.5, STA: 1, WIS: 3, SV: 0.5, DPS: 0.3 },
  NEC: { AC: 0.5, HP: 1.8, MANA: 1.5, STA: 0.7, INT: 3, SV: 0.5, DPS: 0.2 },
  WIZ: { AC: 0.5, HP: 1.2, MANA: 1.5, STA: 0.6, INT: 3, SV: 0.5, DPS: 0.2 },
  MAG: { AC: 0.5, HP: 1.5, MANA: 1.5, STA: 0.6, INT: 3, SV: 0.5, DPS: 0.2 },
  ENC: { AC: 0.8, HP: 1.5, MANA: 1.5, STA: 0.6, INT: 2.5, CHA: 2, SV: 0.8, DPS: 0.2 },
  BST: { AC: 1.5, HP: 1.5, MANA: 0.4, STR: 1.5, STA: 1.5, AGI: 0.3, DEX: 1.2, WIS: 0.8, SV: 0.8, DPS: 2.5 },
  BER: { AC: 1.2, HP: 1.5, STR: 2, STA: 1.5, AGI: 0.3, DEX: 1.5, SV: 0.8, DPS: 3 },
}

export const PRESETS = [
  { id: 'balanced', label: 'Balanced', mult: {} as Weights },
  { id: 'melee', label: 'Melee', mult: { STR: 1.6, STA: 1.3, AGI: 1.4, DEX: 1.5, DPS: 1.8, AC: 1.2, WIS: 0.4, INT: 0.4, MANA: 0.3, CHA: 0.6 } },
  { id: 'caster', label: 'Caster', mult: { WIS: 1.7, INT: 1.7, MANA: 1.8, CHA: 1.2, HP: 1.1, STR: 0.4, DEX: 0.5, AGI: 0.7, DPS: 0.3 } },
  { id: 'tank', label: 'Tank', mult: { AC: 1.8, HP: 1.7, STA: 1.6, AGI: 1.2, SV: 1.3, DPS: 0.7, INT: 0.6, WIS: 0.6, MANA: 0.5 } },
]

// Any Slot goals: absolute weight tables that replace the stat-weight system
// entirely when active ('weights' = use the Stat Weights panel).
export const GOALS: { id: string; label: string; abs?: Weights }[] = [
  { id: 'weights', label: 'Stat Weights' },
  { id: 'maxac', label: 'Max AC', abs: { AC: 3, HP: 0.3, STA: 0.3 } },
  { id: 'maxhp', label: 'Max HP', abs: { HP: 3, STA: 1.5, AC: 0.3 } },
  { id: 'rawstats', label: 'Raw Stats', abs: { STR: 1, STA: 1, AGI: 1, DEX: 1, WIS: 1, INT: 1, CHA: 1, SV: 0.5 } },
]

export const EQUIP_LOCS = ['Charm', 'Ear', 'Head', 'Face', 'Neck', 'Shoulders', 'Arms', 'Back', 'Wrist', 'Range', 'Hands', 'Primary', 'Secondary', 'Fingers', 'Chest', 'Legs', 'Feet', 'Waist', 'Ammo', 'Held', 'Any Slot', 'Power Source']
export const WPN_TYPES = ['1H Slashing', '1H Blunt', 'Piercing', 'Hand to Hand', '2H Slashing', '2H Blunt', '2H Piercing', 'Archery', 'Shield']
export const SLOT_TYPES = ['Primary', 'Secondary', 'Range', 'Head', 'Face', 'Ear', 'Neck', 'Shoulders', 'Back', 'Arms', 'Wrist', 'Hands', 'Fingers', 'Chest', 'Waist', 'Legs', 'Feet', 'Any Slot']

export const STAT_KEYS = ['STR', 'STA', 'AGI', 'DEX', 'WIS', 'INT', 'CHA']

// Main-hand damage bonus (flat, added to every mainhand swing, starts L28) —
// folded into weapon scores as phantom damage. Calibrated at level 50 (EQL
// classic cap): 1H = floor((50-25)/3) = 8; 2H = 9 under 28 delay, else 14.
// Retune if the cap rises (at 60: 1H 11; 2H 12 / ~30 / ~38 / 49 by delay
// bracket). Offhand gets no bonus in-game — the small fast-weapon bias this
// adds to Secondary ranking is accepted; ratio still dominates there.
export const dmgBonus = (skill: string, dly: number) =>
  skill.startsWith('2H') ? (dly >= 28 ? 14 : 9) : 8
export const rangedSkill = (s: string) => s === 'Archery' || s.startsWith('Throwing')

// Worn regen effects to per-tick values: Flowing Thought N = N mana/tick (any
// tier), Fungal Regrowth (Fungi) = 15 HP/tick, worn Regeneration = 9 HP/tick
// ("up to 9 hit points every 6 seconds" per its spell description).
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15 }
export const wornRegen = (effectName: string): { hp?: number; mana?: number } | undefined => {
  const ft = effectName.match(/^Flowing Thought ([IVX]+)$/)
  if (ft) return { mana: ROMAN[ft[1]] || 1 }
  if (effectName === 'Fungal Regrowth') return { hp: 15 }
  if (effectName === 'Regeneration') return { hp: 9 }
  return undefined
}

// Worn haste's score contribution — shared with the Best Owned haste dedup
// (worn haste never stacks in-game; only the highest item counts).
export const hasteTerm = (haste: number, tier: number, w: Weights) => (haste + tier) * 2.5 * w.DPS

export const r2 = (v: number) => Math.round(v * 100) / 100
export const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1)

// In-game item names that differ from their wiki page (game typos the wiki
// corrected without leaving a redirect). Lowercase game name -> catalog name.
// Grows as players report "no catalog data" on items they can see on the wiki.
export const NAME_ALIASES: Record<string, string> = {
  'deterioriated ancient faydark longbow': 'Deteriorated Ancient Faydark Longbow',
}
// ---- inventory parsing (/outputfile inventory format) ----
export function parseInv(text: string): InvEntry[] {
  const entries: InvEntry[] = []
  for (const line of text.split(/\r?\n/)) {
    const p = line.split('\t')
    if (p.length < 2) continue
    const loc = p[0]
    let name = p[1]
    if (!name || name === 'Name' || name === 'Empty' || /\(Exaltation\)/.test(name)) continue
    let source: InvSource, slotBase = loc
    if (loc === 'Equipment') source = 'stash'
    else if (/^General \d+/.test(loc)) source = 'bags'
    else if (/^(Bank|SharedBank)/.test(loc)) source = 'bank'
    else if (/^Hoard \d+/.test(loc)) {
      // Dragon's Hoard holds items directly; its -SlotN rows are augment
      // sub-slots on the hoarded item (Slot1/2/7/8 numbering), not bag contents.
      if (loc.includes('-Slot')) continue
      source = 'hoard'
    } else if (/^Personal-Depot/.test(loc)) source = 'depot'
    else {
      slotBase = loc.split('-Slot')[0]
      if (!EQUIP_LOCS.includes(slotBase)) continue // KeyRing etc.
      if (loc.includes('-Slot')) continue // augment/Exaltation sub-slots
      source = 'equipped'
    }
    name = name.replace(/\*$/, '').trim()
    const tm = name.match(/\s\+(\d+)$/)
    const tier = tm ? parseInt(tm[1], 10) : 0
    let base = tm ? name.slice(0, tm.index).trim() : name
    base = NAME_ALIASES[base.toLowerCase()] || base
    entries.push({ base, tier, loc: slotBase, source, count: parseInt(p[3] || '1', 10) || 1 })
  }
  return entries
}

// ---- tier (+N merge level) math ----
// Verified against in-game tooltips (Aug 2026, 15 data points): stats +10%/tier
// rounded down with a minimum of +1/tier; weapon damage +10%/tier rounded down
// (no minimum observed); every tiered item also gains +1 SV Void per tier.
export const tierStat = (v: number, tier: number) => (v > 0 ? v + Math.max(Math.floor(v * 0.10 * tier), tier) : v)
export const tierDmg = (dmg: number, tier: number) => dmg + Math.floor(dmg * 0.10 * tier)

// Effective weights: trio blend × preset multiplier, then manual overrides win.
export function blendWeights(trio: string[], presetId: string, overrides: Weights): Weights {
  const p = PRESETS.find(x => x.id === presetId) || PRESETS[0]
  const w: Weights = {}
  for (const k of KEYS) {
    if (overrides[k] !== undefined) { w[k] = overrides[k]; continue }
    const base = !trio.length ? 1 : trio.reduce((s, c) => s + (W[c][k] || 0), 0) / trio.length
    w[k] = r2(base * (p.mult[k] ?? 1))
  }
  return w
}

// A weapon only swings from Primary/Secondary (ranged from Range/Ammo) — in
// any other viewed slot its dmg/dly and proc are dead stats. No slot = generic.
export const wpnActive = (slot: string | undefined, skill: string) =>
  !slot || slot === 'Primary' || slot === 'Secondary' || (rangedSkill(skill) && (slot === 'Range' || slot === 'Ammo'))

export function score(ci: Item, tier: number, w: Weights, slot?: string): number {
  // HP/mana score 0.2/point: at equal weights 1 AC = 5 HP (tank-community
  // consensus) and 10 mana = 1 WIS/INT when w.MANA = w.WIS/2 (1 stat ≈ 10 mana).
  let s = tierStat(ci.ac, tier) * w.AC
    + tierStat(ci.hp, tier) * 0.2 * w.HP
    + tierStat(ci.mana, tier) * 0.2 * w.MANA
  for (const k of STAT_KEYS) {
    const v = ci.stats[k] || 0
    if (v) s += (v > 0 ? tierStat(v, tier) : v) * (w[k] || 0)
  }
  if (ci.stats.SV) s += tierStat(ci.stats.SV, tier) * 0.3 * w.SV
  if (ci.dmg && ci.dly && wpnActive(slot, ci.skill)) {
    // Real mainhand DPS = (2×dmg + damage bonus)/delay (delay is in tenths),
    // so the score is white-DPS × w.DPS. Ranged counts half: bow/thrown damage
    // is halved in-game and pre-AA archery is utility-grade.
    const d = tierDmg(ci.dmg, tier)
    s += ((2 * d + dmgBonus(ci.skill, ci.dly)) / ci.dly) * 10 * (rangedSkill(ci.skill) ? 0.5 : 1) * w.DPS
  }
  // Combat procs fire ~1–2/min regardless of delay; a typical 50–100dd proc
  // ≈ 2 DPS. Flat tiebreaker credit — proc text is prose, not parseable.
  // Weapon procs need the weapon to swing in the viewed slot; worn procs on
  // armor fire off the wearer's own swings, so they count in any slot.
  if (ci.effect && ci.effect.includes('(Combat') && (ci.dmg && ci.dly ? wpnActive(slot, ci.skill) : true)) s += 2 * w.DPS
  // 1% worn haste = 2.5 × DPS-weight points. Grounded in community parse math
  // (1% haste ≈ 1% auto-attack DPS ≈ 10 STR/ATK): sized so FBSS beats any pure
  // stat belt for melee and 41% belts rank near-BiS, matching P99/TAKP lists.
  // Kept below the parse-exact ~7× because spell haste dilutes worn haste and
  // score also prices survivability. Haste gains a flat +1%/tier.
  if (ci.haste) s += hasteTerm(ci.haste, tier, w)
  // Focus effects (Improved Damage/Healing, Mana Preservation…) are real
  // caster power on a modern-client server. Flat credit on w.MANA — a good
  // proxy for how much a build casts — since focus strings aren't graded.
  if (ci.focus) s += 10 * (w.MANA || 0)
  // Endurance is near-worthless in this era (discs are timer-gated, the bar
  // only drains on sprint/jump/heavy weapons) — token weight kept in case
  // EQL's custom content adds endurance costs.
  if (ci.end) s += tierStat(ci.end, tier) * 0.05 * w.DPS
  // Worn regen ticks constantly: 1 regen ≈ 30 points of pool (community puts
  // FT1 at 50–100+ mana of pool in raid flow; 30 keeps Fungi-class items
  // legendary without drowning stats). 30 × 0.2 = 6/point. Regen values are
  // all <10 so tierStat degenerates to +1/tier, like the game applies.
  if (ci.hpRegen) s += tierStat(ci.hpRegen, tier) * 6 * w.HP
  if (ci.manaRegen) s += tierStat(ci.manaRegen, tier) * 6 * w.MANA
  if (ci.endRegen) s += tierStat(ci.endRegen, tier) * 1.5 * w.DPS
  // Classic worn regen lives in the effect string, not the regen fields (only
  // 4 catalog items use those): credit the known effects at the same 30×-pool
  // rate. Untiered — whether tiers scale effects is unverified.
  if (ci.effect && ci.effect.includes('(Worn')) {
    const wr = wornRegen(ci.effect.split(' (')[0])
    if (wr) s += (wr.hp || 0) * 6 * w.HP + (wr.mana || 0) * 6 * w.MANA
  }
  // Every tiered item gains +1 SV Void per tier (verified in-game).
  if (tier) s += tier * 0.3 * w.SV
  return s
}

// score() decomposed into labeled contributions, for the score tooltip and the
// "why is this better" diff. Same math as score() with a canonical key per
// term so two items' breakdowns can be compared key-by-key. score() stays the
// separate fast path (it runs catalog × slots per render); the self-check
// asserts the two never drift.
export type Part = { key: string; label: string; val: number }
export function parts(ci: Item, tier: number, w: Weights, slot?: string): Part[] {
  const P: Part[] = []
  const add = (key: string, label: string, val: number) => { if (val) P.push({ key, label, val }) }
  if (ci.dmg && ci.dly && wpnActive(slot, ci.skill)) {
    const d = tierDmg(ci.dmg, tier), b = dmgBonus(ci.skill, ci.dly)
    add('DPS', '(2×' + d + 'dmg + ' + b + ' bonus)/' + ci.dly + 'dly × 10' + (rangedSkill(ci.skill) ? ' × 0.5 ranged' : '') + ' × ' + r2(w.DPS) + ' dps',
      ((2 * d + b) / ci.dly) * 10 * (rangedSkill(ci.skill) ? 0.5 : 1) * w.DPS)
  }
  if (ci.ac) add('AC', 'AC ' + tierStat(ci.ac, tier) + ' × ' + r2(w.AC), tierStat(ci.ac, tier) * w.AC)
  for (const k of STAT_KEYS) {
    const v = ci.stats[k] || 0
    if (v) add(k, k + ' ' + (v > 0 ? tierStat(v, tier) : v) + ' × ' + r2(w[k] || 0), (v > 0 ? tierStat(v, tier) : v) * (w[k] || 0))
  }
  if (ci.haste) add('Haste', 'Haste ' + (ci.haste + tier) + '% × 2.5 × ' + r2(w.DPS), hasteTerm(ci.haste, tier, w))
  if (ci.effect && ci.effect.includes('(Combat') && (ci.dmg && ci.dly ? wpnActive(slot, ci.skill) : true)) add('Proc', 'Combat proc ≈ 2 dps × ' + r2(w.DPS), 2 * w.DPS)
  if (ci.focus) add('Focus', 'Focus effect + 10 × ' + r2(w.MANA || 0) + ' mana wt', 10 * (w.MANA || 0))
  if (ci.hp) add('HP', 'HP ' + tierStat(ci.hp, tier) + ' × 0.2 × ' + r2(w.HP), tierStat(ci.hp, tier) * 0.2 * w.HP)
  if (ci.mana) add('Mana', 'Mana ' + tierStat(ci.mana, tier) + ' × 0.2 × ' + r2(w.MANA), tierStat(ci.mana, tier) * 0.2 * w.MANA)
  if (ci.end) add('END', 'END ' + tierStat(ci.end, tier) + ' × 0.05 × ' + r2(w.DPS), tierStat(ci.end, tier) * 0.05 * w.DPS)
  if (ci.stats.SV) add('Resists', 'Resists ' + tierStat(ci.stats.SV, tier) + ' × 0.3 × ' + r2(w.SV), tierStat(ci.stats.SV, tier) * 0.3 * w.SV)
  if (ci.hpRegen) add('HP Regen', 'HP Regen ' + tierStat(ci.hpRegen, tier) + ' × 6 × ' + r2(w.HP), tierStat(ci.hpRegen, tier) * 6 * w.HP)
  if (ci.manaRegen) add('Mana Regen', 'Mana Regen ' + tierStat(ci.manaRegen, tier) + ' × 6 × ' + r2(w.MANA), tierStat(ci.manaRegen, tier) * 6 * w.MANA)
  if (ci.endRegen) add('End Regen', 'End Regen ' + tierStat(ci.endRegen, tier) + ' × 1.5 × ' + r2(w.DPS), tierStat(ci.endRegen, tier) * 1.5 * w.DPS)
  if (ci.effect && ci.effect.includes('(Worn')) {
    const name = ci.effect.split(' (')[0], wr = wornRegen(name)
    if (wr?.hp) add('HP Regen', 'Worn ' + name + ' (' + wr.hp + ' HP/tick) × 6 × ' + r2(w.HP), wr.hp * 6 * w.HP)
    if (wr?.mana) add('Mana Regen', 'Worn ' + name + ' (' + wr.mana + ' mana/tick) × 6 × ' + r2(w.MANA), wr.mana * 6 * w.MANA)
  }
  if (tier) add('SV Void', 'SV Void ' + tier + ' × 0.3 × ' + r2(w.SV), tier * 0.3 * w.SV)
  return P
}

// Why item a outscores item b: per-key contribution diff, biggest first.
// Duplicate keys (regen field + worn regen effect) accumulate.
export function whyDiff(a: Item, at: number, b: Item, bt: number, w: Weights, slot?: string): [string, number][] {
  const d = new Map<string, number>()
  for (const p of parts(a, at, w, slot)) d.set(p.key, (d.get(p.key) || 0) + p.val)
  for (const p of parts(b, bt, w, slot)) d.set(p.key, (d.get(p.key) || 0) - p.val)
  return [...d].filter(([, v]) => Math.abs(v) >= 0.05).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))
}

// Primary is an auto-attack slot: when the trio has any melee or hybrid class,
// real weapons rank by dmg/dly ratio first and stats only tiebreak (a wis stick
// must not beat a better-ratio blade). Done as a large additive boost so every
// existing numeric score sort keeps working; the boost stays out of displayed
// scores. Pure caster/priest trios keep plain score rank — stat sticks win.
// Secondary gets the same treatment when the trio can dual wield (offhand
// ratio uses no damage bonus — mainhand only in-game); shield-only trios keep
// score rank so shields aren't buried under every weapon.
export const hasMeleeTrio = (trio: string[]) =>
  trio.some(c => ['Melee', 'Hybrids'].includes(CLASSES.find(x => x.code === c)?.group || ''))
export const canDualWield = (trio: string[]) =>
  trio.some(c => ['WAR', 'MNK', 'ROG', 'RNG', 'BRD', 'BST'].includes(c))
export const rankScore = (ci: Item, tier: number, w: Weights, slot: string, trio: string[]) => {
  let s = score(ci, tier, w, slot)
  const wpnSlot = slot === 'Primary' || (slot === 'Secondary' && canDualWield(trio))
  if (wpnSlot && ci.dmg > 0 && ci.dly > 0 && !rangedSkill(ci.skill) && hasMeleeTrio(trio)) {
    const d = tierDmg(ci.dmg, tier)
    s += ((2 * d + (slot === 'Primary' ? dmgBonus(ci.skill, ci.dly) : 0)) / ci.dly) * 1000
    // Backstab hits for ~25× piercer damage (max, at 50) every ~10s, so a
    // rogue's primary damage counts again ≈ 1.25 DPS per point. The custom
    // "Backstab DMG" item stat replaces weapon damage in the backstab calc
    // (catalog shows it ≈ dmg, e.g. Rib-bone Stiletto 4dmg/7bs). Same ×100
    // scale as the white-damage boost so the two trade off proportionally.
    // Only piercers the rogue can actually equip backstab (a WAR-only lance
    // in a ROG/WAR trio must not get the boost). Backstab swings from Primary.
    if (slot === 'Primary' && trio.includes('ROG') && ci.skill === 'Piercing' && (!ci.classes.length || ci.classes.includes('ROG')))
      s += (ci.backstab ? tierDmg(ci.backstab, tier) : d) * 125
  }
  return s
}

// UTF-8-safe base64 for the share link (no spread of big arrays).
export function b64encode(s: string) {
  const b = new TextEncoder().encode(s)
  let o = ''
  for (let i = 0; i < b.length; i++) o += String.fromCharCode(b[i])
  return btoa(o)
}
export function b64decode(b: string) { return new TextDecoder().decode(Uint8Array.from(atob(b), c => c.charCodeAt(0))) }
