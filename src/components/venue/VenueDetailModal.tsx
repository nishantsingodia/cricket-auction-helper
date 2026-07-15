"use client";

import { useEffect, useState } from "react";
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

type VenueType = "bat_road" | "balanced" | "bowl_friendly";
type PitchStyle = "pace" | "seam-swing" | "spin" | "mixed";

interface VenueProfile {
  style: PitchStyle;
  pace: number;
  swing: number;
  turn: number;
  note: string;
}

interface Venue {
  canonical: string;
  type: VenueType;
  typeLabel: string;
  homeTeams: string[];
  matches: number;
  fromDate: string | null;
  toDate: string | null;
  batFp: number | null;
  bowlFp: number | null;
  ratio: number | null;
  boundariesPerMatch: number | null;
  sixesPerMatch: number | null;
  wktsPerMatch: number | null;
  econ: number | null;
  avgFirstInnings: number | null;
  wickets: {
    spin: number;
    pace: number;
    total: number;
    spinPct: number | null;
    pacePct: number | null;
    coverage: number;
    spinRates: { avg: number | null; sr: number | null; econ: number | null };
    paceRates: { avg: number | null; sr: number | null; econ: number | null };
  };
  profile: VenueProfile | null;
  recent: Array<{
    matchId: string;
    date: string;
    format: string;
    runs: number;
    sixes: number;
    wkts: number;
    top: { name: string; fp: number } | null;
  }>;
}

interface VenueData {
  tour: string;
  neutral: boolean;
  gender: "male" | "female";
  venueFormats: string[];
  consensus: {
    lean: "batting" | "bowling" | "balanced";
    marginPct: number;
    batFp: number | null;
    bowlFp: number | null;
    matches: number;
  };
  venues: Venue[];
}

const TYPE_META: Record<VenueType, { label: string; cls: string; emoji: string }> = {
  bat_road: { label: "Bat-friendly", cls: "bg-red-600 text-white", emoji: "🏏" },
  balanced: { label: "Balanced", cls: "bg-amber-500 text-black", emoji: "⚖️" },
  bowl_friendly: { label: "Bowl-friendly", cls: "bg-emerald-600 text-white", emoji: "🎳" },
};

const STYLE_LABEL: Record<PitchStyle, string> = {
  pace: "Pace & bounce",
  "seam-swing": "Seam & swing",
  spin: "Spin-friendly",
  mixed: "Mixed threat",
};

function short(canonical: string): string {
  return canonical.split(",")[0].trim();
}

