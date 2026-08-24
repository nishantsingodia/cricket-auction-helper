// European T20 Premier League (ETPL) 2026 — the INAUGURAL season (26 Aug – 20 Sep 2026).
// 6 franchises across the Netherlands (2), Scotland (2), Ireland (1) and Northern Ireland (1).
// Double round-robin: 30 league games, each team plays 10. Playoffs: 1st goes straight to the
// Final, 2nd v 3rd in a Qualifier, Qualifier winner meets 1st. 34 matches in all.
//
// Only TWO venues. The published fixture list (30 league games) splits them 17 / 13, not 15 / 15:
//   * Sportpark Westvliet, Voorburg (NED)   — matches 1–17,  26 Aug – 6 Sep
//   * The Village, Malahide (IRL)           — matches 18–30, 9–17 Sep, + both playoffs
// Per-team split, counted off the fixture list: AMS 6/4 · ROT 6/4 · EDI 6/4 · GLA 6/4 · BEL 5/5 ·
// DUB 5/5. Every team plays exactly 10, and the widest venue skew between any two teams is ONE
// game — so a conditions factor still has essentially no relative signal, and Score2 stays at 1.0
// (see engine.ts). For bidding context only,
// measured off our own cricsheet FP (T20, 2021+): Voorburg bat/bowl FP ratio 0.86 (20 matches),
// Malahide 1.07 (10 matches) vs a global T20 baseline of 0.79 — i.e. BOTH grounds are batting-
// friendlier than the world norm, Malahide markedly so. Small samples; treat as a tilt, not a law.
//
// ── SQUAD & XI RULES (ETPL, official) ────────────────────────────────────────────────────────
// Squad = 17: 2 local direct signings + 6 local draft picks + min 8 local overall,
//             min 1 European Associate, 1–2 Global Associate, max 7 Full Member overseas.
// PLAYING XI: minimum 5 LOCAL, maximum 4 overseas from TEST-PLAYING nations.
//             Associate players count as LOCAL for selection purposes.
// "Local" = Netherlands / Scotland / Ireland (the host nations). So an Irish player does NOT
// count against the 4-overseas XI cap even though Ireland is a Full Member — and neither do
// Italy / UAE / USA / Canada / Namibia / Greece / Portugal / Samoa associates.
//
// => `overseas: true` here means "counts against the 4-man Test-nation XI cap", i.e. AUS, ENG,
//    NZ, RSA, IND (and would include PAK/SL/WI/BAN/ZIM/AFG if any were signed). Everyone else,
//    host-nation or associate, is `false`. Verified: every team's positions 1–11 below contain
//    EXACTLY 4 `overseas: true` players, so the sheet's own order is already a legal XI.
//
// The sheet tag column maps to: S = direct signing, R1–R6 = local draft round pick,
// Rep = replacement signing (for a withdrawal). Kept in `pick` for reference only — it does not
// feed valuation.
//
// Players are ordered as the PROBABLE XI (1–11) then depth (12+). squad_number drives expected
// matches, and the 4-overseas cap is enforced by ORDERING (no runtime rule) — surplus Test-nation
// overseas sit at 12+ where their value falls. Currently benched by that rule:
//   Rotterdam  – Anrich Nortje (16)     Belfast – Devon Conway (17)
//   Edinburgh  – Andrew Tye (17)        Glasgow – James Neesham (15)
//   Amsterdam  – David Payne (16), Ajinkya Rahane (17)
//
// SOURCE: the user's ETPL Season 01 squads sheet (gid 76780135), cross-checked against Wikipedia
// "2026 European T20 Premier League". Withdrawals already applied by the sheet's REPLACEMENTS
// block (Mitch Marsh, Dipendra Airee, Mitch Owen, Donovan Ferreira, Sandeep Lamichhane, Finn
// Allen, Kamindu Mendis, Gerhard Erasmus, Duan Jansen, Chris McBride, Charlie Tear, Khuzaima bin
// Tanveer are all OUT). Rotterdam (16) and Glasgow (15) still have unfilled replacement slots
// marked "xx" in the sheet — add them here when announced.
//
// Roles for the capped internationals are firm. Roles for the uncapped Dutch/Scottish/Irish draft
// picks are best-effort; they price near baseline anyway. Reorder squad_number in the auction panel
// to correct any XI.

