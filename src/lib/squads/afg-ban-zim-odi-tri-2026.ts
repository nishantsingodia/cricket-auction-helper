// AFG / BAN / ZIM ODI Tri-Series 2026 (UAE, 17-23 Oct). Three league games (each side plays the
// other two once) + a final. Three teams, ONE pool, one shared purse.
//
// Archetype: built on the TWIN ODI model (sa-aus-eng-sl-odi-2026.ts) — `format='ODI'` form, 36-month
// windows, 60/40 recency, weak-opposition ODIs DISCOUNTED x0.83 rather than deleted, csid-bridged
// identity with fuzzy OFF. Two departures, both forced by this pool:
//
// 1. AFGHANISTAN HAS NO ODI DATA. Cricsheet withholds every Afghanistan men's match as policy (see
//    reference memory). So an Afghan's ODI-scale EFPPM is taken from TRI_ODI_AFG_EFPPM below
//    instead of from the (empty) ODI query:
//      - franchise-T20 form (IPL/BBL/PSL/SA20/ILT20/CPL/LPL/MLC/BLAST, last 30 months) x a MEASURED
//        ODI/franchise-T20 FP ratio, within-player, men since 2021, >= 10 games in each, n=259:
//        BAT 1.093 / WK 1.065 / AR 1.239 / BOWL 1.264 (pooled 1.185). ODI side uses the same 0.83
//        weak-opposition discount so the two are on one scale.
//      - ODI specialists with no (or a thin) franchise record get a DECLARED prior, anchored to the
//        measured BAN/ZIM ODI EFPPMs (Tanzid 67, Shanto 57, Hridoy 57, Litton 47). These are
//        judgement, not measurement — flagged per player.
// 2. NO OPPOSITION FACTOR. Every side plays both others, so the opponent mix is near-identical,
//    and Afghanistan's difficulty is unmeasurable anyway. Factor = 1.0 for all.
//
// Expected matches: XI = 2 league games + P(reaching the final). P(final) AFG 0.80 / BAN 0.70 /
// ZIM 0.50 (sums to 2.0 — two finalists). Bench 0.5 (four-game event, little rotation).
// The XI seed below is a curated guess — worth a manual pass on the board before bidding.

import type { BilateralTeam, Role } from "./ind-vs-eng-t20-2026";

export const AFG_BAN_ZIM_ODI_TRI_2026_NAME = "AFG v BAN v ZIM ODI Tri-Series 2026";
export const TRI_ODI_XI_SIZE = 11;

export type { BilateralTeam, Role };

// ICC fixture list. (One outlet lists match 3 + the final at Sharjah; the ICC/BCB list Abu Dhabi.)
export const TRI_ODI_FIXTURES = [
  { match: 1, date: "2026-10-17", teams: "BAN v ZIM", venue: "Sheikh Zayed Stadium, Abu Dhabi" },
  { match: 2, date: "2026-10-19", teams: "AFG v ZIM", venue: "Sheikh Zayed Stadium, Abu Dhabi" },
  { match: 3, date: "2026-10-21", teams: "AFG v BAN", venue: "Sheikh Zayed Stadium, Abu Dhabi" },
  { match: 4, date: "2026-10-23", teams: "Final", venue: "Sheikh Zayed Stadium, Abu Dhabi" },
] as const;

const P_FINAL: Record<string, number> = { AFG: 0.8, BAN: 0.7, ZIM: 0.5 };

export function triOdiExpectedMatches(teamShort: string, squadNumber: number): number {
  if (squadNumber >= 1 && squadNumber <= TRI_ODI_XI_SIZE) return 2 + (P_FINAL[teamShort] ?? 0.67);
  return 0.5;
}