// 1–5 curated rating bar.
function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-2.5 w-4 rounded-sm ${i <= value ? "bg-amber-400" : "bg-muted"}`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{value}/5</span>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function VenueDetailModal({
  tour,
  initialVenue,
  onClose,
}: {
  tour: string;
  initialVenue: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<VenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(initialVenue);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/venues?tour=${encodeURIComponent(tour)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: VenueData) => {
        if (!alive) return;
        setData(d);
        setSelected((cur) => cur ?? d.venues[0]?.canonical ?? null);
      })
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tour]);

  const venue = data?.venues.find((v) => v.canonical === selected) ?? data?.venues[0] ?? null;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="w-[95vw] max-w-[860px] max-h-[90vh] overflow-y-auto p-3 sm:p-4">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
            🏟 Venue Conditions
            <span className="text-sm font-normal text-muted-foreground">— {tour}</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground py-8 text-center">Loading venue conditions…</p>
        ) : !data || !venue ? (
          <p className="text-muted-foreground py-8 text-center">No venue data for this tour.</p>
        ) : (
          <div className="mt-2 space-y-4">
            {/* Tour bat-vs-bowl consensus banner */}
            {data.consensus.batFp != null && data.consensus.bowlFp != null && (
              <div className={`rounded-lg border p-3 ${
                data.consensus.lean === "bowling"
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : data.consensus.lean === "batting"
                  ? "border-red-500/40 bg-red-500/5"
                  : "border-amber-500/40 bg-amber-500/5"
              }`}>
                <div className="text-sm font-semibold">
                  📊 Tour lean:{" "}
                  {data.consensus.lean === "balanced" ? (
                    <span className="text-amber-400">Balanced (no clear edge)</span>
                  ) : (
                    <>
                      <span className={data.consensus.lean === "bowling" ? "text-emerald-400" : "text-red-400"}>
                        favour {data.consensus.lean === "bowling" ? "BOWLERS" : "BATTERS"}
                      </span>{" "}
                      by ~{data.consensus.marginPct}%
                    </>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Across this tour&apos;s grounds, {data.consensus.lean === "bowling" ? "bowlers" : "batters"} average more fantasy points
                  {" "}(bat {data.consensus.batFp} vs bowl {data.consensus.bowlFp} avg FP, {data.consensus.matches} matches).
                  Same bat-FP ÷ bowl-FP read EFPPM uses — spend accordingly.
                </p>
              </div>
            )}

            {data.neutral && (
              <p className="text-xs text-amber-500/90">
                Neutral-venue festival — no home grounds. All {data.venues.length} grounds are shared across the teams.
              </p>
            )}

            {/* Ground selector */}
            <div className="flex flex-wrap gap-1.5">
              {data.venues.map((v) => {
                const m = TYPE_META[v.type];
                const isSel = v.canonical === venue.canonical;
                return (
                  <button
                    key={v.canonical}
                    type="button"
                    onClick={() => setSelected(v.canonical)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      isSel
                        ? "border-amber-400 bg-amber-400/15 font-semibold"
                        : "border-border hover:border-amber-400/60"
                    }`}
                    title={m.label}
                  >
                    <span className="mr-1" aria-hidden>{m.emoji}</span>
                    {short(v.canonical)}
                  </button>
                );
              })}
            </div>

            {/* Character header */}
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-base font-bold">{venue.canonical}</div>
                  {venue.homeTeams.length > 0 && (
                    <div className="text-xs text-muted-foreground">Home of {venue.homeTeams.join(", ")}</div>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${TYPE_META[venue.type].cls}`}>
                  {TYPE_META[venue.type].emoji} {venue.typeLabel}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Class is set from batting-FP ÷ bowling-FP — the same read the EFPPM valuation uses.
                {venue.ratio != null && (
                  <> This ground: <span className="text-foreground font-medium">{venue.ratio}</span> (bat {venue.batFp} vs bowl {venue.bowlFp} avg FP) over {venue.matches} matches
                    {venue.fromDate && venue.toDate ? `, ${venue.fromDate.slice(0, 4)}–${venue.toDate.slice(0, 4)}` : ""}.
                    {" "}&lt;0.95 = bowl-friendly, ≥1.10 = bat-friendly.</>
                )}
              </p>
            </div>

            {/* How it plays — data-derived */}
            <div>
              <h4 className="text-sm font-semibold text-amber-400 mb-2">How it plays — from match data</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Stat label="Avg 1st inns" value={venue.avgFirstInnings != null ? String(venue.avgFirstInnings) : "—"} sub="total runs" />
                <Stat label="Scoring rate" value={venue.econ != null ? venue.econ.toFixed(2) : "—"} sub="runs / over" />
                <Stat label="Wkts / match" value={venue.wktsPerMatch != null ? String(venue.wktsPerMatch) : "—"} sub="both teams" />
                <Stat label="Boundaries / match" value={venue.boundariesPerMatch != null ? String(venue.boundariesPerMatch) : "—"} sub="4s + 6s" />
                <Stat label="Sixes / match" value={venue.sixesPerMatch != null ? String(venue.sixesPerMatch) : "—"} />
                <Stat label="Matches" value={String(venue.matches)} sub={data.venueFormats.join("+") + ` · ${data.gender === "male" ? "men" : "women"}`} />
              </div>

              {/* Wickets by bowler type — data-derived (bowl_wickets × bowler-style map) */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">Wickets: spin vs pace</span>
                  {venue.wickets.coverage >= 40 && venue.wickets.spinPct != null && (
                    <span className="text-muted-foreground">
                      <span className="text-purple-400 font-medium">{venue.wickets.spinPct}% spin</span>
                      {" · "}
                      <span className="text-sky-400 font-medium">{venue.wickets.pacePct}% pace</span>
                    </span>
                  )}
                </div>
                {venue.wickets.coverage >= 40 && venue.wickets.spinPct != null ? (
                  <>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div className="bg-purple-500" style={{ width: `${venue.wickets.spinPct}%` }} />
                      <div className="bg-sky-500" style={{ width: `${venue.wickets.pacePct}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      From {venue.wickets.spin + venue.wickets.pace} classified wickets — {venue.wickets.coverage}% of the {venue.wickets.total} taken here have a known bowler style. Run-outs excluded.
                    </p>
                    {/* effectiveness: avg (best single metric) / strike rate / economy */}
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="text-left font-medium py-1"></th>
                            <th className="text-right font-medium py-1" title="Runs per wicket — the best single measure of wicket-taking value (lower = better)">Avg ▾</th>
                            <th className="text-right font-medium py-1" title="Balls per wicket — how often wickets fall (lower = strikes more often)">Balls/wkt</th>
                            <th className="text-right font-medium py-1" title="Runs per over conceded (lower = more economical)">Econ</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-0.5"><span className="text-purple-400 font-medium">Spin</span></td>
                            <td className="text-right tabular-nums">{venue.wickets.spinRates.avg ?? "—"}</td>
                            <td className="text-right tabular-nums">{venue.wickets.spinRates.sr ?? "—"}</td>
                            <td className="text-right tabular-nums">{venue.wickets.spinRates.econ ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="py-0.5"><span className="text-sky-400 font-medium">Pace</span></td>
                            <td className="text-right tabular-nums">{venue.wickets.paceRates.avg ?? "—"}</td>
                            <td className="text-right tabular-nums">{venue.wickets.paceRates.sr ?? "—"}</td>
                            <td className="text-right tabular-nums">{venue.wickets.paceRates.econ ?? "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        <span className="font-medium">Average (runs/wicket)</span> is the best all-round read — it folds in both strike rate and economy. Lower is better on all three.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Not enough classified wickets to show a reliable split ({venue.wickets.coverage}% of {venue.wickets.total} bowler styles known here).
                  </p>
                )}
              </div>
            </div>

            {/* Pitch profile — curated */}
            {venue.profile && (
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-amber-400">
                    Pitch profile — spin / pace
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-600/80 text-white font-medium">
                    {STYLE_LABEL[venue.profile.style]}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                  <Meter label="Pace" value={venue.profile.pace} />
                  <Meter label="Swing" value={venue.profile.swing} />
                  <Meter label="Turn" value={venue.profile.turn} />
                </div>
                <p className="mt-2 text-xs text-foreground/90">{venue.profile.note}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground italic">
                  ⚠ Curated cricket-knowledge read of how the surface behaves — separate from the wicket split above
                  (which also depends on how much spin vs pace is actually bowled). For context only; does
                  <span className="font-medium"> not</span> feed the EFPPM valuation.
                </p>
              </div>
            )}

            {/* Recent matches at this ground */}
            <div>
              <h4 className="text-sm font-semibold text-amber-400 mb-2">Recent matches here</h4>
              {venue.recent.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matches in the read window.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Fmt</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                      <TableHead className="text-right">6s</TableHead>
                      <TableHead className="text-right">Wkts</TableHead>
                      <TableHead>Top performer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {venue.recent.map((m) => (
                      <TableRow key={m.matchId}>
                        <TableCell className="whitespace-nowrap">{m.date}</TableCell>
                        <TableCell>{m.format}</TableCell>
                        <TableCell className="text-right">{m.runs}</TableCell>
                        <TableCell className="text-right">{m.sixes}</TableCell>
                        <TableCell className="text-right">{m.wkts}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {m.top ? `${m.top.name} (${Math.round(m.top.fp)})` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Runs/wkts are match totals (both teams) from the {data.venueFormats.join("+")} history at this ground.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
