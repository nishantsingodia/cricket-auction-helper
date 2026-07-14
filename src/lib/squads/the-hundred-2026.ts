// The Hundred 2026 — Men's & Women's Competitions (21 Jul – 16 Aug 2026, ECB, 100-ball).
// Archetype: FRANCHISE (like MLC) but scored on the Dream11 Hundred FPS (its own `HUN`
// format in the DB) and blended onto the Hundred scale (see HUNDRED_ROLE_NORM + the engine
// Hundred branch). 8 teams, 8 group games each + playoffs. 2026 franchise-owner rebrands:
// Oval Invincibles→MI London, Manchester Originals→Manchester Super Giants,
// Northern Superchargers→Sunrisers Leeds. First-ever player auction 11-12 Mar 2026.
//
// Players ordered as the probable XI (1–11) then bench (12+) -> squad_number. XIs built to
// the 2026 rule of up to 4 overseas in the XI. `overseas` = NOT England-qualified (Scotland/
// Netherlands players are overseas here even though The Hundred counts them in local slots;
// pricing uses squad_number for expected-matches, not an overseas cap, so that's harmless).
// `captain` is informational only — the auction C/VC premium is EFPPM-driven, not the armband.
// Squads sourced Jul 2026 (Sky/ESPN/Wisden/Cricketer/Wikipedia); refine XIs/availability
// closer to the auction — this is a seed.

export type Role = "BAT" | "BOWL" | "AR" | "WK";
export type HundredVenueType = "bat_road" | "balanced" | "bowl_friendly";

// Availability (from the 2026-07-13 research pass — refine closer to the auction). OVERRIDES
// the positional expected-matches. OUT=withdrawn(0); LATE1=misses opener(7); LATE2=misses
// ~first 2 (6); EARLY=misses ~closing 3-4 + eliminator(6); DOUBT=injury monitor(6).
export type Avail = "OUT" | "LATE1" | "LATE2" | "EARLY" | "DOUBT";
export const AVAIL_MATCHES: Record<Avail, number> = {
  OUT: 0, LATE1: 7, LATE2: 6, EARLY: 6, DOUBT: 6,
};

export interface HundredSquadPlayer {
  name: string;
  role: Role;
  overseas: boolean;
  captain?: boolean;
  avail?: Avail;
  note?: string;
}

export interface HundredTeam {
  name: string;
  short: string;
  home: string; // canonical venue name (must match HUNDRED_VENUES canonical)
  color: string;
  players: HundredSquadPlayer[];
}

export const THE_HUNDRED_MEN_2026_NAME = "The Hundred Men 2026";
export const THE_HUNDRED_WOMEN_2026_NAME = "The Hundred Women 2026";
export const HUNDRED_XI_SIZE = 11;

// Per-role scale factor to convert the app's (T20/IPL/MLC) scorer to the Dream11 Hundred
// scale, MEASURED empirically (median) from 190 players with both Hundred and T20/IPL/MLC
// history on 2026-07-09. Applied to the NON-Hundred proxy form in the valuation blend.
export const HUNDRED_ROLE_NORM: Record<Role, number> = {
  BAT: 0.85,
  WK: 0.93,
  AR: 0.92,
  BOWL: 0.99,
};

// XI (1–11) plays all 8 group games; bench tapers (12=3, 13–14=2, 15+=1). A player's
// `avail` flag (availability research) OVERRIDES the positional value.
export function hundredExpectedMatches(
  teamShort: string,
  squadNumber: number,
  isWomen: boolean
): number {
  const teams = isWomen ? HUNDRED_WOMEN_2026 : HUNDRED_MEN_2026;
  const player = teams.find((t) => t.short === teamShort)?.players[squadNumber - 1];
  if (player?.avail) return AVAIL_MATCHES[player.avail];
  if (squadNumber >= 1 && squadNumber <= HUNDRED_XI_SIZE) return 8;
  if (squadNumber === 12) return 3;
  if (squadNumber <= 14) return 2;
  return 1;
}

