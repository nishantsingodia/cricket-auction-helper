// Caribbean Premier League (CPL) 2026 — the first SEVEN-team edition (7 Aug – 20 Sep 2026).
// 35 league matches (each team plays 10) across 4 regional phases + 4 playoffs at Kensington Oval.
// New for 2026: Jamaica Kingsmen (expansion franchise), the Barbados side reverts to "Tridents"
// (was Royals to 2025), and Arnos Vale (St Vincent) makes its CPL debut hosting the first 3 games.
//
// Squad rules 2026: 17 players per franchise = 9 senior West Indians + 5 overseas + 3 "breakout"
// players (at least one breakout must play every match). A few squads carry extras/reserves.
//
// Players ordered as the PROBABLE XI (1–11) then depth (12+) -> squad_number, which drives expected
// matches. CPL caps the XI at 4 overseas, so a surplus overseas player sits at 12+ where his value
// falls (same convention as the IPL/LPL builds).
//
//   overseas: true = non-West-Indian.   role: BAT / BOWL / AR / WK.
//
// SOURCES: squads cross-checked against the Wikipedia "2026 Caribbean Premier League" article AND
// Wisden's post-draft squad list (15 May 2026 draft). The two agree on all 9+3 domestic picks per
// franchise; Wikipedia additionally carries the overseas signings (direct negotiations, so they
// landed after the draft). International roles/nationalities are firm. Roles for the uncapped
// Caribbean domestics/breakouts are best-effort — they price near baseline regardless. Reorder
// squad_number in the auction panel to correct any XI.
//
// CPL is a standard 20-over franchise T20 league → modelled like MLC/LPL: its own 'CPL' format
// bucket so its games count, quality = all marquee franchise T20 + top-8 T20Is, DEFAULT 40/30/10/20
// weights (unlike LPL, CPL has genuine 2025 and 2024 seasons, so the league-season buckets are real
// and need no recency slide-back). Per-bucket small-sample shrinkage stays ON (franchise league).

export type Role = "BAT" | "BOWL" | "AR" | "WK";

export interface CPLSquadPlayer {
  name: string;
  role: Role;
  overseas: boolean;
  note?: string;
}

export interface CPLTeam {
  name: string;
  short: string;
  color: string;
  players: CPLSquadPlayer[];
}

export const CPL_XI_SIZE = 11;
export const CPL_2026_NAME = "CPL 2026";

