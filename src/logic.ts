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

// Per-class weight tables — designer defaults, not community-tuned yet.
export const W: Record<string, Weights> = {
  WAR: { AC: 3, HP: 1.5, STR: 1.5, STA: 2, AGI: 1, DEX: 0.8, SV: 0.5, DPS: 2 },
  CLR: { AC: 1.5, HP: 1, MANA: 1.5, STA: 1, WIS: 3, SV: 0.5, DPS: 0.3 },
  PAL: { AC: 2.5, HP: 1.2, MANA: 0.8, STR: 1.5, STA: 1.5, WIS: 1.5, SV: 0.5, DPS: 1.5 },
  RNG: { AC: 1.5, HP: 1, STR: 1.5, STA: 1, AGI: 1.5, DEX: 1.5, WIS: 1, SV: 0.5, DPS: 2 },
  SHD: { AC: 2.5, HP: 1.2, MANA: 0.8, STR: 1.5, STA: 1.5, INT: 1.5, SV: 0.5, DPS: 1.5 },
  DRU: { AC: 1, HP: 1, MANA: 1.5, WIS: 3, SV: 0.5, DPS: 0.3 },
  MNK: { AC: 2, HP: 1.2, STR: 1.5, STA: 1.5, AGI: 2, DEX: 1.2, SV: 0.5, DPS: 2 },
  BRD: { AC: 1.5, HP: 1, STR: 1, STA: 1, AGI: 1, DEX: 2, CHA: 1.5, SV: 0.5, DPS: 1.5 },
  ROG: { AC: 1.2, HP: 1, STR: 1.5, STA: 1, AGI: 1.5, DEX: 2, SV: 0.5, DPS: 2.5 },
  SHM: { AC: 1, HP: 1, MANA: 1.5, STA: 1, WIS: 3, SV: 0.5, DPS: 0.3 },
  NEC: { AC: 0.8, HP: 1, MANA: 1.5, INT: 3, SV: 0.5, DPS: 0.3 },
  WIZ: { AC: 0.8, HP: 1, MANA: 1.5, INT: 3, SV: 0.5, DPS: 0.3 },
  MAG: { AC: 0.8, HP: 1, MANA: 1.5, INT: 3, SV: 0.5, DPS: 0.3 },
  ENC: { AC: 0.8, HP: 1, MANA: 1.5, INT: 3, CHA: 1.5, SV: 0.5, DPS: 0.3 },
  BST: { AC: 1.5, HP: 1.2, MANA: 0.8, STR: 1.2, STA: 1.5, AGI: 1.2, WIS: 1.5, SV: 0.5, DPS: 1.5 },
  BER: { AC: 1.5, HP: 1.2, STR: 2, STA: 1.5, AGI: 1, DEX: 1.2, SV: 0.5, DPS: 2.5 },
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

export function score(ci: Item, tier: number, w: Weights): number {
  let s = tierStat(ci.ac, tier) * w.AC
    + tierStat(ci.hp, tier) * 0.1 * w.HP
    + tierStat(ci.mana, tier) * 0.1 * w.MANA
  for (const k of STAT_KEYS) {
    const v = ci.stats[k] || 0
    if (v) s += (v > 0 ? tierStat(v, tier) : v) * (w[k] || 0)
  }
  if (ci.stats.SV) s += tierStat(ci.stats.SV, tier) * 0.3 * w.SV
  if (ci.dmg && ci.dly) s += (tierDmg(ci.dmg, tier) / ci.dly) * 20 * w.DPS
  // ponytail: 1% worn haste = 0.5 × DPS-weight points — a heuristic sized so a
  // 21% FBSS ≈ a serious weapon upgrade for melee; tune with player feedback.
  // Haste (like other % effects) gains a flat +1%/tier, not the stat formula.
  if (ci.haste) s += (ci.haste + tier) * 0.5 * w.DPS
  // Endurance fuels melee abilities: valued like HP (0.1/point, tiered) but
  // against the DPS weight, so it matters for melee and rounds to 0 for casters.
  if (ci.end) s += tierStat(ci.end, tier) * 0.1 * w.DPS
  // Worn regen ticks constantly, so a point is worth far more than a point of
  // pool: ~15× (1 regen ≈ 15 HP), matching community consensus. Regen values
  // are all <10 so tierStat degenerates to +1/tier, like the game applies.
  if (ci.hpRegen) s += tierStat(ci.hpRegen, tier) * 1.5 * w.HP
  if (ci.manaRegen) s += tierStat(ci.manaRegen, tier) * 1.5 * w.MANA
  if (ci.endRegen) s += tierStat(ci.endRegen, tier) * 1.5 * w.DPS
  // Every tiered item gains +1 SV Void per tier (verified in-game).
  if (tier) s += tier * 0.3 * w.SV
  return s
}

// Primary is an auto-attack slot: when the trio has any melee or hybrid class,
// real weapons rank by dmg/dly ratio first and stats only tiebreak (a wis stick
// must not beat a better-ratio blade). Done as a large additive boost so every
// existing numeric score sort keeps working; the boost stays out of displayed
// scores. Pure caster/priest trios keep plain score rank — stat sticks win.
// ponytail: Primary only; Secondary stays score-ranked (shield vs dual wield
// is a build choice, not a ranking bug). Extend if players ask.
export const hasMeleeTrio = (trio: string[]) =>
  trio.some(c => ['Melee', 'Hybrids'].includes(CLASSES.find(x => x.code === c)?.group || ''))
export const rankScore = (ci: Item, tier: number, w: Weights, slot: string, trio: string[]) =>
  score(ci, tier, w) + (slot === 'Primary' && ci.dmg > 0 && ci.dly > 0 && hasMeleeTrio(trio)
    ? (tierDmg(ci.dmg, tier) / ci.dly) * 2000 : 0)

// UTF-8-safe base64 for the share link (no spread of big arrays).
export function b64encode(s: string) {
  const b = new TextEncoder().encode(s)
  let o = ''
  for (let i = 0; i < b.length; i++) o += String.fromCharCode(b[i])
  return btoa(o)
}
export function b64decode(b: string) { return new TextDecoder().decode(Uint8Array.from(atob(b), c => c.charCodeAt(0))) }
