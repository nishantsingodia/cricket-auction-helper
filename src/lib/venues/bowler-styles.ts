// Bowler spin/pace classification — keyed by stable cricsheet_id (no name-collision risk).
// Used to compute the venue "wickets by bowler type" split from actual bowl_wickets in
// match_performances. This is a FACTUAL attribute per bowler (not a fabricated stat), but we
// hold no bowler-style data in the pipeline (cricsheet carries none; players.bowl_style is
// empty), so this map is hand-maintained. Seeded from the top wicket-takers at the Hundred +
// LPL grounds so coverage is highest exactly where it's shown; the venue view reports the
// share of wickets that ARE classified so a partial map stays honest. Extend freely.
//
// "spin" = finger/wrist spin (off, leg, SLA, left-arm wrist). "pace" = any seam/fast/medium.
// Only high-confidence classifications are included — accuracy matters more than coverage.

export type BowlerStyle = "spin" | "pace";

export const BOWLER_STYLE: Record<string, BowlerStyle> = {
  // ── Spin ──────────────────────────────────────────────────────────────────
  "249d60c9": "spin", // AU Rashid (Adil Rashid) — leg
  "cdb82f1c": "spin", // S Ecclestone — SLA
  "b34e0c77": "spin", // S Glenn (Sarah Glenn) — leg
  "9b3bcca4": "spin", // A Wellington — leg
  "201fef33": "spin", // DB Sharma (Deepti Sharma) — off
  "340202b0": "spin", // LCN Smith (Linsey Smith) — SLA
  "00823a96": "spin", // KL Gordon (Kirstie Gordon) — SLA
  "d32cf49a": "spin", // HK Matthews (Hayley Matthews) — off
  "4a461c24": "spin", // LA Dawson (Liam Dawson) — SLA
  "c6625a26": "spin", // CE Dean (Charlie Dean) — off
  "a97c8ec2": "spin", // Wanindu Hasaranga — leg
  "14f96089": "spin", // A Zampa — leg
  "5f547c8b": "spin", // Rashid Khan — leg
  "83558266": "spin", // A King (Alana King) — leg
  "f24c6701": "spin", // M Theekshana — off/mystery
  "0475a86b": "spin", // JL Jonassen (Jess Jonassen) — SLA
  "7673c908": "spin", // AC Kerr (Amelia Kerr) — leg
  "cd62f670": "spin", // MK Villiers (Mady Villiers) — off
  "22b98d7c": "spin", // TW Hartley (Tom Hartley) — SLA
  "ee0c05c0": "spin", // NA Sowter (Nathan Sowter) — leg
  "736123bb": "spin", // DN Wellalage (Dunith Wellalage) — SLA
  "9de62878": "spin", // Shadab Khan — leg
  "a03bba42": "spin", // T Shamsi — left-arm wrist
  "50c6bc2b": "spin", // LS Livingstone (Liam Livingstone) — leg/off
  "c296dba1": "spin", // Sophia Smale — SLA
  "bc969efb": "spin", // A Gardner (Ashleigh Gardner) — off
  "0ecb4de6": "spin", // Rehan Ahmed — leg
  "9cb8d7a6": "spin", // Imad Wasim — SLA
  "f0b4e47d": "spin", // G Wareham (Georgia Wareham) — leg
  "9caf69a1": "spin", // WG Jacks (Will Jacks) — off
  "bb351c23": "spin", // MM Ali (Moeen Ali) — off
  "9d430b40": "spin", // SP Narine (Sunil Narine) — off/mystery
  "19708692": "spin", // MW Parkinson (Matt Parkinson) — leg
  "f0a0204e": "spin", // MS Crane (Mason Crane) — leg
  "910dd54e": "spin", // A Capsey (Alice Capsey) — off
  "583ce32c": "spin", // N Shree Charani — SLA
  "18fac429": "spin", // SR Patel (Samit Patel) — off
  "53bb50f0": "spin", // Sadia Iqbal — SLA
  "e4a0deae": "spin", // MJ Santner (Mitchell Santner) — SLA
  "e5218454": "spin", // JB Lintott (Jake Lintott) — SLA
  "f3abd0c9": "spin", // DR Briggs (Danny Briggs) — SLA
  "a61850e6": "spin", // I Ranaweera — SLA
  "4d7f517e": "spin", // AJ Hosein (Akeal Hosein) — SLA
  "53d50717": "spin", // A Hartley (Alex Hartley) — SLA
  "c34a15e6": "spin", // WK Dilhari (Kavisha Dilhari) — off
  "641ac5ff": "spin", // IS Sodhi (Ish Sodhi) — leg
  "4d4605e6": "spin", // CL Tryon (Chloe Tryon) — SLA
  "19b9f399": "spin", // CJ Green (Chris Green) — off

  // ── Pace ──────────────────────────────────────────────────────────────────
  "38b4583c": "pace", // LK Bell (Lauren Bell)
  "e94915e6": "pace", // SM Curran (Sam Curran) — LF
  "ffe699c0": "pace", // CJ Jordan (Chris Jordan)
  "63e3b6b3": "pace", // M Kapp (Marizanne Kapp)
  "245c97cb": "pace", // TS Mills (Tymal Mills) — LF
  "1ade138e": "pace", // KL Cross (Kate Cross)
  "e86754b2": "pace", // TK Curran (Tom Curran)
  "7f048519": "pace", // DJ Willey (David Willey) — LF
  "0bec3a6c": "pace", // BAC Howell (Benny Howell) — medium
  "108c4c09": "pace", // S Ismail (Shabnim Ismail)
  "7b1f2542": "pace", // GL Adams (Georgia Adams) — medium
  "65d9b6b6": "pace", // A Sutherland (Annabel Sutherland)
  "350bb1b1": "pace", // AF Milne (Adam Milne)
  "679cd31e": "pace", // SJ Cook (Sam Cook)
  "2479daa6": "pace", // FR Davies (Freya Davies)
  "65b6943c": "pace", // L Wood (Luke Wood) — LF
  "6c79c098": "pace", // DA Payne (David Payne) — LF
  "5574750c": "pace", // JC Archer (Jofra Archer)
  "e9987a94": "pace", // C Overton (Craig Overton)
  "8db7f47f": "pace", // RJW Topley (Reece Topley) — LF
  "f13d3eba": "pace", // KE Bryce (Kathryn Bryce) — medium
  "64839cb3": "pace", // M Pathirana (Matheesha Pathirana)
  "17608a6f": "pace", // ML Schutt (Megan Schutt)
  "24bb1c2f": "pace", // Haris Rauf
  "9061a703": "pace", // J Little (Josh Little) — LF
  "327b58d3": "pace", // Dushmantha Chameera
  "57590dbb": "pace", // PI Walter (Paul Walter) — left-arm medium
  "0f6db197": "pace", // S Mahmood (Saqib Mahmood)
  "32497ecd": "pace", // A Shrubsole (Anya Shrubsole)
  "402f8494": "pace", // RJ Gleeson (Richard Gleeson)
  "99812d10": "pace", // H Graham (Heather Graham)
  "35828bdd": "pace", // AN Davidson-Richards
  "15f609ed": "pace", // NE Farrant (Natasha Farrant) — LF
  "e5b17517": "pace", // IECM Wong (Issy Wong)
  "ee1b6c27": "pace", // N Thushara (Nuwan Thushara)
  "ac5ae4af": "pace", // I Udana (Isuru Udana) — LF
  "13c35c9e": "pace", // TG Southee (Tim Southee)
  "1d2f290a": "pace", // JA Thompson (Jordan Thompson) — medium
  "31adb911": "pace", // L Filer (Lauren Filer)
  "45a7e761": "pace", // Shaheen Shah Afridi — LF
  "7298db76": "pace", // Renuka Singh
  "de69af96": "pace", // SFM Devine (Sophie Devine) — medium
  "1a2676c5": "pace", // SA Abbott (Sean Abbott)
  "dfc4d8b5": "pace", // KW Richardson (Kane Richardson)
  "1f1b4c89": "pace", // JC Tongue (Josh Tongue)
  "74a274cc": "pace", // TG Helm (Tom Helm)
  "1cfac535": "pace", // CP Wood (Chris Wood) — LF
  "894b2d25": "pace", // MJ Potts (Matthew Potts)
  "f3a18a0c": "pace", // NR Sciver (Nat Sciver-Brunt) — medium
  "d9273ee7": "pace", // MP Stoinis (Marcus Stoinis)
  "be869ccf": "pace", // GHS Garton (George Garton) — LF
  "9eb1455b": "pace", // NT Ellis (Nathan Ellis)
  "caf69bf7": "pace", // DR Sams (Daniel Sams) — LF
  "208f22ea": "pace", // DJ Worrall (Daniel Worrall)
  "abc9f8a4": "pace", // FG Kemp (Freya Kemp) — LF
  "59559bc2": "pace", // J Overton (Jamie Overton)
  "e84ac20c": "pace", // MJ Henry (Matt Henry)
  "3d0ed2f9": "pace", // JT Ball (Jake Ball)
  "70d57519": "pace", // AAP Atkinson (Gus Atkinson)
  "2f9d0389": "pace", // LH Ferguson (Lockie Ferguson)
  "be150fc8": "pace", // EA Perry (Ellyse Perry) — medium
  "6a434bd3": "pace", // KH Brunt (Katherine Brunt)
  "dda5aae5": "pace", // JK Fuller (James Fuller)
  "287ed3a0": "pace", // GA Elwiss (Georgia Elwiss) — medium
  "dabbd0ae": "pace", // B Fernando (Binura Fernando) — LF
  "3ff033bb": "pace", // MD Shanaka (Dasun Shanaka) — medium
  "06c2de82": "pace", // L Gregory (Lewis Gregory) — medium
  "c5f40e35": "pace", // SW Currie (Scott Currie)
  "459a7b0a": "pace", // R MacDonald-Gay

  // ── LPL / Sri Lankan-ground additions (lift coverage at the SL venues) ──────
  // spin
  "aceb7654": "spin", // JDF Vandersay (Jeffrey Vandersay) — leg
  "efc04be7": "spin", // Noor Ahmad — left-arm wrist
  "b52ffbbd": "spin", // FA Allen (Fabian Allen) — SLA
  "7d608e12": "spin", // DM de Silva (Dhananjaya de Silva) — off
  "03a83c50": "spin", // V Viyaskanth — leg
  "f78e7113": "spin", // S Prasanna (Seekkuge Prasanna) — leg
  "1be67d37": "spin", // RTM Mendis (Ramesh Mendis) — off
  "08548b13": "spin", // Kamindu Mendis — spin (ambidextrous)
  "acee4cc4": "spin", // Imran Tahir — leg
  "e94d1dcd": "spin", // Usman Tariq — off
  "62af8546": "spin", // Mohammad Nabi — off
  "7dc35884": "spin", // Shakib Al Hasan — SLA
  "abb7c76c": "spin", // Abrar Ahmed — mystery/leg
  "3086f7a4": "spin", // Mohammad Nawaz — SLA
  "64c34cd0": "spin", // Shoaib Malik — off
  "5b16a806": "spin", // A Dananjaya (Akila Dananjaya) — off/mystery
  "7d92277a": "spin", // Mujeeb Ur Rahman — off/mystery
  "26d041c4": "spin", // Sikandar Raza — off
  // pace
  "2af838ee": "pace", // N Pradeep (Nuwan Pradeep)
  "8012d0b8": "pace", // CAK Rajitha (Kasun Rajitha)
  "de7d833e": "pace", // D Madushanka (Dilshan Madushanka) — LF
  "fb3e0d39": "pace", // C Karunaratne (Chamika Karunaratne)
  "8596fe80": "pace", // Mohammad Hasnain
  "4751caa3": "pace", // CBRLS Kumara (Lahiru Kumara)
  "de3d549a": "pace", // AM Fernando (Asitha Fernando)
  "11614d87": "pace", // D Pretorius (Dwaine Pretorius)
  "b3118300": "pace", // Wahab Riaz — LF
  "449f4e3c": "pace", // B Muzarabani (Blessing Muzarabani)
  "c0c411cb": "pace", // Naveen-ul-Haq
  "e342e5fb": "pace", // CR Brathwaite (Carlos Brathwaite)
  "896d78ad": "pace", // AD Mathews (Angelo Mathews) — medium
  "9c9af282": "pace", // Naseem Shah
  "c6097d68": "pace", // O Thomas (Oshane Thomas)
  "ded9ff1e": "pace", // JNT Seales (Jayden Seales)
  "f0e293b0": "pace", // Zahoor Khan
  "2f28dc94": "pace", // RAS Lakmal (Suranga Lakmal)
  "e7e86505": "pace", // B Evans (Brad Evans)
  "2911de16": "pace", // Hasan Ali
  "6e3f5a5c": "pace", // R Ngarava (Richard Ngarava) — LF
  "a5c48ed1": "pace", // C Wickramasinghe (Chamindu Wickramasinghe) — medium
  "8f6dd463": "pace", // Azmatullah Omarzai
  "0f12f9df": "pace", // NLTC Perera (Thisara Perera)
  "3f5f39cd": "pace", // Al-Amin Hossain
};
