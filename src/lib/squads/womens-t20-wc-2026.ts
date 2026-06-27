// Officially announced squads for the ICC Women's T20 World Cup 2026
// (England, 12 June – 5 July 2026). Major nations only (10 of 12 teams;
// associate sides Netherlands & Scotland are omitted by design — see setup).
//
// Players are ordered as the CURATED PROBABLE XI (positions 1–11, in batting
// order) followed by the 4 bench players (12–15). This order becomes the
// auction-pool squad_number, which the valuation engine uses to decide
// expected matches (XI vs bench). XIs researched from cricinfo/cricbuzz
// previews + most-recent fielded XIs (June 2026).
//
// strengthTier drives strength-weighted expected matches:
//   A = title contenders (deep knockout run expected)
//   B = mid-tier (group stage, outside semis)
//   C = lower-tier (group-stage exit expected)
//
// groupVenues = the 5 group-stage grounds each nation plays at (from the
// official ECB/ICC schedule); used by the (optional) venue-conditions model.
//
// Roles: BAT = batter, BOWL = bowler, AR = all-rounder, WK = wicketkeeper.

export type Role = "BAT" | "BOWL" | "AR" | "WK";
export type StrengthTier = "A" | "B" | "C";

export interface SquadPlayer {
  name: string; // full name as announced
  role: Role;
}

export interface WCTeam {
  name: string; // full national team name
  short: string; // short code used as ipl_team tag in the pool
  country: string; // matches players.country value in the DB
  color: string; // hex for UI
  strengthTier: StrengthTier;
  groupVenues: string[]; // 5 group-stage venues (short names)
  players: SquadPlayer[]; // XI (1–11, batting order) then bench (12–15)
}

// Size of the starting XI; squad_number <= XI_SIZE means "in the XI".
export const XI_SIZE = 11;