// ── MEN'S ──────────────────────────────────────────────────────────────────
export const HUNDRED_MEN_2026: HundredTeam[] = [
  {
    name: "MI London", short: "MILO", home: "Kennington Oval, London", color: "#004B8D",
    players: [
      { name: "Jason Roy", role: "BAT", overseas: false },
      { name: "Will Jacks", role: "AR", overseas: false },
      { name: "James Vince", role: "BAT", overseas: false },
      { name: "Nicholas Pooran", role: "WK", overseas: true, avail: "LATE1", note: "MLC playoffs to ~Jul 18 → tight USA turnaround, may miss the Jul 21 opener" },
      { name: "Sherfane Rutherford", role: "AR", overseas: true },
      { name: "Sam Curran", role: "AR", overseas: false, captain: true },
      { name: "Tom Curran", role: "AR", overseas: false },
      { name: "Rashid Khan", role: "AR", overseas: true, avail: "EARLY", note: "SPECULATIVE: Afghanistan-Ireland ODIs Aug 5-14 could pull him from closing games + Aug 14 eliminator IF picked & released — unconfirmed" },
      { name: "Trent Boult", role: "BOWL", overseas: true, avail: "LATE1", note: "MLC playoffs to ~Jul 18 → may miss the Jul 21 opener" },
      { name: "Richard Gleeson", role: "BOWL", overseas: false },
      { name: "Olly Stone", role: "BOWL", overseas: false },
      { name: "Ollie Pope", role: "BAT", overseas: false },
      { name: "Callum Parkinson", role: "BOWL", overseas: false },
      { name: "Nathan Sowter", role: "BOWL", overseas: false },
      { name: "Ollie Sykes", role: "AR", overseas: false },
    ],
  },
  {
    name: "Manchester Super Giants", short: "MSG", home: "Old Trafford, Manchester", color: "#7B2D8E",
    players: [
      { name: "Jos Buttler", role: "WK", overseas: false },
      { name: "Aiden Markram", role: "BAT", overseas: true, captain: true },
      { name: "Leus du Plooy", role: "BAT", overseas: false },
      { name: "Heinrich Klaasen", role: "WK", overseas: true },
      { name: "Liam Dawson", role: "AR", overseas: false },
      { name: "Paul Walter", role: "AR", overseas: false },
      { name: "Gus Atkinson", role: "BOWL", overseas: false },
      { name: "Tom Hartley", role: "BOWL", overseas: false },
      { name: "Noor Ahmad", role: "BOWL", overseas: true, avail: "EARLY", note: "SPECULATIVE: Afghanistan-Ireland ODIs Aug 5-14 could pull him from closing games IF picked & released — unconfirmed" },
      { name: "Josh Tongue", role: "BOWL", overseas: false },
      { name: "Sonny Baker", role: "BOWL", overseas: false },
      { name: "Tim Seifert", role: "WK", overseas: true },
      { name: "Max Holden", role: "BAT", overseas: false },
      { name: "Tawanda Muyeye", role: "BAT", overseas: false },
      { name: "Tom Moores", role: "WK", overseas: false },
      { name: "George Scrimshaw", role: "BOWL", overseas: false },
    ],
  },
  {
    name: "Sunrisers Leeds", short: "SUNL", home: "Headingley, Leeds", color: "#E1523D",
    players: [
      { name: "Zak Crawley", role: "BAT", overseas: false, captain: true },
      { name: "Ryan Rickelton", role: "WK", overseas: true },
      { name: "Harry Brook", role: "BAT", overseas: false },
      { name: "Mitchell Marsh", role: "AR", overseas: true },
      { name: "Dan Lawrence", role: "BAT", overseas: false },
      { name: "Ed Barnard", role: "AR", overseas: false },
      { name: "Benny Howell", role: "AR", overseas: false },
      { name: "Brydon Carse", role: "BOWL", overseas: false },
      { name: "Nathan Ellis", role: "BOWL", overseas: true },
      { name: "Abrar Ahmed", role: "BOWL", overseas: true },
      { name: "Matthew Potts", role: "BOWL", overseas: false },
      { name: "Tom Alsop", role: "WK", overseas: false },
      { name: "Reece Topley", role: "BOWL", overseas: false },
      { name: "Liam Patterson-White", role: "AR", overseas: false },
      { name: "Tom Lawes", role: "AR", overseas: false },
    ],
  },
  {
    name: "Birmingham Phoenix", short: "BPH", home: "Edgbaston, Birmingham", color: "#EC1C6E",
    players: [
      { name: "Will Smeed", role: "BAT", overseas: false },
      { name: "Joe Clarke", role: "WK", overseas: false },
      { name: "Jacob Bethell", role: "AR", overseas: false, captain: true },
      { name: "Laurie Evans", role: "BAT", overseas: false },
      { name: "Donovan Ferreira", role: "WK", overseas: true },
      { name: "Mitchell Owen", role: "AR", overseas: true },
      { name: "Rehan Ahmed", role: "AR", overseas: false },
      { name: "Scott Currie", role: "AR", overseas: false },
      { name: "Saqib Mahmood", role: "BOWL", overseas: false },
      { name: "Mustafizur Rahman", role: "BOWL", overseas: true, avail: "DOUBT", note: "Injury monitor: grade-1 hamstring + knee (early Jul, ~4wk); later reported cleared to join. BCB full NOC (no duty clash)" },
      { name: "Usman Tariq", role: "BOWL", overseas: true, note: "England-qualification unconfirmed" },
      { name: "Jordan Thompson", role: "AR", overseas: false },
      { name: "Chris Wood", role: "BOWL", overseas: false },
      { name: "Ethan Brookes", role: "AR", overseas: false },
    ],
  },
  {
    name: "London Spirit", short: "LSP", home: "Lord's, London", color: "#2E9CCA",
    players: [
      { name: "Jonny Bairstow", role: "WK", overseas: false },
      { name: "Dewald Brevis", role: "BAT", overseas: true },
      { name: "Liam Livingstone", role: "AR", overseas: false, captain: true },
      { name: "Lhuan-dre Pretorius", role: "BAT", overseas: true },
      { name: "Adam Hose", role: "BAT", overseas: false },
      { name: "David Willey", role: "AR", overseas: false },
      { name: "Jamie Overton", role: "AR", overseas: false },
      { name: "James Coles", role: "AR", overseas: false },
      { name: "Adam Zampa", role: "BOWL", overseas: true },
      { name: "Adam Milne", role: "BOWL", overseas: true },
      { name: "Tymal Mills", role: "BOWL", overseas: false },
      { name: "James Rew", role: "WK", overseas: false },
      { name: "Mason Crane", role: "BOWL", overseas: false },
      { name: "Matthew Fisher", role: "BOWL", overseas: false },
    ],
  },
  {
    name: "Trent Rockets", short: "TRR", home: "Trent Bridge, Nottingham", color: "#F2A900",
    players: [
      { name: "Finn Allen", role: "BAT", overseas: true },
      { name: "Ben Duckett", role: "BAT", overseas: false },
      { name: "Tom Banton", role: "WK", overseas: false },
      { name: "Sam Billings", role: "WK", overseas: false, captain: true },
      { name: "Tim David", role: "AR", overseas: true },
      { name: "Lewis Gregory", role: "AR", overseas: false },
      { name: "Dan Mousley", role: "AR", overseas: false },
      { name: "Mitchell Santner", role: "AR", overseas: true, avail: "LATE1", note: "NZ captain on WI ODI tour, last ODI Jul 21 (Barbados) → likely misses the Jul 24 opener" },
      { name: "Craig Overton", role: "BOWL", overseas: false },
      { name: "Matt Henry", role: "BOWL", overseas: true },
      { name: "Mohammad Amir", role: "BOWL", overseas: false, note: "Local (British passport, retired from Pakistan — no clash) injury replacement for David Payne (ankle, ruled out)" },
      { name: "Danny Briggs", role: "BOWL", overseas: false },
      { name: "Aneurin Donald", role: "BAT", overseas: false },
      { name: "Brad Currie", role: "BOWL", overseas: false },
      { name: "Louis Kimber", role: "BAT", overseas: false },
    ],
  },
  {
    name: "Southern Brave", short: "SBR", home: "The Rose Bowl, Southampton", color: "#00A9E0",
    players: [
      { name: "Jamie Smith", role: "WK", overseas: false },
      { name: "Tristan Stubbs", role: "BAT", overseas: true },
      { name: "David Miller", role: "BAT", overseas: true },
      { name: "Marcus Stoinis", role: "AR", overseas: true, avail: "LATE1", note: "MLC playoffs to ~Jul 18 → may miss the Jul 22 opener" },
      { name: "Tom Abell", role: "AR", overseas: false },
      { name: "Michael Pepper", role: "WK", overseas: false },
      { name: "Chris Jordan", role: "BOWL", overseas: false, captain: true },
      { name: "Adil Rashid", role: "BOWL", overseas: false },
      { name: "Jofra Archer", role: "BOWL", overseas: false },
      { name: "Luke Wood", role: "BOWL", overseas: false },
      { name: "Dan Worrall", role: "BOWL", overseas: false },
      { name: "Ben McKinney", role: "BAT", overseas: false },
      { name: "Nikhil Chaudhary", role: "AR", overseas: true, note: "England-qualification unconfirmed" },
      { name: "Thomas Rew", role: "WK", overseas: false },
      { name: "Caleb Falconer", role: "BOWL", overseas: false },
    ],
  },
  {
    name: "Welsh Fire", short: "WLF", home: "Sophia Gardens, Cardiff", color: "#D71920",
    players: [
      { name: "Phil Salt", role: "WK", overseas: false, captain: true },
      { name: "Matthew Short", role: "AR", overseas: true },
      { name: "Joe Root", role: "BAT", overseas: false },
      { name: "Rachin Ravindra", role: "AR", overseas: true, avail: "LATE1", note: "MLC (Washington) playoffs to ~Jul 18 → may miss the Jul 22 opener" },
      { name: "Tom Kohler-Cadmore", role: "BAT", overseas: false },
      { name: "Chris Woakes", role: "AR", overseas: false },
      { name: "Marco Jansen", role: "AR", overseas: true },
      { name: "Ben Kellaway", role: "AR", overseas: false },
      { name: "Lockie Ferguson", role: "BOWL", overseas: true, avail: "LATE1", note: "MLC (Washington) playoffs to ~Jul 18 → may miss the Jul 22 opener" },
      { name: "Sam Cook", role: "BOWL", overseas: false },
      { name: "Jafer Chohan", role: "BOWL", overseas: false },
      { name: "Jordan Cox", role: "WK", overseas: false },
      { name: "Asa Tribe", role: "BAT", overseas: false },
      { name: "Tom Aspinwall", role: "BOWL", overseas: false },
    ],
  },
];

