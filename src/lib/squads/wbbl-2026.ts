// WBBL|12 2026 — Women's Big Bash League (29 Oct – 5 Dec 2026, Australia).
//
// Archetype: WOMEN'S FRANCHISE T20, modelled on WCPL (women's league with its own bucket) but
// at full size — 8 teams, 40 league games (10 per team; NOT a true double round-robin: each team
// meets 7 opponents, 3 of them twice), then Knockout (3v4, 1 Dec) -> Challenger (2 v KO winner,
// 3 Dec) -> Final (1 v Challenger winner, 5 Dec). 43 matches. Cricinfo series 1543943, ESPN
// league 18042.
//
// The league bucket is 'WBBL' — ingested 18 Jul 2026 for the Hundred Women (cricsheet `wbb`,
// 519 matches 2015–2025). Unlike WCPL there is NO scale correction: measured 26 Oct 2026, WBBL
// FP runs at 1.05x the same women's WPL + T20I FP (70 players, >=5 WBBL & >=8 other, 60mo) —
// noise, not a league-strength gap.
//
// SQUAD RULES 2026: the overseas draft is SCRAPPED (direct signings again), primary list of 15,
// MAX 3 overseas on the list, no minimum. So every overseas signing can field — the XI overseas
// cap (historically 3) never binds and is not modelled.
//
// Squads from cricket.com.au's WBBL|12 squad tracker + club previews + Wikipedia (26 Oct 2026),
// with the late changes the Wikipedia table still misses: Athapaththu in for the injured
// Wyatt-Hodge (HUR), Grace Lyons in for Maddy Darke (SIX, stress fracture), Darcie Brown OUT for
// the season (STR, back — no replacement named). Excluded from the pool entirely: Darcie Brown,
// Danni Wyatt-Hodge, Maddy Darke (season-ending), Alyssa Healy (retired), Nat Sciver-Brunt
// (sitting out), Elyse Villani (retired), Jemimah Rodrigues (not returning).
//
// Players ordered probable XI (1–11, batting order) then bench (12+) -> squad_number, which is
// what drives expected matches. XI SOURCE per team:
//   STR / HEA / REN / SIX — the cricket.com.au club previews (SIX adjusted: Lyons keeps for Darke).
//   HUR / STA / SCO / THU — no preview published; seeded from each club's REAL WBBL 2025 batting
//   order + bowling usage (raw cricsheet), adjusted for departures/arrivals. Edit by feel.
// ROLES are not published anywhere reachable — they are best-effort from playing history.
// `captain` is informational only.

export type Role = "BAT" | "BOWL" | "AR" | "WK";

// Availability. Caps the positional expected matches (never promotes a bench player).
//   OUT        — will not play
//   NO_FINALS  — full league phase, CONFIRMED to miss the finals: 10.0 (unused as of 26 Oct — the
//                SA trio's finals question is unconfirmed, so it is a note, not a cap)
//   GAMES8     — contracted for her team's first 8 league games only: 8.0
export type Avail = "OUT" | "NO_FINALS" | "GAMES8";
export const AVAIL_MATCHES: Record<Avail, number> = { OUT: 0, NO_FINALS: 10.0, GAMES8: 8.0 };

export interface WbblSquadPlayer {
  name: string;
  role: Role;
  overseas: boolean;
  captain?: boolean;
  avail?: Avail;
  note?: string;
}

export interface WbblTeam {
  name: string;
  short: string;
  color: string;
  players: WbblSquadPlayer[];
}

export const WBBL_2026_NAME = "WBBL 2026";
export const WBBL_XI_SIZE = 11;
// House rule: each friend buys 20 but only their BEST 16 score. Picks 17–20 are insurance, so the
// engine prices that share of the board (1 − 16/20 = 20%) at the ₹1 floor and spreads the money
// over the players who will actually count. Assumes the friends' configured players_per_friend = 20.
export const WBBL_COUNTING_PICKS = 16;

