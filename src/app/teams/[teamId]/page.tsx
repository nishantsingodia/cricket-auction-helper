"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface XIPlayer {
  id: number;
  name: string;
  role: string;
  country: string;
  isOverseas: boolean;
  efppm: number;
  availability: string;
  isCaptainCandidate: boolean;
  soldPrice: number | null;
}

interface TeamData {
  team: {
    id: number;
    name: string;
    shortName: string;
    color: string | null;
    remainingPurse: number;
  };
  tournament: {
    id: number;
    name: string;
    maxOverseas: number;
    maxSquadSize: number;
  };
  xi: XIPlayer[];
  bench: XIPlayer[];
  unavailable: XIPlayer[];
  warnings: string[];
  squadStats: {
    total: number;
    bat: number;
    bowl: number;
    ar: number;
    wk: number;
    overseas: number;
    maxOverseasSquad: number;
    totalEfppm: number;
  };
  fullSquad: XIPlayer[];
}

const ROLE_COLORS: Record<string, string> = {
  BAT: "bg-blue-600 text-white",
  BOWL: "bg-green-600 text-white",
  AR: "bg-purple-600 text-white",
  WK: "bg-amber-600 text-white",
};

const ROLE_LABELS: Record<string, string> = {
  BAT: "BAT",
  BOWL: "BOWL",
  AR: "ALL",
  WK: "WK",
};

const AVAILABILITY_STYLES: Record<string, string> = {
  FIT: "bg-emerald-900/40 text-emerald-400 border-emerald-700",
  DOUBTFUL: "bg-yellow-900/40 text-yellow-400 border-yellow-700",
  INJURED: "bg-red-900/40 text-red-400 border-red-700",
  UNAVAILABLE: "bg-zinc-800/60 text-zinc-400 border-zinc-600",
};

function TeamPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const teamId = params.teamId as string;
  const tournamentId = searchParams.get("tournamentId");

  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!tournamentId) {
      setError("tournamentId query parameter is required");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/playing-xi?tournamentId=${tournamentId}`
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to fetch team data");
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [teamId, tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground text-lg">Loading team data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { team, tournament, xi, bench, unavailable, warnings, squadStats, fullSquad } = data;
  const teamColor = team.color || "#6366f1";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <div
            className="w-3 h-10 rounded-sm"
            style={{ backgroundColor: teamColor }}
          />
          <div>
            <h1
              className="text-3xl font-bold"
              style={{ color: teamColor }}
            >
              {team.name}
            </h1>
            <p className="text-muted-foreground text-sm">{tournament.name}</p>
          </div>
        </div>
        <div className="flex gap-6 mt-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Purse Remaining:</span>
            <span className="font-semibold text-emerald-400">
              {team.remainingPurse?.toFixed(2)} Cr
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Squad:</span>
            <span className="font-semibold">
              {squadStats.total} / {tournament.maxSquadSize}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Overseas:</span>
            <span className="font-semibold">
              {squadStats.overseas} / {squadStats.maxOverseasSquad}
            </span>
          </div>
        </div>
      </div>

      <Separator className="mb-6" />

      <Tabs defaultValue="playing-xi" className="space-y-6">
        <TabsList>
          <TabsTrigger value="playing-xi">Playing XI</TabsTrigger>
          <TabsTrigger value="full-squad">Full Squad</TabsTrigger>
          <TabsTrigger value="balance">Squad Balance</TabsTrigger>
        </TabsList>

        {/* ===== Playing XI Tab ===== */}
        <TabsContent value="playing-xi" className="space-y-6">
          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((w, i) => (
                <div
                  key={i}
                  className="bg-yellow-900/30 border border-yellow-700 text-yellow-300 px-4 py-2 rounded-md text-sm"
                >
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* XI Grid */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">
                Playing XI
                <span className="text-muted-foreground text-sm font-normal ml-2">
                  ({xi.filter((p) => p.isOverseas).length} overseas)
                </span>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={fetchData}>
                Regenerate XI
              </Button>
            </CardHeader>
            <CardContent>
              {(() => {
                // Determine C and VC from the XI by EFPPM
                const sorted = [...xi].sort((a, b) => b.efppm - a.efppm);
                const captainId = sorted[0]?.id;
                const vcId = sorted[1]?.id;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {xi.map((player, idx) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        index={idx + 1}
                        captainLabel={
                          player.id === captainId
                            ? "C"
                            : player.id === vcId
                              ? "VC"
                              : undefined
                        }
                      />
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Bench */}
          {bench.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-muted-foreground">
                  Bench ({bench.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {bench.map((player) => (
                    <PlayerCard key={player.id} player={player} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unavailable */}
          {unavailable.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-red-400">
                  Unavailable ({unavailable.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unavailable.map((player) => (
                    <PlayerCard key={player.id} player={player} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== Full Squad Tab ===== */}
        <TabsContent value="full-squad">
          <Card>
            <CardHeader>
              <CardTitle>Full Squad ({fullSquad.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">EFPPM</TableHead>
                    <TableHead className="text-right">Sold Price</TableHead>
                    <TableHead>Availability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...fullSquad]
                    .sort((a, b) => b.efppm - a.efppm)
                    .map((player, idx) => (
                      <TableRow key={player.id}>
                        <TableCell className="text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {player.name}
                          {player.isOverseas && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-[10px] border-sky-600 text-sky-400"
                            >
                              OS
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-[10px] ${ROLE_COLORS[player.role] || "bg-zinc-700"}`}
                          >
                            {ROLE_LABELS[player.role] || player.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {player.country}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {player.efppm.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {player.soldPrice != null
                            ? `${player.soldPrice.toFixed(2)} Cr`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${AVAILABILITY_STYLES[player.availability] || ""}`}
                          >
                            {player.availability}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Squad Balance Tab ===== */}
        <TabsContent value="balance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Squad Balance Meter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Role Distribution */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Role Distribution
                </h3>
                <RoleBar
                  label="Batters"
                  count={squadStats.bat}
                  max={squadStats.total}
                  color="bg-blue-500"
                />
                <RoleBar
                  label="Bowlers"
                  count={squadStats.bowl}
                  max={squadStats.total}
                  color="bg-green-500"
                />
                <RoleBar
                  label="All-rounders"
                  count={squadStats.ar}
                  max={squadStats.total}
                  color="bg-purple-500"
                />
                <RoleBar
                  label="Wicketkeepers"
                  count={squadStats.wk}
                  max={squadStats.total}
                  color="bg-amber-500"
                />
              </div>

              <Separator />

              {/* Overseas */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Overseas Quota
                </h3>
                <div className="flex items-center gap-3">
                  <Progress
                    value={
                      (squadStats.overseas / squadStats.maxOverseasSquad) * 100
                    }
                    className="flex-1 h-3"
                  />
                  <span className="text-sm font-mono min-w-[60px] text-right">
                    {squadStats.overseas} / {squadStats.maxOverseasSquad}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Total Squad EFPPM */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Squad EFPPM
                </h3>
                <span className="text-2xl font-bold font-mono">
                  {squadStats.totalEfppm.toFixed(1)}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlayerCard({
  player,
  index,
  captainLabel,
}: {
  player: XIPlayer;
  index?: number;
  captainLabel?: "C" | "VC";
}) {
  return (
    <div
      className={`
        relative flex items-center gap-3 p-3 rounded-lg border
        bg-card hover:bg-accent/50 transition-colors
        ${player.availability === "INJURED" || player.availability === "UNAVAILABLE"
          ? "opacity-50"
          : ""}
      `}
    >
      {/* Index */}
      {index != null && (
        <div className="text-xs text-muted-foreground font-mono w-5 shrink-0">
          {index}
        </div>
      )}

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate">{player.name}</span>
          {player.isOverseas && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 border-sky-600 text-sky-400"
            >
              OS
            </Badge>
          )}
          {player.availability !== "FIT" && (
            <Badge
              variant="outline"
              className={`text-[9px] px-1 py-0 ${AVAILABILITY_STYLES[player.availability] || ""}`}
            >
              {player.availability}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge
            className={`text-[9px] px-1.5 py-0 ${ROLE_COLORS[player.role] || "bg-zinc-700"}`}
          >
            {ROLE_LABELS[player.role] || player.role}
          </Badge>
          <span className="text-xs text-muted-foreground">{player.country}</span>
        </div>
      </div>

      {/* EFPPM + Captain Badge */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="font-mono text-sm font-semibold">
          {player.efppm.toFixed(1)}
        </span>
        {captainLabel && (
          <Badge
            className={`text-[9px] px-1.5 py-0 ${
              captainLabel === "C"
                ? "bg-yellow-500 text-black"
                : "bg-zinc-400 text-black"
            }`}
          >
            {captainLabel === "C" ? "C candidate" : "VC candidate"}
          </Badge>
        )}
      </div>
    </div>
  );
}

function RoleBar({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm min-w-[110px]">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-mono min-w-[30px] text-right">{count}</span>
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-muted-foreground text-lg">Loading...</div>
        </div>
      }
    >
      <TeamPageContent />
    </Suspense>
  );
}
