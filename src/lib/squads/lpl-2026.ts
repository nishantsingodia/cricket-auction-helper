// Lanka Premier League (LPL) 2026 — "LPL 6" squads (Sri Lanka, 17 Jul – 8 Aug 2026).
// 5 teams, double round-robin (each plays 8 league games) + playoffs (Qualifier 1,
// Eliminator, Qualifier 2, Final at R. Premadasa).
//
// Players ordered as the PROBABLE XI (1–11) then depth (12+) -> squad_number. LPL caps the
// playing XI at 4 overseas, so surplus overseas sit at 12+, where their expected-matches (and
// value) fall, like IPL foreigners who don't make the cut.
//
//   overseas: true = non-Sri-Lankan.   role: BAT / BOWL / AR / WK.
//
// SOURCES: probable XIs + the June/July replacement signings below are cross-checked against
// T20Tracker's LPL sheet AND each franchise's Wikipedia "…in 2026" page (7 replacements verified
// there). International roles/nationalities are firm; a few uncapped-SL-domestic roles are
// best-effort (they price near baseline anyway). Reorder squad_number in the auction panel to
// correct an XI. Verified replacements applied:
//   Jaffna:  Airee OUT → Zahoor Khan (UAE); Lamichhane PARTIAL (misses openers, Chawla covers)
//   Colombo: Mohammad Haris OUT → Rubin Hermann (SA)
//   Galle:   van der Dussen OUT → Chris Lynn (single-source); Haider Ali[UAE spinner] OUT → Virandeep Singh
//   Kandy:   Rahmanullah Gurbaz OUT → Sediqullah Atal (AFG)
//   Dambulla: Dian Forrester OUT → Marques Ackerman (SA)
//
// LPL is a standard 20-over T20 league → valued like MLC (its own 'LPL' format bucket so its
// games count; no per-role scale-normalization or small-sample shrinkage — those are for The
// Hundred's 100-ball scale only).

export type Role = "BAT" | "BOWL" | "AR" | "WK";

export interface LPLSquadPlayer {
  name: string;
  role: Role;
  overseas: boolean;
  note?: string;
}

export interface LPLTeam {
  name: string;
  short: string;
  color: string;
  players: LPLSquadPlayer[];
}

export const LPL_XI_SIZE = 11;
export const LPL_2026_NAME = "LPL 2026";

