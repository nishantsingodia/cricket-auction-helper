// Pakistan ODI Tri-Series 2026 — PAK v ENG v SL, 18-31 Oct, Rawalpindi (games 1-3) and Lahore
// (games 4-6 + final). DOUBLE round robin: each side plays the other two twice (4 league games),
// then the top two meet in the final. Three teams, ONE pool, one shared purse.
//
// Archetype: TRI-SERIES ODI (see tri-odi-tours.ts) — the twin-ODI form model (ODI-only, 36-month
// windows, 60/40 recency, weak-opposition ODIs x0.83) with no opposition factor, because every side
// plays both others equally often. Unlike AFG/BAN/ZIM there is no data hole: all three are top-8
// nations with full cricsheet ODI records, so no EFPPM overrides.
//
// Expected matches: XI = 4 league + P(final). P(final) PAK 0.75 (home) / ENG 0.65 / SL 0.60 —
// sums to 2.0. Bench 1.0 (a five-game event with two dead-ish rubbers leaves room to rotate).
//
// XI seed = each side's most recent ODI XIs from cricsheet, restricted to this squad:
//  - ENG (v SL, Sep 2026): Buttler and Archer are not in this squad. Cox keeps (as in ODI 3), Sam
//    Curran and Rashid (both back) come in; Dawson / Baker drop to the bench.
//  - PAK (v AUS, Jun 2026): Sahibzada Farhan, Maaz Sadaqat and Abdul Samad are not in this squad.
//    Saim Ayub and Fakhar Zaman open; Hasan Nawaz bats in the middle order.
//  - SL (v ENG, Sep 2026): Asalanka is not in this squad -> Avishka Fernando (Shanaka has played
//    2 ODIs since 2024, none of SL's last five, so he sits on the bench). Theekshana / Chameera on the
//    bench behind the Wellalage / Malinga / Asitha / Madushanka attack that played all three.

import type { BilateralTeam } from "./ind-vs-eng-t20-2026";

export const PAK_ENG_SL_ODI_TRI_2026_NAME = "PAK v ENG v SL ODI Tri-Series 2026";

export const PAK_ENG_SL_ODI_TRI_2026: BilateralTeam[] = [
  {
    name: "Pakistan", short: "PAK", country: "Pakistan", color: "#01411C",
    players: [
      { name: "Saim Ayub", role: "BAT" },            // 1
      { name: "Fakhar Zaman", role: "BAT" },         // 2
      { name: "Babar Azam", role: "BAT" },           // 3
      { name: "Ghazi Ghori", role: "WK" },           // 4
      { name: "Salman Ali Agha", role: "AR" },       // 5
      { name: "Hasan Nawaz", role: "BAT" },          // 6
      { name: "Arafat Minhas", role: "AR" },         // 7
      { name: "Shadab Khan", role: "AR" },           // 8
      { name: "Shaheen Shah Afridi", role: "BOWL" }, // 9 (c)
      { name: "Haris Rauf", role: "BOWL" },          // 10
      { name: "Abrar Ahmed", role: "BOWL" },         // 11
      { name: "Naseem Shah", role: "BOWL" },         // 12
      { name: "Faheem Ashraf", role: "AR" },         // 13
      { name: "Saad Baig", role: "WK" },             // 14
      { name: "Sufyan Moqim", role: "BOWL" },        // 15
      { name: "Razaullah Mashwani", role: "AR" },    // 16
    ],
  },
  {
    name: "England", short: "ENG", country: "England", color: "#CF142B",
    players: [
      { name: "Tom Banton", role: "BAT" },     // 1
      { name: "Ben Duckett", role: "BAT" },    // 2
      { name: "Joe Root", role: "BAT" },       // 3
      { name: "Harry Brook", role: "BAT" },    // 4 (c)
      { name: "Jordan Cox", role: "WK" },      // 5
      { name: "Will Jacks", role: "AR" },      // 6
      { name: "Sam Curran", role: "AR" },      // 7
      { name: "Jamie Overton", role: "AR" },   // 8
      { name: "Gus Atkinson", role: "BOWL" },  // 9
      { name: "Adil Rashid", role: "BOWL" },   // 10
      { name: "Josh Tongue", role: "BOWL" },   // 11
      { name: "Liam Dawson", role: "AR" },     // 12
      { name: "Sonny Baker", role: "BOWL" },   // 13
      { name: "James Coles", role: "AR" },     // 14
      { name: "Mason Crane", role: "BOWL" },   // 15
      { name: "Henry Crocombe", role: "BOWL" }, // 16
    ],
  },
  {
    name: "Sri Lanka", short: "SL", country: "Sri Lanka", color: "#0B2A6F",
    players: [
      { name: "Pathum Nissanka", role: "BAT" },     // 1
      { name: "Kamindu Mendis", role: "AR" },       // 2
      { name: "Kusal Mendis", role: "WK" },         // 3 (c)
      { name: "Pavan Rathnayake", role: "BAT" },    // 4
      { name: "Janith Liyanage", role: "AR" },      // 5
      { name: "Avishka Fernando", role: "BAT" },    // 6
      { name: "Dunith Wellalage", role: "AR" },     // 7
      { name: "Sachindu Colombage", role: "AR" },   // 8
      { name: "Eshan Malinga", role: "BOWL" },      // 9
      { name: "Asitha Fernando", role: "BOWL" },    // 10
      { name: "Dilshan Madushanka", role: "BOWL" }, // 11
      { name: "Maheesh Theekshana", role: "BOWL" }, // 12
      { name: "Dushmantha Chameera", role: "BOWL" }, // 13
      { name: "Dasun Shanaka", role: "AR" },        // 14
      { name: "Kamil Mishara", role: "WK" },        // 15
      { name: "Sahan Arachchige", role: "BAT" },    // 16
    ],
  },
];

