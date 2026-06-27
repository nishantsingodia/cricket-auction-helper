// Major League Cricket (MLC) 2026 — Season 4 squads (USA, 18 Jun – 18 Jul 2026).
// 6 teams, double round-robin (each plays 10 league games) + top-4 playoffs.
//
// Players ordered as the CURATED PROBABLE XI (1–11) then depth (12+) -> squad_number.
//
// overseas: true = non-USA (USA-eligible players like Corey Anderson / Andries Gous /
//   Amila Aponso count as DOMESTIC). MLC plays only ~6 overseas per XI, but every team
//   signed 9–10, so surplus overseas rotate — modelled in mlcExpectedMatches().
//
// avail: availability for this short league (researched per player). Absent = FULL.
//   OUT  = not in 2026 squad / replaced            -> 0 matches
//   HALF = half the season only (planned swap)     -> 5
//   LATE = misses the opener (national duty)        -> 8
//   MID  = misses a mid-tournament chunk            -> 6
//   DOUBT= doubtful (fitness)                       -> 7
//   BACK = back-end risk if picked for national duty-> 9
// Final expected matches = min(overseas-cap value, availability value). See helpers.

export type Role = "BAT" | "BOWL" | "AR" | "WK";
export type StrengthTier = "A" | "B" | "C";
export type Avail = "OUT" | "COVER" | "HALF" | "LATE" | "MID" | "DOUBT" | "BACK";

export interface MLCSquadPlayer {
  name: string;
  role: Role;
  overseas: boolean;
  avail?: Avail;
  // Curated narrative availability note shown on the auction panel (tooltip +
  // player modal). When present it OVERRIDES the auto-generated terse note —
  // use it to explain the full story (series, dates, replacement/cover chain).
  note?: string;
}

export interface MLCTeam {
  name: string;
  short: string;
  color: string;
  strengthTier: StrengthTier;
  players: MLCSquadPlayer[];
}

export const MLC_XI_SIZE = 11;
export const MLC_2026_NAME = "MLC 2026";

