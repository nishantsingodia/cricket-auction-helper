"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ────────────────────────── Types ──────────────────────────

interface Tournament {
  id: number;
  name: string;
  pursePerTeam: number;
  currencyUnit: string;
  maxSquadSize: number;
  maxOverseas: number;
  maxOverseasSquad: number;
  numCaptains: number;
  numViceCaptains: number;
  status: string;
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

interface AuctionPlayer {
  poolId: number;
  playerId: number;
  name: string;
  country: string;
  role: string;
  batStyle: string;
  bowlStyle: string;
  isOverseas: number;
  basePrice: number;
  status: string;
  soldToTeam: number | null;
  soldPrice: number | null;
}

interface Match {
  id: number;
  matchId: string;
  matchDate: string;
  team1: string;
  team2: string;
  result: string | null;
  status: string;
}

interface CaptainEntry {
  id: number;
  playerId: number;
  role: string;
  playerName: string;
  playerRole: string;
}

interface PlayerScore {
  playerId: number;
  playerName: string;
  teamId: number;
  teamShortName: string;
  teamColor: string;
  role: string;
  batRuns: number;
  batBalls: number;
  bat4s: number;
  bat6s: number;
  bowlBalls: number;
  bowlRuns: number;
  bowlWickets: number;
  bowlMaidens: number;
  bowlDots: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  inStartingXi: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  BAT: "bg-blue-600",
  BOWL: "bg-green-600",
  AR: "bg-purple-600",
  WK: "bg-amber-600",
};

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: "bg-yellow-600/20 text-yellow-400 border-yellow-600/40",
  COMPLETED: "bg-green-600/20 text-green-400 border-green-600/40",
  LIVE: "bg-red-600/20 text-red-400 border-red-600/40",
};

// ────────────────────────── Component ──────────────────────────