// Expected matches. 10 league games each. Finals = 6 team-slots (KO 2 + Challenger 2 + Final 2)
// over 8 teams = +0.75 for an average XI player => XI = 10.75. Flat across teams (no tiering —
// a 10-game ladder is too close to call who makes the top 4).
// Bench: a 10-game league over 38 days has real rotation/injury cover, so 12th = 2.0 (first
// replacement), 13th = 1.0, 14+ = 0.5 — a fringe player prices near the floor, not free.
export function wbblExpectedMatches(teamShort: string, squadNumber: number): number {
  const positional =
    squadNumber >= 1 && squadNumber <= WBBL_XI_SIZE
      ? 10.75
      : squadNumber === 12
      ? 2.0
      : squadNumber === 13
      ? 1.0
      : 0.5;
  const player = WBBL_2026.find((t) => t.short === teamShort)?.players[squadNumber - 1];
  if (player?.avail) return Math.min(positional, AVAIL_MATCHES[player.avail]);
  return positional;
}

const AVAIL_TO_DB: Record<Avail, string> = {
  OUT: "UNAVAILABLE", NO_FINALS: "DOUBTFUL", GAMES8: "DOUBTFUL",
};

export function wbblAvailability(name: string): string {
  for (const t of WBBL_2026) {
    for (const p of t.players) {
      if (p.name === name) return p.avail ? AVAIL_TO_DB[p.avail] : "FIT";
    }
  }
  return "FIT";
}