// Squads rebuilt 19 Jun 2026 from official team rosters + post-season-start
// research (workflow mlc-2026-xi-fix). Each team: positions 1–11 are the
// EXPECTED XI = exactly 6 overseas + 5 domestic (the max-6-overseas rule);
// surplus overseas sit at 12+. "overseas" is the MLC roster DESIGNATION (false =
// drafted domestic / US-resident, regardless of birth country — e.g. Mukhtar
// Ahmed, Saif Badar, Carmi le Roux, Unmukt Chand are domestic), NOT nationality.
export const MLC_2026: MLCTeam[] = [
  {
    name: "MI New York", short: "MINY", color: "#0078BC", strengthTier: "A",
    players: [
      // XI (6 overseas + 5 domestic)
      { name: "Ryan Rickelton", role: "WK", overseas: true }, // 1
      { name: "Quinton de Kock", role: "BAT", overseas: true }, // 2
      { name: "Nicholas Pooran", role: "BAT", overseas: true }, // 3
      { name: "Monank Patel", role: "BAT", overseas: false }, // 4
      { name: "Kieron Pollard", role: "AR", overseas: true }, // 5
      { name: "Corey Anderson", role: "AR", overseas: false }, // 6
      { name: "Corbin Bosch", role: "AR", overseas: true }, // 7
      { name: "Sunny Patel", role: "AR", overseas: false }, // 8
      { name: "Nosthush Kenjige", role: "BOWL", overseas: false }, // 9
      { name: "Trent Boult", role: "BOWL", overseas: true }, // 10
      { name: "Rushil Ugarkar", role: "BOWL", overseas: false }, // 11
      // Bench (surplus overseas first)
      { name: "Romario Shepherd", role: "AR", overseas: true, note: "Watch (low risk): active WI ODI player — if picked for NZ's tour of the West Indies (ODIs Jul 11–21) he could miss MINY's closing game or two. Bench rotation player; July squad unnamed, so no value penalty applied." }, // 12
      { name: "Allah Ghazanfar", role: "BOWL", overseas: true }, // 13
      { name: "Tristan Luus", role: "BOWL", overseas: true }, // 14
      { name: "Tajinder Singh", role: "AR", overseas: false }, // 15
      { name: "Agni Chopra", role: "BAT", overseas: false }, // 16
      { name: "Kunwarjeet Singh", role: "AR", overseas: false }, // 17
      { name: "Faisal Khan Ahmadzai", role: "AR", overseas: false }, // 18
    ],
  },
  {
    name: "Washington Freedom", short: "WAF", color: "#C8102E", strengthTier: "A",
    players: [
      // XI (6 overseas + 5 domestic)
      { name: "Mitchell Owen", role: "AR", overseas: true }, // 1
      { name: "Andries Gous", role: "WK", overseas: false }, // 2
      { name: "Steven Smith", role: "BAT", overseas: true }, // 3
      { name: "Glenn Maxwell", role: "AR", overseas: true }, // 4
      { name: "Mark Chapman", role: "BAT", overseas: true, avail: "HALF", note: "First-half player only — holds WAF's overseas slot while Rachin Ravindra is away on NZ Test duty in England, then makes way when Rachin arrives in early July. Plays ~the first 5 of 10 games." }, // 5
      { name: "Mukhtar Ahmed", role: "BAT", overseas: false }, // 6 — domestic (MLC draft)
      { name: "Obus Pienaar", role: "AR", overseas: false }, // 7
      { name: "Marco Jansen", role: "AR", overseas: true }, // 8
      { name: "Ian Holland", role: "AR", overseas: false }, // 9
      { name: "Ben Dwarshuis", role: "BOWL", overseas: true }, // 10
      { name: "Saurabh Netravalkar", role: "BOWL", overseas: false }, // 11
      // Bench (surplus overseas first)
      { name: "Rachin Ravindra", role: "AR", overseas: true, avail: "HALF", note: "Second-half player — on NZ's Test tour of England (3rd Test ends Jun 29), joins WAF for the back half replacing Mark Chapman. Plays ~the last 5 games + any playoffs." }, // 12
      { name: "Lockie Ferguson", role: "BOWL", overseas: true }, // 13
      { name: "Jack Edwards", role: "AR", overseas: true }, // 14
      { name: "Nikhil Chaudhary", role: "AR", overseas: true, note: "Also on Australia T20I duty in Bangladesh (Jun 17/19/21) so misses WAF's opener — but a deep-bench squad player regardless." }, // 15
      { name: "Amila Aponso", role: "BOWL", overseas: false }, // 16
      { name: "Lahiru Milantha", role: "WK", overseas: false }, // 17
      { name: "Abhishek Paradkar", role: "BOWL", overseas: false }, // 18
    ],
  },
  {
    name: "Texas Super Kings", short: "TSK", color: "#F9CD05", strengthTier: "A",
    players: [
      // XI (6 overseas + 5 domestic)
      { name: "Smit Patel", role: "WK", overseas: false }, // 1
      { name: "Faf du Plessis", role: "BAT", overseas: true }, // 2
      { name: "Saiteja Mukkamalla", role: "BAT", overseas: false }, // 3
      { name: "Shubham Ranjane", role: "AR", overseas: false }, // 4
      { name: "Rilee Rossouw", role: "BAT", overseas: true }, // 5
      { name: "Donovan Ferreira", role: "WK", overseas: true }, // 6
      { name: "Calvin Savage", role: "AR", overseas: false }, // 7
      { name: "Akeal Hosein", role: "AR", overseas: true }, // 8
      { name: "Keshav Maharaj", role: "BOWL", overseas: true }, // 9
      { name: "Adam Milne", role: "BOWL", overseas: true, avail: "DOUBT", note: "Durability risk (not a current injury) — fit & training for the opener, but a chronic breakdown record (2025 ankle, Jan-2026 hamstring that cost him the T20 World Cup, only 1 IPL-2026 game). Expect rotation/rest — ~7 of 10." }, // 10
      { name: "Mohammad Mohsin", role: "BOWL", overseas: false }, // 11
      // Bench (surplus overseas first — XI 6th seat is a Milne/Burger/Mulder toss-up)
      { name: "Wiaan Mulder", role: "AR", overseas: true }, // 12
      { name: "Nandre Burger", role: "BOWL", overseas: true }, // 13
      { name: "Hardus Viljoen", role: "BOWL", overseas: true }, // 14
      { name: "Milind Kumar", role: "BAT", overseas: false }, // 15
      { name: "Joshua Tromp", role: "WK", overseas: false }, // 16
      { name: "Amshi de Silva", role: "AR", overseas: false }, // 17
      { name: "Abhimanyu Lamba", role: "BOWL", overseas: false }, // 18
    ],
  },
  {
    name: "San Francisco Unicorns", short: "SFU", color: "#6D2077", strengthTier: "B",
    players: [
      // XI (6 overseas + 5 domestic) — Connolly OUT (Australia duty), replaced by Esterhuizen
      { name: "Finn Allen", role: "WK", overseas: true }, // 1
      { name: "Matthew Short", role: "AR", overseas: true }, // 2
      { name: "Lhuan-dre Pretorius", role: "BAT", overseas: true }, // 3
      { name: "Connor Esterhuizen", role: "BAT", overseas: true, note: "Permanent replacement for Cooper Connolly (out all season on Australia duty) — a full-season squad member from Match 1, NOT a temporary cover. In form: Player of the Series on his Mar-2026 SA T20I debut." }, // 4
      { name: "Hammad Azam", role: "AR", overseas: false }, // 5
      { name: "Hassan Khan", role: "AR", overseas: false }, // 6
      { name: "Ravichandran Ashwin", role: "AR", overseas: true }, // 7
      { name: "Sanjay Krishnamurthi", role: "BAT", overseas: false }, // 8
      { name: "Haris Rauf", role: "BOWL", overseas: true }, // 9
      { name: "Brody Couch", role: "BOWL", overseas: false }, // 10
      { name: "Zia-ul-Haq", role: "BOWL", overseas: false }, // 11
      // Bench (Hardie & Bartlett miss opener on Australia T20I duty)
      { name: "Aaron Hardie", role: "AR", overseas: true, avail: "LATE", note: "On Australia T20I duty in Bangladesh (Chattogram, Jun 17/19/21) — misses SFU's opener + first game or two. Peter Siddle covers in the interim; Hardie joins ~late June and plays the rest (~8 of 10)." }, // 12
      { name: "Xavier Bartlett", role: "BOWL", overseas: true, avail: "LATE", note: "On Australia T20I duty in Bangladesh (Jun 17/19/21) — misses SFU's opener; Peter Siddle is his cover. Joins after the series (~Jun 24+) and plays ~8 of 10." }, // 13
      { name: "Oliver Peake", role: "BAT", overseas: true }, // 14
      { name: "Peter Siddle", role: "BOWL", overseas: true, avail: "COVER", note: "Partial-replacement signing — covers Hardie & Bartlett ONLY while they're on Australia duty (Bangladesh, Jun 17/19/21). Plays just the first 1–2 games, then makes way when they land. Not a season-long pick (~2 games)." }, // 15
      { name: "Saideep Ganesh", role: "WK", overseas: false }, // 16
      { name: "Mohammad Ilyas", role: "BOWL", overseas: false }, // 17
      { name: "Juanoy Drysdale", role: "AR", overseas: false }, // 18
    ],
  },
  {
    name: "Seattle Orcas", short: "SEO", color: "#1B9E77", strengthTier: "C",
    players: [
      // XI (6 overseas + 5 domestic)
      { name: "Tim Seifert", role: "WK", overseas: true }, // 1
      { name: "Matthew Breetzke", role: "BAT", overseas: true }, // 2
      { name: "Tim Robinson", role: "BAT", overseas: true, note: "Watch (low risk): NZ tour the West Indies for ODIs (Jul 11–21) overlapping MLC's tail. Robinson is a T20 specialist with few ODI caps, so a call-up that costs him the last 1–2 games + playoffs is possible but unconfirmed — valued as a full season for now." }, // 3
      { name: "Shimron Hetmyer", role: "BAT", overseas: true }, // 4
      { name: "Marcus Stoinis", role: "AR", overseas: true }, // 5
      { name: "Shehan Jayasuriya", role: "AR", overseas: false }, // 6
      { name: "Harmeet Singh", role: "AR", overseas: false }, // 7
      { name: "Tanveer Sangha", role: "BOWL", overseas: true, avail: "DOUBT", note: "Fitness doubt — tore his hamstring in Australia's June ODIs in Pakistan and was ruled out of the rest of that tour. Likely misses SEO's opener + early games and eases in for the back half (~6–7 of 10). Full-season signing, not a cover." }, // 8
      { name: "Cameron Gannon", role: "BOWL", overseas: false }, // 9
      { name: "Jasdeep Singh", role: "BOWL", overseas: false }, // 10
      { name: "Ayan Desai", role: "BOWL", overseas: false }, // 11
      // Bench (surplus overseas first) — Ngidi & Reifer NOT in 2026 squad
      { name: "Dasun Shanaka", role: "AR", overseas: true }, // 12
      { name: "Lutho Sipamla", role: "BOWL", overseas: true }, // 13
      { name: "Ottniel Baartman", role: "BOWL", overseas: true }, // 14
      { name: "Shayan Jahangir", role: "WK", overseas: false }, // 15
      { name: "Sharad Lumba", role: "BAT", overseas: false }, // 16
      { name: "Sujit Nayak", role: "BAT", overseas: false }, // 17
      { name: "Ali Sheikh", role: "AR", overseas: false }, // 18
    ],
  },
  {
    name: "LA Knight Riders", short: "LAKR", color: "#3A225D", strengthTier: "C",
    players: [
      // XI (6 overseas + 5 domestic) — le Roux / Saif Badar / van Schalkwyk are DOMESTIC (drafted)
      { name: "Alex Hales", role: "BAT", overseas: true }, // 1
      { name: "Unmukt Chand", role: "WK", overseas: false }, // 2
      { name: "Colin Munro", role: "BAT", overseas: true }, // 3
      { name: "Saif Badar", role: "BAT", overseas: false }, // 4
      { name: "Sherfane Rutherford", role: "AR", overseas: true, note: "Watch (low risk): active WI ODI batter — if selected for NZ's tour of the West Indies (ODIs Jul 11–21) he could miss LAKR's closing games + playoff. Unconfirmed (July squad unnamed); valued as a full season for now." }, // 5
      { name: "Andre Russell", role: "AR", overseas: true }, // 6
      { name: "Sunil Narine", role: "AR", overseas: true }, // 7
      { name: "Shadley van Schalkwyk", role: "AR", overseas: false }, // 8
      { name: "Jason Holder", role: "AR", overseas: true }, // 9
      { name: "Carmi le Roux", role: "BOWL", overseas: false }, // 10
      { name: "Ali Khan", role: "BOWL", overseas: false }, // 11
      // Bench (surplus overseas first)
      { name: "Anrich Nortje", role: "BOWL", overseas: true }, // 12
      { name: "Rovman Powell", role: "BAT", overseas: true }, // 13
      { name: "Matheesha Pathirana", role: "BOWL", overseas: true }, // 14
      { name: "Nitish Kumar", role: "AR", overseas: false }, // 15
      { name: "Jahmar Hamilton", role: "WK", overseas: false }, // 16
      { name: "Matthew Tromp", role: "BOWL", overseas: false }, // 17
      { name: "Karthik Gattepalli", role: "AR", overseas: false }, // 18
    ],
  },
];

