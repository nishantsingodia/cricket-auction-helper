#!/usr/bin/env node
// One-shot: replicate the LOCAL WCPL 2026 auction onto the deployed (Turso) board.
//
// WHY THIS EXISTS: the WCPL board was built and run locally under
// ALLOW_LOCAL_AUCTION_CREATE=1 while `turso auth login` was outstanding, so 20 sales live only in
// db/cricket-auction.db. Turso is master for auction state and local auction ids collide with
// cloud-minted ones, so the local auction cannot be synced up — it has to be REPLAYED through the
// API, which is what this does.
//
// RUN ORDER (this script is step 3):
//   1. turso auth login
//   2. npm run go-live          # sync reference data (incl. the 550 new WCPL rows + 12 new
//                               # players) and deploy the WCPL code, WITHOUT which /api/pool/fetch
//                               # 400s on the live site and every WI local prices at baseline
//   3. node scripts/replicate-wcpl-to-cloud.mjs
//
// It is ADDITIVE and touches nothing that already exists in the cloud: it creates ONE new auction,
// builds its pool, and replays 20 sales into it. No other auction is read or written.
// DRY_RUN=1 prints the plan and stops before the first write.

import fs from "node:fs";

const BASE = process.env.BOARD_URL ?? "https://cricket-auction-helper.vercel.app";
const SALES = JSON.parse(fs.readFileSync(new URL("./wcpl-sales.json", import.meta.url), "utf8"));
const DRY = process.env.DRY_RUN === "1";

// Player ids are STABLE across local and cloud: `players` is local-mastered, so turso:sync carries
// the same rows (including the 12 uncapped locals the builder created) up under the same ids.
// Participant ids are NOT — the cloud auction mints its own — so buyers are mapped by name.
const FRIENDS = [
  { name: "Pradeep", shortName: "PRA", isMe: false },
  { name: "Mihir",   shortName: "MIH", isMe: false },
  { name: "Pushap",  shortName: "PUS", isMe: false },
  { name: "Sharan",  shortName: "SHA", isMe: false },
  { name: "Arif",    shortName: "ARI", isMe: false },
  { name: "Nishant", shortName: "NIS", isMe: true },
];

async function api(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const spend = {};
for (const s of SALES) spend[s.buyer] = (spend[s.buyer] ?? 0) + s.price;
console.log(`Replicating ${SALES.length} sales (${SALES.reduce((a, s) => a + s.price, 0)} spent) to ${BASE}`);
for (const [k, v] of Object.entries(spend)) console.log(`  ${k.padEnd(8)} spends ${v}, left ${90 - v}`);
if (DRY) { console.log("\nDRY_RUN=1 — stopping before any write."); process.exit(0); }

const { auctionId } = await api("/api/auctions", {
  name: "WCPL 2026",
  numFriends: 6, pursePerFriend: 90, playersPerFriend: 9,
  numCaptains: 1, numViceCaptains: 1, changesAllowed: 2,
  tournamentName: "WCPL 2026", matchFormat: "T20",
  friends: FRIENDS,
});
console.log(`\ncloud auctionId = ${auctionId}`);

const built = await api("/api/pool/fetch", { auctionId });
console.log(`pool: ${built.players} players / ${built.teams} teams, ${built.matched} matched, ${built.created} created`);
if (built.created > 12) {
  console.error(`⛔ ${built.created} players created, expected 12. The cloud is missing reference data — run npm run go-live first. Aborting BEFORE any sale.`);
  process.exit(1);
}

const res = await fetch(`${BASE}/api/auction/${auctionId}`);
const detail = await res.json();
const partId = Object.fromEntries((detail.participants ?? []).map((p) => [p.name, p.id]));
const missing = [...new Set(SALES.map((s) => s.buyer))].filter((n) => !partId[n]);
if (missing.length) { console.error(`⛔ participants not found: ${missing.join(", ")}`); process.exit(1); }

// Replayed in the original sold_at order so undo history reads the same way it did locally.
let done = 0;
for (const s of SALES) {
  await api("/api/auction/sell", {
    auctionId, playerId: s.player_id, participantId: partId[s.buyer], price: s.price,
  });
  done++;
  console.log(`  ${String(done).padStart(2)}/${SALES.length}  ${s.player} ${s.price} -> ${s.buyer}`);
}

console.log(`\n✅ ${BASE}/auction/${auctionId}`);
console.log("Verify purses read: Pradeep 35 · Mihir 41 · Pushap 32 · Sharan 43 · Arif 12 · Nishant 8");