export const CPL_2026: CPLTeam[] = [
  {
    name: "Antigua & Barbuda Falcons", short: "ABF", color: "#E23A2E",
    players: [
      // XI — 4 overseas: Kusal Perera, Moeen, Shadab, Moqim
      { name: "Evin Lewis", role: "BAT", overseas: false }, // 1
      { name: "Kusal Perera", role: "WK", overseas: true }, // 2
      { name: "Amir Jangoo", role: "WK", overseas: false }, // 3
      { name: "Moeen Ali", role: "AR", overseas: true, note: "Captain." }, // 4
      { name: "Shadab Khan", role: "AR", overseas: true }, // 5
      { name: "Fabian Allen", role: "AR", overseas: false }, // 6
      { name: "Rahkeem Cornwall", role: "AR", overseas: false }, // 7
      { name: "Shamar Springer", role: "AR", overseas: false }, // 8
      { name: "Alzarri Joseph", role: "BOWL", overseas: false }, // 9
      { name: "Jayden Seales", role: "BOWL", overseas: false }, // 10
      { name: "Sufyan Moqim", role: "BOWL", overseas: true }, // 11
      // Depth
      { name: "Anderson Phillip", role: "BOWL", overseas: false }, // 12
      { name: "Jahmar Hamilton", role: "WK", overseas: false }, // 13
      { name: "Karima Gore", role: "AR", overseas: false, note: "Breakout pick." }, // 14
      { name: "Anderson Mahase", role: "BOWL", overseas: false, note: "Breakout pick — leg-spinner." }, // 15
      { name: "Joshua James", role: "BOWL", overseas: false, note: "Breakout pick." }, // 16
      { name: "Milind Kumar", role: "BAT", overseas: true }, // 17
      { name: "Tajinder Singh", role: "BAT", overseas: true }, // 18
    ],
  },
  {
    name: "Barbados Tridents", short: "BAR", color: "#1E3A8A",
    players: [
      // XI — 4 overseas: de Kock, Sams, Green, Mujeeb
      { name: "Quinton de Kock", role: "WK", overseas: true }, // 1
      { name: "Brandon King", role: "BAT", overseas: false }, // 2
      { name: "Sherfane Rutherford", role: "BAT", overseas: false }, // 3
      { name: "Kadeem Alleyne", role: "BAT", overseas: false }, // 4
      { name: "Daniel Sams", role: "AR", overseas: true }, // 5
      { name: "Chris Green", role: "AR", overseas: true }, // 6
      { name: "Gudakesh Motie", role: "BOWL", overseas: false, note: "Signed from Guyana after five seasons at his home franchise." }, // 7
      { name: "Mujeeb Ur Rahman", role: "BOWL", overseas: true }, // 8
      { name: "Zachary Carter", role: "BOWL", overseas: false }, // 9
      { name: "Ramon Simmonds", role: "BOWL", overseas: false, note: "Retained." }, // 10
      { name: "Johann Layne", role: "BOWL", overseas: false, note: "Breakout pick." }, // 11
      // Depth
      { name: "George Linde", role: "AR", overseas: true }, // 12
      { name: "Rivaldo Clarke", role: "WK", overseas: false }, // 13
      { name: "Shadrack Descarte", role: "AR", overseas: false }, // 14
      { name: "Zishan Motara", role: "BOWL", overseas: false }, // 15
      { name: "Jakeem Pollard", role: "AR", overseas: false, note: "Breakout pick — NOT Kieron Pollard (no shared stats record)." }, // 16
      { name: "Kofi James", role: "AR", overseas: false, note: "Breakout pick." }, // 17
    ],
  },
  {
    name: "Guyana Amazon Warriors", short: "GAW", color: "#F5A623",
    players: [
      // XI — 4 overseas: Gurbaz, Phillips, Nabi, Tahir
      { name: "Rahmanullah Gurbaz", role: "WK", overseas: true }, // 1
      { name: "Shai Hope", role: "WK", overseas: false }, // 2
      { name: "Glenn Phillips", role: "BAT", overseas: true }, // 3
      { name: "Shimron Hetmyer", role: "BAT", overseas: false }, // 4
      { name: "Mohammad Nabi", role: "AR", overseas: true }, // 5
      { name: "Romario Shepherd", role: "AR", overseas: false }, // 6
      { name: "Matthew Nandu", role: "AR", overseas: false }, // 7
      { name: "Imran Tahir", role: "BOWL", overseas: true }, // 8
      { name: "Shamar Joseph", role: "BOWL", overseas: false }, // 9
      { name: "Khary Pierre", role: "BOWL", overseas: false }, // 10
      { name: "Veerasammy Permaul", role: "BOWL", overseas: false }, // 11
      // Depth
      { name: "Dwaine Pretorius", role: "AR", overseas: true }, // 12
      { name: "Ronaldo Alimohamed", role: "AR", overseas: false }, // 13
      { name: "Jonathan van Lange", role: "BOWL", overseas: false }, // 14
      { name: "Isai Thorne", role: "BOWL", overseas: false, note: "Breakout pick." }, // 15
      { name: "Mavendra Dindiyal", role: "BAT", overseas: false, note: "Breakout pick." }, // 16
      { name: "Quentin Sampson", role: "AR", overseas: false, note: "Breakout pick." }, // 17
    ],
  },
  {
    name: "Jamaica Kingsmen", short: "JAM", color: "#0E7C3A",
    players: [
      // Expansion franchise. XI — 4 overseas: Saim Ayub, Usman Khan, Hassan Khan, + rotation.
      // NB: the announced squad carries SEVEN overseas names (a Pakistan-heavy contingent), more
      // than the 5-per-squad rule allows in an XI window — treat 15+ as reserves/cover.
      { name: "Saim Ayub", role: "BAT", overseas: true }, // 1
      { name: "Usman Khan", role: "WK", overseas: true }, // 2
      { name: "Keacy Carty", role: "BAT", overseas: false }, // 3
      { name: "Rovman Powell", role: "BAT", overseas: false, note: "Captain; first pick of the expansion draft." }, // 4
      { name: "Kirk McKenzie", role: "BAT", overseas: false, note: "Breakout pick." }, // 5
      { name: "Andre Russell", role: "AR", overseas: false }, // 6
      { name: "Keemo Paul", role: "AR", overseas: false }, // 7
      { name: "Odean Smith", role: "AR", overseas: false }, // 8
      { name: "Hassan Khan", role: "AR", overseas: true }, // 9
      { name: "Jediah Blades", role: "BOWL", overseas: false }, // 10
      { name: "Vitel Lawes", role: "BOWL", overseas: false, note: "U19 World Cup leg-spinner; third pick of the expansion draft." }, // 11
      // Depth
      { name: "Hunain Shah", role: "BOWL", overseas: true }, // 12
      { name: "Maaz Sadaqat", role: "AR", overseas: true }, // 13
      { name: "Shayan Jahangir", role: "WK", overseas: true }, // 14
      { name: "Tayyab Arif", role: "BOWL", overseas: true }, // 15
      { name: "Romaine Morris", role: "BOWL", overseas: false }, // 16
      { name: "Shaqkere Parris", role: "BAT", overseas: false }, // 17
      { name: "Kelvin Pitman", role: "BOWL", overseas: false, note: "Breakout pick." }, // 18
      { name: "Jeavor Royal", role: "AR", overseas: false, note: "Breakout pick." }, // 19
    ],
  },
  {
    name: "St Kitts & Nevis Patriots", short: "SKN", color: "#7C3AED",
    players: [
      // XI — 4 overseas: Shanaka, Hasaranga, Naseem, Salamkheil
      { name: "Johnson Charles", role: "WK", overseas: false }, // 1
      { name: "Mikyle Louis", role: "BAT", overseas: false, note: "Breakout pick." }, // 2
      { name: "Alick Athanaze", role: "BAT", overseas: false }, // 3
      { name: "Kyle Mayers", role: "AR", overseas: false }, // 4
      { name: "Dasun Shanaka", role: "AR", overseas: true }, // 5
      { name: "Jason Holder", role: "AR", overseas: false }, // 6
      { name: "Wanindu Hasaranga", role: "AR", overseas: true }, // 7
      { name: "Naseem Shah", role: "BOWL", overseas: true }, // 8
      { name: "Obed McCoy", role: "BOWL", overseas: false }, // 9
      { name: "Ashmead Nedd", role: "BOWL", overseas: false }, // 10
      { name: "Waqar Salamkheil", role: "BOWL", overseas: true }, // 11
      // Depth
      { name: "Nikhil Chaudhary", role: "AR", overseas: true }, // 12
      { name: "Andre Fletcher", role: "WK", overseas: false }, // 13
      { name: "Jeremiah Louis", role: "BOWL", overseas: false }, // 14
      { name: "Kevin Wickham", role: "BAT", overseas: false }, // 15
      { name: "Micah McKenzie", role: "BOWL", overseas: false, note: "Breakout pick — NOT Kirk McKenzie (JAM) or Neil McKenzie (SA)." }, // 16
      { name: "Navin Bidaisee", role: "AR", overseas: false, note: "Breakout pick." }, // 17
    ],
  },
  {
    name: "Saint Lucia Kings", short: "SLK", color: "#0891B2",
    players: [
      // XI — 4 overseas: Seifert, Asalanka, Noor Ahmad, Theekshana
      { name: "Tim Seifert", role: "WK", overseas: true }, // 1
      { name: "Ackeem Auguste", role: "BAT", overseas: false, note: "Breakout pick." }, // 2
      { name: "Charith Asalanka", role: "BAT", overseas: true }, // 3
      { name: "Jewel Andrew", role: "WK", overseas: false }, // 4
      { name: "Roston Chase", role: "AR", overseas: false, note: "Captain." }, // 5
      { name: "Kamil Pooran", role: "BAT", overseas: false, note: "NOT Nicholas Pooran (TKR) — no shared stats record." }, // 6
      { name: "Matthew Forde", role: "AR", overseas: false }, // 7
      { name: "Noor Ahmad", role: "BOWL", overseas: true }, // 8
      { name: "Maheesh Theekshana", role: "BOWL", overseas: true }, // 9
      { name: "Joshua Bishop", role: "BOWL", overseas: false }, // 10
      { name: "McKenny Clarke", role: "BOWL", overseas: false }, // 11
      // Depth
      { name: "Shadley van Schalkwyk", role: "AR", overseas: true }, // 12
      { name: "Keon Gaston", role: "BOWL", overseas: false }, // 13
      { name: "Darron Nedd", role: "BAT", overseas: false, note: "NOT Ashmead Nedd (SKN)." }, // 14
      { name: "Amari Goodridge", role: "BAT", overseas: false, note: "Breakout pick." }, // 15
      { name: "Johann Jeremiah", role: "BOWL", overseas: false, note: "Breakout pick." }, // 16
      { name: "Damion Joachim", role: "BOWL", overseas: false, note: "Breakout pick." }, // 17
    ],
  },
  {
    name: "Trinbago Knight Riders", short: "TKR", color: "#8B1A1A",
    players: [
      // Defending champions. XI — 4 overseas: Hales, Munro, Breetzke, Usman Tariq.
      // RMOs used to re-sign Narine, Pooran, Pollard, Hosein and Hinds.
      { name: "Alex Hales", role: "BAT", overseas: true }, // 1
      { name: "Nicholas Pooran", role: "WK", overseas: false }, // 2
      { name: "Colin Munro", role: "BAT", overseas: true }, // 3
      { name: "Matthew Breetzke", role: "BAT", overseas: true }, // 4
      { name: "Kieron Pollard", role: "AR", overseas: false }, // 5
      { name: "Justin Greaves", role: "AR", overseas: false }, // 6
      { name: "Sunil Narine", role: "AR", overseas: false }, // 7
      { name: "Akeal Hosein", role: "BOWL", overseas: false }, // 8
      { name: "Dominic Drakes", role: "AR", overseas: false }, // 9
      { name: "Usman Tariq", role: "BOWL", overseas: true }, // 10
      { name: "Terrance Hinds", role: "BOWL", overseas: false }, // 11
      // Depth
      { name: "Joshua Da Silva", role: "WK", overseas: false, note: "Breakout pick." }, // 12
      { name: "Jyd Goolie", role: "BAT", overseas: false }, // 13
      { name: "Amshi de Silva", role: "BOWL", overseas: true, note: "Sri Lankan leg-spinner — NOT Joshua Da Silva (TKR)." }, // 14
      { name: "Dexter Sween", role: "BAT", overseas: false }, // 15
      { name: "Nathan Edward", role: "BOWL", overseas: false, note: "Breakout pick." }, // 16
      { name: "Abdul-Raheem Toppin", role: "AR", overseas: false, note: "Breakout pick." }, // 17
    ],
  },
];

