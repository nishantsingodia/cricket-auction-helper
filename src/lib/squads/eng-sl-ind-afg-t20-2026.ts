// ENG v SL + IND v AFG T20I 2026 — ONE auction pool spanning TWO concurrent bilateral T20I series
// (13–19 Sep 2026). Four teams, 62 players, one shared purse.
//
// Archetype: TWIN BILATERAL. New in two ways, and both come from the pool spanning more than one
// series rather than from anything about T20 cricket:
//
//   1. OPPOSITION FACTOR. In every previous tour each player faced comparable opposition, so who
//      you play cancels out of the relative pricing. Here it does not: England's points are earned
//      against Sri Lanka and Sri Lanka's against England, and those are not the same task. The
//      factor below scales expected output by the opponent each side actually faces (see
//      TWIN_OPPOSITION_DIFFICULTY for the measurement).
//   2. THE WIDEST QUALITY GATE OF ANY TOUR HERE, forced by a permanent data gap. Cricsheet
//      withholds every match involving the Afghanistan men's team as policy ("A further 158
//      matches have been withheld due to either featuring the Afghanistan men's team or being
//      played in the Afghanistan Premier League" — t20s_json.zip/README.txt). So this squad has NO
//      T20I record in our data and never will. What Afghan players DO have is franchise-league
//      history (ILT20, IPL, SA20, LPL, CPL, PSL, BBL, MLC), which the standard bilateral gate
//      ('MLC','IPL' + top-8 T20Is) throws away. The engine therefore runs this tour on the ETPL
//      quality set. Without it the entire Afghan half of the pool sits at baseline 20.
//
// Players are ordered as the CURATED probable XI (1–11, batting order) then bench (12+) ->
// squad_number. XI = 3 expected matches (a 3-match series has no dead rubber to rotate in),
// bench = 1. That 3x/1x split does most of the pricing work, so the XI seed is worth a manual pass
// before bidding.
//
// NOT in this pool: Australia v Zimbabwe, which runs in the same window (15/18/20 Sep, Harare) but
// is a 3-match ODI series, not T20I. Mixing it in would have meant mixing FP scales — measured at
// ODI 65.1 vs T20 49.5 mean FP per player (men's, 2024+), i.e. 1.32x — so it was left out.

import type { BilateralTeam, Role } from "./ind-vs-eng-t20-2026";

export const ENG_SL_IND_AFG_T20_2026_NAME = "ENG v SL + IND v AFG T20I 2026";
export const TWIN_XI_SIZE = 11;

export type { BilateralTeam, Role };

// ── Fixtures ───────────────────────────────────────────────────────────────────
// Two series, three matches each, overlapping in the middle. Every player plays exactly one
// series, so expected matches is 3 for an XI slot regardless of which side they are on.
export const TWIN_T20_FIXTURES = [
  { series: "IND v AFG", match: 1, date: "2026-09-13", venue: "Arun Jaitley Stadium, Delhi" },
  { series: "ENG v SL", match: 1, date: "2026-09-15", venue: "The Rose Bowl, Southampton" },
  { series: "IND v AFG", match: 2, date: "2026-09-15", venue: "Arun Jaitley Stadium, Delhi" },
  { series: "ENG v SL", match: 2, date: "2026-09-17", venue: "Sophia Gardens, Cardiff" },
  { series: "IND v AFG", match: 3, date: "2026-09-17", venue: "Arun Jaitley Stadium, Delhi" },
  { series: "ENG v SL", match: 3, date: "2026-09-19", venue: "Old Trafford, Manchester" },
] as const;

// teamShort -> the other side it plays. Drives the opposition factor.
export const TWIN_T20_OPPONENT: Record<string, string> = {
  ENG: "SL",
  SL: "ENG",
  IND: "AFG",
  AFG: "IND",
};