export const WBBL_2026: WbblTeam[] = [
  {
    name: "Adelaide Strikers", short: "STR", color: "#0085CA",
    // XI = cricket.com.au preview "possible best XI" verbatim ("Clean slate for Strikers", 21 Oct,
    // news/4594248). McGrath: Bouchier + de Broughe "will probably both bat in the top-order".
    // Weak spot: 5 front-line bowlers only — Mushangwe is first in if they want a 6th.
    players: [
      { name: "Maia Bouchier", role: "BAT", overseas: true, note: "New from the Stars." },
      { name: "Laura Wolvaardt", role: "BAT", overseas: true, note: "Finals WATCH, not confirmed: SA v India Test 9–12 Dec (Gqeberha). No source says she misses the finals; on last season's precedent (CSA released Proteas until 4–5 days before a series) the KO (1 Dec) + Challenger (3 Dec) look playable, the Final (5 Dec) borderline. Not priced in." },
      { name: "Emma de Broughe", role: "BAT", overseas: false, note: "New from the Renegades." },
      { name: "Tahlia McGrath", role: "AR", overseas: false, captain: true },
      { name: "Bridget Patterson", role: "WK", overseas: false },
      { name: "Madeline Penna", role: "BAT", overseas: false },
      { name: "Ellie Johnston", role: "AR", overseas: false },
      { name: "Sophie Ecclestone", role: "BOWL", overseas: true },
      { name: "Amanda-Jade Wellington", role: "BOWL", overseas: false },
      { name: "Eleanor Larosa", role: "AR", overseas: false, note: "Left-arm fast-medium; batted 3 in the Spring Challenge (52, 53) and bowled 4 overs a game. Brown's absence opens her slot." },
      { name: "Megan Schutt", role: "BOWL", overseas: false, note: "Only 5 games in 2025, but Darcie Brown's season-ending back injury opens a pace slot. Fit — 10 wickets in the Bangladesh ODIs." },
      { name: "Anesu Mushangwe", role: "BOWL", overseas: false, note: "Ex-Zimbabwe leg-spinner, listed as a local. First in if the Strikers want a 6th bowler (would displace de Broughe)." },
      { name: "Ella Wilson", role: "BOWL", overseas: false },
      { name: "Maggie Clark", role: "BOWL", overseas: false, note: "Signing confirmed by the club (~26 Oct) — she and Ella Wilson filled the last two spots after Darcie Brown's season-ending back injury. RA fast-medium; 4 Spring Challenge wickets." },
    ],
  },
  {
    name: "Brisbane Heat", short: "HEA", color: "#00B2A9",
    // XI = cricket.com.au preview "possible best XI" in order ("Back to basics…", 23 Oct). Only 2
    // overseas by choice. Redmayne: top order "not completely settled" (5 opening pairs in 2025).
    players: [
      { name: "Grace Harris", role: "AR", overseas: false },
      { name: "Annie O'Neil", role: "BAT", overseas: false },
      { name: "Jess Jonassen", role: "AR", overseas: false, avail: "OUT", note: "🚫 OUT FOR WBBL|12 — hip complaint (Heat + cricket.com.au, 27 Oct). Aiming to train again in December. The Heat are negotiating an INTERNATIONAL replacement, to be announced before the 30 Oct opener." },
      { name: "Charli Knott", role: "AR", overseas: false, note: "Opened in all 9 of her 2025 games — the preview has her at 4; top order unsettled." },
      { name: "Georgia Redmayne", role: "WK", overseas: false, captain: true },
      { name: "Orla Prendergast", role: "AR", overseas: true, note: "New signing." },
      { name: "Sianna Ginger", role: "AR", overseas: false },
      { name: "Sarah Glenn", role: "BOWL", overseas: true },
      { name: "Lucy Hamilton", role: "BOWL", overseas: false, note: "Fit again after a quad strain — bowled in the NZ T20Is 18 & 20 Oct. The Heat's leading wicket-taker in 2025." },
      { name: "Lily Bassingthwaighte", role: "BOWL", overseas: false },
      { name: "Grace Parsons", role: "BOWL", overseas: false, note: "⚠️ LOW-MED confidence: back + neck issues reported 24 Sep; re-signed 9 Oct but no WNCL or Spring Challenge game yet. In the preview XI. Catherine White is the pace alternative. Not priced in (no confirmed absence)." },
      { name: "Lucy Bourke", role: "BAT", overseas: false, note: "First in for batting depth — played every Spring Challenge game." },
      { name: "Catherine White", role: "BOWL", overseas: false, note: "19-year-old quick signed as the 15th player (\"White hot for Heat\"). First in if Parsons isn't fit and they go pace; 2/20 v STR in the Spring Challenge." },
      { name: "Mikayla Wrigley", role: "WK", overseas: false, note: "Back-up keeper." },
      { name: "Bonnie Berry", role: "BOWL", overseas: false },
    ],
  },
  {
    name: "Hobart Hurricanes", short: "HUR", color: "#674398",
    // Defending champions. No preview XI; built from Spring Challenge 2026 scorecards + 2025 usage +
    // club news (XI agent, 26 Oct). Captain NOT announced — coach named Graham or Trenaman (22 Sep).
    // The club names a 13 the day before each game; ~28 Oct will settle Lee + Lauren Smith.
    players: [
      { name: "Lizelle Lee", role: "WK", overseas: false, note: "⚠️ MED-LOW: missed the Spring Challenge with a \"low grade injury\", no update since ~19 Oct. If out, Kate Pelle opens + keeps (contracted 25 Oct explicitly as \"another keeping option alongside Lee\"). Not priced in (no confirmed absence). Local status." },
      { name: "Chamari Athapaththu", role: "AR", overseas: true, note: "Signed ~25 Oct as Danni Wyatt-Hodge's replacement (Wyatt-Hodge OUT injured for the tournament). Opens." },
      { name: "Rachel Trenaman", role: "BAT", overseas: false, note: "Coach: a bigger batting role with Sciver-Brunt out; batted 3 in the Spring Challenge. Captaincy candidate." },
      { name: "Nicola Carey", role: "AR", overseas: false },
      { name: "Chinelle Henry", role: "AR", overseas: true, note: "New from the Heat." },
      { name: "Heather Graham", role: "AR", overseas: false, note: "2025 leading wicket-taker; captained the Spring Challenge — likeliest captain." },
      { name: "Ella Hayward", role: "AR", overseas: false, note: "New from the Stars (2-year deal). Takes Villani's slot — played every Spring Challenge game with bat and ball (off-spin)." },
      { name: "Hayley Silver-Holmes", role: "BOWL", overseas: false },
      { name: "Molly Strano", role: "BOWL", overseas: false },
      { name: "Lauren Smith", role: "BOWL", overseas: false, note: "⚠️ MED-LOW: club said 19 Oct she was \"sidelined with an injury\", no update since. If out, Amy Smith (leg-spin) comes in. Not priced in." },
      { name: "Linsey Smith", role: "BOWL", overseas: true },
      { name: "Kate Pelle", role: "WK", overseas: false, note: "First in if Lee is unfit — opened + kept in the Spring Challenge (61, 20, 43, 12)." },
      { name: "Amy Smith", role: "BOWL", overseas: false, note: "First in if Lauren Smith is unfit; 4-3 in her one Spring Challenge game." },
      { name: "Ruth Johnston", role: "AR", overseas: false },
      { name: "Callie Wilson", role: "BOWL", overseas: false },
    ],
  },
  {
    name: "Melbourne Renegades", short: "REN", color: "#E40613",
    // XI = 2025 usage + Spring Challenge 2026 + club news (XI agent, 26 Oct). Matthews + Webb open.
    // Least certain: #9 Wikman vs Sophie Reid. 15th list spot still unfilled.
    players: [
      { name: "Hayley Matthews", role: "AR", overseas: true, note: "Back from shoulder surgery — \"healthy and ready to play\" (7 Sep); 10 wkts at the July T20 WC and 182 in an ODI on 24 Sep. Opens and bowls." },
      { name: "Courtney Webb", role: "BAT", overseas: false },
      { name: "Sophie Molineux", role: "AR", overseas: false, captain: true },
      { name: "Deandra Dottin", role: "AR", overseas: true },
      { name: "Chloe Tryon", role: "AR", overseas: true, note: "Finals WATCH, not confirmed: same SA v India Test (9 Dec) question as Wolvaardt — and as a white-ball specialist she is less tied to the Test. Not priced in." },
      { name: "Georgia Wareham", role: "AR", overseas: false },
      { name: "Nicole Faltum", role: "WK", overseas: false, note: "Keeps — kept all 10 in 2025 and in the Spring Challenge even with Reid playing." },
      { name: "Tess Flintoff", role: "AR", overseas: false },
      { name: "Annie Wikman", role: "AR", overseas: false, note: "⚠️ LOW: toss-up with Sophie Reid for the last spot. Spring Challenge Player of the Match (59 opening)." },
      { name: "Milly Illingworth", role: "BOWL", overseas: false },
      { name: "Tayla Vlaeminck", role: "BOWL", overseas: false, note: "First WBBL game since 2021 if picked; bowled full 4-over spells in 3 Spring Challenge games. Some workload risk." },
      { name: "Sophie Reid", role: "WK", overseas: false, note: "Back-up keeper; batting-depth alternative to Wikman." },
      { name: "Sara Kennedy", role: "BOWL", overseas: false },
      { name: "Olivia Porter", role: "BAT", overseas: false },
    ],
  },
  {
    name: "Melbourne Stars", short: "STA", color: "#00A651",
    // XI = 2025 order (cricsheet) + Lanning's own 12 Oct comments + Spring Challenge 2026 scorecards
    // (XI agent, 26 Oct). Least certain: #5 Stalenberg vs Leeson (~60/40); Jones may bat 5.
    players: [
      { name: "Meg Lanning", role: "BAT", overseas: false, captain: true, note: "Named captain 12 Oct (Sutherland stepped down). Opens — 96 off 62 in the Spring Challenge." },
      { name: "Rhys McKenna", role: "AR", overseas: false },
      { name: "Amy Jones", role: "WK", overseas: true, note: "Keeps. Batted 3 in 2025; Lanning grouped her with the middle order, so may drop to 5." },
      { name: "Annabel Sutherland", role: "AR", overseas: false },
      { name: "Naomi Stalenberg", role: "BAT", overseas: false, note: "~60% for Kapp's batting slot — signed 21 Oct, batted 5 in every Spring Challenge game. Alternative: Carly Leeson." },
      { name: "Dani Gibson", role: "AR", overseas: true },
      { name: "Kim Garth", role: "AR", overseas: false },
      { name: "Charlie Dean", role: "BOWL", overseas: true, note: "Signed 17 Sep to replace Marizanne Kapp." },
      { name: "Georgia Prestwidge", role: "AR", overseas: false },
      { name: "Maisy Gibson", role: "BOWL", overseas: false },
      { name: "Sophie Day", role: "BOWL", overseas: false },
      { name: "Carly Leeson", role: "AR", overseas: false, note: "~35–40% to start at 5 instead of Stalenberg; strong Spring Challenge with the ball (3/25, 2/24)." },
      { name: "Zoe Samuel", role: "AR", overseas: false },
      { name: "Indigo Noble", role: "BAT", overseas: false },
    ],
  },
  {
    name: "Perth Scorchers", short: "SCO", color: "#F37021",
    // XI = 2025 order + Spring Challenge 2026 scorecards (XI agent, 26 Oct): Friday into Darke's #3,
    // Piparo into Paige Scholfield's (left) #6. Least certain: #6 Piparo vs a 7th bowler (Strange).
    players: [
      { name: "Katie Mack", role: "BAT", overseas: false },
      { name: "Beth Mooney", role: "WK", overseas: false },
      { name: "Mikayla Friday", role: "BAT", overseas: false, note: "Née Hinkley — same player (DB: M Hinkley). Takes Darke's #3; batted 3 in the Spring Challenge (57, 39, 31)." },
      { name: "Sophie Devine", role: "AR", overseas: true, captain: true, note: "A calf injury cut short her Hundred; CA says it is \"not expected to affect\" WBBL." },
      { name: "Freya Kemp", role: "AR", overseas: true },
      { name: "Chloe Piparo", role: "BAT", overseas: false, note: "~60% for Scholfield's slot — captained WA in the Spring Challenge from 4." },
      { name: "Fatima Sana", role: "AR", overseas: true, avail: "GAMES8", note: "Contracted for the first 8 games ONLY: the PCB wants her at a camp before Pakistan's West Indies tour (2nd week of Dec). Plays M5, 8, 11, 16, 18, 22, 26, 30; MISSES M36 (v HUR), M39 (v HEA) + finals. May be extended if the PCB releases her from the camp. Ruby Strange replaces her." },
      { name: "Alana King", role: "BOWL", overseas: false },
      { name: "Chloe Ainsworth", role: "BOWL", overseas: false },
      { name: "Lilly Mills", role: "BOWL", overseas: false },
      { name: "Amy Edgar", role: "AR", overseas: false },
      { name: "Ruby Strange", role: "BOWL", overseas: false, note: "First in once Sana leaves after 8 games (2 league games + finals), and the alternative to Piparo if they pick 7 bowlers." },
      { name: "Ebony Hoskin", role: "BOWL", overseas: false },
    ],
  },
  {
    name: "Sydney Sixers", short: "SIX", color: "#E5007E",
    // XI = the cricket.com.au preview XI with Lyons for Darke; confirmed vs Spring Challenge 2026
    // scorecards (ESPN league 1558388) by the XI agent, 26 Oct.
    players: [
      { name: "Sophia Dunkley", role: "BAT", overseas: true },
      { name: "Ellyse Perry", role: "AR", overseas: false },
      { name: "Alice Capsey", role: "AR", overseas: true, note: "Fills Healy's No.3 (preview). Can keep — Clarke: \"nice to have that option up your sleeve\"." },
      { name: "Amelia Kerr", role: "AR", overseas: true, note: "Captained NZ in all 3 T20Is v Australia to 22 Oct — fit. NZ's next series starts 10 Dec: full season." },
      { name: "Ashleigh Gardner", role: "AR", overseas: false, captain: true },
      { name: "Erin Burns", role: "AR", overseas: false, note: "Captained the Spring Challenge winners (41 in the final)." },
      { name: "Grace Lyons", role: "WK", overseas: false, note: "⚠️ ~55% to start. Signed 25 Oct for Maddy Darke (stress fracture, OUT for the season); kept + captained ACT in all 4 Spring Challenge games. Alternative XI: Capsey keeps, Elsa Hunter bats instead." },
      { name: "Caoimhe Bray", role: "AR", overseas: false },
      { name: "Maitlan Brown", role: "BOWL", overseas: false },
      { name: "Sarah Coyte", role: "BOWL", overseas: false },
      { name: "Lauren Cheatle", role: "BOWL", overseas: false },
      { name: "Elsa Hunter", role: "BAT", overseas: false, note: "First in if Capsey keeps and Lyons sits out — the Sixers' Spring Challenge top scorer (incl. 65 off 41)." },
      { name: "Courtney Sippel", role: "BOWL", overseas: false, note: "Like-for-like seam swap for Coyte/Bray; 7 Spring Challenge wickets." },
      { name: "Frankie Nicklin", role: "BOWL", overseas: false },
      { name: "Eva Ragg", role: "AR", overseas: false, note: "Role unverified (single source)." },
    ],
  },
  {
    name: "Sydney Thunder", short: "THU", color: "#8DC63F",
    // XI = the cricket.com.au preview XI (25 Oct), in 2025 batting order; the 11 names agree with the
    // preview, only slots 2–5 are uncertain (Litchfield: "we're going to jiggle around the order").
    players: [
      { name: "Georgia Voll", role: "AR", overseas: false },
      { name: "Tahlia Wilson", role: "WK", overseas: false },
      { name: "Phoebe Litchfield", role: "BAT", overseas: false, captain: true },
      { name: "Heather Knight", role: "BAT", overseas: true, note: "Retired from internationals mid-2026 — full WBBL availability." },
      { name: "Anika Learoyd", role: "BAT", overseas: false, note: "Spring Challenge avg 48.5 @ SR 137; preview: \"will have a big role to play\"." },
      { name: "Nadine de Klerk", role: "AR", overseas: true, note: "Signing article (25 Oct): full availability INCLUDING finals. The Thunder preview calls her finals availability \"not yet clear\" (SA host India from 9 Dec) — a small open question, not priced in." },
      { name: "Laura Harris", role: "BAT", overseas: false },
      { name: "Jemma Barsby", role: "AR", overseas: false, note: "New from the Strikers. Spring Challenge leading wicket-taker (incl. 5/10)." },
      { name: "Nicola Hancock", role: "BOWL", overseas: false, note: "New from the Heat; likeliest new-ball partner for Bell." },
      { name: "Sam Bates", role: "BOWL", overseas: false },
      { name: "Lauren Bell", role: "BOWL", overseas: true, note: "Confirmed for the entire season." },
      { name: "Lucy Finn", role: "AR", overseas: false },
      { name: "Hannah Darlington", role: "AR", overseas: false, note: "Missed all of WBBL|11 (knee/leg), surgery Mar 2026. Played the 12–13 Oct Spring Challenge games, then left out of the XI — behind Barsby and Finn." },
      { name: "Hasrat Gill", role: "AR", overseas: false },
    ],
  },
];

