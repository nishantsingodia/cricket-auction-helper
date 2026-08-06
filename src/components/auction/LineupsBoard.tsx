"use client";

// ── Lineups Board ───────────────────────────────────────────────────
// PHONE-FIRST view of the auction board. The owner reads this live, in his hand, while bidding:
// "who is playing in that team, is he sold or available, and sold to whom".
//
// Layout = a horizontal scroll-snap pager. One page = 2 teams side by side (`grid-cols-2`), so a
// 7- or 8-team contest is 4 swipes. From `md:` up a page is only half the viewport wide, so two
// pages (= 4 teams) sit in the fold at once — the chunk size never changes, only how many pages
// fit, which keeps the snap points identical across breakpoints and needs no JS measurement.
//
// COLOUR MEANS OWNERSHIP AND NOTHING ELSE. A sold row carries a left-to-right gradient in the
// buyer's colour — EXCEPT my own picks, which are solid dark green (#14532d) with white text, the
// same treatment getPlayerBg() gives them on the grid. My squad has to be findable at a glance and a
// sixth pastel among five others is not; the legend chip for me is green too, so the key stays
// honest. Availability (DOUBTFUL/INJURED) is an amber `!` on the meta line, never a colour. There
// are no owner-initial chips — the owner asked for those to go.

import { useCallback, useRef, useState, useSyncExternalStore, useLayoutEffect } from "react";
import type { CSSProperties } from "react";
import {
  PLAYING_XI_SIZE,
  ROLE_SHORT,
  VENUE_CLASS_META,
  shortVenue,
  type Participant,
  type PoolPlayer,
  type TeamVenueSummary,
  type VenueClass,
} from "@/app/auction/[id]/page";

// Probable XI = batting order 1–11. 12+ is the bench (the board's PLAYING_XI_SIZE of 12 stays the
// "Playing XII" window used for the overseas cap, which is counted over 12, not 11).
const XI_SIZE = 11;
// My own picks: solid dark green, matching getPlayerBg() on the grid. Deliberately NOT my
// participant colour — my squad must be findable instantly, and a sixth pastel isn't.
const MINE_BG = "#14532d";
const TEAMS_PER_PAGE = 2;
const OVERSEAS_CAP = 4;

// Tight pill label per venue class — the column is ~half a phone wide, "Bowl-friendly" will not fit.
const CLASS_PILL: Record<VenueClass, string> = {
  bat_road: "Bat",
  balanced: "Bal",
  bowl_friendly: "Bowl",
};

// ── Media query hook (SSR-safe) ─────────────────────────────────────
// useSyncExternalStore, not useState+useEffect: the server snapshot is a hard `false`, so the SSR
// markup and the hydration render agree, and React swaps in the real value on the client without a
// setState-inside-an-effect cascade. Exported so the page can pick its default view the same way.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query]
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

// ── Board ───────────────────────────────────────────────────────────