// ── Opposition factor ──────────────────────────────────────────────────────────
// MEASURED 11 Sep 2026, WITHIN-PLAYER so it cannot be confounded by who happens to play whom.
// (A naive "mean FP conceded by team X" is worthless here: matches against weak teams are mostly
// played BY weak teams, so the two effects cancel and every side reads ~50.) For each men's T20I
// player since 2021 with >= 3 matches against a given opponent and >= 15 overall, take their mean
// FP against that opponent divided by their own overall mean FP, then average those ratios:
//
//     Sri Lanka   1.0028   (157 players, 826 obs)   <- the easiest of the three to score against
//     England     0.9297   (136 players, 878 obs)
//     India       0.9255   (167 players, 1220 obs)
//     Afghanistan     n/a   NO DATA — see the cricsheet withholding note at the top
//
// Stable: relaxing the cut to >= 2 vs opponent / >= 10 overall gives SL 0.973 / IND 0.909 /
// ENG 0.890 — the same ~8% spread and the same ordering.
//
// AFGHANISTAN IS THE ONE CURATED NUMBER, and it is set to the pool mean (i.e. no adjustment)
// because it is genuinely UNMEASURABLE from our data, not because neutral is a convenient default.
// Worth being explicit about which way the uncertainty runs: Afghanistan is NOT a minnow to bat
// against. Their attack is Rashid Khan, Noor Ahmad, Mujeeb Ur Rahman, Nangeyalia Kharote and
// Fazalhaq Farooqi — plausibly a HARDER assignment than England's. Their batting is the weaker
// half. So if this number is wrong, it is most likely too GENEROUS to India's batters and too harsh
// on India's bowlers. Override it here if you disagree; it moves India's prices by whatever you
// change it by.
export const TWIN_OPPOSITION_DIFFICULTY: Record<string, number> = {
  SL: 1.0028,
  ENG: 0.9297,
  IND: 0.9255,
  AFG: 0.9645, // = the mean of the three MEASURED values, i.e. "an average-difficulty opponent"
};

// Centred on 1.0 so the EFPPM shown on the board stays on the familiar form scale — only the
// RATIOS between teams carry pricing signal, and budget normalization would absorb a uniform
// shift anyway.
const DIFFICULTY_MEAN =
  Object.values(TWIN_OPPOSITION_DIFFICULTY).reduce((a, b) => a + b, 0) /
  Object.keys(TWIN_OPPOSITION_DIFFICULTY).length;

/**
 * Multiplier on a player's expected per-match output for the opponent their side actually faces.
 * The four factors it yields, against a pool mean of 0.9556:
 *
 *     ENG  1.0494   (+4.9%)  — Sri Lanka is the softest assignment in the pool
 *     IND  1.0093   (+0.9%)  — Afghanistan treated as average; see the note above
 *     SL   0.9729   (-2.7%)
 *     AFG  0.9685   (-3.2%)
 *
 * An ~8% spread end to end, and note it is ENGLAND, not India, that gets most of the benefit —
 * the intuition that the India-Afghanistan pairing is the lopsided one is not what the data says,
 * because England and India measure as equally hard to score against while Sri Lanka is the one
 * genuinely softer opponent. Far milder than it would have been with Zimbabwe in the pool (a ZIM
 * player facing Australia measured -24%).
 */
export function twinOppositionFactor(teamShort: string): number {
  const opponent = TWIN_T20_OPPONENT[teamShort];
  const raw = opponent ? TWIN_OPPOSITION_DIFFICULTY[opponent] : undefined;
  if (!raw) return 1.0; // unknown team short → no adjustment, never a silent partial one
  return raw / DIFFICULTY_MEAN;
}

/**
 * Expected matches. A 3-match series is played by the XI; the bench gets in through injury or a
 * settled series, not rotation — there is no dead rubber to experiment in the way a 5-match one has
 * (that archetype uses 5/2). Same 3/1 shape as the two ODI bilaterals.
 */
export function twinT20ExpectedMatches(squadNumber: number): number {
  return squadNumber >= 1 && squadNumber <= TWIN_XI_SIZE ? 3 : 1;
}

