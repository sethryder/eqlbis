#!/usr/bin/env node
// fetch-spell-descriptions.mjs
// Builds public/eql-spell-desc.json: spell name -> one-line description, for
// every spell referenced by an item effect/focus in eql-bis-items.json.
// Descriptions come from the wiki's {{Spellpage}} template (same MediaWiki API
// as build-eql-bis-items.mjs), batched 50 titles per request with redirects.
//
// Run:  node tools/fetch-spell-descriptions.mjs   (writes the json in place)
// Needs: Node 18+. No npm install.

import { readFileSync, writeFileSync } from "fs";

const API = "https://eqlwiki.com/api.php";
const UA = "EQLBiS-spell-builder/1.0 (eqlbis)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wiki descriptions mix HTML into the wikitext: cut at the first block break
// (<br>, <table>, <p>) — everything after is wiki commentary, not the spell
// description — then drop <s>struck-out</s> text, bare [http://…] citations,
// and any stray inline tags.
const cleanDesc = (raw) =>
  raw
    .split(/<\s*(?:br|table|p)\b/i)[0]
    .replace(/<s\s*>[\s\S]*?<\/s\s*>/gi, "")
    .replace(/\[https?:\/\/[^\]]*\]/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1") // [[link|text]] -> text
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .trim();

const items = JSON.parse(readFileSync(new URL("../public/eql-bis-items.json", import.meta.url)));
const names = new Set();
for (const i of items) {
  if (i.effect) {
    // "Ykesha (Combat, Casting Time: Instant) at Level 37" -> "Ykesha"
    const n = i.effect.replace(/\s*\(.*/, "").trim();
    if (n) names.add(n);
  }
  if (i.focus) names.add(i.focus.trim());
}
const titles = [...names].sort();
console.error(`${titles.length} distinct spell/focus names`);

const out = {};
for (let i = 0; i < titles.length; i += 50) {
  const batch = titles.slice(i, i + 50);
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", redirects: "1",
    prop: "revisions", rvprop: "content", rvslots: "main", titles: batch.join("|"),
  }).toString();
  let data;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) { data = await res.json(); break; }
    if (attempt >= 4) throw new Error("API failed: " + res.status);
    await sleep(500 * (attempt + 1));
  }
  // map redirected titles back to the name the catalog uses
  const back = new Map();
  for (const r of data?.query?.redirects ?? []) back.set(r.to, r.from);
  for (const p of data?.query?.pages ?? []) {
    if (p.missing) continue;
    const text = p.revisions?.[0]?.slots?.main?.content ?? "";
    const m = text.match(/\|\s*description\s*=\s*([\s\S]*?)\n\s*\|/);
    if (!m) continue;
    const desc = cleanDesc(m[1]);
    if (desc) out[back.get(p.title) ?? p.title] = desc;
  }
  console.error(`${Math.min(i + 50, titles.length)}/${titles.length} fetched, ${Object.keys(out).length} descriptions`);
  await sleep(300);
}

writeFileSync(new URL("../public/eql-spell-desc.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.error(`wrote public/eql-spell-desc.json (${Object.keys(out).length} spells)`);
