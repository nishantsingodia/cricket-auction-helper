// South Africa vs Australia Men's TEST series 2026 — Australia tour of South Africa, 3 Tests.
//   1st Test   9–13 Oct 2026  Kingsmead, Durban
//   2nd Test  18–22 Oct 2026  St George's Park, Gqeberha
//   3rd Test  27–31 Oct 2026  Newlands, Cape Town
// Part of the 2025–27 ICC World Test Championship. Bavuma captains SA, Cummins captains AUS.
//
// Second red-ball tour. Same TEST BILATERAL archetype as ENG v PAK (see CLAUDE.md and
// eng-vs-pak-test-2026.ts): red-ball form only, D11 Test FPS per innings, XI = 3 / bench = 1,
// k=3 innings shrinkage to the measured role prior. Registered in test-tours.ts.
//
// IDENTITY: every csid was read out of cricsheet's per-match registry for South Africa and
// Australia men's Tests (2019+), team-scoped. The three uncapped players were anchored from
// people.csv by cricinfo id, because a name lookup is unsafe for all three:
//   * Marques Ackerman = MJ Ackerman `6287d981` (cricinfo 596436). "Ackerman" also matches
//     CN Ackermann (Netherlands, 276 perfs — the most-matches tie-break picks HIM) and
//     HD/C Ackerman; the DB also carries ~8 statless "Marques Ackerman" LPL stub rows.
//   * Sam Harper = SB Harper `a756e61a` (cricinfo 772361). Same ~8 statless LPL stubs.
//   * Nic Maddinson = NJ Maddinson `44afbf2d` (3 Tests in 2018 — outside the 60mo window, so he
//     prices on the prior).
//
// XI ORDER (1–11 = probable 1st-Test XI in batting order, 12+ = bench) and `matches` come from a
// deep-research pass on 7 Oct across SA and AUS beat reporting (Times Live / Business Day / IOL,
// cricket.com.au / ABC / SEN, the Potchefstroom warm-up scorecard). Where the Yahoo prediction
// conflicted with the SA beat reporters (Rickelton keeping, Ackerman at 3, no Verreynne) the beat
// reporters were followed. `matches` = expected Tests out of 3 — each side sums to ~33 (11 x 3).
// It applies only while the player stays on the SAME side of the XI line as seeded here; move him
// across it on the board and he falls back to XI=3 / bench=1 (see test-tours.ts).
// Wikipedia's series page is NOT a reliable source (it already "reports" a 2-1 result).

import type { TestTeam } from "./eng-vs-pak-test-2026";

export const SA_VS_AUS_TEST_2026_NAME = "South Africa vs Australia Men's Test 2026";

