// Caribbean Premier League (CPL) 2026 — the first SEVEN-team edition (7 Aug – 20 Sep 2026).
// 35 league matches (each team plays 10) across 4 regional phases + 4 playoffs at Kensington Oval.
// New for 2026: Jamaica Kingsmen (expansion franchise), the Barbados side reverts to "Tridents"
// (was Royals to 2025), and Arnos Vale (St Vincent) makes its CPL debut hosting the first 3 games.
//
// Squad rules 2026: 17 players per franchise = 9 senior West Indians + 5 overseas + 3 "breakout"
// players (at least one breakout must play every match). A few squads carry extras/reserves.
//
// Players ordered as the PROBABLE XI (1–11) then depth (12+) -> squad_number, which drives expected
// matches. CPL caps the XI at 4 overseas, so a surplus overseas player sits at 12+ where his value
// falls (same convention as the IPL/LPL builds).
//
//   overseas: true = non-West-Indian.   role: BAT / BOWL / AR / WK.
//
// SOURCES: squads cross-checked against the Wikipedia "2026 Caribbean Premier League" article AND
// Wisden's post-draft squad list (15 May 2026 draft). The two agree on all 9+3 domestic picks per
// franchise; Wikipedia additionally carries the overseas signings (direct negotiations, so they
// landed after the draft). International roles/nationalities are firm. Roles for the uncapped
// Caribbean domestics/breakouts are best-effort — they price near baseline regardless. Reorder
// squad_number in the auction panel to correct any XI.
//
// CPL is a standard 20-over franchise T20 league → modelled like MLC/LPL: its own 'CPL' format
// bucket so its games count, quality = all marquee franchise T20 + top-8 T20Is, DEFAULT 40/30/10/20
// weights (unlike LPL, CPL has genuine 2025 and 2024 seasons, so the league-season buckets are real
// and need no recency slide-back). Per-bucket small-sample shrinkage stays ON (franchise league).

export type Role = "BAT" | "BOWL" | "AR" | "WK";

export interface CPLSquadPlayer {
  name: string;
  role: Role;
  overseas: boolean;
  note?: string;
}

export interface CPLTeam {
  name: string;
  short: string;
  color: string;
  players: CPLSquadPlayer[];
}

export const CPL_XI_SIZE = 11;
export const CPL_2026_NAME = "CPL 2026";