// ── WOMEN'S ────────────────────────────────────────────────────────────────
export const HUNDRED_WOMEN_2026: HundredTeam[] = [
  {
    name: "MI London", short: "MILO", home: "Kennington Oval, London", color: "#004B8D",
    players: [
      { name: "Hayley Matthews", role: "AR", overseas: true },
      { name: "Danni Wyatt-Hodge", role: "BAT", overseas: false },
      { name: "Amelia Kerr", role: "AR", overseas: true },
      { name: "Hollie Armitage", role: "BAT", overseas: false, captain: true },
      { name: "Chinelle Henry", role: "AR", overseas: true },
      { name: "Nicola Carey", role: "AR", overseas: true },
      { name: "Kira Chathli", role: "WK", overseas: false },
      { name: "Alice Davidson-Richards", role: "AR", overseas: false },
      { name: "Kirstie Gordon", role: "BOWL", overseas: false },
      { name: "Tara Norris", role: "BOWL", overseas: false },
      { name: "Alexa Stonehouse", role: "BOWL", overseas: false },
      { name: "Ellie Threlkeld", role: "WK", overseas: false },
      { name: "Alice Monaghan", role: "BOWL", overseas: false },
      { name: "Kalea Moore", role: "AR", overseas: false },
      { name: "Danielle Gregory", role: "BOWL", overseas: false },
    ],
  },
  {
    name: "Manchester Super Giants", short: "MSG", home: "Old Trafford, Manchester", color: "#7B2D8E",
    players: [
      { name: "Smriti Mandhana", role: "BAT", overseas: true },
      { name: "Meg Lanning", role: "BAT", overseas: true, captain: true },
      { name: "Grace Scrivens", role: "AR", overseas: false },
      { name: "Kathryn Bryce", role: "AR", overseas: true },
      { name: "Richa Ghosh", role: "WK", overseas: true },
      { name: "Paige Scholfield", role: "BAT", overseas: false },
      { name: "Mady Villiers", role: "AR", overseas: false },
      { name: "Maitlan Brown", role: "BOWL", overseas: true },
      { name: "Sophie Ecclestone", role: "BOWL", overseas: false },
      { name: "Grace Ballinger", role: "BOWL", overseas: false },
      { name: "Ryana MacDonald-Gay", role: "BOWL", overseas: false },
      { name: "Jo Gardner", role: "BAT", overseas: false },
      { name: "Rebecca Tyson", role: "BOWL", overseas: false },
      { name: "Natasha Wraith", role: "WK", overseas: false },
    ],
  },
  {
    name: "Sunrisers Leeds", short: "SUNL", home: "Headingley, Leeds", color: "#E1523D",
    players: [
      { name: "Phoebe Litchfield", role: "BAT", overseas: true },
      { name: "Lauren Winfield-Hill", role: "WK", overseas: false },
      { name: "Bryony Smith", role: "BAT", overseas: false },
      { name: "Annabel Sutherland", role: "AR", overseas: true },
      { name: "Deepti Sharma", role: "AR", overseas: true },
      { name: "Dani Gibson", role: "AR", overseas: false, captain: true },
      { name: "Jess Jonassen", role: "AR", overseas: true },
      { name: "Kate Cross", role: "BOWL", overseas: false },
      { name: "Cassidy McCarthy", role: "BOWL", overseas: false },
      { name: "Hannah Baker", role: "BOWL", overseas: false },
      { name: "Chloe Skelton", role: "BOWL", overseas: false, note: "Injury replacement for Rachel Slater (single-source, M-confidence)" },
      { name: "Katie Jones", role: "BAT", overseas: false, note: "Injury replacement for Maddie Ward (single-source, M-confidence)" },
      { name: "Emily Windsor", role: "BAT", overseas: false, note: "Injury replacement for Florence Miller (single-source, M-confidence)" },
      { name: "Claudie Cooper", role: "AR", overseas: false },
    ],
  },
  {
    name: "Birmingham Phoenix", short: "BPH", home: "Edgbaston, Birmingham", color: "#EC1C6E",
    players: [
      { name: "Tammy Beaumont", role: "WK", overseas: false },
      { name: "Davina Perrin", role: "BAT", overseas: false },
      { name: "Alice Capsey", role: "AR", overseas: false },
      { name: "Ellyse Perry", role: "AR", overseas: true, captain: true },
      { name: "Annerie Dercksen", role: "AR", overseas: true },
      { name: "Emma Lamb", role: "BAT", overseas: false },
      { name: "Meg Austin", role: "AR", overseas: false, note: "Injury replacement for Cordelia Griffith (season-ending Essex injury)" },
      { name: "Alana King", role: "BOWL", overseas: true },
      { name: "Fatima Sana", role: "AR", overseas: true, avail: "LATE2", note: "Wildcard replacement for Lucy Hamilton; Pakistan ODIs v SL Jul 23-28 (NOC to skip T20I leg) → misses first ~2 games" },
      { name: "Linsey Smith", role: "BOWL", overseas: false },
      { name: "Lauren Filer", role: "BOWL", overseas: false },
      { name: "Eva Gray", role: "AR", overseas: false },
      { name: "Jemima Spence", role: "BAT", overseas: false },
      { name: "Esmae MacGregor", role: "AR", overseas: false },
      { name: "Phoebe Brett", role: "WK", overseas: false },
    ],
  },
  {
    name: "London Spirit", short: "LSP", home: "Lord's, London", color: "#2E9CCA",
    players: [
      { name: "Amy Jones", role: "WK", overseas: false },
      { name: "Grace Harris", role: "BAT", overseas: true },
      { name: "Deandra Dottin", role: "AR", overseas: true },
      { name: "Marizanne Kapp", role: "AR", overseas: true },
      { name: "Nadine de Klerk", role: "AR", overseas: true },
      { name: "Charlie Dean", role: "AR", overseas: false, captain: true },
      { name: "Marie Kelly", role: "BAT", overseas: false },
      { name: "Sterre Kalis", role: "BAT", overseas: true },
      { name: "Katie George", role: "BOWL", overseas: false, note: "Injury replacement for Mahika Gaur (foot)" },
      { name: "Lucy Higham", role: "BOWL", overseas: false },
      { name: "Charis Pavely", role: "AR", overseas: false },
      { name: "Seren Smale", role: "WK", overseas: false },
      { name: "Hannah Rainey", role: "BOWL", overseas: false, note: "Injury replacement for Phoebe Turner (single-source, M-confidence)" },
      { name: "Josephine Groves", role: "AR", overseas: false },
    ],
  },
  {
    name: "Trent Rockets", short: "TRR", home: "Trent Bridge, Nottingham", color: "#F2A900",
    players: [
      { name: "Beth Mooney", role: "WK", overseas: true },
      { name: "Sophia Dunkley", role: "BAT", overseas: false },
      { name: "Nat Sciver-Brunt", role: "AR", overseas: false },
      { name: "Ash Gardner", role: "AR", overseas: true, captain: true },
      { name: "Georgia Elwiss", role: "AR", overseas: false },
      { name: "Kim Garth", role: "AR", overseas: true },
      { name: "Bess Heath", role: "WK", overseas: false },
      { name: "Katie Levick", role: "BOWL", overseas: false },
      { name: "Samantha Bates", role: "BOWL", overseas: true },
      { name: "Emma Jones", role: "BOWL", overseas: false },
      { name: "Millicent Taylor", role: "AR", overseas: false },
      { name: "Sophie Luff", role: "BAT", overseas: false, note: "Injury replacement for Ailsa Lister" },
      { name: "Georgia Adams", role: "AR", overseas: false },
      { name: "Charley Phillips", role: "WK", overseas: false },
    ],
  },
  {
    name: "Southern Brave", short: "SBR", home: "The Rose Bowl, Southampton", color: "#00A9E0",
    players: [
      { name: "Laura Wolvaardt", role: "BAT", overseas: true },
      { name: "Maia Bouchier", role: "BAT", overseas: false },
      { name: "Jemimah Rodrigues", role: "BAT", overseas: true },
      { name: "Lizelle Lee", role: "WK", overseas: true },
      { name: "Sophie Molineux", role: "AR", overseas: true, captain: true },
      { name: "Tilly Corteen-Coleman", role: "BAT", overseas: false },
      { name: "Phoebe Franklin", role: "AR", overseas: false },
      { name: "Sarah Glenn", role: "BOWL", overseas: false },
      { name: "Issy Wong", role: "BOWL", overseas: false },
      { name: "Lauren Bell", role: "BOWL", overseas: false },
      { name: "Jodi Grewcock", role: "BOWL", overseas: false },
      { name: "Ellie Anderson", role: "BOWL", overseas: false },
      { name: "Naomi Dattani", role: "AR", overseas: false },
      { name: "Rebecca Odgers", role: "WK", overseas: false },
    ],
  },
  {
    name: "Welsh Fire", short: "WLF", home: "Sophia Gardens, Cardiff", color: "#D71920",
    players: [
      { name: "Georgia Voll", role: "BAT", overseas: true },
      { name: "Ella McCaughan", role: "BAT", overseas: false },
      { name: "Sophie Devine", role: "AR", overseas: true, captain: true },
      { name: "Sarah Bryce", role: "WK", overseas: true },
      { name: "Freya Kemp", role: "AR", overseas: false },
      { name: "Heather Graham", role: "AR", overseas: true },
      { name: "Georgia Wareham", role: "AR", overseas: true },
      { name: "Emily Arlott", role: "BOWL", overseas: false },
      { name: "Sophia Smale", role: "BOWL", overseas: false },
      { name: "Grace Potts", role: "BOWL", overseas: false },
      { name: "Fi Morris", role: "AR", overseas: false },
      { name: "Abi Norgrove", role: "BAT", overseas: false },
      { name: "Rhianna Southby", role: "WK", overseas: false },
      { name: "Grace Thompson", role: "AR", overseas: false },
    ],
  },
];