// ⛔ ALIASES — literal DB (cricsheet) spellings, read off real WBBL 2025 scorecards on 26 Oct 2026.
// Woman-vs-woman traps the gender filter does NOT save you from:
//   Sam Bates      -> SL Bates (Thunder bowler). SW Bates is Suzie Bates (NZ).
//   Laura Harris   -> L Harris (Thunder bat).   LM Harris is a different, Blast-only bowler.
//   Madeline Penna -> M Penna.                  "Maria Penna" is a different player.
//   Linsey Smith   -> LCN Smith (ENG spinner);  Lauren Smith -> LG Smith (AUS). Both HUR.
//   Dani Gibson    -> DR Gibson;                Maisy Gibson -> ML Gibson. Both STA.
//   Mikayla Friday -> M Hinkley (married name; DB has the maiden name).
//   Chamari Athapaththu -> AC Jayangani (cricsheet uses her other surname).
export const WBBL_NAME_ALIASES: Record<string, string> = {
  "sam bates": "SL Bates",
  "laura harris": "L Harris",
  "madeline penna": "M Penna",
  "linsey smith": "LCN Smith",
  "lauren smith": "LG Smith",
  "amy smith": "A Smith", // HUR 2020–24; fuzzy refuses her (5 female Smiths)
  "ruth johnston": "R Johnston", // HUR 2021–24; fuzzy refuses her (E/RP Johnston)
  "dani gibson": "DR Gibson",
  "maisy gibson": "ML Gibson",
  "mikayla friday": "M Hinkley",
  "chamari athapaththu": "AC Jayangani",
  "tahlia mcgrath": "TM McGrath",
  "bridget patterson": "BE Patterson",
  "ellie johnston": "E Johnston",
  "amanda-jade wellington": "A Wellington",
  "sophie ecclestone": "S Ecclestone",
  "eleanor larosa": "E Larosa",
  "megan schutt": "ML Schutt",
  "laura wolvaardt": "L Wolvaardt",
  "maia bouchier": "ME Bouchier",
  "emma de broughe": "E de Broughe",
  "charli knott": "CR Knott",
  "georgia redmayne": "G Redmayne",
  "lucy hamilton": "LK Hamilton",
  "annie o'neil": "A O'Neil",
  "sianna ginger": "SU Ginger",
  "mikayla wrigley": "ML Wrigley",
  "jess jonassen": "JL Jonassen",
  "grace harris": "GM Harris",
  "lucy bourke": "LB Bourke",
  "sarah glenn": "S Glenn",
  "lily bassingthwaighte": "L Bassingthwaighte",
  "lizelle lee": "L Lee",
  "nicola carey": "NJ Carey",
  "heather graham": "H Graham",
  "hayley silver-holmes": "H Silver-holmes",
  "molly strano": "M Strano",
  "rachel trenaman": "R Trenaman",
  "callie wilson": "C Wilson",
  "chinelle henry": "CA Henry",
  "courtney webb": "C Webb",
  "deandra dottin": "DJS Dottin",
  "georgia wareham": "G Wareham",
  "nicole faltum": "N Faltum",
  "milly illingworth": "MH Illingworth",
  "tess flintoff": "T Flintoff",
  "sophie molineux": "S Molineux",
  "naomi stalenberg": "NE Stalenberg",
  "sarah coyte": "SJ Coyte",
  "hayley matthews": "HK Matthews",
  "chloe tryon": "CL Tryon",
  "meg lanning": "MM Lanning",
  "rhys mckenna": "R McKenna",
  "amy jones": "AE Jones",
  "annabel sutherland": "A Sutherland",
  "kim garth": "KJ Garth",
  "georgia prestwidge": "G Prestwidge",
  "sophie day": "S Day",
  "katie mack": "KM Mack",
  "beth mooney": "BL Mooney",
  "sophie devine": "SFM Devine",
  "freya kemp": "FG Kemp",
  "alana king": "A King",
  "chloe ainsworth": "CC Ainsworth",
  "lilly mills": "L Mills",
  "amy edgar": "AL Edgar",
  "ruby strange": "R Strange",
  "ebony hoskin": "E Hoskin",
  "ellyse perry": "EA Perry",
  "sophia dunkley": "SIR Dunkley",
  "ashleigh gardner": "A Gardner",
  "maitlan brown": "M Brown",
  "erin burns": "EA Burns",
  "lauren cheatle": "L Cheatle",
  "caoimhe bray": "C Bray",
  "amelia kerr": "AC Kerr",
  "alice capsey": "A Capsey",
  "courtney sippel": "CG Sippel",
  "georgia voll": "G Voll",
  "tahlia wilson": "T Wilson",
  "phoebe litchfield": "P Litchfield",
  "heather knight": "HC Knight",
  "anika learoyd": "A Learoyd",
  "lucy finn": "L Finn",
  "jemma barsby": "JL Barsby",
  "nicola hancock": "NM Hancock",
  "nadine de klerk": "N de Klerk",
};

