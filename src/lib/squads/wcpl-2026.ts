// WCPL 2026 — Women's Caribbean Premier League (5–17 Sep 2026, all at Kensington Oval, Barbados).
//
// Archetype: FRANCHISE T20 (like CPL/LPL) but women's, and TINY — 4 teams, 8 matches total.
// FIRST tour to use the 'WCPL' league bucket (cricsheet archive code is `wcl`, NOT `wcpl` —
// that URL 404s; 25 matches, 2022–2025, ingested 4 Sep 2026).
//
// 2026 is the first FOUR-team edition: Jamaica Empress join the three originals, and Barbados
// revert Royals -> Tridents (same rebrand the men's CPL did). 44 players field an XI (4 x 11),
// which is exactly the number the 6-friend / 9-pick auction is built around.
//
// FORMAT — this is the thing that drives pricing here. SINGLE round robin: each team plays only
// THREE league games (5–13 Sep). The table-topper goes straight to the final (17 Sep); 2nd and
// 3rd meet in a playoff (16 Sep) for the other final spot; 4th is done. So there are 4 knockout
// team-slots across 4 teams => an XI player is worth ~3 league + ~1 knockout = 4.0 games, and
// there is almost no rotation to hand a bench player a match. See wcplExpectedMatches.
//
// VENUE: OFF, deliberately. Every one of the 8 matches is at Kensington Oval, so a venue factor
// is the same constant for all 59 players and carries ZERO relative signal (same call as ETPL).
//
// Players ordered probable XI (1–11) then bench (12+) -> squad_number, which is what drives
// expected matches. Squads from the announced rosters + the local-player draft (Wikipedia /
// Jamaica Gleaner / CricketWorld, 4 Sep 2026). `captain` is informational only — the auction
// C/VC premium is EFPPM-driven, not the armband.

export type Role = "BAT" | "BOWL" | "AR" | "WK";

export interface WcplSquadPlayer {
  name: string;
  role: Role;
  overseas: boolean;
  captain?: boolean;
  note?: string;
}

export interface WcplTeam {
  name: string;
  short: string;
  color: string;
  players: WcplSquadPlayer[];
}

export const WCPL_2026_NAME = "WCPL 2026";
export const WCPL_XI_SIZE = 11;

// ⚠️ ASSUMPTION — OVERSEAS CAP IN THE XI = 4. The WCPL playing conditions do not state it in any
// source found on 4 Sep 2026, but Barbados signed exactly 4 overseas while the other three signed
// 5, which is what a 4-in-the-XI rule looks like. The XIs below therefore bench one overseas
// player at GUY (Burns), JAM (Aroob Shah) and TKR (Penna). If the cap turns out to be 5, promote
// them on the board — the XI edit re-values automatically.
export const WCPL_MAX_OVERSEAS_XI = 4;

// Expected matches. 3 league games for everyone; the knockouts add 4 team-slots (playoff 2 +
// final 2) spread over 4 teams, i.e. ~1 more game for an average team => XI = 4.0.
// The bench is worth very little in a 3-game league phase — there are no dead rubbers to
// experiment in, and a squad player only plays on an injury. 12th = 1.2, 13+ = 0.6 (a small
// positive, not 0, so a fringe player prices near the floor instead of free).
export function wcplExpectedMatches(squadNumber: number): number {
  if (squadNumber >= 1 && squadNumber <= WCPL_XI_SIZE) return 4.0;
  if (squadNumber === 12) return 1.2;
  return 0.6;
}