// ── VENUES ─────────────────────────────────────────────────────────────────
// The 8 home grounds, classified on batter-FP ÷ bowler-FP over men's Hundred+T20 history
// (cricsheet name variants merged), computed 2026-07-09. All bowl-leaning (English July):
// Headingley 0.94, Old Trafford 0.90, Rose Bowl 0.88 -> balanced; Kia Oval 0.84, Trent
// Bridge 0.82, Edgbaston 0.81, Sophia Gardens 0.80, Lord's 0.77 -> bowl_friendly.
export const HUNDRED_VENUES: {
  canonical: string;
  variants: string[];
  type: HundredVenueType;
}[] = [
  { canonical: "Headingley, Leeds", variants: ["Headingley", "Headingley, Leeds"], type: "balanced" },
  { canonical: "Old Trafford, Manchester", variants: ["Old Trafford", "Old Trafford, Manchester"], type: "balanced" },
  { canonical: "The Rose Bowl, Southampton", variants: ["The Rose Bowl", "The Rose Bowl, Southampton", "Utilita Bowl, Southampton"], type: "balanced" },
  { canonical: "Kennington Oval, London", variants: ["Kennington Oval", "Kennington Oval, London"], type: "bowl_friendly" },
  { canonical: "Trent Bridge, Nottingham", variants: ["Trent Bridge", "Trent Bridge, Nottingham"], type: "bowl_friendly" },
  { canonical: "Edgbaston, Birmingham", variants: ["Edgbaston", "Edgbaston, Birmingham"], type: "bowl_friendly" },
  { canonical: "Sophia Gardens, Cardiff", variants: ["Sophia Gardens", "Sophia Gardens, Cardiff"], type: "bowl_friendly" },
  { canonical: "Lord's, London", variants: ["Lord's", "Lord's, London"], type: "bowl_friendly" },
];

// Announced name (normName form) -> exact cricsheet/DB spelling. FALLBACK for capped players
// whose registry pid has no cricsheet_id AND whose surname is fuzzy-ambiguous (many Smiths/
// Mahmoods) or nickname'd. Found via the 2026-07-10 dry-run (they were falling to statless).
export const HUNDRED_NAME_ALIASES: Record<string, string> = {
  "saqib mahmood": "S Mahmood",
  "gus atkinson": "AAP Atkinson",
  "jamie smith": "JL Smith",
  "leus du plooy": "JL du Plooy",
  "matthew fisher": "MD Fisher",
};
