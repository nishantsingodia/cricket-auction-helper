// PAK v SL + IND v WI T20I 2026 — ONE auction pool spanning TWO concurrent bilateral T20I series
// (9–14 Oct 2026). Four teams, 61 players, one shared purse. The second TWIN T20 tour, built on
// the same archetype as ENG v SL + IND v AFG (see eng-sl-ind-afg-t20-2026.ts for the long-form
// reasoning): same ETPL quality set, same 3/1 expected matches, its own measured opposition factor.
//
//   - PAK v SL: the full 3-match series, all at Rawalpindi (9 / 11 / 13 Oct).
//   - IND v WI: matches 2–4 ONLY of the 5-match series (Ranchi 9 Oct, Indore 11 Oct, Hyderabad
//     14 Oct). Match 1 (Lucknow, 6 Oct) is already played and match 5 (Bengaluru, 17 Oct) is
//     outside this auction's window, so both halves are exactly three games.
//
// Why the ETPL quality set is still right with no Afghanistan in the pool: half this pool's
// freshest form is NOT a top-8 T20I. Pakistan's last T20Is in our data are the Feb 2026 World Cup
// (the Asian Games are not yet on cricsheet); since then they have played PSL, CPL and LPL. Under
// the plain bilateral gate ('MLC','IPL' + top-8 T20Is) the whole PSL record disappears and
// Pakistan's fringe (Nawaz, Samad, Sadaqat, Minhas, Muqeem) is priced off a handful of T20Is.
//
// Players are ordered as the CURATED probable XI (1–11, batting order) then bench (12+) ->
// squad_number. IND and WI use the ACTUAL XI from the 1st T20I (Lucknow, 6 Oct) — real evidence,
// not a prediction. PAK and SL are curated (both squads are rebuilt sides — see notes).

import type { BilateralTeam, Role } from "./ind-vs-eng-t20-2026";

export const PAK_SL_IND_WI_T20_2026_NAME = "PAK v SL + IND v WI T20I 2026";
export const PAK_SL_IND_WI_XI_SIZE = 11;

export type { BilateralTeam, Role };

// ── Fixtures ───────────────────────────────────────────────────────────────────
export const PAK_SL_IND_WI_FIXTURES = [
  { series: "PAK v SL", match: 1, date: "2026-10-09", venue: "Rawalpindi Cricket Stadium" },
  { series: "IND v WI", match: 2, date: "2026-10-09", venue: "JSCA International Stadium Complex, Ranchi" },
  { series: "PAK v SL", match: 2, date: "2026-10-11", venue: "Rawalpindi Cricket Stadium" },
  { series: "IND v WI", match: 3, date: "2026-10-11", venue: "Holkar Cricket Stadium, Indore" },
  { series: "PAK v SL", match: 3, date: "2026-10-13", venue: "Rawalpindi Cricket Stadium" },
  { series: "IND v WI", match: 4, date: "2026-10-14", venue: "Rajiv Gandhi International Stadium, Uppal, Hyderabad" },
] as const;

// teamShort -> the other side it plays. Drives the opposition factor.
export const PAK_SL_IND_WI_OPPONENT: Record<string, string> = {
  PAK: "SL",
  SL: "PAK",
  IND: "WI",
  WI: "IND",
};

// ── Opposition factor ──────────────────────────────────────────────────────────
// MEASURED 7 Oct 2026, within-player, identical spec to the first T20 twin: men's T20Is since
// 2021, players with >= 3 matches vs the opponent and >= 15 overall; mean FP vs that opponent /
// the player's own overall mean, averaged.
//
//     West Indies  1.0146   (162 players, 1040 obs)   <- the softest of the four to score against
//     Sri Lanka    1.0073   (157 players,  841 obs)
//     Pakistan     0.9842   (176 players, 1026 obs)
//     India        0.9254   (167 players, 1220 obs)   <- by far the hardest
//
// Reproduces the Sep measurement (SL 1.0028 / IND 0.9255 then, on a month less data). Stable:
// the relaxed cut (>= 2 / >= 10) gives WI 1.001 / SL 0.977 / PAK 0.954 / IND 0.909 — same
// ordering, same ~9% spread. All four are measured; no curated value this time.
export const PAK_SL_IND_WI_OPPOSITION_DIFFICULTY: Record<string, number> = {
  WI: 1.0146,
  SL: 1.0073,
  PAK: 0.9842,
  IND: 0.9254,
};

