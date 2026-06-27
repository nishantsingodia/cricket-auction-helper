"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Types ───────────────────────────────────────────────────────────

interface SearchResult {
  id: number;
  name: string;
  country: string;
  role: string;
  fantasy: { efppm: number | null };
}

interface FantasyBreakdown {
  avgBatting: number;
  avgBowling: number;
  avgFielding: number;
  avgSrBonus: number;
  avgEconBonus: number;
  avgStartingXi: number;
  avgTotal: number;
  matchCount: number;
  bestMatch: number;
  worstMatch: number;
  consistency: number;
}

interface CareerStat {
  format: string;
  matches: number;
  innings: number;
  runs: number;
  batAvg: number;
  batSr: number;
  fifties: number;
  hundreds: number;
  hs: number;
  fours: number;
  sixes: number;
  bowlInnings: number;
  wickets: number;
  bowlAvg: number;
  bowlEcon: number;
  bowlSr: number;
  catches: number;
  stumpings: number;
  efppm: number;
  totalPoints: number;
}

interface RecentMatch {
  matchId: string;
  date: string;
  format: string;
  opposition: string;
  venue: string;
  batRuns: number;
  batBalls: number;
  bat4s: number;
  bat6s: number;
  bowlWickets: number;
  bowlRuns: number;
  bowlBalls: number;
  catches: number;
  fantasyPoints: number;
}

interface VenueStat {
  venueId: number;
  venueName: string;
  city: string;
  pitchType: string;
  matches: number;
  batAvg: number;
  batSr: number;
  bowlWickets: number;
  bowlEcon: number;
  efppm: number;
}

interface PlayerDetail {
  player: {
    id: number;
    name: string;
    fullName: string;
    country: string;
    role: string;
    batStyle: string;
    bowlStyle: string;
    isOverseas: boolean;
    dob: string;
  };
  fantasyBreakdown: FantasyBreakdown | null;
  careerStats: CareerStat[];
  recentMatches: RecentMatch[];
  venueStats: VenueStat[];
}

interface AuctionPlayerInfo {
  playerId: number;
  status: string;
  soldToTeam: number | null;
  soldPrice: number | null;
  basePrice: number;
  valuation: {
    floor: number | null;
    expected: number | null;
    ceiling: number | null;
    efppm: number | null;
  };
}

interface AuctionTeam {
  id: number;
  name: string;
  shortName: string;
  color: string;
}

const ROLE_COLORS: Record<string, string> = {
  BAT: "bg-blue-600",
  BOWL: "bg-green-600",
  AR: "bg-purple-600",
  WK: "bg-amber-600",
};

// ─── Helpers ─────────────────────────────────────────────────────────

function highlightBetter(
  a: number | null | undefined,
  b: number | null | undefined,
  higherIsBetter = true
): ["text-green-400" | "", "text-green-400" | ""] {
  if (a == null || b == null) return ["", ""];
  if (a === b) return ["", ""];
  if (higherIsBetter) return a > b ? ["text-green-400", ""] : ["", "text-green-400"];
  return a < b ? ["text-green-400", ""] : ["", "text-green-400"];
}

function fmt(v: number | null | undefined, decimals = 1): string {
  if (v == null) return "—";
  return Number(v).toFixed(decimals);
}

function fmtInt(v: number | null | undefined): string {
  if (v == null) return "—";
  return String(Math.round(Number(v)));
}

