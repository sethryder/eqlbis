import { Component, CSSProperties, ReactNode } from 'react'
import {
  CLASSES, KEYS, GOALS, PRESETS, SLOT_TYPES, STAT_KEYS, W, WPN_TYPES,
  WORN_REGEN, b64decode, b64encode, blendWeights, dmgBonus, fmt, hasteTerm, parseInv, r2, rangedSkill, rankScore, score, tierDmg, tierStat, wpnActive,
} from './logic'
import type { InvEntry, InvSource, Item, Weights } from './logic'

// Build config (prototype tweak-props)
const MAX_BROWSE = 40
const MIN_UPGRADE_DELTA = 0.1

const MONO = "'IBM Plex Mono', monospace"
const CINZEL = "Cinzel, serif"

// Acquisition channels for the Obtained By filter. An item can have several
// (e.g. dropped + crafted); it's excluded only when every channel it has is
// deselected. Items the wiki lists no source for at all (often not actually
// in game) get the 'unknown' channel, which is off by default.
const OBTAIN: [string, string][] = [['drop', 'Dropped'], ['vendor', 'Vendor sold'], ['crafted', 'Crafted'], ['quest', 'Quest'], ['unknown', 'Unknown source']]
const DEFAULT_OBT_OFF = ['unknown']

// How many of each slot a character wears (2 Any Slot per the inventory export)
const SLOT_CAP: Record<string, number> = { Ear: 2, Wrist: 2, Fingers: 2, 'Any Slot': 2 }
const obtainChannels = (ci: Item) => {
  const c = [
    ...(ci.zones.length ? ['drop'] : []),
    ...(ci.flags.includes('VENDOR') ? ['vendor'] : []),
    ...(ci.flags.includes('CRAFTED') ? ['crafted'] : []),
    ...(ci.flags.includes('QUEST') ? ['quest'] : []),
  ]
  return c.length ? c : ['unknown']
}

// Display label for where an item comes from; 'crafted' only when actually flagged.
const srcLabel = (ci: Item) => ci.zones.length ? ci.zones.join(', ')
  : ci.flags.includes('VENDOR') ? 'vendor sold'
  : ci.flags.includes('CRAFTED') ? 'crafted' : 'unknown source'

// Pet gearing rules, per the wiki's Pet Guide: every pet is WAR plus a
// secondary class, and can wear anything usable by its own classes OR any of
// the owner's classes. Pets auto-equip the highest-AC item per body slot and
// only adopt a weapon's dmg/dly if its ratio beats their innate one.
const PETS = [
  { id: 'mag-fire', label: 'Fire Elemental', owner: 'MAG', classes: ['WAR', 'WIZ'] },
  { id: 'mag-earth', label: 'Earth Elemental', owner: 'MAG', classes: ['WAR', 'RNG'] },
  { id: 'mag-air', label: 'Air Elemental', owner: 'MAG', classes: ['WAR', 'MNK'] },
  { id: 'mag-water', label: 'Water Elemental', owner: 'MAG', classes: ['WAR', 'ROG'] },
  { id: 'nec', label: 'Necromancer Pet', owner: 'NEC', classes: ['WAR', 'SHD'] },
  { id: 'shd', label: 'Shadow Knight Pet', owner: 'SHD', classes: ['WAR', 'SHD'] },
  { id: 'enc', label: 'Enchanter Pet', owner: 'ENC', classes: ['WAR', 'PAL'] },
  { id: 'shm', label: 'Shaman Pet', owner: 'SHM', classes: ['WAR', 'BST'] },
  { id: 'bst', label: 'Warder', owner: 'BST', classes: ['WAR', 'BST'] },
]
// Pet inventory: base 4 slots + class bonuses (SHD gets none; DRU's novelty pet has no listed classes).
const PET_SLOT_BONUS: Record<string, number> = { MAG: 3, BST: 3, NEC: 2, ENC: 1, DRU: 1, SHM: 1 }
// Body slots a pet can dress (with capacity), used to build the loadout — the
// in-game pet inventory is just N unlabeled boxes; the pet dresses itself.
const PET_ARMOR_SLOTS: [string, number][] = [['Head', 1], ['Face', 1], ['Ear', 2], ['Neck', 1], ['Shoulders', 1], ['Back', 1], ['Arms', 1], ['Wrist', 2], ['Hands', 1], ['Fingers', 2], ['Chest', 1], ['Waist', 1], ['Legs', 1], ['Feet', 1]]

const TYPE_COLORS: Record<string, string> = { Weapon: '#c2603f', Armor: '#5b8dd9', Jewelry: '#a472cf', Tradeskill: '#c9a45a', Container: '#4f9e8f', Misc: '#8a8f98' }
const CHIP_COLORS: Record<string, string> = { AC: 'var(--accent)', STR: '#c2603f', STA: '#c2603f', AGI: '#4f9e8f', DEX: '#4f9e8f', WIS: '#5b8dd9', INT: '#a472cf', CHA: '#a472cf', HP: 'var(--danger)', MANA: '#5b8dd9' }
const STAT_COLORS: Record<string, string> = { ...CHIP_COLORS, SV: 'var(--muted)', DPS: 'var(--accent)' }

type Chip = { txt: string; color: string }
type TipLine = { label: string; val: string; bold?: boolean }
type Tile = { tileStyle: CSSProperties; tileText: string }
type Disp = Tile & { chips: Chip[]; scoreText: string; tip: TipLine[]; hasScore: boolean }

// ---- shared styles ----
const panel: CSSProperties = { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', flex: 'none' }
const panelHead: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 10, padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }
const panelTitle: CSSProperties = { fontFamily: CINZEL, fontSize: 15, fontWeight: 600 }
const monoMeta: CSSProperties = { fontFamily: MONO, fontSize: 11, color: 'var(--muted)' }
const eyebrow: CSSProperties = { fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }
const caption: CSSProperties = { fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }
const pillBase: CSSProperties = { padding: '6px 11px', borderRadius: 20, fontSize: 11.5, cursor: 'pointer' }
const chipOff: CSSProperties = { ...pillBase, border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)' }
const chipOn: CSSProperties = { ...pillBase, border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--accentText)', fontWeight: 600 }
const numInput: CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)', color: 'var(--text)', fontFamily: MONO, fontSize: 12 }
const slotGrid: CSSProperties = { display: 'grid', gridTemplateColumns: '96px minmax(180px,1fr) minmax(180px,1fr) minmax(200px,1.15fr)', gap: 14 }
const stepBtn: CSSProperties = { width: 22, height: 22, display: 'grid', placeItems: 'center', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }
const effSecHead: CSSProperties = { padding: '9px 18px', background: 'var(--panel2)', borderBottom: '1px solid var(--border)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted)' }

type State = {
  mode: 'dark' | 'light'; trio: string[]; tab: 'slots' | 'upgrades' | 'browse' | 'effects' | 'pets'; petSel: string
  catalog: Item[]; catalogLoaded: boolean
  inv: InvEntry[] | null; invName: string; sources: Record<InvSource, boolean>
  weightOv: Weights; weightsOpen: boolean; browseSlot: string; charLevel: number; effView: 'owned' | 'all'
  compare: { name: string; tier: number; slot: string }[]
  wpnOff: string[]; obtOff: string[]; preset: string; goal: string; copied: boolean; wnonce: number
  iconIds: Set<number> | null
  spellDesc: Record<string, string>
}

export default class App extends Component<{}, State> {
  state: State = {
    mode: 'dark', trio: [], tab: 'slots', petSel: '', catalog: [], catalogLoaded: false,
    inv: null, invName: '', sources: { equipped: true, bags: true, bank: true, stash: true, hoard: true, depot: true },
    weightOv: {}, weightsOpen: false, browseSlot: 'Primary', charLevel: 50, effView: 'owned', compare: [],
    wpnOff: [], obtOff: DEFAULT_OBT_OFF, preset: 'balanced', goal: 'weights', copied: false, wnonce: 0,
    iconIds: null, spellDesc: {},
  }
  private invText: string | null = null
  private copyTimer: ReturnType<typeof setTimeout> | undefined
  private idx: Map<string, Item> | null = null
  private idxFor: Item[] | null = null

  shareUrl() {
    const s = this.state
    const d = { t: s.trio, l: s.charLevel, p: s.preset, g: s.goal, w: s.weightOv, x: s.wpnOff, o: s.obtOff }
    return (window.location.href || '').split('#')[0] + '#b=' + encodeURIComponent(b64encode(JSON.stringify(d)))
  }