// Published fixture list (double round-robin, 30 league games). Kept here because it is what turns
// a vague "joins late" into an exact number of games missed — see ETPL_EXPECTED_GAMES.
// Playoffs: Qualifier 19 Sep (2nd v 3rd), Final 20 Sep (1st v Qualifier winner).
export const ETPL_FIXTURES: Array<{ n: number; date: string; a: string; b: string; venue: "VOORBURG" | "MALAHIDE" }> = [
  { n: 1,  date: "2026-08-26", a: "ROT", b: "AMS", venue: "VOORBURG" },
  { n: 2,  date: "2026-08-27", a: "BEL", b: "DUB", venue: "VOORBURG" },
  { n: 3,  date: "2026-08-27", a: "EDI", b: "GLA", venue: "VOORBURG" },
  { n: 4,  date: "2026-08-28", a: "AMS", b: "EDI", venue: "VOORBURG" },
  { n: 5,  date: "2026-08-29", a: "GLA", b: "DUB", venue: "VOORBURG" },
  { n: 6,  date: "2026-08-29", a: "ROT", b: "BEL", venue: "VOORBURG" },
  { n: 7,  date: "2026-08-30", a: "AMS", b: "BEL", venue: "VOORBURG" },
  { n: 8,  date: "2026-08-30", a: "EDI", b: "DUB", venue: "VOORBURG" },
  { n: 9,  date: "2026-09-01", a: "GLA", b: "ROT", venue: "VOORBURG" },
  { n: 10, date: "2026-09-02", a: "DUB", b: "ROT", venue: "VOORBURG" },
  { n: 11, date: "2026-09-02", a: "BEL", b: "EDI", venue: "VOORBURG" },
  { n: 12, date: "2026-09-03", a: "AMS", b: "GLA", venue: "VOORBURG" },
  { n: 13, date: "2026-09-04", a: "GLA", b: "BEL", venue: "VOORBURG" },
  { n: 14, date: "2026-09-05", a: "ROT", b: "EDI", venue: "VOORBURG" },
  { n: 15, date: "2026-09-05", a: "DUB", b: "AMS", venue: "VOORBURG" },
  { n: 16, date: "2026-09-02", a: "GLA", b: "EDI", venue: "VOORBURG" },
  { n: 17, date: "2026-09-06", a: "AMS", b: "ROT", venue: "VOORBURG" },
  { n: 18, date: "2026-09-09", a: "DUB", b: "BEL", venue: "MALAHIDE" },
  { n: 19, date: "2026-09-10", a: "ROT", b: "GLA", venue: "MALAHIDE" },
  { n: 20, date: "2026-09-10", a: "BEL", b: "AMS", venue: "MALAHIDE" },
  { n: 21, date: "2026-09-11", a: "DUB", b: "EDI", venue: "MALAHIDE" },
  { n: 22, date: "2026-09-12", a: "BEL", b: "ROT", venue: "MALAHIDE" },
  { n: 23, date: "2026-09-12", a: "DUB", b: "GLA", venue: "MALAHIDE" },
  { n: 24, date: "2026-09-13", a: "EDI", b: "AMS", venue: "MALAHIDE" },
  { n: 25, date: "2026-09-13", a: "BEL", b: "GLA", venue: "MALAHIDE" },
  { n: 26, date: "2026-09-15", a: "AMS", b: "DUB", venue: "MALAHIDE" },
  { n: 27, date: "2026-09-15", a: "EDI", b: "ROT", venue: "MALAHIDE" },
  { n: 28, date: "2026-09-16", a: "GLA", b: "AMS", venue: "MALAHIDE" },
  { n: 29, date: "2026-09-17", a: "EDI", b: "BEL", venue: "MALAHIDE" },
  { n: 30, date: "2026-09-17", a: "ROT", b: "DUB", venue: "MALAHIDE" },
];

export type Role = "BAT" | "BOWL" | "AR" | "WK";

export interface ETPLSquadPlayer {
  name: string;
  role: Role;
  /** true = counts against the XI's 4-man Test-nation overseas cap. */
  overseas: boolean;
  /** Nationality as flagged in the source sheet (3-letter). Informational. */
  nat: string;
  /** Sheet tag: S = direct signing, R1–R6 = local draft round, Rep = replacement. */
  pick?: string;
  note?: string;
}

export interface ETPLTeam {
  name: string;
  short: string;
  color: string;
  coach: string;
  players: ETPLSquadPlayer[];
}

export const ETPL_XI_SIZE = 11;
export const ETPL_OVERSEAS_XI_CAP = 4;
export const ETPL_2026_NAME = "ETPL 2026";

