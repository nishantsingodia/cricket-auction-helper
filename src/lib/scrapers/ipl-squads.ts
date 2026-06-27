import * as cheerio from "cheerio";

export interface ScrapedPlayer {
  name: string;
  role: "BAT" | "BOWL" | "AR" | "WK";
  country: string;
  isOverseas: boolean;
  isCaptain: boolean;
  price: number; // in Cr, 0 if unknown
  squadNumber: number; // lineup order within team
}

export interface ScrapedTeam {
  team: string; // short code: CSK, MI, SRH, etc.
  teamFullName: string;
  players: ScrapedPlayer[];
}

const TEAM_SLUGS: Record<string, { slug: string; short: string }> = {
  "Chennai Super Kings": { slug: "chennai-super-kings", short: "CSK" },
  "Delhi Capitals": { slug: "delhi-capitals", short: "DC" },
  "Gujarat Titans": { slug: "gujarat-titans", short: "GT" },
  "Kolkata Knight Riders": { slug: "kolkata-knight-riders", short: "KKR" },
  "Lucknow Super Giants": { slug: "lucknow-super-giants", short: "LSG" },
  "Mumbai Indians": { slug: "mumbai-indians", short: "MI" },
  "Punjab Kings": { slug: "punjab-kings", short: "PBKS" },
  "Rajasthan Royals": { slug: "rajasthan-royals", short: "RR" },
  "Royal Challengers Bengaluru": {
    slug: "royal-challengers-bengaluru",
    short: "RCB",
  },
  "Sunrisers Hyderabad": { slug: "sunrisers-hyderabad", short: "SRH" },
};

function normalizeRole(
  roleText: string
): "BAT" | "BOWL" | "AR" | "WK" {
  const r = roleText.toLowerCase().trim();
  if (r.includes("wk") || r.includes("wicket")) return "WK";
  if (r.includes("all") || r.includes("all-rounder")) return "AR";
  if (r.includes("bowl")) return "BOWL";
  return "BAT";
}

// Determine country from player name matching or default to IND
function inferCountry(isOverseas: boolean): string {
  return isOverseas ? "OS" : "IND";
}

async function fetchTeamSquad(
  slug: string,
  shortCode: string,
  fullName: string
): Promise<ScrapedTeam> {
  const url = `https://www.iplt20.com/teams/${slug}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const players: ScrapedPlayer[] = [];
  let squadNum = 1;

  // iplt20.com uses .ih-pcard1 for player cards
  $("li.ih-pcard1, li[class*='player']").each((_i, el) => {
    const $el = $(el);
    const name =
      $el.find("h3").first().text().trim() ||
      $el.find("h2").first().text().trim() ||
      $el.find("h4").first().text().trim();
    const roleText =
      $el.find("p").first().text().trim() || "Batter";
    const isOverseas =
      $el.find("[class*='foreign']").length > 0 ||
      $el.find("img[alt*='foreign'], img[src*='foreign']").length > 0;
    const isCaptain =
      $el.find("[class*='captain']").length > 0 ||
      $el.find("img[alt*='captain'], img[src*='captain']").length > 0;

    if (name) {
      players.push({
        name,
        role: normalizeRole(roleText),
        country: inferCountry(isOverseas),
        isOverseas,
        isCaptain,
        price: 0,
        squadNumber: squadNum++,
      });
    }
  });

  // Fallback: try generic list items with player-like structure
  if (players.length === 0) {
    $("a[href*='/players/']").each((_i, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 2 && !name.includes("View")) {
        players.push({
          name,
          role: "BAT",
          country: "IND",
          isOverseas: false,
          isCaptain: false,
          price: 0,
          squadNumber: squadNum++,
        });
      }
    });
  }

  return {
    team: shortCode,
    teamFullName: fullName,
    players,
  };
}

export async function fetchAllIPLSquads(): Promise<ScrapedTeam[]> {
  const teams: ScrapedTeam[] = [];
  const entries = Object.entries(TEAM_SLUGS);

  // Fetch in batches of 3 to avoid rate limiting
  for (let i = 0; i < entries.length; i += 3) {
    const batch = entries.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(([fullName, { slug, short: shortCode }]) =>
        fetchTeamSquad(slug, shortCode, fullName).catch((err) => {
          console.error(`Failed to fetch ${fullName}:`, err);
          return {
            team: shortCode,
            teamFullName: fullName,
            players: [],
          } as ScrapedTeam;
        })
      )
    );
    teams.push(...results);

    // Small delay between batches
    if (i + 3 < entries.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return teams;
}

// Fetch auction prices from iplt20.com/auction page
export async function fetchAuctionPrices(): Promise<
  Map<string, { team: string; price: number }>
> {
  const prices = new Map<string, { team: string; price: number }>();

  try {
    const res = await fetch("https://www.iplt20.com/auction/2025", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!res.ok) return prices;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Try to extract player-price pairs from auction page
    $("[class*='auction'] [class*='player'], tr, [class*='sold']").each(
      (_i, el) => {
        const text = $(el).text();
        // Look for patterns like "Player Name ... ₹XX.XX Cr"
        const match = text.match(
          /([A-Z][a-z]+ [A-Z][a-z]+).*?(?:₹|Rs\.?)\s*([\d.]+)\s*(?:Cr|crore)/i
        );
        if (match) {
          prices.set(match[1].trim().toLowerCase(), {
            team: "",
            price: parseFloat(match[2]),
          });
        }
      }
    );
  } catch {
    console.error("Failed to fetch auction prices");
  }

  return prices;
}

// Normalize name for fuzzy matching
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
