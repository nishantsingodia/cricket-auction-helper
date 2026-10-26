import { NextRequest, NextResponse } from "next/server";
import { sqlite, withTransaction } from "@/db";
import { SEARCH_ALIASES } from "@/lib/squads/womens-t20-wc-2026";
import { WBBL_NAME_ALIASES } from "@/lib/squads/wbbl-2026";

/**
 * POST /api/auction/quick-sell
 * Chat-style quick sell — supports single or bulk entries.
 *
 * Body: { auctionId: number, message: string }
 *
 * Formats supported:
 *   Single:  "Nishant | Virat Kohli 25"
 *   Single:  "Nishant | Virat Kohli & 25"
 *   Bulk:    "Pradeep | Abhishek Sharma 45 Travis Head 36 Arshdeep Singh 18"
 *   Bulk:    "Pradeep | Abhishek Sharma 45, Travis Head 36, Arshdeep Singh 18"
 *   Table:   a pasted sheet — friend on the first line, then one "Sr. No  Player  Price" row per
 *            player (header row + serial numbers are ignored):
 *              Mihir
 *              Sr. No	Player	Price
 *              1	Alice Capsey	16
 *              2	Tahlia Wilson	8
 *
 * Logic: after the "|", split into (playerName, price) pairs by finding
 * numbers. Each number ends a player entry. Text before that number is the name.
 *
 * If player already sold → undo first, then re-sell.
 */

interface PoolPlayer {
  pool_id: number;
  player_id: number;
  name: string;
  status: string;
  sold_to_participant: number | null;
  sold_price: number | null;
  ipl_team: string;
  searchName?: string; // lowercased name + any alias terms, used for matching
}

// Lowercased searchable text for a player: their name plus any alias terms
// (e.g. "ac jayangani" -> also matches "chamari athapaththu").
// WBBL pool rows carry cricsheet initials ("LCN Smith", "M Hinkley"); index each one under its
// announced name too. Without this, "Linsey Smith" matched LG Smith (Lauren) — the surname pass
// lets an initial stand in for the first name, and "LG" starts with L.
const WBBL_SEARCH: Record<string, string> = Object.fromEntries(
  Object.entries(WBBL_NAME_ALIASES).map(([announced, db]) => [db.toLowerCase(), announced])
);

function searchTextFor(name: string): string {
  const lower = name.toLowerCase();
  const extra = [
    SEARCH_ALIASES[lower.replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()],
    WBBL_SEARCH[lower],
  ].filter(Boolean);
  return extra.length ? `${lower} ${extra.join(" ")}` : lower;
}

interface Participant {
  id: number;
  name: string;
  short_name: string;
  remaining_purse: number;
}

/** Edit distance ≤ 1 (bounded, fast) — for 1-char typos like Butler/Buttler. */
function within1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; }
    else {
      if (++edits > 1) return false;
      if (la > lb) i++;
      else if (lb > la) j++;
      else { i++; j++; }
    }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

