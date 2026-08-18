// England vs Pakistan Men's TEST series 2026 — Pakistan tour of England, 3 Tests.
//   1st Test  19–23 Aug 2026  Headingley, Leeds        (ESPN scorecard 1496582)
//   2nd Test  27–31 Aug 2026  Lord's, London
//   3rd Test   9–13 Sep 2026  Edgbaston, Birmingham
// Part of the 2025–27 ICC World Test Championship. Root captains England, Babar captains Pakistan.
//
// FIRST RED-BALL TOUR IN THE APP. Archetype: TEST BILATERAL — see CLAUDE.md. What differs from the
// T20I/ODI bilaterals:
//   * Form is scored on RED BALL ONLY ('TEST'). White-ball form is deliberately NOT blended in: a
//     T20 gun who cannot bat 90 overs is not a Test asset. First-class ('FC' — County Championship
//     + Sheffield Shield) is ingested for DISPLAY only and sits in no quality list, because
//     Pakistan's Quaid-e-Azam Trophy is not published by cricsheet and counting FC form would
//     systematically favour England's fringe over Pakistan's.
//   * Fantasy points are Dream11's TEST FPS, scored PER INNINGS and summed
//     (data/etl_cricsheet.py :: compute_fantasy_points_test). Test FP run 2–3x the T20 scale.
//   * Expected matches: XI = 3 (Test XIs are stable), bench = 1 — NOT the T20 bench of 2.
//
// ⚠️ IDENTITY: every player is anchored on an explicit `csid` (cricsheet identifier), verified
// against cricsheet's own per-match registry scoped to the England/Pakistan Test XIs. There is NO
// fuzzy fallback in build-test-pool.ts, deliberately — this squad list is unusually hostile to
// name matching and a fuzzy pass silently grabbed the wrong record on three of them:
//   * "Khurram Shahzad" is TWO different men. `27c5715d` (cricinfo 1159495) is the Pakistan Test
//     seamer in this squad; `1daf3f74` (cricinfo 681351) is a PSL/Blast namesake with 3x more
//     appearances — so "pick the record with the most matches" resolves to the WRONG player.
//   * "Emilio Gay" fuzzy-matches CH Gayle (548 appearances) and RS Gayakwad.
//   * "Shoaib Bashir" fuzzy-matches Manan Bashir / Faisal Mubashir.
//   * "Ollie Robinson" is ambiguous between OE Robinson (this Test bowler) and OG Robinson (the
//     Kent keeper). "Awais Zafar" sits beside Ayesha Zafar, a woman.
// See CLAUDE.md "Player identity / name-matching" — anchor on the stable id, never the name.

export type Role = "BAT" | "BOWL" | "AR" | "WK";

export interface TestSquadPlayer {
  name: string;
  /** cricsheet identifier — the anchor. Verified from cricsheet's own match registry. */
  csid: string;
  role: Role;
  note?: string;
}

export interface TestTeam {
  name: string;
  short: string;
  country: string;
  color: string;
  players: TestSquadPlayer[];
}

export const ENG_VS_PAK_TEST_2026_NAME = "England vs Pakistan Men's Test 2026";
export const TEST_XI_SIZE = 11;
export const TEST_MATCH_COUNT = 3;