  componentDidMount() {
    // Shared link (build settings in the hash) wins over the saved draft.
    let shared: any = null
    try {
      const m = (window.location.hash || '').match(/[#&]b=([^&]+)/)
      if (m) shared = JSON.parse(b64decode(decodeURIComponent(m[1])))
    } catch (e) {}
    if (shared) {
      const next: Partial<State> = {}
      if (Array.isArray(shared.t)) next.trio = shared.t.filter((c: string) => W[c]).slice(0, 3)
      if (shared.l) next.charLevel = Math.max(1, Math.min(50, +shared.l || 50))
      if (shared.p && PRESETS.some(p => p.id === shared.p)) next.preset = shared.p
      if (shared.g && GOALS.some(g => g.id === shared.g)) next.goal = shared.g
      if (shared.w && typeof shared.w === 'object') next.weightOv = shared.w
      if (Array.isArray(shared.x)) next.wpnOff = shared.x.filter((t: string) => WPN_TYPES.includes(t))
      if (Array.isArray(shared.o)) next.obtOff = shared.o.filter((t: string) => OBTAIN.some(([id]) => id === t))
      this.set(next)
    }
    try {
      const mode = localStorage.getItem('eqlbis.mode.v1')
      const draft = JSON.parse(localStorage.getItem('eqlbis.draft.v1') || 'null')
      const next: Partial<State> = {}
      if (mode === 'light' || mode === 'dark') next.mode = mode
      if (draft) {
        if (!shared) {
          if (Array.isArray(draft.trio)) next.trio = draft.trio.filter((c: string) => W[c]).slice(0, 3)
          if (draft.weightOv) next.weightOv = draft.weightOv
          if (draft.charLevel) next.charLevel = draft.charLevel
          if (Array.isArray(draft.wpnOff)) next.wpnOff = draft.wpnOff
          // Drafts saved before the 'unknown' channel existed (v < 2) get it
          // turned off, matching the new default.
          if (Array.isArray(draft.obtOff)) next.obtOff = draft.v >= 2 ? draft.obtOff : [...new Set([...draft.obtOff, 'unknown'])]
          if (draft.preset) next.preset = draft.preset
          if (draft.goal && GOALS.some(g => g.id === draft.goal)) next.goal = draft.goal
          if (draft.petSel && PETS.some(p => p.id === draft.petSel)) next.petSel = draft.petSel
        }
        if (draft.sources) next.sources = { ...this.state.sources, ...draft.sources }
        if (draft.invText) { next.inv = parseInv(draft.invText); next.invName = draft.invName || ''; this.invText = draft.invText }
      }
      this.setState(next as State, () => this.setState(s => ({ wnonce: s.wnonce + 1 })))
    } catch (e) {}
    fetch('/eql-bis-items.json').then(r => r.json())
      .then(catalog => this.setState({ catalog, catalogLoaded: true }))
      .catch(() => this.setState({ catalogLoaded: true }))
    // ids with a wiki-sourced icon file (EQL's own art); rest use the sheets
    fetch('/icons/item/manifest.json').then(r => r.json())
      .then((ids: number[]) => this.setState({ iconIds: new Set(ids) }))
      .catch(() => {})
    // spell name -> description, for effect/focus lines (tools/fetch-spell-descriptions.mjs)
    fetch('/eql-spell-desc.json').then(r => r.json())
      .then(spellDesc => this.setState({ spellDesc }))
      .catch(() => {})
  }

  persist() {
    try {
      localStorage.setItem('eqlbis.mode.v1', this.state.mode)
      localStorage.setItem('eqlbis.draft.v1', JSON.stringify({
        v: 2, trio: this.state.trio, sources: this.state.sources, weightOv: this.state.weightOv,
        charLevel: this.state.charLevel, wpnOff: this.state.wpnOff, obtOff: this.state.obtOff, preset: this.state.preset, goal: this.state.goal,
        invText: this.invText, invName: this.state.invName, petSel: this.state.petSel,
      }))
    } catch (e) {}
  }
  set(next: Partial<State>) { this.setState(next as State, () => this.persist()) }

  // Tooltips are position:fixed so they don't grow the scroll container (which
  // made the scroll snap back when a bottom-row hover broke). One delegated
  // handler places each popover by its trigger and clamps it to the viewport.
  positionTip = (ev: React.MouseEvent) => {
    const scb = (ev.target as Element).closest('.scb')
    const tip = scb?.querySelector(':scope > .sctip') as HTMLElement | null
    if (!scb || !tip) return
    const r = scb.getBoundingClientRect()
    tip.style.display = 'flex' // measurable even if :hover hasn't applied yet
    const left = tip.classList.contains('tl') ? r.left : r.right - tip.offsetWidth
    tip.style.left = Math.max(8, Math.min(left, window.innerWidth - tip.offsetWidth - 8)) + 'px'
    tip.style.top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - tip.offsetHeight - 8)) + 'px'
    tip.style.display = ''
  }

  catIndex() {
    if (!this.idx || this.idxFor !== this.state.catalog) {
      this.idx = new Map(this.state.catalog.map(i => [i.name.toLowerCase(), i]))
      this.idxFor = this.state.catalog
    }
    return this.idx
  }
  weights() { return blendWeights(this.state.trio, this.state.preset, this.state.weightOv) }
  // Weights for Any Slot ranking: a goal table if one is picked, else the
  // regular stat weights ('weights' = same as everywhere else).
  goalWeights(): Weights {
    const g = GOALS.find(x => x.id === this.state.goal)
    if (g && g.abs) { const w: Weights = {}; for (const k of KEYS) w[k] = g.abs[k] || 0; return w }
    return this.weights()
  }
  usable(ci: Item) {
    if (!ci.classes || !ci.classes.length) return true
    if (!this.state.trio.length) return true
    return this.state.trio.some(c => ci.classes.includes(c))
  }

  chipsFor(ci: Item, tier = 0): Chip[] {
    const chips: Chip[] = []
    if (ci.dmg) chips.push({ txt: tierDmg(ci.dmg, tier) + 'dmg/' + ci.dly + 'dly' + (ci.dly ? ' · ' + r2(tierDmg(ci.dmg, tier) / ci.dly) : '') + (ci.skill ? ' ' + ci.skill.toLowerCase() : ''), color: '#c2603f' })
    else if (ci.skill === 'Shield') chips.push({ txt: 'shield', color: 'var(--muted)' })
    if (ci.ac) chips.push({ txt: 'AC' + tierStat(ci.ac, tier), color: 'var(--accent)' })
    for (const k of STAT_KEYS) {
      const v = ci.stats[k] || 0
      if (v) chips.push({ txt: k.toLowerCase() + (v > 0 ? '+' + tierStat(v, tier) : v), color: CHIP_COLORS[k] })
    }
    if (ci.haste) chips.push({ txt: 'haste+' + (ci.haste + tier) + '%', color: '#c2603f' })
    if (ci.hp) chips.push({ txt: 'hp+' + tierStat(ci.hp, tier), color: 'var(--danger)' })
    if (ci.mana) chips.push({ txt: 'mana+' + tierStat(ci.mana, tier), color: '#5b8dd9' })
    if (ci.end) chips.push({ txt: 'end+' + tierStat(ci.end, tier), color: '#c2603f' })
    if (ci.stats.SV) chips.push({ txt: 'sv+' + tierStat(ci.stats.SV, tier), color: 'var(--muted)' })
    if (ci.hpRegen) chips.push({ txt: 'hp regen+' + tierStat(ci.hpRegen, tier), color: 'var(--danger)' })
    if (ci.manaRegen) chips.push({ txt: 'mana regen+' + tierStat(ci.manaRegen, tier), color: '#5b8dd9' })
    if (ci.endRegen) chips.push({ txt: 'end regen+' + tierStat(ci.endRegen, tier), color: '#c2603f' })
    if (!chips.length) chips.push({ txt: 'no stats', color: 'var(--muted)' })
    return chips
  }