// ⛔ Players VERIFIED to have no ball-by-ball record of their own. Without this, fuzzy matching hands
// them a namesake's career: Catherine White (19, Queensland quick, 1st contract Oct 2026) was matched
// to KE White — an English player with 3 Hundred games in 2022. Keys are normName form.
export const WBBL_NO_DB_RECORD = new Set<string>([
  "catherine white",
]);

export const WBBL_TEAM_TIERS: Record<string, "A" | "B" | "C"> = {
  HUR: "A", SIX: "A", SCO: "A", STA: "B", THU: "B", REN: "B", STR: "B", HEA: "B",
};

// ── VENUES ──────────────────────────────────────────────────────────────────
// Eight grounds, all with real WBBL history (Drummoyne thinnest at 11 matches since 2021).
// DISPLAY ONLY — the engine prices on normScore1 for every tour; this feeds the team-header venue
// chip + VenueDetailModal (and stops the board falling back to the ~151k-row IPL venue scan).
// `type` is a placeholder: tour-venues.ts DERIVES the class from the women's white-ball Bat Index.
// Canonicals are the shared venue registry's (src/lib/registry/venues.json).
// NB the registry splits the WACA in two — "W.A.C.A. Ground" holds only 2015–19 rows, outside the
// recent window, so the current read is unaffected; merge upstream in wwc-points-bot when convenient.
export type VenueType = "bat_road" | "balanced" | "bowl_friendly";
const JO = "Junction Oval, Melbourne";
const NSO = "North Sydney Oval";
const BEL = "Bellerive Oval";
const WACA = "Western Australia Cricket Association Ground";
const KRO = "Karen Rolton Oval, Adelaide";
const ABF = "Allan Border Field, Brisbane";
const AO = "Adelaide Oval";
const DRU = "Drummoyne Oval";