export const CPL_2026: CPLTeam[] = [
  {
    name: "Antigua & Barbuda Falcons", short: "ABF", color: "#E23A2E",
    players: [
      // XI order anchored on ACTUAL CPL 2025 median batting positions (derived from raw cricsheet
      // ball-by-ball — see the note above CPL_2026). 2025 reads: Lewis 1, Jangoo 1, Cornwall 2,
      // Gore 3, Moeen 4, Allen 6, Springer 7.5, A Joseph 9, Seales 10.
      { name: "Evin Lewis", role: "BAT", overseas: false }, // 1  (2025: opened, pos 1)
      { name: "Kusal Perera", role: "WK", overseas: true, note: "AVAILABILITY: PLAYS 10 OF 10 — the franchise release states he is fully available for the entire tournament. ⚠️ SCENARIO: if named in Sri Lanka's Test squad for India (1st Test 15-19 Aug, 2nd 23-27 Aug) he MISSES 4 (20, 22, 23, 25 Aug) and plays 6. That squad is unannounced; the release calling him fully available is the evidence against, since franchises negotiate around known international duty." }, // 2
      { name: "Amir Jangoo", role: "WK", overseas: false }, // 3  (2025: pos 1 for Antigua)
      { name: "Moeen Ali", role: "AR", overseas: true, note: "AVAILABILITY: PLAYS ~7 OF 10 — misses the first 3 (7, 9, 14 Aug). CAPTAIN, and the franchise release said 'fully available for the entire tournament', but he then signed for Southern Brave in The Hundred as Thomas Rew's injury replacement and reporting on 3 Aug has the Falcons opening under interim leadership. IF he lands early: 10 of 10. IF Brave reach the 16 Aug final: still ~7, since ABF's 4th game is 20 Aug." }, // 4  (2025: pos 4)
      { name: "Karima Gore", role: "AR", overseas: false, note: "Breakout pick, but a 2025 regular — 10 games at median position 3." }, // 5
      { name: "Rahkeem Cornwall", role: "AR", overseas: false }, // 6  (2025: pos 2 — used up the order)
      { name: "Fabian Allen", role: "AR", overseas: false }, // 7  (2025: pos 6)
      { name: "Shamar Springer", role: "AR", overseas: false }, // 8  (2025: pos 7.5)
      { name: "Shadab Khan", role: "AR", overseas: true, note: "AVAILABILITY: PLAYS 7 OF 10 — misses 3, the ETPL runs 26 Aug – 20 Sep so the games at risk are 30 Aug, 2 Sep and 8 Sep. Stated verbatim in the franchise release ('available for seven matches')." }, // 9
      { name: "Alzarri Joseph", role: "BOWL", overseas: false }, // 10 (2025: pos 9)
      { name: "Jayden Seales", role: "BOWL", overseas: false }, // 11 (2025: pos 10)
      // Depth
      { name: "Sufyan Moqim", role: "BOWL", overseas: true, note: "AVAILABILITY: PLAYS 7 OF 10 — misses 3 (30 Aug, 2 Sep, 8 Sep) for the ETPL. Stated verbatim in the franchise release." }, // 12
      { name: "Anderson Phillip", role: "BOWL", overseas: false }, // 13
      { name: "Jahmar Hamilton", role: "WK", overseas: false }, // 14
      { name: "Milind Kumar", role: "BAT", overseas: true, note: "AVAILABILITY: PLAYS 3 OF 10 — MISSES 7. Available for the first three matches only (7, 9, 14 Aug), per the franchise release. A short-stint cover signing, not a full-campaign player — price him as ~a third of a season." }, // 15
      { name: "Tajinder Singh", role: "BAT", overseas: true, note: "AVAILABILITY: PLAYS 3 OF 10 — MISSES 7. First three matches only (7, 9, 14 Aug), per the franchise release." }, // 16
      { name: "Anderson Mahase", role: "BOWL", overseas: false, note: "Breakout pick — leg-spinner." }, // 17
      { name: "Joshua James", role: "BOWL", overseas: false, note: "Breakout pick." }, // 18
    ],
  },
  {
    name: "Barbados Tridents", short: "BAR", color: "#1E3A8A",
    players: [
      // XI — 4 overseas: de Kock, Sams, Green, Mujeeb. Order matches the ACTUAL CPL 2025 medians
      // (de Kock 1, King 2, Alleyne 3, Rutherford 5, Green 7, Sams 8, Motie 9, Simmonds 10.5).
      { name: "Quinton de Kock", role: "WK", overseas: true }, // 1  (2025: pos 1, 9 games)
      { name: "Brandon King", role: "BAT", overseas: false }, // 2  (2025: pos 2)
      { name: "Kadeem Alleyne", role: "BAT", overseas: false }, // 3  (2025: pos 3 — batted ABOVE Rutherford)
      { name: "Sherfane Rutherford", role: "BAT", overseas: false, note: "AVAILABILITY: PLAYS 10 OF 10 — he WAS in MI London's Hundred squad but has been REPLACED there (Josh Philippe in), so he is free for the whole CPL campaign. No clash." }, // 4  (2025: pos 5)
      { name: "Daniel Sams", role: "AR", overseas: true }, // 5
      { name: "Chris Green", role: "AR", overseas: true }, // 6
      { name: "Gudakesh Motie", role: "BOWL", overseas: false, note: "Signed from Guyana after five seasons at his home franchise." }, // 7
      { name: "Mujeeb Ur Rahman", role: "BOWL", overseas: true }, // 8
      { name: "Zachary Carter", role: "BOWL", overseas: false }, // 9
      { name: "Ramon Simmonds", role: "BOWL", overseas: false, note: "Retained." }, // 10
      { name: "Johann Layne", role: "BOWL", overseas: false, note: "Breakout pick." }, // 11
      // Depth
      { name: "George Linde", role: "AR", overseas: true }, // 12
      { name: "Rivaldo Clarke", role: "WK", overseas: false }, // 13
      { name: "Shadrack Descarte", role: "AR", overseas: false }, // 14
      { name: "Zishan Motara", role: "BOWL", overseas: false }, // 15
      { name: "Jakeem Pollard", role: "AR", overseas: false, note: "Breakout pick — NOT Kieron Pollard (no shared stats record)." }, // 16
      { name: "Kofi James", role: "AR", overseas: false, note: "Breakout pick." }, // 17
    ],
  },
  {
    name: "Guyana Amazon Warriors", short: "GAW", color: "#F5A623",
    players: [
      // XI — 4 of the 5 overseas (Gurbaz, Phillips, Nabi, Tahir) play; Pretorius is the surplus.
      // 2025 medians: Hope 3, Hetmyer 4, Shepherd 7, Pretorius 7, Sampson 8, Pierre 8, S Joseph 10,
      // Tahir 11. Imran Tahir captains (as in 2025) and was the league's leading wicket-taker with
      // 23 in 12 — hence the bowlers sit high in this order despite batting low.
      { name: "Rahmanullah Gurbaz", role: "WK", overseas: true, note: "AVAILABILITY: PLAYS 9 OF 10 — misses 1 (13 Aug). Vice-captain/keeper on Afghanistan's 5-ODI tour of Ireland (5-15 Aug); GAW are fortunate that only one league game falls inside that window. IF he skips the tour: 10 of 10." }, // 1
      { name: "Shai Hope", role: "WK", overseas: false }, // 2  (2025: pos 3, all 12 games)
      { name: "Glenn Phillips", role: "BAT", overseas: true, note: "AVAILABILITY: assumed 10 OF 10, but returning from a side injury — reported on track to be fit. SCENARIO: a delayed return costs him GAW's early games at 1 per week (13, 19, 23 Aug), so a fortnight's setback = ~7 of 10. Worth a second look before you bid." }, // 3
      { name: "Shimron Hetmyer", role: "BAT", overseas: false }, // 4  (2025: pos 4, all 12)
      { name: "Mohammad Nabi", role: "AR", overseas: true }, // 5
      { name: "Romario Shepherd", role: "AR", overseas: false }, // 6  (2025: pos 7, bowled all 12)
      { name: "Quentin Sampson", role: "AR", overseas: false, note: "Listed as a breakout pick but he is a 2025 REGULAR — 9 games at median position 8. T20Tracker lists him at the top of Guyana's squad. Promoted out of the reserves accordingly." }, // 7
      { name: "Imran Tahir", role: "BOWL", overseas: true, note: "CAPTAIN. 47 years old, re-signed for a 14th CPL season; led the league with 23 wickets in 12 games in 2025." }, // 8
      { name: "Shamar Joseph", role: "BOWL", overseas: false }, // 9
      { name: "Khary Pierre", role: "BOWL", overseas: false }, // 10 (2025: 10 games for St Lucia)
      { name: "Veerasammy Permaul", role: "BOWL", overseas: false }, // 11
      // Depth
      { name: "Dwaine Pretorius", role: "AR", overseas: true, note: "The 5th overseas player and only 4 can field, so he ROTATES rather than starts — expect roughly 4-6 of 10 depending on team balance, not a full campaign. Was a 2025 regular though (12 games, median pos 7)." }, // 12
      { name: "Matthew Nandu", role: "AR", overseas: false }, // 13
      { name: "Ronaldo Alimohamed", role: "AR", overseas: false }, // 14
      { name: "Jonathan van Lange", role: "BOWL", overseas: false }, // 15
      { name: "Isai Thorne", role: "BOWL", overseas: false, note: "Breakout pick." }, // 16
      { name: "Mavendra Dindiyal", role: "BAT", overseas: false, note: "Breakout pick." }, // 17
    ],
  },
  {
    name: "Jamaica Kingsmen", short: "JAM", color: "#0E7C3A",
    players: [
      // Expansion franchise, and the squad most distorted by PHASED overseas rotation. The Kingsmen
      // signed TWO overseas groups: Jahangir + Arif for phase 1 (start → 18 Aug, 5 games), then
      // Saim Ayub + Maaz Sadaqat + Usman Khan take their places "from 19 August" (5 games). Hassan
      // Khan and Hunain Shah span the whole tournament. So NO single XI is right for all 10 games —
      // this order is the PHASE-1 XI (the first 5 games), and CPL_EXPECTED_GAMES carries the real
      // game counts for the phase players so their value doesn't ride on squad_number.
      // 2025 reads (from raw ball-by-ball): Carty 4, Parris 4, Hassan Khan 5, Powell 6, Paul 6,
      // Russell 6.5, O Smith 7.
      { name: "Shayan Jahangir", role: "WK", overseas: true, note: "AVAILABILITY: PLAYS 5 OF 10 — MISSES 5. Phase 1 only: plays 7, 11, 13, 15 and 18 Aug, then hands his place to Saim Ayub / Usman Khan from 19 Aug (franchise release)." }, // 1
      { name: "Keacy Carty", role: "BAT", overseas: false }, // 2  (2025: pos 4)
      { name: "Shaqkere Parris", role: "BAT", overseas: false }, // 3  (2025: pos 4)
      { name: "Rovman Powell", role: "BAT", overseas: false, note: "CAPTAIN; first pick of the expansion draft. (2025: pos 6.)" }, // 4
      { name: "Kirk McKenzie", role: "BAT", overseas: false, note: "Breakout pick." }, // 5
      { name: "Andre Russell", role: "AR", overseas: false }, // 6  (2025: pos 6.5, bowled 11/11)
      { name: "Keemo Paul", role: "AR", overseas: false }, // 7  (2025: pos 6)
      { name: "Hassan Khan", role: "AR", overseas: true, note: "AVAILABILITY: PLAYS 10 OF 10 — fully available for the entire tournament (franchise release). USA-qualified per T20Tracker." }, // 8  (2025: pos 5)
      { name: "Odean Smith", role: "AR", overseas: false }, // 9  (2025: pos 7)
      { name: "Hunain Shah", role: "BOWL", overseas: true, note: "AVAILABILITY: PLAYS 10 OF 10 — fully available for the entire tournament (franchise release)." }, // 10
      { name: "Jediah Blades", role: "BOWL", overseas: false }, // 11
      // Depth + the phase-2 overseas group (each ~5 games from 19 Aug — see CPL_EXPECTED_GAMES)
      { name: "Saim Ayub", role: "BAT", overseas: true, note: "AVAILABILITY: PLAYS 5 OF 10 — MISSES the first 5. Joins from 19 Aug (franchise release), so his games are 21, 27, 31 Aug, 4 and 12 Sep. Marquee bat, but you are buying half a campaign." }, // 12
      { name: "Usman Khan", role: "WK", overseas: true, note: "AVAILABILITY: PLAYS 5 OF 10 — MISSES the first 5. Joins from 19 Aug (franchise release): 21, 27, 31 Aug, 4 and 12 Sep." }, // 13
      { name: "Maaz Sadaqat", role: "AR", overseas: true, note: "PHASE 2 — joins from 19 Aug, ~5 of 10 games." }, // 14
      { name: "Reeza Hendricks", role: "BAT", overseas: true, note: "AVAILABILITY: PLAYS ~5 OF 10 — a later SA signing (announced after the franchise's overseas release); T20Tracker has him taking Usman Khan's phase-2 slot, so 21 Aug onward. Phase unconfirmed by the franchise, so treat 5 as the estimate." }, // 15
      { name: "Tayyab Arif", role: "BOWL", overseas: true, note: "AVAILABILITY: PLAYS 5 OF 10 — MISSES 5. Phase 1 only: 7, 11, 13, 15, 18 Aug, then replaced from 19 Aug (franchise release)." }, // 16
      { name: "Vitel Lawes", role: "BOWL", overseas: false, note: "U19 World Cup leg-spinner; third pick of the expansion draft. No senior ball-by-ball in our data — prices at baseline." }, // 17
      { name: "Romaine Morris", role: "BOWL", overseas: false }, // 18
      { name: "Kelvin Pitman", role: "BOWL", overseas: false, note: "Breakout pick." }, // 19
      { name: "Jeavor Royal", role: "AR", overseas: false, note: "Breakout pick." }, // 20
    ],
  },
  {
    name: "St Kitts & Nevis Patriots", short: "SKN", color: "#7C3AED",
    players: [
      // XI — 4 overseas: Shanaka, Hasaranga, Naseem, Salamkheil
      { name: "Johnson Charles", role: "WK", overseas: false }, // 1
      { name: "Mikyle Louis", role: "BAT", overseas: false, note: "Breakout pick." }, // 2
      { name: "Alick Athanaze", role: "BAT", overseas: false }, // 3
      { name: "Kyle Mayers", role: "AR", overseas: false }, // 4
      { name: "Dasun Shanaka", role: "AR", overseas: true }, // 5
      { name: "Jason Holder", role: "AR", overseas: false }, // 6
      { name: "Wanindu Hasaranga", role: "AR", overseas: true, note: "AVAILABILITY: assumed 10 OF 10. Two clashes, both checked. (1) LPL knockouts run to ~8 Aug and SKN's opener IS 8 Aug — SCENARIO: if Kandy reach the final he misses 1 (8 Aug) and plays 9. (2) Sri Lanka tour England 15-27 Sep, i.e. after the 13 Sep league finish — costs PLAYOFF availability only, which this model already excludes, so 0 league games. He has retired from Tests, so the India Tests do NOT affect him." }, // 7
      { name: "Naseem Shah", role: "BOWL", overseas: true }, // 8  (2025: 10 games, pos 9)
      { name: "Obed McCoy", role: "BOWL", overseas: false }, // 9
      { name: "Ashmead Nedd", role: "BOWL", overseas: false }, // 10
      { name: "Waqar Salamkheil", role: "BOWL", overseas: true }, // 11
      // Depth. 2025 medians: Fletcher 2 (10 games), Wickham 4, Bidaisee 7 (7 games) — all three are
      // established squad members rather than fringe, hence the order here.
      { name: "Navin Bidaisee", role: "AR", overseas: false, note: "Breakout pick on paper but a 2025 regular — 7 games, median position 7, bowled in all 7." }, // 12
      { name: "Andre Fletcher", role: "WK", overseas: false, note: "2025 regular (10 games, opened at pos 2) but squeezed by Johnson Charles keeping." }, // 13
      { name: "Nikhil Chaudhary", role: "AR", overseas: true, note: "AVAILABILITY: assumed 10 OF 10, not discounted (no franchise caveat). SCENARIO: in Southern Brave's Hundred squad, which ran to ~16 Aug — if he stays to the end he MISSES 2 (8, 12 Aug) and plays 8. Bench player, so the value at stake is small." }, // 14
      { name: "Kevin Wickham", role: "BAT", overseas: false }, // 15
      { name: "Jeremiah Louis", role: "BOWL", overseas: false }, // 16
      { name: "Micah McKenzie", role: "BOWL", overseas: false, note: "Breakout pick — NOT Kirk McKenzie (JAM) or Neil McKenzie (SA)." }, // 17
    ],
  },
  {
    name: "Saint Lucia Kings", short: "SLK", color: "#0891B2",
    players: [
      // XI — 4 overseas: Seifert, Asalanka, Noor Ahmad, Theekshana
      // 2025 medians: Seifert 1 (10 games), Andrew 1, Auguste 3 (10 games), Chase 4.
      // ⚠️ SLK carry the WORST fixture exposure to The Hundred: they play FOUR league games before
      // the Hundred final (9, 12, 14, 16 Aug) and two of their overseas XI (Seifert, Noor Ahmad)
      // were in Manchester Super Giants' squad. The franchise published no caveat, so both are left
      // at full 10 games — this is the single biggest unpriced availability risk in the pool.
      { name: "Tim Seifert", role: "WK", overseas: true, note: "AVAILABILITY: assumed 10 OF 10 but ⚠️ THE BIGGEST UNPRICED RISK IN THE POOL. In Manchester Super Giants' Hundred squad (3 games as of 29 Jul) and the Hundred runs to ~16 Aug, while SLK play FOUR league games before then (9, 12, 14, 16 Aug). SCENARIO: stays for the Hundred = MISSES 4, plays 6. Leaves early = 10. No franchise caveat published, so not discounted — but this is the one to check before bidding." }, // 1
      { name: "Ackeem Auguste", role: "BAT", overseas: false, note: "Breakout pick but a 2025 regular — 10 games at median position 3." }, // 2
      { name: "Charith Asalanka", role: "BAT", overseas: true, note: "AVAILABILITY: assumed 10 OF 10. THREE clashes checked. (1) LPL knockouts to ~8 Aug vs SLK's 9 Aug opener — if Galle reach the final he MISSES 1, plays 9. (2) ⚠️ India's 2 Tests in Sri Lanka, 15-19 and 23-27 Aug: IF he is in that Test squad he MISSES 4 (16, 19, 21, 26 Aug) and plays 6. Squad unannounced; he is SL's white-ball captain and not a current Test pick, which is the evidence against. (3) SL tour England 15-27 Sep = playoffs only, 0 league games." }, // 3
      { name: "Jewel Andrew", role: "WK", overseas: false }, // 4  (2025: pos 1 for Antigua)
      { name: "Roston Chase", role: "AR", overseas: false, note: "CAPTAIN. 2025: 10 games, pos 4, bowled in 9." }, // 5
      { name: "Kamil Pooran", role: "BAT", overseas: false, note: "NOT Nicholas Pooran (TKR) — no shared stats record." }, // 6
      { name: "Matthew Forde", role: "AR", overseas: false }, // 7
      { name: "Noor Ahmad", role: "BOWL", overseas: true, note: "AVAILABILITY: assumed 10 OF 10 but ⚠️ same 4-game exposure as Seifert — Manchester Super Giants in the Hundred to ~16 Aug vs SLK's games on 9, 12, 14 and 16 Aug. SCENARIO: stays = MISSES 4, plays 6. Not discounted (no franchise caveat)." }, // 8
      { name: "Maheesh Theekshana", role: "BOWL", overseas: true, note: "AVAILABILITY: assumed 10 OF 10. (1) LPL knockouts to ~8 Aug vs SLK's 9 Aug opener — worst case MISSES 1. (2) ⚠️ India's 2 Tests in Sri Lanka 15-19 and 23-27 Aug: IF selected he MISSES 4 (16, 19, 21, 26 Aug) and plays 6 — but he is a white-ball specialist, so unlikely. (3) SL tour England 15-27 Sep = playoffs only, 0 league games." }, // 9
      { name: "Joshua Bishop", role: "BOWL", overseas: false }, // 10
      { name: "McKenny Clarke", role: "BOWL", overseas: false }, // 11
      // Depth
      { name: "Shadley van Schalkwyk", role: "AR", overseas: true }, // 12
      { name: "Keon Gaston", role: "BOWL", overseas: false }, // 13
      { name: "Darron Nedd", role: "BAT", overseas: false, note: "NOT Ashmead Nedd (SKN)." }, // 14
      { name: "Amari Goodridge", role: "BAT", overseas: false, note: "Breakout pick." }, // 15
      { name: "Johann Jeremiah", role: "BOWL", overseas: false, note: "Breakout pick." }, // 16
      { name: "Damion Joachim", role: "BOWL", overseas: false, note: "Breakout pick." }, // 17
    ],
  },
  {
    name: "Trinbago Knight Riders", short: "TKR", color: "#8B1A1A",
    players: [
      // Defending champions (record 5th title in 2025). XI — 4 overseas: Munro, Hales, Breetzke,
      // Usman Tariq. RMOs used to re-sign Narine, Pooran, Pollard, Hosein and Hinds.
      // Order corrected to the ACTUAL CPL 2025 medians over a full 13-game campaign — MUNRO opened
      // (pos 1, 13 innings), Hales 2, Pooran 4 (not 2, as I first had it), Pollard 5, Hosein 7,
      // Narine 8, Tariq 11.
      { name: "Colin Munro", role: "BAT", overseas: true }, // 1  (2025: pos 1, all 13 games)
      { name: "Alex Hales", role: "BAT", overseas: true }, // 2  (2025: pos 2, all 13)
      { name: "Matthew Breetzke", role: "BAT", overseas: true }, // 3  new signing
      { name: "Nicholas Pooran", role: "WK", overseas: false, note: "AVAILABILITY: assumed 10 OF 10, not discounted (no franchise caveat). CAPTAIN & keeper. SCENARIO: in MI London's Hundred squad (4 games as of 29 Jul), which ran to ~16 Aug — if he stays to the end he MISSES 2 (8, 15 Aug) and plays 8. As captain, TKR will want him from game 1." }, // 4  (2025: pos 4, all 13)
      { name: "Kieron Pollard", role: "AR", overseas: false }, // 5  (2025: pos 5)
      { name: "Justin Greaves", role: "AR", overseas: false }, // 6
      { name: "Akeal Hosein", role: "BOWL", overseas: false }, // 7  (2025: pos 7, bowled all 13)
      { name: "Sunil Narine", role: "AR", overseas: false }, // 8  (2025: pos 8, bowled all 13)
      { name: "Dominic Drakes", role: "AR", overseas: false }, // 9
      { name: "Usman Tariq", role: "BOWL", overseas: true, note: "AVAILABILITY: assumed 10 OF 10 but the clearest doubt in this XI. Leading wicket-taker for TKR in 2025 (20 in 10). Signed by Birmingham Phoenix for the Hundred and ESPNcricinfo explicitly flags it 'remains to be seen' whether he makes all of TKR's games. SCENARIO: stays for the Hundred = MISSES 2 (8, 15 Aug), plays 8. Not discounted, no franchise caveat." }, // 10
      { name: "Terrance Hinds", role: "BOWL", overseas: false }, // 11
      // Depth
      { name: "Joshua Da Silva", role: "WK", overseas: false, note: "Breakout pick." }, // 12
      { name: "Jyd Goolie", role: "BAT", overseas: false }, // 13
      { name: "Amshi de Silva", role: "BOWL", overseas: true, note: "Sri Lankan leg-spinner — NOT Joshua Da Silva (TKR)." }, // 14
      { name: "Dexter Sween", role: "BAT", overseas: false }, // 15
      { name: "Nathan Edward", role: "BOWL", overseas: false, note: "Breakout pick." }, // 16
      { name: "Abdul-Raheem Toppin", role: "AR", overseas: false, note: "Breakout pick." }, // 17
    ],
  },
];

