"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PlayerDetailProps {
  playerId: number;
  onClose: () => void;
  riskNote?: string | null;
  poolId?: number;
  playerStatus?: string;
  isWatched?: boolean;
  onRiskToggle?: (poolId: number, currentNote: string | null) => void;
  onSell?: () => void;
  onUndo?: () => void;
  onWatchlist?: () => void;
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
  consistency: number; // std deviation
}

interface SeasonStat {
  season: string;
  league?: string; // IPL | MLC | WPL — for franchise-league rows
  matches: number;
  runs: number;
  batAvg: number;
  batSr: number;
  fifties: number;
  hundreds: number;
  sixes: number;
  fours: number;
  wickets: number;
  bowlEcon: number;
  avgFantasyPoints: number;
  totalFantasyPoints: number;
  bestMatch?: number;
  worstMatch?: number;
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
  fantasyBreakdown?: FantasyBreakdown;
  careerStats: Array<{
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
  }>;
  recentMatches: Array<{
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
  }>;
  venueStats: Array<{
    venueName: string;
    city: string;
    pitchType: string;
    matches: number;
    batAvg: number;
    batSr: number;
    bowlWickets: number;
    bowlEcon: number;
    efppm: number;
  }>;
  oppositionStats: Array<{
    opposition: string;
    format: string;
    matches: number;
    batAvg: number;
    batSr: number;
    bowlWickets: number;
    bowlEcon: number;
    efppm: number;
  }>;
}

const ROLE_COLORS: Record<string, string> = {
  BAT: "bg-blue-600",
  BOWL: "bg-green-600",
  AR: "bg-purple-600",
  WK: "bg-amber-600",
};