export const WBBL_VENUES: Array<{ canonical: string; variants: string[]; type: VenueType }> = [
  { canonical: JO, variants: ["Junction Oval", "Junction Oval, Melbourne"], type: "balanced" },
  { canonical: NSO, variants: ["North Sydney Oval", "North Sydney Oval, Sydney"], type: "balanced" },
  { canonical: BEL, variants: ["Bellerive Oval", "Bellerive Oval, Hobart"], type: "balanced" },
  { canonical: WACA, variants: ["Western Australia Cricket Association Ground", "Western Australia Cricket Association Ground, Perth", "W.A.C.A. Ground"], type: "balanced" },
  { canonical: KRO, variants: ["Karen Rolton Oval", "Karen Rolton Oval, Adelaide"], type: "balanced" },
  { canonical: ABF, variants: ["Allan Border Field", "Allan Border Field, Brisbane"], type: "balanced" },
  { canonical: AO, variants: ["Adelaide Oval"], type: "balanced" },
  { canonical: DRU, variants: ["Drummoyne Oval", "Drummoyne Oval, Sydney"], type: "balanced" },
];

export const WBBL_HOME: Record<string, string> = {
  STR: KRO, HEA: ABF, HUR: BEL, REN: JO, STA: JO, SCO: WACA, SIX: NSO, THU: DRU,
};