// ODI-scale EFPPM for every Afghan, keyed on the name the pool row will carry (DB name for the nine
// with a franchise record — identical to the squad spelling here — squad name for statless rows).
// Measured 14 Oct 2026. "proxy" = franchise-T20 avg x role ratio; "prior" = declared.
export const TRI_ODI_AFG_EFPPM: Record<string, number> = {
  "Mohammad Nabi": 90.9,       // proxy: 73.3 x 1.239 (39 games)
  "Fazalhaq Farooqi": 76.1,    // proxy: 60.2 x 1.264 (42)
  "Azmatullah Omarzai": 73.4,  // proxy: 58.1 x 1.264 (40; DB role BOWL)
  "Rashid Khan": 72.4,         // proxy: 57.3 x 1.264 (69)
  "AM Ghazanfar": 68.8,        // proxy: 54.4 x 1.264 (47)
  "Rahmanullah Gurbaz": 60.1,  // proxy: 56.4 x 1.065 (47)
  "Ibrahim Zadran": 65,        // PRIOR — proxy only 43 off 13 T20s; he is AFG's premier ODI bat
  "Sediqullah Atal": 50,       // PRIOR — proxy 40 off 13 T20s, blended up for his ODI top-order role
  "Rahmat Shah": 55,           // PRIOR — no data; ODI No.3 / captain (~ Shanto 57)
  "Hashmatullah Shahidi": 50,  // PRIOR — no data; middle-order anchor
  "Ikram Alikhil": 38,         // PRIOR — no data; reserve keeper
  "Bilal Sami": 45,            // PRIOR — no data; seamer
  "Nangyalai Khan": 40,        // PRIOR — no data
  "Zia Ur Rahman Sharifi": 40, // PRIOR — no data
  "Yamin Ahmadzai": 40,        // PRIOR — no data; seamer
  "Qais Ahmad": 55,            // proxy 77 off only 8 games, shrunk; travelling reserve
};

export const AFG_BAN_ZIM_ODI_TRI_2026: BilateralTeam[] = [
  {
    name: "Afghanistan", short: "AFG", country: "Afghanistan", color: "#0066B3",
    players: [
      { name: "Rahmanullah Gurbaz", role: "WK" },     // 1 (vc)
      { name: "Ibrahim Zadran", role: "BAT" },         // 2
      { name: "Sediqullah Atal", role: "BAT" },        // 3
      { name: "Rahmat Shah", role: "BAT" },            // 4 (c)
      { name: "Hashmatullah Shahidi", role: "BAT" },   // 5
      { name: "Azmatullah Omarzai", role: "AR" },      // 6
      { name: "Mohammad Nabi", role: "AR" },           // 7
      { name: "Rashid Khan", role: "BOWL" },           // 8
      { name: "AM Ghazanfar", role: "BOWL" },          // 9
      { name: "Fazalhaq Farooqi", role: "BOWL" },      // 10
      { name: "Bilal Sami", role: "BOWL" },            // 11
      { name: "Ikram Alikhil", role: "WK" },           // 12
      { name: "Nangyalai Khan", role: "BOWL" },        // 13
      { name: "Zia Ur Rahman Sharifi", role: "BOWL" }, // 14
      { name: "Yamin Ahmadzai", role: "BOWL" },        // 15
      { name: "Qais Ahmad", role: "BOWL", note: "Travelling reserve." }, // 16
    ],
  },
  {
    name: "Bangladesh", short: "BAN", country: "Bangladesh", color: "#006A4E",
    players: [
      { name: "Tanzid Hasan Tamim", role: "BAT" },     // 1
      { name: "Soumya Sarkar", role: "BAT" },          // 2
      { name: "Najmul Hossain Shanto", role: "BAT" },  // 3
      { name: "Tawhid Hridoy", role: "BAT" },          // 4
      { name: "Litton Das", role: "WK" },              // 5 (c)
      { name: "Quazi Nurul Hasan Sohan", role: "WK" }, // 6
      { name: "Mehidy Hasan Miraz", role: "AR" },      // 7
      { name: "Rishad Hossain", role: "BOWL" },        // 8
      { name: "Tanvir Islam", role: "BOWL" },          // 9
      { name: "Taskin Ahmed", role: "BOWL" },          // 10
      { name: "Mustafizur Rahman", role: "BOWL" },     // 11
      { name: "Saif Hassan", role: "BAT" },            // 12
      { name: "Musaddek Hossain Saikat", role: "AR" }, // 13
      { name: "Shoriful Islam", role: "BOWL" },        // 14
      { name: "Hasan Mahmud", role: "BOWL" },          // 15
      { name: "Aliss Al Islam", role: "BOWL", note: "Uncapped in ODIs (maiden call-up)." }, // 16
    ],
  },
  {
    name: "Zimbabwe", short: "ZIM", country: "Zimbabwe", color: "#D40000",
    players: [
      { name: "Brian Bennett", role: "BAT" },          // 1
      { name: "Ben Curran", role: "BAT" },             // 2
      { name: "Craig Ervine", role: "BAT" },           // 3
      { name: "Sikandar Raza", role: "AR" },           // 4 (c)
      { name: "Brendan Taylor", role: "WK" },          // 5
      { name: "Tadiwanashe Marumani", role: "WK" },    // 6
      { name: "Ryan Burl", role: "AR" },               // 7
      { name: "Brad Evans", role: "AR" },              // 8
      { name: "Wellington Masakadza", role: "AR" },    // 9
      { name: "Newman Nyamhuri", role: "BOWL" },       // 10
      { name: "Blessing Muzarabani", role: "BOWL" },   // 11
      { name: "Ernest Masuku", role: "BOWL" },         // 12
      { name: "Tafadzwa Tsiga", role: "WK" },          // 13
      { name: "Vincent Masekesa", role: "AR" },        // 14
    ],
  },
];