export const WOMENS_T20_WC_2026: WCTeam[] = [
  {
    name: "India Women",
    short: "IND",
    country: "India",
    color: "#1A75CF",
    strengthTier: "A",
    groupVenues: ["Edgbaston", "Headingley", "Old Trafford", "Old Trafford", "Lord's"],
    players: [
      { name: "Smriti Mandhana", role: "BAT" }, // 1
      { name: "Shafali Verma", role: "BAT" }, // 2
      { name: "Jemimah Rodrigues", role: "BAT" }, // 3
      { name: "Harmanpreet Kaur", role: "BAT" }, // 4
      { name: "Richa Ghosh", role: "WK" }, // 5
      { name: "Deepti Sharma", role: "AR" }, // 6
      { name: "Arundhati Reddy", role: "AR" }, // 7
      { name: "Shree Charani", role: "BOWL" }, // 8
      { name: "Radha Yadav", role: "BOWL" }, // 9
      { name: "Renuka Singh Thakur", role: "BOWL" }, // 10
      { name: "Kranti Gaud", role: "BOWL" }, // 11
      { name: "Yastika Bhatia", role: "WK" }, // 12 (bench)
      { name: "Bharti Fulmali", role: "BAT" }, // 13
      { name: "Nandani Sharma", role: "BOWL" }, // 14
      { name: "Shreyanka Patil", role: "AR" }, // 15
    ],
  },
  {
    name: "Australia Women",
    short: "AUS",
    country: "Australia",
    color: "#FFD200",
    strengthTier: "A",
    groupVenues: ["Old Trafford", "Headingley", "Rose Bowl", "Headingley", "Lord's"],
    players: [
      { name: "Beth Mooney", role: "WK" }, // 1
      { name: "Georgia Voll", role: "BAT" }, // 2
      { name: "Phoebe Litchfield", role: "BAT" }, // 3
      { name: "Ellyse Perry", role: "AR" }, // 4
      { name: "Tahlia McGrath", role: "AR" }, // 5
      { name: "Ashleigh Gardner", role: "AR" }, // 6
      { name: "Annabel Sutherland", role: "AR" }, // 7
      { name: "Sophie Molineux", role: "AR" }, // 8
      { name: "Georgia Wareham", role: "BOWL" }, // 9
      { name: "Alana King", role: "BOWL" }, // 10
      { name: "Megan Schutt", role: "BOWL" }, // 11
      { name: "Grace Harris", role: "AR" }, // 12 (bench)
      { name: "Nicola Carey", role: "AR" }, // 13
      { name: "Kim Garth", role: "BOWL" }, // 14
      { name: "Lucy Hamilton", role: "BOWL" }, // 15
    ],
  },
  {
    name: "England Women",
    short: "ENG",
    country: "England",
    color: "#012169",
    strengthTier: "A",
    groupVenues: ["Edgbaston", "Rose Bowl", "Headingley", "Lord's", "The Oval"],
    players: [
      { name: "Sophia Dunkley", role: "BAT" }, // 1
      { name: "Danni Wyatt-Hodge", role: "BAT" }, // 2
      { name: "Nat Sciver-Brunt", role: "AR" }, // 3
      { name: "Alice Capsey", role: "AR" }, // 4
      { name: "Heather Knight", role: "BAT" }, // 5
      { name: "Amy Jones", role: "WK" }, // 6
      { name: "Freya Kemp", role: "AR" }, // 7
      { name: "Charlie Dean", role: "AR" }, // 8
      { name: "Sophie Ecclestone", role: "BOWL" }, // 9
      { name: "Lauren Bell", role: "BOWL" }, // 10
      { name: "Linsey Smith", role: "BOWL" }, // 11
      { name: "Danielle Gibson", role: "AR" }, // 12 (bench)
      { name: "Issy Wong", role: "BOWL" }, // 13
      { name: "Lauren Filer", role: "BOWL" }, // 14
      { name: "Tilly Corteen-Coleman", role: "BOWL" }, // 15
    ],
  },
  {
    name: "South Africa Women",
    short: "SA",
    country: "South Africa",
    color: "#007749",
    strengthTier: "A",
    groupVenues: ["Old Trafford", "Edgbaston", "Old Trafford", "County Ground", "Lord's"],
    players: [
      { name: "Tazmin Brits", role: "BAT" }, // 1
      { name: "Laura Wolvaardt", role: "BAT" }, // 2
      { name: "Marizanne Kapp", role: "AR" }, // 3
      { name: "Annerie Dercksen", role: "AR" }, // 4
      { name: "Sune Luus", role: "BAT" }, // 5
      { name: "Nadine de Klerk", role: "AR" }, // 6
      { name: "Chloe Tryon", role: "AR" }, // 7
      { name: "Sinalo Jafta", role: "WK" }, // 8
      { name: "Ayabonga Khaka", role: "BOWL" }, // 9
      { name: "Shabnim Ismail", role: "BOWL" }, // 10
      { name: "Nonkululeko Mlaba", role: "BOWL" }, // 11
      { name: "Kayla Reyneke", role: "AR" }, // 12 (bench)
      { name: "Tumi Sekhukhune", role: "BOWL" }, // 13
      { name: "Karabo Meso", role: "WK" }, // 14
      { name: "Dane van Niekerk", role: "AR" }, // 15
    ],
  },
  {
    name: "New Zealand Women",
    short: "NZ",
    country: "New Zealand",
    color: "#111111",
    strengthTier: "A",
    groupVenues: ["Rose Bowl", "Rose Bowl", "Rose Bowl", "County Ground", "The Oval"],
    players: [
      { name: "Georgia Plimmer", role: "BAT" }, // 1
      { name: "Izzy Gaze", role: "WK" }, // 2
      { name: "Amelia Kerr", role: "AR" }, // 3
      { name: "Sophie Devine", role: "AR" }, // 4
      { name: "Brooke Halliday", role: "BAT" }, // 5
      { name: "Maddy Green", role: "BAT" }, // 6
      { name: "Izzy Sharp", role: "WK" }, // 7
      { name: "Suzie Bates", role: "BAT" }, // 8
      { name: "Jess Kerr", role: "BOWL" }, // 9
      { name: "Rosemary Mair", role: "BOWL" }, // 10
      { name: "Bree Illing", role: "BOWL" }, // 11
      { name: "Flora Devonshire", role: "AR" }, // 12 (bench)
      { name: "Polly Inglis", role: "WK" }, // 13
      { name: "Nensi Patel", role: "BOWL" }, // 14
      { name: "Lea Tahuhu", role: "BOWL" }, // 15
    ],
  },
  {
    name: "West Indies Women",
    short: "WI",
    country: "West Indies",
    color: "#7B0041",
    strengthTier: "B",
    groupVenues: ["Rose Bowl", "Headingley", "County Ground", "Lord's", "County Ground"],
    players: [
      { name: "Hayley Matthews", role: "AR" }, // 1
      { name: "Qiana Joseph", role: "BAT" }, // 2
      { name: "Jahzara Claxton", role: "BAT" }, // 3
      { name: "Stafanie Taylor", role: "AR" }, // 4
      { name: "Deandra Dottin", role: "AR" }, // 5
      { name: "Chinelle Henry", role: "AR" }, // 6
      { name: "Shemaine Campbelle", role: "WK" }, // 7
      { name: "Jannillea Glasgow", role: "AR" }, // 8
      { name: "Aaliyah Alleyne", role: "BOWL" }, // 9
      { name: "Afy Fletcher", role: "BOWL" }, // 10
      { name: "Karishma Ramharack", role: "BOWL" }, // 11
      { name: "Ashmini Munisar", role: "AR" }, // 12 (bench)
      { name: "Zaida James", role: "AR" }, // 13
      { name: "Mandy Mangru", role: "BOWL" }, // 14
      { name: "Shawnisha Hector", role: "BOWL" }, // 15
    ],
  },
  {
    name: "Pakistan Women",
    short: "PAK",
    country: "Pakistan",
    color: "#01411C",
    strengthTier: "B",
    groupVenues: ["Edgbaston", "Edgbaston", "Old Trafford", "Headingley", "County Ground"],
    players: [
      { name: "Muneeba Ali", role: "WK" }, // 1
      { name: "Gull Feroza", role: "BAT" }, // 2
      { name: "Ayesha Zafar", role: "BAT" }, // 3
      { name: "Aliya Riaz", role: "BAT" }, // 4
      { name: "Iram Javed", role: "BAT" }, // 5
      { name: "Saira Jabeen", role: "AR" }, // 6
      { name: "Fatima Sana", role: "AR" }, // 7
      { name: "Rameen Shamim", role: "AR" }, // 8
      { name: "Diana Baig", role: "BOWL" }, // 9
      { name: "Nashra Sandhu", role: "BOWL" }, // 10
      { name: "Sadia Iqbal", role: "BOWL" }, // 11
      { name: "Natalia Parvaiz", role: "BAT" }, // 12 (bench)
      { name: "Eyman Fatima", role: "BOWL" }, // 13
      { name: "Tuba Hassan", role: "BOWL" }, // 14
      { name: "Tasmia Rubab", role: "BOWL" }, // 15
    ],
  },
  {
    name: "Sri Lanka Women",
    short: "SL",
    country: "Sri Lanka",
    color: "#00534E",
    strengthTier: "B",
    groupVenues: ["Edgbaston", "Rose Bowl", "County Ground", "County Ground", "Old Trafford"],
    players: [
      { name: "Chamari Athapaththu", role: "AR" }, // 1
      { name: "Vishmi Gunarathne", role: "BAT" }, // 2
      { name: "Hasini Perera", role: "WK" }, // 3
      { name: "Harshitha Samarawickrama", role: "BAT" }, // 4
      { name: "Imesha Dulani", role: "BAT" }, // 5
      { name: "Kaveesha Dilhari", role: "AR" }, // 6
      { name: "Nilakshika Silva", role: "AR" }, // 7
      { name: "Hansima Karunaratne", role: "AR" }, // 8
      { name: "Sugandika Dasanayaka", role: "BOWL" }, // 9
      { name: "Malki Madara", role: "BOWL" }, // 10
      { name: "Nimasha Madushani", role: "BOWL" }, // 11
      { name: "Kaushini Nuthyangana", role: "WK" }, // 12 (bench)
      { name: "Shashini Gimhani", role: "BOWL" }, // 13
      { name: "Kawya Kavindi", role: "BOWL" }, // 14
      { name: "Mithali Ayodhya", role: "BAT" }, // 15
    ],
  },
  {
    name: "Bangladesh Women",
    short: "BAN",
    country: "Bangladesh",
    color: "#006A4E",
    strengthTier: "C",
    groupVenues: ["Edgbaston", "Headingley", "Old Trafford", "Old Trafford", "Lord's"],
    players: [
      { name: "Dilara Akter", role: "BAT" }, // 1
      { name: "Juairiya Ferdous", role: "BAT" }, // 2
      { name: "Sobhana Mostary", role: "BAT" }, // 3
      { name: "Nigar Sultana Joty", role: "WK" }, // 4
      { name: "Sharmin Akter Supta", role: "BAT" }, // 5
      { name: "Shorna Akter", role: "AR" }, // 6
      { name: "Ritu Moni", role: "AR" }, // 7
      { name: "Nahida Akter", role: "BOWL" }, // 8
      { name: "Rabeya Khan", role: "AR" }, // 9
      { name: "Fariha Islam Trisna", role: "BOWL" }, // 10
      { name: "Marufa Akter", role: "BOWL" }, // 11
      { name: "Fahima Khatun", role: "AR" }, // 12 (bench)
      { name: "Shanjida Akther Maghla", role: "BOWL" }, // 13
      { name: "Sultana Khatun", role: "BOWL" }, // 14
      { name: "Taj Nehar", role: "BAT" }, // 15
    ],
  },
  {
    name: "Ireland Women",
    short: "IRE",
    country: "Ireland",
    color: "#169B62",
    strengthTier: "C",
    groupVenues: ["Old Trafford", "Rose Bowl", "Rose Bowl", "County Ground", "County Ground"],
    players: [
      { name: "Amy Hunter", role: "WK" }, // 1
      { name: "Gaby Lewis", role: "BAT" }, // 2
      { name: "Orla Prendergast", role: "AR" }, // 3
      { name: "Leah Paul", role: "AR" }, // 4
      { name: "Rebecca Stokell", role: "BAT" }, // 5
      { name: "Laura Delany", role: "AR" }, // 6
      { name: "Arlene Kelly", role: "AR" }, // 7
      { name: "Cara Murray", role: "BOWL" }, // 8
      { name: "Georgina Dempsey", role: "BOWL" }, // 9
      { name: "Ava Canning", role: "BOWL" }, // 10
      { name: "Aimee Maguire", role: "BOWL" }, // 11
      { name: "Louise Little", role: "AR" }, // 12 (bench)
      { name: "Alana Dalzell", role: "BOWL" }, // 13
      { name: "Christina Coulter Reilly", role: "AR" }, // 14
      { name: "Lara McBride", role: "BAT" }, // 15
    ],
  },
  {
    name: "Scotland Women",
    short: "SCO",
    country: "Scotland",
    color: "#0065BF",
    strengthTier: "C",
    groupVenues: ["Headingley", "Old Trafford", "Old Trafford", "County Ground", "Headingley"],
    players: [
      { name: "Sarah Bryce", role: "WK" }, // 1
      { name: "Darcey Carter", role: "BAT" }, // 2
      { name: "Kathryn Bryce", role: "AR" }, // 3
      { name: "Ailsa Lister", role: "BAT" }, // 4
      { name: "Megan McColl", role: "AR" }, // 5
      { name: "Priyanaz Chatterji", role: "AR" }, // 6
      { name: "Katherine Fraser", role: "AR" }, // 7
      { name: "Abtaha Maqsood", role: "BOWL" }, // 8
      { name: "Kirstie Gordon", role: "BOWL" }, // 9
      { name: "Chloe Abel", role: "BOWL" }, // 10
      { name: "Rachel Slater", role: "BOWL" }, // 11
      { name: "Olivia Bell", role: "AR" }, // 12 (bench)
      { name: "Gabriella Fontenla", role: "BOWL" }, // 13
      { name: "Maisie Maceira", role: "BOWL" }, // 14
      { name: "Pippa Sproul", role: "WK" }, // 15
    ],
  },
  {
    name: "Netherlands Women",
    short: "NED",
    country: "Netherlands",
    color: "#FF6900",
    strengthTier: "C",
    groupVenues: ["Headingley", "County Ground", "County Ground", "Edgbaston", "Rose Bowl"],
    players: [
      { name: "Sterre Kalis", role: "BAT" }, // 1
      { name: "Heather Siegers", role: "AR" }, // 2
      { name: "Phebe Molkenboer", role: "AR" }, // 3
      { name: "Babette de Leede", role: "WK" }, // 4
      { name: "Robine Rijke", role: "AR" }, // 5
      { name: "Sanya Khurana", role: "BOWL" }, // 6
      { name: "Frederique Overdijk", role: "AR" }, // 7
      { name: "Iris Zwilling", role: "BOWL" }, // 8
      { name: "Caroline de Lange", role: "AR" }, // 9
      { name: "Silver Siegers", role: "AR" }, // 10
      { name: "Myrthe van den Raad", role: "BOWL" }, // 11
      { name: "Rosalie Ann Lawrence", role: "WK" }, // 12 (bench)
      { name: "Hannah Landheer", role: "BOWL" }, // 13
      { name: "Isabel van der Woning", role: "BOWL" }, // 14
      { name: "Lara Leemhuis", role: "BOWL" }, // 15
    ],
  },
];

// Tournament identity used to tag auctions and branch the pool/valuation logic.
export const WOMENS_T20_WC_2026_NAME = "Women's T20 WC 2026";

// Short code → strength tier, for the valuation engine's expected-matches model.
export const WC_TEAM_TIERS: Record<string, StrengthTier> = Object.fromEntries(
  WOMENS_T20_WC_2026.map((t) => [t.short, t.strengthTier])
);

// Knockout venues (semi-finals + final) from the official schedule.
export const WC_KNOCKOUT_VENUES = {
  semifinal: "The Oval",
  final: "Lord's",
};

// Extra search terms for players whose cricsheet DB name shares no word with
// their common/announced name, so fuzzy quick-sell can still find them.
// Keyed by the NORMALIZED DB name → extra searchable text (lowercase).
export const SEARCH_ALIASES: Record<string, string> = {
  // DB stores Chamari Athapaththu under her family name "AC Jayangani".
  // Include common spelling variants so any form (Athapattu/Atapattu) matches.
  "ac jayangani": "chamari athapaththu atapattu athapattu",
};
