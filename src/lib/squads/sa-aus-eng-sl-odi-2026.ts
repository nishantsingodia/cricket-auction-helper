// SA v AUS + ENG v SL ODI 2026 — ONE auction pool spanning TWO concurrent bilateral ODI series
// (22-30 Sep 2026). Four teams, 64 players, one shared purse.
//
// Archetype: TWIN BILATERAL (ODI). It is the TWIN structure of ENG v SL + IND v AFG T20I 2026
// crossed with the MEN'S ODI form model of NZ v WI 2026 — nothing here is new in kind:
//   - from the TWIN archetype: one pool over two series, so an OPPOSITION FACTOR is needed
//     (who you play no longer cancels out when the purse is shared), applied through normMult.
//   - from the MEN'S ODI archetype: form is scored on `format='ODI'` ONLY, quality-gated to
//     top-8 opposition, 36-month windows, 60/40 recency weights.
//
// ⚠️ THE OPPOSITION FACTOR IS MUCH WEAKER HERE THAN IN THE T20 TWIN, AND IT IS NOT STABLE.
// All four sides are top-8 nations, unlike ENG/SL/IND/AFG. See TWIN_ODI_OPPOSITION_DIFFICULTY for
// the measurement and the specification-sensitivity check — the honest summary is that this factor
// moves prices by about 2%, and its ordering survives three of four specifications.
//
// Expected matches: XI (1-11) = 3, bench (12+) = 1. Both series are 3 matches, and every player
// plays exactly one series, so the flat 3/1 shape of the T20 twin applies unchanged. That 3x/1x
// split does most of the pricing work, so THE XI SEED IS THE THING WORTH A MANUAL PASS on the
// board before bidding — more than any modelling dial in here.
//
// Venue: display-only (finalEfppm = normScore1 for every tour since 5 Aug 2026). The tour still
// gets a real getTourVenueContext because a null context makes /api/auction/[id] fall back to a
// ~151k-row IPL+T20 scan on every board load. See SA_AUS_ENG_SL_ODI_VENUES.

import type { BilateralTeam, Role } from "./ind-vs-eng-t20-2026";

export const SA_AUS_ENG_SL_ODI_2026_NAME = "SA v AUS + ENG v SL ODI 2026";
export const TWIN_ODI_XI_SIZE = 11;

export type { BilateralTeam, Role };

// ── Fixtures ───────────────────────────────────────────────────────────────────
// Two series, three matches each, overlapping. Every player plays exactly one series, so expected
// matches is 3 for an XI slot regardless of side.
export const TWIN_ODI_FIXTURES = [
  { series: "ENG v SL", match: 1, date: "2026-09-22", venue: "Riverside Ground, Chester-le-Street" },
  { series: "SA v AUS", match: 1, date: "2026-09-24", venue: "Kingsmead, Durban" },
  { series: "ENG v SL", match: 2, date: "2026-09-24", venue: "Headingley, Leeds" },
  { series: "ENG v SL", match: 3, date: "2026-09-27", venue: "Kennington Oval, London" },
  { series: "SA v AUS", match: 2, date: "2026-09-27", venue: "The Wanderers Stadium, Johannesburg" },
  { series: "SA v AUS", match: 3, date: "2026-09-30", venue: "Senwes Park, Potchefstroom" },
] as const;

// teamShort -> the other side it plays. Drives the opposition factor.
export const TWIN_ODI_OPPONENT: Record<string, string> = {
  ENG: "SL",
  SL: "ENG",
  AUS: "SA",
  SA: "AUS",
};