  tipFor(ci: Item, tier: number, w: Weights, slot?: string): TipLine[] {
    const L: TipLine[] = []
    const add = (label: string, val: number) => { if (val) L.push({ label, val: fmt(val) }) }
    if (ci.dmg && ci.dly && wpnActive(slot, ci.skill)) {
      const d = tierDmg(ci.dmg, tier)
      const b = dmgBonus(ci.skill, ci.dly)
      add('(2×' + d + 'dmg + ' + b + ' bonus)/' + ci.dly + 'dly × 10' + (rangedSkill(ci.skill) ? ' × 0.5 ranged' : '') + ' × ' + r2(w.DPS) + ' dps',
        ((2 * d + b) / ci.dly) * 10 * (rangedSkill(ci.skill) ? 0.5 : 1) * w.DPS)
    }
    if (ci.ac) add('AC ' + tierStat(ci.ac, tier) + ' × ' + r2(w.AC), tierStat(ci.ac, tier) * w.AC)
    for (const k of STAT_KEYS) {
      const v = ci.stats[k] || 0
      if (v) add(k + ' ' + (v > 0 ? tierStat(v, tier) : v) + ' × ' + r2(w[k]), (v > 0 ? tierStat(v, tier) : v) * w[k])
    }
    if (ci.haste) add('Haste ' + (ci.haste + tier) + '% × 2.5 × ' + r2(w.DPS), (ci.haste + tier) * 2.5 * w.DPS)
    if (ci.effect && ci.effect.includes('Combat') && wpnActive(slot, ci.skill)) add('Combat proc ≈ 2 dps × ' + r2(w.DPS), 2 * w.DPS)
    if (ci.focus) add('Focus effect + 10 × ' + r2(w.MANA || 0) + ' mana wt', 10 * (w.MANA || 0))
    if (ci.hp) add('HP ' + tierStat(ci.hp, tier) + ' × 0.2 × ' + r2(w.HP), tierStat(ci.hp, tier) * 0.2 * w.HP)
    if (ci.mana) add('Mana ' + tierStat(ci.mana, tier) + ' × 0.2 × ' + r2(w.MANA), tierStat(ci.mana, tier) * 0.2 * w.MANA)
    if (ci.end) add('END ' + tierStat(ci.end, tier) + ' × 0.05 × ' + r2(w.DPS), tierStat(ci.end, tier) * 0.05 * w.DPS)
    if (ci.stats.SV) add('Resists ' + tierStat(ci.stats.SV, tier) + ' × 0.3 × ' + r2(w.SV), tierStat(ci.stats.SV, tier) * 0.3 * w.SV)
    if (ci.hpRegen) add('HP Regen ' + tierStat(ci.hpRegen, tier) + ' × 6 × ' + r2(w.HP), tierStat(ci.hpRegen, tier) * 6 * w.HP)
    if (ci.manaRegen) add('Mana Regen ' + tierStat(ci.manaRegen, tier) + ' × 6 × ' + r2(w.MANA), tierStat(ci.manaRegen, tier) * 6 * w.MANA)
    if (ci.endRegen) add('End Regen ' + tierStat(ci.endRegen, tier) + ' × 1.5 × ' + r2(w.DPS), tierStat(ci.endRegen, tier) * 1.5 * w.DPS)
    if (ci.effect && ci.effect.includes('(Worn')) {
      const wr = WORN_REGEN[ci.effect.split(' (')[0]]
      if (wr?.hp) add('Worn ' + ci.effect.split(' (')[0] + ' (' + wr.hp + ' HP/tick) × 6 × ' + r2(w.HP), wr.hp * 6 * w.HP)
      if (wr?.mana) add('Worn ' + ci.effect.split(' (')[0] + ' (' + wr.mana + ' mana/tick) × 6 × ' + r2(w.MANA), wr.mana * 6 * w.MANA)
    }
    if (tier) add('SV Void ' + tier + ' × 0.3 × ' + r2(w.SV), tier * 0.3 * w.SV)
    if (tier) L.push({ label: 'stats at tier +' + tier + ' (+10%/tier, min +1; dmg +10%/tier; haste +1%/tier; +1 SV Void/tier)', val: '' })
    L.push({ label: 'Score · weights from your trio', val: fmt(score(ci, tier, w, slot)), bold: true })
    return L
  }

  // Real item icon from the EQ Legends dragitem*.png sheets (same math as
  // eqlfilter): 6x6 grid, column-major, ids start at 500. Rendered at 26px
  // (native cell 40px -> background-size 256*26/40 = 166.4px).
  tileFor(type: string, name: string, icon: number): Tile {
    const base: CSSProperties = { width: 26, height: 26, flex: 'none', borderRadius: 6 }
    // Prefer the wiki-sourced per-id icon (EQL's actual art — the sheets are
    // classic-era and stale for ids EQL added or replaced).
    if (icon >= 500 && this.state.iconIds?.has(icon)) {
      return {
        tileStyle: { ...base, backgroundImage: `url(/icons/item/${icon}.png)`, backgroundRepeat: 'no-repeat', backgroundSize: '26px 26px' },
        tileText: '',
      }
    }
    if (icon >= 500) {
      const rel = icon - 500, sheet = Math.floor(rel / 36) + 1, cell = rel % 36
      const col = Math.floor(cell / 6), row = cell % 6
      return {
        tileStyle: { ...base, backgroundImage: `url(/icons/dragitem${sheet}.png)`, backgroundRepeat: 'no-repeat', backgroundSize: '166.4px 166.4px', backgroundPosition: `-${col * 26}px -${row * 26}px` },
        tileText: '',
      }
    }
    return {
      tileStyle: { ...base, color: '#fff', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 12, fontWeight: 600, background: TYPE_COLORS[type] || '#8a8f98' },
      tileText: (name || type || '?')[0].toUpperCase(),
    }
  }

  dispItem(ci: Item, tier: number, w: Weights, metaChips: string[] = [], slot?: string): Disp {
    return {
      ...this.tileFor(ci.type, ci.name, ci.icon || 0),
      chips: [...this.chipsFor(ci, tier), ...metaChips.map(t => ({ txt: t, color: 'var(--muted)' }))],
      scoreText: fmt(score(ci, tier, w, slot)), tip: this.tipFor(ci, tier, w, slot), hasScore: true,
    }
  }