// ── Squads ─────────────────────────────────────────────────────────────────────
// All four announced as of 11 Sep 2026. Order = curated probable XI then bench.
export const ENG_SL_IND_AFG_T20_2026: BilateralTeam[] = [
  {
    name: "England",
    short: "ENG",
    country: "England",
    color: "#012169",
    players: [
      { name: "Ben Duckett", role: "BAT" },            // 1
      { name: "Jos Buttler", role: "WK" },             // 2
      { name: "Harry Brook", role: "BAT" },            // 3  (captain — armband only, no pricing effect)
      { name: "Tom Banton", role: "BAT" },             // 4
      { name: "Will Jacks", role: "AR" },              // 5
      { name: "Jordan Cox", role: "WK" },              // 6
      { name: "Liam Dawson", role: "AR" },             // 7
      { name: "Jamie Overton", role: "AR", note: "Back from the injury that ruled him out of the India series; named in both the ODI and T20I squads." }, // 8
      { name: "Jofra Archer", role: "BOWL" },          // 9
      { name: "Adil Rashid", role: "BOWL" },           // 10
      { name: "Saqib Mahmood", role: "BOWL" },         // 11
      { name: "Gus Atkinson", role: "BOWL" },          // 12
      { name: "Aneurin Donald", role: "BAT", note: "Maiden call-up — county/Blast form only, prices near baseline." }, // 13
      { name: "Sonny Baker", role: "BOWL" },           // 14
      { name: "James Coles", role: "AR" },             // 15
      { name: "Josh Tongue", role: "BOWL" },           // 16
    ],
  },
  {
    name: "Sri Lanka",
    short: "SL",
    country: "Sri Lanka",
    color: "#E8A33D",
    players: [
      { name: "Pathum Nissanka", role: "BAT" },        // 1
      { name: "Lahiru Udara", role: "WK" },            // 2
      { name: "Kamindu Mendis", role: "AR" },          // 3
      { name: "Charith Asalanka", role: "AR" },        // 4  (captain — armband only)
      { name: "Janith Liyanage", role: "BAT" },        // 5
      { name: "Dasun Shanaka", role: "AR" },           // 6
      { name: "Wanindu Hasaranga", role: "AR" },       // 7
      { name: "Maheesh Theekshana", role: "BOWL" },    // 8
      { name: "Nuwan Thushara", role: "BOWL" },        // 9
      { name: "Dushmantha Chameera", role: "BOWL" },   // 10
      { name: "Eshan Malinga", role: "BOWL" },         // 11
      { name: "Kamil Mishara", role: "WK" },           // 12
      { name: "Pavan Rathnayake", role: "BAT", note: "Called up as cover for the injured Kusal Mendis (4 Sep)." }, // 13
      { name: "Dunith Wellalage", role: "AR" },        // 14
      { name: "Tharindu Rathnayake", role: "BOWL" },   // 15
      { name: "Dilshan Madushanka", role: "BOWL", note: "Replaced the injured Binura Fernando (4 Sep)." }, // 16
    ],
  },
  {
    name: "India",
    short: "IND",
    country: "India",
    color: "#1A75CF",
    players: [
      { name: "Abhishek Sharma", role: "AR" },         // 1
      { name: "Vaibhav Sooryavanshi", role: "BAT" },   // 2
      { name: "Shreyas Iyer", role: "BAT" },           // 3  (captain — armband only)
      { name: "Tilak Varma", role: "BAT" },            // 4  (vice-captain — armband only)
      { name: "Sanju Samson", role: "WK" },            // 5
      { name: "Shivam Dube", role: "AR" },             // 6
      { name: "Axar Patel", role: "AR" },              // 7
      { name: "Washington Sundar", role: "AR" },       // 8
      { name: "Jasprit Bumrah", role: "BOWL" },        // 9
      { name: "Arshdeep Singh", role: "BOWL" },        // 10
      { name: "Varun Chakravarthy", role: "BOWL" },    // 11
      { name: "Nitish Kumar Reddy", role: "AR" },      // 12
      { name: "Ravi Bishnoi", role: "BOWL" },          // 13
      { name: "Ishan Kishan", role: "WK" },            // 14
      { name: "Yash Thakur", role: "BOWL", note: "Replaced Harshit Rana on 10 Sep 2026 (strain). Little senior T20I data — prices near baseline." }, // 15
    ],
  },
  {
    name: "Afghanistan",
    short: "AFG",
    country: "Afghanistan",
    color: "#C1272D",
    players: [
      { name: "Rahmanullah Gurbaz", role: "WK" },      // 1
      { name: "Sediqullah Atal", role: "BAT" },        // 2
      { name: "Ibrahim Zadran", role: "BAT" },         // 3  (captain — armband only)
      { name: "Darwish Rasooli", role: "BAT", note: "No franchise-league record in our data, and cricsheet withholds Afghanistan T20Is — prices at baseline." }, // 4
      { name: "Azmatullah Omarzai", role: "AR" },      // 5
      { name: "Mohammad Nabi", role: "AR" },           // 6
      { name: "Gulbadin Naib", role: "AR" },           // 7
      { name: "Rashid Khan", role: "BOWL" },           // 8
      { name: "Nangeyalia Kharote", role: "BOWL", note: "No franchise-league record in our data, and cricsheet withholds Afghanistan T20Is — prices at baseline." }, // 9
      { name: "Noor Ahmad", role: "BOWL" },            // 10
      { name: "Fazalhaq Farooqi", role: "BOWL" },      // 11
      { name: "Mujeeb Ur Rahman", role: "BOWL" },      // 12
      { name: "Naveen-ul-Haq", role: "BOWL" },         // 13
      { name: "Noor Ul Rahman", role: "WK" },          // 14
      { name: "Abdullah Ahmadzai", role: "BOWL", note: "Uncapped-level data only — prices near baseline." }, // 15
    ],
  },
];

