// India vs West Indies Men's T20I 2026 — 5-match bilateral T20I series in India (6–17 Oct 2026).
// Archetype: BILATERAL (same as IND v ENG T20 2026 — 60/40 recency, XI=5 / bench=2) with ONE
// widening in the engine: CPL joins the quality set (a West Indian's franchise record IS the CPL).
//
// Fixtures (cricapi series 702ce6cb-a551-4aab-961e-0ed1548a3c74, ESPN 1529215), all 19:00 IST:
//   1. Tue 6 Oct  — Ekana, Lucknow
//   2. Fri 9 Oct  — JSCA, Ranchi
//   3. Sun 11 Oct — Holkar, Indore
//   4. Wed 14 Oct — Rajiv Gandhi Intl, Hyderabad
//   5. Sat 17 Oct — M. Chinnaswamy, Bengaluru
//
// Players ordered as the MEDIA-CONSENSUS probable XI (1–11, batting order) then bench (12+)
// -> squad_number. Seeded 5 Oct 2026 from pre-1st-T20I predictions (Aakash Chopra / IPL.com) —
// worth a manual pass, since the 5x/2x XI/bench split does most of the pricing work.

import type { BilateralTeam, Role } from "./ind-vs-eng-t20-2026";

export const IND_VS_WI_T20_2026_NAME = "India vs West Indies Men's T20I 2026";
export const IND_WI_XI_SIZE = 11;

export type { BilateralTeam, Role };

export const IND_VS_WI_T20_2026: BilateralTeam[] = [
  {
    name: "India", short: "IND", country: "India", color: "#1A75CF",
    players: [
      { name: "Abhishek Sharma", role: "AR" },          // 1
      { name: "Sanju Samson", role: "WK" },              // 2
      { name: "Ishan Kishan", role: "WK" },              // 3
      { name: "Shreyas Iyer", role: "BAT" },             // 4  (C)
      { name: "Tilak Varma", role: "BAT" },              // 5  (VC)
      { name: "Shivam Dube", role: "AR" },               // 6
      { name: "Nitish Kumar Reddy", role: "AR" },        // 7
      { name: "Axar Patel", role: "AR" },                // 8
      { name: "Kuldeep Yadav", role: "BOWL" },           // 9
      { name: "Arshdeep Singh", role: "BOWL" },          // 10
      { name: "Prince Yadav", role: "BOWL", note: "11th spot is a coin-flip with Mayank Yadav." }, // 11
      { name: "Mayank Yadav", role: "BOWL", note: "Contests the 11th spot with Prince Yadav." },    // 12
      { name: "Vaibhav Sooryavanshi", role: "BAT", note: "Outlook's XI opens with him over Samson — one selection call away from the XI." }, // 13
      { name: "Ravi Bishnoi", role: "BOWL", note: "Some predictions pick him over Nitish Kumar Reddy." }, // 14
      { name: "Naman Dhir", role: "AR", note: "Replaced Washington Sundar (1 Oct). Uncapped in T20Is; priced off IPL form." }, // 15
    ],
  },
  {
    name: "West Indies", short: "WI", country: "West Indies", color: "#7B0041",
    players: [
      { name: "Shai Hope", role: "WK" },                 // 1  (C)
      { name: "Kamil Pooran", role: "BAT", note: "Maiden T20I call-up off a strong CPL; only 3 CPL games in our data — thin sample." }, // 2
      { name: "Roston Chase", role: "AR" },              // 3
      { name: "Shimron Hetmyer", role: "BAT" },          // 4
      { name: "Rovman Powell", role: "BAT" },            // 5
      { name: "Sherfane Rutherford", role: "BAT" },      // 6
      { name: "Romario Shepherd", role: "AR" },          // 7
      { name: "Matthew Forde", role: "BOWL" },           // 8
      { name: "Akeal Hosein", role: "BOWL" },            // 9
      { name: "Gudakesh Motie", role: "BOWL" },          // 10
      { name: "Shamar Joseph", role: "BOWL" },           // 11
      { name: "Amir Jangoo", role: "WK", note: "Cover for Jewel Andrew; 239 runs in the ODIs — could open ahead of Pooran/Chase." }, // 12
      { name: "Keemo Paul", role: "AR" },                // 13
      { name: "Quentin Sampson", role: "BAT" },          // 14
      { name: "Shamar Springer", role: "AR" },           // 15
      { name: "Jewel Andrew", role: "WK", note: "Finger injury in the 3rd ODI (no fracture) — under observation." }, // 16
    ],
  },
];

