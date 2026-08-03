#!/usr/bin/env node
// Downloads per-item icons from the EQL wiki (Item_<id>.png). The wiki images
// are authoritative for EQ Legends' custom art — the bundled dragitem*.png
// sheets are classic-era and stale for the ids EQL added or replaced (e.g.
// 2877 is a custom bow in EQL but a pink orb on the old sheets).
//
// Run:  node tools/fetch-icons.mjs        (after a catalog scrape)
// Reads public/eql-bis-items.json; writes public/icons/item/<id>.png and
// public/icons/item/manifest.json (ids that downloaded OK — the app uses the
// sheet fallback for the rest). Resumable: existing files are skipped.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const UA = "EQLBiS-icon-fetch/1.0 (eqlbis)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const items = JSON.parse(readFileSync("public/eql-bis-items.json", "utf8"));
const ids = [...new Set(items.map((i) => i.icon).filter((i) => i >= 500))].sort((a, b) => a - b);
mkdirSync("public/icons/item", { recursive: true });

const manifest = [];
let missing = 0;
for (let k = 0; k < ids.length; k++) {
  const id = ids[k];
  const dest = `public/icons/item/${id}.png`;
  if (existsSync(dest)) { manifest.push(id); continue; }
  // MediaWiki hashed upload path: /images/<h1>/<h1h2>/<filename>
  const name = `Item_${id}.png`;
  const h = createHash("md5").update(name).digest("hex");
  try {
    const res = await fetch(`https://eqlwiki.com/images/${h[0]}/${h.slice(0, 2)}/${name}`, { headers: { "User-Agent": UA } });
    if (res.ok) { writeFileSync(dest, Buffer.from(await res.arrayBuffer())); manifest.push(id); }
    else missing++;
  } catch (e) { missing++; }
  if (k % 25 === 0) process.stderr.write(`  ${k}/${ids.length}\r`);
  await sleep(120); // ~8 req/s, same politeness as the scraper
}
writeFileSync("public/icons/item/manifest.json", JSON.stringify(manifest));
process.stderr.write(`\n${manifest.length} icons fetched, ${missing} missing (app falls back to sheets)\n`);