export const ETPL_2026: ETPLTeam[] = [
  {
    name: "Amsterdam Flames", short: "AMS", color: "#F97316", coach: "Ryan Cook",
    players: [
      // 18 players (one over the nominal 17) after Mitch Marsh was reinstated on 24 Aug — the sheet's
      // REPLACEMENTS block still carries a stale "Marsh OUT -> Rahane IN" line, but Marsh is back in
      // the squad list AS CAPTAIN, so Rahane is an ADDITIONAL marquee, not his replacement. That is
      // also what Cricinfo/ESPN/cricket.com.au reported all along.
      //
      // XI — 4 Test-nation overseas: Smith, Marsh, David, Gleeson. Squad Test-nation overseas = 7
      // (those four plus Bracewell, Payne, Rahane) = EXACTLY the max-7 squad limit, so Amsterdam is
      // legal but completely maxed out. Fitting Marsh in cost MICHAEL BRACEWELL his XI place: he has
      // dropped from position 7 to 16. Kyle Klein also drops out of the XI (9 -> 12).
      { name: "Steve Smith", role: "BAT", overseas: true, nat: "AUS", pick: "S", note: "⚠️ AVAILABILITY: PLAYS 9 OF 10 — MISSES THE 26 AUG OPENER, JOINS LATE. Australia's 2nd Test v Bangladesh runs 22-26 Aug at Mackay and ETPL starts 26 Aug; Smith played the 1st Test (Darwin, 13 Aug, 209 FP) so he is in that squad. He cannot cross from Queensland to the Netherlands for the 26 Aug opener; Amsterdam's 2nd game is 28 Aug, which is reachable. Retired from ODIs in 2025, so the Zimbabwe ODIs (15-20 Sep) do not take him and he should be there for the Malahide half." },
      { name: "Mitch Marsh", role: "AR", overseas: true, nat: "AUS", pick: "S", note: "CAPTAIN, and reinstated on 24 Aug after appearing as a withdrawal earlier (the sheet's stale replacement line still says otherwise — ignore it). ⚠️ AVAILABILITY: PLAYS 9 OF 10 — misses the 26 Aug opener and joins late, per team news. Note he has NO tournament clash: he played the entire Hundred for Sunrisers Leeds (9 games to 14 Aug, ~92 avg FP with 158/133/129/100), which finished 16 Aug, so he is already in Europe and in excellent form. RESIDUAL RISK AT THE BACK END, unlike Smith: Marsh is Australia's T20 captain and an ODI regular, and Australia play ODIs v Zimbabwe 15-20 Sep — Amsterdam's last two games are 15 and 16 Sep. If he is picked for that, this becomes 7 of 10. Priced at 9; that risk is what you carry." },
      { name: "Max O'Dowd", role: "BAT", overseas: false, nat: "NED", pick: "R6" },
      { name: "Bas de Leede", role: "AR", overseas: false, nat: "NED", pick: "S" },
      { name: "Scott Edwards", role: "WK", overseas: false, nat: "NED", pick: "S" },
      { name: "Tim David", role: "BAT", overseas: true, nat: "AUS", pick: "S" },
      { name: "Curtis Campher", role: "AR", overseas: false, nat: "IRE", pick: "R1" },
      { name: "Aryan Dutt", role: "BOWL", overseas: false, nat: "NED", pick: "R4", note: "Promoted into the XI (12 -> 8) in the 24 Aug reshuffle." },
      { name: "Tim Pringle", role: "AR", overseas: false, nat: "NED", pick: "R3" },
      { name: "Richard Gleeson", role: "BOWL", overseas: true, nat: "ENG", pick: "S" },
      { name: "Ali Hasan", role: "AR", overseas: false, nat: "ITA", pick: "S", note: "Italy associate — counts as LOCAL for XI selection. Thin record (10 T20s in our data); role best-effort." },
      // Depth
      { name: "Kyle Klein", role: "BOWL", overseas: false, nat: "NED", pick: "R2", note: "DROPPED OUT OF THE XI (9 -> 12) in the 24 Aug Marsh reshuffle. A local seamer who was a first-choice pick two days ago, so he is a strong reorder candidate if the published XI differs." },
      { name: "Jordan Neill", role: "BOWL", overseas: false, nat: "IRE", pick: "R5", note: "No ball-by-ball record in our data — prices at his role prior." },
      { name: "David Rushmere", role: "BAT", overseas: false, nat: "NED", pick: "Rep", note: "Replacement for Dipendra Singh Airee (OUT). No ball-by-ball record in our data — prices at his role prior." },
      { name: "Yuvraj Samra", role: "BAT", overseas: false, nat: "CAN", pick: "S", note: "Canada = Global Associate, counts as LOCAL for XI selection." },
      { name: "Michael Bracewell", role: "AR", overseas: true, nat: "NZ", pick: "S", note: "🚨 THE BIGGEST PRICE MOVE OF THE 24 AUG UPDATE — DROPPED FROM XI POSITION 7 TO 16. Marsh's reinstatement gave Amsterdam a 5th Test-nation overseas player, and Bracewell is the one who lost out: Smith, Marsh, David and Gleeson hold the four legal slots. A 100-match international all-rounder who is now depth. He only plays if one of those four sits — which is live for the 26 Aug opener, when BOTH Smith and Marsh are absent. Worth a speculative bid at depth money, not an XI price." },
      { name: "David Payne", role: "BOWL", overseas: true, nat: "ENG", pick: "S", note: "SURPLUS OVERSEAS — 6th Test-nation player now. Priced as depth." },
      { name: "Ajinkya Rahane", role: "BAT", overseas: true, nat: "IND", pick: "Rep", note: "Signed as an ADDITIONAL marquee (Steve Waugh is co-owner), NOT as Marsh's replacement — the sheet's replacement line is stale. SURPLUS OVERSEAS — 7th Test-nation player, which is exactly Amsterdam's squad cap. Needs three of the front four to sit, so realistically he plays the 26 Aug opener (Smith and Marsh both out) and little else. Priced as depth." },
    ],
  },
  {
    name: "Rotterdam Dockers", short: "ROT", color: "#0EA5E9", coach: "Adrian Birrell",
    players: [
      // XI — 4 Test-nation overseas: du Plessis, Donald, Klaasen, McDermott.
      { name: "Faf du Plessis", role: "BAT", overseas: true, nat: "RSA", pick: "S", note: "CAPTAIN." },
      { name: "Aneurin Donald", role: "BAT", overseas: true, nat: "ENG", pick: "S", note: "Replacement for Mitchell Owen (OUT)." },
      { name: "Michael Levitt", role: "BAT", overseas: false, nat: "NED", pick: "R2" },
      { name: "Heinrich Klaasen", role: "WK", overseas: true, nat: "RSA", pick: "S" },
      { name: "Ben McDermott", role: "BAT", overseas: true, nat: "AUS", pick: "S", note: "Replacement for Donovan Ferreira (OUT). Also a keeper, but Klaasen holds the gloves." },
      { name: "Shubham Ranjane", role: "AR", overseas: false, nat: "USA", pick: "S", note: "USA = Global Associate, counts as LOCAL for XI selection." },
      { name: "Ben Manenti", role: "AR", overseas: false, nat: "ITA", pick: "S", note: "Italy associate — counts as LOCAL." },
      { name: "Logan van Beek", role: "AR", overseas: false, nat: "NED", pick: "S" },
      { name: "Roelof van der Merwe", role: "AR", overseas: false, nat: "NED", pick: "S" },
      { name: "Jai Moondra", role: "BOWL", overseas: false, nat: "IRE", pick: "R1" },
      { name: "Ryan Klein", role: "BOWL", overseas: false, nat: "NED", pick: "R3" },
      // Depth
      { name: "Jasper Davidson", role: "BAT", overseas: false, nat: "SCO", pick: "R4" },
      { name: "Saqib Zulfiqar", role: "AR", overseas: false, nat: "NED", pick: "R5" },
      { name: "Vikramjit Singh", role: "BAT", overseas: false, nat: "NED", pick: "R6" },
      { name: "David Wiese", role: "AR", overseas: false, nat: "NAM", pick: "S", note: "Namibia = Global Associate, counts as LOCAL — so he is a genuine XI option despite sitting 15th here. Reorder if you expect him in the first-choice side." },
      { name: "Anrich Nortje", role: "BOWL", overseas: true, nat: "RSA", pick: "S", note: "SURPLUS OVERSEAS — 5th Test-nation player, so he can only play if one of du Plessis/Donald/Klaasen/McDermott sits. Priced as depth." },
      // NOTE: Rotterdam are one short of 17 — the Sandeep Lamichhane (OUT) replacement is still
      // unannounced ("xx" in the sheet). Add here when named.
    ],
  },
  {
    name: "Belfast Wolves", short: "BEL", color: "#16A34A", coach: "Kevin O'Brien",
    players: [
      // XI — 4 Test-nation overseas: Chapman, Miller, Maxwell, Jordan.
      { name: "Paul Stirling", role: "BAT", overseas: false, nat: "IRE", pick: "R4" },
      { name: "Tim Tector", role: "BAT", overseas: false, nat: "IRE", pick: "R3", note: "Harry Tector's brother — thin record (8 T20s in our data). Do not confuse with Harry (Dublin)." },
      { name: "Mark Chapman", role: "BAT", overseas: true, nat: "NZ", pick: "S" },
      { name: "Lorcan Tucker", role: "WK", overseas: false, nat: "IRE", pick: "S" },
      { name: "David Miller", role: "BAT", overseas: true, nat: "RSA", pick: "S" },
      { name: "Glenn Maxwell", role: "AR", overseas: true, nat: "AUS", pick: "S", note: "CAPTAIN." },
      { name: "Chris Jordan", role: "BOWL", overseas: true, nat: "ENG", pick: "S" },
      { name: "Mark Adair", role: "BOWL", overseas: false, nat: "IRE", pick: "S" },
      { name: "Matthew Humphreys", role: "BOWL", overseas: false, nat: "IRE", pick: "R1" },
      { name: "Fred Klaassen", role: "BOWL", overseas: false, nat: "NED", pick: "R2" },
      { name: "Saurabh Netravalkar", role: "BOWL", overseas: false, nat: "USA", pick: "S", note: "🚨 AVAILABILITY: PLAYS ~2 OF 10, POSSIBLY ZERO. Not a squad-list guess — he has ALREADY PLAYED 3 CPL 2026 games (8-18 Aug, 78.0 avg FP). CPL's final is 20 Sep, the same day ETPL ends, so he only appears here if his franchise misses the playoffs and he flies over. Do not pay for a Belfast XI bowler." },
      // Depth
      { name: "Zainullah Ihsan", role: "AR", overseas: false, nat: "SCO", pick: "R5", note: "Thin record (2 T20s in our data) — prices near baseline." },
      { name: "Alexander Roy", role: "BAT", overseas: false, nat: "NED", pick: "R6", note: "No ball-by-ball record in our data — prices at baseline." },
      { name: "Gavin Hoey", role: "AR", overseas: false, nat: "IRE", pick: "S", note: "No ball-by-ball record in our data — prices at baseline." },
      { name: "Crishan Kalugamage", role: "BOWL", overseas: false, nat: "ITA", pick: "S" },
      { name: "Harry Manenti", role: "AR", overseas: false, nat: "ITA", pick: "S" },
      { name: "Devon Conway", role: "BAT", overseas: true, nat: "NZ", pick: "S", note: "SURPLUS OVERSEAS — 5th Test-nation player behind Chapman/Miller/Maxwell/Jordan. A top-order batter of real quality who is nonetheless capped out; he only plays if one of the four sits. Priced as depth — the biggest 'good player, blocked slot' trap in the pool." },
    ],
  },
  {
    name: "Dublin Guardians", short: "DUB", color: "#7C3AED", coach: "Vikram Rathour",
    players: [
      // XI — 4 Test-nation overseas: Vince, Mitchell, Ashwin, Wood.
      { name: "Mohammad Waseem", role: "BAT", overseas: false, nat: "UAE", pick: "S", note: "UAE = Global Associate, counts as LOCAL. Prolific T20I opener (200+ T20s in our data)." },
      { name: "James Vince", role: "BAT", overseas: true, nat: "ENG", pick: "S" },
      { name: "Harry Tector", role: "BAT", overseas: false, nat: "IRE", pick: "S" },
      { name: "Daryl Mitchell", role: "BAT", overseas: true, nat: "NZ", pick: "S" },
      { name: "Sanjay Krishnamurti", role: "AR", overseas: false, nat: "USA", pick: "S", note: "USA associate — counts as LOCAL." },
      { name: "Ben Calitz", role: "WK", overseas: false, nat: "IRE", pick: "R1" },
      { name: "George Dockrell", role: "AR", overseas: false, nat: "IRE", pick: "R2" },
      { name: "Ravichandran Ashwin", role: "BOWL", overseas: true, nat: "IND", pick: "S", note: "CAPTAIN. Retired from IPL/international cricket — his last 12 months of T20 volume is thin, so the recency-weighted base under-rates his actual quality. A likely manual-cap candidate in the other direction (i.e. he may go cheap)." },
      { name: "Craig Young", role: "BOWL", overseas: false, nat: "IRE", pick: "R4" },
      { name: "Joshua Little", role: "BOWL", overseas: false, nat: "IRE", pick: "S" },
      { name: "Chris Wood", role: "BOWL", overseas: true, nat: "ENG", pick: "S" },
      // Depth
      { name: "Matthew Hollard", role: "AR", overseas: false, nat: "IRE", pick: "R3", note: "Thin record (2 T20s in our data)." },
      { name: "Noah Croes", role: "WK", overseas: false, nat: "NED", pick: "R5" },
      { name: "Chris Greaves", role: "AR", overseas: false, nat: "SCO", pick: "R6" },
      { name: "Peter Hatzoglou", role: "BOWL", overseas: false, nat: "GRE", pick: "S", note: "Greece = European Associate, counts as LOCAL. BBL/Hundred leg-spinner — a genuine XI option sitting at 15 here; reorder if you expect him to start." },
      { name: "Harmeet Singh", role: "BOWL", overseas: false, nat: "USA", pick: "S", note: "USA associate — counts as LOCAL. ⚠️ Two 'Harmeet Singh' rows exist in the DB; the USA one (98 matches) is the right man." },
      { name: "Vijay Shankar", role: "AR", overseas: true, nat: "IND", pick: "S", note: "SURPLUS OVERSEAS — 5th Test-nation player behind Vince/Mitchell/Ashwin/Wood. Priced as depth." },
    ],
  },
  {
    name: "Edinburgh Castle Rockers", short: "EDI", color: "#1D4ED8", coach: "Trevor Bayliss",
    players: [
      // XI — 4 Test-nation overseas: Evans, Santner, Curran, Boult.
      { name: "Ross Adair", role: "BAT", overseas: false, nat: "IRE", pick: "R2", note: "Mark Adair's brother (Mark is at Belfast) — separate DB record, do not conflate." },
      { name: "Brandon McMullen", role: "AR", overseas: false, nat: "SCO", pick: "S" },
      { name: "Andries Gous", role: "WK", overseas: false, nat: "USA", pick: "S", note: "🚨 AVAILABILITY: PLAYS ~2 OF 10, POSSIBLY ZERO — AND HE IS EDINBURGH'S ONLY FIRST-CHOICE KEEPER. Not a squad-list guess: he has ALREADY PLAYED 4 CPL 2026 games (9-19 Aug, 69.8 avg FP) and was Player of the Match on 9 Aug for 82 off 51. CPL's final is 20 Sep, the same day ETPL ends. Two consequences: do not pay a keeper premium for him, and Edinburgh's actual gloves likely go to Oliver Jones or a reshuffle — which quietly raises the value of every other keeper in the pool." },
      { name: "JJ Smuts", role: "AR", overseas: false, nat: "ITA", pick: "S", note: "Italy associate — counts as LOCAL." },
      { name: "Laurie Evans", role: "BAT", overseas: true, nat: "ENG", pick: "S" },
      { name: "Gareth Delany", role: "AR", overseas: false, nat: "IRE", pick: "R1" },
      { name: "Mitchell Santner", role: "AR", overseas: true, nat: "NZ", pick: "S", note: "CAPTAIN." },
      { name: "Tom Curran", role: "AR", overseas: true, nat: "ENG", pick: "S" },
      { name: "Mark Watt", role: "BOWL", overseas: false, nat: "SCO", pick: "S" },
      { name: "Jack Jarvis", role: "BOWL", overseas: false, nat: "SCO", pick: "R3" },
      { name: "Trent Boult", role: "BOWL", overseas: true, nat: "NZ", pick: "S" },
      // Depth
      { name: "Oliver Jones", role: "BAT", overseas: false, nat: "SCO", pick: "Rep", note: "Replacement for Charlie Tear (OUT). Barely any record in our data — prices near baseline." },
      { name: "Safyaan Sharif", role: "BOWL", overseas: false, nat: "SCO", pick: "R5" },
      { name: "Finlay McCreath", role: "BAT", overseas: false, nat: "SCO", pick: "R6" },
      { name: "Rushil Ugarkar", role: "BOWL", overseas: false, nat: "USA", pick: "S", note: "Replacement for Khuzaima bin Tanveer (OUT). USA associate — counts as LOCAL." },
      { name: "Sean Solia", role: "AR", overseas: false, nat: "SAM", pick: "S", note: "Samoa = Global Associate, counts as LOCAL." },
      { name: "Andrew Tye", role: "BOWL", overseas: true, nat: "AUS", pick: "S", note: "SURPLUS OVERSEAS — 5th Test-nation player behind Evans/Santner/Curran/Boult. Priced as depth." },
    ],
  },
  {
    name: "Glasgow Cosmic", short: "GLA", color: "#DC2626", coach: "Matthew Hayden",
    players: [
      // XI — 4 Test-nation overseas: Roy, Livingstone, Maharaj, Ngidi.
      { name: "Jason Roy", role: "BAT", overseas: true, nat: "ENG", pick: "S", note: "Replacement for Finn Allen (OUT)." },
      { name: "George Munsey", role: "BAT", overseas: false, nat: "SCO", pick: "S" },
      { name: "Matt Cross", role: "WK", overseas: false, nat: "SCO", pick: "R2" },
      { name: "Liam Livingstone", role: "AR", overseas: true, nat: "ENG", pick: "S" },
      { name: "Richie Berrington", role: "BAT", overseas: false, nat: "SCO", pick: "S" },
      { name: "Moises Henriques", role: "AR", overseas: false, nat: "POR", pick: "S", note: "Portugal = European Associate, counts as LOCAL — a big deal for Glasgow, since a 250-match franchise all-rounder occupies a local slot rather than an overseas one. NOTE his last-10 form is inflated: 3 Portugal T20Is 14-20 Aug averaging 130 FP, against the Czech Republic (235!), Israel (122) and Germany (33). The weak-opposition discount and his 250-match career history should hold this in check, but he is the clearest example in the pool of form that is real but not transferable." },
      { name: "Michael Leask", role: "AR", overseas: false, nat: "SCO", pick: "R4" },
      { name: "Keshav Maharaj", role: "BOWL", overseas: true, nat: "RSA", pick: "S" },
      { name: "Paul van Meekeren", role: "BOWL", overseas: false, nat: "NED", pick: "R3" },
      { name: "Brad Currie", role: "BOWL", overseas: false, nat: "SCO", pick: "R1" },
      { name: "Lungi Ngidi", role: "BOWL", overseas: true, nat: "RSA", pick: "S" },
      // Depth
      { name: "Oliver Davidson", role: "AR", overseas: false, nat: "SCO", pick: "R5" },
      { name: "Liam Naylor", role: "BAT", overseas: false, nat: "SCO", pick: "Rep", note: "Replacement for Chris McBride (OUT). Thin record (4 T20s in our data)." },
      { name: "Ali Khan", role: "BOWL", overseas: false, nat: "USA", pick: "S", note: "USA associate — counts as LOCAL, so a 120-match franchise quick sits in a local slot. ⚠️ Must not be confused with Rashid Khan in name matching." },
      { name: "James Neesham", role: "AR", overseas: true, nat: "NZ", pick: "S", note: "Replacement for Kamindu Mendis (OUT). SURPLUS OVERSEAS — 5th Test-nation player behind Roy/Livingstone/Maharaj/Ngidi. Priced as depth, but a strong reorder candidate." },
      // NOTE: Glasgow are two short of 17 — the Gerhard Erasmus (OUT) and Duan Jansen (OUT)
      // replacements are still unannounced ("xx" in the sheet). Add here when named.
    ],
  },
];