// ── Opposition factor ──────────────────────────────────────────────────────────
// MEASURED 22 Sep 2026 on men's ODIs since 2021, WITHIN-PLAYER — for each player with >= 3 matches
// against a given opponent and >= 15 ODIs overall, take their mean FP against that opponent divided
// by their own overall mean FP, then average those ratios. (The naive alternative, "mean FP conceded
// by team X", is worthless: weak teams mostly play weak teams, so the two effects cancel.)
//
//     England       0.9896   (117 players, 620 obs)   <- the softest assignment in this pool
//     Australia     0.9827   (108 players, 553 obs)
//     South Africa  0.9769   (109 players, 555 obs)
//     Sri Lanka     0.9415   (116 players, 601 obs)   <- the hardest
//
// ⚠️ TWO THINGS TO KNOW BEFORE TRUSTING THIS, both of which argue for treating it as a small
// correction rather than a finding:
//
//  1. IT IS THE OPPOSITE OF THE T20 READ. In the T20 twin, Sri Lanka measured the EASIEST side to
//     score against (1.0028) and England among the hardest. In ODIs the ranking inverts. That is
//     not necessarily contradictory — SL's ODI attack is spin-led (Hasaranga, Theekshana,
//     Wellalage) and much of the "vs Sri Lanka" sample is played IN Sri Lanka on turning tracks —
//     but it does mean the factor is measuring venue and conditions as much as the opponent, and
//     a T20 intuition must not be carried over.
//  2. IT IS SPECIFICATION-SENSITIVE, unlike the T20 version (which held its ordering under a
//     relaxed cut). Re-measured four ways:
//        2021+, >=3/>=15  (used)  ENG .9896 | AUS .9827 | SA .9769 | SL .9415
//        2021+, >=2/>=10          SA  .9770 | SL  .9725 | ENG .9661 | AUS .9505   <- reshuffles
//        2022+, >=3/>=15          ENG 1.0010 | AUS .9820 | SA .9675 | SL .9076
//        2019+, >=3/>=15          ENG .9993 | AUS .9914 | SL .9722 | SA .9521
//     Three of four agree that England is the softest and put SL at or near the bottom; the
//     relaxed cut (the noisiest spec, 2-match samples) disagrees outright. Averaging all four
//     specs reproduces the chosen ordering (ENG .9890 > AUS .9767 > SA .9684 > SL .9485), which is
//     why the pre-registered spec is kept rather than fitted. The end-to-end spread is ~5%, versus
//     ~8% in the T20 twin, and it reaches prices as roughly +-2%.
//
// If you would rather not price it at all, set every value below to the same number — the factor
// is centred on its own mean, so equal values collapse it to exactly 1.0 for all four teams.
export const TWIN_ODI_OPPOSITION_DIFFICULTY: Record<string, number> = {
  ENG: 0.9896,
  AUS: 0.9827,
  SA: 0.9769,
  SL: 0.9415,
};

// Centred on 1.0 so the EFPPM on the board stays on the familiar form scale — only the RATIOS
// between teams carry pricing signal, and budget normalization would absorb a uniform shift anyway.
const DIFFICULTY_MEAN =
  Object.values(TWIN_ODI_OPPOSITION_DIFFICULTY).reduce((a, b) => a + b, 0) /
  Object.keys(TWIN_ODI_OPPOSITION_DIFFICULTY).length;

/**
 * Multiplier on a player's expected per-match output for the opponent their side actually faces.
 * Against a pool mean difficulty of 0.9727:
 *
 *     SL   1.0174   (+1.7%)  — faces England, the softest attack in the pool
 *     SA   1.0104   (+1.0%)  — faces Australia
 *     AUS  1.0043   (+0.4%)  — faces South Africa
 *     ENG  0.9679   (-3.2%)  — faces Sri Lanka, the hardest
 *
 * A ~5% spread end to end. England is the one side meaningfully moved, and it moves DOWN — the
 * mirror image of the T20 twin, where England gained most. Read the caveats above before quoting
 * this as a fact about the teams; it is a modest pricing correction, not a strength rating.
 */
export function twinOdiOppositionFactor(teamShort: string): number {
  const opponent = TWIN_ODI_OPPONENT[teamShort];
  const raw = opponent ? TWIN_ODI_OPPOSITION_DIFFICULTY[opponent] : undefined;
  if (!raw) return 1.0; // unknown team short → no adjustment, never a silent partial one
  return raw / DIFFICULTY_MEAN;
}

/**
 * Expected matches. Both series are 3 matches and the XI plays all three; the bench gets in through
 * injury or a settled series, not rotation — there is no dead rubber to experiment in the way a
 * 5-match series has (that archetype uses 5/2). Identical shape to the T20 twin.
 */
