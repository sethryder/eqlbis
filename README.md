# EQL BiS Finder

Best in Slot planner for [EverQuest Legends](https://eqlwiki.com). Upload your
in-game inventory dump, pick your trio of classes, and for every equipment slot
see three things: what you're currently wearing, the best item you already own,
and the best item obtainable in the game (with the zones it drops in).

Scoring uses per-class stat weight tables with Balanced/Melee/Caster/Tank
presets, all tweakable in the UI.

## Running it

```
npm install
npm run dev
```

Then open the printed URL and drag in an inventory file. You can get one
in-game with `/outputfile inventory` (a sample lives in `public/`).

Other scripts:

```
npm run build       # production build to dist/
npm run typecheck
npm test            # runs src/logic.test.ts under plain node
```

## Item data

`public/eql-bis-items.json` is the item catalog, scraped from the EQL wiki's
MediaWiki API:

```
npm run items:scrape   # rebuilds the catalog (slow, hits the wiki politely)
npm run icons:fetch    # downloads item icons into public/icons/item/
npm run spells:fetch   # rebuilds public/eql-spell-desc.json (effect descriptions)
```

Both tools are plain Node 18+ scripts, no extra dependencies. If the wiki's
item template changes, see the parsing notes at the top of
`tools/build-eql-bis-items.mjs`.

## Layout

- `src/logic.ts` holds all the data and scoring math, DOM-free so the test can
  run under plain node. `src/App.tsx` is the entire UI.
- `tools/` has the scrape and icon-fetch scripts.
- Stat weights in `logic.ts` are designer defaults, not community-tuned yet.