// Expected CPL matches — POSITIONAL (IPL-style), not fractional sharing.
// CPL has NO Impact Player rule, so exactly 11 feature per game (unlike LPL/IPL's featuring XII).
// Each team plays 10 league games; playoffs (top 4, Kensington Oval) are treated as UPSIDE and
// excluded, the same convention as every other tour here. Squads are deep (17–19), so depth tapers
// hard: 12–14 are the realistic rotation/injury cover, 15+ are reserves.
//  - Probable XI (1–11): 10 games.
//  - Rotation cover (12–14): 2 games.
//  - Reserves (15+): 1 game.
export function cplExpectedMatches(squadNumber: number): number {
  if (squadNumber <= 11) return 10;
  if (squadNumber <= 14) return 2;
  return 1;
}

// ⚠️ PHASED OVERSEAS ROTATION — the big availability story of CPL 2026, and the reason this tour
// needs an ABSOLUTE override rather than LPL's "games missed" subtraction. Because CPL overlaps The
// Hundred (to ~15-16 Aug), the ETPL (26 Aug – 20 Sep) AND the LPL knockouts, two franchises signed
// their overseas players in PHASES and said so publicly. A phase player's real game count is not
// derivable from squad_number at all: Milind Kumar is a "bench" number who plays the first 3, while
// Shadab Khan is an XI number who plays only 7. So this map is the AUTHORITY where present, keyed by
// DB (cricsheet) spelling normalized to lowercase-alphanumeric, and it OVERRIDES the positional
// default in both directions.
//
// SOURCED from the official CPL franchise releases (cplt20.prezly.com), which state windows verbatim:
//   Falcons  — Milind Kumar & Tajinder Singh "available for the first three matches of the campaign";
//              Shadab Khan & Sufiyan Muqeem "available for seven matches during the tournament";
//              Moeen Ali & Kusal Perera "fully available for the entire tournament".
//   Kingsmen — Hassan Khan & Hunain Shah "fully available"; Shayan Jahangir & Tayyab Arif "link up
//              with the team at the start of the season"; Saim Ayub, Maaz Sadaqat & Usman Khan join
//              "from 19 August", moving into the places held by Jahangir and Arif.
// Jamaica play 5 league games before 19 Aug (7, 11, 13, 15, 18 Aug) and 5 from 21 Aug — hence 5/5.
// The other five franchises published NO availability caveats, so their players default to 10.
//
// INTERNATIONAL CALENDAR AUDIT (5 Aug 2026) — franchise releases do NOT mention national duty, so
// the Aug-Sep fixture list was checked separately. Three tours overlap the CPL window; only one bites:
//   * Afghanistan in Ireland, 5 ODIs, 5-15 Aug -> ONLY Rahmanullah Gurbaz is in that squad. Nabi,
//     Mujeeb, Noor Ahmad and Salamkheil are CPL Afghans but are NOT selected. GAW play one league
//     game in the window (13 Aug) -> Gurbaz 9 of 10.
//   * Pakistan in England, 3 Tests, 19 Aug-13 Sep -> NONE of the eight CPL Pakistanis are in the Test
//     squad (Babar, Shan Masood, Rizwan, Abbas, Sajid Khan et al). No impact.
//   * Sri Lanka in England, 15-27 Sep -> starts AFTER the CPL league stage ends on 13 Sep. Costs
//     playoff availability for Hasaranga / Asalanka / Theekshana / Shanaka only, and playoffs are
//     already excluded from expected matches. No league-phase discount.
//   * India in Sri Lanka, 2 TESTS, 15-19 Aug (Galle) + 23-27 Aug (Colombo) -> ⚠️ THE ONE OPEN RISK.
//     Sri Lanka's squad is NOT published yet (India's is: Gill captain). If Kusal Perera (ABF) or
//     Asalanka / Theekshana (SLK) are picked they lose FOUR league games each -- ABF play 20, 22, 23
//     and 25 Aug; SLK play 16, 19, 21 and 26 Aug. Not priced in, because the read is that they are
//     safe: ABF's release calls Kusal Perera "fully available for the entire tournament" and
//     franchises negotiate around known international duty; Asalanka is SL's WHITE-BALL captain and
//     not a current Test pick; Theekshana is a white-ball specialist; Hasaranga has retired from
//     Tests. WATCH for the SL squad announcement -- if any of them is in it, set 6 here.
//   * Full sweep of the window (7 Aug - 20 Sep) for completeness, all checked and clear: Scotland
//     Tri-Nation ODIs (no Scots in pool), CWC Challenge League B in Tanzania, Namibia T20I
//     Tri-Nation (no Namibians), Bangladesh in Australia 2 Tests from 13 Aug (no Bangladeshis),
//     Women's T20 Asia Cup / Ireland women in England / SA women in Zimbabwe (women's), and the
//     Asian Games 17-24 Sep (playoff window only, and second-string squads).
//     Sri Lanka's tour of the WEST INDIES was 3 Jun - 7 Jul, i.e. finished before CPL starts.
//   * Mohammad Nabi is NOT in Afghanistan's 15-man Ireland squad (verified against the full list) --
//     he is 41 and effectively T20-franchise-only now. Same for Mujeeb, Noor Ahmad, Salamkheil.
// RE-CHECK if a mid-tour call-up or a newly-announced squad appears; late replacements are normal.
const CPL_EXPECTED_GAMES: Record<string, number> = {
  // Antigua & Barbuda Falcons
  milindkumar: 3, // first 3 matches only
  tajindersingh: 3, // first 3 matches only
  shadabkhan: 7, // 7 of 10 (ETPL — Edinburgh Castle Rockers)
  sufiyanmuqeem: 7, // 7 of 10 (ETPL)
  mmali: 7, // Moeen Ali — see note on his squad entry: the Falcons release said "fully available",
  // but he subsequently signed for Southern Brave in The Hundred (Thomas Rew's ankle injury) and
  // reporting on 3 Aug says the Falcons start under interim leadership. ABF play 3 games before the
  // Hundred final (7, 9, 14 Aug), so 7 is the availability-consistent figure. Revise to 10 if he
  // actually lands early.
  // Guyana Amazon Warriors — INTERNATIONAL clash (checked 5 Aug 2026 against the actual calendar)
  rahmanullahgurbaz: 9, // Afghanistan's 5-ODI tour of Ireland runs 5-15 Aug and Gurbaz is in that
  // squad as vice-captain/keeper. GAW play just ONE league game inside that window (13 Aug), so the
  // hit is small: 1 game, allowing 9 of 10. Nabi, Mujeeb, Noor Ahmad and Salamkheil are all CPL
  // Afghans but are NOT in the Ireland squad, so they are unaffected.
  // Jamaica Kingsmen — phase 1 (start → 18 Aug) is 5 games, phase 2 (from 19 Aug) is 5 games
  shayanjahangir: 5,
  tayyabarif: 5,
  saimayub: 5,
  maazsadaqat: 5,
  usmankhan: 5,
  rrhendricks: 5, // "RR Hendricks" (269280, 192m) — later signing; T20Tracker lists him taking Usman Khan's phase-2 place
};