export const MLC_TEAM_TIERS: Record<string, StrengthTier> = Object.fromEntries(
  MLC_2026.map((t) => [t.short, t.strengthTier])
);

const AVAIL_MATCHES: Record<Avail, number> = {
  OUT: 0, COVER: 2, HALF: 5, LATE: 8, MID: 6, DOUBT: 7, BACK: 8,
};
const AVAIL_NOTE: Record<Avail, string> = {
  OUT: "Out / replaced",
  COVER: "Temporary cover — plays only until the player they cover arrives",
  HALF: "Half-season only",
  LATE: "Late arrival — misses opener",
  MID: "Misses mid-tournament",
  DOUBT: "Doubtful — fitness",
  BACK: "Back-end risk (national duty)",
};

function findPlayer(teamShort: string, squadNumber: number): { team?: MLCTeam; player?: MLCSquadPlayer } {
  const team = MLC_2026.find((t) => t.short === teamShort);
  return { team, player: team?.players[squadNumber - 1] };
}

// Expected MLC matches — POSITIONAL (IPL-style), not fractional sharing.
// Each team plays 10 league games. The squad is ordered so the EXPECTED XI
// (6 overseas + 5 domestic — the max-6-overseas rule) sits at positions 1–11;
// surplus overseas (the 7th–9th, blocked by the cap) drop to the bench, where
// their value falls — exactly like IPL foreigners who don't make the cut.
//  - A researched availability tag OVERRIDES position (it already reflects the
//    games the player will actually feature in).
//  - XI (1–11): 10 games.
//  - Bench: pos 12 = 4 (first rotation/injury cover), 13–14 = 2.5, 15+ = 1.
//    (Heavier-rotation model: MLC overseas churn means surplus internationals
//    still get a few games, so they keep meaningful — but reduced — value.)
export function mlcExpectedMatches(teamShort: string, squadNumber: number): number {
  const { team, player } = findPlayer(teamShort, squadNumber);
  if (!team || !player) return squadNumber <= MLC_XI_SIZE ? 10 : 1;
  if (player.avail !== undefined) return AVAIL_MATCHES[player.avail];
  if (squadNumber <= MLC_XI_SIZE) return 10;
  if (squadNumber === 12) return 4;
  if (squadNumber <= 14) return 2.5;
  return 1;
}

