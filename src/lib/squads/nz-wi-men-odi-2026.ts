// New Zealand vs West Indies Men's ODI 2026 — 5-match bilateral ODI series (New Zealand tour
// of West Indies). ODIs 1-3 at Providence Stadium, Guyana (11/13/16 Jul); ODIs 4-5 at
// Kensington Oval, Barbados (19/21 Jul). Archetype: MEN'S ODI BILATERAL.
//
// Squads verified 11 Jul 2026 (ICC / Wisden / CWI). NZ named a heavily-rotated 16 (no
// Williamson, Boult, Conway, Ravindra; Henry/Jamieson/O'Rourke rested; Sears injured -> Lister).
// WI named 15 for the first three ODIs (Barbados-leg squad TBD; Hetmyer released to MLC; Springer
// withdrew -> Keemo Paul). Order = probable XI (1-11) then bench; XIs unconfirmed pre-toss.
//
// Valuation: MEN'S ODI bilateral. Venue ON (both grounds classify bowl_friendly on men's ODI
// bat-FP/bowl-FP). Score 1 = 60% last-10 + 40% all-quality on men's ODI, quality = ODIs vs
// top-8 nations. Expected matches: XI(1-11)=5, bench=2. See engine.ts isMensOdi branch.

export type Role = "BAT" | "BOWL" | "AR" | "WK";
export type OdiVenueType = "bat_road" | "balanced" | "bowl_friendly";

export interface MensOdiSquadPlayer {
  name: string;
  role: Role;
  note?: string;
}

export interface MensOdiTeam {
  name: string;
  short: string;
  country: string;
  color: string;
  players: MensOdiSquadPlayer[];
}

export const NZ_VS_WI_MEN_ODI_2026_NAME = "New Zealand vs West Indies Men's ODI 2026";
export const MENS_ODI_XI_SIZE = 11;

export const NZ_VS_WI_MEN_ODI_2026: MensOdiTeam[] = [
  {
    name: "New Zealand", short: "MNZ", country: "New Zealand", color: "#000000",
    players: [
      { name: "Will Young", role: "BAT" },          // 1
      { name: "Tom Latham", role: "WK" },            // 2
      { name: "Nick Kelly", role: "BAT" },           // 3
      { name: "Daryl Mitchell", role: "AR" },        // 4
      { name: "Henry Nicholls", role: "BAT" },       // 5
      { name: "Mark Chapman", role: "BAT" },         // 6
      { name: "Michael Bracewell", role: "AR" },     // 7
      { name: "Mitchell Santner", role: "AR" },      // 8  (captain)
      { name: "Nathan Smith", role: "AR" },          // 9
      { name: "Jacob Duffy", role: "BOWL" },         // 10
      { name: "Ben Lister", role: "BOWL", note: "In for injured Ben Sears." }, // 11
      { name: "Mitch Hay", role: "WK" },             // 12  (bench)
      { name: "Dean Foxcroft", role: "AR" },         // 13  (bench)
      { name: "Kristian Clarke", role: "AR" },       // 14  (bench)
      { name: "Matthew Fisher", role: "BOWL" },      // 15  (bench; maiden call-up)
      { name: "Jayden Lennox", role: "BOWL" },       // 16  (bench)
    ],
  },
  {
    name: "West Indies", short: "MWI", country: "West Indies", color: "#7B0041",
    players: [
      { name: "John Campbell", role: "BAT" },        // 1
      { name: "Keacy Carty", role: "BAT" },          // 2
      { name: "Ackeem Auguste", role: "BAT" },       // 3
      { name: "Shai Hope", role: "WK" },             // 4  (captain)
      { name: "Sherfane Rutherford", role: "AR" },   // 5
      { name: "Roston Chase", role: "AR" },          // 6
      { name: "Justin Greaves", role: "AR" },        // 7
      { name: "Keemo Paul", role: "AR" },            // 8  (in for withdrawn Shamar Springer)
      { name: "Gudakesh Motie", role: "BOWL" },      // 9
      { name: "Alzarri Joseph", role: "BOWL" },      // 10
      { name: "Jayden Seales", role: "BOWL" },       // 11
      { name: "Amir Jangoo", role: "WK" },           // 12  (bench)
      { name: "Matthew Forde", role: "AR" },         // 13  (bench)
      { name: "Shamar Joseph", role: "BOWL" },       // 14  (bench)
      { name: "Vitel Lawes", role: "BOWL", note: "Uncapped leg-spinner; prices near baseline." }, // 15
    ],
  },
];

// Fallback exact-spelling aliases. John Campbell has TWO "J Campbell" candidates in the DB
// (fuzzy bails on the ambiguity) — pin him to JD Campbell (the capped WI opener, 9 ODIs).
export const NZ_WI_MEN_ODI_NAME_ALIASES: Record<string, string> = {
  "john campbell": "JD Campbell",
};

// Venue model — both series grounds classify bowl_friendly on men's ODI batter-FP ÷ bowler-FP
// (2018+), with cricsheet name variants consolidated. Providence (Guyana) ~0.6-0.8, Kensington
// Oval (Barbados) ~0.6-0.9 — bat FP well below bowl FP => bowl_friendly. Net = bowl-leaning.
export const NZ_WI_MEN_ODI_VENUES: {
  canonical: string;
  variants: string[];
  type: OdiVenueType;
}[] = [
  {
    canonical: "Providence Stadium, Guyana",
    variants: ["Providence Stadium", "Providence Stadium, Guyana", "Guyana National Stadium, Providence"],
    type: "bowl_friendly",
  },
  {
    canonical: "Kensington Oval, Bridgetown, Barbados",
    variants: ["Kensington Oval, Barbados", "Kensington Oval, Bridgetown", "Kensington Oval, Bridgetown, Barbados"],
    type: "bowl_friendly",
  },
];

// XI (1-11) plays all 5 ODIs; bench (12+) ~2 (a 5-match series rotates / experiments).
export function mensOdiExpectedMatches(squadNumber: number): number {
  return squadNumber >= 1 && squadNumber <= MENS_ODI_XI_SIZE ? 5 : 2;
}