// ── Name aliases: announced spelling -> cricsheet/DB spelling ────────────────────────────────
// Keys are normName-stripped (lowercase, punctuation/diacritics removed). These are HAND-VERIFIED
// against the DB (name + country + career match count). Two categories matter here:
//   (a) sheet misspellings ("Micheal", "Klassen", "Weise", "Daryll")
//   (b) SURNAME COLLISIONS INSIDE THIS POOL, where fuzzy would hand a thin newcomer the star's
//       career. ETPL is unusually bad for this — the pool contains BOTH Tector brothers, BOTH
//       Adair brothers, two Kleins, two Davidsons, two Manentis, and a Jason Roy / Alexander Roy
//       pair. Every one of those is pinned below.
export const ETPL_NAME_ALIASES: Record<string, string> = {
  // (b) in-pool collisions — verified by DB id + career matches
  "tim tector": "TH Tector",              // 3993, 8m   — NOT HT Tector (Harry, 153m, Dublin)
  "harry tector": "HT Tector",            // 1436, 153m
  "ross adair": "GR Adair",               // 1483, 23m  — NOT MR Adair (Mark, 174m, Belfast)
  "mark adair": "MR Adair",               // 1155, 174m
  "jason roy": "JJ Roy",                  // England
  "alexander roy": "A Roy",               // 8570, 2m   — Netherlands
  "kyle klein": "K Klein",                // Netherlands
  "ryan klein": "R Klein",                // Netherlands
  "fred klaassen": "FJ Klaassen",         // Netherlands (double-a spelling, distinct from Klaasen)
  "jasper davidson": "JJ Davidson",       // 6296, 14m  — Scotland
  "oliver davidson": "O Davidson",        // 6520, 13m  — Scotland
  "ben manenti": "BAD Manenti",
  "harry manenti": "HJ Manenti",
  "oliver jones": "O Jones",              // 8539, 1m   — Scotland; NOT MA Jones (143m)
  "ali khan": "Ali Khan",                 // 2443, 126m — USA; must not fuzz to Rashid Khan
  "harmeet singh": "Harmeet Singh",       // 2440, 98m  — USA (a second, older row also exists)
  "ali hasan": "Ali Hasan",               // 4666, 10m  — Italy; must not fuzz to Hasan Ali (PAK, 318m)
  "steve smith": "SPD Smith",             // 81, 558m
  "mitch marsh": "MR Marsh",              // 276, 397m — Mitchell Ross Marsh, NOT SE Marsh (Shaun)
  "mitchell marsh": "MR Marsh",
  // (a) sheet spelling -> DB spelling
  "micheal bracewell": "MG Bracewell",
  "michael bracewell": "MG Bracewell",
  "heinrich klassen": "H Klaasen",
  "heinrich klaasen": "H Klaasen",
  "micheal levitt": "M Levitt",
  "michael levitt": "M Levitt",
  "daryll mitchell": "DJ Mitchell",
  "daryl mitchell": "DJ Mitchell",         // 251, 272m
  "ravi ashwin": "R Ashwin",
  "ravichandran ashwin": "R Ashwin",
  "roelof vd merwe": "RE van der Merwe",
  "roelof van der merwe": "RE van der Merwe",
  "david weise": "D Wiese",
  "david wiese": "D Wiese",
  "jimmy neesham": "JDS Neesham",
  "james neesham": "JDS Neesham",
  "faf du plessis": "F du Plessis",
  "aj tye": "AJ Tye",
  "andrew tye": "AJ Tye",
  "mitch santner": "MJ Santner",
  "mitchell santner": "MJ Santner",
  "finlay mccreath": "FDW McCreath",
  "mohammad waseem": "Waseem Muhammad",    // 1138, 211m — UAE; cricsheet reverses the name
  "sanjay krishnamurti": "SP Krishnamurthi", // 2439, 72m — USA; note the -thi spelling
  "george munsey": "HG Munsey",            // 780
  "mark chapman": "MS Chapman",
  "chris wood": "CP Wood",
  "liam livingstone": "LS Livingstone",
  "moises henriques": "MC Henriques",
  "keshav maharaj": "KA Maharaj",
  "lungi ngidi": "L Ngidi",
  "tom curran": "TK Curran",               // NOT SW / BJ Curran
  "chris jordan": "CJ Jordan",
  "james vince": "JM Vince",
  "laurie evans": "LJ Evans",
  "matt cross": "MH Cross",
  "michael leask": "MA Leask",
  "brad currie": "BJ Currie",
  "vijay shankar": "V Shankar",
  "ajinkya rahane": "AM Rahane",
  "david payne": "DA Payne",
  "richard gleeson": "RJ Gleeson",
  "aneurin donald": "AHT Donald",
  "ben mcdermott": "BR McDermott",
  "tim david": "TH David",
  "bas de leede": "BFW de Leede",
  "max odowd": "MP O'Dowd",
  "scott edwards": "SA Edwards",
  "curtis campher": "C Campher",
  "logan van beek": "LV van Beek",
  "paul van meekeren": "PA van Meekeren",
  "trent boult": "TA Boult",
  "devon conway": "DP Conway",
  "joshua little": "J Little",
  "craig young": "CA Young",
  "george dockrell": "GH Dockrell",
  "gareth delany": "GJ Delany",
  "brandon mcmullen": "BJ McMullen",
  "andries gous": "AGS Gous",
  "jj smuts": "JT Smuts",
  "mark watt": "MRJ Watt",
  "safyaan sharif": "SM Sharif",
  "sean solia": "SM Solia",
  "richie berrington": "RD Berrington",
  "peter hatzoglou": "P Hatzoglou",
  "saurabh netravalkar": "SN Netravalkar",
  "paul stirling": "PR Stirling",
  "lorcan tucker": "L Tucker",
  "david miller": "DA Miller",
  "glenn maxwell": "GJ Maxwell",
  "anrich nortje": "A Nortje",
  "matthew humphreys": "MJ Humphreys",
  "matthew hollard": "MK Hollard",
  "noah croes": "NRJ Croes",
  "ben calitz": "BF Calitz",
  "jai moondra": "J Moondra",
  "chris greaves": "CN Greaves",
  "tim pringle": "TJG Pringle",
  "aryan dutt": "A Dutt",
  "yuvraj samra": "YS Samra",
  "rushil ugarkar": "R Ugarkar",
  "zainullah ihsan": "Zainullah Ihsan",
  "crishan kalugamage": "CJPF Kalugamage",
  "shubham ranjane": "Shubham Ranjane",
  "saqib zulfiqar": "Saqib Zulfiqar",
  "vikramjit singh": "Vikramjit Singh",
  "liam naylor": "LR Naylor",
  "jack jarvis": "J Jarvis",
};