const DIFFICULTY_MEAN =
  Object.values(PAK_SL_IND_WI_OPPOSITION_DIFFICULTY).reduce((a, b) => a + b, 0) /
  Object.keys(PAK_SL_IND_WI_OPPOSITION_DIFFICULTY).length;

/**
 * Multiplier on a player's expected per-match output for the opponent their side actually faces,
 * centred on the pool mean (0.9829):
 *
 *     IND  1.0323   (+3.2%)  — West Indies is the softest assignment in the pool
 *     PAK  1.0249   (+2.5%)
 *     SL   1.0013   (+0.1%)
 *     WI   0.9415   (-5.9%)  — they bat and bowl against India, the hardest side measured
 *
 * The asymmetry is the point: in the IND v WI half the two sides move ~9% apart, while PAK v SL
 * are nearly a wash. A West Indian is the one buyer's trap here.
 */
export function pakSlIndWiOppositionFactor(teamShort: string): number {
  const opponent = PAK_SL_IND_WI_OPPONENT[teamShort];
  const raw = opponent ? PAK_SL_IND_WI_OPPOSITION_DIFFICULTY[opponent] : undefined;
  if (!raw) return 1.0; // unknown team short → no adjustment, never a silent partial one
  return raw / DIFFICULTY_MEAN;
}

// Flat 3 / 1 — both halves are exactly three matches for this auction.
export function pakSlIndWiExpectedMatches(squadNumber: number): number {
  return squadNumber >= 1 && squadNumber <= PAK_SL_IND_WI_XI_SIZE ? 3 : 1;
}

