// India vs England Men's T20 2026 — 5-match bilateral T20I series (1–11 Jul 2026).
// Archetype: BILATERAL (see CLAUDE.md "Valuation model (bilateral T20I series)").
//
// Players ordered as the CONFIRMED probable XI (1–11, batting order) then bench (12+)
// -> squad_number. XI = 5 expected matches (plays every game); bench = 2 (5-match
// series rotates / experiments in dead rubbers). No franchise league season, so the
// valuation drops the IPL-season buckets and weights Last-10-quality 60% + all-quality-30mo
// 40% (engine bilateral branch). Venue model is ON but bowl-leaning — see VENUES below.

export type Role = "BAT" | "BOWL" | "AR" | "WK";
export type BilateralVenueType = "bat_road" | "balanced" | "bowl_friendly";

export interface BilateralSquadPlayer {
  name: string;
  role: Role;
  note?: string;
}

export interface BilateralTeam {
  name: string;
  short: string;
  country: string; // matches players.country for capped players (best-effort; match is by cricsheet_id, not country)
  color: string;
  players: BilateralSquadPlayer[];
}

export const IND_VS_ENG_T20_2026_NAME = "India vs England Men's T20 2026";
export const BILATERAL_XI_SIZE = 11;

// Announced squads (India 16, England 17). Order = confirmed probable XI then bench.
export const IND_VS_ENG_T20_2026: BilateralTeam[] = [
  {
    name: "India", short: "IND", country: "India", color: "#1A75CF",
    players: [
      { name: "Abhishek Sharma", role: "AR" },        // 1
      { name: "Sanju Samson", role: "WK" },            // 2
      { name: "Tilak Varma", role: "BAT" },            // 3  (squad VC — armband only, no pricing effect)
      { name: "Shreyas Iyer", role: "BAT" },           // 4  (squad C — armband only)
      { name: "Shivam Dube", role: "AR" },             // 5
      { name: "Axar Patel", role: "AR" },              // 6
      { name: "Washington Sundar", role: "AR" },       // 7
      { name: "Arshdeep Singh", role: "BOWL" },        // 8
      { name: "Varun Chakravarthy", role: "BOWL" },    // 9
      { name: "Ravi Bishnoi", role: "BOWL" },          // 10
      { name: "Harshit Rana", role: "BOWL" },          // 11
      { name: "Vaibhav Sooryavanshi", role: "BAT", note: "Uncapped in T20Is; priced off IPL 2025 form (V Suryavanshi)." }, // 12
      { name: "Ishan Kishan", role: "WK" },            // 13
      { name: "Prasidh Krishna", role: "BOWL" },       // 14
      { name: "Suryansh Shedge", role: "AR", note: "Uncapped — little senior data; prices near baseline." }, // 15
      { name: "Prince Yadav", role: "BOWL", note: "Uncapped pacer — limited data; prices near baseline." }, // 16
    ],
  },
  {
    name: "England", short: "ENG", country: "England", color: "#012169",
    players: [
      { name: "Phil Salt", role: "WK" },               // 1
      { name: "Jos Buttler", role: "WK" },             // 2
      { name: "Harry Brook", role: "BAT" },            // 3  (squad C — armband only)
      { name: "Jacob Bethell", role: "AR" },           // 4
      { name: "Will Jacks", role: "AR" },              // 5
      { name: "Sam Curran", role: "AR" },              // 6
      { name: "Liam Dawson", role: "AR" },             // 7
      { name: "Jofra Archer", role: "BOWL" },          // 8
      { name: "Adil Rashid", role: "BOWL" },           // 9
      { name: "Saqib Mahmood", role: "BOWL" },         // 10
      { name: "Luke Wood", role: "BOWL" },             // 11
      { name: "Tom Banton", role: "BAT" },             // 12
      { name: "Jordan Cox", role: "WK" },              // 13
      { name: "Rehan Ahmed", role: "AR" },             // 14
      { name: "James Coles", role: "AR", note: "Uncapped (maiden call-up) — no senior data; prices near baseline." }, // 15
      { name: "Josh Tongue", role: "BOWL", note: "No T20I history in DB — prices near baseline." }, // 16
      { name: "Sonny Baker", role: "BOWL", note: "Uncapped pace — limited data; prices near baseline." }, // 17
    ],
  },
];

// Full announced name (normName form) -> exact cricsheet/DB spelling. FALLBACK for the
// players whose global-registry pid is an espn:/slug: (no cricsheet_id), so the registry-
// first cricsheet_id match can't fire. Several England capped players sit in the DB under
// cricsheet initials with country="Unknown" (HC Brook, AU Rashid) — matched here by exact
// spelling, NOT by country.
export const IND_ENG_NAME_ALIASES: Record<string, string> = {
  "shreyas iyer": "SS Iyer",
  "axar patel": "AR Patel",
  "vaibhav sooryavanshi": "V Suryavanshi",
  "varun chakravarthy": "Varun Chakaravarthy",
  "prasidh krishna": "Prasidh Krishna",
  "harry brook": "HC Brook",
  "adil rashid": "AU Rashid",
  "saqib mahmood": "S Mahmood",
};

// Venue model — the 5 series grounds, men's-only, classified on batter-FP ÷ bowler-FP
// (NOT blended avg FP) over FULL men's T20I history with cricsheet's name variants merged
// (it renamed grounds ~2021). Ratios computed 2026-06-30: Trent Bridge 0.87 (bowl), Rose
// Bowl 0.99 (balanced), Old Trafford 1.09 (balanced), Bristol 0.93 (bowl), Durham 0.73
// (bowl). Net = bowl-leaning. `variants` lets the engine bucket a player's history under
// EITHER spelling into the right venue type. See CLAUDE.md "Venue classification".
export const IND_VS_ENG_VENUES: {
  canonical: string;
  variants: string[];
  type: BilateralVenueType;
}[] = [
  { canonical: "Trent Bridge, Nottingham", variants: ["Trent Bridge", "Trent Bridge, Nottingham"], type: "bowl_friendly" },
  { canonical: "The Rose Bowl, Southampton", variants: ["The Rose Bowl", "The Rose Bowl, Southampton"], type: "balanced" },
  { canonical: "Old Trafford, Manchester", variants: ["Old Trafford", "Old Trafford, Manchester"], type: "balanced" },
  { canonical: "County Ground, Bristol", variants: ["County Ground, Bristol"], type: "bowl_friendly" },
  { canonical: "Riverside Ground, Chester-le-Street", variants: ["Riverside Ground", "Riverside Ground, Chester-le-Street"], type: "bowl_friendly" },
];

// XI (1–11) plays all 5; bench (12+) ~2 (rotation/dead-rubber experiments in a 5-match series).
export function bilateralExpectedMatches(squadNumber: number): number {
  return squadNumber >= 1 && squadNumber <= BILATERAL_XI_SIZE ? 5 : 2;
}
