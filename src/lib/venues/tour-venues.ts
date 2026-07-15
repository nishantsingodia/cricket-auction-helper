// Tour venue context — the SINGLE SOURCE the auction header + venue view read from, so what you
// see matches exactly what the EFPPM valuation engine does (src/lib/valuation/engine.ts). It
// re-exposes the same per-tour schedule + authoritative venue classification the engine builds in
// its isHundred / isLpl blocks, plus a CURATED spin/pace/seam profile per ground (hand-classified
// cricket knowledge — NOT data-derived, and NOT fed into EFPPM; see VENUE_PROFILES note).
//
// Scope today: The Hundred (Men + Women) and LPL only — the two the header was missing. IPL keeps
// its own inline breakdown in the auction route; other tours can be folded in here later.

import {
  THE_HUNDRED_MEN_2026_NAME,
  THE_HUNDRED_WOMEN_2026_NAME,
  HUNDRED_MEN_2026,
  HUNDRED_WOMEN_2026,
  HUNDRED_VENUES,
} from "@/lib/squads/the-hundred-2026";
import {
  LPL_2026_NAME,
  LPL_2026,
  LPL_VENUES,
  LPL_TEAM_SCHEDULE,
} from "@/lib/squads/lpl-2026";

export type VenueType = "bat_road" | "balanced" | "bowl_friendly";

// Human labels for the three bat/bowl classes (the character EFPPM actually uses).
export const VENUE_TYPE_LABEL: Record<VenueType, string> = {
  bat_road: "Bat-friendly",
  balanced: "Balanced",
  bowl_friendly: "Bowl-friendly",
};
// Short header pill text.
export const VENUE_TYPE_SHORT: Record<VenueType, string> = {
  bat_road: "Bat",
  balanced: "Bal",
  bowl_friendly: "Bowl",
};

// ── Curated pitch profiles (spin / pace / seam) ────────────────────────────────
// IMPORTANT — this is CURATED cricket knowledge, not a computed stat. We have NO bowler-style
// data (players.bowl_style is empty for all 8,661 players; the venues table's pace/spin wicket%
// columns are entirely NULL), so a data-derived spin-vs-pace split is not possible today. These
// pace/swing/turn readings (1–5, for July/Aug conditions) and notes are a manual classification
// for transparency in the venue view. They do NOT influence valuation — EFPPM only uses the
// bat/bowl (bat_road/balanced/bowl_friendly) class above.
export type PitchStyle = "pace" | "seam-swing" | "spin" | "mixed";

export interface VenueProfile {
  style: PitchStyle; // dominant bowling threat
  pace: number; // 1–5: pace off the surface / carry & bounce
  swing: number; // 1–5: lateral / new-ball movement
  turn: number; // 1–5: grip & spin
  note: string; // curated prose
}

// Keyed by canonical venue name (matching HUNDRED_VENUES / LPL_VENUES canonicals).
export const VENUE_PROFILES: Record<string, VenueProfile> = {
  // — The Hundred: 8 English grounds (July/Aug: seam & swing early, dry pitches take some turn) —
  "Lord's, London": {
    style: "seam-swing", pace: 3, swing: 4, turn: 2,
    note: "The slope aids seam movement and new-ball swing under cloud. Traditionally the more bowl-dominant London ground; spin has limited purchase.",
  },
  "Kennington Oval, London": {
    style: "mixed", pace: 4, swing: 3, turn: 3,
    note: "Hard, true surface with genuine pace and bounce early. The driest London pitch — it wears and offers the most turn of the English grounds later on.",
  },
  "Trent Bridge, Nottingham": {
    style: "seam-swing", pace: 3, swing: 5, turn: 2,
    note: "The classic English swing bowler's ground — pronounced lateral movement with the Duke's ball. Short square boundaries reward power hitting once the ball stops moving.",
  },
  "Edgbaston, Birmingham": {
    style: "pace", pace: 4, swing: 3, turn: 2,
    note: "Pace and carry with early seam; becomes good for strokeplay once the ball softens. Big-occasion ground.",
  },
  "Sophia Gardens, Cardiff": {
    style: "spin", pace: 2, swing: 3, turn: 3,
    note: "Slower, lower Welsh surface — the most spin/slower-ball-friendly of the English venues. Some seam early; hard to hit through the line.",
  },
  "Headingley, Leeds": {
    style: "seam-swing", pace: 3, swing: 4, turn: 2,
    note: "Seam and swing when overcast, pace off the surface; flattens into a good batting deck when the sun's out.",
  },
  "Old Trafford, Manchester": {
    style: "mixed", pace: 4, swing: 3, turn: 3,
    note: "Good pace and bounce; the surface grips and turns as it wears, so spin plays a bigger role here than at most English grounds.",
  },
  "The Rose Bowl, Southampton": {
    style: "pace", pace: 4, swing: 3, turn: 3,
    note: "True surface with pace and bounce — among the better batting decks in the pool; spin gets some grip later in the innings.",
  },
  // — LPL: Sri Lankan grounds (subcontinent — slow, low, spin-dominant; evening dew a factor) —
  "Sinhalese Sports Club Ground, Colombo": {
    style: "spin", pace: 2, swing: 2, turn: 5,
    note: "Slow, low and dry — heavy assistance for spin, and pace bowlers rely on cutters and change-ups. Among the most bowl-dominant surfaces in the pool.",
  },
  "Rangiri Dambulla International Stadium": {
    style: "spin", pace: 2, swing: 2, turn: 4,
    note: "Slow subcontinental surface — grip and turn for spin and effective slower balls. Scoring gets harder as the pitch wears.",
  },
  "Pallekele International Cricket Stadium": {
    style: "spin", pace: 3, swing: 2, turn: 4,
    note: "A touch more pace and carry than the Colombo/Dambulla decks, but spin is still key. Heavy evening dew can flip the toss advantage under lights.",
  },
  "R Premadasa Stadium, Colombo": {
    style: "spin", pace: 3, swing: 2, turn: 4,
    note: "Playoffs venue — two-paced surface with spin assistance; heavy evening dew makes chasing easier under lights.",
  },
};