  // ---- render helpers ----
  tip(tip: TipLine[]) {
    return (
      <span className="sctip">
        {tip.map((tl, i) => (
          <span key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--muted)' }}>{tl.label}</span>
            <span style={{ color: 'var(--accent)' }}>{tl.val}</span>
          </span>
        ))}
      </span>
    )
  }
  badge(text: string, tip: TipLine[], style: CSSProperties = {}) {
    return (
      <span className="scb" style={{ flex: 'none', fontFamily: MONO, fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--panel2)', color: 'var(--text)', ...style }}>
        {text}
        {tip.length ? this.tip(tip) : null}
      </span>
    )
  }
  // Item info popover, structured like the in-game tooltip: identity block
  // (flags, class, race, slot), then a two-column ledger — labels left, values
  // right-aligned — grouping physique beside combat and stats beside resists.
  // Shows tier-adjusted values on merged (+N) items, like the game does.
  infoTip(ci: Item, tier = 0) {
    type Pair = [string, string | number, string?] // label, value, value color
    const eff = (v: number) => (v > 0 ? tierStat(v, tier) : v)
    const STAT_NAMES: Record<string, string> = { STR: 'Strength', STA: 'Stamina', AGI: 'Agility', DEX: 'Dexterity', WIS: 'Wisdom', INT: 'Intelligence', CHA: 'Charisma' }
    const flags = (ci.flags || []).filter(f => !['VENDOR', 'CRAFTED'].includes(f))
      .map(f => f.toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase())).join(', ')

    const physique: Pair[] = [...(ci.size ? [['Size', ci.size] as Pair] : []), ...(ci.wt ? [['Weight', ci.wt] as Pair] : [])]
    const combat: Pair[] = [
      ...(ci.dmg ? [['DMG', tierDmg(ci.dmg, tier), '#c2603f'] as Pair] : []),
      ...(ci.dly ? [['Delay', ci.dly] as Pair] : []),
      ...(ci.dmg && ci.dly ? [['Ratio', r2(tierDmg(ci.dmg, tier) / ci.dly), '#c2603f'] as Pair] : []),
      ...(ci.haste ? [['Haste', (ci.haste + tier) + '%', '#c2603f'] as Pair] : []),
      ...(ci.ac ? [['AC', eff(ci.ac), 'var(--accent)'] as Pair] : []),
      ...(ci.hp ? [['HP', eff(ci.hp), 'var(--danger)'] as Pair] : []),
      ...(ci.mana ? [['Mana', eff(ci.mana), '#5b8dd9'] as Pair] : []),
      ...(ci.end ? [['END', eff(ci.end), '#c2603f'] as Pair] : []),
      ...(ci.hpRegen ? [['HP Regen', eff(ci.hpRegen), 'var(--danger)'] as Pair] : []),
      ...(ci.manaRegen ? [['Mana Regen', eff(ci.manaRegen), '#5b8dd9'] as Pair] : []),
      ...(ci.endRegen ? [['End Regen', eff(ci.endRegen), '#c2603f'] as Pair] : []),
      ...(ci.backstab ? [['Backstab', ci.backstab] as Pair] : []),
      ...(ci.range ? [['Range', ci.range] as Pair] : []),
      ...(ci.charges ? [['Charges', ci.charges] as Pair] : []),
    ]
    const stats: Pair[] = STAT_KEYS.filter(k => ci.stats[k])
      .map(k => [STAT_NAMES[k], eff(ci.stats[k]), CHIP_COLORS[k]] as Pair)
    const resists: Pair[] = (ci.resists && Object.keys(ci.resists).length
      ? Object.entries(ci.resists).map(([k, v]) => ['SV ' + k.charAt(0) + k.slice(1).toLowerCase(), eff(v)] as Pair)
      : (ci.stats.SV ? [['SV (all)', eff(ci.stats.SV)] as Pair] : []))
      .concat(tier ? [['SV Void', tier] as Pair] : [])

    // zip two pair-lists into 4-column rows; blank cells where one side is shorter
    const ledger = (left: Pair[], right: Pair[]) => {
      if (!left.length && !right.length) return null
      const rows = Array.from({ length: Math.max(left.length, right.length) }, (_, i) => [left[i], right[i]])
      return (
        <span style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: '2px 10px' }}>
          {rows.flatMap(([l, r], i) => [
            <span key={i + 'll'} style={{ color: 'var(--muted)' }}>{l ? l[0] : ''}</span>,
            <span key={i + 'lv'} style={{ fontFamily: MONO, textAlign: 'right', color: l?.[2] || 'var(--text)' }}>{l ? l[1] : ''}</span>,
            <span key={i + 'rl'} style={{ color: 'var(--muted)' }}>{r ? r[0] : ''}</span>,
            <span key={i + 'rv'} style={{ fontFamily: MONO, textAlign: 'right', color: r?.[2] || 'var(--text)' }}>{r ? r[1] : ''}</span>,
          ])}
        </span>
      )
    }
    const idLine = (label: string, val: string) => (
      <span><span style={{ color: 'var(--muted)' }}>{label}: </span>{val}</span>
    )
    return (
      <span className="sctip tl" style={{ gap: 8 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ color: 'var(--good)', fontWeight: 600, fontSize: 11.5 }}>
            {ci.name}{tier ? <span style={{ color: 'var(--accent)' }}> +{tier}</span> : null}
          </span>
          {flags ? <span style={{ color: 'var(--muted)' }}>{flags}</span> : null}
          {idLine('Class', ci.classes?.length ? ci.classes.join(' ') : 'ALL')}
          {ci.races ? idLine('Race', ci.races.length ? ci.races.join(' ') : 'ALL') : null}
          {ci.deity ? idLine('Deity', ci.deity) : null}
          {ci.slots?.length ? <span>{ci.slots.join(', ')}{ci.skill ? <span style={{ color: 'var(--muted)' }}> · {ci.skill}</span> : null}</span> : null}
          {ci.level ? idLine('Level to obtain', ci.level + '+') : null}
        </span>
        {ledger(physique, combat)}
        {ledger(stats, resists)}
        {ci.effect || ci.focus ? (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 1, color: 'var(--accent)' }}>
            {ci.effect ? <span>Effect: {ci.effect}</span> : null}
            {ci.effect && this.state.spellDesc[ci.effect.replace(/\s*\(.*/, '').trim()] ? <span style={{ color: 'var(--muted)' }}>{this.state.spellDesc[ci.effect.replace(/\s*\(.*/, '').trim()]}</span> : null}
            {ci.focus ? <span>Focus: {ci.focus}</span> : null}
            {ci.focus && this.state.spellDesc[ci.focus] ? <span style={{ color: 'var(--muted)' }}>{this.state.spellDesc[ci.focus]}</span> : null}
          </span>
        ) : null}
        {ci.notes ? <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>{ci.notes}</span> : null}
        {ci.zones?.length || ci.vendors?.length ? (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 1, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 7 }}>
            {ci.zones?.length ? <span>Drops: {ci.zones.join(', ')}</span> : null}
            {ci.vendors?.length ? <span>Sold in: {ci.vendors.join(', ')}</span> : null}
          </span>
        ) : null}
      </span>
    )
  }
  unit(d: Tile & { chips: Chip[] }, name: ReactNode, badge: ReactNode, info?: ReactNode) {
    return (
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
        <span className={info ? 'scb' : undefined} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <div style={d.tileStyle}>{d.tileText}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px', marginTop: 3 }}>
              {d.chips.map((ch, i) => <span key={i} style={{ fontFamily: MONO, fontSize: 10.5, color: ch.color }}>{ch.txt}</span>)}
            </div>
          </div>
          {info}
        </span>
        {badge}
      </div>
    )
  }
  tierSpan(tier: number) {
    return tier ? <> <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--accent)' }}>+{tier}</span></> : null
  }

  render() {
    const st = this.state, idx = this.catIndex(), w = this.weights(), gw = this.goalWeights()
    const trio = st.trio
    const inv = st.inv || []
    const known = (e: InvEntry) => idx.get(e.base.toLowerCase())
    const pool = inv.filter(e => st.sources[e.source])

    const slotFits = (ci: Item, slot: string) => slot === 'Any Slot' ? (ci.slots && ci.slots.length > 0) : (ci.slots || []).includes(slot)
    const lvlOk = (ci: Item) => !ci.level || ci.level <= st.charLevel
    const wpnOk = (ci: Item) => !ci.skill || !st.wpnOff.includes(ci.skill)
    const obtOk = (ci: Item) => obtainChannels(ci).some(x => !st.obtOff.includes(x))
    // Best Owned is an assignment, not a per-slot max: one physical item can't
    // fill two slots (a single Baron's Blade must not be the pick for Primary
    // AND Secondary). Highest score claims a slot first; on ties the slot the
    // item is actually equipped in wins. Slots that hold two (ears, wrists,
    // fingers, Any Slot) claim up to two distinct items.
    type OwnedPick = { e: InvEntry; ci: Item; sc: number }
    const ownedPicks = new Map<string, OwnedPick[]>()
    {
      const cands: (OwnedPick & { rk: number; slot: string; inSlot: boolean })[] = []
      // Worn haste never stacks — only the highest item counts. Any owned item
      // with less haste than the best owned haste piece gets its haste credit
      // stripped here, so Best Owned doesn't stack "upgrades" that add nothing.
      const bestHaste = Math.max(0, ...pool.map(e => { const ci = known(e); return ci?.haste ? ci.haste + e.tier : 0 }))
      for (const slot of SLOT_TYPES) {
        const wRow = slot === 'Any Slot' ? gw : w
        for (const e of pool) {
          const ci = known(e)
          if (!ci || !slotFits(ci, slot) || !this.usable(ci) || !wpnOk(ci)) continue
          const dupHaste = ci.haste && ci.haste + e.tier < bestHaste ? hasteTerm(ci.haste, e.tier, wRow) : 0
          cands.push({ e, ci, sc: score(ci, e.tier, wRow, slot) - dupHaste, rk: rankScore(ci, e.tier, wRow, slot, trio) - dupHaste, slot, inSlot: e.source === 'equipped' && e.loc === slot })
        }
      }
      cands.sort((a, b) => b.rk - a.rk || (b.inSlot ? 1 : 0) - (a.inSlot ? 1 : 0))
      const used = new Set<InvEntry>()
      for (const c of cands) {
        const list = ownedPicks.get(c.slot) || []
        if (list.length >= (SLOT_CAP[c.slot] || 1) || used.has(c.e)) continue
        list.push(c)
        ownedPicks.set(c.slot, list)
        used.add(c.e)
      }
    }

    // ---- per-slot rows ----
    const slotRows = SLOT_TYPES.map(slot => {
      // Any Slot accepts any equippable item, so it ranks by the Any Slot Focus
      // goal weights (gw); every other slot uses the regular stat weights.
      const wRow = slot === 'Any Slot' ? gw : w
      const eqEntries = inv.filter(e => e.source === 'equipped' && e.loc === slot)
      const eq = eqEntries.map(e => {
        const ci = known(e)
        const base = { name: e.base, tier: e.tier, ci }
        return ci
          ? { ...base, ...this.dispItem(ci, e.tier, wRow, [], slot) }
          : { ...base, ...this.tileFor('Misc', e.base, 0), chips: [{ txt: 'no catalog data', color: 'var(--muted)' }], hasScore: false, scoreText: '', tip: [] as TipLine[] }
      })
      const eqNames = eqEntries.map(e => e.base.toLowerCase())
      // Paired slots hold two items (top 2, vs 1st/2nd-best equipped); Any Slot
      // rows show the top 3 goal-ranked picks.
      const nWant = slot === 'Any Slot' ? 3 : (slot === 'Ear' || slot === 'Wrist' || slot === 'Fingers') ? 2 : 1
      const eqScores = eqEntries.map(e => { const ci = known(e); return ci ? score(ci, e.tier, wRow, slot) : 0 }).sort((a, b) => b - a)
      const eqRks = eqEntries.map(e => { const ci = known(e); return ci ? rankScore(ci, e.tier, wRow, slot, trio) : 0 }).sort((a, b) => b - a)
      const bestEqRatio = Math.max(0, ...eqEntries.map(e => { const ci = known(e); return ci && ci.dmg && ci.dly ? tierDmg(ci.dmg, e.tier) / ci.dly : 0 }))
      const tops = st.catalog
        .filter(ci => slotFits(ci, slot) && this.usable(ci) && lvlOk(ci) && wpnOk(ci) && obtOk(ci))
        .map(ci => ({ ci, sc: score(ci, 0, wRow, slot), rk: rankScore(ci, 0, wRow, slot, trio) }))
        .sort((a, b) => b.rk - a.rk).slice(0, nWant)
      const availList = tops.map((x, i) => {
        const delta = x.sc - (eqScores[i] || 0)
        // Upgrade-ness follows the slot ranking (ratio-first on Primary); when a
        // weapon wins on ratio but not raw score, say so instead of "+0.0".
        const upgrade = x.rk - (eqRks[i] || 0) > 0.05
        const ratioGain = x.ci.dmg && x.ci.dly ? r2(x.ci.dmg / x.ci.dly - bestEqRatio) : 0
        const owned = pool.some(e => e.base.toLowerCase() === x.ci.name.toLowerCase())
        return {
          name: x.ci.name, ci: x.ci,
          ...this.dispItem(x.ci, 0, wRow, [srcLabel(x.ci), ...(x.ci.level ? ['lvl ' + x.ci.level + '+'] : [])], slot),
          deltaText: owned ? 'owned' : (eqEntries.length ? (!upgrade ? '✓ best' : delta > 0.05 ? '+' + fmt(delta) : 'ratio +' + ratioGain) : fmt(x.sc)),
          deltaColor: upgrade && !owned ? 'var(--good)' : 'var(--muted)',
          delta, upgrade, owned,
        }
      })
      // e.g. Equipped source unchecked: the best of the checked sources can
      // score under what's worn — say so instead of looking like an upgrade
      const ownedList = (ownedPicks.get(slot) || []).map((p, i) => ({
        ...p,
        isEq: eqNames.includes(p.e.base.toLowerCase()),
        belowEq: !eqNames.includes(p.e.base.toLowerCase()) && eqEntries.length > 0 && p.sc < (eqScores[i] || 0),
      }))
      return {
        slot, eq,
        eqEmptyText: st.inv ? '— empty —' : 'upload inventory',
        ownedList,
        noOwnedText: st.inv ? 'nothing usable owned' : '—',
        availList,
      }
    })

    const upgrades = slotRows
      .flatMap(r => r.availList.filter(a => !a.owned && a.upgrade && (a.delta > MIN_UPGRADE_DELTA || r.slot === 'Primary')).map(a => ({ slot: r.slot, item: a })))
      .sort((a, b) => b.item.delta - a.item.delta)

    const browseSlots = SLOT_TYPES.filter(s => s !== 'Any Slot')
    const browseRows = st.catalog
      .filter(ci => slotFits(ci, st.browseSlot) && this.usable(ci) && lvlOk(ci) && wpnOk(ci) && obtOk(ci))
      .map(ci => ({ ci, sc: score(ci, 0, w, st.browseSlot), rk: rankScore(ci, 0, w, st.browseSlot, trio) }))
      .sort((a, b) => b.rk - a.rk).slice(0, MAX_BROWSE)
      .map((x, i) => ({
        rank: i + 1, name: x.ci.name, ci: x.ci,
        ...this.dispItem(x.ci, 0, w, [x.ci.zones.length ? x.ci.zones.join(', ') : (x.ci.flags.includes('VENDOR') || x.ci.flags.includes('CRAFTED') ? '' : 'unknown source'), ...(x.ci.level ? ['lvl ' + x.ci.level + '+'] : []), ...x.ci.flags.map(f => f.toLowerCase())].filter(Boolean), st.browseSlot),
        ownedTag: pool.some(e => e.base.toLowerCase() === x.ci.name.toLowerCase()) ? 'owned' : '',
      }))

    // ---- effects on owned gear: Focus / Clicky / Worn / Proc, kind parsed
    // from the wiki effect string ("(Combat…)" = proc, "(Worn)" = worn, any
    // other equip/click wording = clicky; focus is its own field) ----
    const effKind = (txt: string) => /\(Combat/.test(txt) ? 'Proc' : /\(Worn/.test(txt) ? 'Worn' : 'Clicky'
    const effRows: { kind: string; text: string; e: InvEntry; ci: Item }[] = []
    {
      const seen = new Set<string>()
      for (const e of pool) {
        const ci = known(e)
        if (!ci || !this.usable(ci) || seen.has(e.base.toLowerCase())) continue
        seen.add(e.base.toLowerCase())
        if (ci.focus) effRows.push({ kind: 'Focus', text: ci.focus, e, ci })
        if (ci.effect) effRows.push({ kind: effKind(ci.effect), text: ci.effect, e, ci })
      }
      effRows.sort((a, b) => a.text.localeCompare(b.text))
    }
    // Focus effects tier cleanly (name + roman numeral), so "best available"
    // is real math: highest obtainable tier per family. Clicky/proc/worn have
    // no spell data to rank by — they get the All-in-game browse view instead.
    const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 }
    const focusFam = (f: string) => { const m = f.match(/^(.*?)\s+([IVX]+)$/); return { fam: m ? m[1] : f, tier: m ? ROMAN[m[2]] || 0 : 0 } }
    const bestFocus = new Map<string, { ci: Item; tier: number }>()
    for (const ci of st.catalog) {
      if (!ci.focus || !this.usable(ci) || !lvlOk(ci) || !obtOk(ci)) continue
      const { fam, tier } = focusFam(ci.focus)
      if ((bestFocus.get(fam)?.tier ?? -1) < tier) bestFocus.set(fam, { ci, tier })
    }
    const spellOf = (t: string) => t.replace(/\s*\(.*/, '')
    type EffAll = { text: string; ci: Item }
    // All-in-game view: every obtainable effect, grouped by spell name (focus
    // family for focuses, tiers sorted best-first).
    const allEffGroups = (kind: string): [string, EffAll[]][] => {
      const g = new Map<string, EffAll[]>()
      const push = (k: string, text: string, ci: Item) => {
        if (k !== kind) return
        const key = kind === 'Focus' ? focusFam(text).fam : spellOf(text)
        const l = g.get(key) || []
        l.push({ text, ci })
        g.set(key, l)
      }
      for (const ci of st.catalog) {
        if (!this.usable(ci) || !lvlOk(ci) || !obtOk(ci)) continue
        if (ci.focus) push('Focus', ci.focus, ci)
        if (ci.effect) push(effKind(ci.effect), ci.effect, ci)
      }
      for (const l of g.values()) l.sort((a, b) => (kind === 'Focus' ? focusFam(b.text).tier - focusFam(a.text).tier : 0) || a.ci.name.localeCompare(b.ci.name))
      return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    }

    // ---- pet gear (tab shown only when the trio has a pet class) ----
    const petOptions = PETS.filter(p => trio.includes(p.owner))
    const pet = petOptions.find(p => p.id === st.petSel) || petOptions[0]
    const petInvSlots = 4 + trio.reduce((s, c) => s + (PET_SLOT_BONUS[c] || 0), 0)
    const petUsable = (ci: Item) => !ci.classes?.length || ci.classes.some(c => trio.includes(c) || pet!.classes.includes(c))
    // The in-game pet inventory is N unlabeled boxes; the pet dresses itself —
    // highest AC per body slot, weapons only speed it up on a better dmg/dly
    // ratio. So we fill the boxes: best melee weapon(s) first (a 1H best gets a
    // dual-wield partner, a 2H doesn't), then the top AC picks across body
    // slots. Trio score breaks ties.
    type PetCand = { ci: Item; tier: number; src: string }
    type PetPick = PetCand & { slotLabel: string; badge: string }
    const meleeOk = (ci: Item) => ci.dmg > 0 && ci.dly > 0 && !['Archery', 'Throwing'].includes(ci.skill)
    const is2H = (s: string) => s.startsWith('2H')
    const buildLoadout = (cands: PetCand[], n: number): PetPick[] => {
      const ratio = (c: PetCand) => tierDmg(c.ci.dmg, c.tier) / c.ci.dly
      const sc = (c: PetCand) => score(c.ci, c.tier, w)
      const used = new Set<PetCand>()
      const picks: PetPick[] = []
      const wpnBadge = (c: PetCand) => tierDmg(c.ci.dmg, c.tier) + '/' + c.ci.dly
      const prim = cands.filter(c => meleeOk(c.ci) && c.ci.slots.includes('Primary'))
        .sort((a, b) => ratio(b) - ratio(a) || sc(b) - sc(a))[0]
      if (prim) { used.add(prim); picks.push({ ...prim, slotLabel: 'primary', badge: wpnBadge(prim) }) }
      if (prim && !is2H(prim.ci.skill)) {
        const sec = cands.filter(c => !used.has(c) && meleeOk(c.ci) && c.ci.slots.includes('Secondary') && !is2H(c.ci.skill))
          .sort((a, b) => ratio(b) - ratio(a) || sc(b) - sc(a))[0]
        if (sec) { used.add(sec); picks.push({ ...sec, slotLabel: 'secondary', badge: wpnBadge(sec) }) }
      }
      const armor: PetPick[] = []
      for (const [slot, cap] of PET_ARMOR_SLOTS) {
        cands.filter(c => !used.has(c) && c.ci.slots.includes(slot))
          .sort((a, b) => tierStat(b.ci.ac, b.tier) - tierStat(a.ci.ac, a.tier) || sc(b) - sc(a))
          .slice(0, cap)
          .forEach(c => { used.add(c); armor.push({ ...c, slotLabel: slot.toLowerCase(), badge: 'AC ' + tierStat(c.ci.ac, c.tier) }) })
      }
      armor.sort((a, b) => tierStat(b.ci.ac, b.tier) - tierStat(a.ci.ac, a.tier) || sc(b) - sc(a))
      return [...picks, ...armor].slice(0, n)
    }
    // spares only — never suggest gear you're wearing, nor anything you'd wear
    // yourself: per slot, the top owned picks up to what the slot holds
    // (2 for the paired slots; 2 for Any Slot, matching the inventory export)
    const reserved = new Set<InvEntry>()
    for (const slot of SLOT_TYPES) {
      const wRow = slot === 'Any Slot' ? gw : w
      pool
        .map(e => ({ e, ci: known(e) }))
        // skip entries already reserved by an earlier slot — one physical item
        // can only cover one of your slots (dual-wield pairs, ring pairs)
        .filter((x): x is { e: InvEntry; ci: Item } => !!x.ci && !reserved.has(x.e) && slotFits(x.ci, slot) && this.usable(x.ci) && wpnOk(x.ci))
        .sort((a, b) => rankScore(b.ci, b.e.tier, wRow, slot, trio) - rankScore(a.ci, a.e.tier, wRow, slot, trio))
        .slice(0, SLOT_CAP[slot] || 1)
        .filter(x => x.e.source !== 'equipped')
        .forEach(x => reserved.add(x.e))
    }
    const ownedLoadout = pet ? buildLoadout(
      pool.filter(e => e.source !== 'equipped' && !reserved.has(e))
        .map(e => ({ e, ci: known(e) })).filter((x): x is { e: InvEntry; ci: Item } => !!x.ci && petUsable(x.ci))
        .map(x => ({ ci: x.ci, tier: x.e.tier, src: x.e.source })), petInvSlots) : []
    const availLoadout = pet ? buildLoadout(
      st.catalog.filter(ci => petUsable(ci) && lvlOk(ci) && obtOk(ci)).map(ci => ({ ci, tier: 0, src: '' })), petInvSlots) : []

    const srcCount = (s: InvSource) => inv.filter(e => e.source === s).length
    const tab = st.tab === 'pets' && !pet ? 'slots' : st.tab
    const tabBtn = (on: boolean): CSSProperties => ({
      padding: '8px 14px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600,
      ...(on ? { color: 'var(--text)', borderBottom: '2px solid var(--accent)', marginBottom: -1 } : { color: 'var(--muted)' }),
    })
    const setTab = (tab: State['tab']) => () => this.set({ tab })
    const weightsHint = (Object.keys(st.weightOv).length ? 'custom · ' : (PRESETS.find(p => p.id === st.preset) || PRESETS[0]).label.toLowerCase() + ' · ') + (st.weightsOpen ? '▾' : '▸')

    return (
      <div className="eqlbis" data-theme={st.mode} onMouseOver={this.positionTip} style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)', color: 'var(--text)', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14 }}>

        {/* ---- header ---- */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
          <div style={{ width: 30, height: 30, border: '2px solid var(--accent)', borderRadius: 5, transform: 'rotate(45deg)', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 11, height: 11, borderRadius: 2, background: 'var(--accent)' }} />
          </div>
          <div>
            <div style={{ fontFamily: CINZEL, fontSize: 20, fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.1 }}>EQL BIS FINDER</div>
            <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted)' }}>EverQuest Legends · Best in Slot</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={monoMeta}>{st.catalogLoaded ? st.catalog.length + ' items in catalog' : 'loading catalog…'}</div>
          <button className="eq-theme" onClick={() => this.set({ mode: st.mode === 'dark' ? 'light' : 'dark' })} aria-label={st.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={st.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ width: 38, height: 38, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', cursor: 'pointer', fontSize: 16 }}>
            {st.mode === 'dark' ? '☀' : '☾'}
          </button>
          <button onClick={() => {
            try { navigator.clipboard.writeText(this.shareUrl()) } catch (e) {}
            this.setState({ copied: true })
            clearTimeout(this.copyTimer)
            this.copyTimer = setTimeout(() => this.setState({ copied: false }), 1600)
          }} title="Copy a link to this build (trio, level, weights, weapon types)"
            style={{ padding: '9px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--accentText)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {st.copied ? 'Copied!' : 'Share'}
          </button>
          <button className="eq-del" onClick={() => { this.invText = null; this.set({ trio: [], inv: null, invName: '', weightOv: {}, wpnOff: [], obtOff: DEFAULT_OBT_OFF, charLevel: 50, preset: 'balanced', goal: 'weights', tab: 'slots', wnonce: st.wnonce + 1 }) }}
            style={{ padding: '9px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>
            Reset
          </button>
        </header>

        <main style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '380px 1fr', gap: 18, padding: '18px 22px' }}>
          {/* ---- left column ---- */}
          <div className="eqs" style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', minHeight: 0, paddingRight: 2 }}>

            {/* Your Trio */}
            <section style={panel}>
              <div style={panelHead}>
                <div style={panelTitle}>Your Trio</div>
                <div style={{ flex: 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
                  Level
                  <input type="number" min={1} max={50} value={st.charLevel}
                    onChange={ev => { const v = parseInt(ev.target.value, 10); this.set({ charLevel: isNaN(v) ? 50 : Math.max(1, Math.min(50, v)) }) }}
                    style={{ ...numInput, width: 52, padding: '4px 7px' }} />
                </label>
                <div style={monoMeta}>{trio.length}/3</div>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[0, 1, 2].map(i => trio[i]
                    ? <button key={i} title="Remove" onClick={() => this.set({ trio: trio.filter((_, j) => j !== i) })}
                        style={{ flex: 1, padding: '9px 6px', borderRadius: 'var(--radius)', border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--accentText)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
                        {CLASSES.find(c => c.code === trio[i])!.name}
                      </button>
                    : <button key={i} title="Pick a class below"
                        style={{ flex: 1, padding: '9px 6px', borderRadius: 'var(--radius)', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 12.5, cursor: 'default' }}>
                        Class {i + 1}
                      </button>)}
                </div>
                {['Casters', 'Priests', 'Melee', 'Hybrids'].map(g => (
                  <div key={g}>
                    <div style={{ ...eyebrow, marginBottom: 6 }}>{g}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {CLASSES.filter(c => c.group === g).map(c => {
                        const active = trio.includes(c.code)
                        return (
                          <button key={c.code} style={active ? chipOn : chipOff}
                            onClick={() => this.set({ trio: active ? trio.filter(x => x !== c.code) : (trio.length < 3 ? [...trio, c.code] : trio) })}>
                            {c.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Inventory */}
            <section style={panel}>
              <div style={panelHead}>
                <div style={panelTitle}>Inventory</div>
                <div style={{ flex: 1 }} />
                <div style={monoMeta}>{st.inv ? inv.length + ' items · ' + st.invName : 'none loaded'}</div>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label className="eq-upl" style={{ display: 'block', textAlign: 'center', padding: '16px 12px', border: '1px dashed var(--accent)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--accent)', fontSize: 13 }}>
                  {st.inv ? 'Replace inventory file…' : 'Upload your Inventory.txt'}
                  <input type="file" accept=".txt,text/plain" style={{ display: 'none' }} onChange={ev => {
                    const f = ev.target.files && ev.target.files[0]
                    ev.target.value = ''
                    if (!f) return
                    f.text().then(text => { this.invText = text; this.set({ inv: parseInv(text), invName: f.name }) })
                  }} />
                </label>
                <button className="eq-upl" style={{ display: 'block', width: '100%', textAlign: 'center', padding: '8px 12px', border: '1px dashed var(--accent)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, background: 'none', font: 'inherit' }}
                  onClick={() => {
                    navigator.clipboard.readText().then(text => {
                      const parsed = parseInv(text)
                      if (!parsed.length) { alert('Clipboard doesn\'t look like an inventory file. In game, run /outputfile inventory, open the file, and copy its contents.'); return }
                      this.invText = text; this.set({ inv: parsed, invName: 'pasted from clipboard' })
                    }).catch(() => alert('Couldn\'t read the clipboard — your browser may have blocked access. Use the file upload instead.'))
                  }}>
                  Paste from clipboard
                </button>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                  Export in game with <span style={{ fontFamily: MONO, color: 'var(--text)' }}>/outputfile inventory</span>, then drop the <span style={{ fontFamily: MONO }}>*-Inventory.txt</span> here — or open the file in game, copy it all, and hit Paste.{' '}
                  <a href="#" onClick={ev => {
                    ev.preventDefault()
                    fetch('/Washclof_oggok-Inventory.txt').then(r => r.text()).then(text => {
                      this.invText = text; this.set({ inv: parseInv(text), invName: 'Washclof (example)' })
                    })
                  }}>Load example</a>
                </div>
                {st.inv && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <div style={eyebrow}>Search gear in</div>
                    {([['equipped', 'Equipped'], ['bags', 'Bags'], ['bank', 'Bank'], ['stash', 'Equipment stash'], ['hoard', "Dragon's Hoard"], ['depot', 'Tradeskill depot']] as [InvSource, string][]).map(([key, label]) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={st.sources[key]} style={{ accentColor: 'var(--accent)' }}
                          onChange={() => this.set({ sources: { ...st.sources, [key]: !st.sources[key] } })} />
                        <span>{label}</span>
                        <span style={{ flex: 1 }} />
                        <span style={monoMeta}>{srcCount(key)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Weapon Types */}
            <section style={panel}>
              <div style={panelHead}>
                <div style={panelTitle}>Weapon Types</div>
                <div style={{ flex: 1 }} />
                <div style={monoMeta}>{WPN_TYPES.length - st.wpnOff.length}/{WPN_TYPES.length}</div>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {WPN_TYPES.map(t => {
                    const on = !st.wpnOff.includes(t)
                    return (
                      <button key={t} style={on ? chipOn : chipOff}
                        onClick={() => this.set({ wpnOff: on ? [...st.wpnOff, t] : st.wpnOff.filter(x => x !== t) })}>
                        {t}
                      </button>
                    )
                  })}
                </div>
                <div style={caption}>Deselected types are excluded from recommendations (e.g. turn off 2-handers to keep a shield in Secondary).</div>
              </div>
            </section>

            {/* Obtained By */}
            <section style={panel}>
              <div style={panelHead}>
                <div style={panelTitle}>Obtained By</div>
                <div style={{ flex: 1 }} />
                <div style={monoMeta}>{OBTAIN.length - st.obtOff.length}/{OBTAIN.length}</div>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {OBTAIN.map(([id, label]) => {
                    const on = !st.obtOff.includes(id)
                    return (
                      <button key={id} style={on ? chipOn : chipOff}
                        onClick={() => this.set({ obtOff: on ? [...st.obtOff, id] : st.obtOff.filter(x => x !== id) })}>
                        {label}
                      </button>
                    )
                  })}
                </div>
                <div style={caption}>Deselected acquisition methods are excluded from recommendations (e.g. turn off Crafted and Vendor sold to see only farmable gear). Items obtainable several ways stay until all their methods are off.</div>
              </div>
            </section>

            {/* Any Slot Focus */}
            <section style={panel}>
              <div style={panelHead}>
                <div style={panelTitle}>Any Slot Focus</div>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {GOALS.map(g => (
                    <button key={g.id} style={st.goal === g.id ? chipOn : chipOff} onClick={() => this.set({ goal: g.id })}>{g.label}</button>
                  ))}
                </div>
                <div style={caption}>Any Slot takes any equippable item, so pick what to stack there — Stat Weights uses the same scoring as everywhere else.</div>
              </div>
            </section>

            {/* Stat Weights */}
            <section style={panel}>
              <button onClick={() => this.setState({ weightsOpen: !st.weightsOpen })}
                style={{ width: '100%', display: 'flex', alignItems: 'baseline', gap: 10, padding: '14px 16px', border: 'none', background: 'transparent', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
                <span style={panelTitle}>Stat Weights</span>
                <span style={{ flex: 1 }} />
                <span style={monoMeta}>{weightsHint}</span>
              </button>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 12px' }}>
                {PRESETS.map(p => (
                  <button key={p.id} style={st.preset === p.id ? chipOn : chipOff}
                    onClick={() => this.set({ preset: p.id, weightOv: {}, wnonce: st.wnonce + 1 })}>
                    {p.label}
                  </button>
                ))}
              </div>
              {st.weightsOpen && (
                <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', margin: '10px 0', lineHeight: 1.5 }}>
                    Presets bias the trio-derived weights toward a role (e.g. Melee downweights wis/int/mana even with a priest in the trio). Derived from your trio. Edit any weight to tune the ranking; HP/Mana are worth 0.2 per point (so 1 AC ≈ 5 HP at equal weights), resists 0.3, worn regen 30× a point of pool, worn haste 2.5 × the DPS weight per %.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
                    {KEYS.map(k => (
                      <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                        <span style={{ fontFamily: MONO, width: 42, color: STAT_COLORS[k] }}>{k}</span>
                        {/* uncontrolled + remount key so typing "1." isn't fought; trio/preset/reset changes remount with fresh defaults */}
                        <input key={`${k}:${trio.join('.')}:${st.preset}:${st.wnonce}`} type="number" step={0.1} defaultValue={r2(w[k])}
                          onChange={ev => { const v = parseFloat(ev.target.value); this.set({ weightOv: { ...st.weightOv, [k]: isNaN(v) ? 0 : v } }) }}
                          style={{ ...numInput, width: '100%', padding: '5px 8px' }} />
                      </label>
                    ))}
                  </div>
                  <button className="eq-ghost" onClick={() => this.set({ weightOv: {}, preset: 'balanced', wnonce: st.wnonce + 1 })}
                    style={{ marginTop: 10, padding: '7px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>
                    Reset to class defaults
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* ---- right panel ---- */}
          <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 18px 0', borderBottom: '1px solid var(--border)', flex: 'none' }}>
              <button style={tabBtn(tab === 'slots')} onClick={setTab('slots')}>By Slot</button>
              <button style={tabBtn(tab === 'upgrades')} onClick={setTab('upgrades')}>Upgrades ({upgrades.length})</button>
              <button style={tabBtn(tab === 'browse')} onClick={setTab('browse')}>Browse</button>
              <button style={tabBtn(tab === 'effects')} onClick={setTab('effects')}>Effects{st.inv ? ` (${effRows.length})` : ''}</button>
              {pet && <button style={tabBtn(tab === 'pets')} onClick={setTab('pets')}>Pet Gear</button>}
              <div style={{ flex: 1 }} />
              <div style={{ ...monoMeta, paddingBottom: 10 }}>{trio.length ? 'scored for ' + trio.join(' / ') : 'no trio picked — flat weights, all items shown'}</div>
            </div>

            {tab === 'slots' && (
              <div className="eqs" style={{ flex: 1, minHeight: 0, overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...slotGrid, padding: '9px 18px', background: 'var(--panel2)', borderBottom: '1px solid var(--border)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted)', flex: 'none' }}>
                  <div>Slot</div><div>Equipped</div><div>Best Owned</div><div>Best Available</div>
                </div>
                <div className="eqs" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {slotRows.map(r => (
                    <div key={r.slot} style={{ ...slotGrid, padding: '13px 18px', borderBottom: '1px solid var(--border)', alignItems: 'start' }}>
                      <div style={{ fontFamily: CINZEL, fontSize: 13, fontWeight: 600, paddingTop: 4 }}>{r.slot}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                        {r.eq.map((e, i) => this.unit(e, <>{e.name}{this.tierSpan(e.tier)}</>,
                          e.hasScore ? this.badge(e.scoreText, e.tip) : null,
                          e.ci && this.infoTip(e.ci, e.tier)))}
                        {r.eq.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 4 }}>{r.eqEmptyText}</div>}
                      </div>
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {r.ownedList.map((p, i) => (
                          <div key={i}>{this.unit(
                            this.dispItem(p.ci, p.e.tier, w, [p.isEq ? 'equipped' : p.e.source, ...(p.belowEq ? ['below equipped'] : [])], r.slot),
                            <>{p.e.base}{this.tierSpan(p.e.tier)}</>,
                            this.badge(fmt(score(p.ci, p.e.tier, w, r.slot)), this.tipFor(p.ci, p.e.tier, w, r.slot)),
                            this.infoTip(p.ci, p.e.tier))}</div>
                        ))}
                        {r.ownedList.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 4 }}>{r.noOwnedText}</div>}
                      </div>
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {r.availList.map((a, i) => (
                          <div key={i}>{this.unit(a, a.name, this.badge(a.deltaText, a.tip, { fontSize: 11.5, fontWeight: 600, color: a.deltaColor }), this.infoTip(a.ci))}</div>
                        ))}
                        {r.availList.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 4 }}>no catalog data</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'upgrades' && (
              <div className="eqs" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {upgrades.map((u, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: 14, padding: '13px 18px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                    <div style={{ fontFamily: CINZEL, fontSize: 13, fontWeight: 600 }}>{u.slot}</div>
                    {this.unit(u.item, u.item.name, null, this.infoTip(u.item.ci))}
                    {this.badge('+' + fmt(u.item.delta), u.item.tip, { fontSize: 13, fontWeight: 600, padding: '3px 9px', color: 'var(--good)' })}
                  </div>
                ))}
                {upgrades.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
                    <div style={{ width: 46, height: 46, border: '2px dashed var(--border)', borderRadius: 8, transform: 'rotate(45deg)', margin: '0 auto 22px' }} />
                    <div style={{ fontFamily: CINZEL, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>{st.inv ? 'No upgrades found' : 'No inventory loaded'}</div>
                    <div style={{ fontSize: 12.5, maxWidth: 340, margin: '0 auto', lineHeight: 1.5 }}>
                      {st.inv
                        ? 'Your equipped gear matches or beats everything in the catalog for your trio.'
                        : 'Upload an inventory file and the catalog items that beat your equipped gear will appear here, sorted by biggest gain.'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'browse' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
                  <label style={{ fontSize: 12, color: 'var(--muted)' }}>Slot</label>
                  <select value={st.browseSlot} onChange={ev => this.setState({ browseSlot: ev.target.value })}
                    style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}>
                    {browseSlots.map(bs => <option key={bs} value={bs}>{bs}</option>)}
                  </select>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>ranked for your trio · highest score first · + to compare</div>
                </div>
                {st.compare.length > 0 && (
                  <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--panel2)' }}>
                    <div style={eyebrow}>Comparing · set the +tier · Δ is vs your equipped in that slot</div>
                    {st.compare.map((c, i) => {
                      const ci = idx.get(c.name.toLowerCase())
                      if (!ci) return null
                      const eqSc = Math.max(0, ...inv.filter(e => e.source === 'equipped' && e.loc === c.slot).map(e => { const k = known(e); return k ? score(k, e.tier, w) : 0 }))
                      const diff = score(ci, c.tier, w, c.slot) - eqSc
                      const setC = (next: State['compare']) => this.setState({ compare: next })
                      return (
                        <div key={c.name} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, alignItems: 'center' }}>
                          {this.unit(this.dispItem(ci, c.tier, w, [], c.slot), c.name + (c.tier ? ' +' + c.tier : ''), this.badge(fmt(score(ci, c.tier, w, c.slot)), this.tipFor(ci, c.tier, w, c.slot), { fontSize: 12.5, fontWeight: 600 }), this.infoTip(ci, c.tier))}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button style={stepBtn} onClick={() => setC(st.compare.map((x, j) => j === i ? { ...x, tier: Math.max(0, x.tier - 1) } : x))}>−</button>
                            <span style={{ ...monoMeta, width: 24, textAlign: 'center' }}>+{c.tier}</span>
                            <button style={stepBtn} onClick={() => setC(st.compare.map((x, j) => j === i ? { ...x, tier: Math.min(10, x.tier + 1) } : x))}>+</button>
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: eqSc && diff > 0 ? 'var(--good)' : 'var(--muted)', minWidth: 48, textAlign: 'right' }}>
                            {eqSc ? (diff >= 0 ? '+' : '') + fmt(diff) : '—'}
                          </div>
                          <button style={stepBtn} title="Remove" onClick={() => setC(st.compare.filter((_, j) => j !== i))}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="eqs" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {browseRows.map(b => {
                    const inC = st.compare.some(x => x.name === b.name)
                    return (
                      <div key={b.name} style={{ display: 'grid', gridTemplateColumns: '34px 1fr auto auto auto', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                        <div style={monoMeta}>{b.rank}</div>
                        {this.unit(b, b.name, null, this.infoTip(b.ci))}
                        <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--accent)' }}>{b.ownedTag}</div>
                        {this.badge(b.scoreText, b.tip, { fontSize: 12.5, fontWeight: 600 })}
                        <button style={stepBtn} title={inC ? 'Remove from compare' : 'Add to compare'}
                          onClick={() => this.setState({ compare: inC ? st.compare.filter(x => x.name !== b.name) : [...st.compare, { name: b.name, tier: 0, slot: st.browseSlot }] })}>
                          {inC ? '✕' : '+'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            {tab === 'effects' && (
              <div className="eqs" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
                  <button style={st.effView === 'owned' ? chipOn : chipOff} onClick={() => this.setState({ effView: 'owned' })}>Your gear</button>
                  <button style={st.effView === 'all' ? chipOn : chipOff} onClick={() => this.setState({ effView: 'all' })}>All in game</button>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                    {st.effView === 'owned' ? 'effects on gear you own · focus rows flag when a higher tier is obtainable' : 'every effect obtainable by your trio, grouped by spell'}
                  </div>
                </div>
                <div className="eqs" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {st.effView === 'all' ? (['Clicky', 'Proc', 'Worn', 'Focus'] as const).map(kind => {
                  const groups = allEffGroups(kind)
                  if (!groups.length) return null
                  return (
                    <div key={kind}>
                      <div style={effSecHead}>{kind} · {groups.length} {kind === 'Focus' ? 'families' : 'spells'}</div>
                      {groups.map(([key, list]) => (
                        <div key={key} style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontFamily: CINZEL, fontSize: 13, fontWeight: 600 }}>{key}</div>
                          {(() => { const d = st.spellDesc[kind === 'Focus' ? list[0].text : key]; return d ? <div style={{ ...caption, marginTop: 2 }}>{d}</div> : null })()}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                            {list.map((r, i) => this.unit(
                              { ...this.tileFor(r.ci.type, r.ci.name, r.ci.icon || 0), chips: [
                                { txt: r.text, color: 'var(--accent)' },
                                { txt: srcLabel(r.ci), color: 'var(--muted)' },
                                ...(r.ci.level ? [{ txt: 'lvl ' + r.ci.level + '+', color: 'var(--muted)' }] : []),
                                ...(pool.some(e => e.base.toLowerCase() === r.ci.name.toLowerCase()) ? [{ txt: 'owned', color: 'var(--good)' }] : []),
                              ] },
                              r.ci.name, null, this.infoTip(r.ci)))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }) : (['Clicky', 'Proc', 'Worn', 'Focus'] as const).map(kind => {
                  const rows = effRows.filter(r => r.kind === kind)
                  if (!rows.length) return null
                  return (
                    <div key={kind}>
                      <div style={effSecHead}>{kind} · {rows.length}</div>
                      {rows.map((r, i) => {
                        // owned focus with a higher tier obtainable → upgrade note
                        const fam = r.kind === 'Focus' ? focusFam(r.text) : null
                        const ba = fam ? bestFocus.get(fam.fam) : undefined
                        const better = ba && fam && ba.tier > fam.tier ? ba : null
                        return (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) minmax(220px,1.3fr)', gap: 14, padding: '11px 18px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                            {this.unit(
                              { ...this.tileFor(r.ci.type, r.ci.name, r.ci.icon || 0), chips: [{ txt: (r.ci.slots || []).join(', ').toLowerCase() || r.ci.type.toLowerCase(), color: 'var(--muted)' }, { txt: r.e.source === 'equipped' ? 'equipped' : r.e.source, color: 'var(--muted)' }] },
                              <>{r.e.base}{this.tierSpan(r.e.tier)}</>,
                              null, this.infoTip(r.ci, r.e.tier))}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, color: 'var(--accent)' }}>{r.text}</div>
                              {st.spellDesc[r.kind === 'Focus' ? r.text : spellOf(r.text)] && (
                                <div style={{ ...caption, marginTop: 2 }}>{st.spellDesc[r.kind === 'Focus' ? r.text : spellOf(r.text)]}</div>
                              )}
                              {better && (
                                <div style={{ fontSize: 11.5, color: 'var(--good)', marginTop: 2 }}>
                                  ↑ {better.ci.focus} — {better.ci.name}
                                  {pool.some(e => e.base.toLowerCase() === better.ci.name.toLowerCase()) ? ' (owned)'
                                    : ' · ' + srcLabel(better.ci)}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
                {st.effView === 'owned' && effRows.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
                    <div style={{ width: 46, height: 46, border: '2px dashed var(--border)', borderRadius: 8, transform: 'rotate(45deg)', margin: '0 auto 22px' }} />
                    <div style={{ fontFamily: CINZEL, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>{st.inv ? 'No effects found' : 'No inventory loaded'}</div>
                    <div style={{ fontSize: 12.5, maxWidth: 340, margin: '0 auto', lineHeight: 1.5 }}>
                      {st.inv
                        ? 'None of your gear (in the checked sources, usable by your trio) has a click, worn, proc, or focus effect.'
                        : 'Upload an inventory file to see every click, worn, proc, and focus effect on gear you own — or hit All in game to browse the catalog.'}
                    </div>
                  </div>
                )}
                </div>
              </div>
            )}
            {tab === 'pets' && pet && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 18px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {petOptions.map(p => (
                      <button key={p.id} title={p.classes.join('/')} style={p.id === pet.id ? chipOn : chipOff}
                        onClick={() => this.set({ petSel: p.id })}>
                        {p.label}
                      </button>
                    ))}
                    <div style={{ flex: 1 }} />
                    <div style={monoMeta}>{petInvSlots} pet inventory slots</div>
                  </div>
                  <div style={caption}>
                    {pet.label} is {pet.classes.join('/')}, so it can wear anything usable by your trio or those classes. The pet inventory is {petInvSlots} open boxes — the pet dresses itself, wearing the highest-AC item per body slot and only adopting a weapon's damage/delay when its ratio beats its innate one. Below is the best way to fill those boxes: weapons first, then top AC picks. Spares only — gear you're wearing, or that Best Owned says you should wear, isn't suggested.
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(200px,1fr) minmax(220px,1.15fr)', gap: 14, padding: '9px 18px', background: 'var(--panel2)', borderBottom: '1px solid var(--border)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted)', flex: 'none' }}>
                  <div>Box</div><div>Give From Your Spares</div><div>Best Available</div>
                </div>
                <div className="eqs" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {Array.from({ length: petInvSlots }, (_, i) => {
                    const o = ownedLoadout[i], a = availLoadout[i]
                    const petUnit = (p: PetPick, tag: string) => this.unit(
                      { ...this.tileFor(p.ci.type, p.ci.name, p.ci.icon || 0), chips: [...this.chipsFor(p.ci, p.tier), { txt: p.slotLabel, color: 'var(--muted)' }, ...(tag ? [{ txt: tag, color: 'var(--muted)' }] : [])] },
                      <>{p.ci.name}{this.tierSpan(p.tier)}</>,
                      this.badge(p.badge, [], { fontWeight: 600 }),
                      this.infoTip(p.ci, p.tier))
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '34px minmax(200px,1fr) minmax(220px,1.15fr)', gap: 14, padding: '13px 18px', borderBottom: '1px solid var(--border)', alignItems: 'start' }}>
                        <div style={{ ...monoMeta, paddingTop: 6 }}>{i + 1}</div>
                        <div style={{ minWidth: 0 }}>
                          {o ? petUnit(o, o.src)
                            : <div style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 4 }}>{st.inv ? '— empty box —' : 'upload inventory'}</div>}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          {a ? petUnit(a, [srcLabel(a.ci), ...(a.ci.level ? ['lvl ' + a.ci.level + '+'] : []), ...(pool.some(e => e.base.toLowerCase() === a.ci.name.toLowerCase()) ? ['owned'] : [])].join(' · '))
                            : <div style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 4 }}>no catalog data</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </main>

        {/* ---- footer ---- */}
        <footer style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: '11px 22px', borderTop: '1px solid var(--border)', flex: 'none' }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>© 2026 EQL BiS Finder</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', flex: 1, minWidth: 240 }}>EverQuest is a registered trademark of Daybreak Game Company LLC. EQL BiS is an unofficial fan project, not affiliated with or endorsed by Daybreak.</div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>More projects</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['https://eqlfilter.com', 'EQL Filter'], ['https://eqnta.com', 'EQNTA']].map(([href, label]) => (
              <a key={href} href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 20, background: 'var(--panel)', fontSize: 11.5, color: 'var(--text)', textDecoration: 'none' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />{label}
              </a>
            ))}
          </div>
        </footer>
      </div>
    )
  }
}