function ScoringContent() {
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get("tournamentId");

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pool, setPool] = useState<AuctionPlayer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Add match form
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [matchDate, setMatchDate] = useState("");
  const [matchTeam1, setMatchTeam1] = useState("");
  const [matchTeam2, setMatchTeam2] = useState("");
  const [addingMatch, setAddingMatch] = useState(false);

  // Score entry dialog
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [scoreMatchId, setScoreMatchId] = useState<number | null>(null);
  const [scoreMatchLabel, setScoreMatchLabel] = useState("");
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);
  const [submittingScores, setSubmittingScores] = useState(false);
  const [viewMode, setViewMode] = useState(false);

  // Captain management
  const [teamCaptains, setTeamCaptains] = useState<
    Record<number, CaptainEntry[]>
  >({});
  const [savingCaptains, setSavingCaptains] = useState<number | null>(null);

  // ─── Data fetching ───

  const fetchAuctionData = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const res = await fetch(`/api/auction?tournamentId=${tournamentId}`);
      const data = await res.json();
      setTournament(data.tournament);
      setTeams(data.teams);
      setPool(data.pool);
    } catch (err) {
      console.error("Failed to fetch auction data:", err);
    }
  }, [tournamentId]);

  const fetchMatches = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const res = await fetch(`/api/matches?tournamentId=${tournamentId}`);
      const data = await res.json();
      setMatches(data.matches);
    } catch (err) {
      console.error("Failed to fetch matches:", err);
    }
  }, [tournamentId]);

  const fetchCaptains = useCallback(async () => {
    if (!tournamentId || teams.length === 0) return;
    try {
      const captainsByTeam: Record<number, CaptainEntry[]> = {};
      for (const team of teams) {
        const res = await fetch(
          `/api/captains?tournamentId=${tournamentId}&teamId=${team.id}`
        );
        const data = await res.json();
        captainsByTeam[team.id] = data.captains;
      }
      setTeamCaptains(captainsByTeam);
    } catch (err) {
      console.error("Failed to fetch captains:", err);
    }
  }, [tournamentId, teams]);

  useEffect(() => {
    const load = async () => {
      await fetchAuctionData();
      await fetchMatches();
      setLoading(false);
    };
    load();
  }, [fetchAuctionData, fetchMatches]);

  useEffect(() => {
    if (teams.length > 0) {
      fetchCaptains();
    }
  }, [teams, fetchCaptains]);

  // ─── Handlers ───

  const handleAddMatch = async () => {
    if (!tournamentId || !matchDate || !matchTeam1 || !matchTeam2) return;
    if (matchTeam1 === matchTeam2) {
      alert("Teams must be different");
      return;
    }
    setAddingMatch(true);
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: parseInt(tournamentId),
          matchDate,
          team1: matchTeam1,
          team2: matchTeam2,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMatchDate("");
        setMatchTeam1("");
        setMatchTeam2("");
        setShowAddMatch(false);
        fetchMatches();
      } else {
        alert(data.error || "Failed to add match");
      }
    } catch (err) {
      console.error("Add match failed:", err);
    } finally {
      setAddingMatch(false);
    }
  };

  const openScoreEntry = async (match: Match, viewOnly: boolean) => {
    if (!tournamentId) return;
    setScoreMatchId(match.id);
    setScoreMatchLabel(
      `${match.team1} vs ${match.team2} (${match.matchDate})`
    );
    setViewMode(viewOnly);

    // Get sold players grouped by team
    const soldPlayers = pool.filter((p) => p.status === "SOLD");

    if (viewOnly) {
      // Load existing scores
      try {
        const res = await fetch(
          `/api/matches/${match.id}/scores?matchResultId=${match.id}`
        );
        const data = await res.json();
        const existingScores = data.scores || [];

        const scores: PlayerScore[] = soldPlayers.map((p) => {
          const team = teams.find((t) => t.id === p.soldToTeam);
          const existing = existingScores.find(
            (s: { playerId: number }) => s.playerId === p.playerId
          );
          return {
            playerId: p.playerId,
            playerName: p.name,
            teamId: p.soldToTeam || 0,
            teamShortName: team?.shortName || "?",
            teamColor: team?.color || "#666",
            role: p.role,
            batRuns: existing?.batRuns ?? 0,
            batBalls: existing?.batBalls ?? 0,
            bat4s: existing?.bat4s ?? 0,
            bat6s: existing?.bat6s ?? 0,
            bowlBalls: existing?.bowlBalls ?? 0,
            bowlRuns: existing?.bowlRuns ?? 0,
            bowlWickets: existing?.bowlWickets ?? 0,
            bowlMaidens: existing?.bowlMaidens ?? 0,
            bowlDots: existing?.bowlDots ?? 0,
            catches: existing?.catches ?? 0,
            stumpings: existing?.stumpings ?? 0,
            runOuts: existing?.runOuts ?? 0,
            inStartingXi: existing ? !!existing.inStartingXi : true,
          };
        });

        setPlayerScores(scores);
      } catch (err) {
        console.error("Failed to load scores:", err);
      }
    } else {
      // Fresh score entry
      const scores: PlayerScore[] = soldPlayers.map((p) => {
        const team = teams.find((t) => t.id === p.soldToTeam);
        return {
          playerId: p.playerId,
          playerName: p.name,
          teamId: p.soldToTeam || 0,
          teamShortName: team?.shortName || "?",
          teamColor: team?.color || "#666",
          role: p.role,
          batRuns: 0,
          batBalls: 0,
          bat4s: 0,
          bat6s: 0,
          bowlBalls: 0,
          bowlRuns: 0,
          bowlWickets: 0,
          bowlMaidens: 0,
          bowlDots: 0,
          catches: 0,
          stumpings: 0,
          runOuts: 0,
          inStartingXi: true,
        };
      });
      setPlayerScores(scores);
    }

    setScoreDialogOpen(true);
  };

  const updateScore = (
    index: number,
    field: keyof PlayerScore,
    value: number | boolean
  ) => {
    setPlayerScores((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmitScores = async () => {
    if (!scoreMatchId || !tournamentId) return;
    setSubmittingScores(true);
    try {
      const res = await fetch(`/api/matches/${scoreMatchId}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchResultId: scoreMatchId,
          scores: playerScores.map((s) => ({
            playerId: s.playerId,
            batRuns: s.batRuns,
            batBalls: s.batBalls,
            bat4s: s.bat4s,
            bat6s: s.bat6s,
            bowlBalls: s.bowlBalls,
            bowlRuns: s.bowlRuns,
            bowlWickets: s.bowlWickets,
            bowlMaidens: s.bowlMaidens,
            bowlDots: s.bowlDots,
            catches: s.catches,
            stumpings: s.stumpings,
            runOuts: s.runOuts,
            inStartingXi: s.inStartingXi,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScoreDialogOpen(false);
        setScoreMatchId(null);
        fetchMatches();
      } else {
        alert(data.error || "Failed to submit scores");
      }
    } catch (err) {
      console.error("Submit scores failed:", err);
    } finally {
      setSubmittingScores(false);
    }
  };

  const handleSetCaptain = async (
    teamId: number,
    playerId: number,
    role: "C" | "VC"
  ) => {
    if (!tournamentId) return;

    const current = teamCaptains[teamId] || [];
    const maxC = tournament?.numCaptains ?? 1;
    const maxVC = tournament?.numViceCaptains ?? 1;

    // Check if player already has this role
    const existingIdx = current.findIndex(
      (c) => c.playerId === playerId && c.role === role
    );

    let newCaptains: { playerId: number; role: string }[];

    if (existingIdx >= 0) {
      // Remove this assignment
      newCaptains = current
        .filter((_, i) => i !== existingIdx)
        .map((c) => ({ playerId: c.playerId, role: c.role }));
    } else {
      // Add this assignment; respect limits
      const sameRoleCurrent = current.filter((c) => c.role === role);
      const maxForRole = role === "C" ? maxC : maxVC;

      let base = current.map((c) => ({ playerId: c.playerId, role: c.role }));

      if (sameRoleCurrent.length >= maxForRole) {
        // Remove the oldest of this role
        const removeId = sameRoleCurrent[0].playerId;
        base = base.filter(
          (c) => !(c.playerId === removeId && c.role === role)
        );
      }

      // Also remove this player from the other role if present
      base = base.filter((c) => c.playerId !== playerId);

      base.push({ playerId, role });
      newCaptains = base;
    }

    setSavingCaptains(teamId);
    try {
      const res = await fetch("/api/captains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: parseInt(tournamentId),
          teamId,
          captains: newCaptains,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchCaptains();
      } else {
        alert(data.error || "Failed to set captain");
      }
    } catch (err) {
      console.error("Set captain failed:", err);
    } finally {
      setSavingCaptains(null);
    }
  };

  // ─── Render ───

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading scoring page...</p>
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

  // Group sold players by team
  const playersByTeam: Record<number, AuctionPlayer[]> = {};
  for (const team of teams) {
    playersByTeam[team.id] = pool.filter(
      (p) => p.status === "SOLD" && p.soldToTeam === team.id
    );
  }

  // Group score entries by team for the dialog
  const scoresByTeam: Record<number, { score: PlayerScore; index: number }[]> =
    {};
  playerScores.forEach((s, i) => {
    if (!scoresByTeam[s.teamId]) scoresByTeam[s.teamId] = [];
    scoresByTeam[s.teamId].push({ score: s, index: i });
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="border-b border-border px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold">{tournament.name}</h1>
            <p className="text-sm text-muted-foreground">Tournament Scoring</p>
          </div>
          <Badge
            variant="outline"
            className={
              tournament.status === "ACTIVE"
                ? "border-green-500 text-green-400"
                : "border-muted-foreground text-muted-foreground"
            }
          >
            {tournament.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/leaderboard?tournamentId=${tournament.id}`}>
            <Button variant="outline" size="sm">
              Leaderboard
            </Button>
          </Link>
          <Link href={`/auction?tournamentId=${tournament.id}`}>
            <Button variant="ghost" size="sm">
              Back to Auction
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* ──── Add Match Form ──── */}
        <Card>
          <CardHeader
            className="cursor-pointer"
            onClick={() => setShowAddMatch(!showAddMatch)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Add Match</CardTitle>
              <span className="text-muted-foreground text-sm">
                {showAddMatch ? "Collapse" : "Expand"}
              </span>
            </div>
          </CardHeader>
          {showAddMatch && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <Label className="text-sm">Date</Label>
                  <Input
                    type="date"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Team 1</Label>
                  <Select
                    value={matchTeam1}
                    onValueChange={(v) => setMatchTeam1(v ?? "")}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.shortName}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Team 2</Label>
                  <Select
                    value={matchTeam2}
                    onValueChange={(v) => setMatchTeam2(v ?? "")}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.shortName}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddMatch}
                  disabled={
                    addingMatch || !matchDate || !matchTeam1 || !matchTeam2
                  }
                >
                  {addingMatch ? "Adding..." : "Add Match"}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ──── Match List ──── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Matches ({matches.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No matches yet. Add one above.
              </p>
            ) : (
              <div className="space-y-2">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-24">
                        {match.matchDate}
                      </span>
                      <span className="font-medium text-sm">
                        {match.team1}{" "}
                        <span className="text-muted-foreground">vs</span>{" "}
                        {match.team2}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          STATUS_COLORS[match.status] || ""
                        }
                      >
                        {match.status}
                      </Badge>
                    </div>
                    <div>
                      {match.status === "UPCOMING" && (
                        <Button
                          size="sm"
                          onClick={() => openScoreEntry(match, false)}
                        >
                          Enter Scores
                        </Button>
                      )}
                      {match.status === "COMPLETED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openScoreEntry(match, true)}
                        >
                          View Scores
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ──── C/VC Selection ──── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Captain / Vice-Captain Selection
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {tournament.numCaptains} Captain(s) and{" "}
              {tournament.numViceCaptains} Vice-Captain(s) per team. Points
              multiplied by 2x (C) and 1.5x (VC).
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {teams.map((team) => {
                const teamPlayers = playersByTeam[team.id] || [];
                const captains = teamCaptains[team.id] || [];
                const isSaving = savingCaptains === team.id;

                return (
                  <div key={team.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <h3
                        className="font-semibold"
                        style={{ color: team.color }}
                      >
                        {team.name} ({team.shortName})
                      </h3>
                      {isSaving && (
                        <span className="text-xs text-muted-foreground">
                          Saving...
                        </span>
                      )}
                    </div>

                    {teamPlayers.length === 0 ? (
                      <p className="text-sm text-muted-foreground ml-5">
                        No players in squad
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 ml-5">
                        {teamPlayers.map((player) => {
                          const captainEntry = captains.find(
                            (c) => c.playerId === player.playerId
                          );
                          const isCaptain = captainEntry?.role === "C";
                          const isVC = captainEntry?.role === "VC";

                          return (
                            <div
                              key={player.playerId}
                              className={`flex items-center justify-between p-2 rounded-md border ${
                                isCaptain
                                  ? "border-yellow-500/50 bg-yellow-500/10"
                                  : isVC
                                    ? "border-slate-400/50 bg-slate-400/10"
                                    : "border-border"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className={`${ROLE_COLORS[player.role] || ""} text-white text-[10px] px-1.5 py-0`}
                                >
                                  {player.role}
                                </Badge>
                                <span className="text-sm truncate max-w-[120px]">
                                  {player.name}
                                </span>
                                {isCaptain && (
                                  <Badge className="bg-yellow-600 text-white text-[10px] px-1.5 py-0">
                                    C
                                  </Badge>
                                )}
                                {isVC && (
                                  <Badge className="bg-slate-500 text-white text-[10px] px-1.5 py-0">
                                    VC
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant={isCaptain ? "default" : "outline"}
                                  size="sm"
                                  className={`h-6 text-[10px] px-2 ${
                                    isCaptain
                                      ? "bg-yellow-600 hover:bg-yellow-700"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    handleSetCaptain(
                                      team.id,
                                      player.playerId,
                                      "C"
                                    )
                                  }
                                  disabled={isSaving}
                                >
                                  C
                                </Button>
                                <Button
                                  variant={isVC ? "default" : "outline"}
                                  size="sm"
                                  className={`h-6 text-[10px] px-2 ${
                                    isVC
                                      ? "bg-slate-500 hover:bg-slate-600"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    handleSetCaptain(
                                      team.id,
                                      player.playerId,
                                      "VC"
                                    )
                                  }
                                  disabled={isSaving}
                                >
                                  VC
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <Separator className="mt-4" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ──── Score Entry / View Dialog ──── */}
      <Dialog open={scoreDialogOpen} onOpenChange={setScoreDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {viewMode ? "View Scores" : "Enter Scores"} — {scoreMatchLabel}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {teams.map((team) => {
                const teamScores = scoresByTeam[team.id];
                if (!teamScores || teamScores.length === 0) return null;

                return (
                  <div key={team.id}>
                    <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-2 z-10">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      <h3
                        className="font-semibold text-sm"
                        style={{ color: team.color }}
                      >
                        {team.name}
                      </h3>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[160px]">Player</TableHead>
                          <TableHead className="w-[50px] text-center">
                            XI
                          </TableHead>
                          <TableHead className="text-center">Runs</TableHead>
                          <TableHead className="text-center">Balls</TableHead>
                          <TableHead className="text-center">4s</TableHead>
                          <TableHead className="text-center">6s</TableHead>
                          <TableHead className="text-center">Wkts</TableHead>
                          <TableHead className="text-center">
                            Overs (balls)
                          </TableHead>
                          <TableHead className="text-center">Mdns</TableHead>
                          <TableHead className="text-center">Dots</TableHead>
                          <TableHead className="text-center">Ct</TableHead>
                          <TableHead className="text-center">St</TableHead>
                          <TableHead className="text-center">RO</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamScores.map(({ score, index }) => (
                          <TableRow
                            key={score.playerId}
                            className={
                              !score.inStartingXi ? "opacity-40" : ""
                            }
                          >
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Badge
                                  variant="secondary"
                                  className={`${ROLE_COLORS[score.role] || ""} text-white text-[9px] px-1 py-0`}
                                >
                                  {score.role}
                                </Badge>
                                <span className="text-xs truncate max-w-[100px]">
                                  {score.playerName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                checked={score.inStartingXi}
                                onChange={(e) =>
                                  updateScore(
                                    index,
                                    "inStartingXi",
                                    e.target.checked
                                  )
                                }
                                disabled={viewMode}
                                className="h-4 w-4"
                              />
                            </TableCell>
                            {(
                              [
                                "batRuns",
                                "batBalls",
                                "bat4s",
                                "bat6s",
                                "bowlWickets",
                                "bowlBalls",
                                "bowlMaidens",
                                "bowlDots",
                                "catches",
                                "stumpings",
                                "runOuts",
                              ] as (keyof PlayerScore)[]
                            ).map((field) => (
                              <TableCell key={field} className="p-1">
                                <Input
                                  type="number"
                                  min={0}
                                  value={score[field] as number}
                                  onChange={(e) =>
                                    updateScore(
                                      index,
                                      field,
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  disabled={viewMode || !score.inStartingXi}
                                  className="h-7 text-xs text-center w-14 px-1"
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {!viewMode && (
            <div className="flex justify-end pt-4 border-t border-border">
              <Button
                onClick={handleSubmitScores}
                disabled={submittingScores}
                className="px-8"
              >
                {submittingScores ? "Submitting..." : "Submit Scores"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ScoringPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading scoring...</p>
        </div>
      }
    >
      <ScoringContent />
    </Suspense>
  );
}