// Announced name (EXACT string as written above) -> cricsheet_id. This tour does NOT use a
// name-spelling alias map, and does NOT fall back to fuzzy matching. Both were tried and both are
// unsafe on this pool — the reason is worth recording, because the same trap is waiting in any
// future subcontinental squad:
//
//   - The DB holds THREE rows named "Rashid Khan" and TWO named "Varun Chakaravarthy". An
//     exact-name match returns whichever the query happens to order first.
//   - Surname fuzzy matching reaches straight for the wrong star: Abhishek Sharma -> RG Sharma
//     (782 matches), Arshdeep Singh -> Yuvraj Singh (446), Eshan Malinga -> SL Malinga (Lasith,
//     453), Ibrahim Zadran -> Najibullah Zadran, Noor Ahmad -> Qais Ahmad.
//   - "R Bishnoi" is NOT Ravi Bishnoi — it is a different man with 3 IPL games. Ravi is filed
//     under his full name. A plausible-looking initials alias pointed at the wrong player.
//
// Every id below was verified 11 Sep 2026 against role + country + career span. Six squad members
// are DELIBERATELY absent (no id exists): they have no record in our data and are created statless
// at baseline — Lahiru Udara, Tharindu Rathnayake, Darwish Rasooli, Nangeyalia Kharote,
// Noor Ul Rahman, Abdullah Ahmadzai. Four of those six are Afghan, which is the cricsheet
// withholding policy showing up as a pricing floor rather than as an error.
//
// FOLLOW-UP (deliberate debt): the durable home for these mappings is the shared registry
// (wwc-points-bot manual_ci_bridges.json -> crosswalk -> npm run sync-registry), so the bot and
// draft get them too. This map is auction-local because the first match is on 13 Sep. If these
// tours are wired into the bot, promote these ids there rather than re-deriving them.
export const ENG_SL_IND_AFG_CSID: Record<string, string> = {
  // — England —
  "Ben Duckett": "5f26f677",
  "Jos Buttler": "99b75528",
  "Harry Brook": "4ae1755b",
  "Tom Banton": "25f7b7d6",
  "Will Jacks": "9caf69a1",
  "Jordan Cox": "ff154ecd",          // JM Cox — NOT OB Cox (Oliver, 170 matches)
  "Liam Dawson": "4a461c24",
  "Jamie Overton": "59559bc2",       // J Overton — NOT C Overton (his twin Craig, 178)
  "Jofra Archer": "5574750c",
  "Adil Rashid": "249d60c9",         // AU Rashid
  "Saqib Mahmood": "0f6db197",       // S Mahmood — NOT SI Mahmood (Sajid)
  "Gus Atkinson": "70d57519",        // AAP Atkinson
  "Aneurin Donald": "72918338",      // AHT Donald
  "Sonny Baker": "78c12883",         // S Baker
  "James Coles": "9c643d7b",         // JM Coles — NOT MT Coles (Matt)
  "Josh Tongue": "1f1b4c89",         // JC Tongue
  // — Sri Lanka —
  "Pathum Nissanka": "8ee36b18",     // P Nissanka — NOT RAP Nissanka
  "Kamindu Mendis": "08548b13",      // NOT BKG Mendis (Kusal, 394) or BAW Mendis
  "Charith Asalanka": "732c038e",    // KIC Asalanka
  "Janith Liyanage": "84212ffb",     // J Liyanage — NOT I Liyanage
  "Dasun Shanaka": "3ff033bb",       // MD Shanaka
  "Wanindu Hasaranga": "a97c8ec2",
  "Maheesh Theekshana": "f24c6701",  // M Theekshana
  "Nuwan Thushara": "ee1b6c27",      // N Thushara — NOT T Thushara
  "Dushmantha Chameera": "327b58d3",
  "Eshan Malinga": "5750bcb4",       // E Malinga — NOT SL Malinga (Lasith, 453)
  "Kamil Mishara": "65cebd5d",       // K Mishara
  "Pavan Rathnayake": "c1fdfb46",    // P Rathnayake (BAT) — NOT RMMP Rathnayake (Milan, the AR)
  "Dunith Wellalage": "736123bb",    // DN Wellalage
  "Dilshan Madushanka": "de7d833e",  // D Madushanka (2020-2026) — NOT LD Madushanka (2017-2023)
  // — India —
  "Abhishek Sharma": "f29185a1",     // NOT RG Sharma
  "Vaibhav Sooryavanshi": "470f446b", // filed as "V Suryavanshi"
  "Shreyas Iyer": "85ec8e33",        // SS Iyer — NOT VR Iyer (Venkatesh)
  "Tilak Varma": "b0482a1d",         // NOT the statless "N. Tilak Varma" duplicate row
  "Sanju Samson": "a4cc73aa",        // SV Samson
  "Shivam Dube": "a4e37e47",         // S Dube
  "Axar Patel": "2e171977",          // AR Patel — NOT SR Patel (Samit, England)
  "Washington Sundar": "f19ccfad",
  "Jasprit Bumrah": "462411b3",      // JJ Bumrah
  "Arshdeep Singh": "244048f6",      // NOT Yuvraj/Harbhajan Singh
  "Varun Chakravarthy": "5b7ab5a9",  // filed as "Varun Chakaravarthy"; a statless dup row exists
  "Nitish Kumar Reddy": "aad0c365",  // filed as "Nithish Kumar Reddy" (h in Nithish)
  "Ravi Bishnoi": "df064e1a",        // NOT "R Bishnoi" — a different man with 3 IPL games
  "Ishan Kishan": "752f7486",
  "Yash Thakur": "4b31f3a3",         // NOT SN Thakur (Shardul, 196)
  // — Afghanistan (franchise-league rows only; no T20I data exists for any of them) —
  "Rahmanullah Gurbaz": "0bacade8",
  "Sediqullah Atal": "3c28853f",
  "Ibrahim Zadran": "d4550956",      // NOT Najibullah / Sahel Zadran
  "Azmatullah Omarzai": "8f6dd463",
  "Mohammad Nabi": "62af8546",
  "Gulbadin Naib": "9f77963a",
  "Rashid Khan": "5f547c8b",         // the Afghan leg-spinner; two other "Rashid Khan" rows exist
  "Noor Ahmad": "efc04be7",          // NOT Qais Ahmad
  "Fazalhaq Farooqi": "e9c7f0d0",
  "Mujeeb Ur Rahman": "7d92277a",    // NOT Mustafizur Rahman
  "Naveen-ul-Haq": "c0c411cb",       // NOT Misbah-ul-Haq / Imam-ul-Haq
};

// Formats the matching pool must be drawn from. Wider than the other bilaterals ('IPL','T20') and
// that is LOAD-BEARING, not tidiness: an Afghan player's entire record is franchise-league, so
// restricting the pool to IPL+T20I would leave him out of the candidate set altogether and he would
// be created as a brand-new statless player DESPITE having 100+ games in the DB.
export const TWIN_MATCH_FORMATS = [
  "T20", "IPL", "ILT20", "SA20", "PSL", "BBL", "CPL", "LPL", "MLC", "BLAST", "HUN",
];