function toks(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

/** Query word vs name token: exact, substring (≥4 chars), or 1-char typo (≥4 chars). */
function tokenMatch(w: string, t: string): boolean {
  if (w === t) return true;
  if (w.length >= 4 && (t.includes(w) || w.includes(t))) return true;
  if (w.length >= 4 && t.length >= 4 && within1(w, t)) return true;
  return false;
}

/**
 * Match a typed query to a pool player. SURNAME-ANCHORED: a fuzzy match requires
 * the query's last word to actually match a player's surname (exact / substring /
 * 1-char typo). We NEVER match on a shared first initial alone — that was the bug
 * that mapped "Ferreira" → "F du Plessis" (both start with F). When the input is
 * ambiguous we return the candidates instead of silently guessing, so the caller
 * can ask the user to be specific rather than sell the wrong player.
 */
function fuzzyMatchPlayer(
  query: string,
  poolPlayers: PoolPlayer[]
): { player: PoolPlayer | null; candidates?: PoolPlayer[] } {
  const q = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!q) return { player: null };
  const words = toks(q);
  const sn = (p: PoolPlayer) => p.searchName ?? p.name.toLowerCase();

  // 1. Exact (name or alias-augmented search text)
  const exact = poolPlayers.filter((p) => sn(p) === q);
  if (exact.length) return { player: exact[0] };

  // 2. Whole query is a substring of exactly one name (≥3 chars avoids 1-2 char noise).
  //    More than one → ambiguous, surface the candidates.
  if (q.length >= 3) {
    const subs = poolPlayers.filter((p) => sn(p).includes(q));
    if (subs.length === 1) return { player: subs[0] };
    if (subs.length > 1) return { player: null, candidates: subs };
  }

  // 3. Surname-anchored: the query's last word must match a player's surname.
  const qSurname = words[words.length - 1];
  const bySurname = poolPlayers.filter((p) => {
    const psn = toks(sn(p)).slice(-1)[0] || "";
    return qSurname.length >= 3 && psn.length >= 3 && tokenMatch(qSurname, psn);
  });
  if (bySurname.length === 1) return { player: bySurname[0] };
  if (bySurname.length > 1) {
    // Disambiguate by first query word vs first name token (full name, or an
    // initial — allowed here ONLY because the surname already agrees).
    const qFirst = words[0];
    const byFirst = bySurname.filter((p) => {
      const pf = toks(sn(p))[0] || "";
      return pf === qFirst || tokenMatch(qFirst, pf) || (pf.length <= 2 && pf[0] === qFirst[0]);
    });
    if (byFirst.length === 1) return { player: byFirst[0] };
    return { player: null, candidates: bySurname };
  }

  // 4. Last resort: a single word that uniquely equals a player's FIRST name
  //    token (e.g. "Connor" → "Connor Esterhuizen"). Never initial-only.
  if (words.length === 1 && q.length >= 3) {
    const byFirstName = poolPlayers.filter((p) => {
      const pf = toks(sn(p))[0] || "";
      return pf.length >= 3 && tokenMatch(q, pf);
    });
    if (byFirstName.length === 1) return { player: byFirstName[0] };
  }

  return { player: null };
}

/**
 * Parse the part after "|" into [{name, price}] pairs.
 * Strategy: find all numbers (int or decimal) — each number is a price.
 * The text BEFORE each number (back to the previous number or start) is the player name.
 *
 * "Abhishek Sharma 45 Travis Head 36 Arshdeep Singh 18"
 *  → [{name: "Abhishek Sharma", price: 45}, {name: "Travis Head", price: 36}, ...]
 *
 * Also handles: commas, tabs, &, newlines as separators.
 */