// Expected CPL matches — POSITIONAL (IPL-style), not fractional sharing.
// CPL has NO Impact Player rule, so exactly 11 feature per game (unlike LPL/IPL's featuring XII).
// Each team plays 10 league games; playoffs (top 4, Kensington Oval) are treated as UPSIDE and
// excluded, the same convention as every other tour here. Squads are deep (17–19), so depth tapers
// hard: 12–14 are the realistic rotation/injury cover, 15+ are reserves.
//  - Probable XI (1–11): 10 games.
//  - Rotation cover (12–14): 2 games.
//  - Reserves (15+): 1 game.
export function cplExpectedMatches(squadNumber: number): number {
  if (squadNumber <= 11) return 10;
  if (squadNumber <= 14) return 2;
  return 1;
}

// Full name (announced) -> cricsheet/DB spelling. Registry-first resolution + fuzzy handle most of
// the pool; these cover verified cricsheet spelling quirks AND — critically — let a STAR claim its
// record in the builder's exact pass-1 before fuzzy can hand it to a same-surname squadmate who has
// no record of his own (CPL 2026 is full of these: Kieron/Jakeem Pollard, Nicholas/Kamil Pooran,
// Ashmead/Darron Nedd, Kirk/Micah McKenzie, Joshua Da Silva/Amshi de Silva, Alzarri/Shamar Joseph).
// (Keys are normName-stripped: lowercase, punctuation/diacritics removed.)
export const CPL_NAME_ALIASES: Record<string, string> = {
  // Verified against the DB (name, cricinfo id, career matches):
  "kusal perera": "MDKJ Perera",       // 300631, 279m — the STAR keeper; must not fuzz to NLTC Perera (Thisara, 370m)
  "sufyan moqim": "Sufiyan Muqeem",    // 1329697, 44m — cricsheet spells it Sufiyan Muqeem
  "glenn phillips": "GD Phillips",     // 823509, 274m — NOT DN Phillips (Dale)
  "kieron pollard": "KA Pollard",      // 230559, 713m — claim before Jakeem Pollard can fuzz onto it
  "nicholas pooran": "N Pooran",       // 604302, 503m — claim before Kamil Pooran can fuzz onto it
  "alzarri joseph": "AS Joseph",       // 670031, 247m
  "shamar joseph": "S Joseph",         // 1356971, 46m
  "ashmead nedd": "AR Nedd",           // 1131647, 20m — claim before Darron Nedd can fuzz onto it
  "gudakesh motie": "G Motie",         // 670045, 137m
  "johnson charles": "J Charles",       // 333066, 301m
  "joshua da silva": "J Da Silva",     // 1168667, 26m — vs Amshi de Silva
  "kirk mckenzie": "KSA McKenzie",     // 1209196, 13m — vs Micah McKenzie / ND McKenzie (Neil, SA)
  "wanindu hasaranga": "Wanindu Hasaranga", // 784379, 277m — stored under the go-by name, not "PWH de Silva"
  "charith asalanka": "KIC Asalanka",  // 784367, 208m
  "dasun shanaka": "MD Shanaka",       // 437316, 296m
  "maheesh theekshana": "M Theekshana", // 1138316, 250m
  "shadley van schalkwyk": "SC van Schalkwyk", // 334621, 56m
  "moeen ali": "MM Ali",
  // ⚠️ SHARED-REGISTRY BUG WORKAROUND. The registry entry `ci:443150` is displayed as "Shai Hope"
  // but 443150 is KYLE Hope's cricinfo id, and it carries BOTH 'ka hope' and 'shai hope' as
  // aliases — the two brothers are MERGED onto Kyle's anchor. Resolving "Shai Hope" through the
  // registry therefore lands on "KA Hope" (11m) instead of the real star "SD Hope" (581379, 337m).
  // This alias overrides it locally (CPL_NAME_ALIASES is checked BEFORE the registry in
  // build-cpl-pool's resolveExact for exactly this reason). The PROPER fix is upstream in
  // wwc-points-bot: split ci:443150 into Kyle (443150) and Shai (581379) — the draft and the
  // points bot are mis-attributing him too.
  "shai hope": "SD Hope", // 581379, 337m
};