export const LPL_2026: LPLTeam[] = [
  {
    name: "Jaffna Kings", short: "JK", color: "#F26522",
    players: [
      // XI (defending champions) — 4 overseas: Zadran, Shakib, Taskin, Wiese
      { name: "Avishka Fernando", role: "BAT", overseas: false }, // 1
      { name: "Kamil Mishara", role: "WK", overseas: false }, // 2
      { name: "Ibrahim Zadran", role: "BAT", overseas: true }, // 3
      { name: "Bhanuka Rajapaksa", role: "BAT", overseas: false }, // 4 (c)
      { name: "Shakib Al Hasan", role: "AR", overseas: true }, // 5
      { name: "Dunith Wellalage", role: "AR", overseas: false }, // 6
      { name: "Chamindu Wickramasinghe", role: "AR", overseas: false }, // 7
      { name: "Traveen Mathews", role: "AR", overseas: false }, // 8
      { name: "Taskin Ahmed", role: "BOWL", overseas: true }, // 9
      { name: "David Wiese", role: "AR", overseas: true }, // 10
      { name: "Kugathas Mathulan", role: "BOWL", overseas: false }, // 11
      // Bench
      { name: "Dilshan Madushanka", role: "BOWL", overseas: false }, // 12
      { name: "Nishan Madushka", role: "BAT", overseas: false }, // 13
      { name: "Sandeep Lamichhane", role: "BOWL", overseas: true, note: "Misses the opening matches (Nepal national duty); available thereafter. Piyush Chawla is the early-window cover." }, // 14
      { name: "Piyush Chawla", role: "BOWL", overseas: true, note: "Retired-Indian leg-spinner; short-term cover for Lamichhane's opening-match absence." }, // 15
      { name: "Zahoor Khan", role: "BOWL", overseas: true, note: "UAE pace bowler — signed as replacement for Dipendra Airee (out, national duty)." }, // 16
      { name: "Lizaad Williams", role: "BOWL", overseas: true }, // 17
      { name: "Nuwanidu Fernando", role: "BAT", overseas: false }, // 18
      { name: "Mohommed Shiraz", role: "BOWL", overseas: false }, // 19
      { name: "Praveen Manisha", role: "BAT", overseas: false }, // 20
    ],
  },
  {
    name: "Colombo Kaps", short: "CK", color: "#1D4E9C",
    players: [
      // XI — 4 overseas: McDermott, Neesham, Hasan Mahmud, Mujeeb
      { name: "Sharujan Shanmuganathan", role: "BAT", overseas: false }, // 1
      { name: "Kusal Mendis", role: "WK", overseas: false }, // 2 (c, wk)
      { name: "Sadeera Samarawickrama", role: "BAT", overseas: false }, // 3
      { name: "Kamindu Mendis", role: "AR", overseas: false }, // 4
      { name: "Ben McDermott", role: "BAT", overseas: true }, // 5
      { name: "Janith Liyanage", role: "BAT", overseas: false }, // 6
      { name: "Jimmy Neesham", role: "AR", overseas: true }, // 7
      { name: "Milan Ratnayake", role: "AR", overseas: false }, // 8
      { name: "Hasan Mahmud", role: "BOWL", overseas: true }, // 9
      { name: "Jeffrey Vandersay", role: "BOWL", overseas: false }, // 10
      { name: "Mujeeb Ur Rahman", role: "BOWL", overseas: true }, // 11
      // Bench
      { name: "Binura Fernando", role: "BOWL", overseas: false }, // 12
      { name: "Rubin Hermann", role: "WK", overseas: true, note: "South African keeper-batter — signed as replacement for Mohammad Haris (out, Global Super League duty)." }, // 13
      { name: "Kushal Bhurtel", role: "BAT", overseas: true }, // 14
      { name: "Shahnawaz Dahani", role: "BOWL", overseas: true }, // 15
      { name: "Thanuka Dabare", role: "AR", overseas: false }, // 16
      { name: "Movin Subasingha", role: "AR", overseas: false }, // 17
      { name: "Wanuja Sahan", role: "BOWL", overseas: false }, // 18
      { name: "Anthony Pragasam", role: "BOWL", overseas: false }, // 19
      { name: "Malsha Tharupathi", role: "BAT", overseas: false }, // 20
    ],
  },
  {
    name: "Kandy Royals", short: "KR", color: "#5B2A86",
    players: [
      // XI — 4 overseas: Atal, Vijay Shankar, Moeen, Sams
      { name: "Sediqullah Atal", role: "BAT", overseas: true, note: "Afghan opening batter — signed as replacement for Rahmanullah Gurbaz (withdrew, Shpageeza league)." }, // 1
      { name: "Vishen Halambage", role: "BAT", overseas: false }, // 2
      { name: "Kusal Perera", role: "WK", overseas: false }, // 3
      { name: "Wanindu Hasaranga", role: "AR", overseas: false }, // 4 (marquee)
      { name: "Angelo Mathews", role: "AR", overseas: false }, // 5 (c)
      { name: "Vijay Shankar", role: "AR", overseas: true }, // 6 (retired-Indian, eligible)
      { name: "Moeen Ali", role: "AR", overseas: true }, // 7
      { name: "Pawan Sandesh", role: "AR", overseas: false }, // 8
      { name: "Daniel Sams", role: "AR", overseas: true }, // 9
      { name: "Asitha Fernando", role: "BOWL", overseas: false }, // 10
      { name: "Garuka Sanketh", role: "AR", overseas: false }, // 11
      // Bench
      { name: "Nuwan Thushara", role: "BOWL", overseas: false }, // 12
      { name: "Zahir Khan", role: "BOWL", overseas: true }, // 13 (AFG leg-spin — NOT UAE's Zahoor Khan)
      { name: "Brandon McMullen", role: "AR", overseas: true }, // 14
      { name: "Lahiru Udara", role: "BAT", overseas: false }, // 15
      { name: "Dushan Hemantha", role: "AR", overseas: false }, // 16
      { name: "Muditha Lakshan", role: "BOWL", overseas: false }, // 17
      { name: "Dale Phillips", role: "BAT", overseas: false }, // 18
      { name: "Sahan Mihira", role: "WK", overseas: false }, // 19
      { name: "Isitha Wijesundera", role: "BOWL", overseas: false }, // 20
    ],
  },
  {
    name: "Galle Gallants", short: "GG", color: "#1B7A43",
    players: [
      // XI — 3 overseas in the projected XI: Lynn, Litton, Nawaz
      { name: "Lasith Croospulle", role: "BAT", overseas: false }, // 1
      { name: "Chris Lynn", role: "BAT", overseas: true, note: "Named (single-source) as replacement for Rassie van der Dussen (out). Unconfirmed by news — verify." }, // 2
      { name: "Litton Das", role: "WK", overseas: true }, // 3
      { name: "Charith Asalanka", role: "BAT", overseas: false }, // 4
      { name: "Mohammad Nawaz", role: "AR", overseas: true }, // 5
      { name: "Dasun Shanaka", role: "AR", overseas: false }, // 6 (c)
      { name: "Chamika Karunaratne", role: "AR", overseas: false }, // 7
      { name: "Dinura Kalupahana", role: "BOWL", overseas: false }, // 8
      { name: "Pramod Madushan", role: "BOWL", overseas: false }, // 9
      { name: "Eshan Malinga", role: "BOWL", overseas: false }, // 10
      { name: "Vijayakanth Viyaskanth", role: "BOWL", overseas: false }, // 11
      // Bench
      { name: "Mehidy Hasan Miraz", role: "AR", overseas: true }, // 12
      { name: "Sam Harper", role: "WK", overseas: true }, // 13
      { name: "Virandeep Singh", role: "AR", overseas: true, note: "Malaysian all-rounder — signed as replacement for UAE spinner Haider Ali (out)." }, // 14
      { name: "Akif Javed", role: "BOWL", overseas: true }, // 15
      { name: "Kasun Rajitha", role: "BOWL", overseas: false }, // 16
      { name: "Sahan Arachchige", role: "AR", overseas: false }, // 17
      { name: "Tharindu Rathnayake", role: "BOWL", overseas: false }, // 18
      { name: "Sachindu Colombage", role: "AR", overseas: false }, // 19
      { name: "Uri Koththigoda", role: "BOWL", overseas: false }, // 20
    ],
  },
  {
    name: "Dambulla Sixers", short: "DS", color: "#00A9A5",
    players: [
      // XI — 3 overseas in the projected XI: Farhan, Hendricks, Ackerman (a 4th OS rotates from bench)
      { name: "Sahibzada Farhan", role: "BAT", overseas: true }, // 1
      { name: "Niroshan Dickwella", role: "WK", overseas: false }, // 2
      { name: "Reeza Hendricks", role: "BAT", overseas: true }, // 3
      { name: "Dinesh Chandimal", role: "BAT", overseas: false }, // 4
      { name: "Pavan Rathnayake", role: "BAT", overseas: false }, // 5
      { name: "Marques Ackerman", role: "BAT", overseas: true, note: "South African top-order bat — signed as replacement for Dian Forrester (out)." }, // 6
      { name: "Ramesh Mendis", role: "AR", overseas: false }, // 7
      { name: "Gayana Weerasinghe", role: "BOWL", overseas: false }, // 8
      { name: "Maheesh Theekshana", role: "BOWL", overseas: false }, // 9
      { name: "Akila Dananjaya", role: "AR", overseas: false }, // 10
      { name: "Dushmantha Chameera", role: "BOWL", overseas: false }, // 11
      // Bench (surplus overseas first)
      { name: "Gulbadin Naib", role: "AR", overseas: true }, // 12
      { name: "Mohammad Wasim", role: "BOWL", overseas: true }, // 13
      { name: "Shadley van Schalkwyk", role: "AR", overseas: true }, // 14
      { name: "Fazalhaq Farooqi", role: "BOWL", overseas: true, note: "In the media squad list but NOT in T20Tracker's projected LPL-6 squad — availability unconfirmed, verify." }, // 15
      { name: "Dhananjaya Lakshan", role: "AR", overseas: false }, // 16
      { name: "Sachitha Jayatilake", role: "WK", overseas: false }, // 17
      { name: "Vishva Kumara", role: "BOWL", overseas: false }, // 18
    ],
  },
];

