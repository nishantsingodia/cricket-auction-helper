"use client";

import { useEffect, useState, useCallback, useRef, useMemo, memo } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlayerDetailModal } from "@/components/player/PlayerDetailModal";
import { SellDialog } from "@/components/auction/SellDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ──────────────────────────────────────────────────────────

interface Participant {
  id: number;
  name: string;
  short_name: string;
  color: string;
  purse: number;
  remaining_purse: number;
  is_me: boolean | number;
}

interface PoolPlayer {
  pool_id: number;
  player_id: number;
  name: string;
  country: string;
  role: string;
  bat_style: string;
  bowl_style: string;
  is_overseas: boolean | number;
  base_price: number;
  status: string;
  sold_to_participant: number | null;
  sold_price: number | null;
  sold_at: string | null;
  ipl_team: string;
  squad_number: number;
  efppm: number;
  val_floor: number;
  val_expected: number;
  val_ceiling: number;
  matches: number;
  runs: number;
  bat_avg: number;
  bat_sr: number;
  fifties: number;
  hundreds: number;
  sixes: number;
  wickets: number;
  bowl_avg: number;
  bowl_econ: number;
  bowl_overs_avg: number | null;
  catches: number;
  avg_fantasy_points: number;
  availability: string | null;
  risk_note: string | null;
}

interface AuctionData {
  auction: {
    id: number;
    name: string;
    tournament_id: number;
    tournament_name: string;
    num_friends: number;
    purse_per_friend: number;
    players_per_friend: number;
    num_captains: number;
    num_vice_captains: number;
    status: string;
  };
  participants: Participant[];
  pool: PoolPlayer[];
  watchlist: Record<
    number,
    { color: string | null; priority: number; notes: string | null }
  >;
  teamPitchBreakdown: Record<string, { F: number; B: number; T: number }>;
}

// IPL Best-of-12: top 12 are "Playing XII", rest are bench
const PLAYING_XI_SIZE = 12;

// ── IPL Team Colors ────────────────────────────────────────────────

const IPL_COLORS: Record<string, string> = {
  CSK: "#FFC107",
  MI: "#004BA0",
  RCB: "#D32F2F",
  KKR: "#3A225D",
  DC: "#0078BC",
  SRH: "#FF822A",
  RR: "#EA1A85",
  PBKS: "#ED1B24",
  GT: "#1C3879",
  LSG: "#A72056",
};

// ── Configurable Price Slabs ──────────────────────────────────────

interface PriceSlab {
  min: number;
  color: string; // key into COLOR_PALETTE
}

const COLOR_PALETTE: Record<string, {
  bgLight: string; bgDark: string;
  textLight: string; textDark: string;
  legendBg: string;
}> = {
  emerald: { bgLight: "bg-emerald-200", bgDark: "dark:bg-emerald-900/50", textLight: "text-emerald-700", textDark: "dark:text-emerald-300", legendBg: "bg-emerald-300 dark:bg-emerald-800" },
  sky:     { bgLight: "bg-sky-200",     bgDark: "dark:bg-sky-900/50",     textLight: "text-sky-700",     textDark: "dark:text-sky-300",     legendBg: "bg-sky-300 dark:bg-sky-800" },
  violet:  { bgLight: "bg-violet-200",  bgDark: "dark:bg-violet-900/50",  textLight: "text-violet-700",  textDark: "dark:text-violet-300",  legendBg: "bg-violet-300 dark:bg-violet-800" },
  amber:   { bgLight: "bg-amber-200",   bgDark: "dark:bg-amber-900/50",   textLight: "text-amber-700",   textDark: "dark:text-amber-300",   legendBg: "bg-amber-300 dark:bg-amber-800" },
  orange:  { bgLight: "bg-orange-200",  bgDark: "dark:bg-orange-900/40",  textLight: "text-orange-700",  textDark: "dark:text-orange-300",  legendBg: "bg-orange-300 dark:bg-orange-800" },
  rose:    { bgLight: "bg-rose-200",    bgDark: "dark:bg-rose-900/50",    textLight: "text-rose-700",    textDark: "dark:text-rose-300",    legendBg: "bg-rose-300 dark:bg-rose-800" },
};

const DEFAULT_SLABS: PriceSlab[] = [
  { min: 25, color: "emerald" },
  { min: 20, color: "sky" },
  { min: 15, color: "violet" },
  { min: 10, color: "amber" },
  { min: 5,  color: "orange" },
];

// Module-level ref — synced from component state each render
let _activeSlabs: PriceSlab[] = DEFAULT_SLABS;

function getPriceColor(price: number): string {
  const sorted = [..._activeSlabs].sort((a, b) => b.min - a.min);
  for (const slab of sorted) {
    if (price >= slab.min) {
      const c = COLOR_PALETTE[slab.color];
      return c ? `${c.bgLight} ${c.bgDark}` : "";
    }
  }
  return "bg-gray-100 dark:bg-gray-900/30";
}

function getPriceTextColor(price: number): string {
  const sorted = [..._activeSlabs].sort((a, b) => b.min - a.min);
  for (const slab of sorted) {
    if (price >= slab.min) {
      const c = COLOR_PALETTE[slab.color];
      return c ? `${c.textLight} ${c.textDark}` : "";
    }
  }
  return "text-muted-foreground";
}

function getSlabLegend(slabs: PriceSlab[]) {
  const sorted = [...slabs].sort((a, b) => b.min - a.min);
  return sorted.map((s, i) => {
    const c = COLOR_PALETTE[s.color];
    const nextMin = i < sorted.length - 1 ? sorted[i + 1].min : null;
    const label = i === 0 ? `${s.min}+` : nextMin !== null ? `${s.min}-${sorted[i - 1].min}` : `${s.min}-${sorted[i - 1].min}`;
    return { label: i === 0 ? `${s.min}+` : `${s.min}-${sorted[i - 1].min}`, legendBg: c?.legendBg || "" };
  });
}

// ── Main Page ──────────────────────────────────────────────────────