// Announced names with NO usable record in our DB, where the fuzzy pass would otherwise hand them
// a DIFFERENT player's career. Verified individually against the DB — each of these is a genuine
// newcomer/uncapped domestic, and the record fuzzy wanted to give him belongs to someone else who
// is NOT in CPL 2026 (so the claimed-set can't protect it). Listed here => resolution is skipped
// and the player is created statless, which prices him at baseline (the correct outcome).
// (Keys are normName-stripped.)
export const CPL_NO_DB_RECORD: Record<string, string> = {
  "zachary carter": "fuzzy grabbed JL Carter (Jonathan Carter, 87m CPL/ODI) — a different Barbadian",
  "vitel lawes": "fuzzy grabbed TE Lawes (Tom Lawes, Surrey, 32m BLAST/HUN). The registry knows they are two people (Vitel = ci:1500757, Tom = ci:1264775); we simply hold no ball-by-ball for Vitel",
  "jonathan van lange": "fuzzy grabbed M de Lange (Marchant de Lange, 128m) — unrelated South African",
};

// Display names: cricsheet initials-form (DB) -> friendly announced name (from the squad roster).
// Same problem LPL had: our ball-by-ball stores West Indians under initials ("JNT Seales" = Jayden
// Seales, "RRS Cornwall" = Rahkeem Cornwall, "MDKJ Perera" = Kusal Perera), which is unreadable on a
// bidding board. Applied in the DISPLAY READ (`/api/auction/[id]` GET) only — stats stay keyed by
// player_id, so this cannot affect valuation. GENERATED from the builder's own verified resolution
// (every entry is a name pair the pool actually produced), then reviewed one by one.
// To extend: add DB-name -> friendly entries here.
export const CPL_DISPLAY_NAMES: Record<string, string> = {
  "A Athanaze": "Alick Athanaze",
  "A Phillip": "Anderson Phillip",
  "AA Jangoo": "Amir Jangoo",
  "AD Hales": "Alex Hales",
  "AD Russell": "Andre Russell",
  "ADS Fletcher": "Andre Fletcher",
  "AJ Hosein": "Akeal Hosein",
  "AR Nedd": "Ashmead Nedd",
  "AS Joseph": "Alzarri Joseph",
  "AWJ Auguste": "Ackeem Auguste",
  "BA King": "Brandon King",
  "C Munro": "Colin Munro",
  "CJ Green": "Chris Green",
  "D Pretorius": "Dwaine Pretorius",
  "DC Drakes": "Dominic Drakes",
  "DR Sams": "Daniel Sams",
  "E Lewis": "Evin Lewis",
  "FA Allen": "Fabian Allen",
  "G Motie": "Gudakesh Motie",
  "GD Phillips": "Glenn Phillips",
  "GF Linde": "George Linde",
  "J Andrew": "Jewel Andrew",
  "J Bishop": "Joshua Bishop",
  "J Blades": "Jediah Blades",
  "J Charles": "Johnson Charles",
  "J Da Silva": "Joshua Da Silva",
  "J Layne": "Johann Layne",
  "J Royal": "Jeavor Royal",
  "JF Jeremiah": "Johann Jeremiah",
  "JM James": "Joshua James",
  "JN Hamilton": "Jahmar Hamilton",
  "JNT Seales": "Jayden Seales",
  "JO Holder": "Jason Holder",
  "JP Greaves": "Justin Greaves",
  "JS Louis": "Jeremiah Louis",
  "JU Goolie": "Jyd Goolie",
  "K Alleyne": "Kadeem Alleyne",
  "K Gaston": "Keon Gaston",
  "K Gore": "Karima Gore",
  "K Pierre": "Khary Pierre",
  "K Pitman": "Kelvin Pitman",
  "KA Pollard": "Kieron Pollard",
  "KHM James": "Kofi James",
  "KIC Asalanka": "Charith Asalanka",
  "KMA Paul": "Keemo Paul",
  "KO Wickham": "Kevin Wickham",
  "KR Mayers": "Kyle Mayers",
  "KSA McKenzie": "Kirk McKenzie",
  "KU Carty": "Keacy Carty",
  "M Clarke": "McKenny Clarke",
  "M Louis": "Mikyle Louis",
  "M Nandu": "Matthew Nandu",
  "M Theekshana": "Maheesh Theekshana",
  "MD Shanaka": "Dasun Shanaka",
  "MDKJ Perera": "Kusal Perera",
  "MM Ali": "Moeen Ali",
  "MP Breetzke": "Matthew Breetzke",
  "MW Forde": "Matthew Forde",
  "N Bidaisee": "Navin Bidaisee",
  "N Edward": "Nathan Edward",
  "N Pooran": "Nicholas Pooran",
  "OC McCoy": "Obed McCoy",
  "OF Smith": "Odean Smith",
  "Q Sampson": "Quentin Sampson",
  "Q de Kock": "Quinton de Kock",
  "R Powell": "Rovman Powell",
  "R Shepherd": "Romario Shepherd",
  "RA Clarke": "Rivaldo Clarke",
  "RL Chase": "Roston Chase",
  "RR Simmonds": "Ramon Simmonds",
  "RRS Cornwall": "Rahkeem Cornwall",
  "S Descarte": "Shadrack Descarte",
  "S Joseph": "Shamar Joseph",
  "SC van Schalkwyk": "Shadley van Schalkwyk",
  "SD Hope": "Shai Hope",
  "SD Parris": "Shaqkere Parris",
  "SE Rutherford": "Sherfane Rutherford",
  "SK Springer": "Shamar Springer",
  "SO Hetmyer": "Shimron Hetmyer",
  "SP Narine": "Sunil Narine",
  "Sufiyan Muqeem": "Sufyan Moqim",
  "T Hinds": "Terrance Hinds",
  "TL Seifert": "Tim Seifert",
  "V Permaul": "Veerasammy Permaul",
  "Z Motara": "Zishan Motara",
};