// Cricsheet-id anchors: announced name -> cricsheet_id. Checked BEFORE the name aliases, because a
// name alias resolves to a NAME, and a name is not always unique. The pool contains exactly one such
// case, and it is a bad one: two "Harmeet Singh" rows exist, and the alias picked the wrong man —
// id 428 (28 games, 2009-2013, an India U19-era player) instead of id 2440 (98 games, 2023-2026,
// the USA international actually signed by Dublin). Anchoring on the stable id is the only fix that
// cannot silently regress; a name alias here is unfixable by construction.
// (Keys are normName-stripped.)
export const ETPL_CRICSHEET_IDS: Record<string, string> = {
  "harmeet singh": "0bf15e52", // player 2440, USA, 98 games to 2026-07-05 — NOT 2a72fd4f (id 428)
};

// Players with NO ball-by-ball record in our data. Listed explicitly so fuzzy can never hand them
// a same-surname stranger's career — they are created statless and price at baseline, which is the
// honest answer for an uncapped draft pick.
export const ETPL_NO_DB_RECORD: Record<string, true> = {
  "jordan neill": true,      // IRE, Amsterdam R5
  "david rushmere": true,    // NED, Amsterdam Rep
  "gavin hoey": true,        // IRE, Belfast
};

// ── Expected matches ─────────────────────────────────────────────────────────────────────────
// ETPL is a double round-robin: every team plays EXACTLY 10 league games. Playoffs are top-3 only
// (1st -> Final; 2nd v 3rd Qualifier; winner -> Final), i.e. 3 extra games shared across 6 teams,
// so the blended playoff expectation is ~0.5 a team. With no prior season there is no honest basis
// for strength tiers (the whole point of a tier is measured team quality), so the XI gets a FLAT
// 10.5 rather than a guess dressed up as a model. Revisit for season 2.
//
// Bench falls away MLC-style rather than IPL-style. The XI rule here (min 5 local, max 4 Test-
// nation overseas, associates count as local) genuinely forces rotation: a team wanting to change
// its overseas mix mid-tournament has to reshuffle three or four places at once, so squad players
// 12-14 do get games. There is no Impact Player / 12th-man rule, so the XI is 11.
const ETPL_XI_MATCHES = 10.5;