// Exact announced name -> cricsheet_id, hand-verified 5 Oct 2026 against match_performances.
// India ids are the ones verified for the Sep twin-T20 pool (ENG_SL_IND_AFG_CSID). Fuzzy matching
// is hazardous here: two Pooran rows (Nicholas/Kamil), two Andrew rows, five Joseph/Smith variants.
export const IND_WI_CSID: Record<string, string> = {
  // — India —
  "Abhishek Sharma": "f29185a1",     // NOT RG Sharma
  "Sanju Samson": "a4cc73aa",        // SV Samson
  "Ishan Kishan": "752f7486",
  "Shreyas Iyer": "85ec8e33",        // SS Iyer — NOT VR Iyer
  "Tilak Varma": "b0482a1d",
  "Shivam Dube": "a4e37e47",
  "Nitish Kumar Reddy": "aad0c365",  // filed as "Nithish Kumar Reddy"
  "Axar Patel": "2e171977",          // AR Patel
  "Kuldeep Yadav": "8d2c70ad",       // NOT plain "Kuldeep" / Kuldeep Gurjar / K Yadav
  "Arshdeep Singh": "244048f6",
  "Prince Yadav": "80b2fb19",
  "Mayank Yadav": "b1ad996b",        // MP Yadav (LSG quick)
  "Vaibhav Sooryavanshi": "470f446b", // V Suryavanshi
  "Ravi Bishnoi": "df064e1a",        // NOT "R Bishnoi"
  "Naman Dhir": "fffa744b",
  // — West Indies —
  "Shai Hope": "1fc6ef83",           // SD Hope
  "Kamil Pooran": "d83c2dbe",        // K Pooran — NOT N Pooran (Nicholas)
  "Roston Chase": "3feda4fa",        // RL Chase
  "Shimron Hetmyer": "48a1d7b7",     // SO Hetmyer
  "Rovman Powell": "650d5e49",       // R Powell
  "Sherfane Rutherford": "d014d5ac", // SE Rutherford
  "Romario Shepherd": "c5aef772",    // R Shepherd
  "Matthew Forde": "83d17bbc",       // MW Forde
  "Akeal Hosein": "4d7f517e",        // AJ Hosein
  "Gudakesh Motie": "97bdec3d",      // G Motie
  "Shamar Joseph": "97290faf",       // S Joseph — NOT AS Joseph (Alzarri)
  "Amir Jangoo": "88626ed2",         // AA Jangoo
  "Keemo Paul": "75224f22",          // KMA Paul
  "Quentin Sampson": "238ce998",     // Q Sampson
  "Shamar Springer": "4175d211",     // SK Springer
  "Jewel Andrew": "6b0db726",        // J Andrew — NOT GM Andrew (Gareth, English county)
};

// Candidate formats for the matcher — CPL is load-bearing for the WI half (Pooran/Sampson are CPL-only).
export const IND_WI_MATCH_FORMATS = ["T20", "IPL", "CPL", "ODI"];

// XI (1–11) plays all 5; bench (12+) ~2 (5-match series rotates / dead-rubber experiments).
export function indWiExpectedMatches(squadNumber: number): number {
  return squadNumber >= 1 && squadNumber <= IND_WI_XI_SIZE ? 5 : 2;
}
