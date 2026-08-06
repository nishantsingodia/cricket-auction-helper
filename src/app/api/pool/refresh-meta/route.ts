import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";
import { CPL_2026_NAME, cplAvailability } from "@/lib/squads/cpl-2026";
import { resolveCplSquads } from "@/lib/squads/build-cpl-pool";

// POST /api/pool/refresh-meta  { auctionId }
//
// Re-syncs the DESCRIPTIVE metadata on an already-built pool: `risk_note` (the availability /
// scenario text from the squad file) and `availability` (FIT / DOUBTFUL / INJURED).
//
// WHY THIS EXISTS: the pool builder writes notes and availability at INSERT time, via
// INSERT OR IGNORE. So a pool built before a squad-file edit keeps the OLD text forever, and a
// player added to the squad file later never appears at all. That is exactly what happened with
// CPL 2026 — an auction created on 5 Aug showed no note for Mohammad Nabi and every row reading
// FIT, because the notes and the phased-availability work landed afterwards. Rebuilding the pool is
// NOT an option on a live auction (it would wipe sold rows while purses stay debited), so this route
// updates in place instead.
//
// SAFETY — this touches metadata only:
//   * NEVER writes sold_price, status, val_expected/efppm, squad_number or participant purses.
//   * Missing squad players are added with INSERT OR IGNORE (additive, the `teamsFilter` pattern).
//   * The squad file is the SOURCE OF TRUTH for these notes, so by default a stale note is replaced
//     and the old text is REPORTED back (never silently dropped). That is deliberate: an early
//     attempt only replaced notes prefixed "AVAILABILITY:", which left 23 rows showing my own
//     pre-prefix text — stale availability wording on the board is worse than the small chance of
//     overwriting something hand-typed. Pass `preserveManual: true` to skip anything that does not
//     look machine-written.
//   * `availability` is only raised from FIT/null — a manually set INJURED/UNAVAILABLE is kept.
export async function POST(request: NextRequest) {
  try {
    const { auctionId, preserveManual } = (await request.json()) as {
      auctionId?: number;
      preserveManual?: boolean;
    };
    if (!auctionId) {
      return NextResponse.json({ error: "auctionId required" }, { status: 400 });
    }

    const auction = sqlite
      .prepare(`SELECT id, tournament_id, tournament_name FROM auctions WHERE id = ?`)
      .get(auctionId) as
      | { id: number; tournament_id: number | null; tournament_name: string }
      | undefined;
    if (!auction) return NextResponse.json({ error: "auction not found" }, { status: 404 });
    if (auction.tournament_name !== CPL_2026_NAME) {
      return NextResponse.json(
        { error: `refresh-meta currently supports ${CPL_2026_NAME} only` },
        { status: 400 }
      );
    }
    if (!auction.tournament_id) {
      return NextResponse.json({ error: "auction has no pool yet — fetch the pool first" }, { status: 400 });
    }

    // squad entry -> player_id, resolved exactly as the builder does
    const resolved = resolveCplSquads(sqlite);
    const noteByPlayerId = new Map<number, string>();
    for (const r of resolved) {
      if (r.playerId !== null) noteByPlayerId.set(r.playerId, r.sp.note ?? "");
    }

    const poolRows = sqlite
      .prepare(
        `SELECT ap.id, ap.player_id, p.name AS name, COALESCE(ap.risk_note,'') AS risk_note,
                COALESCE(ap.availability,'FIT') AS availability
         FROM auction_pool ap JOIN players p ON p.id = ap.player_id
         WHERE ap.auction_id = ?`
      )
      .all(auctionId) as Array<{
      id: number;
      player_id: number;
      name: string;
      risk_note: string;
      availability: string;
    }>;

    const updNote = sqlite.prepare(`UPDATE auction_pool SET risk_note = ? WHERE id = ?`);
    const updAvail = sqlite.prepare(`UPDATE auction_pool SET availability = ? WHERE id = ?`);

    let notesWritten = 0;
    let availWritten = 0;
    const skippedManual: string[] = [];
    const replaced: Array<{ player: string; from: string }> = [];

    const inPool = new Set(poolRows.map((r) => r.player_id));

    sqlite.transaction(() => {
      for (const row of poolRows) {
        const wantNote = noteByPlayerId.get(row.player_id) ?? "";
        const wantAvail = cplAvailability(row.name);

        // risk_note: the squad file is authoritative. Only hold back if asked to.
        const looksMachine =
          row.risk_note === "" ||
          row.risk_note.startsWith("AVAILABILITY:") ||
          row.risk_note.startsWith("⚠️ INJURY");
        if (wantNote && wantNote !== row.risk_note) {
          if (preserveManual && !looksMachine) {
            skippedManual.push(`${row.name} (kept: ${row.risk_note.slice(0, 60)})`);
          } else {
            if (row.risk_note) replaced.push({ player: row.name, from: row.risk_note.slice(0, 80) });
            updNote.run(wantNote, row.id);
            notesWritten++;
          }
        }

        // availability: never downgrade a manual flag
        if (wantAvail !== row.availability && (row.availability === "FIT" || !row.availability)) {
          updAvail.run(wantAvail, row.id);
          availWritten++;
        }
      }
    })();

    // Additive: squad players absent from this pool (added to the squad file after the build)
    const insertPool = sqlite.prepare(
      `INSERT OR IGNORE INTO auction_pool
         (tournament_id, player_id, base_price, status, auction_id, ipl_team, squad_number, efppm, risk_note, availability)
       VALUES (?, ?, 0, 'AVAILABLE', ?, ?, ?, 0, ?, ?)`
    );
    const added: string[] = [];
    sqlite.transaction(() => {
      for (const r of resolved) {
        if (r.playerId === null || inPool.has(r.playerId)) continue;
        insertPool.run(
          auction.tournament_id,
          r.playerId,
          auctionId,
          r.team.short,
          r.sn,
          r.sp.note ?? "",
          cplAvailability(r.sp.name)
        );
        added.push(`${r.team.short}/${r.sp.name}`);
      }
    })();

    return NextResponse.json({
      success: true,
      auctionId,
      poolRows: poolRows.length,
      notesWritten,
      availabilityWritten: availWritten,
      playersAdded: added,
      notesReplaced: replaced,
      skippedManual,
      hint: added.length
        ? "Players were added — re-run POST /api/auction/start to price them."
        : "Metadata only; prices untouched.",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