export function etplExpectedMatches(squadNumber: number): number {
  if (squadNumber >= 1 && squadNumber <= ETPL_XI_SIZE) return ETPL_XI_MATCHES;
  if (squadNumber === 12) return 4;
  if (squadNumber <= 14) return 2.5;
  return 1;
}

// Per-player availability overrides, keyed on the DB/cricsheet name (normalised). An override
// REPLACES the positional number, because it already encodes games played.
//
// The CPL 2026 window (7 Aug – 20 Sep) overlaps ETPL's (26 Aug – 20 Sep) almost exactly, and two
// ETPL XI players are named in CPL squads. Neither can play both. Until the clash is resolved they
// are priced as part-season players rather than 10-game starters — deliberately conservative, since
// the downside of paying a marquee price for a man who never arrives is far worse than the upside
// of a cheap 10-game player. Clear the entry once you have confirmation.
const ETPL_EXPECTED_GAMES: Record<string, number> = {
  // CONFIRMED FROM INGESTED CPL 2026 BALL-BY-BALL (not from a squad list — from games actually
  // played). Both men are in the middle of a CPL campaign that ends 20 Sep, the same day ETPL ends.
  // Neither can play both tournaments. Priced at 2 games, which assumes a late arrival only if
  // their franchise misses the playoffs; realistically it could be zero.
  "agsgous": 2,          // Andries Gous — 4 CPL games 9-19 Aug, 69.8 avg FP, POTM on 9 Aug (82 off 51)
  "snnetravalkar": 2,    // Saurabh Netravalkar — 3 CPL games 8-18 Aug, 78.0 avg FP
  // Australia's 2nd Test v Bangladesh runs 22-26 Aug at Mackay, Queensland; Smith played the 1st
  // (Darwin, 13 Aug, 209 FP) so he is in that squad. Now computed off the ACTUAL fixture list
  // rather than estimated: Amsterdam play 26 Aug (match 1), then 28, 30 Aug, 3, 5, 6, 10, 13, 15,
  // 16 Sep. He certainly misses the 26 Aug opener; the 28th is two days later and Queensland ->
  // Amsterdam is ~24h, so it is reachable. Hence 9 of 10, which matches the user's own team news
  // ("misses the opening game, joins late"). Downside risk is 8 if he is held back or rested.
  // He retired from ODIs in 2025, so Australia's Zimbabwe ODIs (15-20 Sep) do NOT take him and the
  // back end is intact.
  "spdsmith": 9,
  // Marsh: same team news as Smith (misses the opener, joins late). He has no tournament clash --
  // the Hundred ended 16 Aug -- so 9 of 10 is the read. Unlike Smith he carries BACK-END risk:
  // Australia's ODIs v Zimbabwe are 15-20 Sep and Amsterdam's last two games are 15 and 16 Sep.
  // Left at 9 rather than pre-docking a call-up that has not happened.
  "mrmarsh": 9,
};

export function etplExpectedMatchesFor(dbName: string, squadNumber: number): number {
  const key = (dbName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const override = ETPL_EXPECTED_GAMES[key];
  if (override !== undefined) return override;
  return etplExpectedMatches(squadNumber);
}