function parsePlayerEntries(
  text: string
): { name: string; price: number }[] {
  // Clean up separators
  const cleaned = text
    .replace(/&/g, " ")
    .replace(/,/g, " ")
    .replace(/\t/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const entries: { name: string; price: number }[] = [];

  // Find all numbers with their positions
  const numberPattern = /(\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  let lastEnd = 0;

  while ((match = numberPattern.exec(cleaned)) !== null) {
    const price = parseFloat(match[1]);
    const namePart = cleaned.substring(lastEnd, match.index).trim();
    lastEnd = match.index + match[0].length;

    if (namePart && price > 0) {
      entries.push({ name: namePart, price });
    }
  }

  return entries;
}

// Column-header words in a pasted sheet. Matched as whole tokens, case-insensitive.
const HEADER_WORDS = new Set([
  "sr", "sr.", "s.no", "s.no.", "sno", "no", "no.", "#", "player", "players", "name",
  "price", "points", "pts", "amount", "cost", "bid",
]);
const isNum = (t: string) => /^\d+(?:\.\d+)?[.)]?$/.test(t);

/**
 * Table format (no "|") — a pasted sheet:
 *     Mihir
 *     Sr. No  Player  Price  Points
 *     1  Alice Capsey  16
 * The app's input is ONE line, so a paste arrives with its line breaks flattened into spaces —
 * the parser therefore never relies on line structure. Tokens are read left to right:
 *   - the friend is everything before the header row (or the first line / first word if no header)
 *   - header words are dropped
 *   - after each player name, the FIRST number is the price; any further numbers before the next
 *     name (a Points value, the next row's serial) are ignored. A serial BEFORE a name is ignored
 *     too, so a serial can never be read as a price.
 */
function parseTable(message: string): { friend: string; entries: { name: string; price: number }[] } | null {
  const raw = message.replace(/\r/g, "");
  const flat = raw.replace(/\s+/g, " ").trim();
  const tokens = flat.split(" ");
  const firstHeader = tokens.findIndex((t) => HEADER_WORDS.has(t.toLowerCase()));

  let friend: string;
  let body: string[];
  if (firstHeader > 0) {
    friend = tokens.slice(0, firstHeader).join(" ");
    body = tokens.slice(firstHeader);
  } else if (raw.includes("\n")) {
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    friend = lines[0].replace(/\s+/g, " ");
    body = lines.slice(1).join(" ").replace(/\s+/g, " ").trim().split(" ");
  } else {
    friend = tokens[0];
    body = tokens.slice(1);
  }
  body = body.filter((t) => t && !HEADER_WORDS.has(t.toLowerCase()));

  const entries: { name: string; price: number }[] = [];
  let name: string[] = [];
  let priced = true; // true until a name has been read and is waiting for its price
  for (const t of body) {
    if (isNum(t)) {
      if (!priced && name.length) {
        const price = parseFloat(t);
        if (price > 0) entries.push({ name: name.join(" "), price });
        priced = true;
        name = [];
      }
      // else: a serial number or a Points value — ignore
    } else {
      if (priced) { name = []; priced = false; }
      name.push(t);
    }
  }
  return friend && entries.length ? { friend, entries } : null;
}

export async function POST(req: NextRequest) {
  try {
    const { auctionId, message } = await req.json();

    if (!auctionId || !message) {
      return NextResponse.json(
        { error: "auctionId and message are required" },
        { status: 400 }
      );
    }

    // Parse: "Friend | entries..." — or, with no "|", a pasted table (friend on line 1).
    const pipeIndex = message.indexOf("|");
    const table = pipeIndex === -1 ? parseTable(message) : null;
    if (pipeIndex === -1 && !table) {
      return NextResponse.json(
        { error: 'Use: Friend | Player Price Player Price ...  (or paste a sheet: friend name, then Sr. No / Player / Price rows)' },
        { status: 400 }
      );
    }

    const friendPart = table ? table.friend : message.substring(0, pipeIndex).trim();
    const rest = table ? "" : message.substring(pipeIndex + 1).trim();

    // Parse entries
    const entries = table ? table.entries : parsePlayerEntries(rest);
    if (entries.length === 0) {
      return NextResponse.json(
        {
          error: `Could not parse any "Player Price" pairs from: "${rest}"\nFormat: Friend | Player1 Price1 Player2 Price2 ...`,
        },
        { status: 400 }
      );
    }

    // Match friend
    const participants = await sqlite
      .prepare(
        "SELECT id, name, short_name, remaining_purse FROM auction_participants WHERE auction_id = ?"
      )
      .all(auctionId) as Participant[];

    const friend = participants.find(
      (p) =>
        p.name.toLowerCase() === friendPart.toLowerCase() ||
        p.short_name.toLowerCase() === friendPart.toLowerCase() ||
        p.name.toLowerCase().startsWith(friendPart.toLowerCase()) ||
        friendPart.toLowerCase().startsWith(p.name.toLowerCase())
    );

    if (!friend) {
      return NextResponse.json(
        {
          error: `Friend "${friendPart}" not found. Available: ${participants.map((p) => p.name).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Load pool
    const poolPlayers = await sqlite
      .prepare(
        `SELECT ap.id as pool_id, ap.player_id, p.name, ap.status, ap.sold_to_participant, ap.sold_price, ap.ipl_team
         FROM auction_pool ap
         JOIN players p ON ap.player_id = p.id
         WHERE ap.auction_id = ?`
      )
      .all(auctionId) as PoolPlayer[];

    // Precompute alias-augmented search text per player
    for (const p of poolPlayers) p.searchName = searchTextFor(p.name);

    // Process each entry
    const results: string[] = [];
    const errors: string[] = [];
    const now = new Date().toISOString();

    for (const entry of entries) {
      const { player, candidates } = fuzzyMatchPlayer(entry.name, poolPlayers);

      if (!player) {
        if (candidates && candidates.length) {
          errors.push(
            `"${entry.name}" is ambiguous — did you mean: ${candidates
              .slice(0, 4)
              .map((c) => c.name)
              .join(", ")}? (type the surname or full name)`
          );
        } else {
          errors.push(`"${entry.name}" not found`);
        }
        continue;
      }

      // One entry = one atomic unit: the optional refund/un-sell of a previous owner PLUS the new
      // sale and its purse debit. Against Turso each statement is a separate network round-trip, so
      // without this a drop mid-entry could refund the old owner without re-selling, or debit the
      // new owner without recording the sale. Per-entry (not per-batch) so the existing
      // results/errors-per-entry reporting still holds: earlier entries stay committed.
      const prevFriend =
        player.status === "SOLD" && player.sold_to_participant
          ? participants.find((p) => p.id === player.sold_to_participant)
          : undefined;
      const undonePrice = player.status === "SOLD" ? player.sold_price : null;

      await withTransaction(async (tx) => {
        // Undo if already sold
        if (player.status === "SOLD" && player.sold_to_participant) {
          if (player.sold_price) {
            await tx
              .prepare(
                "UPDATE auction_participants SET remaining_purse = remaining_purse + ? WHERE id = ?"
              )
              .run(player.sold_price, player.sold_to_participant);
          }
          await tx
            .prepare(
              `UPDATE auction_pool
               SET status = 'AVAILABLE', sold_to_participant = NULL, sold_price = NULL, sold_at = NULL
               WHERE auction_id = ? AND player_id = ?`
            )
            .run(auctionId, player.player_id);
        }

        // Sell
        await tx
          .prepare(
            `UPDATE auction_pool
             SET status = 'SOLD', sold_to_participant = ?, sold_price = ?, sold_at = ?
             WHERE auction_id = ? AND player_id = ?`
          )
          .run(friend.id, entry.price, now, auctionId, player.player_id);

        await tx
          .prepare(
            "UPDATE auction_participants SET remaining_purse = remaining_purse - ? WHERE id = ?"
          )
          .run(entry.price, friend.id);
      });

      // Reported only after the write actually committed.
      if (prevFriend !== undefined || undonePrice !== null) {
        results.push(`(undid ${prevFriend?.name || "?"} @ ${undonePrice})`);
      }

      // Update local state so next iteration sees correct status
      player.status = "SOLD";
      player.sold_to_participant = friend.id;
      player.sold_price = entry.price;

      results.push(
        `${player.name} (${player.ipl_team}) → ${entry.price} Cr`
      );
    }

    // Get updated purse
    const updatedFriend = await sqlite
      .prepare("SELECT remaining_purse FROM auction_participants WHERE id = ?")
      .get(friend.id) as { remaining_purse: number };

    const summary = [
      `${friend.name}: ${results.length} sold`,
      ...results,
      ...(errors.length > 0 ? [`Errors: ${errors.join(", ")}`] : []),
      `Purse left: ${updatedFriend.remaining_purse.toFixed(1)} Cr`,
    ].join("\n");

    return NextResponse.json({
      success: errors.length === 0,
      summary,
      details: {
        buyer: friend.name,
        sold: results.length,
        errors: errors.length,
        remainingPurse: updatedFriend.remaining_purse,
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
