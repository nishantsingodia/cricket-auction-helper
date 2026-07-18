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
// correct an XI. Verified replacements applied (all franchise-confirmed via T20Tracker + Wikipedia):
//   Jaffna:  Airee OUT → Zahoor Khan (UAE); Lamichhane OUT → Piyush Chawla (T20Tracker: replaced)
//   Colombo: Mohammad Haris OUT → Rubin Hermann (SA)
//   Galle:   van der Dussen OUT → Chris Lynn (AUS, confirmed); Haider Ali[UAE spinner] OUT → Virandeep Singh;
//            Liton Das OUT (calf injury) → Nurul Hasan (BAN)
//   Kandy:   Rahmanullah Gurbaz OUT → Sediqullah Atal (AFG); Daniel Sams OUT → Shaheen Shah Afridi (PAK, NOC granted)
//   Dambulla: Dian Forrester OUT → Marques Ackerman (SA)
// Per-game availability (misses first-N league games / playoffs) is captured per player in `note` and,
// where it affects VALUE, in LPL_LEAGUE_GAMES_MISSED below (playoff-only misses do NOT affect value).
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
      { name: "Ibrahim Zadran", role: "BAT", overseas: true, note: "Plays the full group stage; CONFIRMED to miss the playoffs (Afghanistan duty) — no league-phase value impact." }, // 3
      { name: "Bhanuka Rajapaksa", role: "BAT", overseas: false }, // 4 (c)
      { name: "Shakib Al Hasan", role: "AR", overseas: true }, // 5
      { name: "Dunith Wellalage", role: "AR", overseas: false }, // 6
      { name: "Chamindu Wickramasinghe", role: "AR", overseas: false }, // 7
      { name: "Traveen Mathews", role: "AR", overseas: false }, // 8
      { name: "Taskin Ahmed", role: "BOWL", overseas: true, note: "Misses JK's first 2 league games (Bangladesh duty) — available from game 3." }, // 9
      { name: "David Wiese", role: "AR", overseas: true }, // 10
      { name: "Kugathas Mathulan", role: "BOWL", overseas: false }, // 11
      // Bench
      { name: "Dilshan Madushanka", role: "BOWL", overseas: false }, // 12
      { name: "Nishan Madushka", role: "BAT", overseas: false }, // 13
      { name: "Sandeep Lamichhane", role: "BOWL", overseas: true, note: "OUT — T20Tracker lists him replaced by Piyush Chawla for LPL-6 (not in current XI plans). Treated as unavailable for the group stage." }, // 14
      { name: "Piyush Chawla", role: "BOWL", overseas: true, note: "Retired-Indian leg-spinner; short-term cover for Lamichhane's opening-match absence." }, // 15
      { name: "Zahoor Khan", role: "BOWL", overseas: true, note: "UAE pace bowler — signed as replacement for Dipendra Airee (out, national duty)." }, // 16
      { name: "Lizaad Williams", role: "BOWL", overseas: true }, // 17
      { name: "Nuwanidu Fernando", role: "BAT", overseas: false }, // 18
      { name: "Mohommed Shiraz", role: "BOWL", overseas: false }, // 19
      { name: "Praveen Manisha", role: "BAT", overseas: false }, // 20
      { name: "Sineth Jayawardena", role: "AR", overseas: false, note: "Local squad addition (per T20Tracker's LPL-6 sheet)." }, // 21
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
      { name: "Hasan Mahmud", role: "BOWL", overseas: true, note: "Playoff availability UNCLEAR — could miss the playoffs if selected for Bangladesh's Australia tour. Full group-stage availability." }, // 9
      { name: "Jeffrey Vandersay", role: "BOWL", overseas: false }, // 10
      { name: "Mujeeb Ur Rahman", role: "BOWL", overseas: true }, // 11
      // Bench
      { name: "Binura Fernando", role: "BOWL", overseas: false, note: "Misses the first 2–3 league games (England T20 Blast Finals Day)." }, // 12
      { name: "Rubin Hermann", role: "WK", overseas: true, note: "South African keeper-batter — signed as replacement for Mohammad Haris (out, Global Super League duty)." }, // 13
      { name: "Kushal Bhurtel", role: "BAT", overseas: true, note: "Misses the ENTIRE group stage (Nepal duty) — only available for the playoffs, so ~zero league value." }, // 14
      { name: "Shahnawaz Dahani", role: "BOWL", overseas: true }, // 15
      { name: "Thanuka Dabare", role: "AR", overseas: false }, // 16
      { name: "Movin Subasingha", role: "AR", overseas: false }, // 17
      { name: "Wanuja Sahan", role: "BOWL", overseas: false }, // 18
      { name: "Anthony Pragasam", role: "BOWL", overseas: false }, // 19
      { name: "Malsha Tharupathi", role: "BAT", overseas: false }, // 20
      { name: "Ravindu Fernando", role: "BAT", overseas: false, note: "Local replacement addition (per T20Tracker's LPL-6 sheet)." }, // 21
    ],
  },
  {
    name: "Kandy Royals", short: "KR", color: "#5B2A86",
    players: [
      // XI — 4 overseas: Atal, Vijay Shankar, Moeen, Shaheen
      { name: "Sediqullah Atal", role: "BAT", overseas: true, note: "Afghan opening batter — signed as replacement for Rahmanullah Gurbaz (withdrew, Shpageeza league). Plays the full group stage but CONFIRMED to miss the playoffs (Afghanistan duty) — no league-phase value impact." }, // 1
      { name: "Vishen Halambage", role: "BAT", overseas: false }, // 2
      { name: "Kusal Perera", role: "WK", overseas: false }, // 3
      { name: "Wanindu Hasaranga", role: "AR", overseas: false }, // 4 (marquee)
      { name: "Angelo Mathews", role: "AR", overseas: false }, // 5 (c)
      { name: "Vijay Shankar", role: "AR", overseas: true }, // 6 (retired-Indian, eligible)
      { name: "Moeen Ali", role: "AR", overseas: true }, // 7
      { name: "Pawan Sandesh", role: "AR", overseas: false }, // 8
      { name: "Shaheen Shah Afridi", role: "BOWL", overseas: true, note: "Fully available. PCB granted an NOC (announced 12 Jul); signed as replacement for Daniel Sams (out). Marquee left-arm quick — a key overseas pick." }, // 9
      { name: "Asitha Fernando", role: "BOWL", overseas: false }, // 10
      { name: "Garuka Sanketh", role: "AR", overseas: false }, // 11
      // Bench
      { name: "Nuwan Thushara", role: "BOWL", overseas: false }, // 12
      { name: "Zahir Khan", role: "BOWL", overseas: true }, // 13 (AFG leg-spin — NOT UAE's Zahoor Khan)
      { name: "Brandon McMullen", role: "AR", overseas: true, note: "Expected to miss the playoffs (Scotland duty) — no league-phase value impact." }, // 14
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
      { name: "Chris Lynn", role: "BAT", overseas: true, note: "Confirmed replacement for Rassie van der Dussen (out, personal). Misses GG's first 2 league games (England T20 Blast Finals Day) — available from game 3." }, // 2
      { name: "Nurul Hasan", role: "WK", overseas: true, note: "Replaced the injured Liton Das (left-calf, withdrew 15 Jul). Misses GG's first 2 league games (Bangladesh duty) — Sam Harper keeps in the interim." }, // 3
      { name: "Charith Asalanka", role: "BAT", overseas: false }, // 4
      { name: "Mohammad Nawaz", role: "AR", overseas: true }, // 5
      { name: "Dasun Shanaka", role: "AR", overseas: false }, // 6 (c)
      { name: "Chamika Karunaratne", role: "AR", overseas: false }, // 7
      { name: "Dinura Kalupahana", role: "BOWL", overseas: false }, // 8
      { name: "Pramod Madushan", role: "BOWL", overseas: false }, // 9
      { name: "Eshan Malinga", role: "BOWL", overseas: false }, // 10
      { name: "Vijayakanth Viyaskanth", role: "BOWL", overseas: false }, // 11
      // Bench
      { name: "Mehidy Hasan Miraz", role: "AR", overseas: true, note: "Expected to miss the playoffs (Bangladesh duty) — no league-phase value impact." }, // 12
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
      { name: "Shadley van Schalkwyk", role: "AR", overseas: true, note: "Misses DS's first 2 league games (MLC final commitments)." }, // 14
      { name: "Fazalhaq Farooqi", role: "BOWL", overseas: true, note: "Confirmed in the squad. Playoff availability UNCLEAR — could miss the playoffs if selected for Afghanistan's Ireland tour. Full group-stage availability." }, // 15
      { name: "Dhananjaya Lakshan", role: "AR", overseas: false }, // 16
      { name: "Sachitha Jayatilake", role: "WK", overseas: false }, // 17
      { name: "Vishva Kumara", role: "BOWL", overseas: false }, // 18
    ],
  },
];

