"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface AuctionPlayer {
  poolId: number;
  playerId: number;
  name: string;
  country: string;
  role: string;
  isOverseas: number;
  status: string;
  soldToTeam: number | null;
  soldPrice: number | null;
  valuation: {
    floor: number | null;
    expected: number | null;
    ceiling: number | null;
    efppm: number | null;
  };
  stats: {
    matches: number;
    runs: number;
    wickets: number;
  };
}

interface Team {
  id: number;
  name: string;
  shortName: string;
  color: string;
  remainingPurse: number;
  squadCount: number;
  overseasCount: number;
}

interface Tournament {
  id: number;
  name: string;
  pursePerTeam: number;
  currencyUnit: string;
  maxSquadSize: number;
  maxOverseas: number;
  maxOverseasSquad: number;
}

const ROLE_COLORS: Record<string, string> = {
  BAT: "bg-blue-600",
  BOWL: "bg-green-600",
  AR: "bg-purple-600",
  WK: "bg-amber-600",
};

function SummaryContent() {
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get("tournamentId");

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pool, setPool] = useState<AuctionPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const res = await fetch(`/api/auction?tournamentId=${tournamentId}`);
      const data = await res.json();
      setTournament(data.tournament);
      setTeams(data.teams);
      setPool(data.pool);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading summary...</p>
      </div>
    );
  }

  const soldPlayers = pool.filter((p) => p.status === "SOLD");
  const unsoldPlayers = pool.filter((p) => p.status === "UNSOLD");

  // Team analysis
  const teamAnalysis = teams.map((team) => {
    const players = soldPlayers.filter((p) => p.soldToTeam === team.id);
    const totalSpent = players.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
    const totalEfppm = players.reduce((sum, p) => sum + (p.valuation.efppm || 0), 0);
    const roles = { BAT: 0, BOWL: 0, AR: 0, WK: 0 };
    let overseasCount = 0;
    players.forEach((p) => {
      roles[p.role as keyof typeof roles] = (roles[p.role as keyof typeof roles] || 0) + 1;
      if (p.isOverseas) overseasCount++;
    });

    // Value picks: sold for < 70% of expected
    const valuePicks = players.filter(
      (p) => p.valuation.expected && p.soldPrice && p.soldPrice < p.valuation.expected * 0.7
    );
    // Overpays: sold for > 130% of expected
    const overpays = players.filter(
      (p) => p.valuation.expected && p.soldPrice && p.soldPrice > p.valuation.expected * 1.3
    );

    return {
      ...team,
      players,
      totalSpent,
      totalEfppm,
      roles,
      overseasCount,
      valuePicks,
      overpays,
      avgEfppm: players.length > 0 ? totalEfppm / players.length : 0,
    };
  });

  // Sort by total EFPPM
  const rankedTeams = [...teamAnalysis].sort((a, b) => b.totalEfppm - a.totalEfppm);

  // Auction-wide stats
  const totalSold = soldPlayers.length;
  const totalSpentAll = soldPlayers.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
  const mostExpensive = [...soldPlayers].sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0))[0];
  const bestValue = [...soldPlayers]
    .filter((p) => p.valuation.expected && p.soldPrice)
    .sort((a, b) => {
      const ratioA = (a.soldPrice || 0) / (a.valuation.expected || 1);
      const ratioB = (b.soldPrice || 0) / (b.valuation.expected || 1);
      return ratioA - ratioB;
    })[0];
  const biggestOverpay = [...soldPlayers]
    .filter((p) => p.valuation.expected && p.soldPrice)
    .sort((a, b) => {
      const ratioA = (a.soldPrice || 0) / (a.valuation.expected || 1);
      const ratioB = (b.soldPrice || 0) / (b.valuation.expected || 1);
      return ratioB - ratioA;
    })[0];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{tournament.name}</h1>
            <p className="text-muted-foreground">Post-Auction Summary Report</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/export?type=summary&tournamentId=${tournament.id}`}
              className="text-sm px-4 py-2 rounded-md bg-green-700 hover:bg-green-600 text-white transition-colors"
              download
            >
              Export CSV
            </a>
            <a
              href={`/auction?tournamentId=${tournament.id}`}
              className="text-sm px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
            >
              Back to Auction
            </a>
            <a
              href={`/scoring?tournamentId=${tournament.id}`}
              className="text-sm px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Start Scoring
            </a>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold">{totalSold}</div>
              <div className="text-sm text-muted-foreground">Players Sold</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold">{unsoldPlayers.length}</div>
              <div className="text-sm text-muted-foreground">Unsold</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold">
                {totalSpentAll.toFixed(1)} {tournament.currencyUnit}
              </div>
              <div className="text-sm text-muted-foreground">Total Spent</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-amber-400">
                {mostExpensive?.soldPrice} {tournament.currencyUnit}
              </div>
              <div className="text-sm text-muted-foreground">Highest Bid</div>
              <div className="text-xs text-muted-foreground">{mostExpensive?.name}</div>
            </CardContent>
          </Card>
        </div>

        {/* Auction Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {bestValue && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-400">Best Value Pick</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold">{bestValue.name}</span>
                    <Badge variant="secondary" className={`ml-2 ${ROLE_COLORS[bestValue.role]} text-white text-[10px]`}>
                      {bestValue.role}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold">
                      {bestValue.soldPrice} {tournament.currencyUnit}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Expected: {bestValue.valuation.expected?.toFixed(1)} {tournament.currencyUnit}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {biggestOverpay && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-400">Biggest Overpay</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold">{biggestOverpay.name}</span>
                    <Badge variant="secondary" className={`ml-2 ${ROLE_COLORS[biggestOverpay.role]} text-white text-[10px]`}>
                      {biggestOverpay.role}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-red-400 font-bold">
                      {biggestOverpay.soldPrice} {tournament.currencyUnit}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Expected: {biggestOverpay.valuation.expected?.toFixed(1)} {tournament.currencyUnit}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Projected Leaderboard */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Projected Leaderboard (by Total EFPPM)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Rank</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Squad</TableHead>
                  <TableHead className="text-right">Overseas</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Avg EFPPM</TableHead>
                  <TableHead className="text-right font-bold text-amber-400">Total EFPPM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankedTeams.map((team, i) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-bold">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </TableCell>
                    <TableCell>
                      <a
                        href={`/teams/${team.id}?tournamentId=${tournament.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
                        <span className="font-medium" style={{ color: team.color }}>
                          {team.shortName}
                        </span>
                        <span className="text-muted-foreground text-xs">{team.name}</span>
                      </a>
                    </TableCell>
                    <TableCell className="text-right">{team.players.length}/{tournament.maxSquadSize}</TableCell>
                    <TableCell className="text-right">{team.overseasCount}/{tournament.maxOverseasSquad}</TableCell>
                    <TableCell className="text-right">{team.totalSpent.toFixed(1)} {tournament.currencyUnit}</TableCell>
                    <TableCell className="text-right">{team.remainingPurse.toFixed(1)} {tournament.currencyUnit}</TableCell>
                    <TableCell className="text-right">{team.avgEfppm.toFixed(1)}</TableCell>
                    <TableCell className="text-right font-bold text-amber-400">{team.totalEfppm.toFixed(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Per-Team Breakdown */}
        <h2 className="text-xl font-bold mb-4">Team Breakdowns</h2>
        <div className="space-y-4">
          {rankedTeams.map((team, rank) => (
            <Card key={team.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">#{rank + 1}</span>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: team.color }} />
                    <CardTitle style={{ color: team.color }}>{team.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-amber-400 font-bold">{team.totalEfppm.toFixed(0)} EFPPM</span>
                    <span>{team.totalSpent.toFixed(1)}/{tournament.pursePerTeam} {tournament.currencyUnit}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Role Distribution */}
                <div className="flex gap-4 mb-3">
                  {(["BAT", "BOWL", "AR", "WK"] as const).map((role) => (
                    <div key={role} className="flex items-center gap-1">
                      <Badge variant="secondary" className={`${ROLE_COLORS[role]} text-white text-[10px]`}>
                        {role}
                      </Badge>
                      <span className="text-sm">{team.roles[role]}</span>
                    </div>
                  ))}
                  <span className="text-sm text-muted-foreground">
                    | {team.overseasCount} overseas
                  </span>
                </div>

                {/* Squad Table */}
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">EFPPM</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Verdict</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.players
                      .sort((a, b) => (b.valuation.efppm || 0) - (a.valuation.efppm || 0))
                      .map((p) => {
                        const paid = p.soldPrice || 0;
                        const expected = p.valuation.expected || 0;
                        let verdict = "Fair";
                        let verdictColor = "text-muted-foreground";
                        if (expected > 0) {
                          if (paid < expected * 0.7) {
                            verdict = "Value";
                            verdictColor = "text-green-400";
                          } else if (paid > expected * 1.3) {
                            verdict = "Overpay";
                            verdictColor = "text-red-400";
                          }
                        }
                        return (
                          <TableRow key={p.poolId}>
                            <TableCell>
                              <span className="font-medium">{p.name}</span>
                              {p.isOverseas ? (
                                <span className="text-[10px] text-blue-400 ml-1">OS</span>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`${ROLE_COLORS[p.role]} text-white text-[10px]`}>
                                {p.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-amber-400 font-bold">
                              {p.valuation.efppm?.toFixed(1) || "—"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {paid} {tournament.currencyUnit}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {expected ? `${expected.toFixed(1)} ${tournament.currencyUnit}` : "—"}
                            </TableCell>
                            <TableCell className={`text-right font-bold text-xs ${verdictColor}`}>
                              {verdict}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
                </div>

                {/* Value picks & overpays summary */}
                {(team.valuePicks.length > 0 || team.overpays.length > 0) && (
                  <div className="flex gap-4 mt-3 text-xs">
                    {team.valuePicks.length > 0 && (
                      <span className="text-green-400">
                        {team.valuePicks.length} value pick{team.valuePicks.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {team.overpays.length > 0 && (
                      <span className="text-red-400">
                        {team.overpays.length} overpay{team.overpays.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Unsold Players */}
        {unsoldPlayers.length > 0 && (
          <>
            <Separator className="my-6" />
            <Card>
              <CardHeader>
                <CardTitle>Unsold Players ({unsoldPlayers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {unsoldPlayers
                    .sort((a, b) => (b.valuation.efppm || 0) - (a.valuation.efppm || 0))
                    .map((p) => (
                      <div
                        key={p.poolId}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-muted/20 text-sm"
                      >
                        <Badge variant="secondary" className={`${ROLE_COLORS[p.role]} text-white text-[10px]`}>
                          {p.role}
                        </Badge>
                        <span>{p.name}</span>
                        <span className="text-amber-400 text-xs">
                          ({p.valuation.efppm?.toFixed(1)})
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

export default function SummaryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading summary...</p>
        </div>
      }
    >
      <SummaryContent />
    </Suspense>
  );
}
