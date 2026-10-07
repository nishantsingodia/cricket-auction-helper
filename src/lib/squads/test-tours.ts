// Registry of red-ball (TEST bilateral) tours. Every Test code path — /api/pool/fetch, the
// valuation engine, the venue header — resolves its tour HERE by tournament name, so adding a
// Test series is: write a squad file, add one entry below, add the home-page option.
// The archetype itself (scoring, windows, shrinkage) is documented in CLAUDE.md.

import {
  ENG_VS_PAK_TEST_2026,
  ENG_VS_PAK_TEST_2026_NAME,
  ENG_PAK_TEST_VENUES,
  testExpectedMatches,
  TEST_XI_SIZE,
  type TestTeam,
} from "./eng-vs-pak-test-2026";
import {
  SA_VS_AUS_TEST_2026,
  SA_VS_AUS_TEST_2026_NAME,
  SA_AUS_TEST_VENUES,
} from "./sa-vs-aus-test-2026";

export interface TestTour {
  name: string;
  teams: TestTeam[];
  venues: { canonical: string; variants: string[] }[];
  /** Shrink thin-Test players toward their own FC form instead of the role prior (engine.ts). */
  fcPrior?: boolean;
}

export const TEST_TOURS: TestTour[] = [
  { name: ENG_VS_PAK_TEST_2026_NAME, teams: ENG_VS_PAK_TEST_2026, venues: ENG_PAK_TEST_VENUES },
  // ENG v PAK keeps the role prior (settled; FC was display-only by choice). SA v AUS opts in.
  { name: SA_VS_AUS_TEST_2026_NAME, teams: SA_VS_AUS_TEST_2026, venues: SA_AUS_TEST_VENUES, fcPrior: true },
];

export function getTestTour(name: string | null | undefined): TestTour | null {
  return TEST_TOURS.find((t) => t.name === name) ?? null;
}

// XI=3 / bench=1 by squad_number, unless the squad file sets `matches` (researched expected Tests).
// The override holds only while the player sits on the SAME side of the XI line as his seeded slot:
// drag a seeded bench player into the XI on the board (or vice versa) and the 3/1 rule takes over,
// so the board's reorder lever keeps working. Keyed on cricsheet id, never the DB name.
export function testExpectedMatchesFor(
  tour: TestTour,
  csid: string | null,
  squadNumber: number
): number {
  if (csid) {
    for (const team of tour.teams) {
      const idx = team.players.findIndex((p) => p.csid === csid);
      if (idx < 0) continue;
      const sp = team.players[idx];
      const seededXI = idx + 1 <= TEST_XI_SIZE;
      const nowXI = squadNumber >= 1 && squadNumber <= TEST_XI_SIZE;
      if (sp.matches != null && seededXI === nowXI) return sp.matches;
      break;
    }
  }
  return testExpectedMatches(squadNumber);
}
