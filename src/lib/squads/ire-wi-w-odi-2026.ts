// Ireland Women vs West Indies Women — ODI series (3 matches: 10, 12, 15 Jul 2026, Bready CC).
// Archetype: WOMENS ODI BILATERAL. First ODI-format tour in the app.
//
// Players ordered as the probable XI (1–11, batting order) then bench (12–14) -> squad_number.
// XI = 3 expected matches (plays every ODI); bench = 1 (a 3-match series barely rotates).
// No franchise league season and women's ODI venue data is too sparse to classify, so the
// valuation: venue factor = 1.0; Score 1 = 60% last-10 ODIs + 40% all women's ODIs (36mo);
// quality = ALL women's ODIs (no opposition gate). See engine.ts isWomensOdi branch.

export type Role = "BAT" | "BOWL" | "AR" | "WK";

export interface OdiSquadPlayer {
  name: string;
  role: Role;
  note?: string;
}

export interface OdiTeam {
  name: string;
  short: string;
  country: string; // matches players.country for capped players (match is by cricsheet_id, not country)
  color: string;
  players: OdiSquadPlayer[];
}

export const IRE_VS_WI_W_ODI_2026_NAME = "Ireland vs West Indies Women's ODI 2026";
export const ODI_XI_SIZE = 11;

// Squads verified for availability 10 Jul 2026 (RTÉ / Cricket Ireland / Windies Cricket / crex):
//   - IRE: Arlene Kelly ruled OUT injured → Georgina Dempsey called in (injury cover → bench, not
//     in the probable XI). Laura Delany & Ava Canning also OUT injured (correctly not in squad).
//   - WI: 15-player squad; Chinelle Henry OUT injured → Realeanna Grimmond in. Incl. Jannillea Glasgow.
// Order = probable XI (1–11) then bench (12+). Captain/VC are armband-only (no pricing effect);
// C/VC premium is anchored on EFPPM rank, not the armband.
export const IRE_VS_WI_W_ODI_2026: OdiTeam[] = [
  {
    name: "Ireland Women", short: "IRE", country: "Ireland", color: "#169B62",
    players: [
      { name: "Gaby Lewis", role: "BAT" },            // 1  (captain)
      { name: "Sarah Forbes", role: "BAT" },           // 2
      { name: "Amy Hunter", role: "WK" },              // 3
      { name: "Orla Prendergast", role: "AR" },        // 4  (vice-captain)
      { name: "Leah Paul", role: "AR" },               // 5
      { name: "Rebecca Stokell", role: "BAT" },        // 6
      { name: "Aimee Maguire", role: "BOWL" },         // 7  (fit; WC joint-top wicket-taker)
      { name: "Cara Murray", role: "BOWL" },           // 8
      { name: "Jane Maguire", role: "BOWL" },          // 9
      { name: "Louise Little", role: "BOWL" },         // 10
      { name: "Alana Dalzell", role: "BOWL" },         // 11  (CONFIRMED in 1st-ODI XI)
      { name: "Kia McCartney", role: "AR" },           // 12  (bench — omitted from 1st-ODI XI)
      { name: "Christina Coulter Reilly", role: "WK" },// 13  (bench)
      { name: "Georgina Dempsey", role: "BOWL", note: "Injury cover for Arlene Kelly." }, // 14
    ],
  },
  {
    name: "West Indies Women", short: "WI", country: "West Indies", color: "#7B0041",
    players: [
      { name: "Hayley Matthews", role: "AR" },         // 1  (captain)
      { name: "Qiana Joseph", role: "AR" },            // 2
      { name: "Shemaine Campbelle", role: "WK" },      // 3
      { name: "Stafanie Taylor", role: "AR" },         // 4
      { name: "Deandra Dottin", role: "AR" },          // 5
      { name: "Zaida James", role: "AR" },             // 6
      { name: "Shawnisha Hector", role: "BAT" },       // 7  (CONFIRMED in 1st-ODI XI)
      { name: "Aaliyah Alleyne", role: "BOWL" },       // 8
      { name: "Afy Fletcher", role: "BOWL" },          // 9
      { name: "Karishma Ramharack", role: "BOWL" },    // 10
      { name: "Ashmini Munisar", role: "BOWL" },       // 11
      { name: "Realeanna Grimmond", role: "AR" },      // 12  (bench — omitted from 1st-ODI XI; in for injured Chinelle Henry)
      { name: "Jannillea Glasgow", role: "AR" },       // 13  (bench)
      { name: "Mandy Mangru", role: "WK" },            // 14  (bench)
      { name: "Jahzara Claxton", role: "BOWL" },       // 15  (bench)
    ],
  },
];

// Fallback exact-spelling aliases for players whose registry pid isn't a cricsheet_id (so the
// registry-first cricsheet_id match can't fire). Left mostly empty — women's ODI players are
// well-covered by the global registry; add a "<announced normName>": "<exact DB spelling>" row
// only for the handful the pool build reports unmatched.
export const IRE_WI_W_ODI_NAME_ALIASES: Record<string, string> = {};

// XI (1–11) plays all 3 ODIs; bench (12–14) ~1 (a 3-match series barely rotates).
export function odiExpectedMatches(squadNumber: number): number {
  return squadNumber >= 1 && squadNumber <= ODI_XI_SIZE ? 3 : 1;
}