export function twinOdiExpectedMatches(squadNumber: number): number {
  return squadNumber >= 1 && squadNumber <= TWIN_ODI_XI_SIZE ? 3 : 1;
}

// ── Squads ─────────────────────────────────────────────────────────────────────
// All four announced squads are 16, each verified against two independent sources on 22 Sep 2026
// (Wikipedia tour pages + cricket.com.au / ICC / ETV squad reports).
//
// Order = CURATED probable XI (1-11, batting order) then bench (12-16) -> squad_number -> expected
// matches. The XIs below are a considered seed, NOT confirmed line-ups (no toss has happened), and
// the calls worth knowing about are flagged per team.
export const SA_AUS_ENG_SL_ODI_2026: BilateralTeam[] = [
  {
    name: "England",
    short: "ENG",
    country: "England",
    color: "#012169",
    players: [
      { name: "Ben Duckett", role: "BAT" },                                          // 1
      { name: "Tom Banton", role: "BAT" },                                           // 2
      { name: "Joe Root", role: "BAT" },                                             // 3
      { name: "Harry Brook", role: "BAT", note: "Captain (armband only — the C/VC premium is priced separately and is the bidder's choice, not the real captaincy)." }, // 4
      { name: "Jos Buttler", role: "WK" },                                           // 5
      { name: "Will Jacks", role: "AR" },                                            // 6
      { name: "Jamie Overton", role: "AR" },                                         // 7
      { name: "Liam Dawson", role: "AR" },                                           // 8
      { name: "Adil Rashid", role: "BOWL" },                                         // 9
      { name: "Jofra Archer", role: "BOWL" },                                        // 10
      { name: "Gus Atkinson", role: "BOWL" },                                        // 11
      { name: "Jordan Cox", role: "WK" },                                            // 12
      { name: "Rehan Ahmed", role: "AR" },                                           // 13
      { name: "Josh Tongue", role: "BOWL" },                                         // 14
      { name: "Sonny Baker", role: "BOWL" },                                         // 15
      { name: "Henry Crocombe", role: "BOWL", note: "Uncapped at ODI level — county/Blast form only, so he prices near baseline." }, // 16
    ],
  },
  {
    name: "Sri Lanka",
    short: "SL",
    country: "Sri Lanka",
    color: "#1B458F",
    players: [
      { name: "Pathum Nissanka", role: "BAT" },                                      // 1
      { name: "Kamil Mishara", role: "BAT" },                                        // 2
      { name: "Kusal Mendis", role: "WK", note: "ODI captain. Missed the T20I leg of this tour (ruled out with Binura Fernando) but returns to lead the 50-over side." }, // 3
      { name: "Kamindu Mendis", role: "AR" },                                        // 4
      { name: "Charith Asalanka", role: "AR", note: "Vice-captain." },               // 5
      { name: "Janith Liyanage", role: "BAT" },                                      // 6
      { name: "Dasun Shanaka", role: "AR", note: "Recalled — last ODI was against Zimbabwe in 2024, so the recency bucket is thin and he leans on the 36-month window." }, // 7
      { name: "Wanindu Hasaranga", role: "AR" },                                     // 8
      { name: "Dunith Wellalage", role: "AR" },                                      // 9
      { name: "Maheesh Theekshana", role: "BOWL" },                                  // 10
      { name: "Dilshan Madushanka", role: "BOWL" },                                  // 11
      { name: "Eshan Malinga", role: "BOWL" },                                       // 12
      { name: "Dushmantha Chameera", role: "BOWL" },                                 // 13
      { name: "Asitha Fernando", role: "BOWL" },                                     // 14
      { name: "Pavan Rathnayake", role: "BAT" },                                     // 15
      { name: "Sachindu Colombage", role: "AR", note: "Maiden international call-up — no ODI record at all, prices near baseline off domestic form." }, // 16
    ],
  },
  {
    name: "Australia",
    short: "AUS",
    country: "Australia",
    color: "#FFCD00",
    players: [
      { name: "Travis Head", role: "BAT" },                                          // 1
      { name: "Mitchell Marsh", role: "AR", note: "White-ball captain on the wider tour; Cummins takes the armband for the South Africa leg." }, // 2
      { name: "Josh Inglis", role: "WK" },                                           // 3
      { name: "Cameron Green", role: "AR" },                                         // 4
      { name: "Matt Renshaw", role: "BAT" },                                         // 5
      { name: "Alex Carey", role: "WK" },                                            // 6
      { name: "Cooper Connolly", role: "AR" },                                       // 7
      { name: "Pat Cummins", role: "BOWL", note: "Captain for the South Africa ODIs — he and Starc joined only for this leg, having sat out the Zimbabwe matches." }, // 8
      { name: "Mitchell Starc", role: "BOWL" },                                      // 9
      { name: "Adam Zampa", role: "BOWL" },                                          // 10
      { name: "Josh Hazlewood", role: "BOWL" },                                      // 11
      { name: "Xavier Bartlett", role: "BOWL" },                                     // 12
      { name: "Nathan Ellis", role: "BOWL" },                                        // 13
      { name: "Jack Edwards", role: "AR", note: "Added 21 Sep as cover after Billy Stanlake (side strain) and Spencer Johnson (workload) were ruled out." }, // 14
      { name: "Oliver Peake", role: "BAT" },                                         // 15
      { name: "Joel Davies", role: "BAT", note: "Uncapped at ODI level — BBL/Shield form only." }, // 16
    ],
  },
  {
    name: "South Africa",
    short: "SA",
    country: "South Africa",
    color: "#007A4D",
    players: [
      { name: "Aiden Markram", role: "AR" },                                         // 1
      { name: "Quinton de Kock", role: "WK" },                                       // 2
      { name: "Temba Bavuma", role: "BAT", note: "Captain — back to lead the ODI side." }, // 3
      { name: "Matthew Breetzke", role: "BAT" },                                     // 4
      { name: "Tristan Stubbs", role: "BAT" },                                       // 5
      { name: "David Miller", role: "BAT" },                                         // 6
      { name: "Marco Jansen", role: "AR" },                                          // 7
      { name: "Corbin Bosch", role: "AR" },                                          // 8
      { name: "Keshav Maharaj", role: "BOWL" },                                      // 9
      { name: "Gerald Coetzee", role: "BOWL", note: "Recalled for the first time since the 2023 World Cup, so his ODI recency bucket is nearly empty." }, // 10
      { name: "Kwena Maphaka", role: "BOWL" },                                       // 11
      { name: "Ryan Rickelton", role: "WK" },                                        // 12
      { name: "Tony de Zorzi", role: "BAT" },                                        // 13
      { name: "Bjorn Fortuin", role: "BOWL" },                                       // 14
      { name: "Duan Jansen", role: "BOWL", note: "In for the injured Ottneil Baartman (hamstring, 12 Sep). Marco's younger brother — 2 ODIs, debuted Aug 2026." }, // 15
      { name: "Nqobani Mokoena", role: "BOWL", note: "In for the injured Lungi Ngidi (hamstring, 18 Sep)." }, // 16
    ],
  },
];