// Expected LPL matches — POSITIONAL (IPL-style), not fractional sharing.
// LPL uses the Impact Player rule → 12 players FEATURE EVERY GAME (not 11), same as IPL.
// The featuring XII are credited the full 2026 campaign of 15 games (league + expected playoff run);
// bench tapers as rotation/injury cover.
//  - Featuring XII (1–12): 15 games.
//  - Bench: 13–14 = 2, 15+ = 1.
export function lplExpectedMatches(squadNumber: number): number {
  if (squadNumber <= 12) return 15;
  if (squadNumber <= 14) return 2;
  return 1;
}

// Per-player AVAILABILITY discount, in league games missed of the 8-game group stage. Keyed by the
// player's DB (cricsheet) spelling, normalized to lowercase-alphanumeric — the valuation engine only
// has the DB name, not the announced name. Source: T20Tracker availability table (16 Jul 2026).
// IMPORTANT: only GROUP-STAGE absences belong here. Playoff-only misses (Sediqullah Atal, Ibrahim
// Zadran, Mehidy Hasan Miraz, Brandon McMullen, and the unclear Hasan Mahmud / Fazalhaq Farooqi) are
// intentionally ABSENT — lplExpectedMatches already excludes playoff games (they're upside), so a
// playoff-only absence has zero effect on league-phase value.
const LPL_LEAGUE_GAMES_MISSED: Record<string, number> = {
  calynn: 2, // Chris Lynn (GG) — England T20 Blast Finals Day
  nurulhasan: 2, // Nurul Hasan (GG) — Bangladesh duty
  taskinahmed: 2, // Taskin Ahmed (JK) — Bangladesh duty
  binurafernando: 2, // Binura Fernando (CK) — T20 Blast Finals Day (2–3 games)
  scvanschalkwyk: 2, // Shadley van Schalkwyk (DS) — MLC final
  kbhurtel: 8, // Kushal Bhurtel (CK) — misses the ENTIRE group stage (Nepal duty)
  slamichhane: 8, // Sandeep Lamichhane (JK) — T20Tracker lists him replaced by Chawla (treat as out)
};