// Expected LPL matches — POSITIONAL (IPL-style), not fractional sharing.
// Each team plays 8 league games (double round-robin, 5 teams). Playoffs (up to +4 for the
// team that reaches the Final) are UPSIDE and not baked in — mirrors The Hundred model.
//  - XI (1–11): 8 games.
//  - Bench: pos 12 = 3 (first rotation/injury cover), 13–14 = 2, 15+ = 1.
export function lplExpectedMatches(squadNumber: number): number {
  if (squadNumber <= LPL_XI_SIZE) return 8;
  if (squadNumber === 12) return 3;
  if (squadNumber <= 14) return 2;
  return 1;
}

// Full name (announced) -> cricsheet/DB spelling. Registry-first resolution + fuzzy match
// handle most; these cover known cricsheet spelling quirks / same-surname disambiguation.
// (Keys are normName-stripped: lowercase, punctuation/diacritics removed.)
export const LPL_NAME_ALIASES: Record<string, string> = {
  "litton das": "Liton Das", // cricsheet spells it "Liton Das"
  "bhanuka rajapaksa": "PBB Rajapaksa", // vs "S Rajapaksa" (different LPL player)
  // Same-surname disambiguation (SL naming — resolved EXACTLY in build's pass-1 so the star
  // claims its record before fuzzy lets a fringe namesake grab it):
  "kusal mendis": "BKG Mendis", // vs Kamindu Mendis (08548b13) / BAW / BMAJ Mendis
  "kamindu mendis": "Kamindu Mendis",
  "angelo mathews": "AD Mathews", // Traveen Mathews (no data) must not steal this
  "pavan rathnayake": "P Rathnayake", // Tharindu Rathnayake (no data) must not steal this
  "rassie van der dussen": "HE van der Dussen",
  "moeen ali": "MM Ali",
  "mohammad nawaz": "Mohammad Nawaz (3)", // PAK left-arm spinner (cricsheet disambiguator)
  "mohammad wasim": "Mohammad Wasim (2)", // PAK pacer (Wasim Jr.)
  "vijay shankar": "V Shankar",
  "chris lynn": "CA Lynn",
  "piyush chawla": "PP Chawla",
  "marques ackerman": "MP Ackerman",
  "sediqullah atal": "Sediqullah",
};