// Auction-board ⚠ marker. Only set for players with an availability concern (so the
// flag stays meaningful) — full-availability players get no note. Includes overseas
// context + ~expected games so you see the impact before bidding.
export function mlcRiskNote(teamShort: string, squadNumber: number): string {
  const { player } = findPlayer(teamShort, squadNumber);
  if (!player) return "";
  // Curated narrative note wins — it tells the full story (set per player below).
  if (player.note) return player.note;
  if (player.avail === undefined) return "";
  const xm = mlcExpectedMatches(teamShort, squadNumber);
  return `${player.overseas ? "Overseas" : "USA"} · ${AVAIL_NOTE[player.avail]} (~${xm} games)`;
}

// Full name (announced) -> cricsheet/DB spelling (legal-initial / surname-disambig cases).
export const MLC_NAME_ALIASES: Record<string, string> = {
  "wiaan mulder": "PWA Mulder",
  "hardus viljoen": "GC Viljoen",
  "finn allen": "FH Allen",
  "smit patel": "SK Patel",
  // 2026 signings — disambiguate from same-surname players in the DB
  "matheesha pathirana": "M Pathirana",
  "peter siddle": "PM Siddle",
  "fabian allen": "FA Allen", // vs FH Allen (Finn)
  "shadley van schalkwyk": "SC van Schalkwyk",
  "shehan jayasuriya": "GSNFG Jayasuriya", // vs ST Jayasuriya
  "lutho sipamla": "L Sipamla",
  "connor esterhuizen": "C Esterhuizen",
  "anrich nortje": "A Nortje",
  "lhuandre pretorius": "LG Pretorius", // key is normName-stripped (hyphen removed); vs D Pretorius
};