// ── Squads ─────────────────────────────────────────────────────────────────────
export const PAK_SL_IND_WI_T20_2026: BilateralTeam[] = [
  {
    name: "Pakistan", short: "PAK", country: "Pakistan", color: "#01411C",
    players: [
      { name: "Sahibzada Farhan", role: "BAT" },        // 1  (C — new T20I captain)
      { name: "Saim Ayub", role: "AR" },                // 2
      { name: "Fakhar Zaman", role: "BAT" },            // 3
      { name: "Hasan Nawaz", role: "BAT", note: "96 in the Asian Games final (3 Oct) — not yet in our data." }, // 4
      { name: "Khawaja Nafay", role: "WK" },            // 5  (only designated keeper)
      { name: "Abdul Samad", role: "BAT" },             // 6
      { name: "Shadab Khan", role: "AR" },              // 7
      { name: "Arafat Minhas", role: "AR" },            // 8
      { name: "Naseem Shah", role: "BOWL" },            // 9
      { name: "Abrar Ahmed", role: "BOWL" },            // 10
      { name: "Salman Mirza", role: "BOWL" },           // 11
      { name: "Maaz Sadaqat", role: "AR", note: "Opened in the Asian Games final; one call away from the XI if Fakhar drops down." }, // 12
      { name: "Sufiyan Muqeem", role: "BOWL", note: "Left-arm wrist spin — contests the second spinner slot with Abrar." }, // 13
      { name: "Muhammad Imran Randhawa", role: "AR", note: "Test debut 9 Sep 2026; little senior T20 data." }, // 14
      { name: "Razaullah", role: "AR", note: "Uncapped-level data only (3 games) — prices near baseline." }, // 15
    ],
  },
  {
    name: "Sri Lanka", short: "SL", country: "Sri Lanka", color: "#E8A33D",
    players: [
      { name: "Kamil Mishara", role: "WK" },            // 1
      { name: "Lahiru Udara", role: "WK" },             // 2
      { name: "Kusal Mendis", role: "WK" },             // 3  (C)
      { name: "Kamindu Mendis", role: "AR" },           // 4
      { name: "Dasun Shanaka", role: "AR" },            // 5
      { name: "Chamindu Wickramasinghe", role: "AR" },  // 6
      { name: "Dunith Wellalage", role: "AR" },         // 7
      { name: "Maheesh Theekshana", role: "BOWL" },     // 8
      { name: "Dushmantha Chameera", role: "BOWL", note: "Named SUBJECT TO FITNESS — Binura Fernando is the like-for-like cover." }, // 9
      { name: "Nuwan Thushara", role: "BOWL" },         // 10
      { name: "Eshan Malinga", role: "BOWL" },          // 11
      { name: "Sahan Arachchige", role: "BAT" },        // 12
      { name: "Binura Fernando", role: "BOWL", note: "First in if Chameera fails his fitness test." }, // 13
      { name: "Vijayakanth Viyaskanth", role: "BOWL" }, // 14
      { name: "Sineth Jayawardena", role: "AR", note: "No record in our data — prices at baseline." }, // 15
    ],
  },
  {
    name: "India", short: "IND", country: "India", color: "#1A75CF",
    players: [
      // The ACTUAL XI from the 1st T20I (Lucknow, 6 Oct; India won by 8 wkts, Iyer 102*).
      { name: "Sanju Samson", role: "WK" },             // 1
      { name: "Abhishek Sharma", role: "AR" },          // 2
      { name: "Ishan Kishan", role: "WK" },             // 3
      { name: "Shreyas Iyer", role: "BAT" },            // 4  (C)
      { name: "Tilak Varma", role: "BAT" },             // 5  (VC)
      { name: "Shivam Dube", role: "AR" },              // 6
      { name: "Naman Dhir", role: "AR" },               // 7
      { name: "Axar Patel", role: "AR" },               // 8
      { name: "Arshdeep Singh", role: "BOWL" },         // 9
      { name: "Mayank Yadav", role: "BOWL" },           // 10
      { name: "Kuldeep Yadav", role: "BOWL" },          // 11
      { name: "Prince Yadav", role: "BOWL", note: "Lost the 11th spot to Mayank Yadav in the 1st T20I." }, // 12
      { name: "Vaibhav Sooryavanshi", role: "BAT", note: "Benched for the 1st T20I; one selection call from the XI." }, // 13
      { name: "Ravi Bishnoi", role: "BOWL" },           // 14
      { name: "Nitish Kumar Reddy", role: "AR", note: "Benched for the 1st T20I — Naman Dhir took the all-rounder slot." }, // 15
    ],
  },
  {
    name: "West Indies", short: "WI", country: "West Indies", color: "#7B0041",
    players: [
      // The ACTUAL XI from the 1st T20I (Lucknow, 6 Oct).
      { name: "Shai Hope", role: "WK" },                // 1  (C)
      { name: "Kamil Pooran", role: "BAT" },            // 2
      { name: "Shimron Hetmyer", role: "BAT" },         // 3
      { name: "Rovman Powell", role: "BAT" },           // 4
      { name: "Sherfane Rutherford", role: "BAT" },     // 5
      { name: "Roston Chase", role: "AR" },             // 6
      { name: "Romario Shepherd", role: "AR" },         // 7
      { name: "Matthew Forde", role: "BOWL" },          // 8
      { name: "Shamar Springer", role: "AR" },          // 9
      { name: "Akeal Hosein", role: "BOWL" },           // 10
      { name: "Shamar Joseph", role: "BOWL" },          // 11
      { name: "Gudakesh Motie", role: "BOWL", note: "Left out of the 1st T20I XI (Springer played)." }, // 12
      { name: "Amir Jangoo", role: "WK" },              // 13
      { name: "Keemo Paul", role: "AR" },               // 14
      { name: "Quentin Sampson", role: "BAT" },         // 15
      { name: "Jewel Andrew", role: "WK", note: "Finger injury in the 3rd ODI (no fracture) — under observation." }, // 16
    ],
  },
];

