"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

// ────────────────────────── Types ──────────────────────────

interface Tournament {
  id: number;
  name: string;
  status: string;
}

interface LeaderboardEntry {
  rank?: number;
  teamId: number;
  teamName: string;
  shortName: string;
  color: string;
  totalPoints: number;
  matchesPlayed: number;
  avgPointsPerMatch?: number;
  topScorers?: TopScorer[];
}

interface TopScorer {
  playerId: number;
  playerName: string;
  playerRole: string;
  totalPoints: number;
  matchesPlayed: number;
  captainRole: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  BAT: "bg-blue-600",
  BOWL: "bg-green-600",
  AR: "bg-purple-600",
  WK: "bg-amber-600",
};

// ────────────────────────── Component ──────────────────────────

function LeaderboardContent() {
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get("tournamentId");

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!tournamentId) return;
    try {
      // Fetch auction data for tournament info
      const auctionRes = await fetch(
        `/api/auction?tournamentId=${tournamentId}`
      );
      const auctionData = await auctionRes.json();
      setTournament(auctionData.tournament);

      // Fetch leaderboard
      const lbRes = await fetch(
        `/api/leaderboard?tournamentId=${tournamentId}`
      );
      const lbData = await lbRes.json();

      const teams: { id: number; name: string; shortName: string; color: string }[] =
        auctionData.teams;

      // Merge leaderboard data with team info
      // The leaderboard might not have entries for all teams yet
      const lbEntries: LeaderboardEntry[] = lbData.leaderboard || [];

      // Find teams without leaderboard entries
      const lbTeamIds = new Set(lbEntries.map((e: LeaderboardEntry) => e.teamId));
      const missingTeams = teams.filter((t) => !lbTeamIds.has(t.id));

      const allEntries: LeaderboardEntry[] = [
        ...lbEntries,
        ...missingTeams.map((t) => ({
          teamId: t.id,
          teamName: t.name,
          shortName: t.shortName,
          color: t.color,
          totalPoints: 0,
          matchesPlayed: 0,
          avgPointsPerMatch: 0,
          topScorers: [],
        })),
      ].sort(
        (a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0)
      );

      // Assign ranks
      allEntries.forEach((e, i) => {
        e.rank = i + 1;
      });

      setEntries(allEntries);

      // Count total completed matches
      const matchRes = await fetch(
        `/api/matches?tournamentId=${tournamentId}`
      );
      const matchData = await matchRes.json();
      const completedMatches = (matchData.matches || []).filter(
        (m: { status: string }) => m.status === "COMPLETED"
      );
      setTotalMatches(completedMatches.length);
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch top scorers for expanded team
  const fetchTopScorers = useCallback(
    async (teamId: number) => {
      if (!tournamentId) return;
      try {
        // Get all match scores for players on this team
        const res = await fetch(
          `/api/leaderboard?tournamentId=${tournamentId}`
        );
        const data = await res.json();
        const lbEntry = (data.leaderboard || []).find(
          (e: LeaderboardEntry) => e.teamId === teamId
        );
        if (lbEntry?.topScorers) {
          setEntries((prev) =>
            prev.map((e) =>
              e.teamId === teamId
                ? { ...e, topScorers: lbEntry.topScorers }
                : e
            )
          );
        }
      } catch (err) {
        console.error("Failed to fetch top scorers:", err);
      }
    },
    [tournamentId]
  );

  const handleToggleTeam = (teamId: number) => {
    if (expandedTeam === teamId) {
      setExpandedTeam(null);
    } else {
      setExpandedTeam(teamId);
      // Fetch top scorers if not loaded
      const entry = entries.find((e) => e.teamId === teamId);
      if (!entry?.topScorers || entry.topScorers.length === 0) {
        fetchTopScorers(teamId);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading leaderboard...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">
          Tournament not found. Please provide a valid tournamentId.
        </p>
      </div>
    );
  }

  const leader = entries.length > 0 ? entries[0] : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{tournament.name}</h1>
          <p className="text-sm text-muted-foreground">
            Leaderboard{" "}
            {totalMatches > 0 && (
              <span>
                — {totalMatches} match{totalMatches !== 1 ? "es" : ""} completed
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/scoring?tournamentId=${tournament.id}`}>
            <Button variant="outline" size="sm">
              Scoring
            </Button>
          </Link>
          <Link href={`/auction?tournamentId=${tournament.id}`}>
            <Button variant="ghost" size="sm">
              Auction
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Leader highlight */}
        {leader && leader.totalPoints > 0 && (
          <Card className="border-yellow-600/30">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-yellow-500">#1</span>
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: leader.color }}
                  />
                  <span
                    className="text-lg font-bold"
                    style={{ color: leader.color }}
                  >
                    {leader.teamName}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-400">
                    {leader.totalPoints.toFixed(1)} pts
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {leader.matchesPlayed} match
                    {leader.matchesPlayed !== 1 ? "es" : ""} |{" "}
                    {leader.matchesPlayed > 0
                      ? (leader.totalPoints / leader.matchesPlayed).toFixed(1)
                      : "0"}{" "}
                    avg
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Standings</CardTitle>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No leaderboard data yet. Complete some matches first.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Rank</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Total Points</TableHead>
                    <TableHead className="text-right">Matches</TableHead>
                    <TableHead className="text-right">Avg Pts/Match</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const isExpanded = expandedTeam === entry.teamId;
                    const avg =
                      entry.matchesPlayed > 0
                        ? entry.totalPoints / entry.matchesPlayed
                        : 0;

                    return (
                      <TableRow
                        key={entry.teamId}
                        className="cursor-pointer"
                        onClick={() => handleToggleTeam(entry.teamId)}
                      >
                        <TableCell>
                          <span
                            className={`font-bold ${
                              entry.rank === 1
                                ? "text-yellow-400"
                                : entry.rank === 2
                                  ? "text-slate-300"
                                  : entry.rank === 3
                                    ? "text-amber-600"
                                    : "text-muted-foreground"
                            }`}
                          >
                            #{entry.rank}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="font-medium">
                              {entry.shortName}
                            </span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              {entry.teamName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {entry.totalPoints.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.matchesPlayed}
                        </TableCell>
                        <TableCell className="text-right">
                          {avg.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                          >
                            {isExpanded ? "Hide" : "Details"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Per-team expandable sections */}
        {entries.map((entry) => {
          if (expandedTeam !== entry.teamId) return null;
          const scorers = entry.topScorers || [];

          return (
            <Card key={`detail-${entry.teamId}`}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <CardTitle
                    className="text-base"
                    style={{ color: entry.color }}
                  >
                    {entry.teamName} — Top Performers
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {scorers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No scoring data available yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {scorers.map((scorer, idx) => (
                      <div
                        key={scorer.playerId}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/10"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-6">
                            {idx + 1}.
                          </span>
                          <Badge
                            variant="secondary"
                            className={`${ROLE_COLORS[scorer.playerRole] || ""} text-white text-[10px] px-1.5 py-0`}
                          >
                            {scorer.playerRole}
                          </Badge>
                          <span className="text-sm font-medium">
                            {scorer.playerName}
                          </span>
                          {scorer.captainRole === "C" && (
                            <Badge className="bg-yellow-600 text-white text-[10px] px-1.5 py-0">
                              C
                            </Badge>
                          )}
                          {scorer.captainRole === "VC" && (
                            <Badge className="bg-slate-500 text-white text-[10px] px-1.5 py-0">
                              VC
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-sm">
                            {scorer.totalPoints.toFixed(1)} pts
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({scorer.matchesPlayed} match
                            {scorer.matchesPlayed !== 1 ? "es" : ""})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Separator className="my-3" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Team Total</span>
                  <span className="font-bold">
                    {entry.totalPoints.toFixed(1)} pts across{" "}
                    {entry.matchesPlayed} match
                    {entry.matchesPlayed !== 1 ? "es" : ""}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      }
    >
      <LeaderboardContent />
    </Suspense>
  );
}