// Expected LEAGUE matches for a CPL player: the published phase window if we have one, else the
// positional default. (LPL's equivalent only ever subtracted; CPL genuinely needs both directions.)
export function cplExpectedMatchesFor(dbName: string, squadNumber: number): number {
  const key = (dbName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const override = CPL_EXPECTED_GAMES[key];
  if (override !== undefined) return override;
  return cplExpectedMatches(squadNumber);
}

// Full name (announced) -> cricsheet/DB spelling. Registry-first resolution + fuzzy handle most of
// the pool; these cover verified cricsheet spelling quirks AND — critically — let a STAR claim its
// record in the builder's exact pass-1 before fuzzy can hand it to a same-surname squadmate who has
// no record of his own (CPL 2026 is full of these: Kieron/Jakeem Pollard, Nicholas/Kamil Pooran,
// Ashmead/Darron Nedd, Kirk/Micah McKenzie, Joshua Da Silva/Amshi de Silva, Alzarri/Shamar Joseph).
// (Keys are normName-stripped: lowercase, punctuation/diacritics removed.)
export const CPL_NAME_ALIASES: Record<string, string> = {
  // Verified against the DB (name, cricinfo id, career matches):
  "kusal perera": "MDKJ Perera",       // 300631, 279m — the STAR keeper; must not fuzz to NLTC Perera (Thisara, 370m)
  "sufyan moqim": "Sufiyan Muqeem",    // 1329697, 44m — cricsheet spells it Sufiyan Muqeem
  "glenn phillips": "GD Phillips",     // 823509, 274m — NOT DN Phillips (Dale)
  "kieron pollard": "KA Pollard",      // 230559, 713m — claim before Jakeem Pollard can fuzz onto it
  "nicholas pooran": "N Pooran",       // 604302, 503m — claim before Kamil Pooran can fuzz onto it
  "alzarri joseph": "AS Joseph",       // 670031, 247m
  "shamar joseph": "S Joseph",         // 1356971, 46m
  "ashmead nedd": "AR Nedd",           // 1131647, 20m — claim before Darron Nedd can fuzz onto it
  "gudakesh motie": "G Motie",         // 670045, 137m
  "johnson charles": "J Charles",       // 333066, 301m
  "joshua da silva": "J Da Silva",     // 1168667, 26m — vs Amshi de Silva
  "kirk mckenzie": "KSA McKenzie",     // 1209196, 13m — vs Micah McKenzie / ND McKenzie (Neil, SA)
  "wanindu hasaranga": "Wanindu Hasaranga", // 784379, 277m — stored under the go-by name, not "PWH de Silva"
  "charith asalanka": "KIC Asalanka",  // 784367, 208m
  "dasun shanaka": "MD Shanaka",       // 437316, 296m
  "maheesh theekshana": "M Theekshana", // 1138316, 250m
  "shadley van schalkwyk": "SC van Schalkwyk", // 334621, 56m
  "moeen ali": "MM Ali",
  // ⚠️ SHARED-REGISTRY BUG WORKAROUND. The registry entry `ci:443150` is displayed as "Shai Hope"
  // but 443150 is KYLE Hope's cricinfo id, and it carries BOTH 'ka hope' and 'shai hope' as
  // aliases — the two brothers are MERGED onto Kyle's anchor. Resolving "Shai Hope" through the
  // registry therefore lands on "KA Hope" (11m) instead of the real star "SD Hope" (581379, 337m).
  // This alias overrides it locally (CPL_NAME_ALIASES is checked BEFORE the registry in
  // build-cpl-pool's resolveExact for exactly this reason). The PROPER fix is upstream in
  // wwc-points-bot: split ci:443150 into Kyle (443150) and Shai (581379) — the draft and the
  // points bot are mis-attributing him too.
  "shai hope": "SD Hope", // 581379, 337m
  "reeza hendricks": "RR Hendricks", // 269280, 192m — vs BE Hendricks (Beuran, 39m)
};

// Announced names with NO usable record in our DB, where the fuzzy pass would otherwise hand them
// a DIFFERENT player's career. Verified individually against the DB — each of these is a genuine
// newcomer/uncapped domestic, and the record fuzzy wanted to give him belongs to someone else who
// is NOT in CPL 2026 (so the claimed-set can't protect it). Listed here => resolution is skipped
// and the player is created statless, which prices him at baseline (the correct outcome).
// (Keys are normName-stripped.)
export const CPL_NO_DB_RECORD: Record<string, string> = {
  "zachary carter": "fuzzy grabbed JL Carter (Jonathan Carter, 87m CPL/ODI) — a different Barbadian",
  "vitel lawes": "fuzzy grabbed TE Lawes (Tom Lawes, Surrey, 32m BLAST/HUN). The registry knows they are two people (Vitel = ci:1500757, Tom = ci:1264775); we simply hold no ball-by-ball for Vitel",
  "jonathan van lange": "fuzzy grabbed M de Lange (Marchant de Lange, 128m) — unrelated South African",
};

// Display names: cricsheet initials-form (DB) -> friendly announced name (from the squad roster).
// Same problem LPL had: our ball-by-ball stores West Indians under initials ("JNT Seales" = Jayden
// Seales, "RRS Cornwall" = Rahkeem Cornwall, "MDKJ Perera" = Kusal Perera), which is unreadable on a
// bidding board. Applied in the DISPLAY READ (`/api/auction/[id]` GET) only — stats stay keyed by
// player_id, so this cannot affect valuation. GENERATED from the builder's own verified resolution
// (every entry is a name pair the pool actually produced), then reviewed one by one.
// To extend: add DB-name -> friendly entries here.
export const CPL_DISPLAY_NAMES: Record<string, string> = {
  "A Athanaze": "Alick Athanaze",
  "A Phillip": "Anderson Phillip",
  "AA Jangoo": "Amir Jangoo",
  "AD Hales": "Alex Hales",
  "AD Russell": "Andre Russell",
  "ADS Fletcher": "Andre Fletcher",
  "AJ Hosein": "Akeal Hosein",
  "AR Nedd": "Ashmead Nedd",
  "AS Joseph": "Alzarri Joseph",
  "AWJ Auguste": "Ackeem Auguste",
  "BA King": "Brandon King",
  "C Munro": "Colin Munro",
  "CJ Green": "Chris Green",
  "D Pretorius": "Dwaine Pretorius",
  "DC Drakes": "Dominic Drakes",
  "DR Sams": "Daniel Sams",
  "E Lewis": "Evin Lewis",
  "FA Allen": "Fabian Allen",
  "G Motie": "Gudakesh Motie",
  "GD Phillips": "Glenn Phillips",
  "GF Linde": "George Linde",
  "J Andrew": "Jewel Andrew",
  "J Bishop": "Joshua Bishop",
  "J Blades": "Jediah Blades",
  "J Charles": "Johnson Charles",
  "J Da Silva": "Joshua Da Silva",
  "J Layne": "Johann Layne",
  "J Royal": "Jeavor Royal",
  "JF Jeremiah": "Johann Jeremiah",
  "JM James": "Joshua James",
  "JN Hamilton": "Jahmar Hamilton",
  "JNT Seales": "Jayden Seales",
  "JO Holder": "Jason Holder",
  "JP Greaves": "Justin Greaves",
  "JS Louis": "Jeremiah Louis",
  "JU Goolie": "Jyd Goolie",
  "K Alleyne": "Kadeem Alleyne",
  "K Gaston": "Keon Gaston",
  "K Gore": "Karima Gore",
  "K Pierre": "Khary Pierre",
  "K Pitman": "Kelvin Pitman",
  "KA Pollard": "Kieron Pollard",
  "KHM James": "Kofi James",
  "KIC Asalanka": "Charith Asalanka",
  "KMA Paul": "Keemo Paul",
  "KO Wickham": "Kevin Wickham",
  "KR Mayers": "Kyle Mayers",
  "KSA McKenzie": "Kirk McKenzie",
  "KU Carty": "Keacy Carty",
  "M Clarke": "McKenny Clarke",
  "M Louis": "Mikyle Louis",
  "M Nandu": "Matthew Nandu",
  "M Theekshana": "Maheesh Theekshana",
  "MD Shanaka": "Dasun Shanaka",
  "MDKJ Perera": "Kusal Perera",
  "MM Ali": "Moeen Ali",
  "MP Breetzke": "Matthew Breetzke",
  "MW Forde": "Matthew Forde",
  "N Bidaisee": "Navin Bidaisee",
  "N Edward": "Nathan Edward",
  "N Pooran": "Nicholas Pooran",
  "OC McCoy": "Obed McCoy",
  "OF Smith": "Odean Smith",
  "Q Sampson": "Quentin Sampson",
  "Q de Kock": "Quinton de Kock",
  "R Powell": "Rovman Powell",
  "R Shepherd": "Romario Shepherd",
  "RA Clarke": "Rivaldo Clarke",
  "RR Hendricks": "Reeza Hendricks",
  "RL Chase": "Roston Chase",
  "RR Simmonds": "Ramon Simmonds",
  "RRS Cornwall": "Rahkeem Cornwall",
  "S Descarte": "Shadrack Descarte",
  "S Joseph": "Shamar Joseph",
  "SC van Schalkwyk": "Shadley van Schalkwyk",
  "SD Hope": "Shai Hope",
  "SD Parris": "Shaqkere Parris",
  "SE Rutherford": "Sherfane Rutherford",
  "SK Springer": "Shamar Springer",
  "SO Hetmyer": "Shimron Hetmyer",
  "SP Narine": "Sunil Narine",
  "Sufiyan Muqeem": "Sufyan Moqim",
  "T Hinds": "Terrance Hinds",
  "TL Seifert": "Tim Seifert",
  "V Permaul": "Veerasammy Permaul",
  "Z Motara": "Zishan Motara",
};

// CPL venue model — the 8 grounds of the 2026 edition.
//
// ⚠️ These `type` values are DISPLAY ONLY. Venue no longer affects any price (removed 5 Aug 2026),
// and the auction UI DERIVES the type live from the measured Bat Index rather than trusting the
// value below — see venueTypeFromBatIndex in src/lib/venues/bat-index.ts. They are corrected here so
// the source file is not misleading, but the derived value is the authority.
//
// The values were WRONG in 5 of 8 cases until 5 Aug 2026, for two reasons worth remembering:
//   1. MIS-CALIBRATION. They were classified against 1.0, but bowlers out-earn batters at 76% of
//      grounds (a wicket is 30 points), so the true neutral is the ~0.906 league MEDIAN. Judging
//      against 1.0 shoved ordinary grounds into "bowl_friendly".
//   2. STALE INPUTS. The original read used a 60-month window with INCOMPLETE variant lists — 4 of
//      these 8 grounds were missing cricsheet spellings — and included Vitality Blast.
// Worst error: Warner Park, our best-sampled Caribbean ground (24 matches) and St Kitts' home for 4
// games, was called bowl_friendly when batters actually out-earn bowlers there.
//
// Current Bat Index (batting FP / bowling FP; league median 0.906; higher = better for batting):
//   Queen's Park Oval 1.137 (8m) · Sabina Park 1.104 (11m) · Warner Park 1.068 (24m)
//   Daren Sammy 0.980 (28m) · Kensington 0.972 (26m) · Providence 0.886 (20m)
//   Sir Vivian Richards 0.879 (17m) · Arnos Vale 0.617 (6m — thin, treat as directional only)
// So the Caribbean is NOT the bowler's league an earlier read suggested: measured against the world
// median, five of these eight grounds are neutral-to-batting-friendly.
export type VenueType = "bat_road" | "balanced" | "bowl_friendly";
export const CPL_VENUES: Array<{ canonical: string; variants: string[]; type: VenueType }> = [
  { canonical: "Arnos Vale Ground, Kingstown, St Vincent",
    variants: ["Arnos Vale Ground, Kingstown, St Vincent",
               "Arnos Vale Ground, Kingstown",
               "Arnos Vale Ground"],
    type: "bowl_friendly" },
  { canonical: "Sir Vivian Richards Stadium, North Sound, Antigua",
    variants: ["Sir Vivian Richards Stadium, North Sound, Antigua",
               "Sir Vivian Richards Stadium, North Sound",
               "Sir Vivian Richards Stadium, Antigua",
               "Sir Vivian Richards Stadium"],
    type: "balanced" },
  { canonical: "Warner Park, Basseterre, St Kitts",
    variants: ["Warner Park, Basseterre, St Kitts", "Warner Park, Basseterre", "Warner Park, St Kitts"],
    type: "bat_road" },
  { canonical: "Providence Stadium, Guyana",
    variants: ["Providence Stadium, Guyana", "Providence Stadium"],
    type: "balanced" },
  { canonical: "Daren Sammy National Cricket Stadium, Gros Islet, St Lucia",
    variants: ["Daren Sammy National Cricket Stadium, Gros Islet, St Lucia",
               "Daren Sammy National Cricket Stadium, Gros Islet",
               "Daren Sammy National Cricket Stadium"],
    type: "balanced" },
  { canonical: "Kensington Oval, Bridgetown, Barbados",
    variants: ["Kensington Oval, Bridgetown, Barbados", "Kensington Oval, Bridgetown", "Kensington Oval, Barbados"],
    type: "balanced" },
  { canonical: "Sabina Park, Kingston, Jamaica",
    variants: ["Sabina Park, Kingston, Jamaica", "Sabina Park, Kingston"],
    type: "bat_road" },
  { canonical: "Queen's Park Oval, Port of Spain, Trinidad",
    variants: ["Queen's Park Oval, Port of Spain, Trinidad",
               "Queen's Park Oval, Port of Spain",
               "Queen's Park Oval, Trinidad",
               "Queen's Park Oval"],
    type: "bat_road" },
];

// Per-team league schedule (10 games each) derived from the actual 35-match fixture list. CPL 2026
// runs in 4 regional phases and is HOME-HEAVY — every franchise plays 4–5 games at its own ground —
// so venue exposure genuinely differentiates teams (e.g. GAW get 5 at bowl-friendly Providence,
// TKR 5 at Queen's Park Oval, BAR 5 at Kensington). Playoffs (all 4 at Kensington) are excluded.
const AV = "Arnos Vale Ground, Kingstown, St Vincent";
const SVR = "Sir Vivian Richards Stadium, North Sound, Antigua";
const WP = "Warner Park, Basseterre, St Kitts";
const PRO = "Providence Stadium, Guyana";
const DSC = "Daren Sammy National Cricket Stadium, Gros Islet, St Lucia";
const KEN = "Kensington Oval, Bridgetown, Barbados";
const SAB = "Sabina Park, Kingston, Jamaica";
const QPO = "Queen's Park Oval, Port of Spain, Trinidad";

// Venue basis switch.
//  'per-team'   — each franchise is valued on ITS OWN 10-game venue mix (below). CPL 2026's legs are
//                 REGIONAL and the host plays 4–5 of its 10 at home, so bowl-friendly exposure ranges
//                 from 2/10 (BAR, home = balanced Kensington) to 8/10 (ABF, home = bowl-friendly SVR
//                 plus the two Arnos Vale openers). That 60-point spread is real signal.
//  'tournament' — every franchise gets the SAME pooled mix across all 70 team-games
//                 (DSC/QPO/PRO/KEN 10 each, SVR/WP/SAB 8, Arnos Vale 6 → 46% bowl-friendly).
//                 Use this if you'd rather not let the fixture list differentiate squads.
// NOTE this is NOT the LPL case: LPL's legs were neutral SL grounds that all 5 teams rotated through
// near-identically, so there per-team and tournament-level were the same number.
export const CPL_VENUE_BASIS: "per-team" | "tournament" = "per-team";

// Pooled tournament-level mix (all 35 matches x 2 sides = 70 team-games), normalized to a 10-game
// campaign so it stays comparable to the per-team schedules.
export const CPL_TOURNAMENT_SCHEDULE: Array<{ venue: string; games: number }> = [
  { venue: DSC, games: 10 / 7 }, { venue: QPO, games: 10 / 7 },
  { venue: PRO, games: 10 / 7 }, { venue: KEN, games: 10 / 7 },
  { venue: SVR, games: 8 / 7 }, { venue: WP, games: 8 / 7 },
  { venue: SAB, games: 8 / 7 }, { venue: AV, games: 6 / 7 },
];

export const CPL_TEAM_SCHEDULE: Record<string, Array<{ venue: string; games: number }>> = {
  ABF: [{ venue: AV, games: 2 }, { venue: SVR, games: 4 }, { venue: DSC, games: 1 },
        { venue: WP, games: 1 }, { venue: QPO, games: 1 }, { venue: PRO, games: 1 }],
  BAR: [{ venue: KEN, games: 5 }, { venue: SAB, games: 1 }, { venue: DSC, games: 1 },
        { venue: SVR, games: 1 }, { venue: QPO, games: 1 }, { venue: WP, games: 1 }],
  GAW: [{ venue: PRO, games: 5 }, { venue: SAB, games: 1 }, { venue: DSC, games: 1 },
        { venue: SVR, games: 1 }, { venue: QPO, games: 1 }, { venue: KEN, games: 1 }],
  JAM: [{ venue: SAB, games: 4 }, { venue: AV, games: 1 }, { venue: DSC, games: 1 },
        { venue: WP, games: 1 }, { venue: QPO, games: 1 }, { venue: PRO, games: 1 },
        { venue: KEN, games: 1 }],
  SKN: [{ venue: WP, games: 4 }, { venue: AV, games: 1 }, { venue: DSC, games: 1 },
        { venue: SAB, games: 1 }, { venue: SVR, games: 1 }, { venue: PRO, games: 1 },
        { venue: KEN, games: 1 }],
  SLK: [{ venue: DSC, games: 5 }, { venue: AV, games: 1 }, { venue: QPO, games: 1 },
        { venue: WP, games: 1 }, { venue: KEN, games: 1 }, { venue: PRO, games: 1 }],
  TKR: [{ venue: QPO, games: 5 }, { venue: AV, games: 1 }, { venue: SAB, games: 1 },
        { venue: SVR, games: 1 }, { venue: KEN, games: 1 }, { venue: PRO, games: 1 }],
};