export function PlayerDetailModal({ playerId, onClose, riskNote, poolId, playerStatus, isWatched, onRiskToggle, onSell, onUndo, onWatchlist }: PlayerDetailProps) {
  const [data, setData] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasonData, setSeasonData] = useState<{ leagueSeasons: SeasonStat[]; t20Seasons: SeasonStat[] } | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      try {
        const [res, seasonsRes] = await Promise.all([
          fetch(`/api/players/${playerId}`),
          fetch(`/api/players/${playerId}/seasons`),
        ]);
        const json = await res.json();
        setData(json);
        const seasonsJson = await seasonsRes.json();
        setSeasonData(seasonsJson);
      } catch (err) {
        console.error("Failed to fetch player detail:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [playerId]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="w-[95vw] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {loading || !data ? (
          <div className="py-12 text-center text-muted-foreground">
            Loading player details...
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle className="text-2xl">
                  {data.player.name}
                </DialogTitle>
                <Badge
                  className={`${ROLE_COLORS[data.player.role] || ""} text-white`}
                >
                  {data.player.role}
                </Badge>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                <span>{data.player.country}</span>
                {data.player.batStyle && (
                  <span>Bat: {data.player.batStyle}</span>
                )}
                {data.player.bowlStyle && (
                  <span>Bowl: {data.player.bowlStyle}</span>
                )}
                {data.player.dob && <span>DOB: {data.player.dob}</span>}
              </div>
              {/* Risk note banner */}
              {riskNote && (
                <div className="mt-2">
                  <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-1 rounded">
                    ⚠ {riskNote}
                  </span>
                </div>
              )}
              {/* Action buttons for mobile */}
              <div className="flex flex-wrap gap-2 mt-3">
                {onWatchlist && (
                  <button
                    className={`text-xs px-3 py-1.5 rounded border font-medium ${
                      isWatched
                        ? "bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400"
                        : "border-border text-muted-foreground hover:border-amber-500 hover:text-amber-500"
                    }`}
                    onClick={() => { onWatchlist(); onClose(); }}
                  >
                    {isWatched ? "★ Watchlisted" : "☆ Watchlist"}
                  </button>
                )}
                {playerStatus === "AVAILABLE" && onSell && (
                  <button
                    className="text-xs px-3 py-1.5 rounded border border-green-500 text-green-600 dark:text-green-400 font-medium hover:bg-green-500/10"
                    onClick={() => { onSell(); onClose(); }}
                  >
                    Sell Player
                  </button>
                )}
                {playerStatus === "SOLD" && onUndo && (
                  <button
                    className="text-xs px-3 py-1.5 rounded border border-orange-500 text-orange-600 dark:text-orange-400 font-medium hover:bg-orange-500/10"
                    onClick={() => { onUndo(); onClose(); }}
                  >
                    Undo Sale
                  </button>
                )}
                {onRiskToggle && poolId && (
                  <button
                    className={`text-xs px-3 py-1.5 rounded border font-medium ${
                      riskNote
                        ? "border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                        : "border-border text-muted-foreground hover:border-red-500 hover:text-red-500"
                    }`}
                    onClick={() => { onRiskToggle(poolId, riskNote || null); onClose(); }}
                  >
                    {riskNote ? "⚠ Clear Risk" : "⚠ Flag Risky"}
                  </button>
                )}
              </div>
            </DialogHeader>

            <Tabs defaultValue="fantasy" className="mt-4">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="fantasy">Fantasy Breakdown</TabsTrigger>
                <TabsTrigger value="career">Career Stats</TabsTrigger>
                <TabsTrigger value="seasons">Season Stats</TabsTrigger>
                <TabsTrigger value="recent">Recent Matches</TabsTrigger>
                <TabsTrigger value="venues">Venue Stats</TabsTrigger>
                <TabsTrigger value="opposition">vs Opposition</TabsTrigger>
              </TabsList>

              {/* Fantasy Breakdown */}
              <TabsContent value="fantasy">
                {data.fantasyBreakdown ? (
                  <div className="space-y-4">
                    {/* Summary: Your EFPPM + Last IPL stats */}
                    {(() => {
                      const lastIpl = seasonData?.leagueSeasons?.[0];
                      const bowlOversPerMatch = lastIpl && lastIpl.matches > 0
                        ? (data.recentMatches
                            .filter((m) => m.format === (lastIpl.league ?? "IPL"))
                            .slice(0, lastIpl.matches)
                            .reduce((s, m) => s + (m.bowlBalls || 0), 0) / lastIpl.matches / 6)
                        : null;
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          {/* Your Avg FP */}
                          <div className="col-span-2 text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div className="text-3xl font-bold text-amber-500">
                              {data.fantasyBreakdown.avgTotal.toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">Avg Fantasy Points / Match</div>
                          </div>

                          {lastIpl ? (
                            <>
                              <div className="col-span-2 mt-1">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Last IPL ({lastIpl.season})
                                </div>
                              </div>
                              <div className="text-center p-2.5 bg-muted/30 rounded-lg">
                                <div className="text-xl font-bold text-amber-400">{lastIpl.avgFantasyPoints?.toFixed(1)}</div>
                                <div className="text-[10px] text-muted-foreground">FP / Match</div>
                              </div>
                              <div className="text-center p-2.5 bg-muted/30 rounded-lg">
                                <div className="text-xl font-bold">{lastIpl.matches}</div>
                                <div className="text-[10px] text-muted-foreground">Matches</div>
                              </div>
                              <div className="text-center p-2.5 bg-muted/30 rounded-lg">
                                <div className="text-xl font-bold text-blue-400">{lastIpl.runs}</div>
                                <div className="text-[10px] text-muted-foreground">Runs</div>
                              </div>
                              <div className="text-center p-2.5 bg-muted/30 rounded-lg">
                                <div className="text-xl font-bold text-green-400">{lastIpl.wickets}</div>
                                <div className="text-[10px] text-muted-foreground">Wickets</div>
                              </div>
                              {bowlOversPerMatch != null && bowlOversPerMatch > 0 && (
                                <div className="col-span-2 text-center p-2.5 bg-muted/30 rounded-lg">
                                  <div className="text-xl font-bold text-purple-400">{bowlOversPerMatch.toFixed(1)}</div>
                                  <div className="text-[10px] text-muted-foreground">Avg Overs Bowled / Match</div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="col-span-2 text-center text-xs text-muted-foreground py-2">
                              No IPL season data
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="p-4 bg-muted/20 rounded-lg">
                      <p className="text-sm font-semibold mb-3">Average Points Breakdown</p>
                      {[
                        { label: "Batting", value: data.fantasyBreakdown.avgBatting, color: "bg-blue-500" },
                        { label: "Bowling", value: data.fantasyBreakdown.avgBowling, color: "bg-green-500" },
                        { label: "Fielding", value: data.fantasyBreakdown.avgFielding, color: "bg-purple-500" },
                        { label: "SR Bonus", value: data.fantasyBreakdown.avgSrBonus, color: "bg-amber-500" },
                        { label: "Econ Bonus", value: data.fantasyBreakdown.avgEconBonus, color: "bg-cyan-500" },
                        { label: "Starting XI", value: data.fantasyBreakdown.avgStartingXi, color: "bg-gray-500" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-3 mb-2">
                          <span className="text-xs text-muted-foreground w-20">{item.label}</span>
                          <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${item.color} rounded-full`}
                              style={{
                                width: `${Math.max(
                                  (Math.abs(item.value) / Math.max(data.fantasyBreakdown!.avgTotal, 1)) * 100,
                                  item.value !== 0 ? 2 : 0
                                )}%`,
                              }}
                            />
                          </div>
                          <span className={`text-xs font-medium w-12 text-right ${item.value < 0 ? "text-red-400" : ""}`}>
                            {item.value >= 0 ? "+" : ""}{item.value.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/20 rounded-lg">
                        <div className="text-sm text-muted-foreground">Consistency (lower = more consistent)</div>
                        <div className="text-lg font-bold">
                          {data.fantasyBreakdown.consistency.toFixed(1)}
                          <span className="text-xs text-muted-foreground ml-1">std dev</span>
                        </div>
                      </div>
                      <div className="p-3 bg-muted/20 rounded-lg">
                        <div className="text-sm text-muted-foreground">Matches Analyzed</div>
                        <div className="text-lg font-bold">{data.fantasyBreakdown.matchCount}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground py-4 text-center">No fantasy breakdown data available</p>
                )}
              </TabsContent>

              {/* Career Stats */}
              <TabsContent value="career">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Format</TableHead>
                      <TableHead className="text-right">Mat</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                      <TableHead className="text-right">Avg</TableHead>
                      <TableHead className="text-right">SR</TableHead>
                      <TableHead className="text-right">50s</TableHead>
                      <TableHead className="text-right">100s</TableHead>
                      <TableHead className="text-right">6s</TableHead>
                      <TableHead className="text-right">Wkts</TableHead>
                      <TableHead className="text-right">Econ</TableHead>
                      <TableHead className="text-right font-bold text-amber-400">
                        EFPPM
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.careerStats.map((cs) => (
                      <TableRow key={cs.format}>
                        <TableCell className="font-medium">
                          {cs.format}
                        </TableCell>
                        <TableCell className="text-right">
                          {cs.matches}
                        </TableCell>
                        <TableCell className="text-right">{cs.runs}</TableCell>
                        <TableCell className="text-right">
                          {cs.batAvg?.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {cs.batSr?.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {cs.fifties}
                        </TableCell>
                        <TableCell className="text-right">
                          {cs.hundreds}
                        </TableCell>
                        <TableCell className="text-right">
                          {cs.sixes}
                        </TableCell>
                        <TableCell className="text-right">
                          {cs.wickets}
                        </TableCell>
                        <TableCell className="text-right">
                          {cs.bowlEcon ? cs.bowlEcon.toFixed(1) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-400">
                          {cs.efppm?.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Season Stats */}
              <TabsContent value="seasons">
                {seasonData && (seasonData.leagueSeasons.length > 0 || seasonData.t20Seasons.length > 0) ? (
                  <div className="space-y-4">
                    {seasonData.leagueSeasons.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-amber-400">League Seasons (IPL · MLC · WPL)</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Season</TableHead>
                              <TableHead className="text-right">Mat</TableHead>
                              <TableHead className="text-right">Runs</TableHead>
                              <TableHead className="text-right">Avg</TableHead>
                              <TableHead className="text-right">SR</TableHead>
                              <TableHead className="text-right">50s</TableHead>
                              <TableHead className="text-right">6s</TableHead>
                              <TableHead className="text-right">Wkts</TableHead>
                              <TableHead className="text-right">Econ</TableHead>
                              <TableHead className="text-right font-bold text-amber-400">EFPPM</TableHead>
                              <TableHead className="text-right">Best</TableHead>
                              <TableHead className="text-right">Worst</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {seasonData.leagueSeasons.map((s) => (
                              <TableRow key={s.season}>
                                <TableCell className="font-medium">{s.season}</TableCell>
                                <TableCell className="text-right">{s.matches}</TableCell>
                                <TableCell className="text-right">{s.runs}</TableCell>
                                <TableCell className="text-right">{s.batAvg?.toFixed(1) ?? "—"}</TableCell>
                                <TableCell className="text-right">{s.batSr?.toFixed(1) ?? "—"}</TableCell>
                                <TableCell className="text-right">{s.fifties}</TableCell>
                                <TableCell className="text-right">{s.sixes}</TableCell>
                                <TableCell className="text-right">{s.wickets}</TableCell>
                                <TableCell className="text-right">{s.bowlEcon ? s.bowlEcon.toFixed(1) : "—"}</TableCell>
                                <TableCell className="text-right font-bold text-amber-400">{s.avgFantasyPoints?.toFixed(1)}</TableCell>
                                <TableCell className="text-right text-green-400">{s.bestMatch?.toFixed(0)}</TableCell>
                                <TableCell className="text-right text-red-400">{s.worstMatch?.toFixed(0)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {seasonData.t20Seasons.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-blue-400">T20 (Non-IPL) by Year</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Year</TableHead>
                              <TableHead className="text-right">Mat</TableHead>
                              <TableHead className="text-right">Runs</TableHead>
                              <TableHead className="text-right">Avg</TableHead>
                              <TableHead className="text-right">SR</TableHead>
                              <TableHead className="text-right">50s</TableHead>
                              <TableHead className="text-right">6s</TableHead>
                              <TableHead className="text-right">Wkts</TableHead>
                              <TableHead className="text-right">Econ</TableHead>
                              <TableHead className="text-right font-bold text-amber-400">EFPPM</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {seasonData.t20Seasons.map((s) => (
                              <TableRow key={s.season}>
                                <TableCell className="font-medium">{s.season}</TableCell>
                                <TableCell className="text-right">{s.matches}</TableCell>
                                <TableCell className="text-right">{s.runs}</TableCell>
                                <TableCell className="text-right">{s.batAvg?.toFixed(1) ?? "—"}</TableCell>
                                <TableCell className="text-right">{s.batSr?.toFixed(1) ?? "—"}</TableCell>
                                <TableCell className="text-right">{s.fifties}</TableCell>
                                <TableCell className="text-right">{s.sixes}</TableCell>
                                <TableCell className="text-right">{s.wickets}</TableCell>
                                <TableCell className="text-right">{s.bowlEcon ? s.bowlEcon.toFixed(1) : "—"}</TableCell>
                                <TableCell className="text-right font-bold text-amber-400">{s.avgFantasyPoints?.toFixed(1)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground py-4 text-center">No season data available</p>
                )}
              </TabsContent>

              {/* Recent Matches */}
              <TabsContent value="recent">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Fmt</TableHead>
                      <TableHead>vs</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                      <TableHead className="text-right">Balls</TableHead>
                      <TableHead className="text-right">4s</TableHead>
                      <TableHead className="text-right">6s</TableHead>
                      <TableHead className="text-right">Wkts</TableHead>
                      <TableHead className="text-right">Catches</TableHead>
                      <TableHead className="text-right font-bold text-amber-400">
                        FPts
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentMatches.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{m.date}</TableCell>
                        <TableCell>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              m.format === "WPL"
                                ? "bg-fuchsia-500/20 text-fuchsia-300"
                                : m.format === "IPL"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {m.format}
                          </span>
                        </TableCell>
                        <TableCell>{m.opposition}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {m.venue}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.batRuns ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.batBalls ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.bat4s ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.bat6s ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.bowlWickets ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {m.catches ?? 0}
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-400">
                          {m.fantasyPoints?.toFixed(0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Venue Stats */}
              <TabsContent value="venues">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Venue</TableHead>
                      <TableHead>Pitch</TableHead>
                      <TableHead className="text-right">Mat</TableHead>
                      <TableHead className="text-right">Bat Avg</TableHead>
                      <TableHead className="text-right">Bat SR</TableHead>
                      <TableHead className="text-right">Wkts</TableHead>
                      <TableHead className="text-right">Econ</TableHead>
                      <TableHead className="text-right font-bold text-amber-400">
                        EFPPM
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.venueStats.map((vs, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="font-medium">{vs.venueName}</div>
                          <div className="text-xs text-muted-foreground">
                            {vs.city}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {vs.pitchType || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {vs.matches}
                        </TableCell>
                        <TableCell className="text-right">
                          {vs.batAvg?.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {vs.batSr?.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {vs.bowlWickets}
                        </TableCell>
                        <TableCell className="text-right">
                          {vs.bowlEcon ? vs.bowlEcon.toFixed(1) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-400">
                          {vs.efppm?.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Opposition Stats */}
              <TabsContent value="opposition">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opposition</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead className="text-right">Mat</TableHead>
                      <TableHead className="text-right">Bat Avg</TableHead>
                      <TableHead className="text-right">Bat SR</TableHead>
                      <TableHead className="text-right">Wkts</TableHead>
                      <TableHead className="text-right">Econ</TableHead>
                      <TableHead className="text-right font-bold text-amber-400">
                        EFPPM
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.oppositionStats.map((os, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {os.opposition}
                        </TableCell>
                        <TableCell>{os.format}</TableCell>
                        <TableCell className="text-right">
                          {os.matches}
                        </TableCell>
                        <TableCell className="text-right">
                          {os.batAvg?.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {os.batSr?.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {os.bowlWickets}
                        </TableCell>
                        <TableCell className="text-right">
                          {os.bowlEcon ? os.bowlEcon.toFixed(1) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-400">
                          {os.efppm?.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