function fmtLakhs(v: number | null | undefined): string {
  if (v == null) return "—";
  const num = Number(v);
  if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(1)} L`;
  return String(num);
}

// ─── Player Search Component ─────────────────────────────────────────

function PlayerSearch({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: SearchResult | null;
  onSelect: (p: SearchResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/players?search=${encodeURIComponent(q)}&limit=10&minMatches=0`);
      const data = await res.json();
      setResults(
        (data.players || []).map((p: Record<string, unknown>) => ({
          id: p.id as number,
          name: p.name as string,
          country: p.country as string,
          role: p.role as string,
          fantasy: p.fantasy as { efppm: number | null },
        }))
      );
      setOpen(true);
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-2">
        <Badge className={`${ROLE_COLORS[selected.role] || ""} text-white`}>
          {selected.role}
        </Badge>
        <span className="font-semibold">{selected.name}</span>
        <span className="text-xs text-muted-foreground">({selected.country})</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSelect(null);
            setQuery("");
          }}
          className="ml-auto text-xs"
        >
          Change
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        placeholder={`${label}: type player name...`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 text-sm"
              onClick={() => {
                onSelect(p);
                setOpen(false);
              }}
            >
              <Badge
                className={`${ROLE_COLORS[p.role] || ""} text-white text-[10px] px-1.5 py-0`}
              >
                {p.role}
              </Badge>
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground text-xs ml-auto">{p.country}</span>
              {p.fantasy?.efppm != null && (
                <span className="text-amber-400 text-xs font-mono">
                  {Number(p.fantasy.efppm).toFixed(1)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Breakdown Bar ───────────────────────────────────────────────────

function BreakdownBar({
  labelA,
  valueA,
  labelB,
  valueB,
  color,
}: {
  labelA: string;
  valueA: number;
  labelB: string;
  valueB: number;
  color: string;
}) {
  const maxVal = Math.max(Math.abs(valueA), Math.abs(valueB), 1);
  const [hA, hB] = highlightBetter(valueA, valueB);
  return (
    <div className="grid grid-cols-[1fr_80px_1fr] gap-2 items-center text-xs">
      <div className="flex items-center gap-1 justify-end">
        <span className={`font-mono w-10 text-right ${hA || ""}`}>
          {valueA >= 0 ? "+" : ""}
          {valueA.toFixed(1)}
        </span>
        <div className="w-24 h-3 bg-muted rounded-full overflow-hidden flex justify-end">
          <div
            className={`h-full ${color} rounded-full`}
            style={{ width: `${(Math.abs(valueA) / maxVal) * 100}%` }}
          />
        </div>
      </div>
      <div className="text-center text-muted-foreground">{labelA}</div>
      <div className="flex items-center gap-1">
        <div className="w-24 h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${color} rounded-full`}
            style={{ width: `${(Math.abs(valueB) / maxVal) * 100}%` }}
          />
        </div>
        <span className={`font-mono w-10 ${hB || ""}`}>
          {valueB >= 0 ? "+" : ""}
          {valueB.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

// ─── Stat Row ────────────────────────────────────────────────────────

function StatRow({
  label,
  a,
  b,
  higherIsBetter = true,
  formatter = fmt,
}: {
  label: string;
  a: number | null | undefined;
  b: number | null | undefined;
  higherIsBetter?: boolean;
  formatter?: (v: number | null | undefined) => string;
}) {
  const [hA, hB] = highlightBetter(a, b, higherIsBetter);
  return (
    <TableRow>
      <TableCell className={`text-right font-mono ${hA}`}>{formatter(a)}</TableCell>
      <TableCell className="text-center text-muted-foreground text-xs font-medium">
        {label}
      </TableCell>
      <TableCell className={`font-mono ${hB}`}>{formatter(b)}</TableCell>
    </TableRow>
  );
}

// ─── Main Compare Content ────────────────────────────────────────────

function CompareContent() {
  const searchParams = useSearchParams();
  const tournamentId = searchParams.get("tournamentId");

  const [playerA, setPlayerA] = useState<SearchResult | null>(null);
  const [playerB, setPlayerB] = useState<SearchResult | null>(null);
  const [detailA, setDetailA] = useState<PlayerDetail | null>(null);
  const [detailB, setDetailB] = useState<PlayerDetail | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  // Auction context
  const [auctionData, setAuctionData] = useState<{
    pool: AuctionPlayerInfo[];
    teams: AuctionTeam[];
    tournament: { currencyUnit: string };
  } | null>(null);

  // Fetch auction data if tournamentId provided
  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/auction?tournamentId=${tournamentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.pool) {
          setAuctionData({
            pool: data.pool,
            teams: data.teams,
            tournament: data.tournament,
          });
        }
      })
      .catch(() => {});
  }, [tournamentId]);

  // Fetch player details
  useEffect(() => {
    if (!playerA) {
      setDetailA(null);
      return;
    }
    setLoadingA(true);
    fetch(`/api/players/${playerA.id}`)
      .then((r) => r.json())
      .then(setDetailA)
      .catch(() => setDetailA(null))
      .finally(() => setLoadingA(false));
  }, [playerA]);

  useEffect(() => {
    if (!playerB) {
      setDetailB(null);
      return;
    }
    setLoadingB(true);
    fetch(`/api/players/${playerB.id}`)
      .then((r) => r.json())
      .then(setDetailB)
      .catch(() => setDetailB(null))
      .finally(() => setLoadingB(false));
  }, [playerB]);

  // Helper: get IPL stats, fallback to T20/T20I
  function getStats(detail: PlayerDetail): CareerStat | null {
    const ipl = detail.careerStats.find((c) => c.format === "IPL");
    if (ipl) return ipl;
    const t20 = detail.careerStats.find((c) => c.format === "T20" || c.format === "T20I");
    return t20 || detail.careerStats[0] || null;
  }

  // Helper: get auction info for a player
  function getAuctionInfo(playerId: number): AuctionPlayerInfo | null {
    if (!auctionData) return null;
    return auctionData.pool.find((p) => p.playerId === playerId) || null;
  }

  function getTeamName(teamId: number | null): string {
    if (!teamId || !auctionData) return "—";
    const team = auctionData.teams.find((t) => t.id === teamId);
    return team ? team.shortName || team.name : "—";
  }

  const bothLoaded = detailA && detailB && !loadingA && !loadingB;

  // Overlapping venues
  const overlappingVenues: {
    venue: string;
    city: string;
    aEfppm: number;
    bEfppm: number;
    aMatches: number;
    bMatches: number;
  }[] = [];

  if (detailA && detailB) {
    const venueMapB = new Map(detailB.venueStats.map((v) => [v.venueName, v]));
    for (const va of detailA.venueStats) {
      const vb = venueMapB.get(va.venueName);
      if (vb) {
        overlappingVenues.push({
          venue: va.venueName,
          city: va.city,
          aEfppm: va.efppm,
          bEfppm: vb.efppm,
          aMatches: va.matches,
          bMatches: vb.matches,
        });
      }
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Title */}
        <h1 className="text-2xl font-bold mb-6">Player Comparison</h1>

        {/* Search row */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Player A</CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerSearch label="Player A" selected={playerA} onSelect={setPlayerA} />
            </CardContent>
          </Card>

          <div className="hidden md:flex items-center justify-center h-full pt-8">
            <span className="text-xl font-bold text-muted-foreground">vs</span>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Player B</CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerSearch label="Player B" selected={playerB} onSelect={setPlayerB} />
            </CardContent>
          </Card>
        </div>

        {/* Loading state */}
        {(loadingA || loadingB) && (
          <div className="text-center text-muted-foreground py-12">
            Loading player details...
          </div>
        )}

        {/* Comparison */}
        {bothLoaded && (
          <div className="space-y-6">
            {/* ── Header Row ── */}
            <Card>
              <CardContent className="py-4">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xl font-bold">{detailA.player.name}</span>
                      <Badge
                        className={`${ROLE_COLORS[detailA.player.role] || ""} text-white`}
                      >
                        {detailA.player.role}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {detailA.player.country}
                      {detailA.player.batStyle && ` | ${detailA.player.batStyle}`}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-muted-foreground">vs</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`${ROLE_COLORS[detailB.player.role] || ""} text-white`}
                      >
                        {detailB.player.role}
                      </Badge>
                      <span className="text-xl font-bold">{detailB.player.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {detailB.player.country}
                      {detailB.player.batStyle && ` | ${detailB.player.batStyle}`}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Auction Context ── */}
            {tournamentId && auctionData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Auction Context</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const infoA = getAuctionInfo(detailA.player.id);
                    const infoB = getAuctionInfo(detailB.player.id);
                    if (!infoA && !infoB) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          Neither player is in the auction pool for this tournament.
                        </p>
                      );
                    }
                    return (
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
                        <div className="space-y-2 text-right text-sm">
                          {infoA ? (
                            <>
                              <div>
                                <Badge
                                  variant={
                                    infoA.status === "SOLD"
                                      ? "default"
                                      : infoA.status === "AVAILABLE"
                                        ? "secondary"
                                        : "destructive"
                                  }
                                >
                                  {infoA.status}
                                </Badge>
                              </div>
                              {infoA.status === "SOLD" && (
                                <div className="text-muted-foreground">
                                  {getTeamName(infoA.soldToTeam)} for{" "}
                                  <span className="text-green-400 font-semibold">
                                    {fmtLakhs(infoA.soldPrice)}
                                  </span>
                                </div>
                              )}
                              {infoA.valuation.expected != null && (
                                <div className="text-muted-foreground text-xs">
                                  AI Valuation: {fmtLakhs(infoA.valuation.floor)} /{" "}
                                  <span className="text-amber-400">
                                    {fmtLakhs(infoA.valuation.expected)}
                                  </span>{" "}
                                  / {fmtLakhs(infoA.valuation.ceiling)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">Not in pool</span>
                          )}
                        </div>
                        <Separator orientation="vertical" />
                        <div className="space-y-2 text-sm">
                          {infoB ? (
                            <>
                              <div>
                                <Badge
                                  variant={
                                    infoB.status === "SOLD"
                                      ? "default"
                                      : infoB.status === "AVAILABLE"
                                        ? "secondary"
                                        : "destructive"
                                  }
                                >
                                  {infoB.status}
                                </Badge>
                              </div>
                              {infoB.status === "SOLD" && (
                                <div className="text-muted-foreground">
                                  {getTeamName(infoB.soldToTeam)} for{" "}
                                  <span className="text-green-400 font-semibold">
                                    {fmtLakhs(infoB.soldPrice)}
                                  </span>
                                </div>
                              )}
                              {infoB.valuation.expected != null && (
                                <div className="text-muted-foreground text-xs">
                                  AI Valuation: {fmtLakhs(infoB.valuation.floor)} /{" "}
                                  <span className="text-amber-400">
                                    {fmtLakhs(infoB.valuation.expected)}
                                  </span>{" "}
                                  / {fmtLakhs(infoB.valuation.ceiling)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">Not in pool</span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* ── Fantasy Comparison ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fantasy Comparison</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {detailA.fantasyBreakdown && detailB.fantasyBreakdown ? (
                  <>
                    {/* EFPPM */}
                    {(() => {
                      const fbA = detailA.fantasyBreakdown!;
                      const fbB = detailB.fantasyBreakdown!;
                      const [hA, hB] = highlightBetter(fbA.avgTotal, fbB.avgTotal);
                      return (
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                          <div className="text-right">
                            <span className={`text-3xl font-bold ${hA || "text-amber-400"}`}>
                              {fbA.avgTotal.toFixed(1)}
                            </span>
                          </div>
                          <div className="text-center text-sm text-muted-foreground font-medium">
                            EFPPM
                          </div>
                          <div>
                            <span className={`text-3xl font-bold ${hB || "text-amber-400"}`}>
                              {fbB.avgTotal.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    <Separator />

                    {/* Key metrics */}
                    <Table>
                      <TableBody>
                        <StatRow
                          label="Best Match"
                          a={detailA.fantasyBreakdown!.bestMatch}
                          b={detailB.fantasyBreakdown!.bestMatch}
                          formatter={fmtInt}
                        />
                        <StatRow
                          label="Worst Match"
                          a={detailA.fantasyBreakdown!.worstMatch}
                          b={detailB.fantasyBreakdown!.worstMatch}
                          formatter={fmtInt}
                        />
                        <StatRow
                          label="Consistency (SD)"
                          a={detailA.fantasyBreakdown!.consistency}
                          b={detailB.fantasyBreakdown!.consistency}
                          higherIsBetter={false}
                        />
                        <StatRow
                          label="Matches"
                          a={detailA.fantasyBreakdown!.matchCount}
                          b={detailB.fantasyBreakdown!.matchCount}
                          formatter={fmtInt}
                        />
                      </TableBody>
                    </Table>

                    <Separator />

                    {/* Breakdown bars */}
                    <p className="text-sm font-semibold">Points Breakdown (Avg per Match)</p>
                    <div className="space-y-2">
                      {(
                        [
                          ["Batting", "avgBatting", "bg-blue-500"],
                          ["Bowling", "avgBowling", "bg-green-500"],
                          ["Fielding", "avgFielding", "bg-purple-500"],
                          ["SR Bonus", "avgSrBonus", "bg-amber-500"],
                          ["Econ Bonus", "avgEconBonus", "bg-cyan-500"],
                          ["Starting XI", "avgStartingXi", "bg-gray-500"],
                        ] as [string, keyof FantasyBreakdown, string][]
                      ).map(([label, key, color]) => (
                        <BreakdownBar
                          key={label}
                          labelA={label}
                          valueA={detailA.fantasyBreakdown![key] as number}
                          labelB={label}
                          valueB={detailB.fantasyBreakdown![key] as number}
                          color={color}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Fantasy breakdown data not available for one or both players.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ── Career Stats Comparison ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Career Stats (IPL / T20)</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const sA = getStats(detailA);
                  const sB = getStats(detailB);
                  if (!sA && !sB) {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No career stats available.
                      </p>
                    );
                  }
                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right w-[120px]">
                            {detailA.player.name}
                          </TableHead>
                          <TableHead className="text-center w-[100px]">Stat</TableHead>
                          <TableHead className="w-[120px]">{detailB.player.name}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <StatRow label="EFPPM" a={sA?.efppm} b={sB?.efppm} />
                        <StatRow
                          label="Matches"
                          a={sA?.matches}
                          b={sB?.matches}
                          formatter={fmtInt}
                        />
                        <StatRow
                          label="Runs"
                          a={sA?.runs}
                          b={sB?.runs}
                          formatter={fmtInt}
                        />
                        <StatRow label="Bat Avg" a={sA?.batAvg} b={sB?.batAvg} />
                        <StatRow label="Bat SR" a={sA?.batSr} b={sB?.batSr} />
                        <StatRow
                          label="50s"
                          a={sA?.fifties}
                          b={sB?.fifties}
                          formatter={fmtInt}
                        />
                        <StatRow
                          label="100s"
                          a={sA?.hundreds}
                          b={sB?.hundreds}
                          formatter={fmtInt}
                        />
                        <StatRow
                          label="6s"
                          a={sA?.sixes}
                          b={sB?.sixes}
                          formatter={fmtInt}
                        />
                        <StatRow
                          label="Wickets"
                          a={sA?.wickets}
                          b={sB?.wickets}
                          formatter={fmtInt}
                        />
                        <StatRow
                          label="Bowl Avg"
                          a={sA?.bowlAvg}
                          b={sB?.bowlAvg}
                          higherIsBetter={false}
                        />
                        <StatRow
                          label="Bowl Econ"
                          a={sA?.bowlEcon}
                          b={sB?.bowlEcon}
                          higherIsBetter={false}
                        />
                        <StatRow
                          label="Catches"
                          a={sA?.catches}
                          b={sB?.catches}
                          formatter={fmtInt}
                        />
                        <StatRow
                          label="Stumpings"
                          a={sA?.stumpings}
                          b={sB?.stumpings}
                          formatter={fmtInt}
                        />
                      </TableBody>
                    </Table>
                  );
                })()}
              </CardContent>
            </Card>

            {/* ── Venue Comparison ── */}
            {overlappingVenues.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Venue Comparison ({overlappingVenues.length} shared venue
                    {overlappingVenues.length !== 1 ? "s" : ""})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">
                          {detailA.player.name} EFPPM
                        </TableHead>
                        <TableHead className="text-center">Venue</TableHead>
                        <TableHead>
                          {detailB.player.name} EFPPM
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overlappingVenues.map((v) => {
                        const [hA, hB] = highlightBetter(v.aEfppm, v.bEfppm);
                        return (
                          <TableRow key={v.venue}>
                            <TableCell className={`text-right font-mono ${hA}`}>
                              {fmt(v.aEfppm)}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({v.aMatches}m)
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="font-medium text-sm">{v.venue}</div>
                              <div className="text-xs text-muted-foreground">{v.city}</div>
                            </TableCell>
                            <TableCell className={`font-mono ${hB}`}>
                              {fmt(v.bEfppm)}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({v.bMatches}m)
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* ── Recent Form ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Form (Last 5 Matches)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
                  {/* Player A recent */}
                  <div className="text-right">
                    <RecentFormSparkline
                      matches={detailA.recentMatches.slice(0, 5)}
                      avgTotal={detailA.fantasyBreakdown?.avgTotal ?? null}
                      align="right"
                    />
                  </div>
                  <Separator orientation="vertical" />
                  {/* Player B recent */}
                  <div>
                    <RecentFormSparkline
                      matches={detailB.recentMatches.slice(0, 5)}
                      avgTotal={detailB.fantasyBreakdown?.avgTotal ?? null}
                      align="left"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Prompt when no players selected */}
        {!playerA && !playerB && !loadingA && !loadingB && (
          <div className="text-center text-muted-foreground py-20">
            <p className="text-lg">Select two players above to compare them side-by-side.</p>
            <p className="text-sm mt-2">
              Search by name, then click to select each player.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Recent Form Sparkline ───────────────────────────────────────────

function RecentFormSparkline({
  matches,
  avgTotal,
  align,
}: {
  matches: RecentMatch[];
  avgTotal: number | null;
  align: "left" | "right";
}) {
  if (matches.length === 0) {
    return <span className="text-sm text-muted-foreground">No recent matches</span>;
  }

  return (
    <div
      className={`flex gap-2 flex-wrap ${
        align === "right" ? "justify-end" : "justify-start"
      }`}
    >
      {matches.map((m, i) => {
        const pts = m.fantasyPoints ?? 0;
        const aboveAvg = avgTotal != null && pts >= avgTotal;
        const color = avgTotal == null ? "text-foreground" : aboveAvg ? "text-green-400" : "text-red-400";
        return (
          <div key={i} className="text-center">
            <div className={`text-lg font-bold font-mono ${color}`}>
              {Math.round(pts)}
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight">
              vs {m.opposition}
            </div>
            <div className="text-[10px] text-muted-foreground leading-tight">
              {m.date}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page Export with Suspense ────────────────────────────────────────

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
          Loading...
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