// ── BARBADOS TRIDENTS ───────────────────────────────────────────────────────
// Defending champions (as Barbados Royals). 4 overseas signed => all 4 field.
export const WCPL_2026: WcplTeam[] = [
  {
    name: "Barbados Tridents", short: "BAR", color: "#0057B7",
    players: [
      { name: "Hayley Matthews", role: "AR", overseas: false, captain: true, note: "The single biggest asset in the pool: 137.5 avg FP across 13 WCPL games, opens the batting AND bowls 4 overs." },
      { name: "Suzie Bates", role: "BAT", overseas: true },
      { name: "Qiana Joseph", role: "BAT", overseas: false, note: "63.0 avg FP over 15 WCPL games — comfortably the best local batter after Matthews." },
      { name: "Kiran Navgire", role: "BAT", overseas: true },
      { name: "Maddy Green", role: "WK", overseas: true, note: "Keeps in this XI — Barbados signed no specialist local keeper after Kycia Knight." },
      { name: "Shabika Gajnabi", role: "BAT", overseas: false },
      { name: "Pooja Vastrakar", role: "AR", overseas: true, note: "Only 4 quality games in 24 months — fitness has kept her out; the model prices thin recent form." },
      { name: "Afy Fletcher", role: "BOWL", overseas: false },
      { name: "Cherry-Ann Fraser", role: "BOWL", overseas: false },
      { name: "Shawnisha Hector", role: "BOWL", overseas: false },
      { name: "Mandy Mangru", role: "BAT", overseas: false },
      { name: "Naijanni Cumberbatch", role: "BAT", overseas: false },
      { name: "Asabi Callender", role: "AR", overseas: false, note: "Uncapped local draft pick — no record in the DB, prices at baseline. Role unverified." },
      { name: "Amrita Ramtahal", role: "BAT", overseas: false, note: "Uncapped local draft pick — no record in the DB, prices at baseline. Role unverified." },
    ],
  },
  {
    name: "Guyana Amazon Warriors", short: "GUY", color: "#00A550",
    players: [
      { name: "Tazmin Brits", role: "BAT", overseas: true },
      { name: "Realeanna Grimmond", role: "BAT", overseas: false },
      { name: "Shemaine Campbelle", role: "WK", overseas: false, captain: true },
      { name: "Chloe Tryon", role: "AR", overseas: true },
      { name: "Nadine de Klerk", role: "AR", overseas: true },
      { name: "Chedean Nation", role: "BAT", overseas: false, note: "12.6 avg FP over 16 WCPL games — in the XI on seniority, not form." },
      { name: "Ashmini Munisar", role: "BOWL", overseas: false, note: "49.0 avg FP over 9 WCPL games; the best-value local bowler in the pool." },
      { name: "Sheneta Grimmond", role: "BOWL", overseas: false },
      { name: "Shamilia Connell", role: "BOWL", overseas: false },
      { name: "Shabnim Ismail", role: "BOWL", overseas: true, note: "92.4 avg FP over 9 WCPL games — the highest of any bowler in WCPL history." },
      { name: "Tilleya Madramootoo", role: "BAT", overseas: false, note: "Uncapped local draft pick — no record in the DB, prices at baseline. Role unverified." },
      { name: "Erin Burns", role: "BAT", overseas: true, note: "⚠️ 5th overseas: benched under the assumed 4-overseas XI cap DESPITE a 104.2 avg over 9 WCPL games. If the cap is 5, or Nation is dropped, she is the biggest single lineup swing in this auction — promote her on the board and re-value." },
      { name: "Reniece Boyce", role: "WK", overseas: false },
      { name: "Latoya Williams", role: "AR", overseas: false, note: "Uncapped local draft pick — no record in the DB, prices at baseline. Role unverified." },
      { name: "Eboni Brathwaite", role: "BAT", overseas: false },
    ],
  },
  {
    name: "Jamaica Empress", short: "JAM", color: "#FFB81C",
    players: [
      { name: "Amy Hunter", role: "WK", overseas: true },
      { name: "Meg Lanning", role: "BAT", overseas: true },
      { name: "Stafanie Taylor", role: "AR", overseas: false },
      { name: "Rashada Williams", role: "BAT", overseas: false, note: "Keeper by trade but Hunter has the gloves here; only 2 quality games in 24 months." },
      { name: "Chinelle Henry", role: "AR", overseas: false, captain: true },
      { name: "Zaida James", role: "AR", overseas: false },
      { name: "Aaliyah Alleyne", role: "AR", overseas: false },
      { name: "Rosemary Mair", role: "BOWL", overseas: true },
      { name: "Nonkululeko Mlaba", role: "BOWL", overseas: true },
      { name: "Kate Wilmott", role: "BOWL", overseas: false, note: "Uncapped local draft pick — no record in the DB, prices at baseline. Role unverified." },
      { name: "Shriya Jairam", role: "BOWL", overseas: false, note: "Uncapped local draft pick — no record in the DB, prices at baseline. Role unverified." },
      { name: "Syeda Aroob Shah", role: "BOWL", overseas: true, note: "⚠️ 5th overseas — benched under the assumed 4-overseas XI cap." },
      { name: "Djenaba Joseph", role: "BAT", overseas: false },
      { name: "Celina Whyte", role: "BAT", overseas: false, note: "Uncapped local draft pick — no record in the DB, prices at baseline. Role unverified." },
      { name: "Abigail Bryce", role: "BAT", overseas: false, note: "Uncapped local draft pick — no record in the DB, prices at baseline. Role unverified." },
    ],
  },
  {
    name: "Trinbago Knight Riders", short: "TKR", color: "#552583",
    players: [
      { name: "Deandra Dottin", role: "AR", overseas: false },
      { name: "Yastika Bhatia", role: "WK", overseas: true },
      { name: "Laura Harris", role: "BAT", overseas: true, note: "52.9 avg FP over 15 WCPL games on top of 120 WBBL games — the best-sampled overseas bat here." },
      { name: "Marizanne Kapp", role: "AR", overseas: true, note: "74.4 avg FP over 55 quality games in 24 months — the most reliable non-Matthews floor in the auction." },
      { name: "Jannillea Glasgow", role: "BAT", overseas: false },
      { name: "Steffi Soogrim", role: "BAT", overseas: false },
      { name: "Karishma Ramharack", role: "BOWL", overseas: false, captain: true },
      { name: "Shikha Pandey", role: "BOWL", overseas: true },
      { name: "Samara Ramnath", role: "BOWL", overseas: false },
      { name: "Jahzara Claxton", role: "BOWL", overseas: false },
      { name: "Brianna Harricharan", role: "BAT", overseas: false, note: "Uncapped local draft pick — no record in the DB, prices at baseline. Role unverified." },
      { name: "Madeline Penna", role: "BOWL", overseas: true, note: "⚠️ 5th overseas — benched under the assumed 4-overseas XI cap." },
      { name: "Earnisha Fontaine", role: "BAT", overseas: false, note: "Uncapped local draft pick — no record in the DB, prices at baseline. Role unverified." },
      { name: "Amelia Khan", role: "BOWL", overseas: false, note: "Uncapped local draft pick — no record in the DB, prices at baseline. Role unverified." },
      { name: "Sainavi Kambapalli", role: "BOWL", overseas: false, note: "Uncapped local draft pick — no record in the DB, prices at baseline. Role unverified." },
    ],
  },
];

