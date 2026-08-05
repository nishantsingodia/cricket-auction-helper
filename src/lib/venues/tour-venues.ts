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
import { computeBatIndex, describeBatIndex, venueTypeFromBatIndex } from "./bat-index";
import { canonicalVenue } from "@/lib/registry/venues";
import {
  CPL_2026_NAME,
  CPL_VENUES,
  CPL_TEAM_SCHEDULE,
  CPL_TOURNAMENT_SCHEDULE,
  CPL_VENUE_BASIS,
} from "@/lib/squads/cpl-2026";

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
  // Bat Index — reporting only, never priced (see src/lib/venues/bat-index.ts). >median favours
  // batting, <median favours bowling. `batIndexMatches` is the sample; a 5-match read is weak.
  batIndex?: number;
  batIndexMatches?: number;
  batIndexSource?: "2yr" | "4yr" | "neutral";
  batIndexLabel?: string;
}

/** League median Bat Index, so a ground can be read RELATIVE to it (the median is ~0.90, not 1.0). */
export interface TourVenueContextExtras {
  batIndexMedian?: number;
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
  // League median Bat Index — read every ground RELATIVE to this (it is ~0.90, not 1.0, because a
  // wicket is worth 30 points so bowlers out-earn batters on average).
  batIndexMedian?: number;
}

// Decorates each venue with its Bat Index (reporting only — it never affects a price).
function withBatIndex(
  venues: TourVenue[],
  gender: "male" | "female"
): { venues: TourVenue[]; batIndexMedian: number } {
  const { byGround, median } = computeBatIndex(gender);
  return {
    median,
    batIndexMedian: median,
    venues: venues.map((v) => {
      // The tour files' canonical spelling may differ from the registry's, so map it first.
      const e = byGround.get(canonicalVenue(v.canonical));
      if (!e) return v;
      return {
        ...v,
        // DERIVED, not the hand-typed value: the curated `type` fields were mis-calibrated against
        // 1.0 instead of the ~0.906 median and had 5 of 8 CPL grounds wrong. Deriving it here means
        // the label can never drift from the data again. Falls back to the curated type only when a
        // ground has no usable sample.
        type: e.source === "neutral" ? v.type : venueTypeFromBatIndex(e.batIndex, median),
        batIndex: e.batIndex,
        batIndexMatches: e.matches,
        batIndexSource: e.source,
        batIndexLabel:
          e.source === "neutral" ? "No usable sample" : describeBatIndex(e.batIndex, median).label,
      };
    }),
  } as { venues: TourVenue[]; batIndexMedian: number; median: number };
}

// Returns the venue context for a tour name, or null if the tour has no home/venue model here yet.
export function getTourVenueContext(tournamentName: string): TourVenueContext | null {
  const isHundredMen = tournamentName === THE_HUNDRED_MEN_2026_NAME;
  const isHundredWomen = tournamentName === THE_HUNDRED_WOMEN_2026_NAME;
  const isLpl = tournamentName === LPL_2026_NAME;
  const isCpl = tournamentName === CPL_2026_NAME;

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
      ...(() => { const d = withBatIndex(HUNDRED_VENUES.map((v) => ({ canonical: v.canonical, variants: v.variants, type: v.type })), isHundredWomen ? "female" : "male"); return { venues: d.venues, batIndexMedian: d.batIndexMedian }; })(),
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
      ...(() => { const d = withBatIndex(LPL_VENUES.map((v) => ({ canonical: v.canonical, variants: v.variants, type: v.type })), "male"); return { venues: d.venues, batIndexMedian: d.batIndexMedian }; })(),
      teamSchedule: LPL_TEAM_SCHEDULE,
      homeOf,
    };
  }

  if (isCpl) {
    // Unlike LPL this is NOT a neutral festival: CPL's legs are regional, so each franchise plays
    // 4–5 of its 10 league games at its own ground. Home grounds are therefore real.
    const homeOf: TourVenueContext["homeOf"] = {
      ABF: "Sir Vivian Richards Stadium, North Sound, Antigua",
      BAR: "Kensington Oval, Bridgetown, Barbados",
      GAW: "Providence Stadium, Guyana",
      JAM: "Sabina Park, Kingston, Jamaica",
      SKN: "Warner Park, Basseterre, St Kitts",
      SLK: "Daren Sammy National Cricket Stadium, Gros Islet, St Lucia",
      TKR: "Queen's Park Oval, Port of Spain, Trinidad",
    };
    return {
      tour: tournamentName,
      neutral: false,
      gender: "male",
      venueFormats: ["CPL", "T20"],
      venueWindowMonths: 60,
      ...(() => { const d = withBatIndex(CPL_VENUES.map((v) => ({ canonical: v.canonical, variants: v.variants, type: v.type })), "male"); return { venues: d.venues, batIndexMedian: d.batIndexMedian }; })(),
      // Mirror the engine: honour CPL_VENUE_BASIS so the header chip never disagrees with valuations.
      teamSchedule:
        CPL_VENUE_BASIS === "tournament"
          ? Object.fromEntries(Object.keys(CPL_TEAM_SCHEDULE).map((t) => [t, CPL_TOURNAMENT_SCHEDULE]))
          : CPL_TEAM_SCHEDULE,
      homeOf: CPL_VENUE_BASIS === "tournament"
        ? Object.fromEntries(Object.keys(CPL_TEAM_SCHEDULE).map((t) => [t, null]))
        : homeOf,
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