export default function AuctionPage() {
  const params = useParams();
  const auctionId = Number(params.id);

  const [data, setData] = useState<AuctionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");

  // Modal states
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [sellPlayer, setSellPlayer] = useState<PoolPlayer | null>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showIntel, setShowIntel] = useState(false);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Price slab config
  const [priceSlabs, setPriceSlabs] = useState<PriceSlab[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("auctionPriceSlabs");
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return DEFAULT_SLABS;
  });
  const [editingSlabs, setEditingSlabs] = useState(false);

  // Sync module-level ref so getPriceColor/getPriceTextColor use current config
  _activeSlabs = priceSlabs;

  const updateSlabs = (newSlabs: PriceSlab[]) => {
    setPriceSlabs(newSlabs);
    localStorage.setItem("auctionPriceSlabs", JSON.stringify(newSlabs));
  };

  // Masterlist search
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/auction/${auctionId}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch auction:", err);
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleWatchlist = useCallback(async (playerId: number) => {
    const isWatched = data ? playerId in data.watchlist : false;
    if (isWatched) {
      await fetch(
        `/api/watchlist?auctionId=${auctionId}&playerId=${playerId}`,
        { method: "DELETE" }
      );
    } else {
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId, playerId }),
      });
    }
    fetchData();
  }, [auctionId, fetchData]);

  const handleUndo = useCallback(async (playerId: number) => {
    await fetch("/api/auction/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId, playerId }),
    });
    fetchData();
  }, [auctionId, fetchData]);

  const handleReorder = useCallback(async (team: string, playerOrder: number[]) => {
    await fetch("/api/pool/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId, iplTeam: team, playerOrder }),
    });
    // Refetch to get recalculated prices (squad position affects expected matches & pricing)
    fetchData();
  }, [auctionId, fetchData]);

  const handleRiskToggle = useCallback(async (poolId: number, currentNote: string | null) => {
    if (currentNote) {
      await fetch("/api/pool/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId, risk_note: null }),
      });
    } else {
      const note = window.prompt(
        "Risk reason (e.g. foreign slot clash, injury prone, might be benched):"
      );
      if (note === null) return;
      await fetch("/api/pool/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId, risk_note: note || "Risky" }),
      });
    }
    fetchData();
  }, [fetchData]);

  const handlePriceChange = async (poolId: number, newPrice: number) => {
    await fetch("/api/pool/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolId, val_expected: newPrice }),
    });
    fetchData();
  };

  // All hooks must be before early returns to satisfy Rules of Hooks
  const auction = data?.auction;
  const participants = data?.participants ?? [];
  const pool = data?.pool ?? [];
  const watchlist = data?.watchlist ?? {};
  const teamPitchBreakdown = data?.teamPitchBreakdown ?? {};
  const myParticipant = participants.find((p) => p.is_me);
  const myId = myParticipant?.id;

  // ── Dynamic pricing: market factor (memoized) ──
  const { marketFactor, getAdjustedPrice } = useMemo(() => {
    if (!auction) return { marketFactor: 1, getAdjustedPrice: (_p: PoolPlayer) => 0 };
    const totalRemainingPurse = participants.reduce((s, p) => s + p.remaining_purse, 0);
    const soldCount = pool.filter((p) => p.status === "SOLD").length;
    const totalSlots = auction.num_friends * auction.players_per_friend;
    const slotsRemaining = Math.max(1, totalSlots - soldCount);

    const availablePriced = pool
      .filter((p) => p.status === "AVAILABLE" && p.val_expected > 0)
      .sort((a, b) => b.val_expected - a.val_expected);
    const topN = availablePriced.slice(0, slotsRemaining);
    const sumTopNPrices = topN.reduce((s, p) => s + p.val_expected, 0);
    const mf = sumTopNPrices > 0 ? totalRemainingPurse / sumTopNPrices : 1;
    const clamped = Math.max(0.3, Math.min(2.0, mf));

    const getAdj = (p: PoolPlayer) => {
      if (p.val_expected <= 0) return 0;
      return Math.round(p.val_expected * clamped);
    };

    return { marketFactor: mf, getAdjustedPrice: getAdj };
  }, [pool, participants, auction]);

  // Group & sort players by IPL team (memoized)
  const sortedTeams = useMemo(() => {
    const teamGroups = new Map<string, PoolPlayer[]>();
    for (const p of pool) {
      const team = p.ipl_team || "Unknown";
      if (!teamGroups.has(team)) teamGroups.set(team, []);
      teamGroups.get(team)!.push(p);
    }
    for (const [, players] of teamGroups) {
      players.sort((a, b) => {
        const aXI = a.squad_number >= 1 && a.squad_number <= PLAYING_XI_SIZE;
        const bXI = b.squad_number >= 1 && b.squad_number <= PLAYING_XI_SIZE;
        if (aXI && !bXI) return -1;
        if (!aXI && bXI) return 1;
        if (aXI && bXI) return a.squad_number - b.squad_number;
        return (b.efppm || 0) - (a.efppm || 0);
      });
    }
    const teamOrder = ["CSK", "MI", "RCB", "KKR", "DC", "SRH", "RR", "PBKS", "GT", "LSG"];
    return [...teamGroups.entries()].sort(
      ([a], [b]) =>
        (teamOrder.indexOf(a) === -1 ? 99 : teamOrder.indexOf(a)) -
        (teamOrder.indexOf(b) === -1 ? 99 : teamOrder.indexOf(b))
    );
  }, [pool]);

  const getPlayerBg = useCallback((p: PoolPlayer) => {
    if (p.status !== "SOLD" || !p.sold_to_participant) return "";
    if (p.sold_to_participant === myId) return "bg-green-700 dark:bg-green-800";
    return "bg-muted/40 opacity-60";
  }, [myId]);

  const getWatchlistBorder = useCallback((playerId: number) => {
    if (playerId in watchlist) return "ring-2 ring-amber-500/60";
    return "";
  }, [watchlist]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading auction...</p>
      </div>
    );
  }

  if (!data || !auction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-red-500">Auction not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
            &larr; Home
          </a>
          <h1 className="font-bold text-lg">{auction.name}</h1>
          <Badge variant="outline">{auction.tournament_name}</Badge>

          <div className="flex-1" />

          {/* Purse chips */}
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border"
                style={{ borderColor: p.color }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <span className="font-medium">{p.short_name}</span>
                <span className="text-muted-foreground">
                  {p.remaining_purse.toFixed(1)}/{p.purse}
                </span>
              </div>
            ))}
          </div>

          {/* Market factor badge */}
          <div className={`text-xs px-2 py-1 rounded-full border ${marketFactor > 1.05 ? "border-green-500 text-green-600 dark:text-green-400" : marketFactor < 0.95 ? "border-red-500 text-red-600 dark:text-red-400" : "border-border text-muted-foreground"}`}
            title={`Market factor: prices ${marketFactor > 1 ? "inflated" : "discounted"} by ${((marketFactor - 1) * 100).toFixed(0)}% based on remaining purse vs top player values`}
          >
            Mkt {marketFactor.toFixed(2)}x
          </div>

          {/* Price legend — click to edit */}
          <div className="relative">
            <div
              className="flex items-center gap-1 cursor-pointer"
              onClick={() => setEditingSlabs((v) => !v)}
              title="Click to edit price tiers"
            >
              {getSlabLegend(priceSlabs).map((s) => (
                <div key={s.label} className={`${s.legendBg} text-[9px] px-1.5 py-0.5 rounded`}>
                  {s.label}
                </div>
              ))}
              <span className="text-[9px] text-muted-foreground/50 ml-0.5">✎</span>
            </div>
            {editingSlabs && (
              <SlabEditor
                slabs={priceSlabs}
                onChange={updateSlabs}
                onClose={() => setEditingSlabs(false)}
              />
            )}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setView("grid")}
              className={`px-3 py-1.5 text-sm ${
                view === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 text-sm ${
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              Masterlist
            </button>
          </div>

          <button
            onClick={() => setShowCalc((v) => !v)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${showCalc ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            Calc
          </button>

          <button
            onClick={() => setShowIntel((v) => !v)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${showIntel ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            Intel
          </button>

          <button
            onClick={() => setShowChat((v) => !v)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${showChat ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            Quick Sell
          </button>

          <button
            onClick={() => setShowAdvisor((v) => !v)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${showAdvisor ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            AI Advisor
          </button>

          <button
            onClick={() => setShowAvailability((v) => !v)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${
              showAvailability ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            } ${pool.some((p) => p.availability && p.availability !== "FIT") ? "border-red-500/50" : ""}`}
          >
            Availability
          </button>

          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`px-3 py-1.5 text-sm rounded-lg border ${showSettings ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            Settings
          </button>

          <ThemeToggle />
        </div>
      </div>

      {/* Auction Settings Panel */}
      {showSettings && (
        <AuctionSettings
          auction={auction}
          auctionId={auctionId}
          onUpdate={fetchData}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Auction Intelligence Panel */}
      {showIntel && (
        <AuctionIntel
          pool={pool}
          participants={participants}
          myId={myId}
          pursePerFriend={auction.purse_per_friend}
          playersPerFriend={auction.players_per_friend}
          getAdjustedPrice={getAdjustedPrice}
        />
      )}

      {/* Availability Panel */}
      {showAvailability && (
        <AvailabilityPanel pool={pool} onUpdate={fetchData} />
      )}

      {/* Content */}
      <div className="flex">
        <div className={`flex-1 ${showCalc ? "mr-[320px]" : ""}`}>
          {view === "grid" ? (
            <SquadGrid
              sortedTeams={sortedTeams}
              watchlist={watchlist}
              myId={myId}
              participants={participants}
              auctionId={auctionId}
              getPlayerBg={getPlayerBg}
              getWatchlistBorder={getWatchlistBorder}
              onPlayerClick={setSelectedPlayerId}
              onSellClick={setSellPlayer}
              onWatchlistToggle={toggleWatchlist}
              onUndo={handleUndo}
              onReorder={handleReorder}
              onPriceChange={handlePriceChange}
              onRiskToggle={handleRiskToggle}
              getAdjustedPrice={getAdjustedPrice}
              marketFactor={marketFactor}
              teamPitchBreakdown={teamPitchBreakdown}
            />
          ) : (
            <Masterlist
              pool={pool}
              search={search}
              onSearchChange={setSearch}
              watchlist={watchlist}
              myId={myId}
              participants={participants}
              getPlayerBg={getPlayerBg}
              onPlayerClick={setSelectedPlayerId}
              onSellClick={setSellPlayer}
              onWatchlistToggle={toggleWatchlist}
              onPriceChange={handlePriceChange}
              onRiskToggle={handleRiskToggle}
              getAdjustedPrice={getAdjustedPrice}
              marketFactor={marketFactor}
            />
          )}
        </div>

        {/* Budget Calculator Sidebar */}
        {showCalc && (
          <BudgetCalculator
            auctionId={auction.id}
            purse={auction.purse_per_friend}
            playersPerFriend={auction.players_per_friend}
            boughtPlayers={pool.filter((p) => p.status === "SOLD" && p.sold_to_participant === myId)}
          />
        )}
      </div>

      {/* Player Detail Modal */}
      {selectedPlayerId && (() => {
        const sp = pool.find((p) => p.player_id === selectedPlayerId);
        return (
          <PlayerDetailModal
            playerId={selectedPlayerId}
            onClose={() => setSelectedPlayerId(null)}
            riskNote={sp?.risk_note}
            poolId={sp?.pool_id}
            playerStatus={sp?.status}
            isWatched={sp ? sp.player_id in watchlist : false}
            onRiskToggle={handleRiskToggle}
            onSell={sp?.status === "AVAILABLE" ? () => { setSelectedPlayerId(null); setSellPlayer(sp); } : undefined}
            onUndo={sp?.status === "SOLD" ? () => { handleUndo(sp.player_id); setSelectedPlayerId(null); } : undefined}
            onWatchlist={sp ? () => toggleWatchlist(sp.player_id) : undefined}
          />
        );
      })()}

      {/* Quick Sell Chat */}
      {showChat && (
        <QuickSellChat auctionId={auctionId} onSold={fetchData} />
      )}

      {/* AI Advisor */}
      {showAdvisor && (
        <AuctionAdvisor
          pool={pool}
          participants={participants}
          myId={myId}
          marketFactor={marketFactor}
          getAdjustedPrice={getAdjustedPrice}
          pursePerFriend={auction.purse_per_friend}
          playersPerFriend={auction.players_per_friend}
          watchlist={watchlist}
          teamPitchBreakdown={teamPitchBreakdown}
        />
      )}

      {/* Sell Dialog */}
      {sellPlayer && (
        <SellDialog
          open={!!sellPlayer}
          onClose={() => setSellPlayer(null)}
          playerName={sellPlayer.name}
          playerId={sellPlayer.player_id}
          basePrice={sellPlayer.base_price}
          auctionId={auctionId}
          participants={participants}
          onSold={fetchData}
        />
      )}
    </div>
  );
}

// ── Squad Grid Component (with drag & drop) ───────────────────────

function SquadGrid({
  sortedTeams,
  watchlist,
  myId,
  participants,
  auctionId,
  getPlayerBg,
  getWatchlistBorder,
  onPlayerClick,
  onSellClick,
  onWatchlistToggle,
  onUndo,
  onReorder,
  onPriceChange,
  onRiskToggle,
  getAdjustedPrice,
  marketFactor,
  teamPitchBreakdown,
}: {
  sortedTeams: [string, PoolPlayer[]][];
  watchlist: Record<number, unknown>;
  myId: number | undefined;
  participants: Participant[];
  auctionId: number;
  getPlayerBg: (p: PoolPlayer) => string;
  getWatchlistBorder: (id: number) => string;
  onPlayerClick: (id: number) => void;
  onSellClick: (p: PoolPlayer) => void;
  onWatchlistToggle: (id: number) => void;
  onUndo: (id: number) => void;
  onReorder: (team: string, playerOrder: number[]) => void;
  onPriceChange: (poolId: number, price: number) => void;
  onRiskToggle: (poolId: number, currentNote: string | null) => void;
  getAdjustedPrice: (p: PoolPlayer) => number;
  marketFactor: number;
  teamPitchBreakdown: Record<string, { F: number; B: number; T: number }>;
}) {
  return (
    <div className="overflow-x-auto p-4">
      <div className="flex gap-3" style={{ minWidth: sortedTeams.length * 220 }}>
        {sortedTeams.map(([team, players]) => (
          <TeamColumn
            key={team}
            team={team}
            players={players}
            watchlist={watchlist}
            myId={myId}
            getPlayerBg={getPlayerBg}
            getWatchlistBorder={getWatchlistBorder}
            onPlayerClick={onPlayerClick}
            onSellClick={onSellClick}
            onWatchlistToggle={onWatchlistToggle}
            onUndo={onUndo}
            onReorder={(order) => onReorder(team, order)}
            onPriceChange={onPriceChange}
            onRiskToggle={onRiskToggle}
            getAdjustedPrice={getAdjustedPrice}
            marketFactor={marketFactor}
            pitchBreakdown={teamPitchBreakdown[team]}
          />
        ))}
      </div>
    </div>
  );
}

// ── Sortable Team Column ───────────────────────────────────────────

function TeamColumn({
  team,
  players: initialPlayers,
  watchlist,
  myId,
  getPlayerBg,
  getWatchlistBorder,
  onPlayerClick,
  onSellClick,
  onWatchlistToggle,
  onUndo,
  onReorder,
  onPriceChange,
  onRiskToggle,
  getAdjustedPrice,
  marketFactor,
  pitchBreakdown,
}: {
  team: string;
  players: PoolPlayer[];
  watchlist: Record<number, unknown>;
  myId: number | undefined;
  getPlayerBg: (p: PoolPlayer) => string;
  getWatchlistBorder: (id: number) => string;
  onPlayerClick: (id: number) => void;
  onSellClick: (p: PoolPlayer) => void;
  onWatchlistToggle: (id: number) => void;
  onUndo: (id: number) => void;
  onReorder: (playerOrder: number[]) => void;
  onPriceChange: (poolId: number, price: number) => void;
  onRiskToggle: (poolId: number, currentNote: string | null) => void;
  getAdjustedPrice: (p: PoolPlayer) => number;
  marketFactor: number;
  pitchBreakdown?: { F: number; B: number; T: number };
}) {
  const [players, setPlayers] = useState(initialPlayers);

  // Sync with parent when data refreshes
  useEffect(() => {
    setPlayers(initialPlayers);
  }, [initialPlayers]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = players.findIndex(
      (p) => String(p.player_id) === String(active.id)
    );
    const newIndex = players.findIndex(
      (p) => String(p.player_id) === String(over.id)
    );

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(players, oldIndex, newIndex);
    // Update squad numbers: 1-based
    const renumbered = newOrder.map((p, i) => ({
      ...p,
      squad_number: i + 1,
    }));
    setPlayers(renumbered);

    // Persist to backend
    onReorder(renumbered.map((p) => p.player_id));
  };

  const playerIds = players.map((p) => String(p.player_id));
  const overseasInXII = players.filter((p, i) => i < PLAYING_XI_SIZE && p.is_overseas).length;

  return (
    <div className="flex-shrink-0 w-[210px]">
      {/* Team Header */}
      <div
        className="rounded-t-lg px-3 py-2 text-white font-bold text-center text-sm"
        style={{ backgroundColor: IPL_COLORS[team] || "#555" }}
      >
        {team}
        {pitchBreakdown && (pitchBreakdown.F + pitchBreakdown.B + pitchBreakdown.T) > 0 ? (
          <span className="ml-1 font-normal text-xs opacity-80" title="Flat / Balanced / Tricky pitches">
            ({pitchBreakdown.F}F+{pitchBreakdown.B}B+{pitchBreakdown.T}T)
          </span>
        ) : (
          <span className="ml-1 font-normal text-xs opacity-80">
            ({players.length})
          </span>
        )}
        <span className={`ml-1 text-[10px] font-normal ${overseasInXII > 4 ? "bg-red-600 px-1 rounded" : "opacity-80"}`}
          title={`${overseasInXII}/4 overseas in Playing XII`}>
          ✈{overseasInXII}/4
        </span>
      </div>

      {/* Players — sortable */}
      <div className="border border-t-0 border-border rounded-b-lg bg-card">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={playerIds}
            strategy={verticalListSortingStrategy}
          >
            {players.map((p, idx) => (
              <SortablePlayerCard
                key={p.player_id}
                player={p}
                index={idx}
                totalPlayers={players.length}
                bgClass={getPlayerBg(p)}
                watchlistClass={getWatchlistBorder(p.player_id)}
                isWatched={p.player_id in watchlist}
                isMine={p.status === "SOLD" && p.sold_to_participant === myId}
                onTap={() => onPlayerClick(p.player_id)}
                onSell={() => onSellClick(p)}
                onWatchlist={() => onWatchlistToggle(p.player_id)}
                onUndo={() => onUndo(p.player_id)}
                onPriceChange={(price) => onPriceChange(p.pool_id, price)}
                onRiskToggle={() => onRiskToggle(p.pool_id, p.risk_note)}
                adjustedPrice={getAdjustedPrice(p)}
                marketFactor={marketFactor}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

// ── Sortable Player Card ───────────────────────────────────────────

function SortablePlayerCard({
  player: p,
  index,
  totalPlayers,
  bgClass,
  watchlistClass,
  isWatched,
  isMine,
  onTap,
  onSell,
  onWatchlist,
  onUndo,
  onPriceChange,
  onRiskToggle,
  adjustedPrice,
  marketFactor,
}: {
  player: PoolPlayer;
  index: number;
  totalPlayers: number;
  bgClass: string;
  watchlistClass: string;
  isWatched: boolean;
  isMine: boolean;
  onTap: () => void;
  onSell: () => void;
  onWatchlist: () => void;
  onUndo: () => void;
  onPriceChange: (price: number) => void;
  onRiskToggle: () => void;
  adjustedPrice: number;
  marketFactor: number;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(p.player_id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const showBenchSeparator = index === PLAYING_XI_SIZE && totalPlayers > PLAYING_XI_SIZE;
  const sqNum = index + 1;
  const priceColorClass = p.status === "AVAILABLE" && adjustedPrice > 0 ? getPriceColor(adjustedPrice) : "";
  const showBaseDiff = Math.abs(marketFactor - 1) > 0.05 && p.val_expected > 0;

  return (
    <>
      {showBenchSeparator && (
        <div className="text-center text-[10px] text-muted-foreground py-1 border-t border-dashed border-border">
          BENCH
        </div>
      )}
      <div
        ref={setNodeRef}
        style={style}
        className={`group px-2 py-1.5 border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors ${bgClass || priceColorClass} ${watchlistClass} ${
          isDragging ? "shadow-lg bg-card" : ""
        }`}
      >
        <div className="flex items-start gap-1">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing mt-0.5 touch-none"
            title="Drag to reorder"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <circle cx="3" cy="2" r="1" />
              <circle cx="7" cy="2" r="1" />
              <circle cx="3" cy="5" r="1" />
              <circle cx="7" cy="5" r="1" />
              <circle cx="3" cy="8" r="1" />
              <circle cx="7" cy="8" r="1" />
            </svg>
          </button>

          {/* Watchlist star */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onWatchlist();
            }}
            className={`text-xs mt-0.5 ${
              isWatched
                ? "text-amber-400"
                : "text-muted-foreground/40 hover:text-amber-400"
            }`}
            title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
          >
            {isWatched ? "\u2605" : "\u2606"}
          </button>

          {/* Player info — click opens detail */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onTap}>
            {/* Row 1: Name (full width at rest, truncated on hover to fit actions) */}
            <div className="flex items-center gap-1">
              <span className={`text-[10px] w-3 shrink-0 ${isMine ? "text-white/70" : "text-muted-foreground/60"}`}>
                {sqNum}
              </span>
              <span className={`text-xs font-medium group-hover:truncate ${
                p.status === "SOLD"
                  ? isMine
                    ? "text-white font-bold"
                    : "line-through text-muted-foreground"
                  : ""
              }`}>{p.name}</span>
              {p.is_overseas ? (
                <span className={`text-lg shrink-0 leading-none ${isMine ? "text-yellow-300" : "text-blue-400"}`} title="Overseas">✈</span>
              ) : null}
              {p.risk_note && (
                <span className="text-[9px] shrink-0 text-red-500" title={p.risk_note}>⚠</span>
              )}
              {/* Sold: undo on hover */}
              {p.status === "SOLD" && (
                <button
                  onClick={(e) => { e.stopPropagation(); onUndo(); }}
                  className="ml-auto text-[9px] opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-foreground shrink-0"
                >
                  undo
                </button>
              )}
              {/* Sell + Risk — only on hover, pushed right */}
              {p.status === "AVAILABLE" && (
                <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSell(); }}
                    className="text-[9px] px-1 py-0.5 rounded text-muted-foreground hover:text-foreground"
                  >
                    sell
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRiskToggle(); }}
                    className={`text-[9px] px-1 py-0.5 rounded ${p.risk_note ? "text-red-500 hover:text-red-400" : "text-muted-foreground/50 hover:text-red-500"}`}
                    title={p.risk_note ? `Risk: ${p.risk_note} — click to clear` : "Flag as risky"}
                  >
                    {p.risk_note ? "⚠✕" : "⚠"}
                  </button>
                </span>
              )}
            </div>
            {/* Row 2: EFPPM + Price (always visible below name) */}
            {p.status === "AVAILABLE" && (adjustedPrice > 0 || p.efppm > 0) && (
              <div className="flex items-center gap-1 ml-4">
                {p.efppm > 0 && (
                  <span className="text-[9px] text-muted-foreground/70">{p.efppm.toFixed(0)} FP</span>
                )}
                {adjustedPrice > 0 && !editingPrice && (
                  <span
                    className={`text-xs font-bold cursor-pointer hover:underline ${getPriceTextColor(adjustedPrice)}`}
                    title={`Base: ${p.val_expected?.toFixed(1)} | Mkt: ${marketFactor.toFixed(2)}x | Floor: ${p.val_floor?.toFixed(1)} | Ceil: ${p.val_ceiling?.toFixed(1)} — Click to edit base`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPriceInput(p.val_expected.toFixed(1));
                      setEditingPrice(true);
                    }}
                  >
                    {adjustedPrice.toFixed(1)}
                    {showBaseDiff && (
                      <span className="text-[8px] font-normal text-muted-foreground/60 ml-0.5">
                        ({p.val_expected.toFixed(1)})
                      </span>
                    )}
                  </span>
                )}
                {editingPrice && (
                  <input
                    type="number"
                    step="0.5"
                    className="w-12 text-xs px-1 py-0 h-4 border rounded bg-background text-right font-bold"
                    value={priceInput}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setPriceInput(e.target.value)}
                    onBlur={() => {
                      const val = parseFloat(priceInput);
                      if (!isNaN(val) && val > 0) onPriceChange(val);
                      setEditingPrice(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = parseFloat(priceInput);
                        if (!isNaN(val) && val > 0) onPriceChange(val);
                        setEditingPrice(false);
                      }
                      if (e.key === "Escape") setEditingPrice(false);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Masterlist Component ───────────────────────────────────────────

function Masterlist({
  pool,
  search,
  onSearchChange,
  watchlist,
  myId,
  participants,
  getPlayerBg,
  onPlayerClick,
  onSellClick,
  onWatchlistToggle,
  onPriceChange,
  onRiskToggle,
  getAdjustedPrice,
  marketFactor,
}: {
  pool: PoolPlayer[];
  search: string;
  onSearchChange: (s: string) => void;
  watchlist: Record<number, unknown>;
  myId: number | undefined;
  participants: Participant[];
  getPlayerBg: (p: PoolPlayer) => string;
  onPlayerClick: (id: number) => void;
  onSellClick: (p: PoolPlayer) => void;
  onWatchlistToggle: (id: number) => void;
  onPriceChange: (poolId: number, price: number) => void;
  onRiskToggle: (poolId: number, currentNote: string | null) => void;
  getAdjustedPrice: (p: PoolPlayer) => number;
  marketFactor: number;
}) {
  const [sortBy, setSortBy] = useState("efppm");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = pool
    .filter((p) =>
      !search || p.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const key = sortBy as keyof PoolPlayer;
      const va = (a[key] as number) || 0;
      const vb = (b[key] as number) || 0;
      return sortDir === "desc" ? vb - va : va - vb;
    });

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const SortInd = ({ col }: { col: string }) =>
    sortBy === col ? (
      <span className="ml-1">{sortDir === "desc" ? "\u2193" : "\u2191"}</span>
    ) : null;

  return (
    <div className="p-4">
      <div className="flex gap-3 mb-3">
        <Input
          placeholder="Search player..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-xs"
        />
        <Badge variant="secondary">{filtered.length} players</Badge>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-8">#</TableHead>
              <TableHead className="w-5"></TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Team</TableHead>
              <TableHead
                className="text-right cursor-pointer"
                onClick={() => handleSort("efppm")}
              >
                EFPPM <SortInd col="efppm" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer"
                onClick={() => handleSort("val_expected")}
              >
                Exp. Price <SortInd col="val_expected" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer"
                onClick={() => handleSort("matches")}
              >
                Mat <SortInd col="matches" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer"
                onClick={() => handleSort("runs")}
              >
                Runs <SortInd col="runs" />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer"
                onClick={() => handleSort("wickets")}
              >
                Wkts <SortInd col="wickets" />
              </TableHead>
              <TableHead className="text-right">Ov/M</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p, idx) => (
              <TableRow
                key={p.player_id}
                className={`group cursor-pointer hover:bg-muted/30 ${getPlayerBg(p) || (p.status === "AVAILABLE" ? getPriceColor(getAdjustedPrice(p)) : "")}`}
                onClick={() => onPlayerClick(p.player_id)}
              >
                <TableCell className="text-muted-foreground text-xs">
                  {idx + 1}
                </TableCell>
                <TableCell>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onWatchlistToggle(p.player_id);
                    }}
                    className={
                      p.player_id in watchlist
                        ? "text-amber-400"
                        : "text-muted-foreground/40 hover:text-amber-400"
                    }
                  >
                    {p.player_id in watchlist ? "\u2605" : "\u2606"}
                  </button>
                </TableCell>
                <TableCell className={`font-medium ${
                  p.status === "SOLD"
                    ? p.sold_to_participant === myId
                      ? "text-white font-bold"
                      : "line-through text-muted-foreground"
                    : ""
                }`}>
                  {p.name}
                  {p.is_overseas ? (
                    <span className="text-lg text-blue-400 ml-1 leading-none" title="Overseas">✈</span>
                  ) : null}
                  {p.risk_note && (
                    <span className="text-[10px] ml-1 text-red-500" title={p.risk_note}>⚠</span>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className="text-xs font-bold"
                    style={{ color: IPL_COLORS[p.ipl_team] }}
                  >
                    {p.ipl_team}
                  </span>
                </TableCell>
                <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400">
                  {p.efppm?.toFixed(1) || "—"}
                </TableCell>
                <TableCell className={`text-right font-bold ${getPriceTextColor(getAdjustedPrice(p))}`}>
                  <div className="flex flex-col items-end">
                    <EditablePrice
                      value={p.val_expected}
                      floor={p.val_floor}
                      ceiling={p.val_ceiling}
                      onChange={(v) => onPriceChange(p.pool_id, v)}
                      adjustedPrice={getAdjustedPrice(p)}
                      marketFactor={marketFactor}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {p.matches || "—"}
                </TableCell>
                <TableCell className="text-right">{p.runs || "—"}</TableCell>
                <TableCell className="text-right">
                  {p.wickets || "—"}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {p.bowl_overs_avg != null ? p.bowl_overs_avg.toFixed(1) : "—"}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {p.status === "AVAILABLE" && (
                      <button
                        className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSellClick(p);
                        }}
                      >
                        sell
                      </button>
                    )}
                    <button
                      className={`text-[10px] px-1 py-0.5 rounded ${p.risk_note ? "text-red-500 hover:text-red-400" : "text-muted-foreground/50 hover:text-red-500"}`}
                      title={p.risk_note ? `Risk: ${p.risk_note} — click to clear` : "Flag as risky"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRiskToggle(p.pool_id, p.risk_note);
                      }}
                    >
                      {p.risk_note ? "⚠✕" : "⚠"}
                    </button>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Editable Price Cell ───────────────────────────────────────────

function EditablePrice({
  value,
  floor,
  ceiling,
  onChange,
  adjustedPrice,
  marketFactor,
}: {
  value: number;
  floor: number;
  ceiling: number;
  onChange: (v: number) => void;
  adjustedPrice?: number;
  marketFactor?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");

  const displayPrice = adjustedPrice ?? value;
  const showBaseDiff = marketFactor !== undefined && Math.abs(marketFactor - 1) > 0.05 && value > 0;

  if (editing) {
    return (
      <input
        type="number"
        step="0.5"
        className="w-16 text-xs px-1 py-0.5 border rounded bg-background text-right"
        value={input}
        autoFocus
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setInput(e.target.value)}
        onBlur={() => {
          const val = parseFloat(input);
          if (!isNaN(val) && val > 0) onChange(val);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const val = parseFloat(input);
            if (!isNaN(val) && val > 0) onChange(val);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className="cursor-pointer hover:underline"
      title={`Base: ${value?.toFixed(1)} | Mkt: ${(marketFactor ?? 1).toFixed(2)}x | Range: ${floor?.toFixed(1)} - ${ceiling?.toFixed(1)} — Click to edit base`}
      onClick={(e) => {
        e.stopPropagation();
        setInput(value ? value.toFixed(1) : "0");
        setEditing(true);
      }}
    >
      {displayPrice ? `${displayPrice.toFixed(1)}Cr` : "—"}
      {showBaseDiff && (
        <span className="text-[9px] font-normal text-muted-foreground/60 ml-1">
          ({value.toFixed(1)})
        </span>
      )}
    </span>
  );
}

// ── Budget Calculator Sidebar ─────────────────────────────────────

interface BudgetSlab {
  id: number;
  count: number;
  price: number;
}

// ── Slab Editor (popover) ─────────────────────────────────────────

function SlabEditor({
  slabs,
  onChange,
  onClose,
}: {
  slabs: PriceSlab[];
  onChange: (s: PriceSlab[]) => void;
  onClose: () => void;
}) {
  const sorted = [...slabs].sort((a, b) => b.min - a.min);
  const colorNames = Object.keys(COLOR_PALETTE);

  const updateSlab = (idx: number, field: "min" | "color", value: string | number) => {
    const next = sorted.map((s, i) =>
      i === idx ? { ...s, [field]: field === "min" ? Number(value) : value } : s
    );
    onChange(next);
  };

  const removeSlab = (idx: number) => {
    if (sorted.length <= 1) return;
    onChange(sorted.filter((_, i) => i !== idx));
  };

  const addSlab = () => {
    const lowestMin = sorted.length > 0 ? sorted[sorted.length - 1].min : 10;
    const usedColors = new Set(sorted.map((s) => s.color));
    const freeColor = colorNames.find((c) => !usedColors.has(c)) || colorNames[0];
    onChange([...sorted, { min: Math.max(1, lowestMin - 5), color: freeColor }]);
  };

  return (
    <div className="absolute top-full right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg p-3 w-64">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold">Price Tiers</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>
      <div className="space-y-1.5">
        {sorted.map((slab, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground w-4 shrink-0">≥</span>
            <input
              type="number"
              min={1}
              step={1}
              value={slab.min}
              onChange={(e) => updateSlab(i, "min", e.target.value)}
              className="w-12 text-xs px-1.5 py-0.5 border rounded bg-background text-right"
            />
            <select
              value={slab.color}
              onChange={(e) => updateSlab(i, "color", e.target.value)}
              className="flex-1 text-xs px-1.5 py-0.5 border rounded bg-background"
            >
              {colorNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className={`w-4 h-4 rounded shrink-0 ${COLOR_PALETTE[slab.color]?.legendBg || ""}`} />
            <button
              onClick={() => removeSlab(i)}
              className="text-[10px] text-muted-foreground/50 hover:text-red-500 shrink-0"
              title="Remove tier"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <button onClick={addSlab} className="text-[10px] text-primary hover:underline">
          + Add tier
        </button>
        <button
          onClick={() => onChange([...DEFAULT_SLABS])}
          className="text-[10px] text-muted-foreground hover:underline"
        >
          Reset defaults
        </button>
      </div>
    </div>
  );
}

// ── Budget Calculator Sidebar ─────────────────────────────────────

function BudgetCalculator({
  auctionId,
  purse,
  playersPerFriend,
  boughtPlayers,
}: {
  auctionId: number;
  purse: number;
  playersPerFriend: number;
  boughtPlayers: PoolPlayer[];
}) {
  const boughtCount = boughtPlayers.length;
  const boughtSpend = boughtPlayers.reduce((s, p) => s + (p.sold_price || 0), 0);
  const remainingPurse = purse - boughtSpend;
  const remainingSlots = playersPerFriend - boughtCount;

  const STORAGE_KEY = `budget-calc-slabs-${auctionId}`;
  const DEFAULT_SLABS: BudgetSlab[] = [
    { id: 1, count: 3, price: 25 },
    { id: 2, count: 5, price: 15 },
    { id: 3, count: 7, price: 10 },
    { id: 4, count: 10, price: 5 },
    { id: 5, count: 10, price: 2 },
  ];

  const [slabs, setSlabs] = useState<BudgetSlab[]>(() => {
    if (typeof window === "undefined") return DEFAULT_SLABS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SLABS;
    } catch { return DEFAULT_SLABS; }
  });

  // Persist to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(slabs)); } catch {}
  }, [slabs, STORAGE_KEY]);

  const totalPlayers = slabs.reduce((s, sl) => s + sl.count, 0);
  const totalSpend = slabs.reduce((s, sl) => s + sl.count * sl.price, 0);
  const remaining = remainingPurse - totalSpend;
  const playersRemaining = remainingSlots - totalPlayers;

  const updateSlab = (id: number, field: "count" | "price", value: number) => {
    setSlabs((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const addSlab = () => {
    setSlabs((prev) => [
      ...prev,
      { id: Date.now(), count: 1, price: 1 },
    ]);
  };

  const removeSlab = (id: number) => {
    setSlabs((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="fixed right-0 top-[57px] bottom-0 w-[320px] border-l border-border bg-card overflow-y-auto p-4 z-20">
      <h3 className="font-bold text-sm mb-3">Budget Planner</h3>
      {boughtCount > 0 && (
        <div className="text-xs mb-2 p-2 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <span className="text-green-700 dark:text-green-400 font-medium">Bought: {boughtCount} players for {boughtSpend.toFixed(1)}Cr</span>
        </div>
      )}
      <div className="text-xs text-muted-foreground mb-3">
        Remaining: {remainingPurse.toFixed(1)}Cr | {remainingSlots} players to go
      </div>

      <div className="space-y-2">
        {slabs.map((slab) => (
          <div key={slab.id} className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              className="w-12 text-sm px-1.5 py-1 border rounded bg-background text-center"
              value={slab.count}
              onChange={(e) =>
                updateSlab(slab.id, "count", parseInt(e.target.value) || 0)
              }
            />
            <span className="text-xs text-muted-foreground">x</span>
            <div className="flex items-center gap-0.5">
              <input
                type="number"
                min={0}
                step={0.5}
                className="w-14 text-sm px-1.5 py-1 border rounded bg-background text-right"
                value={slab.price}
                onChange={(e) =>
                  updateSlab(
                    slab.id,
                    "price",
                    parseFloat(e.target.value) || 0
                  )
                }
              />
              <span className="text-xs text-muted-foreground">Cr</span>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              = {(slab.count * slab.price).toFixed(1)}
            </span>
            <button
              onClick={() => removeSlab(slab.id)}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              x
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addSlab}
        className="text-xs text-primary hover:underline mt-2"
      >
        + Add slab
      </button>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-border space-y-1">
        <div className="flex justify-between text-sm">
          <span>Players</span>
          <span className={totalPlayers === remainingSlots ? "text-green-600 font-bold" : totalPlayers > remainingSlots ? "text-red-500 font-bold" : ""}>
            {totalPlayers} / {remainingSlots}
            {playersRemaining > 0 && (
              <span className="text-muted-foreground font-normal ml-1">
                ({playersRemaining} left)
              </span>
            )}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total Spend</span>
          <span className="font-bold">{totalSpend.toFixed(1)}Cr</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Remaining</span>
          <span
            className={`font-bold ${
              remaining < 0
                ? "text-red-500"
                : remaining < 10
                  ? "text-amber-500"
                  : "text-green-600"
            }`}
          >
            {remaining.toFixed(1)}Cr
          </span>
        </div>
      </div>

      {/* Distribution bar */}
      <div className="mt-3">
        <div className="text-[10px] text-muted-foreground mb-1">Distribution</div>
        <div className="flex h-4 rounded overflow-hidden border border-border">
          {slabs.filter(s => s.count > 0).map((slab) => {
            const pct = (slab.count * slab.price / Math.max(remainingPurse, 1)) * 100;
            return (
              <div
                key={slab.id}
                className={getPriceColor(slab.price) || "bg-muted"}
                style={{ width: `${Math.max(pct, 2)}%` }}
                title={`${slab.count} x ${slab.price}Cr = ${(slab.count * slab.price).toFixed(1)}Cr`}
              />
            );
          })}
          {remaining > 0 && (
            <div
              className="bg-muted/50"
              style={{ width: `${(remaining / Math.max(remainingPurse, 1)) * 100}%` }}
              title={`Unallocated: ${remaining.toFixed(1)}Cr`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Auction Intelligence Panel ─────────────────────────────────────

function AuctionIntel({
  pool,
  participants,
  myId,
  pursePerFriend,
  playersPerFriend,
  getAdjustedPrice,
}: {
  pool: PoolPlayer[];
  participants: Participant[];
  myId: number | undefined;
  pursePerFriend: number;
  playersPerFriend: number;
  getAdjustedPrice: (p: PoolPlayer) => number;
}) {
  const totalPlayers = pool.length;
  const soldPlayers = pool.filter((p) => p.status === "SOLD");
  const availablePlayers = pool.filter((p) => p.status === "AVAILABLE");
  const pctSold = totalPlayers > 0 ? soldPlayers.length / totalPlayers : 0;

  // Auction phase
  const phase = pctSold < 0.3 ? "Early" : pctSold < 0.7 ? "Mid" : "Late";
  const phaseColor = phase === "Early" ? "text-blue-600 dark:text-blue-400" : phase === "Mid" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";

  // Per-friend stats (enhanced with avg EFPPM)
  const friendStats = participants.map((f) => {
    const bought = soldPlayers.filter((p) => p.sold_to_participant === f.id);
    const roles = { BAT: 0, BOWL: 0, AR: 0, WK: 0 };
    let totalSpent = 0;
    let totalEfppm = 0;
    for (const p of bought) {
      if (p.role in roles) roles[p.role as keyof typeof roles]++;
      totalSpent += p.sold_price || 0;
      totalEfppm += p.efppm || 0;
    }
    const slotsLeft = Math.max(0, playersPerFriend - bought.length);
    const avgPerSlot = slotsLeft > 0 ? f.remaining_purse / slotsLeft : 0;
    const avgEfppm = bought.length > 0 ? totalEfppm / bought.length : 0;
    const avgSpend = bought.length > 0 ? totalSpent / bought.length : 0;
    return { ...f, bought: bought.length, roles, totalSpent, slotsLeft, avgPerSlot, avgEfppm, avgSpend };
  });

  // Price trend: avg(sold_price / val_expected) for sales with estimates
  const salesWithEst = soldPlayers.filter((p) => p.sold_price && p.val_expected > 0);
  const avgPremium = salesWithEst.length > 0
    ? salesWithEst.reduce((s, p) => s + p.sold_price! / p.val_expected, 0) / salesWithEst.length
    : 1;

  // Money on table
  const totalRemainingPurse = participants.reduce((s, p) => s + p.remaining_purse, 0);
  const totalAvailableValue = availablePlayers.reduce((s, p) => s + (p.val_expected || 0), 0);
  const purseRatio = totalAvailableValue > 0 ? totalRemainingPurse / totalAvailableValue : 1;

  // Budget exhaustion flags
  const avgBudgetPerSlot = pursePerFriend / playersPerFriend;
  const budgetTight = friendStats.filter((f) => f.slotsLeft > 0 && f.avgPerSlot < 2);
  const cashHeavy = friendStats.filter((f) => f.slotsLeft > 0 && f.avgPerSlot > avgBudgetPerSlot * 1.5);

  // Steals & overpays
  const auctionSteals = soldPlayers
    .filter((p) => p.sold_price && p.val_expected && p.sold_price < p.val_expected * 0.6)
    .sort((a, b) => (a.sold_price! / a.val_expected) - (b.sold_price! / b.val_expected))
    .slice(0, 3);
  const overpays = soldPlayers
    .filter((p) => p.sold_price && p.val_expected && p.sold_price > p.val_expected * 1.5)
    .sort((a, b) => (b.sold_price! / b.val_expected) - (a.sold_price! / a.val_expected))
    .slice(0, 3);

  // Scarcity: per role, quality threshold = median EFPPM of sold players
  const soldEfppms = soldPlayers.filter((p) => p.efppm > 0).map((p) => p.efppm).sort((a, b) => a - b);
  const medianSoldEfppm = soldEfppms.length > 0 ? soldEfppms[Math.floor(soldEfppms.length / 2)] : 30;
  const scarcityAlerts = (["BAT", "BOWL", "AR", "WK"] as const).map((role) => {
    const quality = availablePlayers.filter((p) => p.role === role && p.efppm >= medianSoldEfppm);
    return { role, total: availablePlayers.filter((p) => p.role === role).length, quality: quality.length, names: quality.slice(0, 3).map((p) => p.name) };
  }).filter((r) => r.quality <= 3 && r.quality > 0);

  // Top targets by absolute EFPPM
  const topTargets = availablePlayers
    .filter((p) => p.efppm > 0)
    .sort((a, b) => b.efppm - a.efppm)
    .slice(0, 5);

  return (
    <div className="border-b border-border bg-muted/20 px-4 py-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Column 1: Progress + Friend Stats */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-bold uppercase text-muted-foreground">Progress</h3>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${phaseColor} bg-current/10`}>
              {phase}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${pctSold * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium">
              {soldPlayers.length}/{totalPlayers}
            </span>
          </div>
          <div className="space-y-1">
            {friendStats.map((f) => (
              <div key={f.id} className="flex items-center gap-1.5 text-[11px]">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                <span className={`font-medium ${f.id === myId ? "text-green-600 dark:text-green-400" : ""}`}>
                  {f.short_name}
                </span>
                <span className="text-muted-foreground">{f.bought}/{playersPerFriend}</span>
                <span className="text-muted-foreground/60 text-[10px]">
                  {f.roles.BAT}B {f.roles.BOWL}Bw {f.roles.AR}AR {f.roles.WK}WK
                </span>
                {f.bought > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 text-[10px] font-medium" title="Avg EFPPM per player">
                    {f.avgEfppm.toFixed(0)}fp
                  </span>
                )}
                <span className="ml-auto text-muted-foreground">
                  {f.remaining_purse.toFixed(0)} Cr
                </span>
                {f.slotsLeft > 0 && (
                  <span className={`text-[9px] ${f.avgPerSlot < 2 ? "text-red-500" : "text-muted-foreground/50"}`} title="Avg budget per remaining slot">
                    ({f.avgPerSlot.toFixed(1)}/slot)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Strategic Insights */}
        <div>
          <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">Strategy</h3>
          <div className="space-y-1.5">
            {/* Price trend */}
            {salesWithEst.length >= 3 && (
              <div className={`text-[11px] px-2 py-1 rounded ${
                avgPremium > 1.1
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  : avgPremium < 0.9
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
              }`}>
                {avgPremium > 1.05
                  ? `Prices running hot: selling at ${((avgPremium - 1) * 100).toFixed(0)}% above estimates`
                  : avgPremium < 0.95
                    ? `Bargain phase: selling at ${((1 - avgPremium) * 100).toFixed(0)}% below estimates`
                    : "Prices tracking estimates closely"}
              </div>
            )}

            {/* Money on table */}
            <div className={`text-[11px] px-2 py-1 rounded ${
              purseRatio > 1.3
                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                : purseRatio < 0.8
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                  : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
            }`}>
              {totalRemainingPurse.toFixed(0)} Cr chasing {totalAvailableValue.toFixed(0)} Cr of player value
              {purseRatio > 1.3 ? " — expect inflation" : purseRatio < 0.8 ? " — bargains ahead" : ""}
            </div>

            {/* Budget exhaustion */}
            {budgetTight.length > 0 && (
              <div className="text-[11px] px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                Budget tight: {budgetTight.map((f) => `${f.short_name} (${f.avgPerSlot.toFixed(1)}/slot)`).join(", ")}
              </div>
            )}
            {cashHeavy.length > 0 && (
              <div className="text-[11px] px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                Cash heavy: {cashHeavy.map((f) => `${f.short_name} (${f.avgPerSlot.toFixed(1)}/slot)`).join(", ")}
              </div>
            )}

            {/* Scarcity */}
            {scarcityAlerts.map((a) => (
              <div key={a.role} className="text-[11px] px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                Only {a.quality} quality {a.role} left: {a.names.join(", ")}
              </div>
            ))}
          </div>

          {/* Steals & Overpays */}
          {(auctionSteals.length > 0 || overpays.length > 0) && (
            <div className="mt-3 space-y-1">
              {auctionSteals.map((p) => {
                const buyer = participants.find((f) => f.id === p.sold_to_participant);
                return (
                  <div key={p.player_id} className="text-[10px] text-green-600 dark:text-green-400">
                    STEAL: {p.name} → {buyer?.short_name} @ {p.sold_price} (est. {p.val_expected.toFixed(1)})
                  </div>
                );
              })}
              {overpays.map((p) => {
                const buyer = participants.find((f) => f.id === p.sold_to_participant);
                return (
                  <div key={p.player_id} className="text-[10px] text-red-500">
                    OVERPAY: {p.name} → {buyer?.short_name} @ {p.sold_price} (est. {p.val_expected.toFixed(1)})
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 3: Market Dynamics */}
        <div>
          <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">
            Top Targets Available
          </h3>
          <div className="space-y-1">
            {topTargets.map((p) => (
              <div key={p.player_id} className="flex items-center gap-1.5 text-[11px]">
                <span className="font-medium truncate">{p.name}</span>
                <span className="text-muted-foreground/60 text-[10px] shrink-0">{p.role}</span>
                <span className="ml-auto text-amber-600 dark:text-amber-400 font-bold shrink-0">
                  {p.efppm.toFixed(0)} FP
                </span>
                <span className="text-muted-foreground shrink-0">
                  {getAdjustedPrice(p).toFixed(1)} Cr
                </span>
              </div>
            ))}
            {topTargets.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No data yet</p>
            )}
          </div>

          {/* Available by role */}
          <div className="mt-3">
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-1">
              Available by Role
            </h3>
            <div className="flex gap-3 text-[11px]">
              {(["BAT", "BOWL", "AR", "WK"] as const).map((role) => {
                const count = availablePlayers.filter((p) => p.role === role).length;
                return (
                  <span key={role} className="text-muted-foreground">
                    <span className="font-medium">{role}</span>: {count}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Tier Analysis + Value Efficiency */}
      <TierAnalysis pool={pool} participants={participants} myId={myId} getAdjustedPrice={getAdjustedPrice} />
    </div>
  );
}

// ── Quick Sell Chat ───────────────────────────────────────────────

interface ChatMessage {
  id: number;
  type: "user" | "success" | "error";
  text: string;
}

function QuickSellChat({
  auctionId,
  onSold,
}: {
  auctionId: number;
  onSold: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      type: "success",
      text: 'Friend | Player Price Player Price ...\nSingle: "Nishant | Kohli 25"\nBulk: "Pradeep | Abhishek 45 Head 36 Bumrah 21"\nAuto-overwrites if already sold.',
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  let msgId = useRef(1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async () => {
    const msg = input.trim();
    if (!msg || sending) return;

    const userMsg: ChatMessage = {
      id: msgId.current++,
      type: "user",
      text: msg,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/auction/quick-sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId, message: msg }),
      });
      const json = await res.json();

      if (json.summary) {
        // Has results (full or partial success)
        setMessages((prev) => [
          ...prev,
          {
            id: msgId.current++,
            type: json.success ? "success" : "error",
            text: json.summary,
          },
        ]);
        onSold();
      } else if (json.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: msgId.current++,
            type: "error",
            text: json.error,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: msgId.current++,
            type: "error",
            text: `Unexpected response: ${JSON.stringify(json)}`,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: msgId.current++, type: "error", text: "Network error" },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-[380px] h-[400px] bg-card border border-border rounded-xl shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border bg-muted/30 rounded-t-xl">
        <span className="text-sm font-bold">Quick Sell</span>
        <span className="text-[10px] text-muted-foreground ml-2">
          Friend | Player & Price
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`text-xs px-3 py-2 rounded-lg whitespace-pre-wrap ${
              m.type === "user"
                ? "bg-primary text-primary-foreground ml-8"
                : m.type === "success"
                  ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 mr-8"
                  : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 mr-8"
            }`}
          >
            {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Pradeep | Kohli 25 Bumrah 21 Head 36"
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={sending}
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tier Analysis (Intel Row 2) ───────────────────────────────────

function TierAnalysis({
  pool, participants, myId, getAdjustedPrice,
}: {
  pool: PoolPlayer[];
  participants: Participant[];
  myId: number | undefined;
  getAdjustedPrice: (p: PoolPlayer) => number;
}) {
  const available = pool.filter((p) => p.status === "AVAILABLE" && p.efppm > 0);
  const sold = pool.filter((p) => p.status === "SOLD");
  const sorted = [...available].sort((a, b) => b.efppm - a.efppm);
  // Tier definitions based on price
  const premium = sorted.filter((p) => getAdjustedPrice(p) >= 10);
  const mid = sorted.filter((p) => getAdjustedPrice(p) >= 4 && getAdjustedPrice(p) < 10);
  const value = sorted.filter((p) => getAdjustedPrice(p) >= 2 && getAdjustedPrice(p) < 4);
  const base = sorted.filter((p) => getAdjustedPrice(p) < 2);

  // Role breakdown: avg EFPPM by role (available only)
  const roleStats = (["BAT", "WK", "AR", "BOWL"] as const).map((role) => {
    const rolePlayers = available.filter((p) => p.role === role).sort((a, b) => b.efppm - a.efppm);
    const top5 = rolePlayers.slice(0, 5);
    const avgEfppm = rolePlayers.length > 0 ? rolePlayers.reduce((s, p) => s + p.efppm, 0) / rolePlayers.length : 0;
    const top5Avg = top5.length > 0 ? top5.reduce((s, p) => s + p.efppm, 0) / top5.length : 0;
    const avgPrice = rolePlayers.length > 0 ? rolePlayers.reduce((s, p) => s + getAdjustedPrice(p), 0) / rolePlayers.length : 0;
    const fpPerCr = avgPrice > 0 ? avgEfppm / avgPrice : 0;
    return { role, count: rolePlayers.length, avgEfppm, top5Avg, avgPrice, fpPerCr, best: top5 };
  });

  // Per-friend: who has the best C/VC material?
  const friendSquads = participants.map((f) => {
    const bought = sold.filter((p) => p.sold_to_participant === f.id).sort((a, b) => b.efppm - a.efppm);
    const topEfppm = bought.length > 0 ? bought[0].efppm : 0;
    const top3Avg = bought.slice(0, 3).reduce((s, p) => s + p.efppm, 0) / Math.max(bought.slice(0, 3).length, 1);
    const totalFp = bought.reduce((s, p) => s + p.efppm * 14, 0); // rough season estimate
    const premiumCount = bought.filter((p) => p.efppm >= 70).length;
    return { ...f, topEfppm, top3Avg, totalFp, premiumCount, bought: bought.length };
  });

  // Value insight: base-price players with high EFPPM (steals waiting to happen)
  const baseGems = base
    .filter((p) => p.efppm >= 45)
    .sort((a, b) => b.efppm - a.efppm)
    .slice(0, 5);

  // EFPPM gap: difference between tier boundaries
  const premiumFloor = premium.length > 0 ? premium[premium.length - 1].efppm : 0;
  const midFloor = mid.length > 0 ? mid[mid.length - 1].efppm : 0;

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Tier Breakdown */}
        <div>
          <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">Tier Breakdown (Available)</h3>
          <div className="space-y-1.5">
            {[
              { label: "Premium (10+ Cr)", players: premium, color: "text-red-500", bg: "bg-red-500/10" },
              { label: "Mid (4-9 Cr)", players: mid, color: "text-amber-500", bg: "bg-amber-500/10" },
              { label: "Value (2-3 Cr)", players: value, color: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "Base (1 Cr)", players: base, color: "text-muted-foreground", bg: "bg-muted/30" },
            ].map((tier) => {
              const avgFp = tier.players.length > 0
                ? tier.players.reduce((s, p) => s + p.efppm, 0) / tier.players.length : 0;
              return (
                <div key={tier.label} className={`text-[11px] px-2 py-1 rounded ${tier.bg}`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${tier.color}`}>{tier.label}</span>
                    <span className="text-muted-foreground">{tier.players.length} players</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/70">
                    Avg {avgFp.toFixed(0)} FP/match · ~{(avgFp * 14).toFixed(0)} FP/season
                  </div>
                </div>
              );
            })}
          </div>
          {premiumFloor > 0 && (
            <div className="mt-2 text-[10px] text-muted-foreground/60">
              Premium cutoff: {premiumFloor.toFixed(0)} EFPPM · Mid cutoff: {midFloor.toFixed(0)} EFPPM
            </div>
          )}
        </div>

        {/* FP/Cr Efficiency by Role */}
        <div>
          <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">Value by Role (FP per Cr)</h3>
          <div className="space-y-2">
            {roleStats.map((r) => (
              <div key={r.role} className="text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{r.role}</span>
                  <span className={`font-bold ${r.fpPerCr > 20 ? "text-green-500" : r.fpPerCr > 10 ? "text-amber-500" : "text-red-500"}`}>
                    {r.fpPerCr.toFixed(1)} FP/Cr
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground/70">
                  {r.count} avail · Top-5 avg: {r.top5Avg.toFixed(0)} FP · Avg price: {r.avgPrice.toFixed(0)} Cr
                </div>
              </div>
            ))}
          </div>

          {/* Base price gems */}
          {baseGems.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs font-bold uppercase text-green-500 mb-1">Base Price Gems (1 Cr, 45+ FP)</h3>
              {baseGems.map((p) => (
                <div key={p.player_id} className="text-[10px] flex items-center gap-1">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground/60">{p.role}</span>
                  <span className="ml-auto text-green-500 font-bold">{p.efppm.toFixed(0)} FP</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Squad Comparison */}
        <div>
          <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">Squad Power Rankings</h3>
          <div className="space-y-2">
            {friendSquads.sort((a, b) => b.totalFp - a.totalFp).map((f, i) => (
              <div key={f.id} className={`text-[11px] px-2 py-1.5 rounded ${f.id === myId ? "bg-green-500/10 ring-1 ring-green-500/30" : "bg-muted/30"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold">{i === 0 ? "👑 " : ""}{f.name}</span>
                  <span className="font-bold text-amber-500">{f.totalFp.toFixed(0)} FP est.</span>
                </div>
                <div className="text-[10px] text-muted-foreground/70 flex gap-2">
                  <span>{f.bought} bought</span>
                  <span>Best: {f.topEfppm.toFixed(0)} FP</span>
                  <span>Top-3 avg: {f.top3Avg.toFixed(0)}</span>
                  <span>{f.premiumCount} premium</span>
                </div>
              </div>
            ))}
            {friendSquads.every((f) => f.bought === 0) && (
              <div className="text-[11px] text-muted-foreground/60 text-center py-2">
                No players sold yet — squad rankings will appear after first sales
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Auction Settings ──────────────────────────────────────────────

function AuctionSettings({
  auction,
  auctionId,
  onUpdate,
  onClose,
}: {
  auction: AuctionData["auction"];
  auctionId: number;
  onUpdate: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(auction.name);
  const [numFriends, setNumFriends] = useState(auction.num_friends);
  const [purse, setPurse] = useState(auction.purse_per_friend);
  const [ppf, setPpf] = useState(auction.players_per_friend);
  const [numC, setNumC] = useState(auction.num_captains);
  const [numVC, setNumVC] = useState(auction.num_vice_captains);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    // 1. Save config
    await fetch(`/api/auction/${auctionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        num_friends: numFriends,
        purse_per_friend: purse,
        players_per_friend: ppf,
        num_captains: numC,
        num_vice_captains: numVC,
      }),
    });
    // 2. Recalculate valuations with new config
    await fetch("/api/auction/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentId: auction.tournament_id }),
    });
    setSaving(false);
    onUpdate();
    onClose();
  };

  const Field = ({ label, value, onChange, min = 1, step = 1 }: {
    label: string; value: number; onChange: (v: number) => void; min?: number; step?: number;
  }) => (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="number"
        min={min}
        step={step}
        className="w-20 text-sm border rounded px-2 py-1 bg-background text-right"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );

  return (
    <div className="mx-4 mb-3 border border-border rounded-lg bg-card overflow-hidden max-w-md">
      <div className="px-3 py-2 bg-muted/30 border-b border-border font-bold text-sm">
        Auction Settings
      </div>
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs text-muted-foreground">Auction Name</label>
          <input
            className="w-48 text-sm border rounded px-2 py-1 bg-background"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Field label="Friends" value={numFriends} onChange={setNumFriends} />
        <Field label="Purse per Friend (Cr)" value={purse} onChange={setPurse} step={10} />
        <Field label="Players per Friend" value={ppf} onChange={setPpf} />
        <Field label="Captains per Friend" value={numC} onChange={setNumC} />
        <Field label="Vice-Captains per Friend" value={numVC} onChange={setNumVC} />

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <button
            className="flex-1 text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save & Recalculate"}
          </button>
          <button
            className="text-sm px-3 py-1.5 rounded border hover:bg-muted"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Availability Panel ────────────────────────────────────────────

function AvailabilityPanel({ pool, onUpdate }: { pool: PoolPlayer[]; onUpdate: () => void }) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("FIT");
  const [editNote, setEditNote] = useState("");

  const affected = pool.filter((p) => p.availability && p.availability !== "FIT");
  const unavailable = affected.filter((p) => p.availability === "UNAVAILABLE");
  const doubtful = affected.filter((p) => p.availability === "DOUBTFUL");
  const injured = affected.filter((p) => p.availability === "INJURED");

  // Search: show matching players from full pool (to add new flags)
  const searchResults = search.length >= 2
    ? pool.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  const saveEdit = async (poolId: number) => {
    await fetch("/api/auction/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolId, availability: editStatus, newsNotes: editNote }),
    });
    // Also update risk_note for display
    await fetch("/api/pool/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolId, risk_note: editNote || null }),
    });
    setEditingId(null);
    onUpdate();
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      UNAVAILABLE: "bg-red-600 text-white",
      INJURED: "bg-orange-600 text-white",
      DOUBTFUL: "bg-yellow-600 text-black",
      FIT: "bg-green-600 text-white",
    };
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${colors[status] || "bg-muted"}`}>
        {status}
      </span>
    );
  };

  const PlayerRow = ({ p }: { p: PoolPlayer }) => {
    const isEditing = editingId === p.pool_id;
    return (
      <div className="py-2 px-3 border-b border-border last:border-b-0">
        <div className="flex items-center gap-2">
          <StatusBadge status={p.availability || "FIT"} />
          <span className="text-xs font-medium">{p.name}</span>
          {p.is_overseas ? <span className="text-sm text-blue-400">✈</span> : null}
          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">{p.ipl_team}</span>
          <span className="text-[10px] text-muted-foreground">{p.role}</span>
          <button
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (isEditing) { setEditingId(null); return; }
              setEditingId(p.pool_id);
              setEditStatus(p.availability || "FIT");
              setEditNote(p.risk_note || "");
            }}
          >
            {isEditing ? "cancel" : "edit"}
          </button>
        </div>
        {p.risk_note && !isEditing && (
          <div className="text-[11px] text-muted-foreground/80 mt-1 ml-[72px] leading-snug">
            {p.risk_note}
          </div>
        )}
        {isEditing && (
          <div className="flex items-center gap-2 mt-2 ml-[72px]">
            <select
              className="text-xs border rounded px-1.5 py-1 bg-background"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            >
              <option value="FIT">FIT</option>
              <option value="DOUBTFUL">DOUBTFUL</option>
              <option value="INJURED">INJURED</option>
              <option value="UNAVAILABLE">UNAVAILABLE</option>
            </select>
            <input
              className="text-xs border rounded px-2 py-1 bg-background flex-1"
              placeholder="Reason / notes"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
            />
            <button
              className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded"
              onClick={() => saveEdit(p.pool_id)}
            >
              Save
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-4 mb-3 border border-border rounded-lg bg-card overflow-hidden">
      <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center gap-3">
        <span className="font-bold text-sm">Availability Tracker</span>
        <span className="text-xs text-muted-foreground">
          {unavailable.length} out · {injured.length} injured · {doubtful.length} doubtful
        </span>
        <input
          className="ml-auto text-xs border rounded px-2 py-1 bg-background w-48"
          placeholder="Search player to update..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="border-b border-border">
          <div className="px-3 py-1 bg-blue-500/10 text-[11px] font-bold text-blue-400 uppercase tracking-wider">
            Search Results
          </div>
          {searchResults.map((p) => <PlayerRow key={`s-${p.pool_id}`} p={p} />)}
        </div>
      )}

      {affected.length === 0 && searchResults.length === 0 && (
        <div className="p-3 text-sm text-center text-green-400">
          All players fit and available
        </div>
      )}

      {unavailable.length > 0 && (
        <div>
          <div className="px-3 py-1 bg-red-500/10 text-[11px] font-bold text-red-400 uppercase tracking-wider">
            Ruled Out — Full Season ({unavailable.length})
          </div>
          {unavailable.map((p) => <PlayerRow key={p.pool_id} p={p} />)}
        </div>
      )}
      {injured.length > 0 && (
        <div>
          <div className="px-3 py-1 bg-orange-500/10 text-[11px] font-bold text-orange-400 uppercase tracking-wider">
            Injured ({injured.length})
          </div>
          {injured.map((p) => <PlayerRow key={p.pool_id} p={p} />)}
        </div>
      )}
      {doubtful.length > 0 && (
        <div>
          <div className="px-3 py-1 bg-yellow-500/10 text-[11px] font-bold text-yellow-500 uppercase tracking-wider">
            Doubtful / Late ({doubtful.length})
          </div>
          {doubtful.map((p) => <PlayerRow key={p.pool_id} p={p} />)}
        </div>
      )}
    </div>
  );
}

// ── AI Auction Advisor ────────────────────────────────────────────

function buildAuctionContext(
  pool: PoolPlayer[],
  participants: Participant[],
  myId: number | undefined,
  marketFactor: number,
  getAdjustedPrice: (p: PoolPlayer) => number,
  pursePerFriend: number,
  playersPerFriend: number,
  watchlist: Record<number, { color: string | null; priority: number; notes: string | null }>,
  teamPitchBreakdown: Record<string, { F: number; B: number; T: number }>,
): string {
  const sold = pool.filter((p) => p.status === "SOLD");
  const available = pool.filter((p) => p.status === "AVAILABLE");
  const pctSold = pool.length > 0 ? sold.length / pool.length : 0;
  const phase = pctSold < 0.3 ? "Early" : pctSold < 0.7 ? "Mid" : "Late";

  const withEst = sold.filter((p) => p.sold_price && p.val_expected > 0);
  const avgPremium = withEst.length > 0
    ? withEst.reduce((s, p) => s + p.sold_price! / p.val_expected, 0) / withEst.length
    : 1;

  const lines: string[] = [];

  // A. Auction rules
  lines.push("AUCTION RULES:");
  lines.push(`- ${participants.length}-friend fantasy auction for IPL 2026 using Dream11 scoring.`);
  lines.push(`- Each friend drafts ${playersPerFriend} players from a shared pool within a ${pursePerFriend} Cr budget.`);
  lines.push("- NO overseas cap, NO role restrictions, NO minimum by role. A friend can pick 15 batters if they want.");
  lines.push("- The ONLY goal is maximizing total Dream11 fantasy points across all IPL matches. Role balance is irrelevant.");
  lines.push("- Dream11 scoring: Runs +1/run, +4 bonus at 50, +8 at 100, +2/six. Wickets +25/wkt, +8 for 4-fer, +16 for 5-fer. Catches +8, Stumpings +12. Economy & SR bonuses/penalties apply (min 2 overs / 10 balls). Captain gets 2x points, Vice-captain 1.5x.");
  lines.push("");

  // B. Terminology
  lines.push("KEY TERMS:");
  lines.push("- EFPPM = Expected Fantasy Points Per Match (higher = better). This is the primary value metric.");
  lines.push("- Market Factor = totalRemainingPurse / sum(top N expected prices). >1 means money is chasing fewer players (inflation).");
  lines.push("- Adj Price = val_expected × marketFactor (what a player would likely sell for now).");
  lines.push("- val_floor / val_ceiling = estimated min/max price range.");
  lines.push("");

  // C. Auction state
  lines.push(`AUCTION STATE: ${phase} phase, ${sold.length}/${pool.length} sold (${(pctSold * 100).toFixed(0)}%), market factor ${marketFactor.toFixed(2)}x, avg sale premium ${avgPremium.toFixed(2)}x`);
  lines.push("");

  // D. Participants with bought players
  lines.push("PARTICIPANTS:");
  lines.push("Name | Purse Left | Slots Left | Avg EFPPM | Cr/Slot");
  for (const f of participants) {
    const bought = sold.filter((p) => p.sold_to_participant === f.id);
    let totalEfppm = 0;
    for (const p of bought) totalEfppm += p.efppm || 0;
    const slotsLeft = playersPerFriend - bought.length;
    const avgPerSlot = slotsLeft > 0 ? (f.remaining_purse / slotsLeft).toFixed(1) : "0";
    const avgEfppm = bought.length > 0 ? (totalEfppm / bought.length).toFixed(0) : "-";
    const meTag = f.id === myId ? " (ME)" : "";
    lines.push(`${f.name}${meTag} | ${f.remaining_purse.toFixed(1)}Cr | ${slotsLeft} slots | avg ${avgEfppm} EFPPM | ${avgPerSlot}Cr/slot`);
    if (bought.length > 0) {
      const boughtList = bought
        .sort((a, b) => (b.sold_price || 0) - (a.sold_price || 0))
        .map((p) => `${p.name} (${p.role}, ${p.sold_price}Cr, EFPPM ${p.efppm.toFixed(0)})`)
        .join(", ");
      lines.push(`  Bought: ${boughtList}`);
    }
  }
  lines.push("");

  // E. Watchlist (available only)
  const watchedAvailable = available.filter((p) => p.player_id in watchlist);
  if (watchedAvailable.length > 0) {
    lines.push("MY WATCHLIST (priority targets still available):");
    for (const p of watchedAvailable.sort((a, b) => (watchlist[a.player_id]?.priority || 0) - (watchlist[b.player_id]?.priority || 0))) {
      const w = watchlist[p.player_id];
      const notes = w?.notes ? ` — ${w.notes}` : "";
      lines.push(`- ${p.name} | ${p.role} | EFPPM ${p.efppm.toFixed(1)} | Adj ${getAdjustedPrice(p).toFixed(1)}Cr${notes}`);
    }
    lines.push("");
  }

  // F. Top available players (expanded + stats)
  const topAvail = available.filter((p) => p.efppm > 0).sort((a, b) => b.efppm - a.efppm).slice(0, 50);
  lines.push("TOP 50 AVAILABLE PLAYERS (by EFPPM):");
  lines.push("Name | Role | OVS | EFPPM | Base | Adj | Team | M | Key Stats | AvgFP | Risk");
  for (const p of topAvail) {
    const ovs = p.is_overseas ? "Y" : "N";
    let stats = "";
    if (p.role === "BAT" || p.role === "WK") {
      stats = `Avg:${p.bat_avg?.toFixed(1) || "-"} SR:${p.bat_sr?.toFixed(0) || "-"} 50s:${p.fifties || 0} 100s:${p.hundreds || 0}`;
    } else if (p.role === "BOWL") {
      stats = `Econ:${p.bowl_econ?.toFixed(1) || "-"} Wkts:${p.wickets || 0} BwlAvg:${p.bowl_avg?.toFixed(1) || "-"}`;
    } else {
      stats = `Avg:${p.bat_avg?.toFixed(1) || "-"} SR:${p.bat_sr?.toFixed(0) || "-"} Econ:${p.bowl_econ?.toFixed(1) || "-"} Wkts:${p.wickets || 0}`;
    }
    const risk = p.risk_note || (p.availability && p.availability !== "FIT" ? p.availability : "-");
    lines.push(`${p.name} | ${p.role} | ${ovs} | ${p.efppm.toFixed(1)} | ${p.val_expected.toFixed(1)} | ${getAdjustedPrice(p).toFixed(1)} | ${p.ipl_team} | ${p.matches || 0} | ${stats} | ${p.avg_fantasy_points?.toFixed(0) || "-"} | ${risk}`);
  }
  lines.push("");

  // G. Pitch breakdown
  if (Object.keys(teamPitchBreakdown).length > 0) {
    lines.push("TEAM PITCH BREAKDOWN (IPL 2026 — Phase 1 schedule, F=Flat/batting, B=Balanced, T=Tricky/bowling):");
    for (const [team, pb] of Object.entries(teamPitchBreakdown)) {
      lines.push(`${team}: ${pb.F}F + ${pb.B}B + ${pb.T}T`);
    }
    lines.push("");
  }

  // H. Recent sales (by recency)
  const recentSales = sold
    .filter((p) => p.sold_price)
    .sort((a, b) => {
      if (a.sold_at && b.sold_at) return b.sold_at.localeCompare(a.sold_at);
      return (b.sold_price || 0) - (a.sold_price || 0);
    })
    .slice(0, 20);
  if (recentSales.length > 0) {
    lines.push("RECENT SALES (newest first):");
    lines.push("Player | Role | Buyer | Price | Est | Premium");
    for (const p of recentSales) {
      const buyer = participants.find((f) => f.id === p.sold_to_participant);
      const premium = p.val_expected > 0 ? (p.sold_price! / p.val_expected).toFixed(2) + "x" : "-";
      lines.push(`${p.name} | ${p.role} | ${buyer?.short_name || "?"} | ${p.sold_price}Cr | ${p.val_expected.toFixed(1)}Cr | ${premium}`);
    }
  }

  return lines.join("\n");
}

interface AdvisorMessage {
  id: number;
  role: "user" | "assistant" | "error";
  content: string;
}

function AuctionAdvisor({
  pool,
  participants,
  myId,
  marketFactor,
  getAdjustedPrice,
  pursePerFriend,
  playersPerFriend,
  watchlist,
  teamPitchBreakdown,
}: {
  pool: PoolPlayer[];
  participants: Participant[];
  myId: number | undefined;
  marketFactor: number;
  getAdjustedPrice: (p: PoolPlayer) => number;
  pursePerFriend: number;
  playersPerFriend: number;
  watchlist: Record<number, { color: string | null; priority: number; notes: string | null }>;
  teamPitchBreakdown: Record<string, { F: number; B: number; T: number }>;
}) {
  const [messages, setMessages] = useState<AdvisorMessage[]>([
    { id: 0, role: "assistant", content: "Ask me anything — \"Should I bid 16 for Pant?\", \"Who should I target next?\", \"Will Pradeep run out of budget?\"" },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const msgId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async () => {
    const q = input.trim();
    if (!q || sending) return;

    const userMsg: AdvisorMessage = { id: msgId.current++, role: "user", content: q };
    const assistantMsg: AdvisorMessage = { id: msgId.current++, role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setSending(true);

    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const context = buildAuctionContext(pool, participants, myId, marketFactor, getAdjustedPrice, pursePerFriend, playersPerFriend, watchlist, teamPitchBreakdown);

    try {
      const res = await fetch("/api/auction/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, question: q, history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsg.id ? { ...m, role: "error", content: err.error || "Request failed" } : m)
        );
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsg.id ? { ...m, role: "error", content: "No response stream" } : m)
        );
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsg.id ? { ...m, content: current } : m)
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setMessages((prev) =>
        prev.map((m) => m.id === assistantMsg.id ? { ...m, role: "error", content: msg } : m)
      );
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed bottom-4 left-4 w-[400px] h-[440px] bg-card border border-border rounded-lg shadow-xl flex flex-col z-50">
      <div className="px-3 py-2 border-b border-border bg-muted/30 rounded-t-lg">
        <div className="font-bold text-sm">AI Advisor</div>
        <div className="text-[10px] text-muted-foreground">Strategy questions with full auction context</div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`text-sm px-3 py-2 rounded-lg whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-primary text-primary-foreground ml-8"
                : m.role === "error"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 mr-8"
                  : "bg-muted mr-8"
            }`}
          >
            {m.content || (sending ? "..." : "")}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-2 border-t border-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Should I bid 16 for Pant?"
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={sending}
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            {sending ? "..." : "Ask"}
          </button>
        </div>
      </div>
    </div>
  );
}