// Expected LEAGUE matches for a player, net of confirmed group-stage absences (see map above).
export function lplExpectedMatchesFor(dbName: string, squadNumber: number): number {
  const key = (dbName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const missed = LPL_LEAGUE_GAMES_MISSED[key] ?? 0;
  return Math.max(0, lplExpectedMatches(squadNumber) - missed);
}

// Full name (announced) -> cricsheet/DB spelling. Registry-first resolution + fuzzy match
// handle most; these cover known cricsheet spelling quirks / same-surname disambiguation.
// (Keys are normName-stripped: lowercase, punctuation/diacritics removed.)
export const LPL_NAME_ALIASES: Record<string, string> = {
  // Roster changes (Jul): Liton Das (calf injury) → Nurul Hasan; Daniel Sams (out) → Shaheen Shah Afridi.
  "nurul hasan": "Nurul Hasan",
  "shaheen shah afridi": "Shaheen Shah Afridi",
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
  "marques ackerman": "MJ Ackerman", // SA20 (Marques Johannes) — "MP Ackerman" does not exist in DB
  "sediqullah atal": "Sediqullah",
  "sam harper": "SB Harper", // Aus WK — DB spelling is "SB Harper" (102 BBL/PSL games); "Sam Harper"
                             // otherwise creates statless duplicates. Takes effect on next pool build.
  // SL players whose cricsheet record hides under an initials-form surname (web-verified full names,
  // 18 Jul). Without these they were created as statless phantoms.
  "asitha fernando": "AM Fernando",        // Asitha Madusanka Fernando
  "nuwanidu fernando": "MNK Fernando",     // Muthuthanthirige Nuwanidu Keshawa Fernando
  "nishan madushka": "KNM Fernando",       // Kottasinghakkarage Nishan Madushka (surname = Fernando)
  "pramod madushan": "PM Liyanagamage",    // Pramod Madushan Liyanagamage
  "lahiru udara": "LU Igalagamage",        // Lahiru Udara Igalagamage
  "binura fernando": "B Fernando",         // Binura Fernando (SL LM pacer)
  "sachitha jayatilake": "S Jayathilake",  // Sachitha Jayathilake (spelling variant)
  "kusal perera": "MDKJ Perera",           // the STAR keeper (273m) — NOT "KKV Perera" (a 1-match namesake)
  "avishka fernando": "WIA Fernando",      // Weerahandige Inol Avishka — frees AM Fernando for Asitha
                                           // (NB: Vishwa Fernando shares W.I.A. initials — verify if he ever enters an LPL squad)
};

// Display names: cricsheet initials-form (DB) -> friendly announced name (from the squad roster).
// SL cricsheet spellings are unreadable ("BKG Mendis" = Kusal Mendis), so the auction UI renders
// this instead of players.name for LPL. Generated by resolving every announced squad name to its DB
// record; keyed by the DB name so it survives lineup edits. Underlying stats still come from the
// linked player_id — this is display-only.
export const LPL_DISPLAY_NAMES: Record<string, string> = {
  "A Dananjaya": "Akila Dananjaya",
  "AD Mathews": "Angelo Mathews",
  "AM Fernando": "Asitha Fernando",
  "BR McDermott": "Ben McDermott",
  "PBB Rajapaksa": "Bhanuka Rajapaksa",
  "B Fernando": "Binura Fernando",
  "BJ McMullen": "Brandon McMullen",
  "C Karunaratne": "Chamika Karunaratne",
  "C Wickramasinghe": "Chamindu Wickramasinghe",
  "KIC Asalanka": "Charith Asalanka",
  "CA Lynn": "Chris Lynn",
  "MD Shanaka": "Dasun Shanaka",
  "D Wiese": "David Wiese",
  "D Lakshan": "Dhananjaya Lakshan",
  "D Madushanka": "Dilshan Madushanka",
  "LD Chandimal": "Dinesh Chandimal",
  "DN Wellalage": "Dunith Wellalage",
  "MADI Hemantha": "Dushan Hemantha",
  "E Malinga": "Eshan Malinga",
  "G Sanketh": "Garuka Sanketh",
  "I Wijesundera": "Isitha Wijesundera",
  "J Liyanage": "Janith Liyanage",
  "JDF Vandersay": "Jeffrey Vandersay",
  "JDS Neesham": "Jimmy Neesham",
  "K Mishara": "Kamil Mishara",
  "CAK Rajitha": "Kasun Rajitha",
  "BKG Mendis": "Kusal Mendis",
  "MDKJ Perera": "Kusal Perera",
  "WIA Fernando": "Avishka Fernando",
  "K Bhurtel": "Kushal Bhurtel",
  "LU Igalagamage": "Lahiru Udara",
  "L Croospulle": "Lasith Croospulle",
  "LB Williams": "Lizaad Williams",
  "M Theekshana": "Maheesh Theekshana",
  "M Tharupathi": "Malsha Tharupathi",
  "MJ Ackerman": "Marques Ackerman",
  "Mehedi Hasan Miraz": "Mehidy Hasan Miraz",
  "KTH Ratnayake": "Milan Ratnayake",
  "MM Ali": "Moeen Ali",
  "M Shiraz": "Mohommed Shiraz",
  "M Subasingha": "Movin Subasingha",
  "M Lakshan": "Muditha Lakshan",
  "N Dickwella": "Niroshan Dickwella",
  "KNM Fernando": "Nishan Madushka",
  "N Thushara": "Nuwan Thushara",
  "MNK Fernando": "Nuwanidu Fernando",
  "P Rathnayake": "Pavan Rathnayake",
  "PP Chawla": "Piyush Chawla",
  "PM Liyanagamage": "Pramod Madushan",
  "RTM Mendis": "Ramesh Mendis",
  "RS Fernando": "Ravindu Fernando",
  "RR Hendricks": "Reeza Hendricks",
  "RA Herman": "Rubin Hermann",
  "S Colombage": "Sachindu Colombage",
  "S Jayathilake": "Sachitha Jayatilake",
  "S Samarawickrama": "Sadeera Samarawickrama",
  "SSD Arachchige": "Sahan Arachchige",
  "SB Harper": "Sam Harper",
  "S Lamichhane": "Sandeep Lamichhane",
  "SC van Schalkwyk": "Shadley van Schalkwyk",
  "DK Dahani": "Shahnawaz Dahani",
  "PTM Dabare": "Thanuka Dabare",
  "V Shankar": "Vijay Shankar",
  "V Viyaskanth": "Vijayakanth Viyaskanth",
  "VS Halambage": "Vishen Halambage",
  "CBRLS Kumara": "Vishva Kumara",
  "W Sahan": "Wanuja Sahan",
};

// LPL venue model — ALL 2026 grounds are Sri-Lankan and read BOWL-FRIENDLY on the ingested
// LPL + SL-T20I bat-FP÷bowl-FP history (subcontinent pitches, spin-heavy). Ratios (bat/bowl):
//   SSC Colombo 0.65 · R Premadasa 0.77 · Rangiri Dambulla 0.90 · Pallekele 0.91  (<0.95 = bowl_friendly).
// Set every cricsheet name variant so a player's history under either spelling buckets correctly.
// (Premadasa is the playoffs venue — classified but NOT in the 8-league-game base schedule.)
export type VenueType = "bat_road" | "balanced" | "bowl_friendly";
export const LPL_VENUES: Array<{ canonical: string; variants: string[]; type: VenueType }> = [
  { canonical: "Sinhalese Sports Club Ground, Colombo",
    variants: ["Sinhalese Sports Club Ground, Colombo", "Sinhalese Sports Club Ground"], type: "bowl_friendly" },
  { canonical: "Rangiri Dambulla International Stadium",
    variants: ["Rangiri Dambulla International Stadium", "Dambulla International Cricket Stadium"], type: "bowl_friendly" },
  { canonical: "Pallekele International Cricket Stadium",
    variants: ["Pallekele International Cricket Stadium", "Pallekele International Cricket Stadium, Kandy",
               "Muttiah Muralitharan International Cricket Stadium, Kandy"], type: "bowl_friendly" },
  { canonical: "R Premadasa Stadium, Colombo",
    variants: ["R Premadasa Stadium, Colombo", "R Premadasa Stadium", "R.Premadasa Stadium, Khettarama",
               "R.Premadasa Stadium, Khettarama, Colombo"], type: "bowl_friendly" },
];

// Per-team league schedule (8 games) across this year's 3 league venues — derived from the actual
// fixture list (SSC blocks Jul17-19, Dambulla Jul21-26, Pallekele Jul28-Aug2). Neutral-venue
// festival, so distributions are similar across teams. Playoffs (Premadasa) are upside, excluded.
const SSC = "Sinhalese Sports Club Ground, Colombo";
const DAM = "Rangiri Dambulla International Stadium";
const PAL = "Pallekele International Cricket Stadium";
export const LPL_TEAM_SCHEDULE: Record<string, Array<{ venue: string; games: number }>> = {
  JK: [{ venue: SSC, games: 2 }, { venue: DAM, games: 3 }, { venue: PAL, games: 3 }],
  CK: [{ venue: SSC, games: 2 }, { venue: DAM, games: 3 }, { venue: PAL, games: 3 }],
  KR: [{ venue: SSC, games: 2 }, { venue: DAM, games: 4 }, { venue: PAL, games: 2 }],
  DS: [{ venue: SSC, games: 2 }, { venue: DAM, games: 4 }, { venue: PAL, games: 2 }],
  GG: [{ venue: SSC, games: 2 }, { venue: DAM, games: 4 }, { venue: PAL, games: 2 }],
};