export const SA_VS_AUS_TEST_2026: TestTeam[] = [
  {
    name: "South Africa", short: "SA", country: "South Africa", color: "#007749",
    // Twin-spin template for a dry Durban: Verreynne keeps at 6 with five batters, Mulder and
    // Ackerman miss out. Seamier Gqeberha/Newlands put Harmer at risk (Mulder / 3rd seamer in).
    players: [
      { name: "Aiden Markram", csid: "6a26221c", role: "BAT", matches: 2.95 },      // 1
      { name: "Ryan Rickelton", csid: "e66732f8", role: "WK", matches: 2.75,         // 2
        note: "Opens (de Zorzi injured); not keeping - Verreynne has the gloves." },
      { name: "David Bedingham", csid: "a1b69936", role: "BAT", matches: 2.2,        // 3
        note: "No. 3 for now; at risk when de Zorzi returns or if Mulder plays." },
      { name: "Temba Bavuma", csid: "9ffd1ac1", role: "BAT", matches: 2.85 },        // 4  captain
      { name: "Tristan Stubbs", csid: "85b3fab2", role: "BAT", matches: 2.9 },       // 5
      { name: "Kyle Verreynne", csid: "bf814547", role: "WK", matches: 2.4,          // 6
        note: "Keeper with 'first bite' (Times Live 6 Oct) but publicly under pressure." },
      { name: "Marco Jansen", csid: "81c36ee9", role: "AR", matches: 2.9 },          // 7
      { name: "Keshav Maharaj", csid: "0b60eb09", role: "BOWL", matches: 2.85 },     // 8
      { name: "Simon Harmer", csid: "23638956", role: "BOWL", matches: 2.2,          // 9
        note: "Twin spin likely in Durban; less certain on seamier Gqeberha/Newlands pitches." },
      { name: "Kagiso Rabada", csid: "e62dd25d", role: "BOWL", matches: 2.2,         // 10
        note: "DOUBT: hamstring, no match since May. ~55% for Durban (call on Friday morning), ~85% per later Test." },
      { name: "Anrich Nortje", csid: "acdc62f5", role: "BOWL", matches: 1.7,         // 11
        note: "Recalled for pace, not guaranteed; first Test since Mar 2023, workload risk." },
      { name: "Tony de Zorzi", csid: "d3a1c63d", role: "BAT", matches: 1.4,          // 12
        note: "OUT of the 1st Test (mild hamstring strain); likely back for Test 2 or 3, would open." },
      { name: "Gerald Coetzee", csid: "3204c99f", role: "BOWL", matches: 1.2,        // 13
        note: "Plays if Rabada misses; first seam cover." },
      { name: "Wiaan Mulder", csid: "c96f6ac5", role: "AR", matches: 1.0,            // 14
        note: "Likely left out for twin spin in Durban; returns if conditions get seamier." },
      { name: "Marques Ackerman", csid: "6287d981", role: "BAT", matches: 0.7,       // 15
        note: "UNCAPPED (SA A captain). Misses out on the Verreynne + five-batter template; no FC data on cricsheet, priced on the role prior." },
      { name: "Corbin Bosch", csid: "172dff15", role: "AR", matches: 0.4 },          // 16
      { name: "Dane Paterson", csid: "462d7c62", role: "BOWL", matches: 0.3 },       // 17
      { name: "Senuran Muthusamy", csid: "7dfb8890", role: "AR", matches: 0.2 },     // 18
    ],
  },
  {
    name: "Australia", short: "AUS", country: "Australia", color: "#FFCD00",
    // Same XI as the Potchefstroom warm-up (3-4 Oct) and the last Test v Bangladesh minus Green.
    players: [
      { name: "Travis Head", csid: "12b610c2", role: "BAT", matches: 2.95 },         // 1
      { name: "Matt Renshaw", csid: "218d4d78", role: "BAT", matches: 2.8 },         // 2  Head's partner since Aug
      { name: "Marnus Labuschagne", csid: "fa433be6", role: "BAT", matches: 2.9 },   // 3  111 in the warm-up
      { name: "Steve Smith", csid: "30a45b23", role: "BAT", matches: 2.95 },         // 4  vice-captain
      { name: "Beau Webster", csid: "56b93d46", role: "AR", matches: 2.7,            // 5
        note: "4th seamer - needed more with Green unable to bowl this series." },
      { name: "Alex Carey", csid: "69d03465", role: "WK", matches: 2.95 },           // 6
      { name: "Cooper Connolly", csid: "fe366f34", role: "AR", matches: 2.0,         // 7
        note: "In for Green (2nd Test cap); Green's return as a batter likely displaces him." },
      { name: "Pat Cummins", csid: "ded9240e", role: "BOWL", matches: 2.9 },         // 8  captain
      { name: "Mitchell Starc", csid: "3fb19989", role: "BOWL", matches: 2.7 },      // 9
      { name: "Nathan Lyon", csid: "96a6a7ad", role: "BOWL", matches: 2.95 },        // 10
      { name: "Josh Hazlewood", csid: "03806cf8", role: "BOWL", matches: 2.6,        // 11
        note: "Small rotation risk with Boland." },
      { name: "Cameron Green", csid: "eaa76d3c", role: "AR", matches: 1.0,           // 12
        note: "OUT of the 1st Test (abdominal strain). Bowling 'highly unlikely' all series (McDonald); may return as a batter for Test 2 or 3." },
      { name: "Scott Boland", csid: "d167edd3", role: "BOWL", matches: 0.7 },        // 13
      { name: "Nic Maddinson", csid: "44afbf2d", role: "BAT", matches: 0.3 },        // 14
      { name: "Matthew Kuhnemann", csid: "7b953689", role: "BOWL", matches: 0.2 },   // 15
      { name: "Michael Neser", csid: "0164b064", role: "BOWL", matches: 0.15 },      // 16
      { name: "Josh Inglis", csid: "989889ff", role: "WK", matches: 0.1,             // 17
        note: "Fractured finger - OUT of the 1st Test, possibly available from the 2nd; not projected in the XI." },
      { name: "Sam Harper", csid: "a756e61a", role: "WK", matches: 0.05,             // 18
        note: "UNCAPPED backup keeper (added as Inglis cover)." },
    ],
  },
];

// Every scheduled ground, with each spelling cricsheet uses. Listed explicitly: a loose
// "%St George's%" also catches the National Cricket Stadium, St George's (GRENADA).
export const SA_AUS_TEST_VENUES: { canonical: string; variants: string[] }[] = [
  { canonical: "Kingsmead, Durban", variants: ["Kingsmead", "Kingsmead, Durban"] },
  {
    canonical: "St George's Park, Gqeberha",
    variants: ["St George's Park", "St George's Park, Gqeberha", "St George's Park, Port Elizabeth"],
  },
  { canonical: "Newlands, Cape Town", variants: ["Newlands", "Newlands, Cape Town"] },
];