// CPL venue model — the 8 grounds of the 2026 edition, classified on the ingested CPL + men's-T20I
// bat-FP ÷ bowl-FP history at each ground (60-month window, name variants consolidated — cricsheet
// renamed most of these ~2021/2022 by appending the territory, which silently halves each ground's
// sample if you don't merge them). Measured ratios (60mo / all-time), <0.95 = bowl_friendly:
//   Arnos Vale     0.55 / 0.56  (n=6)   · Sir Vivian Richards 0.84 / 0.77 (n=23)
//   Warner Park    0.85 / 0.86  (n=59)  · Providence          0.87 / 0.86 (n=48)
//   Daren Sammy    0.95 / 0.97  (n=28)  · Kensington Oval     0.95 / 0.89 (n=31)
//   Sabina Park    0.99 / 0.89  (n=11)  · Queen's Park Oval   1.01 / 0.82 (n=8, all-time n=60)
// Net: the Caribbean is a BOWLER'S league — not one ground reads bat_road, four are bowl_friendly
// and the other four sit at the balanced floor. QPO is the one soft read: only 8 matches in the
// recent window (CPL last played there in 2024) against 0.82 over 60 all-time matches, so it is
// classified `balanced` per the engine's own recency rule but is arguably bowl_friendly.
export type VenueType = "bat_road" | "balanced" | "bowl_friendly";
export const CPL_VENUES: Array<{ canonical: string; variants: string[]; type: VenueType }> = [
  { canonical: "Arnos Vale Ground, Kingstown, St Vincent",
    variants: ["Arnos Vale Ground, Kingstown, St Vincent", "Arnos Vale Ground, Kingstown"],
    type: "bowl_friendly" },
  { canonical: "Sir Vivian Richards Stadium, North Sound, Antigua",
    variants: ["Sir Vivian Richards Stadium, North Sound, Antigua", "Sir Vivian Richards Stadium, North Sound"],
    type: "bowl_friendly" },
  { canonical: "Warner Park, Basseterre, St Kitts",
    variants: ["Warner Park, Basseterre, St Kitts", "Warner Park, Basseterre", "Warner Park, St Kitts"],
    type: "bowl_friendly" },
  { canonical: "Providence Stadium, Guyana",
    variants: ["Providence Stadium, Guyana", "Providence Stadium"],
    type: "bowl_friendly" },
  { canonical: "Daren Sammy National Cricket Stadium, Gros Islet, St Lucia",
    variants: ["Daren Sammy National Cricket Stadium, Gros Islet, St Lucia",
               "Daren Sammy National Cricket Stadium, Gros Islet"],
    type: "balanced" },
  { canonical: "Kensington Oval, Bridgetown, Barbados",
    variants: ["Kensington Oval, Bridgetown, Barbados", "Kensington Oval, Bridgetown", "Kensington Oval, Barbados"],
    type: "balanced" },
  { canonical: "Sabina Park, Kingston, Jamaica",
    variants: ["Sabina Park, Kingston, Jamaica", "Sabina Park, Kingston"],
    type: "balanced" },
  { canonical: "Queen's Park Oval, Port of Spain, Trinidad",
    variants: ["Queen's Park Oval, Port of Spain, Trinidad", "Queen's Park Oval, Port of Spain"],
    type: "balanced" },
];

