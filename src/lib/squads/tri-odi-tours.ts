// Registry of ODI TRI-SERIES tours. One pool over three teams who all play each other, so there is no
// opposition factor; form is the twin-ODI model (see engine.ts isTwinOdi). Adding a tri-series is a
// data change: write the squad file, add an entry here, add the home-page option. The pool route,
// valuation engine and venue context all read this registry.

import type { BilateralTeam } from "./ind-vs-eng-t20-2026";
import {
  AFG_BAN_ZIM_ODI_TRI_2026,
  AFG_BAN_ZIM_ODI_TRI_2026_NAME,
  AFG_BAN_ZIM_ODI_CSID,
  TRI_ODI_AFG_EFPPM,
  TRI_ODI_VENUES as AFG_BAN_ZIM_VENUES,
} from "./afg-ban-zim-odi-tri-2026";
import {
  PAK_ENG_SL_ODI_TRI_2026,
  PAK_ENG_SL_ODI_TRI_2026_NAME,
  PAK_ENG_SL_ODI_CSID,
  PAK_ENG_SL_ODI_VENUES,
} from "./pak-eng-sl-odi-tri-2026";

export interface TriOdiTour {
  name: string;
  teams: BilateralTeam[];
  csid: Record<string, string>;
  /** League games each side plays (single round robin = 2, double = 4). */
  leagueGames: number;
  /** Probability each side reaches the final; must sum to 2.0. */
  pFinal: Record<string, number>;
  /** Expected games for a bench player (squad_number 12+). */
  benchGames: number;
  /** Hard ODI-scale EFPPM for teams with no cricsheet data (keyed by pool player name). */
  efppmOverride?: { teams: string[]; byName: Record<string, number> };
  /** Home side, if any (null = neutral venue, e.g. AFG "hosting" in the UAE). */
  host: string | null;
  venues: { canonical: string; variants: string[]; type: "bat_road" | "balanced" | "bowl_friendly" }[];
  /** Games per venue, same for every side (they all play at the same grounds). */
  schedule: { venue: string; games: number }[];
}

export const TRI_ODI_XI_SIZE = 11;

// Wide candidate pool — see TWIN_ODI_MATCH_FORMATS for why (identity is csid-bridged with fuzzy off,
// so extra candidates cannot cause a namesake error; they only let the bridge find T20-only rows).
export const TRI_ODI_MATCH_FORMATS = [
  "ODI", "T20", "IPL", "BBL", "BLAST", "HUN", "PSL", "SA20", "ILT20", "CPL", "LPL", "MLC",
  "TEST", "FC",
];

export const TRI_ODI_TOURS: TriOdiTour[] = [
  {
    name: AFG_BAN_ZIM_ODI_TRI_2026_NAME,
    teams: AFG_BAN_ZIM_ODI_TRI_2026,
    csid: AFG_BAN_ZIM_ODI_CSID,
    leagueGames: 2,
    pFinal: { AFG: 0.8, BAN: 0.7, ZIM: 0.5 },
    benchGames: 0.5,
    efppmOverride: { teams: ["AFG"], byName: TRI_ODI_AFG_EFPPM },
    host: null,
    venues: AFG_BAN_ZIM_VENUES,
    schedule: [{ venue: AFG_BAN_ZIM_VENUES[0].canonical, games: 3 }],
  },
  {
    name: PAK_ENG_SL_ODI_TRI_2026_NAME,
    teams: PAK_ENG_SL_ODI_TRI_2026,
    csid: PAK_ENG_SL_ODI_CSID,
    leagueGames: 4,
    pFinal: { PAK: 0.75, ENG: 0.65, SL: 0.6 },
    benchGames: 1.0,
    host: "PAK",
    venues: PAK_ENG_SL_ODI_VENUES,
    schedule: [
      { venue: "Rawalpindi Cricket Stadium", games: 2 },
      { venue: "Gaddafi Stadium, Lahore", games: 2.7 },
    ],
  },
];

export function getTriOdiTour(name: string | null | undefined): TriOdiTour | null {
  return TRI_ODI_TOURS.find((t) => t.name === name) ?? null;
}

export function triOdiExpectedMatches(tour: TriOdiTour, teamShort: string, squadNumber: number): number {
  if (squadNumber >= 1 && squadNumber <= TRI_ODI_XI_SIZE) {
    return tour.leagueGames + (tour.pFinal[teamShort] ?? 2 / 3);
  }
  return tour.benchGames;
}