// Hand-verified cricsheet ids, fuzzy OFF. ENG/SL ids are the ones verified for the twin ODI
// (sa-aus-eng-sl-odi-2026.ts) — see the traps documented there. New here:
//   - "Hasan Nawaz" is filed "Hassan Nawaz" (double s).
//   - Sufyan Moqim is filed "Sufiyan Muqeem".
//   - Razaullah Mashwani is the "Razaullah" row (3 games, TEST + PSL) — same id the PAK v SL T20
//     pool used.
//   - James Coles is JM Coles (Sussex, 2026) — NOT MT Coles (Matt, last played 2019).
//   - Sahan Arachchige is SSD Arachchige — NOT the three other Arachchige / Kasturiarachchige rows.
//   - Avishka Fernando is WIA Fernando — NOT AM (Asitha), who is also in this squad.
export const PAK_ENG_SL_ODI_CSID: Record<string, string> = {
  // — Pakistan —
  "Saim Ayub": "33609a8c",
  "Fakhar Zaman": "1777c020",
  "Babar Azam": "8a75e999",
  "Ghazi Ghori": "28b61a48",
  "Salman Ali Agha": "89c16049",     // filed "Agha Salman"
  "Hasan Nawaz": "26a8b2fe",         // filed "Hassan Nawaz"
  "Arafat Minhas": "f2e8b37c",
  "Shadab Khan": "9de62878",
  "Shaheen Shah Afridi": "45a7e761",
  "Haris Rauf": "24bb1c2f",
  "Abrar Ahmed": "abb7c76c",
  "Naseem Shah": "9c9af282",
  "Faheem Ashraf": "bd4ea627",
  "Saad Baig": "eb75d76c",
  "Sufyan Moqim": "4277234d",        // filed "Sufiyan Muqeem"
  "Razaullah Mashwani": "91b35a29",  // filed "Razaullah"
  // — England —
  "Tom Banton": "25f7b7d6",
  "Ben Duckett": "5f26f677",
  "Joe Root": "a343262c",
  "Harry Brook": "4ae1755b",
  "Jordan Cox": "ff154ecd",
  "Will Jacks": "9caf69a1",
  "Sam Curran": "e94915e6",          // SM Curran
  "Jamie Overton": "59559bc2",
  "Gus Atkinson": "70d57519",
  "Adil Rashid": "249d60c9",
  "Josh Tongue": "1f1b4c89",
  "Liam Dawson": "4a461c24",
  "Sonny Baker": "78c12883",
  "James Coles": "9c643d7b",         // JM Coles — NOT MT Coles
  "Mason Crane": "f0a0204e",         // MS Crane
  "Henry Crocombe": "27fc5808",
  // — Sri Lanka —
  "Pathum Nissanka": "8ee36b18",
  "Kamindu Mendis": "08548b13",
  "Kusal Mendis": "5d1e7582",
  "Pavan Rathnayake": "c1fdfb46",
  "Janith Liyanage": "84212ffb",
  "Dasun Shanaka": "3ff033bb",
  "Dunith Wellalage": "736123bb",
  "Sachindu Colombage": "4b6f6b73",
  "Eshan Malinga": "5750bcb4",
  "Asitha Fernando": "de3d549a",
  "Dilshan Madushanka": "de7d833e",
  "Maheesh Theekshana": "f24c6701",
  "Dushmantha Chameera": "327b58d3",
  "Avishka Fernando": "9550470d",    // WIA Fernando
  "Kamil Mishara": "65cebd5d",
  "Sahan Arachchige": "c05f9d20",    // SSD Arachchige
};

export const PAK_ENG_SL_ODI_VENUES = [
  { canonical: "Rawalpindi Cricket Stadium", variants: ["Rawalpindi Cricket Stadium"], type: "balanced" as const },
  { canonical: "Gaddafi Stadium, Lahore", variants: ["Gaddafi Stadium", "Gaddafi Stadium, Lahore"], type: "balanced" as const },
];