// Per-team league schedule (10 games each) derived from the actual 35-match fixture list. CPL 2026
// runs in 4 regional phases and is HOME-HEAVY — every franchise plays 4–5 games at its own ground —
// so venue exposure genuinely differentiates teams (e.g. GAW get 5 at bowl-friendly Providence,
// TKR 5 at Queen's Park Oval, BAR 5 at Kensington). Playoffs (all 4 at Kensington) are excluded.
const AV = "Arnos Vale Ground, Kingstown, St Vincent";
const SVR = "Sir Vivian Richards Stadium, North Sound, Antigua";
const WP = "Warner Park, Basseterre, St Kitts";
const PRO = "Providence Stadium, Guyana";
const DSC = "Daren Sammy National Cricket Stadium, Gros Islet, St Lucia";
const KEN = "Kensington Oval, Bridgetown, Barbados";
const SAB = "Sabina Park, Kingston, Jamaica";
const QPO = "Queen's Park Oval, Port of Spain, Trinidad";

// Venue basis switch.
//  'per-team'   — each franchise is valued on ITS OWN 10-game venue mix (below). CPL 2026's legs are
//                 REGIONAL and the host plays 4–5 of its 10 at home, so bowl-friendly exposure ranges
//                 from 2/10 (BAR, home = balanced Kensington) to 8/10 (ABF, home = bowl-friendly SVR
//                 plus the two Arnos Vale openers). That 60-point spread is real signal.
//  'tournament' — every franchise gets the SAME pooled mix across all 70 team-games
//                 (DSC/QPO/PRO/KEN 10 each, SVR/WP/SAB 8, Arnos Vale 6 → 46% bowl-friendly).
//                 Use this if you'd rather not let the fixture list differentiate squads.
// NOTE this is NOT the LPL case: LPL's legs were neutral SL grounds that all 5 teams rotated through
// near-identically, so there per-team and tournament-level were the same number.
export const CPL_VENUE_BASIS: "per-team" | "tournament" = "per-team";