// ⛔ HARD-WON ALIASES — every one of these fuzzy-matches to the WRONG woman if left alone, and the
// gender filter does not save you because the wrong candidate is also female. Verified against the
// DB on 4 Sep 2026 by format history, not by name similarity.
//   Suzie Bates      -> SW Bates (NZ, 5 WCPL games).  SL Bates is an Australian BOWLER; SD Bates a third.
//   Stafanie Taylor  -> SR Taylor (WI, 13 WCPL).      SJ Taylor is the England keeper; there is also
//                                                     a MALE USA "SR Taylor" — id, not name, decides.
//   Laura Harris     -> L Harris  (120 WBBL, 15 WCPL). LM Harris is a different, Blast-only bowler.
//   Madeline Penna   -> M Penna   (83 WBBL).           "Maria Penna" is a different, 2026-only player.
export const WCPL_NAME_ALIASES: Record<string, string> = {
  "suzie bates": "SW Bates",
  "stafanie taylor": "SR Taylor",
  "laura harris": "L Harris",
  "madeline penna": "M Penna",
  "maddy green": "ML Green",
  "afy fletcher": "ASS Fletcher",
  "realeanna grimmond": "RMAU Grimmond",
  "sheneta grimmond": "SS Grimmond",
  "shemaine campbelle": "SA Campbelle",
  "cherry-ann fraser": "CS Fraser",
  "rashada williams": "RS Williams",
  "deandra dottin": "DJS Dottin",
  "jahzara claxton": "JKC Claxton",
  "chinelle henry": "CA Henry",
  "aaliyah alleyne": "AA Alleyne",
  "chedean nation": "CN Nation",
  "nadine de klerk": "N de Klerk",
  "kiran navgire": "KP Navgire",
  "yastika bhatia": "YH Bhatia",
  "meg lanning": "MM Lanning",
  "rosemary mair": "RA Mair",
  "hayley matthews": "HK Matthews",
  "marizanne kapp": "M Kapp",
  "chloe tryon": "CL Tryon",
  "erin burns": "EA Burns",
  "shabnim ismail": "S Ismail",
  "tazmin brits": "T Brits",
  "nonkululeko mlaba": "N Mlaba",
  "amy hunter": "A Hunter",
  "shikha pandey": "S Pandey",
  "pooja vastrakar": "P Vastrakar",
  "karishma ramharack": "K Ramharack",
  "ashmini munisar": "A Munisar",
  "shamilia connell": "SS Connell",
  "shabika gajnabi": "S Gajnabi",
  "qiana joseph": "Q Joseph",
  "djenaba joseph": "D Joseph",
  "zaida james": "Z James",
  "jannillea glasgow": "J Glasgow",
  "steffi soogrim": "S Soogrim",
  "samara ramnath": "S Ramnath",
  "mandy mangru": "M Mangru",
  "naijanni cumberbatch": "N Cumberbatch",
  "shawnisha hector": "S Hector",
  "reniece boyce": "R Boyce",
};

// Team tiers, informational (expected matches are flat per squad_number — the knockout upside is
// small and evenly spread over 4 teams, so tiering it would be false precision on 3 league games).
export const WCPL_TEAM_TIERS: Record<string, "A" | "B" | "C"> = {
  BAR: "A", TKR: "A", GUY: "B", JAM: "B",
};