export function LineupsBoard({
  sortedTeams,
  participants,
  myId,
  teamVenueSummary,
  onPlayerClick,
  onVenueClick,
}: {
  /** Already grouped + ordered upstream (XI first, by squad_number). Presentation only. */
  sortedTeams: [string, PoolPlayer[]][];
  participants: Participant[];
  myId: number | undefined;
  teamVenueSummary: Record<string, TeamVenueSummary> | null;
  onPlayerClick: (playerId: number) => void;
  onVenueClick: (canonical: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const pagesInView = isMdUp ? 2 : 1;

  const pages: [string, PoolPlayer[]][][] = [];
  for (let i = 0; i < sortedTeams.length; i += TEAMS_PER_PAGE) {
    pages.push(sortedTeams.slice(i, i + TEAMS_PER_PAGE));
  }

  // Owner colour lookup — one map, used by every row.
  const ownerById = new Map(participants.map((p) => [p.id, p]));

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const pageW = el.clientWidth / pagesInView;
    if (pageW <= 0) return;
    const idx = Math.max(0, Math.min(pages.length - 1, Math.round(el.scrollLeft / pageW)));
    setPage((prev) => (prev === idx ? prev : idx));
  };

  const scrollToPage = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: (el.clientWidth / pagesInView) * idx, behavior: "smooth" });
  };

  const firstTeam = page * TEAMS_PER_PAGE + 1;
  const lastTeam = Math.min(sortedTeams.length, (page + pagesInView) * TEAMS_PER_PAGE);

  const walletOrder = [...participants].sort((a, b) => b.remaining_purse - a.remaining_purse);

  // How much vertical room the columns actually get. A fixed reserve was guessed at 280px and was
  // badly wrong on a phone — the auction header wraps to 5–6 rows there, so the XI started ~350px
  // down and each column silently scrolled inside itself, which is exactly what "11 in a fold" is
  // supposed to prevent. Measure the board's real top instead and publish it as a CSS variable.
  // Written straight to the DOM rather than through setState: this is layout, it must not trigger a
  // render, and the repo lints setState-in-effect as an error.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const apply = () => {
      const top = root.getBoundingClientRect().top;
      // Legend + range header + pager dots sit inside the board, above/below the columns.
      const chromeInsideBoard = 88;
      // On a phone the fixed bottom nav overlays the viewport; without reserving it the last two
      // rows of the XI sit underneath and read as missing.
      const bottomNav = window.matchMedia("(min-width: 768px)").matches ? 0 : 60;
      root.style.setProperty(
        "--lineups-col-h",
        `${Math.max(240, window.innerHeight - top - chromeInsideBoard - bottomNav)}px`
      );
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    const ro = new ResizeObserver(apply);
    ro.observe(document.body); // the header wraps as purses/toggles change — re-measure when it does
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      ro.disconnect();
    };
  }, []);

  if (sortedTeams.length === 0) {
    return <div className="p-6 text-sm text-muted-foreground">No squads in this pool yet.</div>;
  }

  return (
    <div ref={rootRef} className="pb-2">
      {/* ── Wallet legend ──
          Sorted by purse left, descending: "who can still outbid me" reads top-to-left. Doubles as
          the ONLY colour → friend key on this screen, so it stays above the fold at all times. */}
      <div className="flex gap-1.5 overflow-x-auto px-2 py-1.5 border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {walletOrder.map((p) => {
          const isMe = Boolean(p.is_me);
          return (
            <div
              key={p.id}
              title={`${p.name} — ${p.remaining_purse.toFixed(1)} of ${p.purse} left`}
              className={`shrink-0 flex items-center gap-1.5 rounded-full border px-2 py-1 ${
                isMe
                  ? "border-green-400/60 text-white ring-1 ring-inset ring-green-400/60"
                  : "border-border bg-card"
              }`}
              // My chip carries the SAME dark green as my rows — the legend is the colour key, so
              // showing my participant blue here while my rows render green would make it a lie.
              style={isMe ? { backgroundColor: MINE_BG } : undefined}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-inset ring-black/20"
                style={{ backgroundColor: isMe ? "#4ade80" : p.color }}
              />
              <span
                className={`text-[11px] leading-none ${isMe ? "text-white/80" : "text-muted-foreground"}`}
              >
                {p.short_name}
              </span>
              <span className="text-[11px] leading-none font-bold tabular-nums">
                {p.remaining_purse.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Range header ── */}
      <div className="flex items-center justify-between px-3 pt-1.5 pb-1 text-[10px] text-muted-foreground">
        <span className="font-medium tracking-wide uppercase">Lineups</span>
        <span className="tabular-nums">
          {firstTeam}
          {lastTeam > firstTeam ? `–${lastTeam}` : ""} of {sortedTeams.length}
        </span>
      </div>

      {/* ── Pager ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((pageTeams, i) => (
          <div key={i} className="snap-start shrink-0 w-full md:w-1/2 grid grid-cols-2 gap-2 px-2">
            {pageTeams.map(([team, players]) => (
              <TeamLineup
                key={team}
                team={team}
                players={players}
                ownerById={ownerById}
                myId={myId}
                venueSummary={teamVenueSummary?.[team]}
                onPlayerClick={onPlayerClick}
                onVenueClick={onVenueClick}
              />
            ))}
            {/* Odd team count → keep the last column half-width like every other one. */}
            {pageTeams.length < TEAMS_PER_PAGE && <div aria-hidden />}
          </div>
        ))}
      </div>

      {/* ── Page dots ── (40px tap target, 6px visual) */}
      {pages.length > 1 && (
        <div className="flex items-center justify-center gap-0.5">
          {pages.map((_, i) => {
            const active = i >= page && i < page + pagesInView;
            return (
              <button
                key={i}
                type="button"
                onClick={() => scrollToPage(i)}
                aria-label={`Teams ${i * TEAMS_PER_PAGE + 1}–${Math.min(
                  sortedTeams.length,
                  (i + 1) * TEAMS_PER_PAGE
                )}`}
                aria-current={active ? "true" : undefined}
                className="h-10 px-1.5 flex items-center justify-center"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all ${
                    active ? "w-6 bg-foreground/70" : "w-1.5 bg-foreground/25"
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── One team column ─────────────────────────────────────────────────

function TeamLineup({
  team,
  players,
  ownerById,
  myId,
  venueSummary,
  onPlayerClick,
  onVenueClick,
}: {
  team: string;
  players: PoolPlayer[];
  ownerById: Map<number, Participant>;
  myId: number | undefined;
  venueSummary?: TeamVenueSummary;
  onPlayerClick: (playerId: number) => void;
  onVenueClick: (canonical: string) => void;
}) {
  const xi = players.filter((p) => p.squad_number >= 1 && p.squad_number <= XI_SIZE);
  const bench = players.filter((p) => !(p.squad_number >= 1 && p.squad_number <= XI_SIZE));
  const soldInXI = xi.filter((p) => p.status === "SOLD").length;
  // Overseas is counted over the Playing XII window, matching the grid board's semantics.
  const overseasInXII = players.filter(
    (p) => p.squad_number >= 1 && p.squad_number <= PLAYING_XI_SIZE && p.is_overseas
  ).length;

  const totalGames = venueSummary
    ? venueSummary.batGames + venueSummary.balancedGames + venueSummary.bowlGames
    : 0;
  // Same fallback the grid header uses when there is no single home ground to classify.
  const dominant: VenueClass | null = venueSummary
    ? venueSummary.homeType ??
      (venueSummary.bowlGames >= venueSummary.batGames &&
      venueSummary.bowlGames >= venueSummary.balancedGames
        ? "bowl_friendly"
        : venueSummary.batGames >= venueSummary.balancedGames
        ? "bat_road"
        : "balanced")
    : null;

  return (
    <div className="min-w-0 flex flex-col rounded-lg border border-border bg-card overflow-hidden">
      {/* ── Header ── tapping opens the SAME venue breakdown modal as the grid board. */}
      <button
        type="button"
        onClick={() => onVenueClick(venueSummary?.home ?? "__ALL__")}
        title="Venue conditions — tap for the full ground breakdown"
        className="text-left px-2 py-1.5 min-h-[44px] bg-muted/50 hover:bg-muted transition-colors border-b border-border"
      >
        {/* Line 1 — team · XI sold · overseas */}
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-bold text-sm leading-none truncate">{team}</span>
          <span
            className="text-[10px] leading-none text-muted-foreground tabular-nums"
            title={`${soldInXI} of ${XI_SIZE} probable XI already sold`}
          >
            {soldInXI}/{XI_SIZE}
          </span>
          <span
            className={`ml-auto shrink-0 text-[10px] leading-none tabular-nums rounded px-1 py-0.5 ${
              overseasInXII > OVERSEAS_CAP
                ? "bg-red-600 text-white font-semibold"
                : "text-muted-foreground"
            }`}
            title={`${overseasInXII}/${OVERSEAS_CAP} overseas in the Playing XII`}
          >
            {"✈"}
            {overseasInXII}/{OVERSEAS_CAP}
          </span>
        </div>

        {/* Line 2 — home ground (or Neutral) + class pill */}
        {venueSummary && (
          <div className="mt-0.5 flex items-center gap-1 text-[10px] leading-tight text-muted-foreground">
            <span aria-hidden>{"🏟"}</span>
            {venueSummary.neutral ? (
              <span className="truncate tabular-nums">Neutral · {totalGames}g</span>
            ) : (
              <span className="truncate tabular-nums">
                {shortVenue(venueSummary.home)} · {venueSummary.homeGames}g
              </span>
            )}
            {dominant && (
              <span
                className={`shrink-0 rounded px-1 leading-tight text-white ${VENUE_CLASS_META[dominant].cls}`}
                title={VENUE_CLASS_META[dominant].short}
              >
                {CLASS_PILL[dominant]}
              </span>
            )}
          </div>
        )}

        {/* Line 3 — venue mix. Ba = bat-friendly, Bo = bowl-friendly, Ne = neutral/balanced. */}
        {venueSummary && totalGames > 0 && (
          <div
            className="mt-0.5 flex items-center gap-1 text-[10px] leading-tight tabular-nums"
            title="Games by ground type — Ba bat-friendly · Bo bowl-friendly · Ne neutral. Reporting only, venue does not affect any price."
          >
            <span className={venueSummary.batGames ? "text-red-600 dark:text-red-400" : "text-muted-foreground/40"}>
              {venueSummary.batGames} Ba
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span className={venueSummary.bowlGames ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/40"}>
              {venueSummary.bowlGames} Bo
            </span>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-muted-foreground">{venueSummary.balancedGames} Ne</span>
          </div>
        )}
      </button>

      {/* ── Players ── the column scrolls inside itself so the XI always fills the fold. */}
      {/* The reserve below (chrome: sticky auction header + legend + range line + dots) is tuned so
          11 rows × 44px still clear the fold on a 390×844 phone. */}
      <div className="min-h-0 overflow-y-auto overscroll-contain max-h-[var(--lineups-col-h,calc(100dvh-280px))]">
        {xi.map((p) => (
          <LineupRow
            key={p.player_id}
            p={p}
            owner={p.sold_to_participant ? ownerById.get(p.sold_to_participant) : undefined}
            isMine={p.status === "SOLD" && p.sold_to_participant === myId}
            onClick={() => onPlayerClick(p.player_id)}
          />
        ))}
        {bench.length > 0 && (
          <div className="text-center text-[9px] tracking-widest text-muted-foreground/70 py-0.5 bg-muted/40 border-y border-dashed border-border">
            BENCH
          </div>
        )}
        {bench.map((p) => (
          <LineupRow
            key={p.player_id}
            p={p}
            owner={p.sold_to_participant ? ownerById.get(p.sold_to_participant) : undefined}
            isMine={p.status === "SOLD" && p.sold_to_participant === myId}
            onClick={() => onPlayerClick(p.player_id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── One player row ──────────────────────────────────────────────────

function LineupRow({
  p,
  owner,
  isMine,
  onClick,
}: {
  p: PoolPlayer;
  owner: Participant | undefined;
  isMine: boolean;
  onClick: () => void;
}) {
  const sold = p.status === "SOLD";
  const ownColor = owner?.color ?? "#787878";
  const notFit = Boolean(p.availability && p.availability !== "FIT");

  // Dynamic owner colour → a CSS custom property, so the gradient can be expressed as a static
  // class-free style while the light/dark STRENGTH comes from `--own-a` set by a `dark:` variant.
  // (`--own-a` must NOT be set inline: an inline declaration would out-specify the dark variant.)
  // MY picks are solid dark green with white text — NOT my participant colour. That is the board's
  // long-standing convention (getPlayerBg in page.tsx uses #14532d + a green ring): my own squad has
  // to be findable at a glance, which a sixth pastel among five others isn't. Opponents keep the
  // gradient in their own colour.
  const mineSold = sold && isMine;
  const style: CSSProperties = mineSold
    ? { backgroundColor: MINE_BG, borderLeftColor: "#4ade80" }
    : sold
    ? ({
        ["--own" as string]: ownColor,
        borderLeftColor: ownColor,
        backgroundImage:
          "linear-gradient(90deg, color-mix(in srgb, var(--own) var(--own-a), transparent), color-mix(in srgb, var(--own) var(--own-b), transparent))",
      } as CSSProperties)
    : {};

  const price = sold
    ? p.sold_price != null
      ? p.sold_price.toFixed(1)
      : "—"
    : p.val_expected > 0
    ? `open ${p.val_expected.toFixed(1)}`
    : "open";

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`w-full text-left flex items-center gap-1.5 min-h-[44px] pl-1.5 pr-2 py-1 border-b border-border/60 last:border-b-0 border-l-[3px] transition-colors ${
        mineSold
          ? "[border-left-style:solid] text-white font-medium ring-1 ring-inset ring-green-400/60"
          : sold
          ? "[border-left-style:solid] [--own-a:26%] [--own-b:5%] dark:[--own-a:42%] dark:[--own-b:8%]"
          : "[border-left-style:dashed] border-l-muted-foreground/50 hover:bg-muted/40"
      }`}
      title={`${p.name}${sold ? ` — sold to ${owner?.name ?? "?"}` : " — available"}`}
    >
      <span
        className={`w-4 shrink-0 text-[10px] font-mono tabular-nums text-right ${
          mineSold ? "text-white/70" : "text-muted-foreground/70"
        }`}
      >
        {p.squad_number || "–"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 min-w-0">
          {/* Same caution glyph the grid uses, so an availability risk reads identically in both
              views — and it stays legible on the dark-green "mine" ground, which a tinted amber
              character would not. */}
          {notFit && (
            <span
              className="shrink-0 text-[12px] leading-none"
              title={p.availability ?? undefined}
              aria-label={p.availability ?? "Not fully fit"}
            >
              {"\u26A0\uFE0F"}
            </span>
          )}
          <span className="block text-[13px] font-semibold leading-tight truncate">{p.name}</span>
        </span>
        <span
          className={`block text-[10px] leading-tight truncate tabular-nums ${
            mineSold ? "text-white/75" : "text-muted-foreground"
          }`}
        >
          {ROLE_SHORT[p.role] ?? p.role} · {price}
          {p.efppm > 0 ? ` · e${p.efppm.toFixed(1)}` : ""}
        </span>
      </span>
      {p.is_overseas ? (
        <span
          className={`shrink-0 text-[10px] ${mineSold ? "text-yellow-300" : "text-muted-foreground/60"}`}
          title="Overseas"
        >
          {"✈"}
        </span>
      ) : null}
    </button>
  );
}

export default LineupsBoard;