// Pooled tournament-level mix (all 35 matches x 2 sides = 70 team-games), normalized to a 10-game
// campaign so it stays comparable to the per-team schedules.
export const CPL_TOURNAMENT_SCHEDULE: Array<{ venue: string; games: number }> = [
  { venue: DSC, games: 10 / 7 }, { venue: QPO, games: 10 / 7 },
  { venue: PRO, games: 10 / 7 }, { venue: KEN, games: 10 / 7 },
  { venue: SVR, games: 8 / 7 }, { venue: WP, games: 8 / 7 },
  { venue: SAB, games: 8 / 7 }, { venue: AV, games: 6 / 7 },
];

export const CPL_TEAM_SCHEDULE: Record<string, Array<{ venue: string; games: number }>> = {
  ABF: [{ venue: AV, games: 2 }, { venue: SVR, games: 4 }, { venue: DSC, games: 1 },
        { venue: WP, games: 1 }, { venue: QPO, games: 1 }, { venue: PRO, games: 1 }],
  BAR: [{ venue: KEN, games: 5 }, { venue: SAB, games: 1 }, { venue: DSC, games: 1 },
        { venue: SVR, games: 1 }, { venue: QPO, games: 1 }, { venue: WP, games: 1 }],
  GAW: [{ venue: PRO, games: 5 }, { venue: SAB, games: 1 }, { venue: DSC, games: 1 },
        { venue: SVR, games: 1 }, { venue: QPO, games: 1 }, { venue: KEN, games: 1 }],
  JAM: [{ venue: SAB, games: 4 }, { venue: AV, games: 1 }, { venue: DSC, games: 1 },
        { venue: WP, games: 1 }, { venue: QPO, games: 1 }, { venue: PRO, games: 1 },
        { venue: KEN, games: 1 }],
  SKN: [{ venue: WP, games: 4 }, { venue: AV, games: 1 }, { venue: DSC, games: 1 },
        { venue: SAB, games: 1 }, { venue: SVR, games: 1 }, { venue: PRO, games: 1 },
        { venue: KEN, games: 1 }],
  SLK: [{ venue: DSC, games: 5 }, { venue: AV, games: 1 }, { venue: QPO, games: 1 },
        { venue: WP, games: 1 }, { venue: KEN, games: 1 }, { venue: PRO, games: 1 }],
  TKR: [{ venue: QPO, games: 5 }, { venue: AV, games: 1 }, { venue: SAB, games: 1 },
        { venue: SVR, games: 1 }, { venue: KEN, games: 1 }, { venue: PRO, games: 1 }],
};