// League-phase games per ground, counted from the published fixture list (matches 1–40). Each row
// sums to 10. Finals venues are TBC (the Final is at the top qualifier's home) — not included.
export const WBBL_TEAM_SCHEDULE: Record<string, Array<{ venue: string; games: number }>> = {
  STR: [{ venue: KRO, games: 3 }, { venue: AO, games: 1 }, { venue: DRU, games: 1 }, { venue: JO, games: 1 },
        { venue: BEL, games: 1 }, { venue: WACA, games: 1 }, { venue: ABF, games: 1 }, { venue: NSO, games: 1 }],
  HEA: [{ venue: ABF, games: 4 }, { venue: DRU, games: 2 }, { venue: JO, games: 2 }, { venue: BEL, games: 1 },
        { venue: KRO, games: 1 }],
  HUR: [{ venue: BEL, games: 4 }, { venue: ABF, games: 2 }, { venue: JO, games: 1 }, { venue: DRU, games: 1 },
        { venue: WACA, games: 1 }, { venue: KRO, games: 1 }],
  REN: [{ venue: JO, games: 6 }, { venue: WACA, games: 1 }, { venue: BEL, games: 1 }, { venue: NSO, games: 1 },
        { venue: AO, games: 1 }],
  STA: [{ venue: JO, games: 6 }, { venue: NSO, games: 2 }, { venue: KRO, games: 1 }, { venue: DRU, games: 1 }],
  SCO: [{ venue: WACA, games: 4 }, { venue: NSO, games: 2 }, { venue: JO, games: 1 }, { venue: DRU, games: 1 },
        { venue: ABF, games: 1 }, { venue: KRO, games: 1 }],
  SIX: [{ venue: NSO, games: 4 }, { venue: DRU, games: 2 }, { venue: JO, games: 2 }, { venue: ABF, games: 1 },
        { venue: KRO, games: 1 }],
  THU: [{ venue: DRU, games: 4 }, { venue: NSO, games: 2 }, { venue: JO, games: 1 }, { venue: WACA, games: 1 },
        { venue: ABF, games: 1 }, { venue: BEL, games: 1 }],
};
