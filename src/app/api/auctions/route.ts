import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/db";

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
    const auctions = sqlite
      .prepare(
        `SELECT a.*,
           (SELECT COUNT(*) FROM auction_pool ap WHERE ap.auction_id = a.id) as total_players,
           (SELECT COUNT(*) FROM auction_pool ap WHERE ap.auction_id = a.id AND ap.sold_to_participant IS NOT NULL) as sold_players
         FROM auctions a
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
  tournamentName?: string;
  matchFormat?: string;
  friends: { name: string; shortName: string; isMe: boolean }[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateAuctionBody;
    const {
      name,
      numFriends,
      pursePerFriend,
      playersPerFriend,
      numCaptains = 1,
      numViceCaptains = 1,
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

    const transaction = sqlite.transaction(() => {
      // Create auction
      const result = sqlite
        .prepare(
          `INSERT INTO auctions (name, tournament_name, match_format, num_friends, purse_per_friend, players_per_friend, num_captains, num_vice_captains, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SETUP')`
        )
        .run(
          name,
          tournamentName,
          matchFormat,
          numFriends,
          pursePerFriend,
          playersPerFriend,
          numCaptains,
          numViceCaptains
        );
      auctionId = Number(result.lastInsertRowid);

      // Create participants
      const insertParticipant = sqlite.prepare(
        `INSERT INTO auction_participants (auction_id, name, short_name, color, purse, remaining_purse, is_me)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      for (let i = 0; i < friends.length; i++) {
        const f = friends[i];
        insertParticipant.run(
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

    transaction();

    return NextResponse.json({ success: true, auctionId: auctionId! });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