// Announced name (EXACT string as written above) -> cricsheet_id. Fuzzy OFF, no alias map — the
// same discipline as both earlier twins. IND and WI ids are reused verbatim from IND_WI_CSID; the
// returning SL ids from ENG_SL_IND_AFG_CSID. New ones verified 7 Oct 2026 against
// role + country + career span (and people.csv's cricinfo key where one exists):
//
//   - "Hasan Nawaz" is filed as "Hassan Nawaz" (double s).
//   - "Muhammad Imran Randhawa" is filed as plain "Mohammad Imran" — confirmed by the Edgbaston
//     Test row on 9 Sep 2026, his debut. A second "Mohammad Imran (2)" exists in people.csv.
//   - Abdul Samad: THREE rows — the Indian IPL batter (21dbacff, 82 games), an unlabelled 2026
//     IPL row, and the Pakistani (8e554b6b). Name matching takes the Indian.
//   - Kusal Mendis is BKG Mendis — and the DB has five more Mendises.
//   - Binura Fernando is "B Fernando" (cricinfo 629080) — six SL Fernandos in the DB.
//   - Lahiru Udara = LU Igalagamage.
//
// DELIBERATELY ABSENT (no record exists, created statless at baseline): Sineth Jayawardena —
// people.csv knows him (e4bf3570) but no match of his is ingested. Note four statless
// "Sineth Jayawardena" rows already exist from LPL builds; the builder reuses one by name.
export const PAK_SL_IND_WI_CSID: Record<string, string> = {
  // — Pakistan —
  "Sahibzada Farhan": "1aba45cd",
  "Saim Ayub": "33609a8c",
  "Fakhar Zaman": "1777c020",
  "Hasan Nawaz": "26a8b2fe",         // filed "Hassan Nawaz"
  "Khawaja Nafay": "3cf54e77",
  "Abdul Samad": "8e554b6b",         // the PAKISTANI — NOT 21dbacff (Indian, IPL)
  "Shadab Khan": "9de62878",         // NOT "Samader Shadab"
  "Arafat Minhas": "f2e8b37c",       // NOT Arafat Sunny (BAN)
  "Naseem Shah": "9c9af282",
  "Abrar Ahmed": "abb7c76c",
  "Salman Mirza": "7ab1eab7",        // NOT Hammad Mirza (Oman)
  "Maaz Sadaqat": "6d9560f3",
  "Sufiyan Muqeem": "4277234d",
  "Muhammad Imran Randhawa": "65a2fff5", // filed "Mohammad Imran"
  "Razaullah": "91b35a29",
  // — Sri Lanka —
  "Kamil Mishara": "65cebd5d",
  "Lahiru Udara": "07b6c3c1",        // LU Igalagamage
  "Kusal Mendis": "5d1e7582",        // BKG Mendis — NOT Kamindu / BAW / RTM
  "Kamindu Mendis": "08548b13",
  "Dasun Shanaka": "3ff033bb",
  "Chamindu Wickramasinghe": "a5c48ed1", // C Wickramasinghe
  "Dunith Wellalage": "736123bb",
  "Maheesh Theekshana": "f24c6701",
  "Dushmantha Chameera": "327b58d3",
  "Nuwan Thushara": "ee1b6c27",
  "Eshan Malinga": "5750bcb4",       // NOT SL Malinga (Lasith)
  "Sahan Arachchige": "c05f9d20",    // SSD Arachchige
  "Binura Fernando": "dabbd0ae",     // B Fernando
  "Vijayakanth Viyaskanth": "03a83c50", // V Viyaskanth
  // — India — (= IND_WI_CSID)
  "Sanju Samson": "a4cc73aa",
  "Abhishek Sharma": "f29185a1",
  "Ishan Kishan": "752f7486",
  "Shreyas Iyer": "85ec8e33",
  "Tilak Varma": "b0482a1d",
  "Shivam Dube": "a4e37e47",
  "Naman Dhir": "fffa744b",
  "Axar Patel": "2e171977",
  "Arshdeep Singh": "244048f6",
  "Mayank Yadav": "b1ad996b",
  "Kuldeep Yadav": "8d2c70ad",
  "Prince Yadav": "80b2fb19",
  "Vaibhav Sooryavanshi": "470f446b",
  "Ravi Bishnoi": "df064e1a",
  "Nitish Kumar Reddy": "aad0c365",
  // — West Indies — (= IND_WI_CSID)
  "Shai Hope": "1fc6ef83",
  "Kamil Pooran": "d83c2dbe",        // NOT N Pooran
  "Shimron Hetmyer": "48a1d7b7",
  "Rovman Powell": "650d5e49",
  "Sherfane Rutherford": "d014d5ac",
  "Roston Chase": "3feda4fa",
  "Romario Shepherd": "c5aef772",
  "Matthew Forde": "83d17bbc",
  "Shamar Springer": "4175d211",
  "Akeal Hosein": "4d7f517e",
  "Shamar Joseph": "97290faf",       // NOT AS Joseph (Alzarri)
  "Gudakesh Motie": "97bdec3d",
  "Amir Jangoo": "88626ed2",
  "Keemo Paul": "75224f22",
  "Quentin Sampson": "238ce998",
  "Jewel Andrew": "6b0db726",
};

// Candidate formats for the id bridge. Wide on purpose (identity is csid-bridged, fuzzy off, so
// extra candidates cannot cause a namesake error) — PSL is load-bearing for Pakistan, CPL for WI,
// LPL for Sri Lanka, TEST for Randhawa/Razaullah's only senior rows.
export const PAK_SL_IND_WI_MATCH_FORMATS = [
  "T20", "IPL", "PSL", "CPL", "LPL", "ILT20", "SA20", "BBL", "MLC", "BLAST", "HUN", "ODI", "TEST",
];