// Announced squads: England 15 (ECB, 6 Aug — named for the FIRST TWO Tests only, so a 3rd-Test
// squad change is likely; add additively via the teamsFilter path, never by rebuilding the pool).
// Pakistan 17 (PCB, 5 Jul; Abdullah Fazal ruled out 24 Jul with a back injury, replaced by
// Abdullah Shafique).
//
// XI ORDER (1–11 = probable XI in batting order, 12+ = bench) is a SEED for the user to edit on the
// board — squad_number drives expected matches, so it is worth a pass by feel before valuing.
// It is not guessed: both XIs are derived from each side's most recent actual Test XI and batting
// order, read out of the ball-by-ball data, with forced substitutions where a player is not in this
// squad. Deviations are noted per player.
export const ENG_VS_PAK_TEST_2026: TestTeam[] = [
  {
    name: "England", short: "ENG", country: "England", color: "#012169",
    // Baseline = England's XI and batting order v New Zealand at Trent Bridge, 25 Jun 2026.
    // Two of that XI are not in this squad, so two slots are filled:
    //   #3 JG Bethell -> Ollie Pope (his established position)
    //   #7 BA Stokes  -> Brydon Carse (the closest like-for-like: seam-bowling all-rounder)
    players: [
      { name: "Ben Duckett", csid: "5f26f677", role: "BAT" },        // 1
      { name: "Emilio Gay", csid: "aa710a58", role: "BAT" },         // 2  3 Tests — thin sample, heavy county record
      { name: "Ollie Pope", csid: "e94bc520", role: "BAT" },         // 3  replaces Bethell (not in squad)
      { name: "Joe Root", csid: "a343262c", role: "BAT" },           // 4  captain (armband only — no pricing effect)
      { name: "Harry Brook", csid: "4ae1755b", role: "BAT" },        // 5  vice-captain
      { name: "Jamie Smith", csid: "c834c290", role: "WK" },         // 6
      { name: "Brydon Carse", csid: "cad40f5e", role: "AR" },        // 7  replaces Stokes (not in squad)
      { name: "Gus Atkinson", csid: "70d57519", role: "BOWL" },      // 8
      { name: "Jofra Archer", csid: "5574750c", role: "BOWL" },      // 9
      { name: "Josh Tongue", csid: "1f1b4c89", role: "BOWL" },       // 10
      { name: "Shoaib Bashir", csid: "e36e9dd3", role: "BOWL" },     // 11 frontline spinner
      { name: "Dan Lawrence", csid: "4b685e2d", role: "BAT" },       // 12 last Test Sep 2024; 123 FC innings
      { name: "Jordan Cox", csid: "ff154ecd", role: "WK" },          // 13 backup keeper, 1 Test
      { name: "Ollie Robinson", csid: "0f3ee070", role: "BOWL" },    // 14 OE Robinson — NOT OG Robinson (Kent WK)
      { name: "Matthew Fisher", csid: "8f2dfebf", role: "BOWL" },    // 15 2 Tests — thin sample
    ],
  },
  {
    name: "Pakistan", short: "PAK", country: "Pakistan", color: "#01411C",
    // Pakistan named SEPARATE squads for the West Indies and England tours, so the most recent XI
    // (v WI, 2 Aug 2026) is not a clean baseline — six of this squad did not tour the Caribbean.
    // XI here = appearance-weighted across Pakistan's last 6 Tests (Oct 2025 – Aug 2026) restricted
    // to this squad: Agha Salman and Rizwan 6/6; Babar, Imam, Masood 5/6; Azan Awais, Sajid,
    // Shakeel 4/6; Abbas, Shafique 3/6. Masood and Shakeel were rested for the last Test, not
    // dropped, so both are restored to the XI for a full-strength England tour.
    players: [
      { name: "Abdullah Shafique", csid: "fc2fffb5", role: "BAT" },  // 1
      { name: "Imam-ul-Haq", csid: "40c041ea", role: "BAT" },        // 2
      { name: "Shan Masood", csid: "6843a783", role: "BAT" },        // 3  rested v WI, not dropped
      { name: "Babar Azam", csid: "8a75e999", role: "BAT" },         // 4  captain
      { name: "Saud Shakeel", csid: "d07c1b2f", role: "BAT" },       // 5  rested v WI, not dropped
      { name: "Mohammad Rizwan", csid: "2f26ac1a", role: "WK" },     // 6
      { name: "Salman Ali Agha", csid: "89c16049", role: "AR" },     // 7  DB spelling is "Agha Salman"
      { name: "Sajid Khan", csid: "bbc192a4", role: "BOWL" },        // 8  frontline spinner
      { name: "Mohammad Abbas", csid: "a089f93f", role: "BOWL" },    // 9  swing specialist — 76 FC innings
      { name: "Ali Usman", csid: "bb194908", role: "BOWL" },         // 10 6 wickets v WI on debut tour; 2 Tests
      { name: "Khurram Shahzad", csid: "27c5715d", role: "BOWL" },   // 11 THE TEST SEAMER — see identity note
      { name: "Azan Awais", csid: "89f1d2d6", role: "BAT" },         // 12 played the last 4 Tests — XI candidate
      { name: "Awais Zafar", csid: "dbb23cba", role: "BAT" },        // 13 1 Test — thin sample
      { name: "Aamir Jamal", csid: "a8e54ef4", role: "AR" },         // 14 DB spelling is "Aamer Jamal"
      { name: "Mohammad Ali", csid: "a86a37ab", role: "BOWL" },      // 15
      { name: "Ubaid Shah", csid: "cc535250", role: "BOWL" },        // 16 1 Test — thin sample
      { name: "Ghazi Ghori", csid: "28b61a48", role: "WK" },         // 17 UNCAPPED in red ball — no TEST/FC data at all
    ],
  },
];

// The three scheduled grounds. Venue adjustments were removed from the valuation engine on
// 5 Aug 2026 (measured elasticity ~2%, not worth the machinery), so these do NOT move a price —
// they scope the informational bat-index panel. `variants` covers cricsheet's ~2021 ground renames
// so a ground's full red-ball history is counted rather than silently truncated.
export const ENG_PAK_TEST_VENUES: { canonical: string; variants: string[] }[] = [
  { canonical: "Headingley, Leeds", variants: ["Headingley", "Headingley, Leeds"] },
  { canonical: "Lord's, London", variants: ["Lord's", "Lord's, London"] },
  { canonical: "Edgbaston, Birmingham", variants: ["Edgbaston", "Edgbaston, Birmingham"] },
];

// XI (1–11) plays all 3 Tests; bench (12+) ~1. Test XIs are far more stable than a T20 side's —
// there are no dead rubbers to experiment in, so a bench Test is an injury or a pace rotation,
// not routine. This is why bench is 1 and not the T20 bilateral's 2.
export function testExpectedMatches(squadNumber: number): number {
  return squadNumber >= 1 && squadNumber <= TEST_XI_SIZE ? TEST_MATCH_COUNT : 1;
}
