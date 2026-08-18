import { NextRequest, NextResponse } from "next/server";
import { sqlite, withTransaction, isRemote } from "@/db";

// Auctions may only be created against TURSO, never against the local SQLite file.
//
// Turso is the sole master for auction state (see CLAUDE.md "Deploy & the local ⇄ cloud split"), so
// an auction created locally is discarded by the next `npm run turso:sync` — you would build a pool,
// value it, maybe start bidding, and silently lose the lot. Worse, ids are local autoincrement: on
// 2026-08-18 a locally-created auction and a phone-created one both took id 40, and reconciling them
// meant a forced pull and a rebuild. Minting ids in exactly one place makes that impossible.
//
// Escape hatch for deliberate offline work (tests, schema poking) — it does NOT make the auction
// survivable, it just stops the guard getting in your way:
//   ALLOW_LOCAL_AUCTION_CREATE=1 npm run dev
const ALLOW_LOCAL_CREATE = process.env.ALLOW_LOCAL_AUCTION_CREATE === "1";

const DEFAULT_COLORS = [
  "#3B82F6", // blue
  "#EF4444", // red
  "#10B981", // green
  "#F59E0B", // amber
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

export async function GET() {
  try {
    const auctions = await sqlite
      .prepare(
        // One grouped pass, NOT two correlated subqueries per auction. Those scanned the whole
        // auction_pool for every auction — 23 auctions x 3,221 rows x 2 = ~148k rows read on a
        // request that returns 23 of them. Harmless on a local file, but Turso bills rows read and
        // this single endpoint was the biggest consumer on the account.
        `SELECT a.*,
           COALESCE(p.total_players, 0) AS total_players,
           COALESCE(p.sold_players, 0)  AS sold_players
         FROM auctions a
         LEFT JOIN (
           SELECT auction_id,
                  COUNT(*)                                                    AS total_players,
                  COUNT(CASE WHEN sold_to_participant IS NOT NULL THEN 1 END) AS sold_players
           FROM auction_pool
           GROUP BY auction_id
         ) p ON p.auction_id = a.id
         ORDER BY a.created_at DESC`
      )
      .all();

    return NextResponse.json({ auctions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface CreateAuctionBody {
  name: string;
  numFriends: number;
  pursePerFriend: number;
  playersPerFriend: number;
  numCaptains?: number;
  numViceCaptains?: number;
  // Movable-armband house rule: in-tournament C/VC changes allowed per friend
  // (0 = off = fixed armband). Consumed by the valuation engine's C/VC premium.
  changesAllowed?: number;
  tournamentName?: string;
  matchFormat?: string;
  friends: { name: string; shortName: string; isMe: boolean }[];
}

export async function POST(request: NextRequest) {
  try {
    if (!isRemote && !ALLOW_LOCAL_CREATE) {
      return NextResponse.json(
        {
          error:
            "Auctions can only be created against Turso, not the local SQLite file. " +
            "Turso is the master for auction state, so an auction created here is discarded by the " +
            "next `npm run turso:sync` — and local ids collide with cloud-minted ones.",
          how: [
            "Use the deployed board: https://cricket-auction-helper.vercel.app",
            "Or point local dev at Turso: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in .env.local",
            "Deliberate offline work only: ALLOW_LOCAL_AUCTION_CREATE=1 npm run dev",
          ],
        },
        { status: 409 }
      );
    }

    const body = (await request.json()) as CreateAuctionBody;
    const {
      name,
      numFriends,
      pursePerFriend,
      playersPerFriend,
      numCaptains = 1,
      numViceCaptains = 1,
      changesAllowed = 0,
      tournamentName = "IPL 2026",
      matchFormat = "T20",
      friends,
    } = body;

    if (!name || !numFriends || !pursePerFriend || !playersPerFriend) {
      return NextResponse.json(
        { error: "name, numFriends, pursePerFriend, playersPerFriend are required" },
        { status: 400 }
      );
    }

    if (!friends || friends.length !== numFriends) {
      return NextResponse.json(
        { error: `Expected ${numFriends} friends, got ${friends?.length || 0}` },
        { status: 400 }
      );
    }

    const meCount = friends.filter((f) => f.isMe).length;
    if (meCount !== 1) {
      return NextResponse.json(
        { error: "Exactly one friend must be marked as 'me'" },
        { status: 400 }
      );
    }

    let auctionId: number;

    await withTransaction(async (tx) => {
      // Create auction
      const result = await tx
        .prepare(
          `INSERT INTO auctions (name, tournament_name, match_format, num_friends, purse_per_friend, players_per_friend, num_captains, num_vice_captains, changes_allowed, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SETUP')`
        )
        .run(
          name,
          tournamentName,
          matchFormat,
          numFriends,
          pursePerFriend,
          playersPerFriend,
          numCaptains,
          numViceCaptains,
          changesAllowed
        );
      auctionId = Number(result.lastInsertRowid);

      // Create participants
      const insertParticipant = tx.prepare(
        `INSERT INTO auction_participants (auction_id, name, short_name, color, purse, remaining_purse, is_me)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      for (let i = 0; i < friends.length; i++) {
        const f = friends[i];
        await insertParticipant.run(
          auctionId,
          f.name,
          f.shortName || f.name.substring(0, 3).toUpperCase(),
          DEFAULT_COLORS[i % DEFAULT_COLORS.length],
          pursePerFriend,
          pursePerFriend,
          f.isMe ? 1 : 0
        );
      }
    });

    return NextResponse.json({ success: true, auctionId: auctionId! });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