// ── Tour context ───────────────────────────────────────────────────────────────

export interface TourVenue {
  canonical: string;
  variants: string[];
  type: VenueType;
}

export interface TourVenueContext {
  tour: string;
  neutral: boolean; // true = festival with no home grounds (LPL)
  gender: "male" | "female";
  // FP formats to read venue history from (matches engine's venueFormats).
  venueFormats: string[];
  venueWindowMonths: number; // recency window the engine uses for venue reads
  venues: TourVenue[];
  // teamShort -> its schedule (venue canonical + games). Games can be fractional for Hundred away.
  teamSchedule: Record<string, Array<{ venue: string; games: number }>>;
  // teamShort -> home ground canonical (null for neutral festivals).
  homeOf: Record<string, string | null>;
}

// Returns the venue context for a tour name, or null if the tour has no home/venue model here yet.
export function getTourVenueContext(tournamentName: string): TourVenueContext | null {
  const isHundredMen = tournamentName === THE_HUNDRED_MEN_2026_NAME;
  const isHundredWomen = tournamentName === THE_HUNDRED_WOMEN_2026_NAME;
  const isLpl = tournamentName === LPL_2026_NAME;

  if (isHundredMen || isHundredWomen) {
    const teams = isHundredMen ? HUNDRED_MEN_2026 : HUNDRED_WOMEN_2026;
    const grounds = HUNDRED_VENUES.map((v) => v.canonical);
    const teamSchedule: TourVenueContext["teamSchedule"] = {};
    const homeOf: TourVenueContext["homeOf"] = {};
    for (const t of teams) {
      // Mirror the engine: home ground x4 + the other 7 grounds spread (~4/7 each).
      const away = grounds
        .filter((g) => g !== t.home)
        .map((g) => ({ venue: g, games: 4 / 7 }));
      teamSchedule[t.short] = [{ venue: t.home, games: 4 }, ...away];
      homeOf[t.short] = t.home;
    }
    return {
      tour: tournamentName,
      neutral: false,
      gender: isHundredMen ? "male" : "female",
      venueFormats: ["HUN", "T20"],
      venueWindowMonths: 30,
      venues: HUNDRED_VENUES.map((v) => ({ canonical: v.canonical, variants: v.variants, type: v.type })),
      teamSchedule,
      homeOf,
    };
  }

  if (isLpl) {
    const homeOf: TourVenueContext["homeOf"] = {};
    for (const t of LPL_2026) homeOf[t.short] = null; // neutral festival
    return {
      tour: tournamentName,
      neutral: true,
      gender: "male",
      venueFormats: ["LPL", "T20"],
      venueWindowMonths: 60,
      // Only the 3 league grounds carry a per-team schedule; Premadasa is a playoffs-only venue.
      venues: LPL_VENUES.map((v) => ({ canonical: v.canonical, variants: v.variants, type: v.type })),
      teamSchedule: LPL_TEAM_SCHEDULE,
      homeOf,
    };
  }

  return null;
}

// Per-team venue summary for the auction header: home ground (+ games + its class) and the
// bat/bowl breakdown across the team's whole schedule (games rounded for display).
export interface TeamVenueSummary {
  neutral: boolean;
  home: string | null; // canonical home ground (null for neutral festivals)
  homeGames: number;
  homeType: VenueType | null;
  // schedule bat/bowl breakdown (rounded game counts by class)
  batGames: number;
  balancedGames: number;
  bowlGames: number;
}

export function buildTeamVenueSummaries(
  ctx: TourVenueContext
): Record<string, TeamVenueSummary> {
  const typeOf = new Map(ctx.venues.map((v) => [v.canonical, v.type]));
  const out: Record<string, TeamVenueSummary> = {};
  for (const [team, schedule] of Object.entries(ctx.teamSchedule)) {
    let bat = 0, bal = 0, bowl = 0;
    for (const { venue, games } of schedule) {
      const t = typeOf.get(venue);
      if (t === "bat_road") bat += games;
      else if (t === "balanced") bal += games;
      else if (t === "bowl_friendly") bowl += games;
    }
    const home = ctx.homeOf[team] ?? null;
    out[team] = {
      neutral: ctx.neutral,
      home,
      homeGames: home ? (ctx.teamSchedule[team].find((s) => s.venue === home)?.games ?? 0) : 0,
      homeType: home ? (typeOf.get(home) ?? null) : null,
      batGames: Math.round(bat),
      balancedGames: Math.round(bal),
      bowlGames: Math.round(bowl),
    };
  }
  return out;
}