// ── Identity ───────────────────────────────────────────────────────────────────
// HAND-VERIFIED announced-name -> cricsheet_id, used with fuzzy matching OFF. This pool is hostile
// to name matching and the traps are not hypothetical — each comment below is a wrong match that
// a surname/initial matcher actually makes against our data:
//
//   - TWO JANSENS, brothers: Marco (M Jansen, 203 matches) and Duan (D Jansen, 6). And there are
//     TWO "D Jansen" rows — the other is a European associate player (opponents include Israel,
//     Bulgaria, Luxembourg, Guernsey), nothing to do with South Africa.
//   - TWO MENDISES in the squad plus three more in the DB: Kusal is BKG Mendis, Kamindu is filed
//     under his full name, and BAW (Ajantha) / BMAJ / RTM Mendis are other men entirely.
//   - Eshan Malinga is E Malinga (56 matches) — a surname match takes SL Malinga (Lasith, 453).
//   - Pavan Rathnayake is P Rathnayake (BAT) — NOT RMMP Rathnayake (Milan, the all-rounder).
//   - Asitha Fernando is AM Fernando. The Fernando surname holds WIA (Avishka), CRD (Dilhara),
//     MVT and B Fernando; the fuzzy matcher has previously grabbed AM for "Avishka".
//   - Cameron Green is stored under his FULL NAME (183 matches). The high-appearance "CJ Green"
//     row is Chris Green — 319 matches and zero ODIs, so a most-matches tie-break picks wrong.
//   - Jordan Cox is JM Cox — NOT OB Cox (Oliver, 307). Jamie Overton is J Overton — NOT C Overton
//     (his twin Craig, 294).
//   - Dilshan Madushanka is D Madushanka (2020-2026) — NOT LD Madushanka.
//   - Oliver Peake is OJ Peake; four statless "Oliver Peake" MLC duplicate rows also exist.
export const SA_AUS_ENG_SL_ODI_CSID: Record<string, string> = {
  // — England —
  "Ben Duckett": "5f26f677",          // BM Duckett
  "Tom Banton": "25f7b7d6",           // T Banton
  "Joe Root": "a343262c",             // JE Root — NOT WT Root (his brother Billy)
  "Harry Brook": "4ae1755b",          // HC Brook
  "Jos Buttler": "99b75528",          // JC Buttler
  "Will Jacks": "9caf69a1",           // WG Jacks
  "Jamie Overton": "59559bc2",        // J Overton — NOT C Overton (twin brother Craig, 294)
  "Liam Dawson": "4a461c24",          // LA Dawson
  "Adil Rashid": "249d60c9",          // AU Rashid — NOT Rashid Khan / Rashid Latif
  "Jofra Archer": "5574750c",         // JC Archer
  "Gus Atkinson": "70d57519",         // AAP Atkinson
  "Jordan Cox": "ff154ecd",           // JM Cox — NOT OB Cox (Oliver, 307)
  "Rehan Ahmed": "0ecb4de6",          // filed under his full name; the "Ahmed" surname pool is all Pakistani
  "Josh Tongue": "1f1b4c89",          // JC Tongue (two statless "Josh Tongue" dup rows also exist)
  "Sonny Baker": "78c12883",          // S Baker
  "Henry Crocombe": "27fc5808",       // HT Crocombe
  // — Sri Lanka —
  "Pathum Nissanka": "8ee36b18",      // P Nissanka — NOT RAP Nissanka
  "Kamil Mishara": "65cebd5d",        // K Mishara
  "Kusal Mendis": "5d1e7582",         // BKG Mendis — the 394-match one; NOT BAW/BMAJ/RTM Mendis
  "Kamindu Mendis": "08548b13",       // filed under his full name
  "Charith Asalanka": "732c038e",     // KIC Asalanka
  "Janith Liyanage": "84212ffb",      // J Liyanage — NOT I Liyanage
  "Dasun Shanaka": "3ff033bb",        // MD Shanaka
  "Wanindu Hasaranga": "a97c8ec2",
  "Dunith Wellalage": "736123bb",     // DN Wellalage
  "Maheesh Theekshana": "f24c6701",   // M Theekshana
  "Dilshan Madushanka": "de7d833e",   // D Madushanka (2020-2026) — NOT LD Madushanka
  "Eshan Malinga": "5750bcb4",        // E Malinga — NOT SL Malinga (Lasith, 453)
  "Dushmantha Chameera": "327b58d3",
  "Asitha Fernando": "de3d549a",      // AM Fernando — NOT WIA (Avishka) / CRD (Dilhara) Fernando
  "Pavan Rathnayake": "c1fdfb46",     // P Rathnayake (BAT) — NOT RMMP Rathnayake (Milan, the AR)
  "Sachindu Colombage": "4b6f6b73",   // S Colombage — no ODI record, domestic rows only
  // — Australia —
  "Travis Head": "12b610c2",          // TM Head
  "Mitchell Marsh": "3d8feaf8",       // MR Marsh — NOT SE Marsh (brother Shaun, 316)
  "Josh Inglis": "989889ff",          // JP Inglis
  "Cameron Green": "eaa76d3c",        // full name — NOT CJ Green (Chris, 319 matches, 0 ODIs)
  "Matt Renshaw": "218d4d78",         // MT Renshaw
  "Alex Carey": "69d03465",           // AT Carey
  "Cooper Connolly": "fe366f34",      // C Connolly
  "Pat Cummins": "ded9240e",          // PJ Cummins — NOT ML / AC Cummins
  "Mitchell Starc": "3fb19989",       // MA Starc
  "Adam Zampa": "14f96089",           // A Zampa
  "Josh Hazlewood": "03806cf8",       // JR Hazlewood
  "Xavier Bartlett": "3b53243a",      // XC Bartlett (his players.country is wrongly 'New Zealand' — id is right)
  "Nathan Ellis": "9eb1455b",         // NT Ellis — NOT AM Ellis (New Zealand)
  "Jack Edwards": "f787e0eb",         // J Edwards (Australia, 122) — NOT FH (Fidel) / SA (Scott, NED) Edwards
  "Oliver Peake": "9c8448ba",         // OJ Peake — four statless "Oliver Peake" MLC dup rows exist
  "Joel Davies": "5cdf8304",          // JA Davies — the only Australian Davies; NOT AL/SM/JLB/O/RC
  // — South Africa —
  "Aiden Markram": "6a26221c",        // AK Markram
  "Quinton de Kock": "372455c4",      // Q de Kock
  "Temba Bavuma": "9ffd1ac1",         // T Bavuma
  "Matthew Breetzke": "35f173a0",     // MP Breetzke
  "Tristan Stubbs": "85b3fab2",       // T Stubbs
  "David Miller": "d67d5f00",         // DA Miller — NOT NO Miller (West Indies)
  "Marco Jansen": "81c36ee9",         // M Jansen
  "Corbin Bosch": "172dff15",         // C Bosch — NOT E Bosch
  "Keshav Maharaj": "0b60eb09",       // KA Maharaj
  "Gerald Coetzee": "3204c99f",       // G Coetzee
  "Kwena Maphaka": "107c26fb",        // KT Maphaka
  "Ryan Rickelton": "e66732f8",       // RD Rickelton
  "Tony de Zorzi": "d3a1c63d",        // T de Zorzi
  "Bjorn Fortuin": "9a2fc964",        // BC Fortuin
  "Duan Jansen": "8dc152d1",          // D Jansen, SA, debuted Aug 2026 — NOT the European D Jansen
  "Nqobani Mokoena": "201facae",      // N Mokoena
};