// Hand-verified cricsheet ids, fuzzy OFF. Afghans with no DB row are deliberately ABSENT (they are
// created statless and priced from TRI_ODI_AFG_EFPPM). Traps: two "Rashid Khan" rows (5f547c8b is
// the real one); a statless "Allah Ghazanfar" duplicate exists (use AM Ghazanfar); Litton is filed
// "Liton Das"; Quazi Nurul Hasan Sohan = "Nurul Hasan"; Musaddek = "Mosaddek Hossain";
// Aliss Al Islam = "Al Islam" (one T20I, v SL at the Asian Games).
export const AFG_BAN_ZIM_ODI_CSID: Record<string, string> = {
  // — Afghanistan —
  "Rahmanullah Gurbaz": "0bacade8",
  "Ibrahim Zadran": "d4550956",
  "Sediqullah Atal": "3c28853f",
  "Azmatullah Omarzai": "8f6dd463",
  "Mohammad Nabi": "62af8546",
  "Rashid Khan": "5f547c8b",
  "AM Ghazanfar": "9ca68676",
  "Fazalhaq Farooqi": "e9c7f0d0",
  "Qais Ahmad": "8d5d991e",
  // — Bangladesh —
  "Tanzid Hasan Tamim": "80fe764d",
  "Soumya Sarkar": "4d9f9686",
  "Najmul Hossain Shanto": "1274d7ab",
  "Tawhid Hridoy": "9e52a414",
  "Litton Das": "0404d43c",
  "Quazi Nurul Hasan Sohan": "d365d463",
  "Mehidy Hasan Miraz": "c58b0108",
  "Rishad Hossain": "5935d694",
  "Tanvir Islam": "aa467af0",
  "Taskin Ahmed": "ef18b66e",
  "Mustafizur Rahman": "0a8fce53",
  "Saif Hassan": "bb95564b",
  "Musaddek Hossain Saikat": "8919756f",
  "Shoriful Islam": "bb34fd31",
  "Hasan Mahmud": "80ad39ac",
  "Aliss Al Islam": "45d38a84",
  // — Zimbabwe —
  "Brian Bennett": "eaa36b2a",
  "Ben Curran": "1786a21b",
  "Craig Ervine": "c96311d4",
  "Sikandar Raza": "26d041c4",
  "Brendan Taylor": "53597be1",
  "Tadiwanashe Marumani": "3d5d51a5",
  "Ryan Burl": "b08252b8",
  "Brad Evans": "e7e86505",
  "Wellington Masakadza": "4bc0a378",
  "Newman Nyamhuri": "943ca0cd",
  "Blessing Muzarabani": "449f4e3c",
  "Ernest Masuku": "7e6e7274",
  "Tafadzwa Tsiga": "a1dcb5b9",
  "Vincent Masekesa": "42b34cb1",
};

// Wide candidate pool — see TWIN_ODI_MATCH_FORMATS for why (identity is csid-bridged, so widening
// cannot cause a namesake error; it only lets the bridge find T20-only rows like the Afghans').
export const TRI_ODI_MATCH_FORMATS = [
  "ODI", "T20", "IPL", "BBL", "BLAST", "HUN", "PSL", "SA20", "ILT20", "CPL", "LPL", "MLC",
  "TEST", "FC",
];

export const TRI_ODI_VENUES = [
  {
    canonical: "Sheikh Zayed Stadium, Abu Dhabi",
    variants: ["Sheikh Zayed Stadium", "Zayed Cricket Stadium, Abu Dhabi"],
    type: "balanced" as const,
  },
];