// Formats the matching CANDIDATE pool is drawn from. WIDE, and that is deliberate — an ODI-only
// candidate pool was tried first and was WRONG.
//
// The reasoning that fails: "every player here is a top-8 international, so anyone with a record
// has an ODI record." Four of the 64 do not — Henry Crocombe, Sachindu Colombage, Jack Edwards and
// Joel Davies are all uncapped in ODIs. Scoped to 'ODI' they were absent from the candidate set, so
// the builder re-created each of them as a NEW STATLESS ROW sitting beside the real one it could
// not see: Edwards has 122 matches in this DB, Crocombe 78, Davies 31, Colombage 15. That is the
// same duplicate-row failure the T20 twin hit from the other direction, and it is worse than it
// looks — the duplicates are real `players` rows, and `players` ships local→cloud on turso:sync.
//
// Widening costs NOTHING here, because identity in this tour is resolved EXCLUSIVELY by
// SA_AUS_ENG_SL_ODI_CSID with `noFuzzy: true`. The candidate pool is only the set of rows the
// cricsheet_id bridge is allowed to find; it is not an input to matching judgement, so adding
// candidates cannot introduce a namesake error the way it would under fuzzy matching. Nor does it
// touch valuation — the engine's quality gate stays `format='ODI' AND opposition IN (top-8)`
// regardless of what is in the candidate pool, so these four still price off ZERO ODI form, near
// baseline, exactly as they should. What it buys is that the board links them to their real
// records, so the player modal's "Recent Matches" tab shows their actual recent cricket.
export const TWIN_ODI_MATCH_FORMATS = [
  "ODI", "T20", "IPL", "BBL", "BLAST", "HUN", "PSL", "SA20", "ILT20", "CPL", "LPL", "MLC",
  "TEST", "FC",
];
